-- =============================================================================
-- HyperFid — development seed (runs after migrations on `supabase db reset`)
-- Idempotent: safe to run more than once.
-- Admin users are created by `npm run bootstrap:users` (Auth admin API),
-- never by inserting into auth.users directly.
-- =============================================================================

-- Test client: Mandy Coffee Shop (fixed id so scripts and docs can reference it)
insert into public.merchants (
  id, name, category, win_rate, reward_description, subscription_status, stamps_goal, brand_color
) values (
  '6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70',
  'Mandy Coffee Shop',
  'Cafe',
  10.00,
  '1 Café Express gratuit',
  'active',
  10,
  '#6F4E37'
)
on conflict (id) do nothing;

-- Demo print run: 25 single-use QR codes for Mandy's cups.
-- Codes are random UUIDs on purpose: predictable codes could be claimed by anyone.
insert into public.qr_batches (merchant_id, batch_id, batch_label)
select
  '6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70',
  'b7e4f0a1-3c2d-4e5f-8a9b-0c1d2e3f4a5b',
  'Gobelets – Lot démo'
from generate_series(1, 25)
where not exists (
  select 1 from public.qr_batches where batch_id = 'b7e4f0a1-3c2d-4e5f-8a9b-0c1d2e3f4a5b'
);

-- Grab a code to test the scan flow locally:
--   select 'http://localhost:3000/s/' || id from public.qr_batches
--   where batch_id = 'b7e4f0a1-3c2d-4e5f-8a9b-0c1d2e3f4a5b' and not is_scanned limit 1;
