create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'draft',
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint categories_name_check
    check (name = btrim(name) and char_length(name) between 2 and 80),
  constraint categories_slug_check
    check (
      slug = btrim(slug)
      and char_length(slug) between 2 and 80
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint categories_description_check
    check (description is null or char_length(description) <= 500),
  constraint categories_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint categories_display_order_check check (display_order >= 0)
);

comment on table public.categories is
  'Owner-managed groupings used to organise the public pastry catalogue.';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  base_price_cents integer not null,
  currency text not null default 'CAD',
  is_starting_price boolean not null default false,
  unit_label text,
  minimum_quantity integer not null default 1,
  quantity_step integer not null default 1,
  maximum_quantity integer,
  status text not null default 'draft',
  is_available boolean not null default false,
  ingredients text,
  allergen_information text,
  customer_instructions text,
  tax_category text,
  display_order integer not null default 0,
  version integer not null default 1,
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint products_name_check
    check (name = btrim(name) and char_length(name) between 2 and 120),
  constraint products_slug_check
    check (
      slug = btrim(slug)
      and char_length(slug) between 2 and 120
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint products_short_description_check
    check (
      short_description is null
      or char_length(short_description) <= 240
    ),
  constraint products_description_check
    check (description is null or char_length(description) <= 4000),
  constraint products_base_price_cents_check
    check (base_price_cents between 0 and 100000000),
  constraint products_currency_check check (currency = 'CAD'),
  constraint products_unit_label_check
    check (unit_label is null or char_length(unit_label) between 1 and 40),
  constraint products_minimum_quantity_check
    check (minimum_quantity between 1 and 10000),
  constraint products_quantity_step_check
    check (quantity_step between 1 and 10000),
  constraint products_maximum_quantity_check
    check (
      maximum_quantity is null
      or maximum_quantity between minimum_quantity and 10000
    ),
  constraint products_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint products_archived_unavailable_check
    check (status <> 'archived' or not is_available),
  constraint products_ingredients_check
    check (ingredients is null or char_length(ingredients) <= 5000),
  constraint products_allergen_information_check
    check (
      allergen_information is null
      or char_length(allergen_information) <= 3000
    ),
  constraint products_customer_instructions_check
    check (
      customer_instructions is null
      or char_length(customer_instructions) <= 2000
    ),
  constraint products_tax_category_check
    check (tax_category is null or char_length(tax_category) <= 80),
  constraint products_display_order_check check (display_order >= 0),
  constraint products_version_check check (version >= 1)
);

comment on table public.products is
  'Authoritative current pastry catalogue. Paid orders will retain immutable item snapshots separately.';
comment on column public.products.base_price_cents is
  'Current base price in integer Canadian cents; never trust a browser-supplied price.';
comment on column public.products.published_at is
  'First publication time. Once set, the public slug is immutable.';

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  source_type text not null,
  path text not null,
  alt_text text not null,
  object_position text not null default '50% 50%',
  width integer,
  height integer,
  is_primary boolean not null default false,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_images_source_type_check
    check (source_type in ('local', 'storage')),
  constraint product_images_path_check
    check (
      char_length(path) between 3 and 500
      and path !~ '\\.\\.'
      and (
        (source_type = 'local' and path ~ '^/images/[A-Za-z0-9/_-]+\\.(?:avif|jpe?g|png|webp)$')
        or
        (source_type = 'storage' and path ~ '^[A-Za-z0-9/_-]+\\.(?:avif|jpe?g|png|webp)$')
      )
    ),
  constraint product_images_alt_text_check
    check (
      alt_text = btrim(alt_text)
      and char_length(alt_text) between 3 and 240
    ),
  constraint product_images_object_position_check
    check (
      object_position ~ '^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$'
    ),
  constraint product_images_dimensions_check
    check (
      (width is null and height is null)
      or
      (width between 1 and 20000 and height between 1 and 20000)
    ),
  constraint product_images_display_order_check check (display_order >= 0)
);

comment on table public.product_images is
  'Ordered local or Supabase Storage images with accessible alternative text and crop focus.';

create unique index product_images_one_primary_per_product_idx
  on public.product_images (product_id)
  where is_primary;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  sku text,
  price_cents integer,
  minimum_quantity integer,
  quantity_step integer,
  maximum_quantity integer,
  status text not null default 'draft',
  is_available boolean not null default false,
  is_default boolean not null default false,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_variants_name_check
    check (name = btrim(name) and char_length(name) between 1 and 100),
  constraint product_variants_sku_check
    check (sku is null or char_length(sku) between 1 and 80),
  constraint product_variants_price_cents_check
    check (price_cents is null or price_cents between 0 and 100000000),
  constraint product_variants_minimum_quantity_check
    check (minimum_quantity is null or minimum_quantity between 1 and 10000),
  constraint product_variants_quantity_step_check
    check (quantity_step is null or quantity_step between 1 and 10000),
  constraint product_variants_maximum_quantity_check
    check (
      maximum_quantity is null
      or (
        maximum_quantity between 1 and 10000
        and (
          minimum_quantity is null
          or maximum_quantity >= minimum_quantity
        )
      )
    ),
  constraint product_variants_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint product_variants_archived_unavailable_check
    check (status <> 'archived' or not is_available),
  constraint product_variants_display_order_check check (display_order >= 0),
  constraint product_variants_product_name_key unique (product_id, name)
);

create unique index product_variants_sku_key
  on public.product_variants (sku)
  where sku is not null;

create unique index product_variants_one_default_per_product_idx
  on public.product_variants (product_id)
  where is_default and status <> 'archived';

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  description text,
  selection_type text not null,
  is_required boolean not null default false,
  minimum_selections integer not null default 0,
  maximum_selections integer,
  status text not null default 'draft',
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_option_groups_name_check
    check (name = btrim(name) and char_length(name) between 1 and 100),
  constraint product_option_groups_description_check
    check (description is null or char_length(description) <= 500),
  constraint product_option_groups_selection_type_check
    check (selection_type in ('single', 'multiple', 'quantity')),
  constraint product_option_groups_minimum_selections_check
    check (minimum_selections between 0 and 10000),
  constraint product_option_groups_maximum_selections_check
    check (
      maximum_selections is null
      or maximum_selections between greatest(minimum_selections, 1) and 10000
    ),
  constraint product_option_groups_required_minimum_check
    check (not is_required or minimum_selections >= 1),
  constraint product_option_groups_single_limits_check
    check (
      selection_type <> 'single'
      or (
        minimum_selections <= 1
        and (maximum_selections is null or maximum_selections = 1)
      )
    ),
  constraint product_option_groups_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint product_option_groups_display_order_check check (display_order >= 0),
  constraint product_option_groups_product_name_key unique (product_id, name)
);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.product_option_groups (id) on delete cascade,
  name text not null,
  description text,
  price_delta_cents integer not null default 0,
  status text not null default 'draft',
  is_available boolean not null default false,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_option_values_name_check
    check (name = btrim(name) and char_length(name) between 1 and 100),
  constraint product_option_values_description_check
    check (description is null or char_length(description) <= 500),
  constraint product_option_values_price_delta_cents_check
    check (price_delta_cents between 0 and 100000000),
  constraint product_option_values_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint product_option_values_archived_unavailable_check
    check (status <> 'archived' or not is_available),
  constraint product_option_values_display_order_check check (display_order >= 0),
  constraint product_option_values_group_name_key unique (option_group_id, name)
);

create table public.catalog_audit_events (
  id bigint generated always as identity primary key,
  entity_table text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamp with time zone not null default now(),
  constraint catalog_audit_events_entity_table_check
    check (
      entity_table in (
        'categories',
        'products',
        'product_images',
        'product_variants',
        'product_option_groups',
        'product_option_values'
      )
    ),
  constraint catalog_audit_events_action_check
    check (action in ('insert', 'update', 'delete')),
  constraint catalog_audit_events_payload_check
    check (before_data is not null or after_data is not null)
);

comment on table public.catalog_audit_events is
  'Append-only evidence of catalogue changes. Application roles cannot create, update, or delete events directly.';

create index products_category_id_idx on public.products (category_id);
create index products_public_listing_idx
  on public.products (category_id, display_order, id)
  where status = 'published';
create index product_images_product_id_idx
  on public.product_images (product_id, display_order, id);
create index product_variants_product_id_idx
  on public.product_variants (product_id, display_order, id);
create index product_option_groups_product_id_idx
  on public.product_option_groups (product_id, display_order, id);
create index product_option_values_option_group_id_idx
  on public.product_option_values (option_group_id, display_order, id);
create index catalog_audit_events_entity_idx
  on public.catalog_audit_events (entity_table, entity_id, occurred_at desc);
create index catalog_audit_events_actor_user_id_idx
  on public.catalog_audit_events (actor_user_id)
  where actor_user_id is not null;

create or replace function private.catalog_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.catalog_prepare_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.published_at is not null and new.slug is distinct from old.slug then
      raise exception using
        errcode = '23514',
        message = 'A published product slug cannot be changed.';
    end if;

    new.version = old.version + 1;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;

  if new.status = 'archived' then
    new.is_available = false;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.capture_catalog_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_id uuid;
begin
  affected_id = coalesce(
    (to_jsonb(new) ->> 'id')::uuid,
    (to_jsonb(old) ->> 'id')::uuid
  );

  insert into public.catalog_audit_events (
    entity_table,
    entity_id,
    action,
    actor_user_id,
    before_data,
    after_data
  )
  values (
    tg_table_name,
    affected_id,
    lower(tg_op),
    (select auth.uid()),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.catalog_set_updated_at() from public;
revoke all on function private.catalog_prepare_product() from public;
revoke all on function private.capture_catalog_audit_event() from public;

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.catalog_set_updated_at();

create trigger products_prepare
before insert or update on public.products
for each row execute function private.catalog_prepare_product();

create trigger product_images_set_updated_at
before update on public.product_images
for each row execute function private.catalog_set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function private.catalog_set_updated_at();

create trigger product_option_groups_set_updated_at
before update on public.product_option_groups
for each row execute function private.catalog_set_updated_at();

create trigger product_option_values_set_updated_at
before update on public.product_option_values
for each row execute function private.catalog_set_updated_at();

create trigger categories_audit
after insert or update or delete on public.categories
for each row execute function private.capture_catalog_audit_event();

create trigger products_audit
after insert or update or delete on public.products
for each row execute function private.capture_catalog_audit_event();

create trigger product_images_audit
after insert or update or delete on public.product_images
for each row execute function private.capture_catalog_audit_event();

create trigger product_variants_audit
after insert or update or delete on public.product_variants
for each row execute function private.capture_catalog_audit_event();

create trigger product_option_groups_audit
after insert or update or delete on public.product_option_groups
for each row execute function private.capture_catalog_audit_event();

create trigger product_option_values_audit
after insert or update or delete on public.product_option_values
for each row execute function private.capture_catalog_audit_event();

alter table public.categories enable row level security;
alter table public.categories force row level security;
alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.product_images enable row level security;
alter table public.product_images force row level security;
alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_option_groups force row level security;
alter table public.product_option_values enable row level security;
alter table public.product_option_values force row level security;
alter table public.catalog_audit_events enable row level security;
alter table public.catalog_audit_events force row level security;

revoke all on table public.categories from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.product_images from anon, authenticated;
revoke all on table public.product_variants from anon, authenticated;
revoke all on table public.product_option_groups from anon, authenticated;
revoke all on table public.product_option_values from anon, authenticated;
revoke all on table public.catalog_audit_events from anon, authenticated;
revoke all on sequence public.catalog_audit_events_id_seq from anon, authenticated;

grant select on table public.categories to anon, authenticated;
grant insert, update on table public.categories to authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update on table public.products to authenticated;
grant select on table public.product_images to anon, authenticated;
grant insert, update, delete on table public.product_images to authenticated;
grant select on table public.product_variants to anon, authenticated;
grant insert, update on table public.product_variants to authenticated;
grant select on table public.product_option_groups to anon, authenticated;
grant insert, update on table public.product_option_groups to authenticated;
grant select on table public.product_option_values to anon, authenticated;
grant insert, update on table public.product_option_values to authenticated;
grant select on table public.catalog_audit_events to authenticated;

create policy categories_public_select
  on public.categories
  for select
  to anon, authenticated
  using (status = 'published');

create policy categories_owner_select
  on public.categories
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy categories_owner_insert
  on public.categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy categories_owner_update
  on public.categories
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy products_public_select
  on public.products
  for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.categories
      where categories.id = products.category_id
        and categories.status = 'published'
    )
  );

create policy products_owner_select
  on public.products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy products_owner_insert
  on public.products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy products_owner_update
  on public.products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_public_select
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.status = 'published'
    )
  );

create policy product_images_owner_select
  on public.product_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_owner_insert
  on public.product_images
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_owner_update
  on public.product_images
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_owner_delete
  on public.product_images
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_variants_public_select
  on public.product_variants
  for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.products
      where products.id = product_variants.product_id
        and products.status = 'published'
    )
  );

create policy product_variants_owner_select
  on public.product_variants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_variants_owner_insert
  on public.product_variants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_variants_owner_update
  on public.product_variants
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_option_groups_public_select
  on public.product_option_groups
  for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.products
      where products.id = product_option_groups.product_id
        and products.status = 'published'
    )
  );

create policy product_option_groups_owner_select
  on public.product_option_groups
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_option_groups_owner_insert
  on public.product_option_groups
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_option_groups_owner_update
  on public.product_option_groups
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_option_values_public_select
  on public.product_option_values
  for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.product_option_groups
      where product_option_groups.id = product_option_values.option_group_id
        and product_option_groups.status = 'published'
    )
  );

create policy product_option_values_owner_select
  on public.product_option_values
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_option_values_owner_insert
  on public.product_option_values
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_option_values_owner_update
  on public.product_option_values
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy catalog_audit_events_owner_select
  on public.catalog_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/avif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_storage_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_storage_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_storage_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  )
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );

create policy product_images_storage_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_users as owner_membership
      where owner_membership.user_id = (select auth.uid())
        and owner_membership.role = 'owner'
        and owner_membership.is_active
    )
  );
