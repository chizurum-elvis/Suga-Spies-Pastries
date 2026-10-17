begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table cancellation_tap(line text);
grant all on cancellation_tap to anon, authenticated, service_role;
insert into cancellation_tap select no_plan();
insert into cancellation_tap select is(private.order_cancellation_deadline('2026-03-09'), '2026-03-08T05:00:00Z'::timestamptz,'spring clock change matches the displayed Toronto deadline');
insert into cancellation_tap select is(private.order_cancellation_deadline('2026-11-02'), '2026-11-01T04:00:00Z'::timestamptz,'autumn clock change matches the displayed Toronto deadline');

insert into auth.users(id,email) values
  ('98200000-0000-4000-8000-000000000001','cancellation-owner@example.com'),
  ('98200000-0000-4000-8000-000000000002','cancellation-stranger@example.com');
insert into public.admin_users(user_id,role,is_active) values('98200000-0000-4000-8000-000000000001','owner',true);

create function pg_temp.cancellation_fixture(p_day date) returns uuid language plpgsql as $$
declare d uuid := gen_random_uuid(); h uuid := gen_random_uuid(); a uuid := gen_random_uuid(); c uuid := gen_random_uuid(); o uuid := gen_random_uuid(); s jsonb;
begin
  s := jsonb_build_object('version',3,'subtotalCents',1000,'deliveryCents',500,'totalCents',1500,'testOnly',true,'fulfillmentDate',p_day::text);
  insert into public.checkout_drafts(id,access_token_hash,cart_payload,cart_fingerprint,cart_validation_snapshot,pricing_fingerprint,fulfillment_method,fulfillment_date,status,expires_at)
    values(d,encode(extensions.digest(d::text,'sha256'),'hex'),'{"version":1,"lines":[]}',repeat('b',64),'{}',repeat('c',64),'delivery',p_day,'expired',now()+interval '1 day');
  insert into public.capacity_holds(id,checkout_draft_id,fulfillment_date,idempotency_key,status,expires_at,consumed_at)
    values(h,d,p_day,gen_random_uuid(),'consumed',now()+interval '15 minutes',now());
  insert into public.payment_attempts(id,checkout_draft_id,hold_id,access_token_hash,review_token,snapshot,total_cents,test_only,status,stripe_payment_intent_id,expires_at)
    values(a,d,h,repeat('d',64),repeat('e',64),s,1500,true,'paid','pi_cancellation_'||replace(a::text,'-',''),now()+interval '15 minutes');
  insert into public.capacity_adjustments(id,fulfillment_date,source,customer_reference,internal_note)
    values(c,p_day,'website','cancellation-fixture','Rollback-only cancellation test');
  insert into public.orders(id,payment_attempt_id,capacity_adjustment_id,fulfillment_date,snapshot,test_only,created_at)
    values(o,a,c,p_day,s,true,now()-interval '1 day');
  return o;
end;
$$;
create temporary table cancellation_fixture(name text primary key, id uuid);
grant all on cancellation_fixture to authenticated, service_role;
insert into cancellation_fixture values
  ('customer',pg_temp.cancellation_fixture(current_date+100)),
  ('capacity2',pg_temp.cancellation_fixture(current_date+100)),
  ('capacity3',pg_temp.cancellation_fixture(current_date+100)),
  ('capacity4',pg_temp.cancellation_fixture(current_date+100)),
  ('prepared',pg_temp.cancellation_fixture(current_date+101)),
  ('late',pg_temp.cancellation_fixture((now() at time zone 'America/Toronto')::date+1)),
  ('owner',pg_temp.cancellation_fixture(current_date+102));

insert into cancellation_tap select ok(not has_table_privilege('anon','public.order_refunds','select'),'guests cannot enumerate refunds');
insert into cancellation_tap select ok(not has_table_privilege('authenticated','public.order_refunds','update'),'owners cannot forge refund completion');
insert into cancellation_tap select ok(not has_table_privilege('service_role','public.order_refunds','update'),'service code must resolve refunds through the fenced workflow');
insert into cancellation_tap select ok(not has_function_privilege('anon','public.cancel_order(uuid,integer,text)','execute'),'anonymous database clients cannot cancel orders');
insert into cancellation_tap select ok(not has_function_privilege('authenticated','public.resolve_order_refund(uuid,uuid,text,text,text)','execute'),'customers/owners cannot assert provider success');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98200000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='customer'),1,'Testing')$q$,'42501','order_cancellation_forbidden','non-owner cannot cancel a guessed order ID');
insert into cancellation_tap select is((select count(*)::integer from public.order_refunds),0,'stranger cannot read refund records');
select set_config('request.jwt.claims','{"sub":"98200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='owner'),1,' ')$q$,'P0001','order_cancellation_invalid','owner reason is required');
insert into cancellation_tap select lives_ok($q$select public.transition_order_fulfillment((select id from cancellation_fixture where name='prepared'),'received','preparing',1,gen_random_uuid())$q$,'owner starts preparation');
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='prepared'),2,'Testing')$q$,'P0001','order_preparation_started','owner cannot cancel once preparation starts');
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='late'),1,'Testing')$q$,'P0001','order_cancellation_deadline','owner cannot bypass the cutoff');
insert into cancellation_tap select lives_ok($q$select public.cancel_order((select id from cancellation_fixture where name='owner'),1,'Customer requested cancellation')$q$,'owner cancels an eligible order');
insert into cancellation_tap select is((select requested_by from public.order_refunds where order_id=(select id from cancellation_fixture where name='owner')),'owner','actor identity comes from authenticated session');

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='customer'),99)$q$,'P0001','order_cancellation_conflict','stale order versions fail without side effects');
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='prepared'),2)$q$,'P0001','order_preparation_started','customer cannot cancel prepared order');
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='late'),1)$q$,'P0001','order_cancellation_deadline','customer cannot cancel after deadline');
insert into cancellation_tap select is((select count(*)::integer from public.capacity_adjustments where fulfillment_date=current_date+100 and status='active'),4,'date begins at four-order capacity');
insert into cancellation_tap select lives_ok($q$select public.cancel_order((select id from cancellation_fixture where name='customer'),1)$q$,'customer can cancel the next day while eligibility remains');
insert into cancellation_tap select lives_ok($q$select public.cancel_order((select id from cancellation_fixture where name='customer'),1)$q$,'duplicate request safely returns the original result');
insert into cancellation_tap select is((select status from public.orders where id=(select id from cancellation_fixture where name='customer')),'cancelled','order is cancelled before Stripe is called');
insert into cancellation_tap select is((select payment_status from public.orders where id=(select id from cancellation_fixture where name='customer')),'refund_pending','cancellation is not falsely presented as refunded');
insert into cancellation_tap select is((select count(*)::integer from public.capacity_adjustments where fulfillment_date=current_date+100 and status='active'),3,'cancellation releases exactly one space');
insert into cancellation_tap select is((select count(*)::integer from public.order_refunds where order_id=(select id from cancellation_fixture where name='customer')),1,'duplicate request creates one refund');
insert into cancellation_tap select is((select amount_cents from public.order_refunds where order_id=(select id from cancellation_fixture where name='customer')),1500,'full refund includes delivery');
insert into cancellation_tap select is((select count(*)::integer from public.order_events where order_id=(select id from cancellation_fixture where name='customer') and to_status='cancelled'),1,'one immutable cancellation event');
insert into cancellation_tap select is((select count(*)::integer from public.order_notifications where order_id=(select id from cancellation_fixture where name='customer') and kind in ('customer_cancelled','owner_cancellation')),2,'customer and owner get one cancellation email each');
insert into cancellation_tap select is((select count(*)::integer from public.order_notifications where order_id=(select id from cancellation_fixture where name='customer') and kind like '%refund%'),0,'no separate customer refund email');

reset role;
insert into cancellation_fixture values('replacement',pg_temp.cancellation_fixture(current_date+100));
insert into cancellation_tap select is((select count(*)::integer from public.capacity_adjustments where fulfillment_date=current_date+100 and status='active'),4,'a replacement order can use the released space');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into cancellation_tap select throws_ok($q$select public.transition_order_fulfillment((select id from cancellation_fixture where name='customer'),'received','preparing',1,gen_random_uuid())$q$,'P0001','order_transition_conflict','stale preparation loses after cancellation');
insert into cancellation_tap select throws_ok($q$select public.transition_order_fulfillment((select id from cancellation_fixture where name='customer'),'received','preparing',2,gen_random_uuid())$q$,'P0001','order_cancelled','even a fresh version cannot prepare a cancelled order');
reset role;
update public.admin_users set is_active=false where user_id='98200000-0000-4000-8000-000000000001';
set local role authenticated;
insert into cancellation_tap select throws_ok($q$select public.cancel_order((select id from cancellation_fixture where name='capacity2'),1,'Testing')$q$,'42501','order_cancellation_forbidden','deactivated owner is rejected beside mutation');
insert into cancellation_tap select is((select count(*)::integer from public.order_refunds),0,'deactivated owner loses refund read access');
reset role;

create temporary table cancellation_job as select * from public.order_refunds where false;
grant all on cancellation_job to service_role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into cancellation_job select * from public.claim_order_refunds(true,(select id from public.order_refunds where order_id=(select id from cancellation_fixture where name='customer')));
insert into cancellation_tap select is((select count(*)::integer from cancellation_job),1,'one worker leases the refund');
insert into cancellation_tap select is((select count(*)::integer from public.claim_order_refunds(true,(select id from cancellation_job))),0,'another worker cannot lease the same refund');
insert into cancellation_tap select is(public.resolve_order_refund((select id from cancellation_job),gen_random_uuid(),'succeeded','re_test'),false,'stale worker cannot write an outcome');
insert into cancellation_tap select is(public.resolve_order_refund((select id from cancellation_job),(select lease_id from cancellation_job),'pending','re_test'),true,'provider pending outcome is saved');
insert into cancellation_tap select is((select payment_status from public.orders where id=(select id from cancellation_fixture where name='customer')),'refund_pending','provider pending remains pending');
reset role;
update public.order_refunds set next_attempt_at=now()-interval '1 second' where id=(select id from cancellation_job);
truncate cancellation_job;
set local role service_role;
insert into cancellation_job select * from public.claim_order_refunds(true,(select id from public.order_refunds where order_id=(select id from cancellation_fixture where name='customer')));
insert into cancellation_tap select is(public.resolve_order_refund((select id from cancellation_job),(select lease_id from cancellation_job),'succeeded','re_test'),true,'verified provider success completes refund');
insert into cancellation_tap select is((select payment_status from public.orders where id=(select id from cancellation_fixture where name='customer')),'refunded','paid state changes only after provider success');
insert into cancellation_tap select is((select status from public.orders where id=(select id from cancellation_fixture where name='customer')),'cancelled','successful refund never reopens the order');
insert into cancellation_tap select throws_ok($q$update public.orders set status='confirmed' where id=(select id from cancellation_fixture where name='customer')$q$,'P0001','order_cancelled','direct order resurrection is rejected');
insert into cancellation_tap select throws_ok($q$update public.orders set snapshot='{}' where id=(select id from cancellation_fixture where name='customer')$q$,'P0001','order_history_is_immutable','purchase history cannot be rewritten during refunds');
reset role;
-- Banks can report a later failure; do not continue to show a successful refund.
update public.order_refunds set next_attempt_at=now()-interval '1 second' where id=(select id from cancellation_job);
truncate cancellation_job;
set local role service_role;
insert into cancellation_job select * from public.claim_order_refunds(true,(select id from public.order_refunds where order_id=(select id from cancellation_fixture where name='customer')));
insert into cancellation_tap select is(public.resolve_order_refund((select id from cancellation_job),(select lease_id from cancellation_job),'failed','re_test','provider_refund_failed'),true,'later bank failure is recorded');
insert into cancellation_tap select is((select payment_status from public.orders where id=(select id from cancellation_fixture where name='customer')),'refund_failed','failure is visible to customer and owner');
insert into cancellation_tap select is((select count(*)::integer from public.order_notifications where order_id=(select id from cancellation_fixture where name='customer') and kind='owner_refund_attention'),1,'failed refund alerts owner');
insert into cancellation_tap select is((select count(*)::integer from public.capacity_adjustments where fulfillment_date=current_date+100 and status='active'),4,'refund failure does not reclaim capacity from a replacement order');
reset role;
insert into cancellation_tap select * from finish();
select line from cancellation_tap;
rollback;
