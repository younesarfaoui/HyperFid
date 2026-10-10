-- =============================================================================
-- HyperFid — "Ma carte": a customer checks his stamp balance without scanning
-- another code.
--
-- get_my_cards(device_hash) returns the loyalty cards held by one device
-- (the HMAC of its httpOnly cookie, the same value claim_qr_scan stores).
-- The hash is a 256-bit secret only the customer's browser can produce, so
-- knowing it is the authorization. Nothing but card progress is returned: no
-- wallet or merchant ids, no device data. Cards of paused merchants stay
-- visible; the customer keeps what he earned.
-- =============================================================================

create or replace function public.get_my_cards(p_device_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(card order by last_visit desc nulls last)
    from (
      select
        w.last_scan_date as last_visit,
        jsonb_build_object(
          'merchant_name',      m.name,
          'category',           m.category,
          'brand_color',        m.brand_color,
          'reward_description', m.reward_description,
          'stamps_goal',        m.stamps_goal,
          'current_stamps',     w.current_stamps,
          'rewards_redeemed',   w.rewards_redeemed,
          'last_scan_date',     w.last_scan_date,
          'pass_share_url',     w.pass_share_url,
          'google_save_url',    w.google_save_url
        ) as card
      from public.digital_wallets w
      join public.merchants m on m.id = w.merchant_id
      where w.device_fingerprint = p_device_hash
      order by w.last_scan_date desc nulls last
      limit 20
    ) cards
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_cards(text) from public, anon, authenticated;
grant execute on function public.get_my_cards(text) to anon, authenticated, service_role;
