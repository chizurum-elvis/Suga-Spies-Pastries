begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'owner@example.com'),
  ('90000000-0000-4000-8000-000000000002', 'stranger@example.com');
insert into public.admin_users (user_id, role, is_active)
values ('90000000-0000-4000-8000-000000000001', 'owner', true);
insert into public.categories (id, name, slug, status)
values ('91000000-0000-4000-8000-000000000001', 'Sweet', 'sweet', 'published');
insert into public.products (id, category_id, name, slug, base_price_cents, status, is_available)
values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Pastry', 'pastry', 500, 'published', true);
insert into public.product_variants (id, product_id, name, price_cents, status, is_available)
values
  ('94000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Published size', 700, 'published', true),
  ('94000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'Draft size', 900, 'draft', false);

set local role anon;
select results_eq(
  $$select name from public.product_variants where id in ('94000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002') order by name$$,
  array['Published size'],
  'anonymous visitors see published variants only'
);
select throws_ok(
  $$insert into public.product_variants (product_id, name) values ('92000000-0000-4000-8000-000000000001', 'Unsafe')$$,
  '42501',
  null,
  'anonymous visitors cannot create variants'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select results_eq(
  $$select name from public.product_variants where id in ('94000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002') order by name$$,
  array['Published size'],
  'a non-owner sees public variants only'
);
select is_empty(
  $$update public.product_variants set price_cents = 1 where name = 'Published size' returning id$$,
  'a non-owner cannot change a variant price'
);

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
select results_eq(
  $$select name from public.product_variants where id in ('94000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002') order by name$$,
  array['Draft size', 'Published size'],
  'the owner sees all variants'
);
select results_eq(
  $$update public.product_variants set price_cents = 1000 where name = 'Draft size' returning price_cents$$,
  array[1000],
  'the owner updates a variant'
);

reset role;
select results_eq(
  $$select price_cents from public.product_variants where name = 'Published size'$$,
  array[700],
  'the denied update left the variant intact'
);

select * from finish();
rollback;
