alter policy categories_public_select
  on public.categories
  to anon;

drop policy categories_owner_select on public.categories;

create policy categories_authenticated_select
  on public.categories
  for select
  to authenticated
  using (
    status = 'published'
    or exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

alter policy products_public_select
  on public.products
  to anon;

drop policy products_owner_select on public.products;

create policy products_authenticated_select
  on public.products
  for select
  to authenticated
  using (
    (
      status = 'published'
      and exists (
        select 1
        from public.categories
        where categories.id = products.category_id
          and categories.status = 'published'
      )
    )
    or exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

alter policy product_images_public_select
  on public.product_images
  to anon;

drop policy product_images_owner_select on public.product_images;

create policy product_images_authenticated_select
  on public.product_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.status = 'published'
    )
    or exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

alter policy product_variants_public_select
  on public.product_variants
  to anon;

drop policy product_variants_owner_select on public.product_variants;

create policy product_variants_authenticated_select
  on public.product_variants
  for select
  to authenticated
  using (
    (
      status = 'published'
      and exists (
        select 1
        from public.products
        where products.id = product_variants.product_id
          and products.status = 'published'
      )
    )
    or exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

alter policy product_option_groups_public_select
  on public.product_option_groups
  to anon;

drop policy product_option_groups_owner_select
  on public.product_option_groups;

create policy product_option_groups_authenticated_select
  on public.product_option_groups
  for select
  to authenticated
  using (
    (
      status = 'published'
      and exists (
        select 1
        from public.products
        where products.id = product_option_groups.product_id
          and products.status = 'published'
      )
    )
    or exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

alter policy product_option_values_public_select
  on public.product_option_values
  to anon;

drop policy product_option_values_owner_select
  on public.product_option_values;

create policy product_option_values_authenticated_select
  on public.product_option_values
  for select
  to authenticated
  using (
    (
      status = 'published'
      and exists (
        select 1
        from public.product_option_groups
        where product_option_groups.id = product_option_values.option_group_id
          and product_option_groups.status = 'published'
      )
    )
    or exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );
