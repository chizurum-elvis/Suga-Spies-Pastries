begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table delivery_tap (line text);
grant all on delivery_tap to anon, authenticated, service_role;
insert into delivery_tap select no_plan();

insert into auth.users (id,email) values
('97000000-0000-4000-8000-000000000001','delivery-owner@example.com'),
('97000000-0000-4000-8000-000000000002','delivery-stranger@example.com');
insert into public.admin_users(user_id,role,is_active) values ('97000000-0000-4000-8000-000000000001','owner',true);

insert into delivery_tap select ok(not has_table_privilege('anon','public.checkout_delivery_details','select'), 'anonymous users cannot read contact details');
insert into delivery_tap select ok(not has_table_privilege('authenticated','public.checkout_delivery_details','select'), 'browser roles cannot enumerate contact details');
insert into delivery_tap select ok(not has_function_privilege('authenticated','public.mutate_delivery_details(uuid,integer,integer,text,jsonb)','execute'), 'browser roles cannot invoke privileged mutations');
insert into delivery_tap select ok(not has_function_privilege('anon','public.allow_delivery_provider_request(uuid)','execute'), 'provider cost controls are server-only');
insert into delivery_tap select is((select count(*)::integer from public.fulfillment_hours where fulfillment_method <> 'delivery'),0,'no pickup hours remain');
insert into delivery_tap select is(private.fulfillment_date_issue('pickup',current_date + 10),'invalid_method','pickup is rejected by the database');

set local role authenticated;
set local request.jwt.claim.sub = '97000000-0000-4000-8000-000000000002';
insert into delivery_tap select is_empty($$select * from public.delivery_settings$$,'non-owners cannot read the private routing origin');
insert into delivery_tap select is_empty($$update public.delivery_settings set base_fee_cents=1 returning version$$,'non-owners cannot change rates');
set local request.jwt.claim.sub = '97000000-0000-4000-8000-000000000001';
insert into delivery_tap select lives_ok($$update public.delivery_settings set base_fee_cents=501$$,'owner can change rates');
insert into delivery_tap select throws_ok($$update public.delivery_settings set origin_address='exposed'$$,'42501',null,'owner browser cannot overwrite private routing origin');
insert into delivery_tap select isnt_empty($$select id from public.delivery_audit_events where actor_user_id='97000000-0000-4000-8000-000000000001' and action='settings_updated'$$,'owner rate changes have an attributable audit');
insert into delivery_tap select is_empty($$select id from public.delivery_audit_events where configuration::text like '%M1W%'$$,'rate audit omits the private origin');
reset role;
set local request.jwt.claim.sub = '';

create temporary table delivery_test_context as select ((now() at time zone 'America/Toronto')::date + ((1-extract(isodow from now() at time zone 'America/Toronto')::integer+7)%7)+7)::date as open_date;
grant select on delivery_test_context to service_role;
set local role service_role;
insert into public.checkout_drafts(id,access_token_hash,cart_payload,cart_fingerprint,cart_validation_snapshot,pricing_fingerprint,fulfillment_method,fulfillment_date,expires_at)
select '97000000-0000-4000-8000-000000000010',repeat('7',64),'{"version":1,"lines":[]}',repeat('8',64),'{}',repeat('9',64),'delivery',open_date,now()+interval '1 day' from delivery_test_context;

insert into delivery_tap select is(public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,0,'save','{"name":"Test only","address":{"line1":"Customer input"}}'),1,'contact save advances version');
insert into delivery_tap select throws_ok($$select public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,0,'save','{}')$$,'P0001','delivery_conflict','stale tabs cannot overwrite saved input');
insert into delivery_tap select throws_ok($$select public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,1,'confirm')$$,'P0001','delivery_quote_stale','confirmation requires a quote');
insert into delivery_tap select throws_ok($$select public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,1,'quote','{}')$$,'P0001','delivery_quote_stale','malformed quote cannot be attached');

create temporary table delivery_test_quote as select jsonb_build_object('id',gen_random_uuid(),'address',jsonb_build_object('line1','Google test address'),'requiresConfirmation',true,'feeCents',575,'subtotalCents',4000,'freeDelivery',false,'settingsVersion',version,'expiresAt',now()+interval '10 minutes','cartFingerprint',repeat('8',64),'pricingFingerprint',repeat('9',64)) as payload from public.delivery_settings;
insert into delivery_tap select is(public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,1,'quote',(select payload from delivery_test_quote)),2,'server quote attaches to the exact draft version');
insert into delivery_tap select is(public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,2,'confirm'),3,'customer explicitly confirms quote');
insert into delivery_tap select is(public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,3,'confirm'),3,'confirmed state is idempotent when current version is retried');
insert into delivery_tap select is((select count(*)::integer from public.capacity_holds where checkout_draft_id='97000000-0000-4000-8000-000000000010'),0,'details/quote confirmation never creates a capacity hold');

update public.delivery_settings set base_fee_cents=600;
insert into delivery_tap select throws_ok($$select public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,3,'confirm')$$,'P0001','delivery_quote_stale','a rate change invalidates an already confirmed quote');
insert into delivery_tap select throws_ok($$select public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,3,'quote',(select payload from delivery_test_quote))$$,'P0001','delivery_quote_stale','slow provider response cannot save an old settings version');
update public.checkout_drafts set cart_fingerprint=repeat('a',64) where id='97000000-0000-4000-8000-000000000010';
insert into delivery_tap select results_eq($$select status from public.checkout_delivery_details where checkout_draft_id='97000000-0000-4000-8000-000000000010'$$,array['unverified'],'editing the saved cart clears the address quote');
insert into delivery_tap select throws_ok($$select public.mutate_delivery_details('97000000-0000-4000-8000-000000000010',1,4,'save','{}')$$,'P0001','delivery_conflict','old draft versions cannot write after rescheduling/cart changes');

insert into delivery_tap select is((select count(*)::integer from generate_series(1,8) where public.allow_delivery_provider_request('97000000-0000-4000-8000-000000000010')),8,'first eight per-minute checks are allowed');
insert into delivery_tap select is(public.allow_delivery_provider_request('97000000-0000-4000-8000-000000000010'),false,'ninth check is rate limited');
insert into delivery_tap select is(public.allow_delivery_provider_request('97000000-0000-4000-8000-000000000099'),false,'unknown drafts cannot spend provider quota');

-- Expiry cleanup removes only verification content; customer-entered input survives.
update public.checkout_delivery_details set quote=jsonb_build_object('expiresAt',now()-interval '1 minute'),status='quoted' where checkout_draft_id='97000000-0000-4000-8000-000000000010';
reset role;
select private.cleanup_delivery_verification();
insert into delivery_tap select results_eq($$select status from public.checkout_delivery_details where checkout_draft_id='97000000-0000-4000-8000-000000000010'$$,array['unverified'],'expired provider content is removed');
insert into delivery_tap select results_eq($$select input->>'name' from public.checkout_delivery_details where checkout_draft_id='97000000-0000-4000-8000-000000000010'$$,array['Test only'],'customer-entered contact information is not removed by provider cleanup');
insert into delivery_tap select ok(exists(select 1 from cron.job where jobname='cleanup-delivery-verification' and active),'cleanup is scheduled');
insert into delivery_tap select * from finish();
do $$ begin if exists(select 1 from delivery_tap where line like 'not ok%' or line like '# Looks like%') then raise exception 'Delivery tests failed: %',(select string_agg(line,E'\n') from delivery_tap); end if; end $$;
select line from delivery_tap;
rollback;
