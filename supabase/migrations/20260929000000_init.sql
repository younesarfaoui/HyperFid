-- =============================================================================
-- HyperFid — initial schema
-- Multi-tenant loyalty platform: merchants, admin profiles, one-time QR codes,
-- device-bound digital wallets. Every security boundary lives here:
--   * RLS on every table (tenant isolation, super-admin bypass)
--   * guard triggers (column-level rules RLS cannot express)
--   * SECURITY DEFINER RPCs for the anonymous scan and privileged mutations
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'merchant_admin');

create type public.subscription_status as enum (
  'trial', 'active', 'past_due', 'suspended', 'cancelled'
);

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.merchants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 2 and 120),
  category            text not null check (char_length(btrim(category)) between 2 and 60),
  -- Instant-win probability, stored as a percentage (10.00 = 10%).
  win_rate            numeric(5, 2) not null default 10.00 check (win_rate >= 0 and win_rate <= 100),
  reward_description  text not null check (char_length(btrim(reward_description)) between 2 and 160),
  subscription_status public.subscription_status not null default 'trial',
  stamps_goal         integer not null default 10 check (stamps_goal between 1 and 50),
  brand_color         text not null default '#6F4E37' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'merchant_admin',
  merchant_id uuid references public.merchants (id) on delete set null,
  email       text,
  created_at  timestamptz not null default now(),
  constraint profiles_super_admin_has_no_merchant check (role <> 'super_admin' or merchant_id is null)
);

create index profiles_merchant_id_idx on public.profiles (merchant_id);

create table public.digital_wallets (
  id                 uuid primary key default gen_random_uuid(),
  -- HMAC-SHA256 of the device cookie (hex). The raw cookie never reaches the DB.
  device_fingerprint text not null check (device_fingerprint ~ '^[0-9a-f]{64}$'),
  merchant_id        uuid not null references public.merchants (id) on delete cascade,
  current_stamps     integer not null default 0 check (current_stamps >= 0),
  rewards_redeemed   integer not null default 0 check (rewards_redeemed >= 0),
  last_scan_date     timestamptz,
  pass_serial        text,
  pass_share_url     text,
  google_save_url    text,
  pass_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  constraint digital_wallets_one_per_device unique (merchant_id, device_fingerprint)
);

create unique index digital_wallets_pass_serial_key
  on public.digital_wallets (pass_serial) where pass_serial is not null;

-- One row per physical, single-use QR code.
create table public.qr_batches (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.merchants (id) on delete cascade,
  batch_id        uuid not null,
  batch_label     text not null default '' check (char_length(batch_label) <= 80),
  is_scanned      boolean not null default false,
  scan_date       timestamptz,
  is_winner       boolean not null default false,
  wallet_id       uuid references public.digital_wallets (id) on delete set null,
  -- 6 chars from an unambiguous alphabet (no I, O, 0, 1).
  redemption_code text check (redemption_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  redeemed_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint qr_scan_date_matches_flag check (is_scanned = (scan_date is not null)),
  constraint qr_winner_requires_scan  check (not is_winner or is_scanned),
  constraint qr_code_iff_winner       check ((redemption_code is not null) = is_winner),
  constraint qr_redeem_requires_win   check (redeemed_at is null or is_winner)
);

create index qr_batches_merchant_scan_idx on public.qr_batches (merchant_id, scan_date) where is_scanned;
create index qr_batches_batch_idx on public.qr_batches (batch_id);
create index qr_batches_wallet_idx on public.qr_batches (wallet_id) where wallet_id is not null;
create unique index qr_batches_redemption_code_key
  on public.qr_batches (merchant_id, redemption_code) where redemption_code is not null;

-- -----------------------------------------------------------------------------
-- Private helpers (schema not exposed through PostgREST)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
  );
$$;

create or replace function private.current_merchant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.merchant_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'merchant_admin';
$$;

revoke all on function private.is_super_admin() from public;
revoke all on function private.current_merchant_id() from public;
grant execute on function private.is_super_admin() to authenticated, service_role;
grant execute on function private.current_merchant_id() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Profile bootstrap: role/merchant come ONLY from app_metadata (service-role
-- writable). user_metadata is user-controlled and never trusted.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     public.user_role := 'merchant_admin';
  v_merchant uuid;
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') in ('super_admin', 'merchant_admin') then
    v_role := (new.raw_app_meta_data ->> 'role')::public.user_role;
  end if;

  if v_role = 'merchant_admin' and new.raw_app_meta_data ? 'merchant_id' then
    begin
      v_merchant := (new.raw_app_meta_data ->> 'merchant_id')::uuid;
    exception when invalid_text_representation then
      v_merchant := null;
    end;

    if v_merchant is not null
       and not exists (select 1 from public.merchants m where m.id = v_merchant) then
      v_merchant := null;
    end if;
  end if;

  insert into public.profiles (id, role, merchant_id, email)
  values (new.id, v_role, v_merchant, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Guard triggers
-- -----------------------------------------------------------------------------

-- Merchant admins may only edit presentation fields of their own merchant.
create or replace function private.merchants_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'merchants.id and created_at are immutable' using errcode = '42501';
  end if;

  if current_user = 'authenticated' and not private.is_super_admin() then
    if new.name is distinct from old.name
       or new.category is distinct from old.category
       or new.win_rate is distinct from old.win_rate
       or new.subscription_status is distinct from old.subscription_status then
      raise exception 'Only a super admin can change name, category, win_rate or subscription_status'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger merchants_guard
  before update on public.merchants
  for each row execute function private.merchants_guard();

-- Integrity of a QR code's life cycle, enforced for every role.
create or replace function private.qr_batches_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.merchant_id is distinct from old.merchant_id
     or new.batch_id is distinct from old.batch_id
     or new.created_at is distinct from old.created_at then
    raise exception 'QR identity columns are immutable' using errcode = '42501';
  end if;

  if old.is_scanned then
    if not new.is_scanned
       or new.scan_date is distinct from old.scan_date
       or new.is_winner is distinct from old.is_winner
       or new.redemption_code is distinct from old.redemption_code
       -- Only allowed wallet change: anonymisation (wallet deleted -> NULL).
       or (new.wallet_id is distinct from old.wallet_id and new.wallet_id is not null) then
      raise exception 'A scanned QR code cannot be modified' using errcode = '42501';
    end if;
  end if;

  if old.redeemed_at is not null and new.redeemed_at is distinct from old.redeemed_at then
    raise exception 'Reward already redeemed' using errcode = '42501';
  end if;

  -- Merchant admins can only mark their wins as redeemed.
  if current_user = 'authenticated' and not private.is_super_admin() then
    if new.is_scanned is distinct from old.is_scanned
       or new.scan_date is distinct from old.scan_date
       or new.is_winner is distinct from old.is_winner
       or new.wallet_id is distinct from old.wallet_id
       or new.redemption_code is distinct from old.redemption_code
       or new.batch_label is distinct from old.batch_label then
      raise exception 'Merchant admins can only mark rewards as redeemed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger qr_batches_guard
  before update on public.qr_batches
  for each row execute function private.qr_batches_guard();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.qr_batches enable row level security;
alter table public.digital_wallets enable row level security;

-- Anonymous visitors get no direct table access: the scan goes through RPCs.
revoke all on public.merchants, public.profiles, public.qr_batches, public.digital_wallets from anon;
grant select, insert, update, delete
  on public.merchants, public.profiles, public.qr_batches, public.digital_wallets
  to authenticated;

-- merchants
create policy merchants_select on public.merchants
  for select to authenticated
  using ((select private.is_super_admin()) or id = (select private.current_merchant_id()));

create policy merchants_insert on public.merchants
  for insert to authenticated
  with check ((select private.is_super_admin()));

create policy merchants_update on public.merchants
  for update to authenticated
  using ((select private.is_super_admin()) or id = (select private.current_merchant_id()))
  with check ((select private.is_super_admin()) or id = (select private.current_merchant_id()));

create policy merchants_delete on public.merchants
  for delete to authenticated
  using ((select private.is_super_admin()));

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_super_admin()));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select private.is_super_admin()));

create policy profiles_update on public.profiles
  for update to authenticated
  using ((select private.is_super_admin()))
  with check ((select private.is_super_admin()));

create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select private.is_super_admin()));

-- qr_batches
create policy qr_batches_select on public.qr_batches
  for select to authenticated
  using ((select private.is_super_admin()) or merchant_id = (select private.current_merchant_id()));

create policy qr_batches_insert on public.qr_batches
  for insert to authenticated
  with check ((select private.is_super_admin()));

-- Column restrictions for merchant admins are enforced by qr_batches_guard.
create policy qr_batches_update on public.qr_batches
  for update to authenticated
  using ((select private.is_super_admin()) or merchant_id = (select private.current_merchant_id()))
  with check ((select private.is_super_admin()) or merchant_id = (select private.current_merchant_id()));

create policy qr_batches_delete on public.qr_batches
  for delete to authenticated
  using ((select private.is_super_admin()));

-- digital_wallets (writes happen through SECURITY DEFINER RPCs only)
create policy digital_wallets_select on public.digital_wallets
  for select to authenticated
  using ((select private.is_super_admin()) or merchant_id = (select private.current_merchant_id()));

create policy digital_wallets_insert on public.digital_wallets
  for insert to authenticated
  with check ((select private.is_super_admin()));

create policy digital_wallets_update on public.digital_wallets
  for update to authenticated
  using ((select private.is_super_admin()))
  with check ((select private.is_super_admin()));

create policy digital_wallets_delete on public.digital_wallets
  for delete to authenticated
  using ((select private.is_super_admin()));

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------
create view public.qr_batch_summaries
with (security_invoker = true) as
select
  q.batch_id,
  q.merchant_id,
  max(q.batch_label)                                 as batch_label,
  min(q.created_at)                                  as created_at,
  count(*)::int                                      as total,
  (count(*) filter (where q.is_scanned))::int        as scanned,
  (count(*) filter (where q.is_winner))::int         as wins,
  (count(*) filter (where q.redeemed_at is not null))::int as redeemed
from public.qr_batches q
group by q.batch_id, q.merchant_id;

revoke all on public.qr_batch_summaries from anon;
grant select on public.qr_batch_summaries to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: public QR lookup (GET landing page — no side effects, never leaks wins)
-- -----------------------------------------------------------------------------
create or replace function public.get_qr_public(p_code uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_qr       public.qr_batches%rowtype;
  v_merchant public.merchants%rowtype;
begin
  select * into v_qr from public.qr_batches q where q.id = p_code;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_merchant from public.merchants m where m.id = v_qr.merchant_id;

  return jsonb_build_object(
    'status', case
      when v_qr.is_scanned then 'already_scanned'
      when v_merchant.subscription_status not in ('trial', 'active') then 'merchant_inactive'
      else 'available'
    end,
    'merchant', jsonb_build_object(
      'name', v_merchant.name,
      'category', v_merchant.category,
      'reward_description', v_merchant.reward_description,
      'brand_color', v_merchant.brand_color,
      'stamps_goal', v_merchant.stamps_goal
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: claim a scan — the ONLY anonymous write path. Exactly-once semantics:
-- the QR row is locked FOR UPDATE and flipped in the same transaction as the
-- win roll and the wallet stamp.
-- -----------------------------------------------------------------------------
create or replace function public.claim_qr_scan(p_code uuid, p_device_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_qr        public.qr_batches%rowtype;
  v_merchant  public.merchants%rowtype;
  v_wallet    public.digital_wallets%rowtype;
  v_is_new    boolean;
  v_bytes     bytea;
  v_roll      numeric;
  v_is_winner boolean;
  v_code      text;
  v_attempt   integer := 0;
  v_now       timestamptz := now();
begin
  if p_code is null or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_qr from public.qr_batches where id = p_code for update;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_merchant from public.merchants where id = v_qr.merchant_id;

  if v_qr.is_scanned then
    return jsonb_build_object(
      'status', 'already_scanned',
      'merchant', jsonb_build_object('name', v_merchant.name, 'brand_color', v_merchant.brand_color)
    );
  end if;

  -- Inactive tenant: refuse without burning the code.
  if v_merchant.subscription_status not in ('trial', 'active') then
    return jsonb_build_object(
      'status', 'merchant_inactive',
      'merchant', jsonb_build_object('name', v_merchant.name, 'brand_color', v_merchant.brand_color)
    );
  end if;

  -- CSPRNG roll uniformly distributed in [0, 1).
  v_bytes := extensions.gen_random_bytes(4);
  v_roll := (
      (get_byte(v_bytes, 0)::bigint << 24)
    | (get_byte(v_bytes, 1)::bigint << 16)
    | (get_byte(v_bytes, 2)::bigint << 8)
    |  get_byte(v_bytes, 3)::bigint
  )::numeric / 4294967296;
  v_is_winner := v_roll < (v_merchant.win_rate / 100);

  v_is_new := not exists (
    select 1 from public.digital_wallets w
    where w.merchant_id = v_merchant.id and w.device_fingerprint = p_device_hash
  );

  insert into public.digital_wallets as w (device_fingerprint, merchant_id, current_stamps, last_scan_date)
  values (p_device_hash, v_merchant.id, 1, v_now)
  on conflict (merchant_id, device_fingerprint) do update
    set current_stamps = w.current_stamps + 1,
        last_scan_date = excluded.last_scan_date
  returning * into v_wallet;

  loop
    v_code := null;
    if v_is_winner then
      -- 256 is a multiple of 32, so byte % 32 is unbiased.
      v_bytes := extensions.gen_random_bytes(6);
      v_code := '';
      for i in 0..5 loop
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
      end loop;
    end if;

    begin
      update public.qr_batches
         set is_scanned = true,
             scan_date = v_now,
             is_winner = v_is_winner,
             wallet_id = v_wallet.id,
             redemption_code = v_code
       where id = v_qr.id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise exception 'Could not allocate a unique redemption code';
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'is_winner', v_is_winner,
    'redemption_code', v_code,
    'scanned_at', v_now,
    'merchant', jsonb_build_object(
      'id', v_merchant.id,
      'name', v_merchant.name,
      'category', v_merchant.category,
      'reward_description', v_merchant.reward_description,
      'brand_color', v_merchant.brand_color,
      'stamps_goal', v_merchant.stamps_goal
    ),
    'wallet', jsonb_build_object(
      'id', v_wallet.id,
      'is_new', v_is_new,
      'current_stamps', v_wallet.current_stamps,
      'rewards_redeemed', v_wallet.rewards_redeemed,
      'pass_serial', v_wallet.pass_serial,
      'pass_share_url', v_wallet.pass_share_url,
      'google_save_url', v_wallet.google_save_url
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: batch QR generation (super admin; RLS still applies — SECURITY INVOKER)
-- -----------------------------------------------------------------------------
create or replace function public.generate_qr_batch(
  p_merchant_id uuid,
  p_quantity    integer,
  p_label       text default ''
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_batch_id uuid := gen_random_uuid();
begin
  if not private.is_super_admin() then
    raise exception 'Only a super admin can generate QR batches' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 5000 then
    raise exception 'Quantity must be between 1 and 5000' using errcode = '22023';
  end if;

  if not exists (select 1 from public.merchants m where m.id = p_merchant_id) then
    raise exception 'Unknown merchant' using errcode = '22023';
  end if;

  insert into public.qr_batches (merchant_id, batch_id, batch_label)
  select p_merchant_id, v_batch_id, left(btrim(coalesce(p_label, '')), 80)
  from generate_series(1, p_quantity);

  return v_batch_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: redeem an instant win (SECURITY INVOKER — RLS scopes the tenant,
-- qr_batches_guard restricts merchant admins to redeemed_at).
-- -----------------------------------------------------------------------------
create or replace function public.redeem_win(p_merchant_id uuid, p_code text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_row  public.qr_batches%rowtype;
begin
  if v_code !~ '^[A-HJ-NP-Z2-9]{6}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_row
  from public.qr_batches q
  where q.merchant_id = p_merchant_id and q.redemption_code = v_code
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_row.redeemed_at is not null then
    return jsonb_build_object(
      'status', 'already_redeemed',
      'redemption_code', v_row.redemption_code,
      'scan_date', v_row.scan_date,
      'redeemed_at', v_row.redeemed_at
    );
  end if;

  update public.qr_batches set redeemed_at = now() where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'status', 'redeemed',
    'redemption_code', v_row.redemption_code,
    'scan_date', v_row.scan_date,
    'redeemed_at', v_row.redeemed_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: redeem a completed stamp card (SECURITY DEFINER — wallets are not
-- directly writable by merchant admins; ownership is checked explicitly).
-- -----------------------------------------------------------------------------
create or replace function public.redeem_stamp_card(p_wallet_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_wallet public.digital_wallets%rowtype;
  v_goal   integer;
begin
  select * into v_wallet from public.digital_wallets where id = p_wallet_id for update;

  if not found
     or not (private.is_super_admin() or v_wallet.merchant_id = private.current_merchant_id()) then
    return jsonb_build_object('status', 'not_found');
  end if;

  select m.stamps_goal into v_goal from public.merchants m where m.id = v_wallet.merchant_id;

  if v_wallet.current_stamps < v_goal then
    return jsonb_build_object(
      'status', 'insufficient_stamps',
      'current_stamps', v_wallet.current_stamps,
      'stamps_goal', v_goal
    );
  end if;

  update public.digital_wallets
     set current_stamps = current_stamps - v_goal,
         rewards_redeemed = rewards_redeemed + 1
   where id = v_wallet.id
  returning * into v_wallet;

  return jsonb_build_object(
    'status', 'redeemed',
    'current_stamps', v_wallet.current_stamps,
    'rewards_redeemed', v_wallet.rewards_redeemed,
    'stamps_goal', v_goal
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: merchant retention analytics (SECURITY INVOKER — RLS scopes the data,
-- so a merchant admin asking for another tenant simply gets zeros).
-- -----------------------------------------------------------------------------
create or replace function public.merchant_analytics(p_merchant_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_days  integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today date := (now() at time zone 'Africa/Tunis')::date;
  v_first date := v_today - (v_days - 1);
  v_since timestamptz := (v_first::timestamp at time zone 'Africa/Tunis');
  v_result jsonb;
begin
  with scans as (
    select q.wallet_id, q.scan_date, q.is_winner, q.redeemed_at
    from public.qr_batches q
    where q.merchant_id = p_merchant_id and q.is_scanned
  ),
  customers as (
    select s.wallet_id, min(s.scan_date) as first_at, count(*) as visits
    from scans s
    where s.wallet_id is not null
    group by s.wallet_id
  ),
  period as (
    select
      s.*,
      (s.scan_date at time zone 'Africa/Tunis')::date as day,
      coalesce(c.first_at = s.scan_date, false) as is_first_visit
    from scans s
    left join customers c on c.wallet_id = s.wallet_id
    where s.scan_date >= v_since
  ),
  daily as (
    select
      d::date as day,
      (count(p.*) filter (where p.is_first_visit))::int as new_scans,
      (count(p.*) filter (where not p.is_first_visit))::int as returning_scans,
      (count(p.*) filter (where p.is_winner))::int as wins
    from generate_series(v_first::timestamp, v_today::timestamp, interval '1 day') d
    left join period p on p.day = d::date
    group by d
  ),
  buckets as (
    select * from (values
      (1, '1 visite', 1, 1),
      (2, '2 visites', 2, 2),
      (3, '3–5 visites', 3, 5),
      (4, '6+ visites', 6, 2147483647)
    ) as b(ord, label, lo, hi)
  ),
  frequency as (
    select b.ord, b.label, (count(c.wallet_id))::int as customers
    from buckets b
    left join customers c on c.visits between b.lo and b.hi
    group by b.ord, b.label
  )
  select jsonb_build_object(
    'range', jsonb_build_object('days', v_days, 'from', v_first, 'to', v_today),
    'kpis', jsonb_build_object(
      'total_customers',  (select count(*) from customers),
      'new_customers',    (select count(*) from customers where first_at >= v_since),
      'active_customers', (select count(distinct wallet_id) from period),
      'scans',            (select count(*) from period),
      'returning_rate',   (select case when count(*) = 0 then 0
                                  else round(100.0 * count(*) filter (where visits > 1) / count(*), 1) end
                           from customers),
      'avg_visits',       (select coalesce(round(avg(visits), 2), 0) from customers),
      'wins',             (select count(*) from period where is_winner),
      'wins_redeemed',    (select count(*) from period where is_winner and redeemed_at is not null),
      'cards_completed',  (select coalesce(sum(w.rewards_redeemed), 0)
                           from public.digital_wallets w where w.merchant_id = p_merchant_id),
      'codes_total',      (select count(*) from public.qr_batches q where q.merchant_id = p_merchant_id),
      'codes_scanned',    (select count(*) from scans)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', day, 'new', new_scans, 'returning', returning_scans, 'wins', wins
              ) order by day), '[]'::jsonb) from daily),
    'frequency', (select coalesce(jsonb_agg(jsonb_build_object(
                    'label', label, 'customers', customers
                  ) order by ord), '[]'::jsonb) from frequency)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: platform overview (super admin only)
-- -----------------------------------------------------------------------------
create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_since  timestamptz := now() - interval '30 days';
  v_result jsonb;
begin
  if not private.is_super_admin() then
    raise exception 'Only a super admin can view the platform overview' using errcode = '42501';
  end if;

  with per_merchant as (
    select
      m.id,
      m.name,
      m.category,
      m.subscription_status,
      (select count(*) from public.qr_batches q
        where q.merchant_id = m.id and q.is_scanned and q.scan_date >= v_since)::int as scans_30d,
      (select count(*) from public.qr_batches q
        where q.merchant_id = m.id and q.is_winner and q.scan_date >= v_since)::int as wins_30d,
      (select count(*) from public.digital_wallets w where w.merchant_id = m.id)::int as customers,
      (select count(*) from public.qr_batches q
        where q.merchant_id = m.id and not q.is_scanned)::int as codes_available
    from public.merchants m
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'merchants',       (select count(*) from per_merchant),
      'active_merchants',(select count(*) from per_merchant where subscription_status in ('trial', 'active')),
      'customers',       (select coalesce(sum(customers), 0) from per_merchant),
      'scans_30d',       (select coalesce(sum(scans_30d), 0) from per_merchant),
      'wins_30d',        (select coalesce(sum(wins_30d), 0) from per_merchant),
      'codes_available', (select coalesce(sum(codes_available), 0) from per_merchant)
    ),
    'by_status', (select coalesce(jsonb_object_agg(subscription_status::text, n), '{}'::jsonb)
                  from (select subscription_status, count(*) as n from per_merchant group by 1) s),
    'merchants', (select coalesce(jsonb_agg(to_jsonb(pm) order by pm.scans_30d desc, pm.name), '[]'::jsonb)
                  from per_merchant pm)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges: nothing is callable unless granted here.
-- -----------------------------------------------------------------------------
revoke all on function public.get_qr_public(uuid) from public;
revoke all on function public.claim_qr_scan(uuid, text) from public;
revoke all on function public.generate_qr_batch(uuid, integer, text) from public;
revoke all on function public.redeem_win(uuid, text) from public;
revoke all on function public.redeem_stamp_card(uuid) from public;
revoke all on function public.merchant_analytics(uuid, integer) from public;
revoke all on function public.platform_overview() from public;

revoke all on function public.get_qr_public(uuid) from anon, authenticated;
revoke all on function public.claim_qr_scan(uuid, text) from anon, authenticated;
revoke all on function public.generate_qr_batch(uuid, integer, text) from anon, authenticated;
revoke all on function public.redeem_win(uuid, text) from anon, authenticated;
revoke all on function public.redeem_stamp_card(uuid) from anon, authenticated;
revoke all on function public.merchant_analytics(uuid, integer) from anon, authenticated;
revoke all on function public.platform_overview() from anon, authenticated;

grant execute on function public.get_qr_public(uuid) to anon, authenticated, service_role;
grant execute on function public.claim_qr_scan(uuid, text) to anon, authenticated, service_role;
grant execute on function public.generate_qr_batch(uuid, integer, text) to authenticated;
grant execute on function public.redeem_win(uuid, text) to authenticated;
grant execute on function public.redeem_stamp_card(uuid) to authenticated;
grant execute on function public.merchant_analytics(uuid, integer) to authenticated;
grant execute on function public.platform_overview() to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: live scan feed on the merchant dashboard (RLS applies per subscriber)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.qr_batches;
  end if;
end;
$$;
