-- Customer identity is optional. Guest ordering and access links remain valid.
-- Only the server may link a paid order after Supabase verifies its email.
alter table public.orders
  add column customer_email text generated always as
    (lower(btrim(snapshot #>> '{delivery,email}'))) stored;

create index orders_customer_email_idx on public.orders(customer_email)
  where customer_email is not null;

-- A separate append-only link avoids changing immutable paid-order rows.
-- It also means deleting an Auth account removes access without rewriting
-- purchase/refund history, which has its own retention requirements.
create table public.customer_order_links (
  order_id uuid primary key references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_placed_at timestamptz not null,
  linked_at timestamptz not null default now()
);
create index customer_order_links_history_idx
  on public.customer_order_links(user_id, order_placed_at desc, order_id desc);
alter table public.customer_order_links enable row level security;
alter table public.customer_order_links force row level security;
revoke all on public.customer_order_links from public, anon, authenticated, service_role;
grant select on public.customer_order_links to authenticated;
grant select, insert on public.customer_order_links to service_role;
create policy customer_order_links_read on public.customer_order_links
  for select to authenticated using (user_id = (select auth.uid()));

-- Defence in depth: even the privileged server cannot accidentally connect
-- an order to an unverified or different email. Never trust user metadata.
create function private.validate_customer_order_link()
returns trigger language plpgsql security definer set search_path = '' as $$
declare verified_email text; order_email text; placed_at timestamptz;
begin
  select lower(btrim(u.email)) into verified_email
  from auth.users as u
  where u.id = new.user_id and u.email_confirmed_at is not null;
  select o.customer_email, o.created_at into order_email, placed_at
  from public.orders as o where o.id = new.order_id;
  if verified_email is null or order_email is null or verified_email <> order_email then
    raise exception using errcode = '42501', message = 'customer_order_email_mismatch';
  end if;
  new.order_placed_at := placed_at;
  return new;
end;
$$;
revoke all on function private.validate_customer_order_link() from public, anon, authenticated, service_role;
create trigger customer_order_link_guard before insert on public.customer_order_links
  for each row execute function private.validate_customer_order_link();

-- The pre-existing owner policy remains in place. Customers can read only
-- orders already attached to their Auth identity, never by browser email.
create policy orders_customer_read on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.customer_order_links as link
    where link.order_id = orders.id and link.user_id = (select auth.uid())
  ));

create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100 and full_name !~ '[[:cntrl:]]'),
  phone text not null check (phone ~ '^\+1[0-9]{10}$'),
  recipient_name text not null check (char_length(recipient_name) between 1 and 100 and recipient_name !~ '[[:cntrl:]]'),
  address_line1 text not null check (char_length(address_line1) between 1 and 160 and address_line1 !~ '[[:cntrl:]]'),
  address_line2 text not null default '' check (char_length(address_line2) <= 80 and address_line2 !~ '[[:cntrl:]]'),
  city text not null check (city in ('Toronto', 'Markham', 'Mississauga')),
  province text not null default 'ON' check (province = 'ON'),
  postal_code text not null check (postal_code ~ '^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z] [0-9][ABCEGHJ-NPRSTV-Z][0-9]$'),
  country text not null default 'CA' check (country = 'CA'),
  delivery_instructions text not null default '' check (char_length(delivery_instructions) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
alter table public.customer_profiles force row level security;
revoke all on public.customer_profiles from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_profiles to service_role;

create policy customer_profiles_read on public.customer_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy customer_profiles_insert on public.customer_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy customer_profiles_update on public.customer_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy customer_profiles_delete on public.customer_profiles
  for delete to authenticated using (user_id = (select auth.uid()));
