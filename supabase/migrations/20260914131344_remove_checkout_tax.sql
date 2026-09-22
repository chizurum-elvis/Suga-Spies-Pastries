-- The owner has explicitly chosen a no-tax checkout. Keep the paid amount equal
-- to the authoritative pastry subtotal plus the confirmed delivery fee.
-- Payment history is immutable, so fail closed instead of rewriting any
-- existing provider-bound amount during this pre-launch migration.
do $$
begin
  if exists (select 1 from public.payment_attempts)
    or exists (select 1 from public.orders) then
    raise exception 'Tax removal requires an empty pre-launch payment ledger.';
  end if;
end;
$$;

alter table public.products drop column tax_category;

alter table public.payment_attempts
  add constraint payment_attempt_snapshot_version_check
    check (((snapshot->>'version')::integer = 2) is true),
  add constraint payment_attempt_snapshot_no_tax_check
    check (not (snapshot ? 'tax')),
  add constraint payment_attempt_snapshot_total_breakdown_check
    check ((
      (snapshot->>'totalCents')::integer =
      (snapshot->>'subtotalCents')::integer +
      (snapshot->>'deliveryCents')::integer
    ) is true);

alter table public.orders
  add constraint orders_snapshot_version_check
    check (((snapshot->>'version')::integer = 2) is true),
  add constraint orders_snapshot_no_tax_check
    check (not (snapshot ? 'tax')),
  add constraint orders_snapshot_total_breakdown_check
    check ((
      (snapshot->>'totalCents')::integer =
      (snapshot->>'subtotalCents')::integer +
      (snapshot->>'deliveryCents')::integer
    ) is true);

create or replace function public.begin_wallet_payment(
  p_draft_id uuid,
  p_draft_version integer,
  p_details_version integer,
  p_review_token text,
  p_snapshot jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d public.checkout_drafts%rowtype;
  v public.checkout_delivery_details%rowtype;
  settings public.delivery_settings%rowtype;
  existing public.payment_attempts%rowtype;
  reservation record;
  attempt_id uuid := gen_random_uuid();
begin
  select * into d
  from public.checkout_drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception 'payment_draft_expired';
  end if;

  select * into existing
  from public.payment_attempts
  where checkout_draft_id = d.id
    and status in ('creating','open','processing','paid','needs_review','refund_pending')
  order by created_at desc
  limit 1;

  if found then
    if existing.review_token <> p_review_token then
      raise exception 'payment_in_progress';
    end if;
    return existing.id;
  end if;

  if d.status <> 'ready_for_details'
    or d.expires_at <= now()
    or d.version <> p_draft_version then
    raise exception 'payment_review_stale';
  end if;

  if not exists (
    select 1
    from public.payment_worker_health
    where mode = case
      when (p_snapshot->>'testOnly')::boolean then 'test'
      else 'live'
    end
      and checked_at > now() - interval '3 minutes'
  ) then
    raise exception 'payment_worker_unavailable';
  end if;

  select * into v
  from public.checkout_delivery_details
  where checkout_draft_id = d.id
  for update;

  select * into strict settings
  from public.delivery_settings
  where singleton
  for share;

  if v.checkout_draft_id is null
    or v.status <> 'confirmed'
    or v.version <> p_details_version
    or v.quote is null
    or (v.quote->>'expiresAt')::timestamptz <= now()
    or (v.quote->>'settingsVersion')::integer <> settings.version
    or v.quote->>'pricingFingerprint' <> d.pricing_fingerprint
    or v.quote->>'cartFingerprint' <> d.cart_fingerprint then
    raise exception 'payment_review_stale';
  end if;

  if jsonb_typeof(p_snapshot->'cart'->'lines') is distinct from 'array'
    or jsonb_array_length(p_snapshot->'cart'->'lines') not between 1 and 50
    or (p_snapshot->>'version')::integer is distinct from 2
    or p_snapshot ? 'tax'
    or p_snapshot->'validatedCart'->>'status' is distinct from 'ready'
    or p_snapshot->'cart' is distinct from d.cart_payload
    or (p_snapshot->>'fulfillmentAt')::timestamptz <> d.fulfillment_at
    or (p_snapshot->>'deliveryCents')::integer <> (v.quote->>'feeCents')::integer
    or (p_snapshot->>'subtotalCents')::integer <> (v.quote->>'subtotalCents')::integer
    or p_snapshot->'delivery' is distinct from jsonb_set(v.input, '{address}', v.quote->'address')
    or p_snapshot->>'currency' <> 'CAD'
    or (p_snapshot->>'totalCents')::integer < 50
    or (p_snapshot->>'totalCents')::integer > 99999999
    or (p_snapshot->>'totalCents')::integer <>
      (p_snapshot->>'subtotalCents')::integer +
      (p_snapshot->>'deliveryCents')::integer then
    raise exception 'payment_snapshot_invalid';
  end if;

  -- Bound repeat attempts per draft without storing IPs or customer fingerprints.
  if (
    select count(*)
    from public.payment_attempts
    where checkout_draft_id = d.id
      and created_at > now() - interval '1 hour'
  ) >= 8 then
    raise exception 'payment_rate_limited';
  end if;

  select * into strict reservation
  from public.reserve_fulfillment_capacity(d.id, attempt_id);

  update public.capacity_holds
  set payment_pending = true
  where id = reservation.hold_id;

  insert into public.payment_attempts (
    id,
    checkout_draft_id,
    hold_id,
    access_token_hash,
    review_token,
    snapshot,
    total_cents,
    test_only,
    expires_at
  )
  values (
    attempt_id,
    d.id,
    reservation.hold_id,
    d.access_token_hash,
    p_review_token,
    p_snapshot,
    (p_snapshot->>'totalCents')::integer,
    (p_snapshot->>'testOnly')::boolean,
    reservation.expires_at
  );

  return attempt_id;
end;
$$;

comment on function public.begin_wallet_payment(uuid, integer, integer, text, jsonb)
  is 'Starts an idempotent wallet payment reservation after validating a no-tax subtotal-plus-delivery snapshot.';
