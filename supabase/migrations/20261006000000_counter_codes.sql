-- =============================================================================
-- HyperFid — "Mode caisse": single-use QR codes shown on the merchant's screen
-- instead of printed batches.
--
-- * qr_batches.expires_at: NULL for printed codes (never expire). Counter codes
--   get a short validity, so a photo of the screen is useless minutes later.
-- * issue_counter_code(): the merchant's own screen asks for the next code.
-- * claim_qr_scan / get_qr_public: an expired code answers 'expired' and is
--   NOT burned (exactly like an inactive merchant).
-- * Counter codes are not printed inventory: stock figures and batch
--   summaries only count printed codes. Their scans count like any other.
-- =============================================================================

alter table public.qr_batches add column expires_at timestamptz;

create index qr_batches_counter_live_idx
  on public.qr_batches (merchant_id, expires_at)
  where expires_at is not null and not is_scanned;

-- Counter codes are immutable for merchants (they could otherwise extend them).
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
       or new.expires_at is distinct from old.expires_at
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
       or new.batch_label is distinct from old.batch_label
       or new.expires_at is distinct from old.expires_at then
      raise exception 'Merchant admins can only mark rewards as redeemed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

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
      when v_qr.expires_at is not null and v_qr.expires_at <= now() then 'expired'
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

  -- Counter ("Mode caisse") code past its validity: refuse without burning it.
  if v_qr.expires_at is not null and v_qr.expires_at <= v_now then
    return jsonb_build_object(
      'status', 'expired',
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
      -- Printed stock only: counter codes (expires_at set) are not inventory.
      'codes_total',      (select count(*) from public.qr_batches q
                           where q.merchant_id = p_merchant_id and q.expires_at is null),
      'codes_scanned',    (select count(*) from public.qr_batches q
                           where q.merchant_id = p_merchant_id and q.expires_at is null and q.is_scanned),
      'counter_scans',    (select count(*) from public.qr_batches q
                           where q.merchant_id = p_merchant_id and q.expires_at is not null and q.is_scanned)
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
        where q.merchant_id = m.id and not q.is_scanned and q.expires_at is null)::int as codes_available
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

create or replace view public.qr_batch_summaries
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
where q.expires_at is null
group by q.batch_id, q.merchant_id;

-- -----------------------------------------------------------------------------
-- RPC: next counter code for the merchant's screen. SECURITY DEFINER because
-- merchants cannot insert QR codes directly; the caller check below is the
-- authorization. Returns {status: ok, id, expires_at} | {status: merchant_inactive}
-- | {status: too_many}.
-- -----------------------------------------------------------------------------
create or replace function public.issue_counter_code(p_merchant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- Screens rotate their code every 2 minutes; the extra margin lets a
  -- customer who scanned just before a rotation still scratch.
  c_validity constant interval := interval '5 minutes';
  c_max_live constant integer := 30;
  v_status  public.subscription_status;
  v_id      uuid;
  v_expires timestamptz := now() + c_validity;
begin
  if p_merchant_id is null
     or not (private.is_super_admin() or private.current_merchant_id() = p_merchant_id) then
    raise exception 'Not allowed to issue codes for this merchant' using errcode = '42501';
  end if;

  select m.subscription_status into v_status from public.merchants m where m.id = p_merchant_id;
  if not found then
    raise exception 'Unknown merchant' using errcode = '22023';
  end if;
  if v_status not in ('trial', 'active') then
    return jsonb_build_object('status', 'merchant_inactive');
  end if;

  -- Housekeeping: unscanned counter codes are worthless once expired.
  delete from public.qr_batches q
  where q.merchant_id = p_merchant_id
    and q.expires_at < now() - interval '1 day'
    and not q.is_scanned;

  if (select count(*) from public.qr_batches q
      where q.merchant_id = p_merchant_id and q.expires_at > now() and not q.is_scanned) >= c_max_live then
    return jsonb_build_object('status', 'too_many');
  end if;

  -- All counter codes of a merchant share one batch_id (the merchant id).
  insert into public.qr_batches (merchant_id, batch_id, batch_label, expires_at)
  values (p_merchant_id, p_merchant_id, 'Caisse', v_expires)
  returning id into v_id;

  return jsonb_build_object('status', 'ok', 'id', v_id, 'expires_at', v_expires);
end;
$$;

revoke all on function public.issue_counter_code(uuid) from public, anon;
grant execute on function public.issue_counter_code(uuid) to authenticated;
