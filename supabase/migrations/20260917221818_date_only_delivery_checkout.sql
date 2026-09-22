-- Delivery is now selected by calendar date only. This is a pre-launch data
-- contract change: provider-bound payment snapshots must not be rewritten.
do $$
begin
  if exists (select 1 from public.payment_attempts)
    or exists (select 1 from public.orders) then
    raise exception 'Date-only checkout requires an empty pre-launch payment ledger.';
  end if;
end;
$$;

create or replace function private.fulfillment_date_issue(
  requested_method text,
  requested_date date,
  evaluated_at timestamp with time zone default now()
)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  settings public.fulfillment_settings%rowtype;
  toronto_today date;
begin
  select * into strict settings
  from public.fulfillment_settings
  where singleton;

  if requested_method is distinct from 'delivery' then
    return 'invalid_method';
  end if;

  toronto_today = (evaluated_at at time zone settings.business_timezone)::date;

  if requested_date < toronto_today + settings.minimum_notice_days then
    return 'insufficient_notice';
  end if;

  if requested_date > (
    toronto_today + make_interval(months => settings.booking_horizon_months)
  )::date then
    return 'beyond_horizon';
  end if;

  if extract(month from requested_date) = 12
    and extract(day from requested_date) = 25 then
    return 'closed_holiday';
  end if;

  if not exists (
    select 1
    from public.fulfillment_hours
    where fulfillment_method = requested_method
      and iso_weekday = extract(isodow from requested_date)::smallint
      and is_enabled
  ) then
    return 'closed_weekday';
  end if;

  if exists (
    select 1
    from public.fulfillment_blackouts
    where fulfillment_date = requested_date
      and scope = 'delivery'
  ) then
    return 'blackout';
  end if;

  return null;
end;
$$;

create or replace function public.reserve_fulfillment_capacity(
  p_checkout_draft_id uuid,
  p_idempotency_key uuid,
  p_evaluated_at timestamp with time zone default now()
)
returns table (
  hold_id uuid,
  expires_at timestamp with time zone,
  fulfillment_date date
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.checkout_drafts%rowtype;
  existing_hold public.capacity_holds%rowtype;
  settings public.fulfillment_settings%rowtype;
  active_adjustments integer;
  active_holds integer;
  date_issue text;
begin
  select * into strict settings
  from public.fulfillment_settings
  where singleton;

  select * into draft
  from public.checkout_drafts
  where id = p_checkout_draft_id
  for update;

  if not found or draft.status = 'expired' or draft.expires_at <= p_evaluated_at then
    raise exception using
      errcode = 'P0001',
      message = 'The checkout draft has expired.';
  end if;

  date_issue = private.fulfillment_date_issue(
    draft.fulfillment_method,
    draft.fulfillment_date,
    p_evaluated_at
  );
  if date_issue is not null then
    raise exception using
      errcode = 'P0001',
      message = 'The selected delivery date is no longer available.',
      detail = date_issue;
  end if;

  insert into public.capacity_days (fulfillment_date)
  values (draft.fulfillment_date)
  on conflict on constraint capacity_days_pkey do nothing;

  perform 1
  from public.capacity_days
  where capacity_days.fulfillment_date = draft.fulfillment_date
  for update;

  select * into existing_hold
  from public.capacity_holds
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_hold.checkout_draft_id <> draft.id then
      raise exception using
        errcode = 'P0001',
        message = 'The idempotency key is already used by another checkout.';
    end if;
    if existing_hold.status = 'active'
      and (existing_hold.expires_at > p_evaluated_at or existing_hold.payment_pending) then
      return query
      select existing_hold.id, existing_hold.expires_at, existing_hold.fulfillment_date;
      return;
    end if;
  end if;

  update public.capacity_holds as hold
  set status = 'expired', updated_at = p_evaluated_at
  where hold.checkout_draft_id = draft.id
    and hold.status = 'active'
    and not hold.payment_pending
    and hold.expires_at <= p_evaluated_at;

  select * into existing_hold
  from public.capacity_holds as hold
  where hold.checkout_draft_id = draft.id
    and hold.status = 'active'
    and (hold.expires_at > p_evaluated_at or hold.payment_pending)
  for update;

  if found then
    return query
    select existing_hold.id, existing_hold.expires_at, existing_hold.fulfillment_date;
    return;
  end if;

  update public.capacity_holds as hold
  set status = 'expired', updated_at = p_evaluated_at
  where hold.fulfillment_date = draft.fulfillment_date
    and hold.status = 'active'
    and not hold.payment_pending
    and hold.expires_at <= p_evaluated_at;

  select count(*) into active_adjustments
  from public.capacity_adjustments
  where capacity_adjustments.fulfillment_date = draft.fulfillment_date
    and status = 'active';

  select count(*) into active_holds
  from public.capacity_holds as hold
  where hold.fulfillment_date = draft.fulfillment_date
    and hold.status = 'active'
    and (hold.expires_at > p_evaluated_at or hold.payment_pending);

  if active_adjustments + active_holds >= settings.daily_capacity then
    raise exception using
      errcode = 'P0001',
      message = 'The fulfillment date has reached its four-order capacity.';
  end if;

  insert into public.capacity_holds (
    checkout_draft_id,
    fulfillment_date,
    idempotency_key,
    expires_at
  )
  values (
    draft.id,
    draft.fulfillment_date,
    p_idempotency_key,
    p_evaluated_at + make_interval(mins => settings.hold_minutes)
  )
  returning id, capacity_holds.expires_at, capacity_holds.fulfillment_date
  into hold_id, expires_at, fulfillment_date;

  return next;
end;
$$;

create or replace function public.mutate_delivery_details(
  p_draft_id uuid,
  p_draft_version integer,
  p_details_version integer,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.checkout_drafts%rowtype;
  details public.checkout_delivery_details%rowtype;
  settings public.delivery_settings%rowtype;
  new_version integer;
begin
  select * into draft
  from public.checkout_drafts
  where id = p_draft_id
  for update;

  if not found
    or draft.expires_at <= now()
    or draft.status <> 'ready_for_details'
    or draft.fulfillment_method <> 'delivery' then
    raise exception 'delivery_draft_expired';
  end if;
  if draft.version <> p_draft_version then
    raise exception 'delivery_conflict';
  end if;
  if private.fulfillment_date_issue(
    'delivery', draft.fulfillment_date
  ) is not null then
    raise exception 'delivery_schedule_changed';
  end if;

  select * into details
  from public.checkout_delivery_details
  where checkout_draft_id = draft.id
  for update;

  if coalesce(details.version, 0) <> p_details_version then
    raise exception 'delivery_conflict';
  end if;

  select * into strict settings
  from public.delivery_settings
  where singleton
  for share;

  new_version = p_details_version + 1;
  if p_action = 'save' then
    if jsonb_typeof(p_payload) <> 'object' then
      raise exception 'invalid_delivery_input';
    end if;
    insert into public.checkout_delivery_details (
      checkout_draft_id, version, input
    )
    values (draft.id, new_version, p_payload)
    on conflict (checkout_draft_id) do update
    set input = excluded.input,
      version = excluded.version,
      status = 'unverified',
      quote = null,
      updated_at = now();
  elsif p_action = 'quote' then
    if details.checkout_draft_id is null
      or (p_payload->>'settingsVersion')::integer is distinct from settings.version
      or (p_payload->>'expiresAt') is null
      or (p_payload->>'expiresAt')::timestamptz <= now()
      or (p_payload->>'expiresAt')::timestamptz > least(
        now() + make_interval(mins => settings.quote_minutes), draft.expires_at
      )
      or (p_payload->>'cartFingerprint') is distinct from draft.cart_fingerprint
      or (p_payload->>'pricingFingerprint') is distinct from draft.pricing_fingerprint then
      raise exception 'delivery_quote_stale';
    end if;
    update public.checkout_delivery_details
    set quote = p_payload,
      status = 'quoted',
      version = new_version,
      updated_at = now()
    where checkout_draft_id = draft.id;
  elsif p_action = 'confirm' then
    if details.quote is null
      or (details.quote->>'expiresAt') is null
      or (details.quote->>'expiresAt')::timestamptz <= now()
      or (details.quote->>'settingsVersion')::integer is distinct from settings.version
      or (details.quote->>'cartFingerprint') is distinct from draft.cart_fingerprint
      or (details.quote->>'pricingFingerprint') is distinct from draft.pricing_fingerprint then
      raise exception 'delivery_quote_stale';
    end if;
    if details.status = 'confirmed' then
      return details.version;
    end if;
    update public.checkout_delivery_details
    set status = 'confirmed', version = new_version, updated_at = now()
    where checkout_draft_id = draft.id;
  else
    raise exception 'invalid_delivery_action';
  end if;

  insert into public.delivery_audit_events (
    checkout_draft_id, action, version
  )
  values (
    draft.id,
    case p_action
      when 'save' then 'details_saved'
      when 'quote' then 'quote_created'
      else 'address_confirmed'
    end,
    new_version
  );
  return new_version;
end;
$$;

create or replace function private.invalidate_delivery_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(
    new.cart_fingerprint,
    new.pricing_fingerprint,
    new.fulfillment_date,
    new.status
  ) is distinct from row(
    old.cart_fingerprint,
    old.pricing_fingerprint,
    old.fulfillment_date,
    old.status
  ) then
    update public.checkout_delivery_details
    set quote = null,
      status = 'unverified',
      version = version + 1,
      updated_at = now()
    where checkout_draft_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.checkout_drafts
  drop constraint checkout_drafts_toronto_date_check,
  drop constraint checkout_drafts_toronto_time_check,
  drop column fulfillment_time,
  drop column fulfillment_at;

drop function private.fulfillment_slot_issue(
  text, date, time without time zone, timestamp with time zone
);

update public.fulfillment_blackouts
set starts_at = null, ends_at = null
where starts_at is not null or ends_at is not null;

alter table public.fulfillment_blackouts
  drop constraint fulfillment_blackouts_time_pair_check,
  drop column starts_at,
  drop column ends_at;

alter table public.fulfillment_settings
  drop constraint fulfillment_settings_slot_interval_check,
  drop column slot_interval_minutes;

alter table public.fulfillment_hours
  drop constraint fulfillment_hours_range_check,
  drop column opens_at,
  drop column last_slot_at;

alter table public.orders
  add column fulfillment_date date;

alter table public.orders
  alter column fulfillment_date set not null,
  drop column fulfillment_at;

drop index if exists public.orders_upcoming_idx;
create index orders_upcoming_idx on public.orders (fulfillment_date, id);

alter table public.payment_attempts
  drop constraint payment_attempt_snapshot_version_check,
  add constraint payment_attempt_snapshot_version_check
    check (((snapshot->>'version')::integer = 3) is true),
  add constraint payment_attempt_snapshot_delivery_date_check
    check ((snapshot->>'fulfillmentDate')::date is not null);

alter table public.orders
  drop constraint orders_snapshot_version_check,
  add constraint orders_snapshot_version_check
    check (((snapshot->>'version')::integer = 3) is true),
  add constraint orders_snapshot_delivery_date_check
    check (((snapshot->>'fulfillmentDate')::date = fulfillment_date) is true);

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
    and status in (
      'creating', 'open', 'processing', 'paid', 'needs_review', 'refund_pending'
    )
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
    or (p_snapshot->>'version')::integer is distinct from 3
    or p_snapshot ? 'tax'
    or p_snapshot->'validatedCart'->>'status' is distinct from 'ready'
    or p_snapshot->'cart' is distinct from d.cart_payload
    or (p_snapshot->>'fulfillmentDate')::date is distinct from d.fulfillment_date
    or (p_snapshot->>'deliveryCents')::integer <> (v.quote->>'feeCents')::integer
    or (p_snapshot->>'subtotalCents')::integer <> (v.quote->>'subtotalCents')::integer
    or p_snapshot->'delivery' is distinct from jsonb_set(
      v.input, '{address}', v.quote->'address'
    )
    or p_snapshot->>'currency' <> 'CAD'
    or (p_snapshot->>'totalCents')::integer < 50
    or (p_snapshot->>'totalCents')::integer > 99999999
    or (p_snapshot->>'totalCents')::integer <>
      (p_snapshot->>'subtotalCents')::integer +
      (p_snapshot->>'deliveryCents')::integer then
    raise exception 'payment_snapshot_invalid';
  end if;

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

create or replace function public.resolve_wallet_payment(
  p_attempt_id uuid,
  p_action text,
  p_event_id text,
  p_session_id text,
  p_payment_id text default null,
  p_amount integer default null,
  p_currency text default null,
  p_live boolean default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.payment_attempts%rowtype;
  h public.capacity_holds%rowtype;
  order_id uuid;
  adjustment_id uuid;
  draft_id uuid;
begin
  select checkout_draft_id into draft_id
  from public.payment_attempts
  where id = p_attempt_id;

  perform 1
  from public.checkout_drafts
  where id = draft_id
  for update;

  select * into strict a
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if a.stripe_session_id is distinct from p_session_id or p_session_id is null then
    raise exception 'payment_session_mismatch';
  end if;

  select id into order_id
  from public.orders
  where payment_attempt_id = a.id;

  if exists (
    select 1 from public.payment_events
    where event_id = p_event_id and payment_attempt_id <> a.id
  ) then
    raise exception 'payment_event_mismatch';
  end if;
  if exists (select 1 from public.payment_events where event_id = p_event_id) then
    return order_id;
  end if;
  if p_action not in ('paid', 'expired', 'refund_pending', 'refunded', 'review') then
    raise exception 'payment_action_invalid';
  end if;
  if p_action in ('paid', 'refund_pending', 'refunded')
    and (
      p_payment_id is null
      or p_amount is distinct from a.total_cents
      or p_currency is distinct from a.currency
      or p_live is distinct from not a.test_only
    ) then
    raise exception 'payment_amount_mismatch';
  end if;

  insert into public.payment_events (event_id, payment_attempt_id, action)
  values (p_event_id, a.id, p_action);

  if order_id is not null or a.status = 'refunded' then
    return order_id;
  end if;

  select * into strict h from public.capacity_holds where id = a.hold_id;
  perform 1
  from public.capacity_days
  where fulfillment_date = h.fulfillment_date
  for update;
  select * into strict h
  from public.capacity_holds
  where id = a.hold_id
  for update;

  if p_action = 'paid'
    and h.status = 'active'
    and h.payment_pending
    and a.status not in ('expired', 'refund_pending', 'needs_review') then
    update public.capacity_holds
    set status = 'consumed', consumed_at = now(), payment_pending = false
    where id = h.id;

    insert into public.capacity_adjustments (
      fulfillment_date, source, customer_reference, internal_note
    )
    values (
      h.fulfillment_date, 'website', a.id::text, 'Confirmed website order'
    )
    returning id into adjustment_id;

    insert into public.orders (
      payment_attempt_id,
      capacity_adjustment_id,
      fulfillment_date,
      snapshot,
      test_only
    )
    values (
      a.id,
      adjustment_id,
      (a.snapshot->>'fulfillmentDate')::date,
      a.snapshot,
      a.test_only
    )
    returning id into order_id;

    update public.payment_attempts
    set status = 'paid', stripe_payment_intent_id = p_payment_id, updated_at = now()
    where id = a.id;

    insert into public.order_notifications (order_id, payment_attempt_id, kind)
    values
      (order_id, a.id, 'customer_confirmation'),
      (order_id, a.id, 'owner_order')
    on conflict do nothing;
  elsif p_action = 'expired'
    and a.status not in ('refund_pending', 'needs_review') then
    update public.capacity_holds
    set status = 'released', released_at = now(), payment_pending = false
    where id = h.id and status = 'active';
    update public.payment_attempts
    set status = 'expired', updated_at = now()
    where id = a.id;
  elsif p_action in ('paid', 'refund_pending', 'refunded') then
    update public.capacity_holds
    set status = 'released', released_at = now(), payment_pending = false
    where id = h.id and status = 'active';
    update public.payment_attempts
    set status = case
        when p_action = 'refunded' then 'refunded'
        else 'refund_pending'
      end,
      stripe_payment_intent_id = p_payment_id,
      updated_at = now()
    where id = a.id;
    insert into public.order_notifications (payment_attempt_id, kind)
    values (a.id, 'owner_exception')
    on conflict do nothing;
  else
    update public.payment_attempts
    set status = 'needs_review', updated_at = now()
    where id = a.id;
    insert into public.order_notifications (payment_attempt_id, kind)
    values (a.id, 'owner_exception')
    on conflict do nothing;
  end if;

  return order_id;
end;
$$;

revoke all on function private.fulfillment_date_issue(
  text, date, timestamp with time zone
) from public, anon, authenticated;
grant execute on function private.fulfillment_date_issue(
  text, date, timestamp with time zone
) to service_role;

comment on table public.fulfillment_hours is
  'Owner-visible weekly delivery-day availability in America/Toronto.';
comment on table public.fulfillment_blackouts is
  'Owner-created full-day delivery closures. Internal notes are never returned to customers.';
comment on table public.checkout_drafts is
  'Short-lived guest cart and delivery-date intent. A draft is not a paid order and does not consume capacity.';
comment on function public.begin_wallet_payment(uuid, integer, integer, text, jsonb)
  is 'Starts an idempotent wallet reservation after validating a date-only, no-tax subtotal-plus-delivery snapshot.';
