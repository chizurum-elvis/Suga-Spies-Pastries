begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table order_tracking_tap(line text);
grant all on order_tracking_tap to anon, authenticated, service_role;
insert into order_tracking_tap select no_plan();

insert into auth.users (id, email)
values
  ('98100000-0000-4000-8000-000000000001', 'tracking-owner@example.com'),
  ('98100000-0000-4000-8000-000000000002', 'tracking-stranger@example.com');
insert into public.admin_users (user_id, role, is_active)
values ('98100000-0000-4000-8000-000000000001', 'owner', true);

create temporary table tracking_fixture(day date, order_id uuid, notification_id uuid);
grant all on tracking_fixture to anon, authenticated, service_role;
insert into tracking_fixture (day, order_id)
values (
  (
    select day::date
    from generate_series(
      (now() at time zone 'America/Toronto')::date + 8,
      (now() at time zone 'America/Toronto')::date + 35,
      interval '1 day'
    ) day
    where not exists (
      select 1 from public.capacity_adjustments
      where fulfillment_date = day::date and status = 'active'
    )
    limit 1
  ),
  '98100000-0000-4000-8000-000000000010'
);

insert into public.checkout_drafts (
  id,
  access_token_hash,
  cart_payload,
  cart_fingerprint,
  cart_validation_snapshot,
  pricing_fingerprint,
  fulfillment_method,
  fulfillment_date,
  status,
  expires_at
)
select
  '98100000-0000-4000-8000-000000000011',
  repeat('a', 64),
  '{"version":1,"lines":[]}'::jsonb,
  repeat('b', 64),
  '{}'::jsonb,
  repeat('c', 64),
  'delivery',
  day,
  'expired',
  now() + interval '1 day'
from tracking_fixture;

insert into public.capacity_holds (
  id,
  checkout_draft_id,
  fulfillment_date,
  idempotency_key,
  status,
  expires_at,
  consumed_at
)
select
  '98100000-0000-4000-8000-000000000012',
  '98100000-0000-4000-8000-000000000011',
  day,
  '98100000-0000-4000-8000-000000000013',
  'consumed',
  now() + interval '15 minutes',
  now()
from tracking_fixture;

insert into public.payment_attempts (
  id,
  checkout_draft_id,
  hold_id,
  access_token_hash,
  review_token,
  snapshot,
  total_cents,
  test_only,
  status,
  expires_at
)
select
  '98100000-0000-4000-8000-000000000014',
  '98100000-0000-4000-8000-000000000011',
  '98100000-0000-4000-8000-000000000012',
  repeat('d', 64),
  repeat('e', 64),
  jsonb_build_object(
    'version', 3,
    'subtotalCents', 1000,
    'deliveryCents', 500,
    'totalCents', 1500,
    'testOnly', true,
    'fulfillmentDate', day::text
  ),
  1500,
  true,
  'paid',
  now() + interval '15 minutes'
from tracking_fixture;

insert into public.capacity_adjustments (
  id,
  fulfillment_date,
  source,
  customer_reference,
  internal_note
)
select
  '98100000-0000-4000-8000-000000000015',
  day,
  'website',
  'tracking-fixture',
  'Order tracking rollback fixture'
from tracking_fixture;

insert into public.orders (
  id,
  payment_attempt_id,
  capacity_adjustment_id,
  fulfillment_date,
  snapshot,
  test_only
)
select
  order_id,
  '98100000-0000-4000-8000-000000000014',
  '98100000-0000-4000-8000-000000000015',
  day,
  (
    select snapshot from public.payment_attempts
    where id = '98100000-0000-4000-8000-000000000014'
  ),
  true
from tracking_fixture;

insert into order_tracking_tap
select is(
  (
    select count(*)::integer from public.order_events
    where order_id = (select order_id from tracking_fixture)
      and from_status is null
      and to_status = 'received'
  ),
  1,
  'a newly confirmed order receives one immutable initial timeline event'
);
insert into order_tracking_tap
select ok(
  not has_table_privilege('anon', 'public.order_events', 'select'),
  'anonymous callers cannot enumerate order events'
);
insert into order_tracking_tap
select ok(
  not has_function_privilege(
    'anon',
    'public.transition_order_fulfillment(uuid,text,text,integer,uuid)',
    'execute'
  ),
  'anonymous callers cannot invoke order transitions'
);

set local role authenticated;
set local request.jwt.claim.sub = '98100000-0000-4000-8000-000000000002';
insert into order_tracking_tap
select is_empty(
  $$select id from public.order_events$$,
  'a signed-in non-owner cannot read order events'
);
insert into order_tracking_tap
select throws_ok(
  $$select * from public.transition_order_fulfillment(
    '98100000-0000-4000-8000-000000000010',
    'received',
    'preparing',
    1,
    '98100000-0000-4000-8000-000000000020'
  )$$,
  '42501',
  'order_transition_forbidden',
  'a non-owner cannot change an order stage'
);

set local request.jwt.claim.sub = '98100000-0000-4000-8000-000000000001';
insert into order_tracking_tap
select results_eq(
  $$select fulfillment_status
    from public.transition_order_fulfillment(
      '98100000-0000-4000-8000-000000000010',
      'received',
      'preparing',
      1,
      '98100000-0000-4000-8000-000000000020'
    )$$,
  array['preparing'],
  'the owner can move an order to its immediate next stage'
);
insert into order_tracking_tap
select is(
  (
    select count(*)::integer from public.order_events
    where order_id = '98100000-0000-4000-8000-000000000010'
      and to_status = 'preparing'
  ),
  1,
  'a stage transition creates one timeline event'
);
insert into order_tracking_tap
select is(
  (
    select count(*)::integer from public.order_notifications
    where order_id = '98100000-0000-4000-8000-000000000010'
      and kind = 'customer_preparing'
  ),
  1,
  'the same transaction queues exactly one matching customer email'
);
insert into order_tracking_tap
select results_eq(
  $$select fulfillment_status
    from public.transition_order_fulfillment(
      '98100000-0000-4000-8000-000000000010',
      'received',
      'preparing',
      1,
      '98100000-0000-4000-8000-000000000020'
    )$$,
  array['preparing'],
  'replaying the same idempotency key returns the completed transition'
);
insert into order_tracking_tap
select is(
  (
    select count(*)::integer from public.order_notifications
    where order_id = '98100000-0000-4000-8000-000000000010'
      and kind = 'customer_preparing'
  ),
  1,
  'an idempotent replay cannot duplicate the customer email'
);
insert into order_tracking_tap
select throws_ok(
  $$select * from public.transition_order_fulfillment(
    '98100000-0000-4000-8000-000000000010',
    'preparing',
    'delivered',
    2,
    '98100000-0000-4000-8000-000000000021'
  )$$,
  'P0001',
  'order_transition_invalid',
  'the owner cannot skip fulfillment stages'
);
insert into order_tracking_tap
select throws_ok(
  $$select * from public.transition_order_fulfillment(
    '98100000-0000-4000-8000-000000000010',
    'received',
    'preparing',
    1,
    '98100000-0000-4000-8000-000000000022'
  )$$,
  'P0001',
  'order_transition_conflict',
  'a stale tab cannot overwrite a newer order version'
);
insert into order_tracking_tap
select throws_ok(
  $$update public.order_events
    set customer_title = 'Forged history'
    where order_id = '98100000-0000-4000-8000-000000000010'$$,
  '42501',
  null,
  'the owner cannot edit timeline history directly'
);

reset role;
set local role service_role;
insert into order_tracking_tap
select throws_ok(
  $$update public.orders
    set fulfillment_status = 'ready', status = 'confirmed',
        version = version + 1, updated_at = now()
    where id = '98100000-0000-4000-8000-000000000010'$$,
  'P0001',
  'use_order_transition_workflow',
  'privileged application code cannot bypass the transition workflow'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '98100000-0000-4000-8000-000000000001';
select * from public.transition_order_fulfillment(
  '98100000-0000-4000-8000-000000000010',
  'preparing',
  'ready',
  2,
  '98100000-0000-4000-8000-000000000023'
);
select * from public.transition_order_fulfillment(
  '98100000-0000-4000-8000-000000000010',
  'ready',
  'out_for_delivery',
  3,
  '98100000-0000-4000-8000-000000000024'
);
select * from public.transition_order_fulfillment(
  '98100000-0000-4000-8000-000000000010',
  'out_for_delivery',
  'delivered',
  4,
  '98100000-0000-4000-8000-000000000025'
);
insert into order_tracking_tap
select results_eq(
  $$select status, fulfillment_status, version
    from public.orders
    where id = '98100000-0000-4000-8000-000000000010'$$,
  $$values ('completed'::text, 'delivered'::text, 5)$$,
  'delivered fulfillment completes the order after every stage'
);
insert into order_tracking_tap
select is(
  (
    select count(*)::integer from public.order_events
    where order_id = '98100000-0000-4000-8000-000000000010'
  ),
  5,
  'the complete order has one immutable event for each stage'
);
insert into order_tracking_tap
select is(
  (
    select count(*)::integer from public.order_notifications
    where order_id = '98100000-0000-4000-8000-000000000010'
      and kind like 'customer\_%' escape '\'
  ),
  4,
  'confirmation is not duplicated and every later stage queues one email'
);

reset role;
create temporary table retry_fixture as
select id
from public.order_notifications
where order_id = '98100000-0000-4000-8000-000000000010'
  and kind = 'customer_delivered';
grant all on retry_fixture to authenticated;
update public.order_notifications
set
  status = 'failed',
  attempts = 12,
  first_attempt_at = now() - interval '1 hour',
  failure_code = 'notification_delivery_failed'
where order_id = '98100000-0000-4000-8000-000000000010'
  and kind = 'customer_delivered';

set local role authenticated;
set local request.jwt.claim.sub = '98100000-0000-4000-8000-000000000001';
insert into order_tracking_tap
select ok(
  public.retry_order_notification(
    '98100000-0000-4000-8000-000000000010',
    (select id from retry_fixture)
  ),
  'the owner can safely requeue a failed email inside the provider window'
);
insert into order_tracking_tap
select results_eq(
  $$select status, attempts, failure_code
    from public.order_notifications
    where id = (select id from retry_fixture)$$,
  $$values ('pending'::text, 0, null::text)$$,
  'a safe retry resets the lease state without changing the order'
);

reset role;
update public.admin_users
set is_active = false
where user_id = '98100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = '98100000-0000-4000-8000-000000000001';
insert into order_tracking_tap
select throws_ok(
  $$select * from public.transition_order_fulfillment(
    '98100000-0000-4000-8000-000000000010',
    'delivered',
    'delivered',
    5,
    '98100000-0000-4000-8000-000000000026'
  )$$,
  '42501',
  'order_transition_forbidden',
  'revoking owner access immediately revokes transition access'
);

reset role;
insert into order_tracking_tap select * from finish();
do $$
begin
  if exists (
    select 1 from order_tracking_tap
    where line like 'not ok%' or line like '# Looks like%'
  ) then
    raise exception 'Order tracking tests failed: %',
      (select string_agg(line, E'\n') from order_tracking_tap);
  end if;
end;
$$;
select line from order_tracking_tap;
rollback;
