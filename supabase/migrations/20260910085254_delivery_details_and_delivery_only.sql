-- Forward-only retirement: preserve expired checkout history, never turn it into delivery.
update public.checkout_drafts set status = 'expired'
where fulfillment_method <> 'delivery';
update public.capacity_holds set status = 'expired'
where status = 'active' and checkout_draft_id in (
  select id from public.checkout_drafts where fulfillment_method <> 'delivery'
);
delete from public.fulfillment_hours where fulfillment_method <> 'delivery';
delete from public.fulfillment_blackouts where scope = 'pickup';
update public.fulfillment_blackouts set scope = 'delivery' where scope = 'both';
alter table public.fulfillment_hours drop constraint fulfillment_hours_method_check;
alter table public.fulfillment_hours add constraint fulfillment_hours_method_check check (fulfillment_method = 'delivery');
alter table public.fulfillment_blackouts drop constraint fulfillment_blackouts_scope_check;
alter table public.fulfillment_blackouts alter column scope set default 'delivery';
alter table public.fulfillment_blackouts add constraint fulfillment_blackouts_scope_check check (scope = 'delivery');
alter table public.checkout_drafts drop constraint checkout_drafts_method_check;
alter table public.checkout_drafts add constraint checkout_drafts_method_check check (fulfillment_method = 'delivery' or status = 'expired');
alter table public.checkout_drafts drop constraint checkout_drafts_status_check;
alter table public.checkout_drafts add constraint checkout_drafts_status_check
check (status in ('selecting', 'ready_for_details', 'ready_for_payment', 'expired'));
comment on table public.capacity_holds is 'Fifteen-minute payment-stage holds. Saving delivery details never reserves capacity.';

create table public.delivery_settings (
  singleton boolean primary key default true check (singleton),
  version integer not null default 1 check (version > 0),
  origin_address text not null check (char_length(origin_address) between 6 and 300),
  allowed_cities text[] not null default array['Toronto', 'Markham', 'Mississauga']
    check (cardinality(allowed_cities) between 1 and 3 and allowed_cities <@ array['Toronto', 'Markham', 'Mississauga']),
  base_distance_meters integer not null default 3000 check (base_distance_meters between 0 and 30000),
  base_fee_cents integer not null default 500 check (base_fee_cents between 0 and 100000),
  extra_km_fee_cents integer not null default 150 check (extra_km_fee_cents between 0 and 10000),
  maximum_distance_meters integer not null default 30000 check (maximum_distance_meters between 1 and 30000),
  free_delivery_threshold_cents integer not null default 10000 check (free_delivery_threshold_cents between 0 and 1000000),
  quote_minutes integer not null default 15 check (quote_minutes between 1 and 60),
  updated_at timestamptz not null default now(),
  check (base_distance_meters <= maximum_distance_meters)
);
comment on table public.delivery_settings is 'Protected delivery pricing and routing origin. Never expose origin or full configuration in customer responses.';
insert into public.delivery_settings (origin_address) values ('M1W 2Y3, Toronto, Ontario, Canada');

create table public.checkout_delivery_details (
  checkout_draft_id uuid primary key references public.checkout_drafts(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  quote jsonb check (quote is null or jsonb_typeof(quote) = 'object'),
  status text not null default 'unverified' check (status in ('unverified', 'quoted', 'confirmed')),
  updated_at timestamptz not null default now(),
  check ((status = 'unverified' and quote is null) or (status in ('quoted', 'confirmed') and quote is not null))
);
comment on table public.checkout_delivery_details is 'Guest contact and address intent, restricted to its checkout cookie through server endpoints. No raw provider payloads or coordinates.';

create table public.delivery_audit_events (
  id bigint generated always as identity primary key,
  checkout_draft_id uuid references public.checkout_drafts(id) on delete cascade,
  action text not null check (action in ('details_saved', 'quote_created', 'address_confirmed', 'settings_updated')),
  actor_user_id uuid references auth.users(id) on delete set null,
  version integer not null,
  configuration jsonb,
  occurred_at timestamptz not null default now()
);
create index delivery_audit_draft_idx on public.delivery_audit_events(checkout_draft_id, occurred_at);
create index delivery_audit_actor_idx on public.delivery_audit_events(actor_user_id) where actor_user_id is not null;

create table public.delivery_request_limits (
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (bucket, window_start)
);

alter table public.delivery_settings enable row level security;
alter table public.delivery_settings force row level security;
alter table public.checkout_delivery_details enable row level security;
alter table public.checkout_delivery_details force row level security;
alter table public.delivery_audit_events enable row level security;
alter table public.delivery_audit_events force row level security;
alter table public.delivery_request_limits enable row level security;
alter table public.delivery_request_limits force row level security;
revoke all on public.delivery_settings, public.checkout_delivery_details, public.delivery_audit_events, public.delivery_request_limits from public, anon, authenticated;
revoke all on sequence public.delivery_audit_events_id_seq from public, anon, authenticated;
grant select, insert, update, delete on public.delivery_settings, public.checkout_delivery_details, public.delivery_audit_events, public.delivery_request_limits to service_role;
grant usage, select on sequence public.delivery_audit_events_id_seq to service_role;
grant select on public.delivery_settings, public.delivery_audit_events to authenticated;
grant update (base_distance_meters, base_fee_cents, extra_km_fee_cents, maximum_distance_meters, free_delivery_threshold_cents) on public.delivery_settings to authenticated;
create policy delivery_settings_owner_read on public.delivery_settings for select to authenticated
using (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and is_active and role = 'owner'));
create policy delivery_settings_owner_update on public.delivery_settings for update to authenticated
using (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and is_active and role = 'owner'))
with check (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and is_active and role = 'owner'));
create policy delivery_audit_owner_read on public.delivery_audit_events for select to authenticated
using (exists(select 1 from public.admin_users where user_id = (select auth.uid()) and is_active and role = 'owner'));

create function private.delivery_settings_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.version = old.version + 1;
  new.updated_at = now();
  insert into public.delivery_audit_events(action, actor_user_id, version, configuration)
  values ('settings_updated', auth.uid(), new.version, jsonb_build_object('before', to_jsonb(old) - 'origin_address', 'after', to_jsonb(new) - 'origin_address'));
  return new;
end;
$$;
revoke all on function private.delivery_settings_version() from public, anon, authenticated;
create trigger delivery_settings_version before update on public.delivery_settings
for each row execute function private.delivery_settings_version();

-- Serialize writes per draft. A slow Google result cannot overwrite a newer tab/edit.
create function public.mutate_delivery_details(
  p_draft_id uuid, p_draft_version integer, p_details_version integer,
  p_action text, p_payload jsonb default '{}'::jsonb
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  draft public.checkout_drafts%rowtype;
  details public.checkout_delivery_details%rowtype;
  settings public.delivery_settings%rowtype;
  new_version integer;
begin
  select * into draft from public.checkout_drafts where id = p_draft_id for update;
  if not found or draft.expires_at <= now() or draft.status <> 'ready_for_details' or draft.fulfillment_method <> 'delivery' then
    raise exception 'delivery_draft_expired';
  end if;
  if draft.version <> p_draft_version then raise exception 'delivery_conflict'; end if;
  if private.fulfillment_slot_issue('delivery', draft.fulfillment_date, draft.fulfillment_time) is not null then
    raise exception 'delivery_schedule_changed';
  end if;
  select * into details from public.checkout_delivery_details where checkout_draft_id = draft.id for update;
  if coalesce(details.version, 0) <> p_details_version then raise exception 'delivery_conflict'; end if;
  select * into strict settings from public.delivery_settings where singleton for share;
  new_version = p_details_version + 1;
  if p_action = 'save' then
    if jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_delivery_input'; end if;
    insert into public.checkout_delivery_details(checkout_draft_id, version, input)
    values (draft.id, new_version, p_payload)
    on conflict (checkout_draft_id) do update
    set input = excluded.input, version = excluded.version, status = 'unverified', quote = null, updated_at = now();
  elsif p_action = 'quote' then
    if details.checkout_draft_id is null
      or (p_payload->>'settingsVersion')::integer is distinct from settings.version
      or (p_payload->>'expiresAt') is null
      or (p_payload->>'expiresAt')::timestamptz <= now()
      or (p_payload->>'expiresAt')::timestamptz > least(now() + make_interval(mins => settings.quote_minutes), draft.expires_at)
      or (p_payload->>'cartFingerprint') is distinct from draft.cart_fingerprint
      or (p_payload->>'pricingFingerprint') is distinct from draft.pricing_fingerprint then
      raise exception 'delivery_quote_stale';
    end if;
    update public.checkout_delivery_details set quote = p_payload, status = 'quoted', version = new_version, updated_at = now()
    where checkout_draft_id = draft.id;
  elsif p_action = 'confirm' then
    if details.quote is null or (details.quote->>'expiresAt') is null or (details.quote->>'expiresAt')::timestamptz <= now()
      or (details.quote->>'settingsVersion')::integer is distinct from settings.version
      or (details.quote->>'cartFingerprint') is distinct from draft.cart_fingerprint
      or (details.quote->>'pricingFingerprint') is distinct from draft.pricing_fingerprint then
      raise exception 'delivery_quote_stale';
    end if;
    if details.status = 'confirmed' then return details.version; end if;
    update public.checkout_delivery_details set status = 'confirmed', version = new_version, updated_at = now()
    where checkout_draft_id = draft.id;
  else
    raise exception 'invalid_delivery_action';
  end if;
  insert into public.delivery_audit_events(checkout_draft_id, action, version)
  values (draft.id, case p_action when 'save' then 'details_saved' when 'quote' then 'quote_created' else 'address_confirmed' end, new_version);
  return new_version;
end;
$$;
revoke all on function public.mutate_delivery_details(uuid, integer, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.mutate_delivery_details(uuid, integer, integer, text, jsonb) to service_role;

create function private.invalidate_delivery_details() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if row(new.cart_fingerprint, new.pricing_fingerprint, new.fulfillment_at, new.status)
    is distinct from row(old.cart_fingerprint, old.pricing_fingerprint, old.fulfillment_at, old.status) then
    update public.checkout_delivery_details set quote = null, status = 'unverified', version = version + 1, updated_at = now()
    where checkout_draft_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.invalidate_delivery_details() from public, anon, authenticated;
create trigger checkout_drafts_invalidate_delivery after update on public.checkout_drafts
for each row execute function private.invalidate_delivery_details();

-- Shared database counters protect paid Google requests across server instances.
create function public.allow_delivery_provider_request(p_draft_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_count integer;
begin
  if not exists(select 1 from public.checkout_drafts where id = p_draft_id and fulfillment_method = 'delivery' and status = 'ready_for_details' and expires_at > now()) then return false; end if;
  delete from public.delivery_request_limits where window_start < now() - interval '2 days';
  insert into public.delivery_request_limits(bucket, window_start, request_count)
  values (p_draft_id::text, date_trunc('minute', now()), 1)
  on conflict (bucket, window_start) do update set request_count = public.delivery_request_limits.request_count + 1
  returning request_count into current_count;
  if current_count > 8 then return false; end if;
  insert into public.delivery_request_limits(bucket, window_start, request_count)
  values ('global', date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 1)
  on conflict (bucket, window_start) do update set request_count = public.delivery_request_limits.request_count + 1
  returning request_count into current_count;
  return current_count <= 500;
end;
$$;
revoke all on function public.allow_delivery_provider_request(uuid) from public, anon, authenticated;
grant execute on function public.allow_delivery_provider_request(uuid) to service_role;

-- Provider-normalized addresses are temporary verification data, not an address book.
-- Raw driving distance, route geometry, coordinates and full responses are never stored.
create function private.cleanup_delivery_verification() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.checkout_delivery_details
  set quote = null, status = 'unverified', version = version + 1, updated_at = now()
  where quote is not null and (quote->>'expiresAt')::timestamptz <= now();
  delete from public.delivery_request_limits where window_start < now() - interval '2 days';
end;
$$;
revoke all on function private.cleanup_delivery_verification() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('cleanup-delivery-verification', '17 * * * *', 'select private.cleanup_delivery_verification()');

create or replace function private.fulfillment_slot_issue(
  requested_method text,
  requested_date date,
  requested_time time without time zone,
  evaluated_at timestamp with time zone default now()
)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  settings public.fulfillment_settings%rowtype;
  hours public.fulfillment_hours%rowtype;
  toronto_today date;
  seconds_from_open numeric;
begin
  select * into strict settings
  from public.fulfillment_settings
  where singleton;

  if requested_method is distinct from 'delivery' then
    return 'invalid_method';
  end if;

  toronto_today = (evaluated_at at time zone settings.business_timezone)::date;

  if requested_date < toronto_today + settings.minimum_notice_days then
    return 'insufficient_notice';
  end if;

  if requested_date > (toronto_today + make_interval(months => settings.booking_horizon_months))::date then
    return 'beyond_horizon';
  end if;

  if extract(month from requested_date) = 12
    and extract(day from requested_date) = 25 then
    return 'closed_holiday';
  end if;

  select * into hours
  from public.fulfillment_hours
  where fulfillment_method = requested_method
    and iso_weekday = extract(isodow from requested_date)::smallint
    and is_enabled;

  if not found then
    return 'closed_weekday';
  end if;

  if requested_time < hours.opens_at or requested_time > hours.last_slot_at then
    return 'outside_hours';
  end if;

  seconds_from_open = extract(epoch from (requested_time - hours.opens_at));
  if mod(seconds_from_open, settings.slot_interval_minutes * 60) <> 0 then
    return 'invalid_interval';
  end if;

  if exists (
    select 1
    from public.fulfillment_blackouts as blackout
    where blackout.fulfillment_date = requested_date
      and blackout.scope = 'delivery'
      and (
        (blackout.starts_at is null and blackout.ends_at is null)
        or
        (
          blackout.starts_at is not null
          and requested_time >= blackout.starts_at
          and requested_time < blackout.ends_at
        )
      )
  ) then
    return 'blackout';
  end if;

  return null;
end;
$$;
