-- Paid orders move through one forward-only delivery workflow. The owner-facing
-- mutation, the immutable customer timeline, and the email outbox are committed
-- in one database transaction.

alter table public.orders
  add column updated_at timestamp with time zone not null default now(),
  add column version integer not null default 1;

alter table public.orders
  drop constraint orders_status_check,
  drop constraint orders_fulfillment_status_check,
  add constraint orders_status_check
    check (status in ('confirmed', 'completed')),
  add constraint orders_fulfillment_status_check
    check (
      fulfillment_status in (
        'received',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered'
      )
    ),
  add constraint orders_version_check check (version > 0),
  add constraint orders_completion_check
    check (
      (fulfillment_status = 'delivered' and status = 'completed')
      or
      (fulfillment_status <> 'delivered' and status = 'confirmed')
    );

create index orders_fulfillment_work_queue_idx
  on public.orders (fulfillment_status, fulfillment_date, id)
  where status = 'confirmed';

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  event_type text not null default 'fulfillment_status',
  from_status text,
  to_status text not null,
  customer_title text not null,
  customer_message text not null,
  customer_visible boolean not null default true,
  actor_user_id uuid references auth.users (id) on delete set null,
  idempotency_key uuid not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone not null default now(),
  constraint order_events_type_check
    check (event_type = 'fulfillment_status'),
  constraint order_events_from_status_check
    check (
      from_status is null
      or from_status in (
        'received',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered'
      )
    ),
  constraint order_events_to_status_check
    check (
      to_status in (
        'received',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered'
      )
    ),
  constraint order_events_transition_check
    check (
      (from_status is null and to_status = 'received')
      or (from_status = 'received' and to_status = 'preparing')
      or (from_status = 'preparing' and to_status = 'ready')
      or (from_status = 'ready' and to_status = 'out_for_delivery')
      or (from_status = 'out_for_delivery' and to_status = 'delivered')
    ),
  constraint order_events_customer_title_check
    check (
      customer_title = btrim(customer_title)
      and char_length(customer_title) between 2 and 80
    ),
  constraint order_events_customer_message_check
    check (
      customer_message = btrim(customer_message)
      and char_length(customer_message) between 2 and 300
    ),
  constraint order_events_metadata_check check (jsonb_typeof(metadata) = 'object'),
  unique (order_id, to_status)
);

create index order_events_order_timeline_idx
  on public.order_events (order_id, occurred_at, id);
create index order_events_actor_idx
  on public.order_events (actor_user_id)
  where actor_user_id is not null;

comment on table public.order_events is
  'Append-only order timeline. Customers receive only explicitly customer-visible presentation fields.';
comment on column public.order_events.metadata is
  'Private operational metadata. It is never returned by the guest-order API.';

alter table public.order_events enable row level security;
alter table public.order_events force row level security;
revoke all on table public.order_events from public, anon, authenticated, service_role;
grant select, insert on table public.order_events to service_role;
grant select on table public.order_events to authenticated;

create policy order_events_owner_read
on public.order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
      and admin_users.role = 'owner'
      and admin_users.is_active
  )
);

alter table public.order_notifications
  drop constraint order_notifications_kind_check,
  add column order_event_id uuid unique
    references public.order_events (id) on delete restrict,
  add constraint order_notifications_kind_check
    check (
      kind in (
        'customer_confirmation',
        'customer_preparing',
        'customer_ready',
        'customer_out_for_delivery',
        'customer_delivered',
        'owner_order',
        'owner_exception'
      )
    ),
  add constraint order_notifications_event_check
    check (
      (kind like 'customer\_%' escape '\' and kind <> 'customer_confirmation'
        and order_event_id is not null)
      or
      (kind in ('customer_confirmation', 'owner_order', 'owner_exception')
        and order_event_id is null)
    );

-- Every order, including future non-website orders, begins with a truthful
-- received event. The existing confirmation email remains the single email for
-- payment received + order confirmed.
create function private.create_initial_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (
    order_id,
    from_status,
    to_status,
    customer_title,
    customer_message,
    idempotency_key
  )
  values (
    new.id,
    null,
    'received',
    'Order received',
    'Your payment was confirmed and your pastry delivery is booked.',
    gen_random_uuid()
  );
  return new;
end;
$$;

revoke all on function private.create_initial_order_event()
  from public, anon, authenticated;

create trigger orders_create_initial_event
after insert on public.orders
for each row execute function private.create_initial_order_event();

insert into public.order_events (
  order_id,
  from_status,
  to_status,
  customer_title,
  customer_message,
  idempotency_key,
  occurred_at
)
select
  orders.id,
  null,
  'received',
  'Order received',
  'Your payment was confirmed and your pastry delivery is booked.',
  gen_random_uuid(),
  orders.created_at
from public.orders
on conflict (order_id, to_status) do nothing;

-- Defense in depth: even privileged application code cannot skip or reverse a
-- fulfilment stage without replacing this audited lifecycle rule in a migration.
create function private.enforce_order_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.order_number,
    new.payment_attempt_id,
    new.capacity_adjustment_id,
    new.fulfillment_date,
    new.snapshot,
    new.test_only,
    new.created_at
  ) is distinct from row(
    old.id,
    old.order_number,
    old.payment_attempt_id,
    old.capacity_adjustment_id,
    old.fulfillment_date,
    old.snapshot,
    old.test_only,
    old.created_at
  ) then
    raise exception 'order_history_is_immutable';
  end if;

  if new.payment_status is distinct from old.payment_status then
    raise exception 'order_payment_state_locked';
  end if;

  if new.fulfillment_status is not distinct from old.fulfillment_status then
    if new.status is distinct from old.status
      or new.version is distinct from old.version
      or new.updated_at is distinct from old.updated_at then
      raise exception 'order_lifecycle_mutation_invalid';
    end if;
    return new;
  end if;

  if current_setting('suga_spies.order_transition_id', true)
    is distinct from old.id::text then
    raise exception 'use_order_transition_workflow';
  end if;

  if not (
    (old.fulfillment_status = 'received' and new.fulfillment_status = 'preparing')
    or (old.fulfillment_status = 'preparing' and new.fulfillment_status = 'ready')
    or (old.fulfillment_status = 'ready' and new.fulfillment_status = 'out_for_delivery')
    or (old.fulfillment_status = 'out_for_delivery' and new.fulfillment_status = 'delivered')
  ) then
    raise exception 'order_transition_invalid';
  end if;

  if new.status is distinct from (case
      when new.fulfillment_status = 'delivered' then 'completed'
      else 'confirmed'
    end)
    or new.version is distinct from old.version + 1
    or new.updated_at < old.updated_at then
    raise exception 'order_lifecycle_mutation_invalid';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_order_lifecycle()
  from public, anon, authenticated;

create trigger orders_enforce_lifecycle
before update on public.orders
for each row execute function private.enforce_order_lifecycle();

-- Kept in the unexposed private schema so the public RPC remains SECURITY
-- INVOKER. Authorization is repeated beside the mutation and does not trust
-- user-editable metadata.
create function private.transition_order_fulfillment(
  p_order_id uuid,
  p_expected_status text,
  p_next_status text,
  p_expected_version integer,
  p_idempotency_key uuid
)
returns table (
  order_id uuid,
  fulfillment_status text,
  order_status text,
  order_version integer,
  order_updated_at timestamp with time zone,
  event_id uuid
)
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  actor_id uuid := (select auth.uid());
  current_order public.orders%rowtype;
  existing_event public.order_events%rowtype;
  created_event_id uuid;
  customer_title text;
  customer_message text;
  notification_kind text;
begin
  if actor_id is null or not exists (
    select 1
    from public.admin_users
    where admin_users.user_id = actor_id
      and admin_users.role = 'owner'
      and admin_users.is_active
  ) then
    raise exception using
      errcode = '42501',
      message = 'order_transition_forbidden';
  end if;

  if p_idempotency_key is null
    or p_expected_version is null
    or p_expected_version < 1
    or p_expected_status is null
    or p_next_status is null then
    raise exception 'order_transition_invalid';
  end if;

  select * into existing_event
  from public.order_events
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_event.order_id is distinct from p_order_id
      or existing_event.to_status is distinct from p_next_status then
      raise exception 'order_idempotency_conflict';
    end if;

    select * into strict current_order
    from public.orders
    where id = p_order_id;

    return query
    select
      current_order.id,
      current_order.fulfillment_status,
      current_order.status,
      current_order.version,
      current_order.updated_at,
      existing_event.id;
    return;
  end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if current_order.version is distinct from p_expected_version
    or current_order.fulfillment_status is distinct from p_expected_status then
    raise exception 'order_transition_conflict';
  end if;

  if not (
    (p_expected_status = 'received' and p_next_status = 'preparing')
    or (p_expected_status = 'preparing' and p_next_status = 'ready')
    or (p_expected_status = 'ready' and p_next_status = 'out_for_delivery')
    or (p_expected_status = 'out_for_delivery' and p_next_status = 'delivered')
  ) then
    raise exception 'order_transition_invalid';
  end if;

  select
    case p_next_status
      when 'preparing' then 'Being prepared'
      when 'ready' then 'Ready for delivery'
      when 'out_for_delivery' then 'Out for delivery'
      when 'delivered' then 'Delivered'
    end,
    case p_next_status
      when 'preparing' then 'We have started preparing your pastries.'
      when 'ready' then 'Your pastries are ready for delivery.'
      when 'out_for_delivery' then 'Your order is on its way.'
      when 'delivered' then 'Your order has been marked as delivered.'
    end,
    case p_next_status
      when 'preparing' then 'customer_preparing'
      when 'ready' then 'customer_ready'
      when 'out_for_delivery' then 'customer_out_for_delivery'
      when 'delivered' then 'customer_delivered'
    end
  into customer_title, customer_message, notification_kind;

  perform set_config(
    'suga_spies.order_transition_id',
    current_order.id::text,
    true
  );

  update public.orders
  set
    fulfillment_status = p_next_status,
    status = case
      when p_next_status = 'delivered' then 'completed'
      else 'confirmed'
    end,
    version = version + 1,
    updated_at = now()
  where id = current_order.id
  returning * into current_order;

  insert into public.order_events (
    order_id,
    from_status,
    to_status,
    customer_title,
    customer_message,
    actor_user_id,
    idempotency_key
  )
  values (
    current_order.id,
    p_expected_status,
    p_next_status,
    customer_title,
    customer_message,
    actor_id,
    p_idempotency_key
  )
  returning id into created_event_id;

  insert into public.order_notifications (
    order_id,
    payment_attempt_id,
    order_event_id,
    kind
  )
  values (
    current_order.id,
    current_order.payment_attempt_id,
    created_event_id,
    notification_kind
  );

  perform set_config('suga_spies.order_transition_id', '', true);

  return query
  select
    current_order.id,
    current_order.fulfillment_status,
    current_order.status,
    current_order.version,
    current_order.updated_at,
    created_event_id;
end;
$$;

create function public.transition_order_fulfillment(
  p_order_id uuid,
  p_expected_status text,
  p_next_status text,
  p_expected_version integer,
  p_idempotency_key uuid
)
returns table (
  order_id uuid,
  fulfillment_status text,
  order_status text,
  order_version integer,
  order_updated_at timestamp with time zone,
  event_id uuid
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.transition_order_fulfillment(
    p_order_id,
    p_expected_status,
    p_next_status,
    p_expected_version,
    p_idempotency_key
  );
$$;

revoke all on function private.transition_order_fulfillment(
  uuid, text, text, integer, uuid
) from public, anon, authenticated;
revoke all on function public.transition_order_fulfillment(
  uuid, text, text, integer, uuid
) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.transition_order_fulfillment(
  uuid, text, text, integer, uuid
) to authenticated;
grant execute on function public.transition_order_fulfillment(
  uuid, text, text, integer, uuid
) to authenticated;

create function private.retry_order_notification(
  p_order_id uuid,
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  notification public.order_notifications%rowtype;
begin
  if actor_id is null or not exists (
    select 1
    from public.admin_users
    where admin_users.user_id = actor_id
      and admin_users.role = 'owner'
      and admin_users.is_active
  ) then
    raise exception using
      errcode = '42501',
      message = 'notification_retry_forbidden';
  end if;

  select * into notification
  from public.order_notifications
  where id = p_notification_id
    and order_id = p_order_id
  for update;

  if not found or notification.status <> 'failed' then
    raise exception 'notification_not_retryable';
  end if;

  if notification.first_attempt_at is null
    or notification.first_attempt_at <= now() - interval '23 hours' then
    raise exception 'notification_retry_window_expired';
  end if;

  update public.order_notifications
  set
    status = 'pending',
    attempts = 0,
    lease_id = null,
    next_attempt_at = now(),
    failure_code = null
  where id = notification.id;

  return true;
end;
$$;

create function public.retry_order_notification(
  p_order_id uuid,
  p_notification_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.retry_order_notification(p_order_id, p_notification_id);
$$;

revoke all on function private.retry_order_notification(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.retry_order_notification(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.retry_order_notification(uuid, uuid)
  to authenticated;
grant execute on function public.retry_order_notification(uuid, uuid)
  to authenticated;
