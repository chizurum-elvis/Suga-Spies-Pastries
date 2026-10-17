begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table site_content_tap(line text);
grant all on site_content_tap to anon, authenticated, service_role;
insert into site_content_tap select no_plan();

insert into auth.users(id,email,email_confirmed_at)
values ('98600000-0000-4000-8000-000000000001','content-owner@example.com',now()),
       ('98600000-0000-4000-8000-000000000002','content-buyer@example.com',now());
insert into public.admin_users(user_id,role,is_active)
values ('98600000-0000-4000-8000-000000000001','owner',true);
create temporary table site_content_fixture as
select d.version as faq_version,
  (select version from public.site_content_publications where key='faq' and is_current) as published_faq_version,
  (select count(*)::integer from public.site_content_publications where key='faq') as faq_publications,
  (select count(*)::integer from public.site_content_publications where key='terms') as terms_publications
from public.site_content_drafts d where d.key='faq';
grant select on site_content_fixture to anon, authenticated;

insert into site_content_tap select ok(not has_table_privilege('anon','public.site_content_drafts','select'), 'anonymous visitors cannot read drafts');
insert into site_content_tap select ok(not has_table_privilege('anon','public.site_content_publications','update'), 'anonymous visitors cannot edit publications');
insert into site_content_tap select ok(not has_column_privilege('anon','public.site_content_publications','published_by','select'), 'public content does not expose the owner Auth identity');

set local role anon;
insert into site_content_tap select is((select count(*)::integer from public.site_content_publications where key = 'faq' and is_current),1,'published FAQ is public');
insert into site_content_tap select throws_ok($q$select body from public.site_content_drafts where key = 'faq'$q$,'42501',null,'FAQ draft cannot be read anonymously');
insert into site_content_tap select throws_ok($q$select public.publish_site_content('faq',1)$q$,'42501',null,'anonymous callers cannot publish');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into site_content_tap select is((select count(*)::integer from public.site_content_drafts),0,'non-owner cannot read drafts');
insert into site_content_tap select throws_ok($q$select public.publish_site_content('faq',1)$q$,'42501',null,'non-owner cannot publish');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into site_content_tap select is((select count(*)::integer from public.site_content_drafts),6,'active owner sees all drafts');
update public.site_content_drafts set body = jsonb_build_object('items',jsonb_build_array(jsonb_build_object('question','New question?','answer','New answer.'))), version = version + 1 where key='faq';
insert into site_content_tap select is((select public.publish_site_content('faq',faq_version+1) from site_content_fixture),(select faq_version+1 from site_content_fixture),'owner publishes the exact saved version');
insert into site_content_tap select is((select count(*)::integer from public.site_content_publications where key='faq'),(select faq_publications+1 from site_content_fixture),'prior publication remains in history');
insert into site_content_tap select is((select count(*)::integer from public.site_content_publications where key='faq' and is_current),1,'exactly one FAQ version is current');
insert into site_content_tap select throws_ok($q$select public.publish_site_content('faq',(select faq_version from site_content_fixture))$q$,'40001',null,'stale publication is rejected');
insert into site_content_tap select throws_ok($q$update public.site_content_publications set body='{}'::jsonb where key='faq' and version=(select published_faq_version from site_content_fixture)$q$,'P0001','Published content is immutable','historical published body cannot be rewritten');
update public.site_content_drafts set body='{"title":"Terms of sale","body":""}',version=version+1 where key='terms';
insert into site_content_tap select throws_ok($q$select public.publish_site_content('terms',(select version from public.site_content_drafts where key='terms'))$q$,'23514',null,'blank legal policy cannot be published through the API');
reset role;

set local role anon;
insert into site_content_tap select is((select body->'items'->0->>'question' from public.site_content_publications where key='faq' and is_current),'New question?','public sees owner-published FAQ');
insert into site_content_tap select is((select count(*)::integer from public.site_content_publications where key='faq'),(select faq_publications+1 from site_content_fixture),'old public version remains addressable for history');
insert into site_content_tap select is((select count(*)::integer from public.site_content_publications where key='terms'),(select terms_publications from site_content_fixture),'blank legal draft never changed published terms');
reset role;

update public.admin_users set is_active=false where user_id='98600000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"98600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into site_content_tap select is((select count(*)::integer from public.site_content_drafts),0,'revoked owner cannot read drafts');
insert into site_content_tap select throws_ok($q$select public.publish_site_content('faq',(select faq_version+1 from site_content_fixture))$q$,'42501',null,'revoked owner cannot publish');
reset role;

insert into site_content_tap select * from finish();
select line from site_content_tap;
rollback;
