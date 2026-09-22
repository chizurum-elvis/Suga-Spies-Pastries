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
insert into public.categories (id, name, slug, status)
values ('91000000-0000-4000-8000-000000000001', 'Sweet', 'sweet', 'published');
insert into public.products (
  id, category_id, name, slug, base_price_cents, status, is_available
)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Published pastry', 'published-pastry', 500, 'published', true),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'Draft pastry', 'draft-pastry', 700, 'draft', false);

select ok(
  has_table_privilege('anon', 'public.products', 'select')
  and not has_table_privilege('anon', 'public.products', 'insert,update,delete'),
  'anonymous visitors have read-only product privileges'
);
set local role anon;
select results_eq(
  $$select slug from public.products where id in ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002') order by slug$$,
  array['published-pastry'],
  'anonymous visitors see published products only'
);
select throws_ok(
  $$insert into public.products (category_id, name, slug, base_price_cents) values ('91000000-0000-4000-8000-000000000001', 'Unsafe pastry', 'unsafe-pastry', 1)$$,
  '42501',
  null,
  'anonymous visitors cannot create products'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select results_eq(
  $$select slug from public.products where id in ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002') order by slug$$,
  array['published-pastry'],
  'a non-owner sees only the public product set'
);
select is_empty(
  $$update public.products set base_price_cents = 1 where slug = 'published-pastry' returning id$$,
  'a non-owner cannot change a product price'
);

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
select results_eq(
  $$select slug from public.products where id in ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002') order by slug$$,
  array['draft-pastry', 'published-pastry'],
  'the owner sees draft and published products'
);
select results_eq(
  $$update public.products set base_price_cents = 800 where slug = 'draft-pastry' returning base_price_cents$$,
  array[800],
  'the owner updates a product'
);
select results_eq(
  $$select version from public.products where slug = 'draft-pastry'$$,
  array[2],
  'an update increments the optimistic version'
);
select throws_ok(
  $$update public.products set slug = 'changed-published-slug' where slug = 'published-pastry'$$,
  '23514',
  'A published product slug cannot be changed.',
  'a public product slug remains stable after publication'
);

reset role;
select results_eq(
  $$select base_price_cents from public.products where slug = 'published-pastry'$$,
  array[500],
  'the denied price update left the product intact'
);
select ok(
  not has_table_privilege('authenticated', 'public.products', 'delete'),
  'website sessions cannot hard-delete products'
);

select * from finish();
rollback;
