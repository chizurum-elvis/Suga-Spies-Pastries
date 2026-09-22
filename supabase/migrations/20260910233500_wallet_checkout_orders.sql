-- Payment reservations remain counted until Stripe's outcome is resolved.
-- The customer deadline is still expires_at; browser timers never free capacity.
alter table public.capacity_holds add column payment_pending boolean not null default false;
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
  slot_issue text;
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

  slot_issue = private.fulfillment_slot_issue(
    draft.fulfillment_method,
    draft.fulfillment_date,
    draft.fulfillment_time,
    p_evaluated_at
  );
  if slot_issue is not null then
    raise exception using
      errcode = 'P0001',
      message = 'The selected fulfillment time is no longer available.',
      detail = slot_issue;
  end if;

  -- Lock order is draft -> day -> hold, including expiry cleanup.
  -- Owner-entered bookings also lock day -> hold, preventing inverted row locks.
  insert into public.capacity_days (fulfillment_date) values (draft.fulfillment_date)
    on conflict on constraint capacity_days_pkey do nothing;
  perform 1 from public.capacity_days
    where capacity_days.fulfillment_date = draft.fulfillment_date for update;

  select * into existing_hold
  from public.capacity_holds
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_hold.checkout_draft_id <> draft.id then
      raise exception using
        errcode = 'P0001',
        message = 'The idempotency key is already used by another checkout.';
    end if;
    if existing_hold.status = 'active' and (existing_hold.expires_at > p_evaluated_at or existing_hold.payment_pending) then
      return query select existing_hold.id, existing_hold.expires_at, existing_hold.fulfillment_date;
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
    return query select existing_hold.id, existing_hold.expires_at, existing_hold.fulfillment_date;
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

create or replace function private.enforce_capacity_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_adjustments integer;
  active_holds integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  insert into public.capacity_days (fulfillment_date)
  values (new.fulfillment_date)
  on conflict (fulfillment_date) do nothing;

  perform 1
  from public.capacity_days
  where fulfillment_date = new.fulfillment_date
  for update;

  update public.capacity_holds
  set status = 'expired', updated_at = now()
  where fulfillment_date = new.fulfillment_date
    and status = 'active'
    and not payment_pending
    and expires_at <= now();

  select count(*) into active_adjustments
  from public.capacity_adjustments
  where fulfillment_date = new.fulfillment_date
    and status = 'active'
    and (tg_op = 'INSERT' or id <> new.id);

  select count(*) into active_holds
  from public.capacity_holds
  where fulfillment_date = new.fulfillment_date
    and status = 'active'
    and (expires_at > now() or payment_pending);

  if active_adjustments + active_holds >= 4 then
    raise exception using
      errcode = 'P0001',
      message = 'The fulfillment date has reached its four-order capacity.';
  end if;

  return new;
end;
$$;
create index capacity_holds_pending_idx on public.capacity_holds(fulfillment_date) where status = 'active' and payment_pending;

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  checkout_draft_id uuid not null references public.checkout_drafts(id) on delete restrict,
  hold_id uuid not null unique references public.capacity_holds(id) on delete restrict,
  access_token_hash text not null check (access_token_hash ~ '^[0-9a-f]{64}$'),
  review_token text not null check (review_token ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  total_cents integer not null check (total_cents between 50 and 99999999),
  currency text not null default 'cad' check (currency = 'cad'),
  test_only boolean not null,
  status text not null default 'creating' check (status in ('creating','open','processing','paid','expired','refund_pending','refunded','needs_review')),
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_refund_id text unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_reconcile_at timestamptz not null default now(),
  reconcile_count integer not null default 0,
  failure_code text,
  check ((snapshot->>'totalCents')::integer = total_cents),
  check ((snapshot->>'testOnly')::boolean = test_only)
);
create unique index payment_attempt_one_unresolved_draft on public.payment_attempts(checkout_draft_id)
  where status in ('creating','open','processing','needs_review','refund_pending');
create index payment_attempt_draft_idx on public.payment_attempts(checkout_draft_id, created_at desc);
create index payment_attempt_worker_idx on public.payment_attempts(next_reconcile_at) where status not in ('paid','expired','refunded');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('SS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,12))),
  payment_attempt_id uuid not null unique references public.payment_attempts(id) on delete restrict,
  capacity_adjustment_id uuid not null unique references public.capacity_adjustments(id) on delete restrict,
  fulfillment_at timestamptz not null,
  status text not null default 'confirmed' check (status = 'confirmed'),
  payment_status text not null default 'paid' check (payment_status = 'paid'),
  fulfillment_status text not null default 'received' check (fulfillment_status = 'received'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  test_only boolean not null,
  created_at timestamptz not null default now()
);
create index orders_upcoming_idx on public.orders(fulfillment_at, id);
create table public.payment_events (
  event_id text primary key,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  action text not null,
  created_at timestamptz not null default now()
);
create index payment_events_attempt_idx on public.payment_events(payment_attempt_id, created_at);
create table public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  kind text not null check (kind in ('customer_confirmation','owner_order','owner_exception')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  lease_id uuid,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  failure_code text,
  unique(payment_attempt_id, kind)
);
create index order_notifications_pending_idx on public.order_notifications(next_attempt_at) where status in ('pending','sending');
create index order_notifications_order_idx on public.order_notifications(order_id);

-- A healthy recurring worker is required before accepting a new reservation.
create table public.payment_worker_health (
  mode text primary key check (mode in ('test','live')),
  checked_at timestamptz not null
);
alter table public.payment_worker_health enable row level security;
alter table public.payment_worker_health force row level security;
revoke all on public.payment_worker_health from public, anon, authenticated, service_role;
grant select, insert, update on public.payment_worker_health to service_role;

-- Freeze a draft during payment, including writes from an older tab.
create function private.protect_payment_draft() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.payment_attempts a where a.checkout_draft_id = old.id and a.status in ('creating','open','processing','needs_review','refund_pending','paid')) then
    raise exception 'payment_in_progress';
  end if;
  return new;
end;
$$;
create trigger checkout_drafts_payment_guard before update on public.checkout_drafts for each row execute function private.protect_payment_draft();

create function private.protect_payment_details() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Quote cleanup may clear provider data, but cannot change the original input.
  if new.input is distinct from old.input and exists (select 1 from public.payment_attempts a where a.checkout_draft_id = old.checkout_draft_id and a.status in ('creating','open','processing','needs_review','refund_pending','paid')) then raise exception 'payment_in_progress'; end if;
  return new;
end;
$$;
create trigger checkout_details_payment_guard before update on public.checkout_delivery_details for each row execute function private.protect_payment_details();

create function public.begin_wallet_payment(p_draft_id uuid, p_draft_version integer, p_details_version integer, p_review_token text, p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  d public.checkout_drafts%rowtype;
  v public.checkout_delivery_details%rowtype;
  settings public.delivery_settings%rowtype;
  existing public.payment_attempts%rowtype;
  reservation record;
  attempt_id uuid := gen_random_uuid();
begin
  select * into d from public.checkout_drafts where id = p_draft_id for update;
  if not found then raise exception 'payment_draft_expired'; end if;
  select * into existing from public.payment_attempts where checkout_draft_id = d.id and status in ('creating','open','processing','paid','needs_review','refund_pending') order by created_at desc limit 1;
  if found then
    if existing.review_token <> p_review_token then raise exception 'payment_in_progress'; end if;
    return existing.id;
  end if;
  if d.status <> 'ready_for_details' or d.expires_at <= now() or d.version <> p_draft_version then raise exception 'payment_review_stale'; end if;
  if not exists(select 1 from public.payment_worker_health where mode = case when (p_snapshot->>'testOnly')::boolean then 'test' else 'live' end and checked_at > now() - interval '3 minutes') then raise exception 'payment_worker_unavailable'; end if;
  select * into v from public.checkout_delivery_details where checkout_draft_id = d.id for update;
  select * into strict settings from public.delivery_settings where singleton for share;
  if v.checkout_draft_id is null or v.status <> 'confirmed' or v.version <> p_details_version or v.quote is null
    or (v.quote->>'expiresAt')::timestamptz <= now()
    or (v.quote->>'settingsVersion')::integer <> settings.version
    or v.quote->>'pricingFingerprint' <> d.pricing_fingerprint
    or v.quote->>'cartFingerprint' <> d.cart_fingerprint then raise exception 'payment_review_stale'; end if;
  if jsonb_typeof(p_snapshot->'cart'->'lines') is distinct from 'array'
    or jsonb_array_length(p_snapshot->'cart'->'lines') not between 1 and 50
    or p_snapshot->'validatedCart'->>'status' is distinct from 'ready'
    or p_snapshot->'cart' is distinct from d.cart_payload
    or (p_snapshot->>'fulfillmentAt')::timestamptz <> d.fulfillment_at
    or (p_snapshot->>'deliveryCents')::integer <> (v.quote->>'feeCents')::integer
    or (p_snapshot->>'subtotalCents')::integer <> (v.quote->>'subtotalCents')::integer
    or p_snapshot->'delivery' is distinct from jsonb_set(v.input, '{address}', v.quote->'address')
    or p_snapshot->>'currency' <> 'CAD'
    or (p_snapshot->>'totalCents')::integer <> (p_snapshot->>'subtotalCents')::integer + (p_snapshot->>'deliveryCents')::integer + (p_snapshot->'tax'->>'totalCents')::integer
    then raise exception 'payment_snapshot_invalid'; end if;
  -- Bound repeat attempts per draft without storing IPs or customer fingerprints.
  if (select count(*) from public.payment_attempts where checkout_draft_id = d.id and created_at > now() - interval '1 hour') >= 8 then raise exception 'payment_rate_limited'; end if;
  select * into strict reservation from public.reserve_fulfillment_capacity(d.id, attempt_id);
  update public.capacity_holds set payment_pending = true where id = reservation.hold_id;
  insert into public.payment_attempts(id,checkout_draft_id,hold_id,access_token_hash,review_token,snapshot,total_cents,test_only,expires_at)
    values(attempt_id,d.id,reservation.hold_id,d.access_token_hash,p_review_token,p_snapshot,(p_snapshot->>'totalCents')::integer,(p_snapshot->>'testOnly')::boolean,reservation.expires_at);
  return attempt_id;
end;
$$;

create function public.resolve_wallet_payment(p_attempt_id uuid, p_action text, p_event_id text, p_session_id text, p_payment_id text default null, p_amount integer default null, p_currency text default null, p_live boolean default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a public.payment_attempts%rowtype; h public.capacity_holds%rowtype; order_id uuid; adjustment_id uuid; draft_id uuid;
begin
  select checkout_draft_id into draft_id from public.payment_attempts where id = p_attempt_id;
  perform 1 from public.checkout_drafts where id = draft_id for update;
  select * into strict a from public.payment_attempts where id = p_attempt_id for update;
  if a.stripe_session_id is distinct from p_session_id or p_session_id is null then raise exception 'payment_session_mismatch'; end if;
  select id into order_id from public.orders where payment_attempt_id = a.id;
  if exists(select 1 from public.payment_events where event_id = p_event_id and payment_attempt_id <> a.id) then raise exception 'payment_event_mismatch'; end if;
  if exists(select 1 from public.payment_events where event_id = p_event_id) then return order_id; end if;
  if p_action not in ('paid','expired','refund_pending','refunded','review') then raise exception 'payment_action_invalid'; end if;
  if p_action in ('paid','refund_pending','refunded') and (p_payment_id is null or p_amount is distinct from a.total_cents or p_currency is distinct from a.currency or p_live is distinct from not a.test_only) then raise exception 'payment_amount_mismatch'; end if;
  insert into public.payment_events(event_id,payment_attempt_id,action) values(p_event_id,a.id,p_action);
  if order_id is not null or a.status = 'refunded' then return order_id; end if;
  select * into strict h from public.capacity_holds where id = a.hold_id;
  perform 1 from public.capacity_days where fulfillment_date = h.fulfillment_date for update;
  select * into strict h from public.capacity_holds where id = a.hold_id for update;
  if p_action = 'paid' and h.status = 'active' and h.payment_pending and a.status not in ('expired','refund_pending','needs_review') then
    update public.capacity_holds set status = 'consumed', consumed_at = now(), payment_pending = false where id = h.id;
    insert into public.capacity_adjustments(fulfillment_date,source,customer_reference,internal_note)
      values(h.fulfillment_date,'website',a.id::text,'Confirmed website order') returning id into adjustment_id;
    insert into public.orders(payment_attempt_id,capacity_adjustment_id,fulfillment_at,snapshot,test_only)
      values(a.id,adjustment_id,(a.snapshot->>'fulfillmentAt')::timestamptz,a.snapshot,a.test_only) returning id into order_id;
    update public.payment_attempts set status = 'paid', stripe_payment_intent_id = p_payment_id, updated_at = now() where id = a.id;
    insert into public.order_notifications(order_id,payment_attempt_id,kind) values(order_id,a.id,'customer_confirmation'),(order_id,a.id,'owner_order') on conflict do nothing;
  elsif p_action = 'expired' and a.status not in ('refund_pending','needs_review') then
    update public.capacity_holds set status = 'released', released_at = now(), payment_pending = false where id = h.id and status = 'active';
    update public.payment_attempts set status = 'expired', updated_at = now() where id = a.id;
  elsif p_action in ('paid','refund_pending','refunded') then
    update public.capacity_holds set status = 'released', released_at = now(), payment_pending = false where id = h.id and status = 'active';
    update public.payment_attempts set status = case when p_action = 'refunded' then 'refunded' else 'refund_pending' end, stripe_payment_intent_id = p_payment_id, updated_at = now() where id = a.id;
    insert into public.order_notifications(payment_attempt_id,kind) values(a.id,'owner_exception') on conflict do nothing;
  else
    update public.payment_attempts set status = 'needs_review', updated_at = now() where id = a.id;
    insert into public.order_notifications(payment_attempt_id,kind) values(a.id,'owner_exception') on conflict do nothing;
  end if;
  return order_id;
end;
$$;

-- One worker leases a notification at a time. Retry identity is the notification ID.
create function public.claim_order_notifications(p_limit integer default 10)
returns setof public.order_notifications language sql security invoker set search_path = '' as $$
  update public.order_notifications n set status = 'sending', lease_id = gen_random_uuid(), attempts = attempts + 1,
    first_attempt_at = coalesce(first_attempt_at, now()), next_attempt_at = now() + interval '5 minutes'
  where n.id in (select id from public.order_notifications where status in ('pending','sending') and next_attempt_at <= now() order by next_attempt_at limit least(greatest(p_limit,1),10) for update skip locked)
  returning n.*;
$$;

-- Website booking capacity can only be released by its payment/order workflow.
create function private.protect_website_capacity() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('service_role','postgres','supabase_admin') and
    ((tg_op <> 'INSERT' and old.source = 'website') or (tg_op <> 'DELETE' and new.source = 'website')) then raise exception 'Use the order workflow to change website capacity.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger capacity_adjustments_payment_guard before insert or update or delete on public.capacity_adjustments for each row execute function private.protect_website_capacity();

alter table public.payment_attempts enable row level security;
alter table public.payment_attempts force row level security;
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.payment_events enable row level security;
alter table public.payment_events force row level security;
alter table public.order_notifications enable row level security;
alter table public.order_notifications force row level security;
revoke all on public.payment_attempts, public.orders, public.payment_events, public.order_notifications from public, anon, authenticated, service_role;
grant select, insert, update on public.payment_attempts, public.orders, public.payment_events, public.order_notifications to service_role;
grant select on public.orders, public.payment_attempts, public.order_notifications to authenticated;
create policy orders_owner_read on public.orders for select to authenticated using (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
create policy payments_owner_read on public.payment_attempts for select to authenticated using (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
create policy notifications_owner_read on public.order_notifications for select to authenticated using (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
revoke all on function private.protect_payment_draft(), private.protect_payment_details(), private.protect_website_capacity() from public, anon, authenticated;
revoke all on function public.begin_wallet_payment(uuid,integer,integer,text,jsonb), public.resolve_wallet_payment(uuid,text,text,text,text,integer,text,boolean), public.claim_order_notifications(integer) from public, anon, authenticated;
grant execute on function public.begin_wallet_payment(uuid,integer,integer,text,jsonb), public.resolve_wallet_payment(uuid,text,text,text,text,integer,text,boolean), public.claim_order_notifications(integer) to service_role;
