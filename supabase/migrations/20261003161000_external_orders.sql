-- Owner-entered off-site orders are operational records, never Stripe payments.
-- One record consumes exactly one of the shared daily capacity spaces.
create table public.external_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('EXT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  capacity_adjustment_id uuid not null unique references public.capacity_adjustments(id) on delete restrict,
  fulfillment_date date not null,
  source text not null check (source in ('phone', 'instagram', 'admin', 'other')),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone text not null check (char_length(btrim(customer_phone)) between 7 and 30),
  customer_email text check (customer_email is null or char_length(customer_email) between 3 and 254),
  recipient_name text not null check (char_length(btrim(recipient_name)) between 2 and 120),
  address_line1 text not null check (char_length(btrim(address_line1)) between 5 and 160),
  address_line2 text check (address_line2 is null or char_length(address_line2) <= 100),
  city text not null check (city in ('Toronto', 'Markham', 'Mississauga')),
  postal_code text not null check (postal_code ~ '^[A-Z][0-9][A-Z] [0-9][A-Z][0-9]$'),
  delivery_instructions text check (delivery_instructions is null or char_length(delivery_instructions) <= 500),
  items jsonb not null check (
    case when jsonb_typeof(items) = 'array'
      then jsonb_array_length(items) between 1 and 50 else false end
  ),
  fulfillment_status text not null default 'received' check (fulfillment_status in ('received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
  payment_status text not null default 'unverified' check (payment_status = 'unverified'),
  version integer not null default 1 check (version > 0),
  internal_note text check (internal_note is null or char_length(internal_note) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index external_orders_production_idx on public.external_orders(fulfillment_date, id)
  where fulfillment_status not in ('delivered', 'cancelled');
create index external_orders_adjustment_idx on public.external_orders(capacity_adjustment_id);

create table public.external_order_events (
  id bigint generated always as identity primary key,
  external_order_id uuid not null references public.external_orders(id) on delete restrict,
  version integer not null,
  from_status text,
  to_status text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  unique(external_order_id, version)
);
create index external_order_events_timeline_idx
  on public.external_order_events(external_order_id, version);

alter table public.external_orders enable row level security;
alter table public.external_orders force row level security;
revoke all on public.external_orders from public, anon, authenticated;
grant select on public.external_orders to authenticated;
create policy external_orders_owner_read on public.external_orders for select to authenticated
  using (exists (
    select 1 from public.admin_users membership
    where membership.user_id = (select auth.uid())
      and membership.role = 'owner' and membership.is_active
  ));
alter table public.external_order_events enable row level security;
alter table public.external_order_events force row level security;
revoke all on public.external_order_events from public, anon, authenticated;
grant select on public.external_order_events to authenticated;
create policy external_order_events_owner_read on public.external_order_events for select to authenticated
  using (exists (
    select 1 from public.admin_users membership
    where membership.user_id = (select auth.uid())
      and membership.role = 'owner' and membership.is_active
  ));

-- All writes use these narrow RPCs. No browser role can directly mutate rows.
create function public.create_external_order(
  p_date date, p_source text, p_customer_name text, p_customer_phone text,
  p_customer_email text, p_recipient_name text, p_address_line1 text,
  p_address_line2 text, p_city text, p_postal_code text,
  p_delivery_instructions text, p_items jsonb, p_internal_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  item jsonb;
  product public.products%rowtype;
  normalized_items jsonb := '[]'::jsonb;
  requested_quantity integer;
  adjustment_id uuid;
  new_order_id uuid;
begin
  if actor is null or not exists (
    select 1 from public.admin_users where user_id = actor and role = 'owner' and is_active
  ) then raise exception 'owner_required' using errcode = '42501'; end if;
  if private.fulfillment_date_issue('delivery', p_date) is not null then
    raise exception 'external_order_date_unavailable' using errcode = '23514';
  end if;
  if p_source not in ('phone', 'instagram', 'admin', 'other')
    or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'external_order_invalid' using errcode = '23514';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'external_order_invalid' using errcode = '23514';
  end if;
  for item in select value from jsonb_array_elements(p_items) as entries(value) loop
    if jsonb_typeof(item) is distinct from 'object'
      or item->>'productId' is null
      or item->>'quantity' is null
      or item->>'quantity' !~ '^[0-9]{1,5}$'
      or char_length(coalesce(item->>'note', '')) > 300 then
      raise exception 'external_order_item_invalid' using errcode = '23514';
    end if;
    select * into product from public.products where id = (item->>'productId')::uuid;
    requested_quantity := (item->>'quantity')::integer;
    if not found or product.status <> 'published' or not product.is_available
      or requested_quantity < product.minimum_quantity
      or requested_quantity > coalesce(product.maximum_quantity, 10000)
      or (requested_quantity - product.minimum_quantity) % product.quantity_step <> 0 then
      raise exception 'external_order_item_unavailable' using errcode = '23514';
    end if;
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'productId', product.id,
      'name', product.name,
      'quantity', requested_quantity,
      'note', nullif(btrim(coalesce(item->>'note', '')), ''),
      'baseUnitPriceCents', product.base_price_cents
    ));
  end loop;
  insert into public.capacity_adjustments (
    fulfillment_date, source, customer_reference, internal_note, created_by
  ) values (
    p_date, p_source, left(btrim(p_customer_name), 80), p_internal_note, actor
  ) returning id into adjustment_id;
  insert into public.external_orders (
    capacity_adjustment_id, fulfillment_date, source, customer_name, customer_phone,
    customer_email, recipient_name, address_line1, address_line2, city,
    postal_code, delivery_instructions, items, internal_note, created_by
  ) values (
    adjustment_id, p_date, p_source, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_customer_email, '')), ''), btrim(p_recipient_name),
    btrim(p_address_line1), nullif(btrim(coalesce(p_address_line2, '')), ''),
    p_city, upper(btrim(p_postal_code)),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), normalized_items,
    p_internal_note, actor
  ) returning id into new_order_id;
  insert into public.external_order_events(external_order_id, version, from_status, to_status, actor_user_id)
    values(new_order_id, 1, null, 'received', actor);
  return new_order_id;
end;
$$;

create function public.advance_external_order(
  p_id uuid, p_version integer, p_next_status text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  current_order public.external_orders%rowtype;
begin
  if actor is null or not exists (
    select 1 from public.admin_users where user_id = actor and role = 'owner' and is_active
  ) then raise exception 'owner_required' using errcode = '42501'; end if;
  select * into current_order from public.external_orders where id = p_id for update;
  if not found or current_order.version <> p_version then return false; end if;
  if not (
    (current_order.fulfillment_status = 'received' and p_next_status in ('preparing', 'cancelled'))
    or (current_order.fulfillment_status = 'preparing' and p_next_status = 'ready')
    or (current_order.fulfillment_status = 'ready' and p_next_status = 'out_for_delivery')
    or (current_order.fulfillment_status = 'out_for_delivery' and p_next_status = 'delivered')
  ) then raise exception 'external_order_invalid_transition' using errcode = '23514'; end if;
  update public.external_orders set fulfillment_status = p_next_status,
    version = version + 1, updated_at = now() where id = p_id;
  insert into public.external_order_events(external_order_id, version, from_status, to_status, actor_user_id)
    values(p_id, p_version + 1, current_order.fulfillment_status, p_next_status, actor);
  if p_next_status = 'cancelled' then
    update public.capacity_adjustments set status = 'released', released_at = now()
      where id = current_order.capacity_adjustment_id and status = 'active';
  end if;
  return true;
end;
$$;

-- A legacy capacity release must not orphan a tracked external order.
create function private.protect_external_order_space()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.external_orders e
    where e.capacity_adjustment_id = old.id and e.fulfillment_status <> 'cancelled'
  ) and (
    old.fulfillment_date is distinct from new.fulfillment_date
    or old.source is distinct from new.source
    or old.status is distinct from new.status
  ) then raise exception 'tracked_external_order_space' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger capacity_adjustments_external_order_guard
  before update on public.capacity_adjustments for each row
  execute function private.protect_external_order_space();

revoke all on function public.create_external_order(
  date, text, text, text, text, text, text, text, text, text, text, jsonb, text
) from public, anon;
revoke all on function public.advance_external_order(uuid, integer, text) from public, anon;
grant execute on function public.create_external_order(
  date, text, text, text, text, text, text, text, text, text, text, jsonb, text
) to authenticated;
grant execute on function public.advance_external_order(uuid, integer, text) to authenticated;
