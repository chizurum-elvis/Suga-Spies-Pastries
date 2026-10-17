begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table account_tap(line text);
grant all on account_tap to anon, authenticated, service_role;
insert into account_tap select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
  ('98500000-0000-4000-8000-000000000001','buyer@example.com',now()),
  ('98500000-0000-4000-8000-000000000002','stranger@example.com',now()),
  ('98500000-0000-4000-8000-000000000003','unverified@example.com',null);

create function pg_temp.account_order(p_email text) returns uuid language plpgsql as $$
declare d uuid := gen_random_uuid(); h uuid := gen_random_uuid(); a uuid := gen_random_uuid(); c uuid := gen_random_uuid(); o uuid := gen_random_uuid(); s jsonb;
begin
  s := jsonb_build_object('version',3,'subtotalCents',1000,'deliveryCents',500,'totalCents',1500,'testOnly',true,'fulfillmentDate',(current_date+100)::text,'delivery',jsonb_build_object('email',p_email));
  insert into public.checkout_drafts(id,access_token_hash,cart_payload,cart_fingerprint,cart_validation_snapshot,pricing_fingerprint,fulfillment_method,fulfillment_date,status,expires_at)
    values(d,encode(extensions.digest(d::text,'sha256'),'hex'),'{}',repeat('b',64),'{}',repeat('c',64),'delivery',current_date+100,'expired',now()+interval '1 day');
  insert into public.capacity_holds(id,checkout_draft_id,fulfillment_date,idempotency_key,status,expires_at,consumed_at)
    values(h,d,current_date+100,gen_random_uuid(),'consumed',now()+interval '15 minutes',now());
  insert into public.payment_attempts(id,checkout_draft_id,hold_id,access_token_hash,review_token,snapshot,total_cents,test_only,status,expires_at)
    values(a,d,h,repeat('d',64),repeat('e',64),s,1500,true,'paid',now()+interval '15 minutes');
  insert into public.capacity_adjustments(id,fulfillment_date,source,customer_reference,internal_note)
    values(c,current_date+100,'website','account-fixture','Rollback-only account test');
  insert into public.orders(id,payment_attempt_id,capacity_adjustment_id,fulfillment_date,snapshot,test_only)
    values(o,a,c,current_date+100,s,true);
  return o;
end;
$$;
create temporary table account_orders(name text primary key, id uuid);
grant select on account_orders to anon, authenticated, service_role;
insert into account_orders values
  ('buyer',pg_temp.account_order(' BUYER@EXAMPLE.COM ')),
  ('unverified',pg_temp.account_order('unverified@example.com'));

insert into account_tap select is((select customer_email from public.orders where id=(select id from account_orders where name='buyer')),'buyer@example.com','paid-order email is normalized from its immutable snapshot');
insert into account_tap select ok(not has_table_privilege('anon','public.customer_profiles','select'),'anonymous clients cannot read saved details');
insert into account_tap select ok(not has_table_privilege('authenticated','public.customer_order_links','insert'),'customer sessions cannot attach orders');
insert into account_tap select ok(not has_table_privilege('authenticated','public.orders','update'),'customer sessions cannot rewrite paid orders');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98500000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into account_tap select is((select count(*)::integer from public.orders where id=(select id from account_orders where name='buyer')),0,'matching email alone never grants order read access');
insert into account_tap select throws_ok($q$insert into public.customer_order_links(order_id,user_id,order_placed_at) values((select id from account_orders where name='buyer'),'98500000-0000-4000-8000-000000000001',now())$q$,'42501',null,'customer cannot forge a link through the Data API');
insert into public.customer_profiles(user_id,full_name,phone,recipient_name,address_line1,city,postal_code) values('98500000-0000-4000-8000-000000000001','Pastry Buyer','+14165550100','Pastry Buyer','100 Queen Street West','Toronto','M5H 2N1');
insert into account_tap select is((select count(*)::integer from public.customer_profiles),1,'customer reads only their own saved details');
insert into account_tap select throws_ok($q$insert into public.customer_profiles(user_id,full_name,phone,recipient_name,address_line1,city,postal_code) values('98500000-0000-4000-8000-000000000002','Stranger','+14165550100','Stranger','100 Queen Street West','Toronto','M5H 2N1')$q$,'42501',null,'customer cannot save data into another account');
insert into account_tap select throws_ok($q$update public.customer_profiles set user_id='98500000-0000-4000-8000-000000000002' where user_id='98500000-0000-4000-8000-000000000001'$q$,'42501',null,'customer cannot transfer saved details to another identity');
insert into account_tap select throws_ok($q$update public.customer_profiles set city='Ottawa' where user_id='98500000-0000-4000-8000-000000000001'$q$,'23514',null,'unsupported delivery cities are rejected by the database');
reset role;

set local role service_role;
insert into account_tap select throws_ok($q$insert into public.customer_order_links(order_id,user_id,order_placed_at) values((select id from account_orders where name='buyer'),'98500000-0000-4000-8000-000000000002',now())$q$,'42501','customer_order_email_mismatch','even a privileged wrong-email link is rejected');
insert into account_tap select throws_ok($q$insert into public.customer_order_links(order_id,user_id,order_placed_at) values((select id from account_orders where name='unverified'),'98500000-0000-4000-8000-000000000003',now())$q$,'42501','customer_order_email_mismatch','unverified email cannot claim a guest order');
insert into public.customer_order_links(order_id,user_id,order_placed_at) values((select id from account_orders where name='buyer'),'98500000-0000-4000-8000-000000000001','2000-01-01');
insert into account_tap select is((select order_placed_at from public.customer_order_links where order_id=(select id from account_orders where name='buyer')),(select created_at from public.orders where id=(select id from account_orders where name='buyer')),'link timestamp comes from the immutable order');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98500000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into account_tap select is((select count(*)::integer from public.orders where id=(select id from account_orders where name='buyer')),1,'verified linked customer can read their paid order');
insert into account_tap select is((select count(*)::integer from public.customer_order_links),1,'customer sees only their own link');
select set_config('request.jwt.claims','{"sub":"98500000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into account_tap select is((select count(*)::integer from public.orders where id=(select id from account_orders where name='buyer')),0,'another customer cannot read the linked order');
insert into account_tap select is((select count(*)::integer from public.customer_profiles),0,'another customer cannot read saved contact or address');
insert into account_tap select is((select count(*)::integer from public.customer_profiles where user_id='98500000-0000-4000-8000-000000000001'),0,'another customer cannot select the saved address by known user ID');
reset role;
insert into account_tap select * from finish();
select line from account_tap;
rollback;
