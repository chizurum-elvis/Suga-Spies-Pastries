begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'owner@example.com'),
  ('90000000-0000-4000-8000-000000000002', 'stranger@example.com');

insert into public.admin_users (user_id, role, is_active)
values ('90000000-0000-4000-8000-000000000001', 'owner', true);

insert into public.categories (id, name, slug, status, display_order)
values
  ('91000000-0000-4000-8000-000000000001', 'Published', 'published', 'published', 1),
  ('91000000-0000-4000-8000-000000000002', 'Draft', 'draft', 'draft', 2);

select ok(
  has_table_privilege('anon', 'public.categories', 'select')
  and not has_table_privilege('anon', 'public.categories', 'insert,update,delete'),
  'anonymous visitors have read-only table privileges'
);

set local role anon;
select results_eq(
  $$select slug from public.categories where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002') order by slug$$,
  array['published'],
  'anonymous visitors see published categories only'
);
select throws_ok(
  $$insert into public.categories (name, slug) values ('Unsafe', 'unsafe')$$,
  '42501',
  null,
  'anonymous visitors cannot create categories'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select results_eq(
  $$select slug from public.categories where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002') order by slug$$,
  array['published'],
  'a non-owner sees the same public category set'
);
select is_empty(
  $$update public.categories set name = 'Stolen' where slug = 'published' returning id$$,
  'a non-owner cannot update a published category'
);
select throws_ok(
  $$insert into public.categories (name, slug) values ('Stolen', 'stolen')$$,
  '42501',
  null,
  'a non-owner cannot create a category'
);

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
select results_eq(
  $$select slug from public.categories where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002') order by slug$$,
  array['draft', 'published'],
  'the active owner sees drafts and published categories'
);
select results_eq(
  $$insert into public.categories (name, slug) values ('New category', 'new-category') returning slug$$,
  array['new-category'],
  'the active owner creates a category'
);
select results_eq(
  $$update public.categories set name = 'Updated draft' where slug = 'draft' returning name$$,
  array['Updated draft'],
  'the active owner updates a category'
);

reset role;
select results_eq(
  $$select name from public.categories where slug = 'published'$$,
  array['Published'],
  'the denied update left the published category intact'
);
select ok(
  not has_table_privilege('authenticated', 'public.categories', 'delete'),
  'website sessions cannot hard-delete categories'
);

select * from finish();
rollback;
