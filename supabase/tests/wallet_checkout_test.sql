begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table payment_tap(line text);
grant all on payment_tap to anon, authenticated, service_role;
insert into payment_tap select no_plan();

insert into auth.users(id,email) values
('98000000-0000-4000-8000-000000000091','payment-owner@example.com'),
('98000000-0000-4000-8000-000000000092','payment-stranger@example.com');
insert into public.admin_users(user_id,role,is_active) values('98000000-0000-4000-8000-000000000091','owner',true);

insert into payment_tap select ok(not has_table_privilege('anon','public.orders','select'),'anonymous callers cannot enumerate orders');
insert into payment_tap select ok(not has_table_privilege('authenticated','public.orders','insert'),'browser roles cannot manufacture paid orders');
insert into payment_tap select ok(not has_table_privilege('authenticated','public.payment_attempts','update'),'owners cannot mark a payment paid from the browser');
insert into payment_tap select ok(not has_function_privilege('authenticated','public.resolve_wallet_payment(uuid,text,text,text,text,integer,text,boolean)','execute'),'payment resolution is server-only');
insert into payment_tap select ok(not has_function_privilege('anon','public.begin_wallet_payment(uuid,integer,integer,text,jsonb)','execute'),'reservations require the server boundary');
insert into payment_tap select ok(not has_table_privilege('authenticated','public.payment_worker_health','update'),'a browser cannot fake worker health');

create temporary table payment_test_dates as
select day::date as day, row_number() over(order by day)::integer as idx
from generate_series((now() at time zone 'America/Toronto')::date+7,(now() at time zone 'America/Toronto')::date+40,interval '1 day') day
where extract(isodow from day)=1
  and not exists(select 1 from public.capacity_adjustments where fulfillment_date=day::date and status='active')
  and not exists(select 1 from public.capacity_holds where fulfillment_date=day::date and status='active')
  and not exists(select 1 from public.fulfillment_blackouts where fulfillment_date=day::date)
limit 2;
create temporary table payment_cases(idx integer primary key,draft_id uuid,attempt_id uuid,snapshot jsonb);
grant all on payment_cases, payment_test_dates to service_role;

create function pg_temp.payment_fixture(p_idx integer,p_day date) returns uuid language plpgsql as $$
declare draft_id uuid:=gen_random_uuid(); raw jsonb; contact jsonb; q jsonb; s jsonb;
begin
  raw := jsonb_build_object('version',1,'lines',jsonb_build_array(jsonb_build_object('productId','11111111-1111-4111-8111-111111111111','variantId',null,'optionSelections','[]'::jsonb,'quantity',4)));
  contact := '{"name":"Payment fixture","email":"payment-test@example.com","address":{"line1":"Customer-entered test address"}}';
  insert into public.checkout_drafts(id,access_token_hash,cart_payload,cart_fingerprint,cart_validation_snapshot,pricing_fingerprint,fulfillment_method,fulfillment_date,status,expires_at)
  values(draft_id,encode(extensions.digest(draft_id::text,'sha256'),'hex'),raw,repeat('a',64),'{}',repeat('b',64),'delivery',p_day,'ready_for_details',now()+interval '1 day');
  q := jsonb_build_object('id',gen_random_uuid(),'address',jsonb_build_object('line1','Confirmed fixture address'),'requiresConfirmation',true,'feeCents',500,'subtotalCents',1000,'freeDelivery',false,'settingsVersion',(select version from public.delivery_settings where singleton),'expiresAt',now()+interval '10 minutes','cartFingerprint',repeat('a',64),'pricingFingerprint',repeat('b',64));
  perform public.mutate_delivery_details(draft_id,1,0,'save',contact);
  perform public.mutate_delivery_details(draft_id,1,1,'quote',q);
  perform public.mutate_delivery_details(draft_id,1,2,'confirm');
  s := jsonb_build_object('version',3,'cart',raw,'validatedCart',jsonb_build_object('status','ready'),'fulfillmentDate',p_day::text,'cancellationDeadline',((p_day-1)::timestamp at time zone 'America/Toronto'),'delivery',jsonb_set(contact,'{address}',q->'address'),'subtotalCents',1000,'deliveryCents',500,'totalCents',1500,'currency','CAD','testOnly',true);
  insert into payment_cases(idx,draft_id,snapshot) values(p_idx,draft_id,s);
  return draft_id;
end;
$$;

set local role service_role;
select pg_temp.payment_fixture(1,(select day from payment_test_dates where idx=1));
select pg_temp.payment_fixture(2,(select day from payment_test_dates where idx=1));
select pg_temp.payment_fixture(3,(select day from payment_test_dates where idx=1));
select pg_temp.payment_fixture(4,(select day from payment_test_dates where idx=1));
select pg_temp.payment_fixture(5,(select day from payment_test_dates where idx=1));
select pg_temp.payment_fixture(6,(select day from payment_test_dates where idx=2));

insert into public.payment_worker_health(mode,checked_at) values('test',now()-interval '1 day') on conflict(mode) do update set checked_at=excluded.checked_at;
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,1,3,repeat('c',64),snapshot) from payment_cases where idx=1$$,'P0001','payment_worker_unavailable','new payments fail closed when the worker is unhealthy');
update public.payment_worker_health set checked_at=now() where mode='test';
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,2,3,repeat('c',64),snapshot) from payment_cases where idx=1$$,'P0001','payment_review_stale','stale checkout versions cannot pay');
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,1,3,repeat('c',64),jsonb_set(snapshot,'{totalCents}','1')) from payment_cases where idx=1$$,'P0001','payment_snapshot_invalid','a tampered total is rejected');
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,1,3,repeat('c',64),jsonb_set(snapshot,'{tax}','{"totalCents":0}')) from payment_cases where idx=1$$,'P0001','payment_snapshot_invalid','a tax field is rejected');
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,1,3,repeat('c',64),jsonb_set(snapshot,'{deliveryCents}','0')) from payment_cases where idx=1$$,'P0001','payment_snapshot_invalid','delivery fee must match the confirmed server quote');
update payment_cases set attempt_id=public.begin_wallet_payment(draft_id,1,3,repeat('c',64),snapshot) where idx=1;
insert into payment_tap select is(public.begin_wallet_payment(draft_id,1,3,repeat('c',64),snapshot),attempt_id,'duplicate payment submission returns the same attempt') from payment_cases where idx=1;
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,1,3,repeat('d',64),snapshot) from payment_cases where idx=1$$,'P0001','payment_in_progress','a different review cannot replace an open payment');
insert into payment_tap select throws_ok($$update public.checkout_drafts set cart_fingerprint=repeat('f',64) where id=(select draft_id from payment_cases where idx=1)$$,'P0001','payment_in_progress','an old tab cannot edit a payment draft');
insert into payment_tap select throws_ok($$update public.checkout_delivery_details set input='{}' where checkout_draft_id=(select draft_id from payment_cases where idx=1)$$,'P0001','payment_in_progress','an old tab cannot change the delivery address');
update public.capacity_holds set created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes' where checkout_draft_id=(select draft_id from payment_cases where idx=1);
update payment_cases set attempt_id=public.begin_wallet_payment(draft_id,1,3,repeat('c',64),snapshot) where idx between 2 and 4;
insert into payment_tap select throws_ok($$select public.begin_wallet_payment(draft_id,1,3,repeat('c',64),snapshot) from payment_cases where idx=5$$,'P0001','The fulfillment date has reached its four-order capacity.','an unresolved expired wallet still counts toward the hard four-order cap');
insert into payment_tap select is((select count(*)::integer from public.capacity_holds where checkout_draft_id in (select draft_id from payment_cases) and status='active' and payment_pending),4,'four protected holds exist, not five');

update public.payment_attempts set stripe_session_id='cs_fixture_'||id where id in (select attempt_id from payment_cases);
insert into payment_tap select throws_ok($$select public.resolve_wallet_payment(attempt_id,'paid','fixture_wrong_session','other','pi_fixture',1500,'cad',false) from payment_cases where idx=1$$,'P0001','payment_session_mismatch','a payment for another session cannot confirm an order');
insert into payment_tap select throws_ok($$select public.resolve_wallet_payment(attempt_id,'paid','fixture_wrong_amount','cs_fixture_'||attempt_id,'pi_fixture',1,'cad',false) from payment_cases where idx=1$$,'P0001','payment_amount_mismatch','wrong amount cannot confirm an order');
insert into payment_tap select throws_ok($$select public.resolve_wallet_payment(attempt_id,'paid','fixture_wrong_mode','cs_fixture_'||attempt_id,'pi_fixture',1500,'cad',true) from payment_cases where idx=1$$,'P0001','payment_amount_mismatch','live and test payments cannot mix');
insert into payment_tap select isnt(public.resolve_wallet_payment(attempt_id,'paid','fixture_paid','cs_fixture_'||attempt_id,'pi_fixture_1',1500,'cad',false),null::uuid,'verified success converts protected capacity to a real order') from payment_cases where idx=1;
insert into payment_tap select is(public.resolve_wallet_payment(attempt_id,'paid','fixture_paid','cs_fixture_'||attempt_id,'pi_fixture_1',1500,'cad',false),(select id from public.orders where payment_attempt_id=attempt_id),'duplicate webhook returns the original order') from payment_cases where idx=1;
select public.resolve_wallet_payment(attempt_id,'paid','fixture_paid_again','cs_fixture_'||attempt_id,'pi_fixture_1',1500,'cad',false) from payment_cases where idx=1;
insert into payment_tap select is((select count(*)::integer from public.orders where payment_attempt_id in(select attempt_id from payment_cases)),1,'separate success events still create only one order');
insert into payment_tap select is((select count(*)::integer from public.order_notifications where payment_attempt_id=(select attempt_id from payment_cases where idx=1)),2,'one customer email and one owner alert are queued exactly once');
insert into payment_tap select is((select count(*)::integer from public.capacity_adjustments where fulfillment_date=(select day from payment_test_dates where idx=1) and status='active')+(select count(*)::integer from public.capacity_holds where fulfillment_date=(select day from payment_test_dates where idx=1) and status='active'),4,'consuming a hold never double-counts the paid order');
insert into payment_tap select throws_ok($$select public.resolve_wallet_payment(attempt_id,'expired','fixture_paid','cs_fixture_'||attempt_id) from payment_cases where idx=2$$,'P0001','payment_event_mismatch','an event ID cannot be reused for another payment');

select public.resolve_wallet_payment(attempt_id,'expired','fixture_expired','cs_fixture_'||attempt_id) from payment_cases where idx=2;
insert into payment_tap select is((select status from public.capacity_holds where checkout_draft_id=(select draft_id from payment_cases where idx=2)),'released','provider-confirmed expiry releases capacity');
select public.resolve_wallet_payment(attempt_id,'paid','fixture_late','cs_fixture_'||attempt_id,'pi_fixture_2',1500,'cad',false) from payment_cases where idx=2;
insert into payment_tap select is((select status from public.payment_attempts where id=(select attempt_id from payment_cases where idx=2)),'refund_pending','a success after released capacity requires compensation');
insert into payment_tap select is((select count(*)::integer from public.orders where payment_attempt_id=(select attempt_id from payment_cases where idx=2)),0,'a late success cannot manufacture another order');
select public.resolve_wallet_payment(attempt_id,'refunded','fixture_refunded','cs_fixture_'||attempt_id,'pi_fixture_2',1500,'cad',false) from payment_cases where idx=2;
insert into payment_tap select is((select status from public.payment_attempts where id=(select attempt_id from payment_cases where idx=2)),'refunded','verified compensation is recorded');
update payment_cases set attempt_id=public.begin_wallet_payment(draft_id,1,3,repeat('c',64),snapshot) where idx=5;
insert into payment_tap select ok((select attempt_id is not null from payment_cases where idx=5),'a released space can be booked again');

-- Make only fixture notifications oldest; no emails are sent by database tests.
update public.order_notifications set next_attempt_at=now()-interval '100 years' where payment_attempt_id=(select attempt_id from payment_cases where idx=1);
create temporary table claimed_fixture as select * from public.claim_order_notifications(1);
insert into payment_tap select is((select count(*)::integer from claimed_fixture),1,'worker claims a bounded batch');
insert into payment_tap select ok((select lease_id is not null and status='sending' and attempts=1 from claimed_fixture),'claimed notification has an exclusive expiring lease');
insert into payment_tap select is((select count(*)::integer from public.claim_order_notifications(1) where id=(select id from claimed_fixture)),0,'another worker cannot claim an unexpired lease');

reset role;
set local role authenticated;
set local request.jwt.claim.sub='98000000-0000-4000-8000-000000000092';
insert into payment_tap select is_empty($$select id from public.orders$$,'non-owner accounts cannot see order addresses');
insert into payment_tap select is_empty($$select id from public.payment_attempts$$,'non-owner accounts cannot see payment snapshots');
set local request.jwt.claim.sub='98000000-0000-4000-8000-000000000091';
insert into payment_tap select isnt_empty($$select id from public.orders$$,'active owner can read confirmed orders');
insert into payment_tap select throws_ok($$update public.capacity_adjustments set status='released',released_at=now() where source='website'$$,'P0001','Use the order workflow to change website capacity.','owner cannot bypass order cancellation by releasing website capacity');
reset role;
update public.admin_users set is_active=false where user_id='98000000-0000-4000-8000-000000000091';
set local role authenticated;
insert into payment_tap select is_empty($$select id from public.orders$$,'revoked owner immediately loses order access');
reset role;
insert into payment_tap select * from finish();
do $$ begin if exists(select 1 from payment_tap where line like 'not ok%' or line like '# Looks like%') then raise exception 'Payment tests failed: %',(select string_agg(line,E'\n') from payment_tap); end if; end $$;
select line from payment_tap;
rollback;
