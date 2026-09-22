begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'owner@example.com'),
  ('90000000-0000-4000-8000-000000000002', 'stranger@example.com');
insert into public.admin_users (user_id, role, is_active)
values ('90000000-0000-4000-8000-000000000001', 'owner', true);
insert into public.categories (id, name, slug, status)
values ('91000000-0000-4000-8000-000000000001', 'Sweet', 'sweet', 'published');
insert into public.products (id, category_id, name, slug, base_price_cents, status, is_available)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Published pastry', 'published-pastry', 500, 'published', true),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'Draft pastry', 'draft-pastry', 500, 'draft', false);
insert into public.product_images (id, product_id, source_type, path, alt_text, is_primary)
values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'local', '/images/public.jpg', 'Published pastry image', true),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'local', '/images/draft.jpg', 'Draft pastry image', true);

set local role anon;
select results_eq(
  $$select path from public.product_images where id in ('93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002') order by path$$,
  array['/images/public.jpg'],
  'anonymous visitors see images for published products only'
);
select throws_ok(
  $$delete from public.product_images where id = '93000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anonymous visitors cannot remove product images'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select results_eq(
  $$select path from public.product_images where id in ('93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002') order by path$$,
  array['/images/public.jpg'],
  'a non-owner sees public images only'
);
select is_empty(
  $$update public.product_images set alt_text = 'Stolen image' where id = '93000000-0000-4000-8000-000000000001' returning id$$,
  'a non-owner cannot edit image metadata'
);

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
select results_eq(
  $$select path from public.product_images where id in ('93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002') order by path$$,
  array['/images/draft.jpg', '/images/public.jpg'],
  'the owner sees images for every product state'
);
select results_eq(
  $$update public.product_images set alt_text = 'Updated pastry image' where id = '93000000-0000-4000-8000-000000000002' returning alt_text$$,
  array['Updated pastry image'],
  'the owner edits image metadata'
);
select results_eq(
  $$delete from public.product_images where id = '93000000-0000-4000-8000-000000000002' returning path$$,
  array['/images/draft.jpg'],
  'the owner removes an image record'
);

reset role;
select results_eq(
  $$select alt_text from public.product_images where id = '93000000-0000-4000-8000-000000000001'$$,
  array['Published pastry image'],
  'the denied edit left the public image intact'
);

select * from finish();
rollback;
