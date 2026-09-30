-- =============================================================================
-- HyperFid — security & business-rule tests
-- Run as a superuser against a migrated database (everything is rolled back):
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- Each block raises 'TEST FAILED: …' on violation.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
insert into public.merchants (id, name, category, win_rate, reward_description, subscription_status)
values
  ('a0000000-0000-4000-8000-00000000000a', 'Mandy Test Cafe', 'Cafe', 10, '1 Café Express gratuit', 'active'),
  ('b0000000-0000-4000-8000-00000000000b', 'Rival Pizza', 'Pizzeria', 10, '1 Pizza offerte', 'active'),
  ('c0000000-0000-4000-8000-00000000000c', 'Suspended Snack', 'Snack', 10, '1 Sandwich', 'suspended'),
  ('d0000000-0000-4000-8000-00000000000d', 'Odds Lab', 'Lab', 10, 'Stat test', 'active');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000001', 'root@test.tn',  '{"role":"super_admin"}', '{}'),
  ('00000000-0000-4000-a000-000000000002', 'mandy@test.tn', '{"role":"merchant_admin","merchant_id":"a0000000-0000-4000-8000-00000000000a"}', '{}'),
  ('00000000-0000-4000-a000-000000000003', 'rival@test.tn', '{"role":"merchant_admin","merchant_id":"b0000000-0000-4000-8000-00000000000b"}', '{}'),
  ('00000000-0000-4000-a000-000000000004', 'orphan@test.tn', '{}', '{}'),
  ('00000000-0000-4000-a000-000000000005', 'sneaky@test.tn', '{}', '{"role":"super_admin"}');

insert into public.qr_batches (id, merchant_id, batch_id, batch_label) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'aa000000-0000-4000-8000-0000000000aa', 'Mandy lot'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'aa000000-0000-4000-8000-0000000000aa', 'Mandy lot'),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'aa000000-0000-4000-8000-0000000000aa', 'Mandy lot'),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000a', 'aa000000-0000-4000-8000-0000000000aa', 'Mandy lot'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'bb000000-0000-4000-8000-0000000000bb', 'Rival lot'),
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000c', 'cc000000-0000-4000-8000-0000000000cc', 'Suspended lot');

-- T01: profiles come from app_metadata only
do $$
begin
  assert (select role from public.profiles where id = '00000000-0000-4000-a000-000000000001') = 'super_admin',
    'TEST FAILED T01: super admin role not set from app_metadata';
  assert (select merchant_id from public.profiles where id = '00000000-0000-4000-a000-000000000002') = 'a0000000-0000-4000-8000-00000000000a',
    'TEST FAILED T01: merchant_id not set from app_metadata';
  assert (select role from public.profiles where id = '00000000-0000-4000-a000-000000000005') = 'merchant_admin',
    'TEST FAILED T01: user_metadata role escalation was trusted';
  assert (select merchant_id from public.profiles where id = '00000000-0000-4000-a000-000000000004') is null,
    'TEST FAILED T01: orphan should have no merchant';
end $$;

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- T02/T03: no direct table access at all
do $$
declare t text;
begin
  foreach t in array array['merchants', 'profiles', 'qr_batches', 'digital_wallets', 'qr_batch_summaries'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'TEST FAILED T02: anon can read %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    update public.qr_batches set is_scanned = true, scan_date = now()
    where id = 'a1000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED T03: anon updated qr_batches directly';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.generate_qr_batch('a0000000-0000-4000-8000-00000000000a', 10, 'x');
    raise exception 'TEST FAILED T03: anon can execute generate_qr_batch';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T04: public lookup exposes the merchant, never the win flag
do $$
declare r jsonb := public.get_qr_public('a1000000-0000-4000-8000-000000000001');
begin
  assert r->>'status' = 'available', 'TEST FAILED T04: expected available, got ' || r::text;
  assert r->'merchant'->>'name' = 'Mandy Test Cafe', 'TEST FAILED T04: merchant name';
  assert not (r ? 'is_winner') and not (r::text like '%is_winner%'), 'TEST FAILED T04: leaks is_winner';
  assert public.get_qr_public('ffffffff-0000-4000-8000-000000000000')->>'status' = 'invalid',
    'TEST FAILED T04: unknown code should be invalid';
end $$;

-- T05/T06/T07: exactly-once claim + wallet stamps
do $$
declare
  dev  text := repeat('a', 64);
  r1   jsonb;
  r2   jsonb;
  r3   jsonb;
begin
  assert public.claim_qr_scan('a1000000-0000-4000-8000-000000000001', 'not-a-hash')->>'status' = 'invalid',
    'TEST FAILED T06: malformed device hash accepted';
  assert public.claim_qr_scan('ffffffff-0000-4000-8000-000000000000', dev)->>'status' = 'invalid',
    'TEST FAILED T06: unknown code accepted';

  r1 := public.claim_qr_scan('a1000000-0000-4000-8000-000000000001', dev);
  assert r1->>'status' = 'ok', 'TEST FAILED T05: first claim not ok: ' || r1::text;
  assert (r1->'wallet'->>'current_stamps')::int = 1, 'TEST FAILED T05: first stamp';
  assert (r1->'wallet'->>'is_new')::boolean, 'TEST FAILED T05: wallet should be new';

  r2 := public.claim_qr_scan('a1000000-0000-4000-8000-000000000001', dev);
  assert r2->>'status' = 'already_scanned', 'TEST FAILED T05: second claim allowed: ' || r2::text;

  r3 := public.claim_qr_scan('a1000000-0000-4000-8000-000000000002', dev);
  assert r3->>'status' = 'ok', 'TEST FAILED T05: second code failed';
  assert (r3->'wallet'->>'id') = (r1->'wallet'->>'id'), 'TEST FAILED T05: same device must reuse wallet';
  assert (r3->'wallet'->>'current_stamps')::int = 2, 'TEST FAILED T05: stamps should be 2';
  assert not (r3->'wallet'->>'is_new')::boolean, 'TEST FAILED T05: wallet should not be new';

  assert public.claim_qr_scan('c1000000-0000-4000-8000-000000000001', dev)->>'status' = 'merchant_inactive',
    'TEST FAILED T07: suspended merchant accepted a scan';
  assert public.get_qr_public('c1000000-0000-4000-8000-000000000001')->>'status' = 'merchant_inactive',
    'TEST FAILED T07: inactive code was burned';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Merchant admin (Mandy)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';

-- T08: tenant isolation on reads
do $$
begin
  assert (select count(*) from public.merchants) = 1, 'TEST FAILED T08: merchant sees other merchants';
  assert (select count(*) from public.qr_batches where merchant_id <> 'a0000000-0000-4000-8000-00000000000a') = 0,
    'TEST FAILED T08: merchant sees foreign QR codes';
  assert (select count(*) from public.qr_batches) = 4, 'TEST FAILED T08: merchant should see its 4 codes';
  assert (select count(*) from public.digital_wallets) = 1, 'TEST FAILED T08: merchant wallets';
  assert (select count(*) from public.profiles) = 1, 'TEST FAILED T08: merchant sees other profiles';
  assert (select count(*) from public.qr_batch_summaries) = 1, 'TEST FAILED T08: batch summaries not scoped';
end $$;

-- T09/T10: write restrictions
do $$
declare n int;
begin
  update public.merchants set reward_description = '1 Cappuccino offert'
  where id = 'a0000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'TEST FAILED T09: merchant cannot edit its reward';

  begin
    update public.merchants set win_rate = 90 where id = 'a0000000-0000-4000-8000-00000000000a';
    raise exception 'TEST FAILED T09: merchant changed win_rate';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.merchants set subscription_status = 'active' where id = 'a0000000-0000-4000-8000-00000000000a';
    -- same value -> no change -> allowed; now try a real change
    update public.merchants set subscription_status = 'trial' where id = 'a0000000-0000-4000-8000-00000000000a';
    raise exception 'TEST FAILED T09: merchant changed subscription_status';
  exception when insufficient_privilege then null;
  end;

  update public.merchants set reward_description = 'hacked' where id = 'b0000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'TEST FAILED T09: merchant edited a foreign merchant';

  update public.profiles set role = 'super_admin', merchant_id = null
  where id = '00000000-0000-4000-a000-000000000002';
  get diagnostics n = row_count;
  assert n = 0, 'TEST FAILED T10: merchant escalated its own profile';

  begin
    insert into public.merchants (name, category, reward_description) values ('Evil', 'Cafe', 'Free');
    raise exception 'TEST FAILED T10: merchant created a merchant';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.generate_qr_batch('a0000000-0000-4000-8000-00000000000a', 10, 'free codes');
    raise exception 'TEST FAILED T11: merchant generated a batch';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.qr_batches set is_scanned = true, scan_date = now()
    where id = 'a1000000-0000-4000-8000-000000000003';
    raise exception 'TEST FAILED T12: merchant scanned a code directly';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.qr_batches set is_scanned = false, scan_date = null, wallet_id = null
    where id = 'a1000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED T12: merchant un-scanned a code';
  exception when insufficient_privilege then null;
  end;

  update public.digital_wallets set current_stamps = 99;
  get diagnostics n = row_count;
  assert n = 0, 'TEST FAILED T14: merchant wrote wallet stamps directly';

  begin
    perform public.platform_overview();
    raise exception 'TEST FAILED T17: merchant read platform overview';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T16: analytics are tenant-scoped
do $$
declare own jsonb; other jsonb;
begin
  own := public.merchant_analytics('a0000000-0000-4000-8000-00000000000a', 30);
  assert (own->'kpis'->>'scans')::int = 2, 'TEST FAILED T16: own scans ' || (own->'kpis')::text;
  assert (own->'kpis'->>'total_customers')::int = 1, 'TEST FAILED T16: own customers';
  assert (own->'kpis'->>'returning_rate')::numeric = 100, 'TEST FAILED T16: returning rate';
  assert jsonb_array_length(own->'daily') = 30, 'TEST FAILED T16: daily series length';
  assert jsonb_array_length(own->'frequency') = 4, 'TEST FAILED T16: frequency buckets';

  other := public.merchant_analytics('b0000000-0000-4000-8000-00000000000b', 30);
  assert (other->'kpis'->>'codes_total')::int = 0, 'TEST FAILED T16: analytics leak foreign data';
end $$;

-- T22: dashboard headline KPIs (the page's exact count queries) see the merchant's own data
do $$
begin
  assert (select count(*) from public.qr_batches
          where merchant_id = 'a0000000-0000-4000-8000-00000000000a' and is_scanned) = 2,
    'TEST FAILED T22: own total scans';
  assert (select count(*) from public.digital_wallets
          where merchant_id = 'a0000000-0000-4000-8000-00000000000a' and last_scan_date >= now() - interval '30 days') = 1,
    'TEST FAILED T22: own active wallets';
  assert (select count(*) from public.qr_batches
          where merchant_id = 'a0000000-0000-4000-8000-00000000000a' and is_winner) = 0,
    'TEST FAILED T22: own total winners';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Winner + redemption flow
-- ---------------------------------------------------------------------------
update public.merchants set win_rate = 100 where id = 'a0000000-0000-4000-8000-00000000000a';

create temporary table _win (r jsonb);
grant all on _win to anon, authenticated;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into _win select public.claim_qr_scan('a1000000-0000-4000-8000-000000000003', repeat('b', 64));
reset role;

do $$
declare r jsonb := (select r from _win);
begin
  assert (r->>'is_winner')::boolean, 'TEST FAILED T13: 100% win rate did not win';
  assert r->>'redemption_code' ~ '^[A-HJ-NP-Z2-9]{6}$', 'TEST FAILED T13: bad redemption code ' || r::text;
end $$;

-- Rival admin cannot redeem Mandy's win
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';
do $$
declare code text := (select r->>'redemption_code' from _win);
begin
  assert public.redeem_win('a0000000-0000-4000-8000-00000000000a', code)->>'status' = 'not_found',
    'TEST FAILED T13: rival redeemed a foreign win';
  assert public.redeem_stamp_card((select (r->'wallet'->>'id')::uuid from _win))->>'status' = 'not_found',
    'TEST FAILED T15: rival redeemed a foreign stamp card';

  -- T22: a rival's dashboard counts can never include Mandy's scans, wallets or winners,
  -- even when the query targets Mandy's merchant_id explicitly.
  assert (select count(*) from public.qr_batches
          where merchant_id = 'a0000000-0000-4000-8000-00000000000a' and is_scanned) = 0,
    'TEST FAILED T22: rival counts foreign scans';
  assert (select count(*) from public.digital_wallets
          where merchant_id = 'a0000000-0000-4000-8000-00000000000a') = 0,
    'TEST FAILED T22: rival counts foreign wallets';
  assert (select count(*) from public.qr_batches
          where merchant_id = 'a0000000-0000-4000-8000-00000000000a' and is_winner) = 0,
    'TEST FAILED T22: rival counts foreign winners';
end $$;
reset role;

-- Mandy redeems once
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
do $$
declare code text := (select r->>'redemption_code' from _win);
begin
  assert public.redeem_win('a0000000-0000-4000-8000-00000000000a', lower(code))->>'status' = 'redeemed',
    'TEST FAILED T13: merchant could not redeem its win';
  assert public.redeem_win('a0000000-0000-4000-8000-00000000000a', code)->>'status' = 'already_redeemed',
    'TEST FAILED T13: win redeemed twice';
  assert public.redeem_stamp_card((select (r->'wallet'->>'id')::uuid from _win))->>'status' = 'insufficient_stamps',
    'TEST FAILED T15: stamp card redeemed before goal';
end $$;
reset role;

update public.digital_wallets set current_stamps = 12
where id = (select (r->'wallet'->>'id')::uuid from _win);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
do $$
declare r jsonb := public.redeem_stamp_card((select (r->'wallet'->>'id')::uuid from _win));
begin
  assert r->>'status' = 'redeemed', 'TEST FAILED T15: stamp card not redeemed ' || r::text;
  assert (r->>'current_stamps')::int = 2, 'TEST FAILED T15: stamps not decremented by goal';
  assert (r->>'rewards_redeemed')::int = 1, 'TEST FAILED T15: rewards counter';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Orphan merchant admin (no merchant attached) sees nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
do $$
begin
  assert (select count(*) from public.merchants) = 0, 'TEST FAILED T19: orphan sees merchants';
  assert (select count(*) from public.qr_batches) = 0, 'TEST FAILED T19: orphan sees QR codes';
  assert (select count(*) from public.digital_wallets) = 0, 'TEST FAILED T19: orphan sees wallets';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Super admin
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
do $$
declare
  v_batch uuid;
  v_over  jsonb;
begin
  assert (select count(*) from public.merchants) >= 4, 'TEST FAILED T18: super admin cannot see all merchants';

  update public.merchants set win_rate = 12.5, subscription_status = 'past_due'
  where id = 'b0000000-0000-4000-8000-00000000000b';

  v_batch := public.generate_qr_batch('b0000000-0000-4000-8000-00000000000b', 50, 'Boîtes pizza');
  assert (select count(*) from public.qr_batches where batch_id = v_batch) = 50, 'TEST FAILED T11: batch size';

  begin
    perform public.generate_qr_batch('b0000000-0000-4000-8000-00000000000b', 5001, 'too many');
    raise exception 'TEST FAILED T11: oversize batch accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    update public.qr_batches set is_scanned = false, scan_date = null
    where id = 'a1000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED T12: super admin un-scanned a code';
  exception when insufficient_privilege then null;
  end;

  v_over := public.platform_overview();
  assert (v_over->'totals'->>'merchants')::int >= 4, 'TEST FAILED T17: overview totals';

  update public.profiles set merchant_id = 'a0000000-0000-4000-8000-00000000000a'
  where id = '00000000-0000-4000-a000-000000000004';
  assert (select merchant_id from public.profiles where id = '00000000-0000-4000-a000-000000000004')
    = 'a0000000-0000-4000-8000-00000000000a', 'TEST FAILED T18: super admin cannot assign merchant';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- T21: the win roll honours win_rate (10% over 2000 scans, ±~4.5σ)
-- ---------------------------------------------------------------------------
insert into public.qr_batches (merchant_id, batch_id)
select 'd0000000-0000-4000-8000-00000000000d', 'dd000000-0000-4000-8000-0000000000dd'
from generate_series(1, 2000);

do $$
declare wins int;
begin
  perform public.claim_qr_scan(q.id, encode(extensions.digest(q.id::text, 'sha256'), 'hex'))
  from public.qr_batches q where q.batch_id = 'dd000000-0000-4000-8000-0000000000dd';

  select count(*) into wins from public.qr_batches
  where batch_id = 'dd000000-0000-4000-8000-0000000000dd' and is_winner;

  assert wins between 140 and 260, 'TEST FAILED T21: 10% win rate produced ' || wins || ' wins / 2000';
  raise notice 'T21: % wins / 2000 scans (expected ~200)', wins;
end $$;

-- ---------------------------------------------------------------------------
-- T20: deleting a merchant cascades cleanly (no guard conflict)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.merchants where id = 'a0000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'TEST FAILED T20: super admin could not delete a merchant';
end $$;
reset role;

do $$
begin
  assert (select count(*) from public.qr_batches where merchant_id = 'a0000000-0000-4000-8000-00000000000a') = 0,
    'TEST FAILED T20: QR codes not cascaded';
  raise notice 'ALL TESTS PASSED';
end $$;

rollback;
