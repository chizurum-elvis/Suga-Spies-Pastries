-- Operational settings are private. No API credentials belong in this table.
create table public.business_settings (
  singleton boolean primary key default true check (singleton),
  accepting_orders boolean not null default true,
  pause_message text not null default 'We are not taking new orders just now. Please check back soon.'
    check (char_length(btrim(pause_message)) between 10 and 240),
  owner_alert_email text check (owner_alert_email is null or
    (char_length(owner_alert_email) <= 254 and owner_alert_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.business_settings(singleton) values (true);
alter table public.business_settings enable row level security;
alter table public.business_settings force row level security;
revoke all on public.business_settings from public, anon, authenticated;
grant select on public.business_settings to authenticated, service_role;
grant update(accepting_orders, pause_message, owner_alert_email) on public.business_settings to authenticated;
create policy business_settings_owner_read on public.business_settings for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
create policy business_settings_owner_update on public.business_settings for update to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));

create table public.business_settings_history (
  version integer primary key,
  accepting_orders boolean not null,
  pause_message text not null,
  owner_alert_email text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
alter table public.business_settings_history enable row level security;
alter table public.business_settings_history force row level security;
revoke all on public.business_settings_history from public, anon, authenticated;
grant select on public.business_settings_history to authenticated;
create policy business_settings_history_owner_read on public.business_settings_history for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
create function private.audit_business_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  insert into public.business_settings_history(version,accepting_orders,pause_message,owner_alert_email,changed_by)
    values(new.version,new.accepting_orders,new.pause_message,new.owner_alert_email,new.updated_by);
  return new;
end;
$$;
revoke all on function private.audit_business_settings() from public;
create trigger business_settings_audit before update on public.business_settings
for each row execute function private.audit_business_settings();

-- Serialize the pause switch with NEW payment reservations only. Existing
-- attempts, webhooks, refunds, and redeliveries continue to settle normally.
create function private.check_new_order_pause() returns trigger
language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  select accepting_orders into strict allowed from public.business_settings where singleton for share;
  if not allowed then raise exception 'new_orders_paused' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.check_new_order_pause() from public;
create trigger payment_attempts_pause_guard before insert on public.payment_attempts
for each row execute function private.check_new_order_pause();

-- Security-invoker view: underlying order/redelivery RLS still applies. The
-- additional membership condition makes this index owner-only even for customers.
create view public.admin_order_index with (security_invoker = true) as
select o.*,
  coalesce(r.selected_date, o.fulfillment_date) as delivery_date,
  o.snapshot->'delivery'->>'name' as contact_name,
  o.snapshot->'delivery'->>'email' as contact_email,
  o.snapshot->'delivery'->>'phone' as contact_phone
from public.orders o
left join public.order_redeliveries r on r.order_id = o.id and r.selected_date is not null
where exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active);
revoke all on public.admin_order_index from public, anon;
grant select on public.admin_order_index to authenticated;

create function public.owner_sales_summary(p_from date, p_to date, p_test boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active)
    then raise exception 'owner_required' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_sales_range' using errcode = '22023'; end if;
  select jsonb_build_object(
    'orders', count(*),
    'salesCents', coalesce(sum((o.snapshot->>'totalCents')::bigint),0),
    'deliveryCents', coalesce(sum((o.snapshot->>'deliveryCents')::bigint),0),
    'refundCents', coalesce(sum(coalesce(r.amount_cents,0)),0)
  ) into result from public.orders o
  left join public.order_refunds r on r.order_id = o.id and r.status = 'succeeded'
  where o.test_only = p_test
    and o.created_at >= (p_from::timestamp at time zone 'America/Toronto')
    and o.created_at < ((p_to + 1)::timestamp at time zone 'America/Toronto');
  return result;
end;
$$;
revoke all on function public.owner_sales_summary(date,date,boolean) from public, anon;
grant execute on function public.owner_sales_summary(date,date,boolean) to authenticated;
