begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table external_order_tap(line text);
grant all on external_order_tap to authenticated, anon;
insert into external_order_tap select no_plan();

insert into auth.users(id,email) values
  ('98400000-0000-4000-8000-000000000001','external-owner@example.com'),
  ('98400000-0000-4000-8000-000000000002','external-stranger@example.com');
insert into public.admin_users(user_id,role,is_active)
  values('98400000-0000-4000-8000-000000000001','owner',true);
insert into public.categories(id,name,slug,status)
  values('98400000-0000-4000-8000-000000000003','External Test Pastries','external-test-pastries','published');
insert into public.products(id,category_id,name,slug,base_price_cents,minimum_quantity,quantity_step,status,is_available)
  values('98400000-0000-4000-8000-000000000004',
    '98400000-0000-4000-8000-000000000003','External Test Cookies','external-test-cookies',250,4,1,'published',true);
create temporary table external_order_date(day date);
grant select on external_order_date to authenticated;
create temporary table external_order_ids(id uuid);
grant all on external_order_ids to authenticated;
insert into external_order_date
select d from generate_series(
  (now() at time zone 'America/Toronto')::date+15,
  (now() at time zone 'America/Toronto')::date+35,
  '1 day'::interval
) as d where extract(isodow from d) not in (3,7)
  and not (extract(month from d)=12 and extract(day from d)=25)
  and not exists(select 1 from public.capacity_adjustments where fulfillment_date=d and status='active')
  and not exists(select 1 from public.capacity_holds where fulfillment_date=d and status='active')
  limit 1;

insert into external_order_tap select ok(not has_table_privilege('anon','public.external_orders','select'),
  'guest cannot enumerate external customer contact and address');
insert into external_order_tap select ok(not has_table_privilege('authenticated','public.external_orders','insert'),
  'browser role cannot insert external records outside guarded RPC');
insert into external_order_tap select ok(not has_table_privilege('authenticated','public.external_orders','update'),
  'browser role cannot skip stage transitions');
insert into external_order_tap select ok(not has_function_privilege('anon',
  'public.create_external_order(date,text,text,text,text,text,text,text,text,text,text,jsonb,text)','execute'),
  'guest cannot reserve capacity through the owner RPC');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98400000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into external_order_tap select throws_ok($q$
  select public.create_external_order((select day from external_order_date),'phone','Test Customer',
    '+14165550100',null,'Test Recipient','100 Queen Street West',null,'Toronto','M5H 2N1',null,
    '[{"productId":"98400000-0000-4000-8000-000000000004","quantity":4}]',null)
$q$,'42501','owner_required','non-owner cannot create an external order');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98400000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into external_order_tap select throws_ok($q$
  select public.create_external_order((select day from external_order_date),'phone','Test Customer',
    '+14165550100',null,'Test Recipient','100 Queen Street West',null,'Toronto','M5H 2N1',null,
    '[{"productId":"98400000-0000-4000-8000-000000000004","quantity":3}]',null)
$q$,'23514','external_order_item_unavailable','minimum quantity is checked in database');
insert into external_order_ids select public.create_external_order(
  (select day from external_order_date),'instagram','Test Customer','+14165550100',null,
  'Test Recipient','100 Queen Street West',null,'Toronto','M5H 2N1',null,
  '[{"productId":"98400000-0000-4000-8000-000000000004","quantity":5,"note":"Vanilla"}]',null);
insert into external_order_tap select is((select items->0->>'quantity' from public.external_orders
  where id=(select id from external_order_ids)),'5','quantity and notes are snapshotted');
insert into external_order_tap select is((select status from public.capacity_adjustments
  where id=(select capacity_adjustment_id from public.external_orders where id=(select id from external_order_ids))),
  'active','external order reserves one shared daily space');
insert into external_order_tap select is((select count(*)::integer from public.external_order_events
  where external_order_id=(select id from external_order_ids)),1,
  'initial received stage is recorded in an immutable timeline');
insert into external_order_tap select throws_ok($q$
  update public.capacity_adjustments set status='released',released_at=now()
    where id=(select capacity_adjustment_id from public.external_orders where id=(select id from external_order_ids))
$q$,'23514','tracked_external_order_space','legacy release cannot orphan tracked order');
insert into external_order_tap select throws_ok($q$
  select public.advance_external_order((select id from external_order_ids),1,'delivered')
$q$,'23514','external_order_invalid_transition','cannot skip preparation stages');
insert into external_order_tap select is(public.advance_external_order(
  (select id from external_order_ids),1,'preparing'),true,'owner starts preparation');
insert into external_order_tap select is((select count(*)::integer from public.external_order_events
  where external_order_id=(select id from external_order_ids)),2,
  'preparing transition appends an event');
insert into external_order_tap select is(public.advance_external_order(
  (select id from external_order_ids),1,'ready'),false,'stale version is rejected');
insert into external_order_tap select throws_ok($q$
  select public.advance_external_order((select id from external_order_ids),2,'cancelled')
$q$,'23514','external_order_invalid_transition','prepared order cannot be cancelled');
do $$ begin
  for i in 1..3 loop
    insert into external_order_ids select public.create_external_order(
      (select day from external_order_date),'phone','Another Customer','+14165550100',null,
      'Another Recipient','100 Queen Street West',null,'Toronto','M5H 2N1',null,
      '[{"productId":"98400000-0000-4000-8000-000000000004","quantity":4}]',null);
  end loop;
end $$;
insert into external_order_tap select is((select count(*)::integer from public.capacity_adjustments
  where fulfillment_date=(select day from external_order_date) and status='active'),4,
  'phone and Instagram records share the four-order capacity');
insert into external_order_tap select throws_ok($q$
  select public.create_external_order((select day from external_order_date),'phone','Fifth Customer',
    '+14165550100',null,'Fifth Recipient','100 Queen Street West',null,'Toronto','M5H 2N1',null,
    '[{"productId":"98400000-0000-4000-8000-000000000004","quantity":4}]',null)
$q$,'P0001','The fulfillment date has reached its four-order capacity.',
  'fifth order is refused atomically');
insert into external_order_tap select is(public.advance_external_order(
  (select i.id from external_order_ids i join public.external_orders o on o.id=i.id
    where o.fulfillment_status='received' limit 1),1,'cancelled'),true,
  'received order can be cancelled by owner');
insert into external_order_tap select is((select count(*)::integer from public.capacity_adjustments
  where fulfillment_date=(select day from external_order_date) and status='active'),3,
  'cancelling before preparation releases exactly one space');
reset role;

insert into external_order_tap select * from finish();
select line from external_order_tap;
rollback;
