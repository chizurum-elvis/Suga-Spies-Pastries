-- Cancellation commits before any provider call. A durable, leased refund job
-- then returns the immutable paid amount to the original payment method.
-- Match the existing checkout promise: midnight in Toronto on the calendar
-- day before delivery. Subtract the calendar day before timezone conversion.
create function private.order_cancellation_deadline(p_date date)
returns timestamptz language sql stable strict security invoker set search_path = '' as $$
  select (p_date - 1)::timestamp at time zone 'America/Toronto';
$$;
revoke all on function private.order_cancellation_deadline(date) from public, anon, authenticated, service_role;
grant execute on function private.order_cancellation_deadline(date) to authenticated, service_role;
alter table public.orders
  drop constraint orders_status_check,
  drop constraint orders_payment_status_check,
  drop constraint orders_completion_check,
  add constraint orders_status_check check (status in ('confirmed','completed','cancelled')),
  add constraint orders_payment_status_check check (payment_status in ('paid','refund_pending','refunded','refund_failed')),
  add constraint orders_completion_check check (
    (status = 'cancelled' and fulfillment_status = 'received' and payment_status <> 'paid')
    or (status = 'completed' and fulfillment_status = 'delivered' and payment_status = 'paid')
    or (status = 'confirmed' and fulfillment_status <> 'delivered' and payment_status = 'paid')
  );

alter table public.order_events
  drop constraint order_events_type_check,
  drop constraint order_events_to_status_check,
  drop constraint order_events_transition_check,
  add constraint order_events_type_check check (event_type in ('fulfillment_status','cancellation')),
  add constraint order_events_to_status_check check (to_status in ('received','preparing','ready','out_for_delivery','delivered','cancelled')),
  add constraint order_events_transition_check check (
    (event_type = 'cancellation' and from_status = 'received' and to_status = 'cancelled')
    or (event_type = 'fulfillment_status' and (
      (from_status is null and to_status = 'received')
      or (from_status = 'received' and to_status = 'preparing')
      or (from_status = 'preparing' and to_status = 'ready')
      or (from_status = 'ready' and to_status = 'out_for_delivery')
      or (from_status = 'out_for_delivery' and to_status = 'delivered')
    ))
  );

alter table public.order_notifications
  drop constraint order_notifications_kind_check,
  drop constraint order_notifications_event_check,
  drop constraint order_notifications_order_event_id_key,
  add constraint order_notifications_kind_check check (kind in (
    'customer_confirmation','customer_preparing','customer_ready',
    'customer_out_for_delivery','customer_delivered','customer_cancelled',
    'owner_order','owner_exception','owner_cancellation','owner_refund_attention'
  )),
  add constraint order_notifications_event_check check (
    (kind in ('customer_preparing','customer_ready','customer_out_for_delivery',
      'customer_delivered','customer_cancelled','owner_cancellation') and order_event_id is not null)
    or (kind in ('customer_confirmation','owner_order','owner_exception','owner_refund_attention') and order_event_id is null)
  ),
  add constraint order_notifications_event_kind_key unique (order_event_id, kind);

create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  payment_attempt_id uuid not null unique references public.payment_attempts(id) on delete restrict,
  amount_cents integer not null check (amount_cents between 50 and 99999999),
  currency text not null default 'cad' check (currency = 'cad'),
  test_only boolean not null,
  requested_by text not null check (requested_by in ('customer','owner')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text check (reason is null or char_length(reason) between 1 and 500),
  status text not null default 'queued' check (status in ('queued','pending','succeeded','failed','needs_review')),
  stripe_payment_intent_id text not null unique,
  stripe_refund_id text unique,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  first_attempt_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  failure_code text,
  constraint order_refunds_completed_check check ((status = 'succeeded') = (completed_at is not null)),
  constraint order_refunds_provider_check check (status not in ('pending','succeeded','failed') or stripe_refund_id is not null)
);
create index order_refunds_worker_idx on public.order_refunds(test_only, next_attempt_at)
  where status in ('queued','pending');
create index order_refunds_actor_idx on public.order_refunds(actor_user_id) where actor_user_id is not null;
alter table public.order_refunds enable row level security;
alter table public.order_refunds force row level security;
revoke all on public.order_refunds from public, anon, authenticated, service_role;
grant select on public.order_refunds to authenticated, service_role;
create policy order_refunds_owner_read on public.order_refunds for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));

-- The existing preparation RPC and cancellation both lock this order row.
-- This trigger also prevents privileged application code from resurrecting an
-- order, skipping preparation restrictions, or rewriting its purchase snapshot.
create or replace function private.enforce_order_lifecycle()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.id,new.order_number,new.payment_attempt_id,new.capacity_adjustment_id,
    new.fulfillment_date,new.snapshot,new.test_only,new.created_at)
    is distinct from row(old.id,old.order_number,old.payment_attempt_id,old.capacity_adjustment_id,
    old.fulfillment_date,old.snapshot,old.test_only,old.created_at) then
    raise exception 'order_history_is_immutable';
  end if;
  if new is not distinct from old then return new; end if;

  if new.status = 'cancelled' and old.status = 'confirmed' then
    if current_setting('suga_spies.order_cancellation_id', true) is distinct from old.id::text
      or old.fulfillment_status <> 'received' or new.fulfillment_status <> 'received'
      or old.payment_status <> 'paid' or new.payment_status <> 'refund_pending'
      or clock_timestamp() >= private.order_cancellation_deadline(old.fulfillment_date) then
      raise exception 'order_cancellation_not_allowed';
    end if;
  elsif old.status = 'cancelled' then
    if current_setting('suga_spies.order_refund_id', true) is distinct from old.id::text
      or new.status <> 'cancelled' or new.fulfillment_status <> old.fulfillment_status
      or new.payment_status = 'paid' then
      raise exception 'order_cancelled';
    end if;
  else
    if new.payment_status is distinct from old.payment_status then raise exception 'order_payment_state_locked'; end if;
    if new.fulfillment_status = old.fulfillment_status then raise exception 'order_lifecycle_mutation_invalid'; end if;
    if current_setting('suga_spies.order_transition_id', true) is distinct from old.id::text then
      raise exception 'use_order_transition_workflow';
    end if;
    if old.status <> 'confirmed' or not (
      (old.fulfillment_status = 'received' and new.fulfillment_status = 'preparing')
      or (old.fulfillment_status = 'preparing' and new.fulfillment_status = 'ready')
      or (old.fulfillment_status = 'ready' and new.fulfillment_status = 'out_for_delivery')
      or (old.fulfillment_status = 'out_for_delivery' and new.fulfillment_status = 'delivered')
    ) then raise exception 'order_transition_invalid'; end if;
    if new.status is distinct from (case when new.fulfillment_status = 'delivered' then 'completed' else 'confirmed' end) then
      raise exception 'order_lifecycle_mutation_invalid';
    end if;
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'order_lifecycle_mutation_invalid';
  end if;
  return new;
end;
$$;

create function private.cancel_order(p_order_id uuid, p_expected_version integer, p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  actor uuid := (select auth.uid());
  source text;
  o public.orders%rowtype;
  a public.payment_attempts%rowtype;
  refund_id uuid;
  event_id uuid;
  decision_time timestamptz;
begin
  if (select auth.role()) = 'service_role' then source := 'customer';
  elsif actor is not null and exists (select 1 from public.admin_users where user_id = actor and role = 'owner' and is_active) then source := 'owner';
  else raise exception using errcode = '42501', message = 'order_cancellation_forbidden'; end if;
  if p_expected_version is null or p_expected_version < 1
    or char_length(coalesce(p_reason,'')) > 500
    or (source = 'owner' and char_length(btrim(coalesce(p_reason,''))) < 3) then
    raise exception 'order_cancellation_invalid';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  -- A replay returns the original refund, even after the deadline has passed.
  select id into refund_id from public.order_refunds where order_id = o.id;
  if o.status = 'cancelled' and refund_id is not null then return refund_id; end if;
  if o.status <> 'confirmed' or o.fulfillment_status <> 'received' then raise exception 'order_preparation_started'; end if;
  if o.version <> p_expected_version then raise exception 'order_cancellation_conflict'; end if;
  decision_time := clock_timestamp();
  if decision_time >= private.order_cancellation_deadline(o.fulfillment_date) then
    raise exception 'order_cancellation_deadline';
  end if;
  select * into strict a from public.payment_attempts where id = o.payment_attempt_id;
  if o.payment_status <> 'paid' or a.status <> 'paid' or a.stripe_payment_intent_id is null
    or a.total_cents is distinct from (o.snapshot->>'totalCents')::integer
    or a.test_only is distinct from o.test_only then raise exception 'order_payment_unverified'; end if;

  -- Lock order -> capacity day -> booking. Settlement never locks an existing
  -- order after a day lock, and cancelled bookings cannot be reactivated.
  perform 1 from public.capacity_days where fulfillment_date = o.fulfillment_date for update;
  update public.capacity_adjustments set status = 'released', released_at = decision_time
    where id = o.capacity_adjustment_id and status = 'active';
  if not found then raise exception 'order_capacity_inconsistent'; end if;
  insert into public.order_refunds(order_id,payment_attempt_id,amount_cents,test_only,requested_by,actor_user_id,reason,stripe_payment_intent_id)
    values(o.id,a.id,a.total_cents,o.test_only,source,actor,nullif(btrim(p_reason),''),a.stripe_payment_intent_id)
    returning id into refund_id;
  perform set_config('suga_spies.order_cancellation_id',o.id::text,true);
  update public.orders set status = 'cancelled', payment_status = 'refund_pending', version = version + 1, updated_at = clock_timestamp() where id = o.id;
  perform set_config('suga_spies.order_cancellation_id','',true);
  insert into public.order_events(order_id,event_type,from_status,to_status,customer_title,customer_message,actor_user_id,idempotency_key,metadata)
    values(o.id,'cancellation','received','cancelled','Order cancelled',
      'Your order has been cancelled. A full refund to the original payment method has been requested.',actor,refund_id,
      jsonb_build_object('requested_by',source,'refund_id',refund_id)) returning id into event_id;
  insert into public.order_notifications(order_id,payment_attempt_id,order_event_id,kind)
    values(o.id,a.id,event_id,'customer_cancelled'),(o.id,a.id,event_id,'owner_cancellation');
  return refund_id;
end;
$$;
create function public.cancel_order(p_order_id uuid, p_expected_version integer, p_reason text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.cancel_order(p_order_id,p_expected_version,p_reason);
$$;
revoke all on function private.cancel_order(uuid,integer,text), public.cancel_order(uuid,integer,text) from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.cancel_order(uuid,integer,text), public.cancel_order(uuid,integer,text) to authenticated, service_role;

create function private.claim_order_refunds(p_test_only boolean, p_refund_id uuid default null)
returns setof public.order_refunds language sql security definer set search_path = '' as $$
  update public.order_refunds r set lease_id = gen_random_uuid(), lease_until = now() + interval '2 minutes',
    attempts = attempts + 1, first_attempt_at = coalesce(first_attempt_at,now())
  where r.id in (
    select id from public.order_refunds
    where test_only = p_test_only and (lease_until is null or lease_until <= now())
      and next_attempt_at <= now()
      and ((p_refund_id is null and status in ('queued','pending'))
        or (p_refund_id is not null and id = p_refund_id))
    order by next_attempt_at limit 4 for update skip locked
  ) returning r.*;
$$;
create function public.claim_order_refunds(p_test_only boolean, p_refund_id uuid default null)
returns setof public.order_refunds language sql security invoker set search_path = '' as $$
  select * from private.claim_order_refunds(p_test_only,p_refund_id);
$$;

create function private.resolve_order_refund(p_refund_id uuid,p_lease_id uuid,p_status text,p_provider_id text default null,p_failure_code text default null)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare
  r public.order_refunds%rowtype;
  target_order uuid;
  payment_state text;
begin
  select order_id into target_order from public.order_refunds where id = p_refund_id;
  perform 1 from public.orders where id = target_order and status = 'cancelled' for update;
  if not found then raise exception 'refund_order_invalid'; end if;
  select * into strict r from public.order_refunds where id = p_refund_id for update;
  if r.lease_id is distinct from p_lease_id or p_lease_id is null then return false; end if;
  if p_status is null or p_status not in ('queued','pending','succeeded','failed','needs_review')
    or (p_status in ('pending','succeeded','failed') and coalesce(p_provider_id,r.stripe_refund_id) is null)
    or (r.stripe_refund_id is not null and p_provider_id is not null and r.stripe_refund_id <> p_provider_id)
    or char_length(coalesce(p_failure_code,'')) > 80 then raise exception 'refund_resolution_invalid'; end if;
  -- A stale worker cannot overwrite a newer worker's outcome. Stripe may
  -- legitimately report a bank failure after initially accepting a refund.
  update public.order_refunds set status = p_status,
    stripe_refund_id = coalesce(p_provider_id,stripe_refund_id),
    completed_at = case when p_status = 'succeeded' then coalesce(completed_at,clock_timestamp()) else null end,
    updated_at = clock_timestamp(), lease_id = null, lease_until = null, failure_code = p_failure_code,
    next_attempt_at = now() + make_interval(secs => case when p_status = 'queued' then least(3600,60 * power(2,least(r.attempts,6))::integer) else 60 end)
    where id = r.id;
  payment_state := case when p_status = 'succeeded' then 'refunded' when p_status in ('failed','needs_review') then 'refund_failed' else 'refund_pending' end;
  if r.status is distinct from p_status or r.stripe_refund_id is distinct from coalesce(p_provider_id,r.stripe_refund_id) then
    insert into public.payment_events(event_id,payment_attempt_id,action)
      values('order-refund:' || r.id::text || ':' || p_lease_id::text,r.payment_attempt_id,'order_refund_' || p_status);
  end if;
  perform set_config('suga_spies.order_refund_id',r.order_id::text,true);
  update public.orders set payment_status = payment_state, version = version + 1, updated_at = clock_timestamp()
    where id = r.order_id and payment_status is distinct from payment_state;
  perform set_config('suga_spies.order_refund_id','',true);
  if p_status in ('failed','needs_review') or (p_status = 'queued' and r.attempts >= 5) then
    insert into public.order_notifications(order_id,payment_attempt_id,kind)
      values(r.order_id,r.payment_attempt_id,'owner_refund_attention') on conflict (payment_attempt_id,kind) do nothing;
  end if;
  return true;
end;
$$;
create function public.resolve_order_refund(p_refund_id uuid,p_lease_id uuid,p_status text,p_provider_id text default null,p_failure_code text default null)
returns boolean language sql security invoker set search_path = '' as $$
  select private.resolve_order_refund(p_refund_id,p_lease_id,p_status,p_provider_id,p_failure_code);
$$;
revoke all on function private.claim_order_refunds(boolean,uuid), public.claim_order_refunds(boolean,uuid),
  private.resolve_order_refund(uuid,uuid,text,text,text), public.resolve_order_refund(uuid,uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function private.claim_order_refunds(boolean,uuid), public.claim_order_refunds(boolean,uuid),
  private.resolve_order_refund(uuid,uuid,text,text,text), public.resolve_order_refund(uuid,uuid,text,text,text)
  to service_role;
