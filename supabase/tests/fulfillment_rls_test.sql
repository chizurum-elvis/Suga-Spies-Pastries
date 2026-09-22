begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'owner@example.com'),
  ('90000000-0000-4000-8000-000000000002', 'stranger@example.com');
insert into public.admin_users (user_id, role, is_active)
values ('90000000-0000-4000-8000-000000000001', 'owner', true);

select ok(
  not has_table_privilege('anon', 'public.fulfillment_settings', 'select'),
  'anonymous visitors have no direct access to private scheduling settings'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reserve_fulfillment_capacity(uuid,uuid,timestamp with time zone)',
    'execute'
  ),
  'anonymous visitors cannot invoke the final capacity reservation function'
);

set local role anon;
select throws_ok(
  $$select singleton from public.fulfillment_settings$$,
  '42501',
  null,
  'anonymous visitors cannot read scheduling tables directly'
);
select throws_ok(
  $$select * from public.reserve_fulfillment_capacity('93000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'anonymous visitors cannot reserve capacity directly'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select is_empty(
  $$select singleton from public.fulfillment_settings$$,
  'a signed-in non-owner cannot read scheduling settings'
);
select is_empty(
  $$select id from public.checkout_drafts$$,
  'a signed-in non-owner cannot enumerate guest checkout drafts'
);
select throws_ok(
  $$insert into public.fulfillment_blackouts (fulfillment_date, created_by) values (date '2099-01-12', '90000000-0000-4000-8000-000000000002')$$,
  '42501',
  null,
  'a signed-in non-owner cannot create a blackout'
);

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
select results_eq(
  $$select business_timezone from public.fulfillment_settings$$,
  array['America/Toronto'],
  'the active owner can read the scheduling source of truth'
);
select results_eq(
  $$insert into public.fulfillment_blackouts (fulfillment_date, public_reason, created_by) values (date '2099-01-12', 'Private event', '90000000-0000-4000-8000-000000000001') returning public_reason$$,
  array['Private event'],
  'the owner can create a customer-safe blackout'
);
select results_eq(
  $$update public.fulfillment_blackouts set public_reason = 'Fully booked' where fulfillment_date = date '2099-01-12' returning version$$,
  array[2],
  'a blackout update advances its optimistic version'
);
select results_eq(
  $$insert into public.capacity_adjustments (fulfillment_date, source, created_by) values (date '2099-01-12', 'phone', '90000000-0000-4000-8000-000000000001') returning source$$,
  array['phone'],
  'the owner can record an external order against capacity'
);
select isnt_empty(
  $$select id from public.fulfillment_audit_events where actor_user_id = '90000000-0000-4000-8000-000000000001'$$,
  'owner scheduling changes create an attributable audit trail'
);
select throws_ok(
  $$insert into public.fulfillment_audit_events (entity_table, entity_id, action, after_data) values ('fulfillment_blackouts', '93000000-0000-4000-8000-000000000001', 'insert', '{}'::jsonb)$$,
  '42501',
  null,
  'the owner cannot forge audit history'
);
select throws_ok(
  $$insert into public.capacity_holds (checkout_draft_id, fulfillment_date, idempotency_key, expires_at) values ('93000000-0000-4000-8000-000000000001', date '2099-01-12', '94000000-0000-4000-8000-000000000001', now() + interval '15 minutes')$$,
  '42501',
  null,
  'the owner browser session cannot create a payment hold directly'
);

select * from finish();
rollback;
