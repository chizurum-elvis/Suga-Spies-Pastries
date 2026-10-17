-- A redelivery is a new delivery attempt, never a rewrite of the original
-- paid order. All deadlines are instants; all service dates are Toronto dates.
alter table public.orders
  drop constraint orders_status_check,
  drop constraint orders_fulfillment_status_check,
  drop constraint orders_completion_check,
  add constraint orders_status_check check (status in ('confirmed','completed','cancelled','discarded')),
  add constraint orders_fulfillment_status_check check (fulfillment_status in (
    'received','preparing','ready','out_for_delivery','delivery_failed',
    'redelivery_requested','redelivery_scheduled','redelivery_out_for_delivery','delivered','discarded')),
  add constraint orders_completion_check check (
    (status = 'cancelled' and fulfillment_status = 'received' and payment_status <> 'paid')
    or (status = 'discarded' and fulfillment_status = 'discarded' and payment_status <> 'paid')
    or (status = 'completed' and fulfillment_status = 'delivered' and payment_status = 'paid')
    or (status = 'confirmed' and fulfillment_status not in ('delivered','discarded') and payment_status = 'paid')
  );

alter table public.order_events
  drop constraint order_events_type_check,
  drop constraint order_events_from_status_check,
  drop constraint order_events_to_status_check,
  drop constraint order_events_transition_check,
  drop constraint order_events_order_id_to_status_key,
  add constraint order_events_type_check check (event_type in ('fulfillment_status','cancellation','redelivery')),
  add constraint order_events_from_status_check check (from_status is null or from_status in (
    'received','preparing','ready','out_for_delivery','delivery_failed',
    'redelivery_requested','redelivery_scheduled','redelivery_out_for_delivery','delivered')),
  add constraint order_events_to_status_check check (to_status in (
    'received','preparing','ready','out_for_delivery','delivery_failed','redelivery_requested',
    'redelivery_date_selected','redelivery_payment_expired','redelivery_scheduled',
    'redelivery_out_for_delivery','delivered','cancelled','discarded')),
  add constraint order_events_transition_check check (
    (event_type = 'cancellation' and from_status = 'received' and to_status = 'cancelled')
    or (event_type = 'fulfillment_status' and (
      (from_status is null and to_status = 'received')
      or (from_status = 'received' and to_status = 'preparing')
      or (from_status = 'preparing' and to_status = 'ready')
      or (from_status = 'ready' and to_status = 'out_for_delivery')
      or (from_status = 'out_for_delivery' and to_status = 'delivered')))
    or (event_type = 'redelivery' and (
      (from_status = 'out_for_delivery' and to_status = 'delivery_failed')
      or (from_status = 'delivery_failed' and to_status in ('redelivery_requested','discarded'))
      or (from_status = 'redelivery_requested' and to_status in (
        'redelivery_date_selected','redelivery_payment_expired','redelivery_scheduled','discarded'))
      or (from_status = 'redelivery_scheduled' and to_status = 'redelivery_out_for_delivery')
      or (from_status = 'redelivery_out_for_delivery' and to_status in ('delivered','discarded'))))
  );

alter table public.order_notifications
  drop constraint order_notifications_kind_check,
  drop constraint order_notifications_event_check,
  add constraint order_notifications_kind_check check (kind in (
    'customer_confirmation','customer_preparing','customer_ready','customer_out_for_delivery',
    'customer_delivered','customer_cancelled','customer_delivery_failed',
    'customer_redelivery_requested','customer_redelivery_date_selected',
    'customer_redelivery_scheduled','customer_redelivery_out_for_delivery',
    'customer_order_discarded','owner_order','owner_exception','owner_cancellation',
    'owner_refund_attention','owner_redelivery_requested','owner_delivery_failed')
    or kind ~ '^customer_redelivery_date_selected:[0-9a-f-]{36}$'),
  add constraint order_notifications_event_check check (
    (kind in ('customer_preparing','customer_ready','customer_out_for_delivery',
      'customer_delivered','customer_cancelled','customer_delivery_failed',
      'customer_redelivery_requested','customer_redelivery_date_selected',
      'customer_redelivery_scheduled','customer_redelivery_out_for_delivery',
      'customer_order_discarded','owner_cancellation','owner_redelivery_requested',
      'owner_delivery_failed') and order_event_id is not null)
    or (kind ~ '^customer_redelivery_date_selected:[0-9a-f-]{36}$' and order_event_id is not null)
    or (kind in ('customer_confirmation','owner_order','owner_exception',
      'owner_refund_attention') and order_event_id is null)
  );

alter table public.capacity_adjustments
  drop constraint capacity_adjustments_source_check,
  add constraint capacity_adjustments_source_check check (source in (
    'phone','instagram','admin','other','website','redelivery'));

alter table public.order_refunds
  drop constraint order_refunds_requested_by_check,
  add constraint order_refunds_requested_by_check check (requested_by in ('customer','owner','system'));

create table public.order_redeliveries (
  order_id uuid primary key references public.orders(id) on delete restrict,
  state text not null check (state in ('awaiting_customer','awaiting_owner','awaiting_payment',
    'payment_review','scheduled','out_for_delivery','delivered','discarded')),
  fault text not null check (fault in ('customer','business')),
  failure_reason text not null check (char_length(failure_reason) between 3 and 500),
  failed_at timestamptz not null,
  respond_by timestamptz not null,
  requested_at timestamptz,
  requested_address jsonb,
  distance_meters integer check (distance_meters between 0 and 30000),
  fee_cents integer check (fee_cents between 0 and 100000),
  free_reason text check (free_reason in ('original_free','business_fault')),
  selected_date date,
  capacity_adjustment_id uuid unique references public.capacity_adjustments(id) on delete restrict,
  payment_expires_at timestamptz,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  payment_status text not null default 'not_required' check (payment_status in (
    'not_required','pending','paid','refund_pending','refunded','needs_review')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint redelivery_deadline_check check (respond_by = failed_at + interval '24 hours'),
  constraint redelivery_request_check check (
    (requested_at is null and requested_address is null and distance_meters is null and fee_cents is null)
    or (requested_at is not null and requested_address is not null and distance_meters is not null and fee_cents is not null
      and jsonb_typeof(requested_address) = 'object')),
  constraint redelivery_payment_check check (
    (payment_status = 'not_required' and (fee_cents is null or fee_cents = 0))
    or (payment_status <> 'not_required' and fee_cents > 0)),
  constraint redelivery_free_reason_check check ((fee_cents = 0) = (free_reason is not null) or fee_cents is null),
  constraint redelivery_scheduled_check check (
    state not in ('scheduled','out_for_delivery','delivered')
    or (selected_date is not null and capacity_adjustment_id is not null
      and payment_status in ('not_required','paid')))
);
create index order_redeliveries_deadline_idx on public.order_redeliveries(respond_by)
  where state = 'awaiting_customer';
create index order_redeliveries_payment_idx on public.order_redeliveries(payment_expires_at)
  where state in ('awaiting_payment','payment_review');
alter table public.order_redeliveries enable row level security;
alter table public.order_redeliveries force row level security;
revoke all on public.order_redeliveries from public, anon, authenticated, service_role;
grant select on public.order_redeliveries to authenticated, service_role;
create policy order_redeliveries_owner_read on public.order_redeliveries for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));

create table public.redelivery_request_limits (
  order_id uuid primary key references public.orders(id) on delete restrict,
  window_start timestamptz not null,
  request_count smallint not null check (request_count between 1 and 6)
);
alter table public.redelivery_request_limits enable row level security;
alter table public.redelivery_request_limits force row level security;
revoke all on public.redelivery_request_limits from public,anon,authenticated,service_role;
create function private.allow_redelivery_provider_request(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_now integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  if not exists (select 1 from public.order_redeliveries
    where order_id = p_order_id and state = 'awaiting_customer'
      and respond_by > clock_timestamp()) then return false; end if;
  insert into public.redelivery_request_limits(order_id,window_start,request_count)
    values(p_order_id,clock_timestamp(),1)
    on conflict (order_id) do update set
      window_start = case when redelivery_request_limits.window_start < clock_timestamp() - interval '1 hour'
        then clock_timestamp() else redelivery_request_limits.window_start end,
      request_count = case when redelivery_request_limits.window_start < clock_timestamp() - interval '1 hour'
        then 1 else least(6,redelivery_request_limits.request_count + 1) end
    returning request_count into count_now;
  return count_now <= 5;
end;
$$;
create function public.allow_redelivery_provider_request(p_order_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.allow_redelivery_provider_request(p_order_id);
$$;
revoke all on function private.allow_redelivery_provider_request(uuid),
  public.allow_redelivery_provider_request(uuid) from public,anon,authenticated,service_role;
grant execute on function private.allow_redelivery_provider_request(uuid),
  public.allow_redelivery_provider_request(uuid) to service_role;

-- Original-order refunds retain their one-per-order identity. An additional
-- paid delivery fee has its own independent durable refund job.
create table public.redelivery_fee_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  amount_cents integer not null check (amount_cents between 50 and 100000),
  currency text not null default 'cad' check (currency = 'cad'),
  test_only boolean not null,
  requested_by text not null check (requested_by in ('system','owner')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
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
  constraint redelivery_fee_refunds_completed_check check ((status = 'succeeded') = (completed_at is not null)),
  constraint redelivery_fee_refunds_provider_check check (status not in ('pending','succeeded','failed') or stripe_refund_id is not null)
);
create index redelivery_fee_refunds_worker_idx on public.redelivery_fee_refunds(test_only,next_attempt_at)
  where status in ('queued','pending');
alter table public.redelivery_fee_refunds enable row level security;
alter table public.redelivery_fee_refunds force row level security;
revoke all on public.redelivery_fee_refunds from public,anon,authenticated,service_role;
grant select on public.redelivery_fee_refunds to authenticated,service_role;
create policy redelivery_fee_refunds_owner_read on public.redelivery_fee_refunds for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));

create or replace function private.fulfillment_prepare_adjustment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by = old.created_by;
    if old.status = 'released' and new.status <> 'released' then
      raise exception 'released_capacity_cannot_reopen'; end if;
    if old.source = 'redelivery' and old.status = 'active' and new.status = 'released'
      and current_setting('suga_spies.redelivery_capacity_id',true) is distinct from old.id::text then
      raise exception 'redelivery_capacity_locked'; end if;
    if old.status = 'active' and new.status = 'released' and new.released_at is null then
      new.released_at = clock_timestamp(); end if;
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create or replace function private.enforce_capacity_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare adjustments integer; holds integer;
begin
  if new.status <> 'active' then return new; end if;
  insert into public.capacity_days(fulfillment_date) values(new.fulfillment_date) on conflict do nothing;
  perform 1 from public.capacity_days where fulfillment_date = new.fulfillment_date for update;
  update public.capacity_holds set status = 'expired',updated_at = clock_timestamp()
    where fulfillment_date = new.fulfillment_date and status = 'active'
      and not payment_pending and expires_at <= clock_timestamp();
  select count(*) into adjustments from public.capacity_adjustments
    where fulfillment_date = new.fulfillment_date and status = 'active'
      and (tg_op = 'INSERT' or id <> new.id);
  select count(*) into holds from public.capacity_holds
    where fulfillment_date = new.fulfillment_date and status = 'active'
      and (expires_at > clock_timestamp() or payment_pending);
  if adjustments + holds >= 4 then raise exception 'redelivery_date_full'; end if;
  return new;
end;
$$;

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
  elsif old.status in ('cancelled','discarded') then
    if current_setting('suga_spies.order_refund_id', true) is distinct from old.id::text
      or new.status <> old.status or new.fulfillment_status <> old.fulfillment_status
      or new.payment_status = 'paid' then raise exception 'order_terminal'; end if;
  elsif new.status = 'discarded' then
    if current_setting('suga_spies.redelivery_id', true) is distinct from old.id::text
      or old.status <> 'confirmed' or old.fulfillment_status not in ('delivery_failed','redelivery_out_for_delivery','redelivery_requested')
      or new.fulfillment_status <> 'discarded' or old.payment_status <> 'paid'
      or new.payment_status <> 'refund_pending' then raise exception 'redelivery_discard_not_allowed'; end if;
  else
    if new.payment_status is distinct from old.payment_status then raise exception 'order_payment_state_locked'; end if;
    if new.fulfillment_status = old.fulfillment_status then raise exception 'order_lifecycle_mutation_invalid'; end if;
    if current_setting('suga_spies.order_transition_id', true) = old.id::text then
      if old.status <> 'confirmed' or not (
        (old.fulfillment_status = 'received' and new.fulfillment_status = 'preparing')
        or (old.fulfillment_status = 'preparing' and new.fulfillment_status = 'ready')
        or (old.fulfillment_status = 'ready' and new.fulfillment_status = 'out_for_delivery')
        or (old.fulfillment_status = 'out_for_delivery' and new.fulfillment_status = 'delivered'))
        then raise exception 'order_transition_invalid'; end if;
    elsif current_setting('suga_spies.redelivery_id', true) = old.id::text then
      if old.status <> 'confirmed' or not (
        (old.fulfillment_status = 'out_for_delivery' and new.fulfillment_status = 'delivery_failed')
        or (old.fulfillment_status = 'delivery_failed' and new.fulfillment_status = 'redelivery_requested')
        or (old.fulfillment_status = 'redelivery_requested' and new.fulfillment_status = 'redelivery_scheduled')
        or (old.fulfillment_status = 'redelivery_scheduled' and new.fulfillment_status = 'redelivery_out_for_delivery')
        or (old.fulfillment_status = 'redelivery_out_for_delivery' and new.fulfillment_status = 'delivered'))
        then raise exception 'redelivery_transition_invalid'; end if;
    else raise exception 'use_order_transition_workflow'; end if;
    if new.status is distinct from (case when new.fulfillment_status = 'delivered' then 'completed' else 'confirmed' end)
      then raise exception 'order_lifecycle_mutation_invalid'; end if;
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'order_lifecycle_mutation_invalid';
  end if;
  return new;
end;
$$;

create function private.redelivery_event(p_order public.orders,p_from text,p_to text,
  p_title text,p_message text,p_customer_kind text,p_owner_kind text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e uuid;
begin
  insert into public.order_events(order_id,event_type,from_status,to_status,customer_title,customer_message,
    actor_user_id,idempotency_key)
  values(p_order.id,'redelivery',p_from,p_to,p_title,p_message,(select auth.uid()),gen_random_uuid())
  returning id into e;
  if p_customer_kind is not null then
    insert into public.order_notifications(order_id,payment_attempt_id,order_event_id,kind)
    values(p_order.id,p_order.payment_attempt_id,e,
      case when p_customer_kind = 'customer_redelivery_date_selected'
        then p_customer_kind || ':' || e::text else p_customer_kind end);
  end if;
  if p_owner_kind is not null then
    insert into public.order_notifications(order_id,payment_attempt_id,order_event_id,kind)
    values(p_order.id,p_order.payment_attempt_id,e,p_owner_kind);
  end if;
  return e;
end;
$$;
revoke all on function private.redelivery_event(public.orders,text,text,text,text,text,text)
  from public,anon,authenticated,service_role;

create function private.discard_failed_order(p_order_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; r public.order_redeliveries%rowtype; a public.payment_attempts%rowtype;
  refund_id uuid; decision_time timestamptz := clock_timestamp();
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if not found then raise exception 'redelivery_not_found'; end if;
  if o.status = 'discarded' then
    select id into refund_id from public.order_refunds where order_id = p_order_id;
    return refund_id;
  end if;
  if o.status <> 'confirmed' or o.payment_status <> 'paid'
    or o.fulfillment_status not in ('delivery_failed','redelivery_out_for_delivery','redelivery_requested')
    or not ((o.fulfillment_status = 'delivery_failed' and r.state = 'awaiting_customer'
      and decision_time >= r.respond_by)
      or (o.fulfillment_status = 'redelivery_out_for_delivery' and r.state = 'out_for_delivery')
      or (o.fulfillment_status = 'redelivery_requested' and r.state = 'payment_review'
        and r.payment_status = 'refunded')) then
    raise exception 'redelivery_discard_not_allowed';
  end if;
  select * into strict a from public.payment_attempts where id = o.payment_attempt_id;
  if a.status <> 'paid' or a.stripe_payment_intent_id is null or a.test_only is distinct from o.test_only
    or a.total_cents is distinct from (o.snapshot->>'totalCents')::integer then
    raise exception 'order_payment_unverified';
  end if;
  if r.capacity_adjustment_id is not null then
    perform 1 from public.capacity_days where fulfillment_date = r.selected_date for update;
    perform set_config('suga_spies.redelivery_capacity_id',r.capacity_adjustment_id::text,true);
    update public.capacity_adjustments set status = 'released',released_at = decision_time
      where id = r.capacity_adjustment_id and status = 'active';
    perform set_config('suga_spies.redelivery_capacity_id','',true);
  end if;
  insert into public.order_refunds(order_id,payment_attempt_id,amount_cents,test_only,requested_by,
    actor_user_id,reason,stripe_payment_intent_id)
  values(o.id,a.id,a.total_cents,o.test_only,
    case when (select auth.role()) = 'service_role' then 'system' else 'owner' end,
    (select auth.uid()),p_reason,a.stripe_payment_intent_id)
  returning id into refund_id;
  if r.payment_status = 'paid' then
    if r.stripe_payment_intent_id is null then raise exception 'redelivery_payment_unverified'; end if;
    insert into public.redelivery_fee_refunds(order_id,payment_attempt_id,amount_cents,test_only,
      requested_by,actor_user_id,reason,stripe_payment_intent_id)
    values(o.id,a.id,r.fee_cents,o.test_only,
      case when (select auth.role()) = 'service_role' then 'system' else 'owner' end,
      (select auth.uid()),p_reason,r.stripe_payment_intent_id);
  end if;
  perform set_config('suga_spies.redelivery_id',o.id::text,true);
  update public.orders set status = 'discarded',fulfillment_status = 'discarded',
    payment_status = 'refund_pending',version = version + 1,updated_at = decision_time where id = o.id;
  perform set_config('suga_spies.redelivery_id','',true);
  update public.order_redeliveries set state = 'discarded',
    payment_status = case when r.payment_status = 'paid' then 'refund_pending' else r.payment_status end,
    version = version + 1,updated_at = decision_time where order_id = o.id;
  perform private.redelivery_event(o,o.fulfillment_status,'discarded','Delivery could not be completed',
    'The order was not received and has been closed. A full refund to the original payment method is being processed.',
    'customer_order_discarded',null);
  return refund_id;
end;
$$;
revoke all on function private.discard_failed_order(uuid,text) from public,anon,authenticated,service_role;

create function private.mark_delivery_failed(p_order_id uuid,p_expected_version integer,
  p_fault text,p_reason text)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; failed_time timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active)
    then raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  if p_fault not in ('customer','business') or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500
    then raise exception 'redelivery_invalid'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.version <> p_expected_version then raise exception 'redelivery_conflict'; end if;
  if o.status <> 'confirmed' or o.fulfillment_status <> 'out_for_delivery'
    then raise exception 'redelivery_transition_invalid'; end if;
  insert into public.order_redeliveries(order_id,state,fault,failure_reason,failed_at,respond_by)
  values(o.id,'awaiting_customer',p_fault,btrim(p_reason),failed_time,failed_time + interval '24 hours');
  perform set_config('suga_spies.redelivery_id',o.id::text,true);
  update public.orders set fulfillment_status = 'delivery_failed',version = version + 1,
    updated_at = failed_time where id = o.id;
  perform set_config('suga_spies.redelivery_id','',true);
  perform private.redelivery_event(o,'out_for_delivery','delivery_failed','Delivery attempt missed',
    'We could not complete delivery. Please confirm or correct your address in your order page within 24 hours.',
    'customer_delivery_failed','owner_delivery_failed');
  return true;
end;
$$;
create function public.mark_delivery_failed(p_order_id uuid,p_expected_version integer,p_fault text,p_reason text)
returns boolean language sql security invoker set search_path = '' as $$
  select private.mark_delivery_failed(p_order_id,p_expected_version,p_fault,p_reason);
$$;
revoke all on function private.mark_delivery_failed(uuid,integer,text,text),
  public.mark_delivery_failed(uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function private.mark_delivery_failed(uuid,integer,text,text),
  public.mark_delivery_failed(uuid,integer,text,text) to authenticated;

create function private.request_redelivery(p_order_id uuid,p_expected_version integer,
  p_address jsonb,p_distance_meters integer)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; r public.order_redeliveries%rowtype;
  settings public.delivery_settings%rowtype; fee integer; free text; now_at timestamptz := clock_timestamp();
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if o.id is null or r.order_id is null then raise exception 'order_not_found'; end if;
  if o.version <> p_expected_version then raise exception 'redelivery_conflict'; end if;
  if o.status <> 'confirmed' or o.fulfillment_status <> 'delivery_failed'
    or r.state <> 'awaiting_customer' or now_at >= r.respond_by
    then raise exception 'redelivery_deadline'; end if;
  select * into strict settings from public.delivery_settings where singleton;
  if p_address is null or jsonb_typeof(p_address) <> 'object'
    or p_address->>'country' <> 'CA' or p_address->>'province' <> 'ON'
    or not (p_address->>'city' = any(settings.allowed_cities))
    or char_length(coalesce(p_address->>'line1','')) not between 3 and 160
    or p_distance_meters is null or p_distance_meters < 0
    or p_distance_meters > settings.maximum_distance_meters then
    raise exception 'redelivery_address_invalid'; end if;
  if (o.snapshot->>'deliveryCents')::integer = 0 then
    fee := 0; free := 'original_free';
  elsif r.fault = 'business' then
    fee := 0; free := 'business_fault';
  else
    fee := settings.base_fee_cents + floor(
      (greatest(0,p_distance_meters - settings.base_distance_meters)::numeric
        * settings.extra_km_fee_cents + 500) / 1000)::integer;
  end if;
  update public.order_redeliveries set state = 'awaiting_owner',requested_at = now_at,
    requested_address = p_address,distance_meters = p_distance_meters,
    fee_cents = fee,free_reason = free,
    payment_status = case when fee = 0 then 'not_required' else 'pending' end,
    version = version + 1,updated_at = now_at
    where order_id = p_order_id;
  perform set_config('suga_spies.redelivery_id',o.id::text,true);
  update public.orders set fulfillment_status = 'redelivery_requested',
    version = version + 1,updated_at = now_at where id = o.id;
  perform set_config('suga_spies.redelivery_id','',true);
  perform private.redelivery_event(o,'delivery_failed','redelivery_requested','Redelivery requested',
    'We have your corrected delivery address. The owner will choose a redelivery date.',
    'customer_redelivery_requested','owner_redelivery_requested');
  return true;
end;
$$;
create function public.request_redelivery(p_order_id uuid,p_expected_version integer,
  p_address jsonb,p_distance_meters integer)
returns boolean language sql security invoker set search_path = '' as $$
  select private.request_redelivery(p_order_id,p_expected_version,p_address,p_distance_meters);
$$;
revoke all on function private.request_redelivery(uuid,integer,jsonb,integer),
  public.request_redelivery(uuid,integer,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function private.request_redelivery(uuid,integer,jsonb,integer),
  public.request_redelivery(uuid,integer,jsonb,integer) to service_role;

create function private.redelivery_date_issue(p_date date,p_now timestamptz)
returns text language plpgsql stable security invoker set search_path = '' as $$
declare today date; months integer;
begin
  select (p_now at time zone business_timezone)::date,booking_horizon_months
    into strict today,months from public.fulfillment_settings where singleton;
  if p_date is null or p_date <= today then return 'redelivery_date_past'; end if;
  if p_date > (today + make_interval(months => months))::date then return 'redelivery_date_horizon'; end if;
  if extract(month from p_date) = 12 and extract(day from p_date) = 25
    then return 'redelivery_date_closed'; end if;
  if not exists (select 1 from public.fulfillment_hours where fulfillment_method = 'delivery'
    and iso_weekday = extract(isodow from p_date)::smallint and is_enabled)
    or exists (select 1 from public.fulfillment_blackouts where fulfillment_date = p_date and scope = 'delivery')
    then return 'redelivery_date_closed'; end if;
  return null;
end;
$$;
revoke all on function private.redelivery_date_issue(date,timestamptz)
  from public,anon,authenticated,service_role;

create function private.reserve_redelivery_space(p_order public.orders,p_date date,p_now timestamptz)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare adjustments integer; active_holds integer; cap integer; adjustment uuid;
begin
  if private.redelivery_date_issue(p_date,p_now) is not null then
    raise exception '%',private.redelivery_date_issue(p_date,p_now); end if;
  insert into public.capacity_days(fulfillment_date) values(p_date) on conflict do nothing;
  perform 1 from public.capacity_days where fulfillment_date = p_date for update;
  update public.capacity_holds set status = 'expired',updated_at = p_now
    where fulfillment_date = p_date and status = 'active' and not payment_pending and expires_at <= p_now;
  select count(*) into adjustments from public.capacity_adjustments
    where fulfillment_date = p_date and status = 'active';
  select count(*) into active_holds from public.capacity_holds
    where fulfillment_date = p_date and status = 'active'
      and (expires_at > p_now or payment_pending);
  select daily_capacity into strict cap from public.fulfillment_settings where singleton;
  if adjustments + active_holds >= cap then raise exception 'redelivery_date_full'; end if;
  insert into public.capacity_adjustments(fulfillment_date,source,customer_reference,internal_note)
    values(p_date,'redelivery',p_order.order_number,'Redelivery for paid order') returning id into adjustment;
  return adjustment;
end;
$$;
revoke all on function private.reserve_redelivery_space(public.orders,date,timestamptz)
  from public,anon,authenticated,service_role;

create function private.select_redelivery_date(p_order_id uuid,p_expected_version integer,p_date date)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; r public.order_redeliveries%rowtype; slot uuid;
  now_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active)
    then raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if o.id is null or r.order_id is null then raise exception 'order_not_found'; end if;
  if o.version <> p_expected_version then raise exception 'redelivery_conflict'; end if;
  if o.status <> 'confirmed' or o.fulfillment_status <> 'redelivery_requested'
    or r.state not in ('awaiting_owner','awaiting_payment') or r.payment_status <> 'not_required' and r.payment_status <> 'pending'
    then raise exception 'redelivery_transition_invalid'; end if;
  if r.payment_status = 'pending' and r.stripe_session_id is not null
    then raise exception 'redelivery_payment_in_progress'; end if;
  if private.redelivery_date_issue(p_date,now_at) is not null then
    raise exception '%',private.redelivery_date_issue(p_date,now_at); end if;
  if r.fee_cents = 0 then
    slot := private.reserve_redelivery_space(o,p_date,now_at);
    update public.order_redeliveries set state = 'scheduled',selected_date = p_date,
      capacity_adjustment_id = slot,version = version + 1,updated_at = now_at where order_id = o.id;
    perform set_config('suga_spies.redelivery_id',o.id::text,true);
    update public.orders set fulfillment_status = 'redelivery_scheduled',version = version + 1,
      updated_at = now_at where id = o.id;
    perform set_config('suga_spies.redelivery_id','',true);
    perform private.redelivery_event(o,'redelivery_requested','redelivery_scheduled','Redelivery scheduled',
      'Your complimentary redelivery has been scheduled for ' || p_date::text || '.',
      'customer_redelivery_scheduled',null);
  else
    update public.order_redeliveries set state = 'awaiting_payment',selected_date = p_date,
      version = version + 1,updated_at = now_at where order_id = o.id;
    perform private.redelivery_event(o,'redelivery_requested','redelivery_date_selected','Redelivery date selected',
      'The owner selected ' || p_date::text || '. Pay the additional delivery fee in your order page to confirm the date.',
      'customer_redelivery_date_selected',null);
  end if;
  return true;
end;
$$;
create function public.select_redelivery_date(p_order_id uuid,p_expected_version integer,p_date date)
returns boolean language sql security invoker set search_path = '' as $$
  select private.select_redelivery_date(p_order_id,p_expected_version,p_date);
$$;
revoke all on function private.select_redelivery_date(uuid,integer,date),
  public.select_redelivery_date(uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function private.select_redelivery_date(uuid,integer,date),
  public.select_redelivery_date(uuid,integer,date) to authenticated;

create function private.begin_redelivery_payment(p_order_id uuid,p_expected_version integer)
returns public.order_redeliveries language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; r public.order_redeliveries%rowtype; slot uuid;
  now_at timestamptz := clock_timestamp();
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if o.id is null or r.order_id is null then raise exception 'order_not_found'; end if;
  if r.state = 'awaiting_payment' and r.payment_status = 'pending'
    and r.payment_expires_at > now_at and r.capacity_adjustment_id is not null
    and o.status = 'confirmed' and o.fulfillment_status = 'redelivery_requested' then
    return r;
  end if;
  if o.version <> p_expected_version then raise exception 'redelivery_conflict'; end if;
  if o.status <> 'confirmed' or o.fulfillment_status <> 'redelivery_requested'
    or r.state <> 'awaiting_payment' or r.fee_cents <= 0 or r.selected_date is null
    or r.payment_status not in ('pending','not_required') then
    raise exception 'redelivery_transition_invalid'; end if;
  if r.payment_expires_at is not null then
    if r.payment_expires_at <= now_at then raise exception 'redelivery_payment_expired'; end if;
    return r;
  end if;
  slot := private.reserve_redelivery_space(o,r.selected_date,now_at);
  update public.order_redeliveries set capacity_adjustment_id = slot,
    payment_status = 'pending',payment_expires_at = now_at + interval '15 minutes',
    version = version + 1,updated_at = now_at where order_id = o.id returning * into r;
  return r;
end;
$$;
create function public.begin_redelivery_payment(p_order_id uuid,p_expected_version integer)
returns public.order_redeliveries language sql security invoker set search_path = '' as $$
  select private.begin_redelivery_payment(p_order_id,p_expected_version);
$$;
revoke all on function private.begin_redelivery_payment(uuid,integer),
  public.begin_redelivery_payment(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.begin_redelivery_payment(uuid,integer),
  public.begin_redelivery_payment(uuid,integer) to service_role;

create function private.save_redelivery_session(p_order_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare r public.order_redeliveries%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  perform 1 from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if r.state <> 'awaiting_payment' or r.payment_status <> 'pending'
    or r.stripe_session_id is not null and r.stripe_session_id <> p_session_id
    or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$' then
    raise exception 'redelivery_session_conflict'; end if;
  update public.order_redeliveries set stripe_session_id = p_session_id,
    version = version + 1,updated_at = clock_timestamp() where order_id = p_order_id;
  return true;
end;
$$;
create function public.save_redelivery_session(p_order_id uuid,p_session_id text)
returns boolean language sql security invoker set search_path = '' as $$
  select private.save_redelivery_session(p_order_id,p_session_id);
$$;
revoke all on function private.save_redelivery_session(uuid,text),
  public.save_redelivery_session(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.save_redelivery_session(uuid,text),
  public.save_redelivery_session(uuid,text) to service_role;

-- Settlement is an authenticated server-to-server operation. The caller must
-- first retrieve the current Stripe Session, Intent, Charge and wallet/card
-- details, then pass only that verified outcome into this short transaction.
create function private.resolve_redelivery_payment(p_order_id uuid,p_action text,
  p_session_id text,p_payment_id text default null,p_paid_at timestamptz default null)
returns text language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; r public.order_redeliveries%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  if p_action not in ('paid','expired','late_paid','review') then raise exception 'redelivery_invalid'; end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if o.id is null or r.order_id is null or r.stripe_session_id is distinct from p_session_id
    then raise exception 'redelivery_session_conflict'; end if;
  if r.state = 'scheduled' and r.payment_status = 'paid' and p_action = 'paid' then return 'scheduled'; end if;
  if r.payment_status in ('refund_pending','refunded','needs_review') then return r.state; end if;
  if r.state <> 'awaiting_payment' or r.payment_status <> 'pending' then
    raise exception 'redelivery_transition_invalid'; end if;
  if p_action = 'paid' and p_payment_id is not null and p_paid_at is not null
    and p_paid_at < r.payment_expires_at
    and o.status = 'confirmed' and o.fulfillment_status = 'redelivery_requested' then
    update public.order_redeliveries set state = 'scheduled',payment_status = 'paid',
      stripe_payment_intent_id = p_payment_id,version = version + 1,updated_at = now_at
      where order_id = o.id;
    perform set_config('suga_spies.redelivery_id',o.id::text,true);
    update public.orders set fulfillment_status = 'redelivery_scheduled',
      version = version + 1,updated_at = now_at where id = o.id;
    perform set_config('suga_spies.redelivery_id','',true);
    perform private.redelivery_event(o,'redelivery_requested','redelivery_scheduled','Redelivery scheduled',
      'Your redelivery fee was confirmed. Delivery is scheduled for ' || r.selected_date::text || '.',
      'customer_redelivery_scheduled',null);
    return 'scheduled';
  end if;
  if p_action in ('paid','late_paid') and p_payment_id is not null then
    -- A late charge cannot acquire a spot after its hold expired.
    if r.capacity_adjustment_id is not null then
      perform 1 from public.capacity_days where fulfillment_date = r.selected_date for update;
      perform set_config('suga_spies.redelivery_capacity_id',r.capacity_adjustment_id::text,true);
      update public.capacity_adjustments set status = 'released',released_at = now_at
        where id = r.capacity_adjustment_id and status = 'active';
      perform set_config('suga_spies.redelivery_capacity_id','',true);
    end if;
    insert into public.redelivery_fee_refunds(order_id,payment_attempt_id,amount_cents,test_only,
      requested_by,reason,stripe_payment_intent_id)
      values(o.id,o.payment_attempt_id,r.fee_cents,o.test_only,'system','Late redelivery payment',p_payment_id)
      on conflict (order_id) do nothing;
    update public.order_redeliveries set state = 'payment_review',payment_status = 'refund_pending',
      stripe_payment_intent_id = p_payment_id,version = version + 1,updated_at = now_at where order_id = o.id;
    insert into public.order_notifications(order_id,payment_attempt_id,kind)
      values(o.id,o.payment_attempt_id,'owner_refund_attention')
      on conflict (payment_attempt_id,kind) do nothing;
    return 'refund_pending';
  end if;
  if p_action = 'expired' then
    if r.capacity_adjustment_id is not null then
      perform 1 from public.capacity_days where fulfillment_date = r.selected_date for update;
      perform set_config('suga_spies.redelivery_capacity_id',r.capacity_adjustment_id::text,true);
      update public.capacity_adjustments set status = 'released',released_at = now_at
        where id = r.capacity_adjustment_id and status = 'active';
      perform set_config('suga_spies.redelivery_capacity_id','',true);
    end if;
    update public.order_redeliveries set state = 'awaiting_owner',selected_date = null,
      capacity_adjustment_id = null,payment_expires_at = null,stripe_session_id = null,
      payment_status = 'pending',version = version + 1,updated_at = now_at where order_id = o.id;
    perform private.redelivery_event(o,'redelivery_requested','redelivery_payment_expired',
      'Redelivery payment expired','The redelivery fee was not completed in time. The owner will choose another available date.',
      'customer_redelivery_date_selected',null);
    return 'awaiting_owner';
  end if;
  update public.order_redeliveries set state = 'payment_review',payment_status = 'needs_review',
    version = version + 1,updated_at = now_at where order_id = o.id;
  insert into public.order_notifications(order_id,payment_attempt_id,kind)
    values(o.id,o.payment_attempt_id,'owner_refund_attention')
    on conflict (payment_attempt_id,kind) do nothing;
  return 'payment_review';
end;
$$;
create function public.resolve_redelivery_payment(p_order_id uuid,p_action text,
  p_session_id text,p_payment_id text default null,p_paid_at timestamptz default null)
returns text language sql security invoker set search_path = '' as $$
  select private.resolve_redelivery_payment(p_order_id,p_action,p_session_id,p_payment_id,p_paid_at);
$$;
revoke all on function private.resolve_redelivery_payment(uuid,text,text,text,timestamptz),
  public.resolve_redelivery_payment(uuid,text,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.resolve_redelivery_payment(uuid,text,text,text,timestamptz),
  public.resolve_redelivery_payment(uuid,text,text,text,timestamptz) to service_role;

create function private.expire_unstarted_redelivery_payment(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare r public.order_redeliveries%rowtype; o public.orders%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if r.state <> 'awaiting_payment' or r.payment_status <> 'pending'
    or r.stripe_session_id is not null or r.payment_expires_at > clock_timestamp()
    then return false; end if;
  perform 1 from public.capacity_days where fulfillment_date = r.selected_date for update;
  perform set_config('suga_spies.redelivery_capacity_id',r.capacity_adjustment_id::text,true);
  update public.capacity_adjustments set status = 'released',released_at = clock_timestamp()
    where id = r.capacity_adjustment_id and status = 'active';
  perform set_config('suga_spies.redelivery_capacity_id','',true);
  update public.order_redeliveries set state = 'awaiting_owner',selected_date = null,
    capacity_adjustment_id = null,payment_expires_at = null,version = version + 1,
    updated_at = clock_timestamp() where order_id = p_order_id;
  perform private.redelivery_event(o,'redelivery_requested','redelivery_payment_expired',
    'Redelivery payment expired','The payment reservation ended before payment started. The owner will choose another date.',
    'customer_redelivery_date_selected',null);
  return true;
end;
$$;
create function public.expire_unstarted_redelivery_payment(p_order_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.expire_unstarted_redelivery_payment(p_order_id);
$$;
revoke all on function private.expire_unstarted_redelivery_payment(uuid),
  public.expire_unstarted_redelivery_payment(uuid) from public,anon,authenticated,service_role;
grant execute on function private.expire_unstarted_redelivery_payment(uuid),
  public.expire_unstarted_redelivery_payment(uuid) to service_role;

create function private.mark_redelivery_outcome(p_order_id uuid,p_expected_version integer,p_outcome text)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare o public.orders%rowtype; r public.order_redeliveries%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active)
    then raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  if p_outcome not in ('out_for_delivery','delivered','failed') then raise exception 'redelivery_invalid'; end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into r from public.order_redeliveries where order_id = p_order_id for update;
  if o.id is null or r.order_id is null then raise exception 'order_not_found'; end if;
  if o.version <> p_expected_version then raise exception 'redelivery_conflict'; end if;
  if p_outcome = 'failed' then
    if r.state <> 'out_for_delivery' or o.fulfillment_status <> 'redelivery_out_for_delivery'
      then raise exception 'redelivery_transition_invalid'; end if;
    perform private.discard_failed_order(o.id,'Second delivery attempt failed');
    return true;
  end if;
  if o.status <> 'confirmed' or o.payment_status <> 'paid' or
    not ((p_outcome = 'out_for_delivery' and r.state = 'scheduled'
      and o.fulfillment_status = 'redelivery_scheduled')
      or (p_outcome = 'delivered' and r.state = 'out_for_delivery'
      and o.fulfillment_status = 'redelivery_out_for_delivery')) then
    raise exception 'redelivery_transition_invalid'; end if;
  if p_outcome = 'out_for_delivery' and r.selected_date <> (now_at at time zone 'America/Toronto')::date
    then raise exception 'redelivery_date_not_today'; end if;
  update public.order_redeliveries set state = p_outcome,version = version + 1,
    updated_at = now_at where order_id = o.id;
  perform set_config('suga_spies.redelivery_id',o.id::text,true);
  update public.orders set fulfillment_status = case when p_outcome = 'delivered'
      then 'delivered' else 'redelivery_out_for_delivery' end,
    status = case when p_outcome = 'delivered' then 'completed' else 'confirmed' end,
    version = version + 1,updated_at = now_at where id = o.id;
  perform set_config('suga_spies.redelivery_id','',true);
  if p_outcome = 'delivered' then
    perform private.redelivery_event(o,'redelivery_out_for_delivery','delivered','Delivered',
      'Your pastries have been marked as delivered after redelivery.',
      'customer_delivered',null);
  else
    perform private.redelivery_event(o,'redelivery_scheduled','redelivery_out_for_delivery',
      'Out for redelivery','Your pastries are on their way to the confirmed redelivery address.',
      'customer_redelivery_out_for_delivery',null);
  end if;
  return true;
end;
$$;
create function public.mark_redelivery_outcome(p_order_id uuid,p_expected_version integer,p_outcome text)
returns boolean language sql security invoker set search_path = '' as $$
  select private.mark_redelivery_outcome(p_order_id,p_expected_version,p_outcome);
$$;
revoke all on function private.mark_redelivery_outcome(uuid,integer,text),
  public.mark_redelivery_outcome(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.mark_redelivery_outcome(uuid,integer,text),
  public.mark_redelivery_outcome(uuid,integer,text) to authenticated;

create function private.expire_failed_deliveries(p_limit integer default 4)
returns integer language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare order_to_close uuid; total integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'redelivery_forbidden'; end if;
  for order_to_close in select order_id from public.order_redeliveries
    where state = 'awaiting_customer' and respond_by <= clock_timestamp()
    order by respond_by limit least(greatest(p_limit,1),10)
  loop
    perform private.discard_failed_order(order_to_close,'No redelivery response within 24 hours');
    total := total + 1;
  end loop;
  return total;
end;
$$;
create function public.expire_failed_deliveries(p_limit integer default 4)
returns integer language sql security invoker set search_path = '' as $$
  select private.expire_failed_deliveries(p_limit);
$$;
revoke all on function private.expire_failed_deliveries(integer),
  public.expire_failed_deliveries(integer) from public,anon,authenticated,service_role;
grant execute on function private.expire_failed_deliveries(integer),
  public.expire_failed_deliveries(integer) to service_role;

create or replace function private.resolve_order_refund(p_refund_id uuid,p_lease_id uuid,
  p_status text,p_provider_id text default null,p_failure_code text default null)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare r public.order_refunds%rowtype; target_order uuid; payment_state text;
begin
  select order_id into target_order from public.order_refunds where id = p_refund_id;
  perform 1 from public.orders where id = target_order and status in ('cancelled','discarded') for update;
  if not found then raise exception 'refund_order_invalid'; end if;
  select * into strict r from public.order_refunds where id = p_refund_id for update;
  if r.lease_id is distinct from p_lease_id or p_lease_id is null then return false; end if;
  if p_status is null or p_status not in ('queued','pending','succeeded','failed','needs_review')
    or (p_status in ('pending','succeeded','failed') and coalesce(p_provider_id,r.stripe_refund_id) is null)
    or (r.stripe_refund_id is not null and p_provider_id is not null and r.stripe_refund_id <> p_provider_id)
    or char_length(coalesce(p_failure_code,'')) > 80 then raise exception 'refund_resolution_invalid'; end if;
  update public.order_refunds set status = p_status,
    stripe_refund_id = coalesce(p_provider_id,stripe_refund_id),
    completed_at = case when p_status = 'succeeded' then coalesce(completed_at,clock_timestamp()) else null end,
    updated_at = clock_timestamp(),lease_id = null,lease_until = null,failure_code = p_failure_code,
    next_attempt_at = now() + make_interval(secs => case when p_status = 'queued'
      then least(3600,60 * power(2,least(r.attempts,6))::integer) else 60 end) where id = r.id;
  payment_state := case when p_status = 'succeeded' then 'refunded'
    when p_status in ('failed','needs_review') then 'refund_failed' else 'refund_pending' end;
  if r.status is distinct from p_status or r.stripe_refund_id is distinct from coalesce(p_provider_id,r.stripe_refund_id) then
    insert into public.payment_events(event_id,payment_attempt_id,action)
      values('order-refund:' || r.id::text || ':' || p_lease_id::text,r.payment_attempt_id,'order_refund_' || p_status);
  end if;
  perform set_config('suga_spies.order_refund_id',r.order_id::text,true);
  update public.orders set payment_status = payment_state,version = version + 1,updated_at = clock_timestamp()
    where id = r.order_id and payment_status is distinct from payment_state;
  perform set_config('suga_spies.order_refund_id','',true);
  if p_status in ('failed','needs_review') or (p_status = 'queued' and r.attempts >= 5) then
    insert into public.order_notifications(order_id,payment_attempt_id,kind)
      values(r.order_id,r.payment_attempt_id,'owner_refund_attention')
      on conflict (payment_attempt_id,kind) do nothing;
  end if;
  return true;
end;
$$;

create function private.claim_redelivery_fee_refunds(p_test_only boolean,p_refund_id uuid default null)
returns setof public.redelivery_fee_refunds language sql security definer set search_path = '' as $$
  update public.redelivery_fee_refunds r set lease_id = gen_random_uuid(),
    lease_until = now() + interval '2 minutes',attempts = attempts + 1,
    first_attempt_at = coalesce(first_attempt_at,now())
  where r.id in (select id from public.redelivery_fee_refunds
    where test_only = p_test_only and (lease_until is null or lease_until <= now())
      and next_attempt_at <= now()
      and ((p_refund_id is null and status in ('queued','pending'))
        or (p_refund_id is not null and id = p_refund_id))
    order by next_attempt_at limit 4 for update skip locked) returning r.*;
$$;
create function public.claim_redelivery_fee_refunds(p_test_only boolean,p_refund_id uuid default null)
returns setof public.redelivery_fee_refunds language sql security invoker set search_path = '' as $$
  select * from private.claim_redelivery_fee_refunds(p_test_only,p_refund_id);
$$;
create function private.resolve_redelivery_fee_refund(p_refund_id uuid,p_lease_id uuid,
  p_status text,p_provider_id text default null,p_failure_code text default null)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '5s' as $$
declare r public.redelivery_fee_refunds%rowtype; target_order uuid; rd public.order_redeliveries%rowtype;
begin
  select order_id into target_order from public.redelivery_fee_refunds where id = p_refund_id;
  perform 1 from public.orders where id = target_order for update;
  if not found then raise exception 'refund_order_invalid'; end if;
  select * into rd from public.order_redeliveries where order_id = target_order for update;
  select * into strict r from public.redelivery_fee_refunds where id = p_refund_id for update;
  if r.lease_id is distinct from p_lease_id or p_lease_id is null then return false; end if;
  if rd.payment_status not in ('refund_pending','refunded','needs_review')
    or p_status is null or p_status not in ('queued','pending','succeeded','failed','needs_review')
    or (p_status in ('pending','succeeded','failed') and coalesce(p_provider_id,r.stripe_refund_id) is null)
    or (r.stripe_refund_id is not null and p_provider_id is not null and r.stripe_refund_id <> p_provider_id)
    or char_length(coalesce(p_failure_code,'')) > 80 then raise exception 'refund_resolution_invalid'; end if;
  update public.redelivery_fee_refunds set status = p_status,
    stripe_refund_id = coalesce(p_provider_id,stripe_refund_id),
    completed_at = case when p_status = 'succeeded' then coalesce(completed_at,clock_timestamp()) else null end,
    updated_at = clock_timestamp(),lease_id = null,lease_until = null,failure_code = p_failure_code,
    next_attempt_at = now() + make_interval(secs => case when p_status = 'queued'
      then least(3600,60 * power(2,least(r.attempts,6))::integer) else 60 end) where id = r.id;
  update public.order_redeliveries set payment_status = case when p_status = 'succeeded' then 'refunded'
    when p_status in ('failed','needs_review') then 'needs_review' else 'refund_pending' end,
    version = version + 1,updated_at = clock_timestamp() where order_id = target_order;
  if p_status = 'succeeded' and rd.state = 'payment_review' then
    perform private.discard_failed_order(target_order,'Late redelivery payment was refunded');
  end if;
  if p_status in ('failed','needs_review') or (p_status = 'queued' and r.attempts >= 5) then
    insert into public.order_notifications(order_id,payment_attempt_id,kind)
      values(r.order_id,r.payment_attempt_id,'owner_refund_attention')
      on conflict (payment_attempt_id,kind) do nothing;
  end if;
  return true;
end;
$$;
create function public.resolve_redelivery_fee_refund(p_refund_id uuid,p_lease_id uuid,
  p_status text,p_provider_id text default null,p_failure_code text default null)
returns boolean language sql security invoker set search_path = '' as $$
  select private.resolve_redelivery_fee_refund(p_refund_id,p_lease_id,p_status,p_provider_id,p_failure_code);
$$;
revoke all on function private.claim_redelivery_fee_refunds(boolean,uuid),
  public.claim_redelivery_fee_refunds(boolean,uuid),
  private.resolve_redelivery_fee_refund(uuid,uuid,text,text,text),
  public.resolve_redelivery_fee_refund(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function private.claim_redelivery_fee_refunds(boolean,uuid),
  public.claim_redelivery_fee_refunds(boolean,uuid),
  private.resolve_redelivery_fee_refund(uuid,uuid,text,text,text),
  public.resolve_redelivery_fee_refund(uuid,uuid,text,text,text)
  to service_role;
