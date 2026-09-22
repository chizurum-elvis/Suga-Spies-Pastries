begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

set local role service_role;

select is(
  (select minimum_notice_days from public.fulfillment_settings where singleton),
  4::smallint,
  'fulfillment requires four Toronto calendar days of notice'
);

create temporary table fulfillment_test_context as
select
  timestamp with time zone '2099-01-01 12:00:00+00' as evaluated_at,
  (
    date '2099-01-01'
    + ((1 - extract(isodow from date '2099-01-01')::integer + 7) % 7)
    + 7
  )::date as open_date,
  (
    date '2099-01-01'
    + ((2 - extract(isodow from date '2099-01-01')::integer + 7) % 7)
    + 7
  )::date as tuesday_date,
  (
    date '2099-01-01'
    + ((3 - extract(isodow from date '2099-01-01')::integer + 7) % 7)
    + 7
  )::date as closed_date;

insert into public.checkout_drafts (
  id,
  access_token_hash,
  cart_payload,
  cart_fingerprint,
  cart_validation_snapshot,
  pricing_fingerprint,
  fulfillment_method,
  fulfillment_date,
  expires_at
)
select
  draft_id,
  repeat(token_character, 64),
  '{"version":1,"lines":[]}'::jsonb,
  repeat(cart_character, 64),
  '{"subtotalCents":0,"lines":[]}'::jsonb,
  repeat(price_character, 64),
  'delivery',
  context.open_date,
  context.evaluated_at + interval '30 days'
from fulfillment_test_context as context
cross join (
  values
    ('93000000-0000-4000-8000-000000000001'::uuid, 'a', 'b', 'c'),
    ('93000000-0000-4000-8000-000000000002'::uuid, 'd', 'e', 'f')
) as drafts(draft_id, token_character, cart_character, price_character);

insert into public.checkout_drafts (
  id,
  access_token_hash,
  cart_payload,
  cart_fingerprint,
  cart_validation_snapshot,
  pricing_fingerprint,
  fulfillment_method,
  fulfillment_date,
  expires_at
)
select
  '93000000-0000-4000-8000-000000000003',
  repeat('1', 64),
  '{"version":1,"lines":[]}'::jsonb,
  repeat('2', 64),
  '{"subtotalCents":0,"lines":[]}'::jsonb,
  repeat('3', 64),
  'delivery',
  context.closed_date,
  context.evaluated_at + interval '30 days'
from fulfillment_test_context as context;

select lives_ok(
  format(
    'insert into public.capacity_adjustments (fulfillment_date, source) select open_date, source from fulfillment_test_context cross join (values (''phone''), (''instagram''), (''admin'')) as sources(source)'
  ),
  'three external orders can consume three of the four daily spaces'
);

select results_eq(
  $$select count(*)::integer from public.reserve_fulfillment_capacity(
    '93000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000001',
    (select evaluated_at from fulfillment_test_context)
  )$$,
  array[1],
  'the fourth and final order receives a payment-stage hold'
);

select results_eq(
  $$select hold_id from public.reserve_fulfillment_capacity(
    '93000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000001',
    (select evaluated_at from fulfillment_test_context)
  )$$,
  $$select id from public.capacity_holds where idempotency_key = '94000000-0000-4000-8000-000000000001'$$,
  'repeating the same reservation key returns the original hold'
);

select results_eq(
  $$select count(*)::integer from public.capacity_holds where status = 'active'$$,
  array[1],
  'idempotent retries do not consume another daily space'
);

select throws_ok(
  $$select * from public.reserve_fulfillment_capacity(
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000002',
    (select evaluated_at from fulfillment_test_context)
  )$$,
  'P0001',
  'The fulfillment date has reached its four-order capacity.',
  'a fifth website order cannot pass the hard capacity limit'
);

select throws_ok(
  $$insert into public.capacity_adjustments (fulfillment_date, source) select open_date, 'other' from fulfillment_test_context$$,
  'P0001',
  'The fulfillment date has reached its four-order capacity.',
  'an external order cannot bypass the shared four-order limit'
);

update public.capacity_holds
set
  created_at = (select evaluated_at - interval '20 minutes' from fulfillment_test_context),
  expires_at = (select evaluated_at - interval '1 minute' from fulfillment_test_context)
where idempotency_key = '94000000-0000-4000-8000-000000000001';

select results_eq(
  $$select count(*)::integer from public.reserve_fulfillment_capacity(
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000002',
    (select evaluated_at from fulfillment_test_context)
  )$$,
  array[1],
  'an expired hold releases its space for another checkout'
);

select results_eq(
  $$select status from public.capacity_holds where idempotency_key = '94000000-0000-4000-8000-000000000001'$$,
  array['expired'],
  'the stale hold is marked expired during the atomic reservation'
);

select results_eq(
  $$select count(*)::integer from public.capacity_holds where status = 'active'$$,
  array[1],
  'only the replacement payment hold remains active'
);

select throws_ok(
  $$select * from public.reserve_fulfillment_capacity(
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000003',
    (select evaluated_at from fulfillment_test_context)
  )$$,
  'P0001',
  'The selected delivery date is no longer available.',
  'server validation rejects a closed weekday without accepting a time'
);

insert into public.fulfillment_blackouts (fulfillment_date, scope, public_reason)
select open_date, 'delivery', 'Private event'
from fulfillment_test_context;

select results_eq(
  $$select
      (select count(*) from public.capacity_adjustments where status = 'active')::integer
      +
      (select count(*) from public.capacity_holds where status = 'active')::integer$$,
  array[4],
  'adding a blackout leaves existing orders and active payment holds intact'
);

select * from finish();
rollback;
