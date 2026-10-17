begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table redelivery_tap(line text);
grant all on redelivery_tap to anon, authenticated, service_role;
insert into redelivery_tap select no_plan();

insert into auth.users(id,email) values
  ('98300000-0000-4000-8000-000000000001','redelivery-owner@example.com'),
  ('98300000-0000-4000-8000-000000000002','redelivery-stranger@example.com');
insert into public.admin_users(user_id,role,is_active)
  values('98300000-0000-4000-8000-000000000001','owner',true);

create temporary table redelivery_fixture(name text primary key,id uuid);
grant all on redelivery_fixture to authenticated,service_role;
create temporary table redelivery_dates(name text primary key,day date);
grant select on redelivery_dates to authenticated,service_role;
insert into redelivery_dates
select 'first',d from generate_series(
  (now() at time zone 'America/Toronto')::date+1,
  (now() at time zone 'America/Toronto')::date+12,'1 day'::interval) d
where extract(isodow from d) not in (3,7)
  and not (extract(month from d)=12 and extract(day from d)=25)
limit 1;
insert into redelivery_dates
select 'second',d from generate_series(
  (select day from redelivery_dates where name='first')+1,
  (select day from redelivery_dates where name='first')+12,'1 day'::interval) d
where extract(isodow from d) not in (3,7)
  and not (extract(month from d)=12 and extract(day from d)=25)
limit 1;

create function pg_temp.redelivery_fixture(p_name text,p_delivery_cents integer default 500)
returns uuid language plpgsql as $$
declare d uuid := gen_random_uuid(); h uuid := gen_random_uuid(); a uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); o uuid := gen_random_uuid(); day date;
  s jsonb; existing integer;
begin
  select count(*) into existing from redelivery_fixture;
  day := (now() at time zone 'America/Toronto')::date-1-existing;
  s := jsonb_build_object('version',3,'subtotalCents',1000,'deliveryCents',p_delivery_cents,
    'totalCents',1000+p_delivery_cents,'testOnly',true,'fulfillmentDate',day::text);
  insert into public.checkout_drafts(id,access_token_hash,cart_payload,cart_fingerprint,
    cart_validation_snapshot,pricing_fingerprint,fulfillment_method,fulfillment_date,status,expires_at)
    values(d,encode(extensions.digest(d::text,'sha256'),'hex'),'{"version":1,"lines":[]}',
      repeat('b',64),'{}',repeat('c',64),'delivery',day,'expired',now()+interval '1 day');
  insert into public.capacity_holds(id,checkout_draft_id,fulfillment_date,idempotency_key,
    status,expires_at,consumed_at)
    values(h,d,day,gen_random_uuid(),'consumed',now()+interval '15 minutes',now());
  insert into public.payment_attempts(id,checkout_draft_id,hold_id,access_token_hash,review_token,
    snapshot,total_cents,test_only,status,stripe_payment_intent_id,expires_at)
    values(a,d,h,repeat('d',64),repeat('e',64),s,1000+p_delivery_cents,true,'paid',
      'pi_redelivery_'||replace(a::text,'-',''),now()+interval '15 minutes');
  insert into public.capacity_adjustments(id,fulfillment_date,source)
    values(c,day,'website');
  insert into public.orders(id,payment_attempt_id,capacity_adjustment_id,fulfillment_date,snapshot,test_only)
    values(o,a,c,day,s,true);
  insert into redelivery_fixture(name,id) values(p_name,o);
  return o;
end;
$$;
select pg_temp.redelivery_fixture('ordinary');
select pg_temp.redelivery_fixture('free',0);
select pg_temp.redelivery_fixture('business');
select pg_temp.redelivery_fixture('deadline');
select pg_temp.redelivery_fixture('second_fail');
select pg_temp.redelivery_fixture('payment_expiry');
select pg_temp.redelivery_fixture('late_charge');

insert into redelivery_tap select ok(not has_table_privilege('anon','public.order_redeliveries','select'),
  'guests cannot enumerate redelivery addresses');
insert into redelivery_tap select ok(not has_table_privilege('authenticated','public.order_redeliveries','update'),
  'owner cannot directly mutate redelivery state');
insert into redelivery_tap select ok(not has_table_privilege('service_role','public.order_redeliveries','update'),
  'service code uses fenced mutation RPCs');
insert into redelivery_tap select ok(not has_function_privilege('anon','public.request_redelivery(uuid,integer,jsonb,integer)','execute'),
  'anonymous database clients cannot submit guessed orders');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98300000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into redelivery_tap select throws_ok($q$select public.mark_delivery_failed(
  (select id from redelivery_fixture where name='ordinary'),1,'customer','No answer')$q$,
  '42501','redelivery_forbidden','non-owner cannot claim a delivery failed');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare o uuid; begin
  for o in select id from redelivery_fixture loop
    perform public.transition_order_fulfillment(o,'received','preparing',1,gen_random_uuid());
    perform public.transition_order_fulfillment(o,'preparing','ready',2,gen_random_uuid());
    perform public.transition_order_fulfillment(o,'ready','out_for_delivery',3,gen_random_uuid());
  end loop;
end; $$;
insert into redelivery_tap select throws_ok($q$select public.mark_delivery_failed(
  (select id from redelivery_fixture where name='ordinary'),3,'customer','No answer')$q$,
  'P0001','redelivery_conflict','stale owner version cannot mark a failed attempt');
do $$ declare o uuid; begin
  for o in select id from redelivery_fixture loop
    perform public.mark_delivery_failed(o,4,
      case when o=(select id from redelivery_fixture where name='business') then 'business' else 'customer' end,
      'Recipient did not receive the pastries');
  end loop;
end; $$;
insert into redelivery_tap select is((select fulfillment_status from public.orders
  where id=(select id from redelivery_fixture where name='ordinary')),'delivery_failed',
  'failed delivery becomes a distinct fulfillment stage');
insert into redelivery_tap select is((select respond_by-failed_at from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='ordinary')),interval '24 hours',
  'customer response window is exactly 24 elapsed hours');
insert into redelivery_tap select is((select count(*)::integer from public.order_notifications
  where order_id=(select id from redelivery_fixture where name='ordinary') and kind='customer_delivery_failed'),1,
  'failure queues one customer email');
reset role;

update public.order_redeliveries set failed_at=now()-interval '25 hours',respond_by=now()-interval '1 hour'
  where order_id=(select id from redelivery_fixture where name='deadline');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into redelivery_tap select throws_ok($q$select public.request_redelivery(
  (select id from redelivery_fixture where name='deadline'),5,
  '{"line1":"100 Queen Street West","line2":"","city":"Toronto","province":"ON","postalCode":"M5H 2N1","country":"CA"}',3000)$q$,
  'P0001','redelivery_deadline','a response after 24 hours is rejected in the database');
insert into redelivery_tap select is(public.expire_failed_deliveries(4),1,
  'the worker closes the expired unanswered order');
insert into redelivery_tap select is((select status from public.orders where id=(select id from redelivery_fixture where name='deadline')),
  'discarded','unanswered order is terminally closed');
insert into redelivery_tap select is((select amount_cents from public.order_refunds
  where order_id=(select id from redelivery_fixture where name='deadline')),1500,
  'unanswered order queues the full original payment refund');
insert into redelivery_tap select is((select count(*)::integer from public.redelivery_fee_refunds
  where order_id=(select id from redelivery_fixture where name='deadline')),0,
  'no fee refund is invented when no redelivery fee was paid');

insert into redelivery_tap select throws_ok($q$select public.request_redelivery(
  (select id from redelivery_fixture where name='ordinary'),5,
  '{"line1":"100 Queen Street West","line2":"","city":"Ottawa","province":"ON","postalCode":"M5H 2N1","country":"CA"}',3000)$q$,
  'P0001','redelivery_address_invalid','outside-city address is rejected');
do $$ declare o uuid; begin
  for o in select id from redelivery_fixture where name <> 'deadline' loop
    perform public.request_redelivery(o,5,
      '{"line1":"100 Queen Street West","line2":"","city":"Toronto","province":"ON","postalCode":"M5H 2N1","country":"CA"}',3000);
  end loop;
end; $$;
insert into redelivery_tap select is((select fee_cents from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='ordinary')),500,
  'paid original delivery incurs configured redelivery fee');
insert into redelivery_tap select is((select fee_cents from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='free')),0,
  'free original delivery stays free');
insert into redelivery_tap select is((select free_reason from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='business')),'business_fault',
  'business fault waives new delivery fee');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into redelivery_tap select throws_ok($q$select public.select_redelivery_date(
  (select id from redelivery_fixture where name='ordinary'),6,
  (now() at time zone 'America/Toronto')::date)$q$,
  'P0001','redelivery_date_past','owner cannot schedule for today or before');
select public.select_redelivery_date((select id from redelivery_fixture where name='ordinary'),6,
  (select day from redelivery_dates where name='first'));
select public.select_redelivery_date((select id from redelivery_fixture where name='free'),6,
  (select day from redelivery_dates where name='first'));
select public.select_redelivery_date((select id from redelivery_fixture where name='business'),6,
  (select day from redelivery_dates where name='second'));
select public.select_redelivery_date((select id from redelivery_fixture where name='second_fail'),6,
  (select day from redelivery_dates where name='first'));
select public.select_redelivery_date((select id from redelivery_fixture where name='payment_expiry'),6,
  (select day from redelivery_dates where name='second'));
select public.select_redelivery_date((select id from redelivery_fixture where name='late_charge'),6,
  (select day from redelivery_dates where name='second'));
insert into redelivery_tap select is((select status from public.capacity_adjustments
  where id=(select capacity_adjustment_id from public.order_redeliveries
    where order_id=(select id from redelivery_fixture where name='free'))),'active',
  'complimentary redelivery immediately consumes a daily capacity space');
insert into redelivery_tap select is((select capacity_adjustment_id from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='ordinary')),null::uuid,
  'unpaid date choice does not reserve capacity');
reset role;

insert into public.capacity_adjustments(fulfillment_date,source,customer_reference)
  select day,'phone','redelivery-capacity-test' from redelivery_dates
  cross join generate_series(1,3) where name='second';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into redelivery_tap select throws_ok($q$select public.begin_redelivery_payment(
  (select id from redelivery_fixture where name='payment_expiry'),6)$q$,
  'P0001','redelivery_date_full','fee checkout cannot take a fifth daily space');
insert into redelivery_tap select is((select capacity_adjustment_id from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='payment_expiry')),null::uuid,
  'capacity conflict leaves no half-created payment hold');
reset role;
update public.capacity_adjustments set status='released',released_at=now()
  where customer_reference='redelivery-capacity-test';

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.begin_redelivery_payment((select id from redelivery_fixture where name='ordinary'),6);
insert into redelivery_tap select is((select count(*)::integer from public.capacity_adjustments
  where fulfillment_date=(select day from redelivery_dates where name='first')
    and source='redelivery' and status='active'),2,
  'the first paid payment start adds exactly one active spot');
insert into redelivery_tap select is((select payment_expires_at-updated_at from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='ordinary')),interval '15 minutes',
  'redelivery payment hold lasts 15 minutes');
select public.save_redelivery_session((select id from redelivery_fixture where name='ordinary'),'cs_test_redeliveryordinary');
select public.resolve_redelivery_payment((select id from redelivery_fixture where name='ordinary'),
  'paid','cs_test_redeliveryordinary','pi_redeliverypaid',now()-interval '1 minute');
insert into redelivery_tap select is((select fulfillment_status from public.orders
  where id=(select id from redelivery_fixture where name='ordinary')),'redelivery_scheduled',
  'only settled fee payment confirms the redelivery');
insert into redelivery_tap select is((select count(*)::integer from public.order_notifications
  where order_id=(select id from redelivery_fixture where name='ordinary') and kind='customer_redelivery_scheduled'),1,
  'customer receives scheduled update');

select public.begin_redelivery_payment((select id from redelivery_fixture where name='payment_expiry'),6);
select public.save_redelivery_session((select id from redelivery_fixture where name='payment_expiry'),'cs_test_redeliveryexpiry');
insert into redelivery_tap select is(public.resolve_redelivery_payment(
  (select id from redelivery_fixture where name='payment_expiry'),'expired','cs_test_redeliveryexpiry'),
  'awaiting_owner','expired unpaid session releases the reservation');
insert into redelivery_tap select is((select status from public.capacity_adjustments where id in (
  select id from public.capacity_adjustments where source='redelivery' and customer_reference=(
    select order_number from public.orders where id=(select id from redelivery_fixture where name='payment_expiry')))),
  'released','expired reservation frees the space');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.select_redelivery_date((select id from redelivery_fixture where name='payment_expiry'),6,
  (select day from redelivery_dates where name='first'));
insert into redelivery_tap select is((select count(*)::integer from public.order_notifications
  where order_id=(select id from redelivery_fixture where name='payment_expiry')
    and kind like 'customer_redelivery_date_selected:%'),3,
  'repeated date updates retain separate email outbox entries');
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.begin_redelivery_payment((select id from redelivery_fixture where name='late_charge'),6);
select public.save_redelivery_session((select id from redelivery_fixture where name='late_charge'),'cs_test_redeliverylate');
reset role;
update public.order_redeliveries set payment_expires_at=now()-interval '1 minute'
  where order_id=(select id from redelivery_fixture where name='late_charge');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into redelivery_tap select is(public.resolve_redelivery_payment(
  (select id from redelivery_fixture where name='late_charge'),'late_paid',
  'cs_test_redeliverylate','pi_redeliverylate',now()),'refund_pending',
  'a charge after the 15-minute hold is never accepted as a redelivery');
insert into redelivery_tap select is((select status from public.capacity_adjustments where id=(
  select capacity_adjustment_id from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='late_charge'))),'released',
  'late payment releases its capacity space');
insert into redelivery_tap select is((select amount_cents from public.redelivery_fee_refunds
  where order_id=(select id from redelivery_fixture where name='late_charge')),500,
  'late charge creates a durable fee refund');
create temporary table redelivery_fee_job as select * from public.redelivery_fee_refunds where false;
grant all on redelivery_fee_job to service_role;
insert into redelivery_fee_job select * from public.claim_redelivery_fee_refunds(true,
  (select id from public.redelivery_fee_refunds where order_id=(select id from redelivery_fixture where name='late_charge')));
insert into redelivery_tap select is((select count(*)::integer from redelivery_fee_job),1,
  'only one worker leases the late fee refund');
insert into redelivery_tap select is(public.resolve_redelivery_fee_refund((select id from redelivery_fee_job),
  gen_random_uuid(),'succeeded','re_fake'),false,'stale refund lease cannot forge success');
insert into redelivery_tap select is(public.resolve_redelivery_fee_refund((select id from redelivery_fee_job),
  (select lease_id from redelivery_fee_job),'succeeded','re_fake'),true,
  'provider-confirmed fee refund is recorded');
insert into redelivery_tap select is((select payment_status from public.order_redeliveries
  where order_id=(select id from redelivery_fixture where name='late_charge')),'refunded',
  'fee refund status is visible independently of the original order');
insert into redelivery_tap select is((select status from public.orders
  where id=(select id from redelivery_fixture where name='late_charge')),'discarded',
  'late fee refund closes the otherwise stranded original order');
insert into redelivery_tap select is((select amount_cents from public.order_refunds
  where order_id=(select id from redelivery_fixture where name='late_charge')),1500,
  'late fee refund also starts a full original-payment refund');

select public.begin_redelivery_payment((select id from redelivery_fixture where name='second_fail'),6);
select public.save_redelivery_session((select id from redelivery_fixture where name='second_fail'),'cs_test_redeliverysecond');
select public.resolve_redelivery_payment((select id from redelivery_fixture where name='second_fail'),
  'paid','cs_test_redeliverysecond','pi_redeliverysecond',now()-interval '1 minute');
reset role;
-- Test the final outcome without waiting for a real calendar day.
update public.order_redeliveries set selected_date=(now() at time zone 'America/Toronto')::date
  where order_id=(select id from redelivery_fixture where name='second_fail');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.mark_redelivery_outcome((select id from redelivery_fixture where name='second_fail'),7,'out_for_delivery');
select public.mark_redelivery_outcome((select id from redelivery_fixture where name='second_fail'),8,'failed');
insert into redelivery_tap select is((select status from public.orders where id=(select id from redelivery_fixture where name='second_fail')),
  'discarded','second failed attempt closes the order');
insert into redelivery_tap select is((select amount_cents from public.order_refunds
  where order_id=(select id from redelivery_fixture where name='second_fail')),1500,
  'second failure refunds the full original payment');
insert into redelivery_tap select is((select amount_cents from public.redelivery_fee_refunds
  where order_id=(select id from redelivery_fixture where name='second_fail')),500,
  'second failure separately refunds the paid extra delivery fee');
reset role;

insert into redelivery_tap select * from finish();
select line from redelivery_tap;
rollback;
