create table public.fulfillment_settings (
  singleton boolean primary key default true,
  business_timezone text not null default 'America/Toronto',
  minimum_notice_days smallint not null default 2,
  booking_horizon_months smallint not null default 2,
  daily_capacity smallint not null default 4,
  hold_minutes smallint not null default 15,
  slot_interval_minutes smallint not null default 30,
  updated_at timestamp with time zone not null default now(),
  constraint fulfillment_settings_singleton_check check (singleton),
  constraint fulfillment_settings_timezone_check
    check (business_timezone = 'America/Toronto'),
  constraint fulfillment_settings_notice_check
    check (minimum_notice_days between 1 and 30),
  constraint fulfillment_settings_horizon_check
    check (booking_horizon_months between 1 and 12),
  constraint fulfillment_settings_capacity_check check (daily_capacity = 4),
  constraint fulfillment_settings_hold_check check (hold_minutes between 1 and 60),
  constraint fulfillment_settings_slot_interval_check
    check (slot_interval_minutes in (15, 30, 60))
);

comment on table public.fulfillment_settings is
  'Protected source of truth for Toronto scheduling, booking, and hard daily capacity rules.';

create table public.fulfillment_hours (
  id uuid primary key default gen_random_uuid(),
  fulfillment_method text not null,
  iso_weekday smallint not null,
  opens_at time without time zone not null,
  last_slot_at time without time zone not null,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fulfillment_hours_method_check
    check (fulfillment_method in ('delivery', 'pickup')),
  constraint fulfillment_hours_weekday_check check (iso_weekday between 1 and 7),
  constraint fulfillment_hours_range_check check (opens_at <= last_slot_at),
  constraint fulfillment_hours_method_weekday_key
    unique (fulfillment_method, iso_weekday)
);

comment on table public.fulfillment_hours is
  'Owner-visible weekly opening and final selectable fulfillment times in America/Toronto.';

create table public.fulfillment_blackouts (
  id uuid primary key default gen_random_uuid(),
  fulfillment_date date not null,
  scope text not null default 'both',
  starts_at time without time zone,
  ends_at time without time zone,
  public_reason text,
  internal_note text,
  version integer not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fulfillment_blackouts_scope_check
    check (scope in ('both', 'delivery', 'pickup')),
  constraint fulfillment_blackouts_time_pair_check
    check (
      (starts_at is null and ends_at is null)
      or
      (starts_at is not null and ends_at is not null and starts_at < ends_at)
    ),
  constraint fulfillment_blackouts_public_reason_check
    check (
      public_reason is null
      or (
        public_reason = btrim(public_reason)
        and char_length(public_reason) between 2 and 120
      )
    ),
  constraint fulfillment_blackouts_internal_note_check
    check (internal_note is null or char_length(internal_note) <= 500),
  constraint fulfillment_blackouts_version_check check (version >= 1)
);

comment on table public.fulfillment_blackouts is
  'Owner-created full-day or partial-time closures. Internal notes are never returned to customers.';

create table public.checkout_drafts (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique,
  cart_payload jsonb not null,
  cart_fingerprint text not null,
  cart_validation_snapshot jsonb not null,
  pricing_fingerprint text not null,
  fulfillment_method text not null,
  fulfillment_date date not null,
  fulfillment_time time without time zone not null,
  fulfillment_at timestamp with time zone not null,
  status text not null default 'ready_for_details',
  schema_version integer not null default 1,
  version integer not null default 1,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint checkout_drafts_token_hash_check
    check (access_token_hash ~ '^[0-9a-f]{64}$'),
  constraint checkout_drafts_cart_payload_check
    check (jsonb_typeof(cart_payload) = 'object'),
  constraint checkout_drafts_cart_validation_snapshot_check
    check (jsonb_typeof(cart_validation_snapshot) = 'object'),
  constraint checkout_drafts_cart_fingerprint_check
    check (cart_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint checkout_drafts_pricing_fingerprint_check
    check (pricing_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint checkout_drafts_method_check
    check (fulfillment_method in ('delivery', 'pickup')),
  constraint checkout_drafts_status_check
    check (
      status in (
        'selecting',
        'ready_for_details',
        'pickup_pending_approval',
        'pickup_approved',
        'ready_for_payment',
        'expired'
      )
    ),
  constraint checkout_drafts_schema_version_check check (schema_version = 1),
  constraint checkout_drafts_version_check check (version >= 1),
  constraint checkout_drafts_expiry_check check (expires_at > created_at),
  constraint checkout_drafts_toronto_date_check
    check (
      (fulfillment_at at time zone 'America/Toronto')::date = fulfillment_date
    ),
  constraint checkout_drafts_toronto_time_check
    check (
      date_trunc(
        'minute',
        (fulfillment_at at time zone 'America/Toronto')
      )::time = fulfillment_time
    )
);

comment on table public.checkout_drafts is
  'Short-lived guest checkout intent. A draft is not a paid order and does not consume capacity.';
comment on column public.checkout_drafts.access_token_hash is
  'SHA-256 hash of an opaque HttpOnly cookie token; the raw token is never stored.';

create table public.capacity_days (
  fulfillment_date date primary key,
  capacity_limit smallint not null default 4,
  created_at timestamp with time zone not null default now(),
  constraint capacity_days_limit_check check (capacity_limit = 4)
);

comment on table public.capacity_days is
  'One lockable row per fulfillment date used to serialize final-capacity decisions.';

create table public.capacity_adjustments (
  id uuid primary key default gen_random_uuid(),
  fulfillment_date date not null,
  source text not null,
  status text not null default 'active',
  customer_reference text,
  internal_note text,
  created_by uuid references auth.users (id) on delete set null,
  released_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint capacity_adjustments_source_check
    check (source in ('phone', 'instagram', 'admin', 'other', 'website')),
  constraint capacity_adjustments_status_check
    check (status in ('active', 'released')),
  constraint capacity_adjustments_customer_reference_check
    check (
      customer_reference is null
      or (
        customer_reference = btrim(customer_reference)
        and char_length(customer_reference) between 1 and 80
      )
    ),
  constraint capacity_adjustments_internal_note_check
    check (internal_note is null or char_length(internal_note) <= 500),
  constraint capacity_adjustments_release_check
    check (
      (status = 'active' and released_at is null)
      or
      (status = 'released' and released_at is not null)
    )
);

comment on table public.capacity_adjustments is
  'Capacity consumed by external or future confirmed orders. One row always consumes one daily order space.';

create table public.capacity_holds (
  id uuid primary key default gen_random_uuid(),
  checkout_draft_id uuid not null references public.checkout_drafts (id) on delete restrict,
  fulfillment_date date not null,
  idempotency_key uuid not null unique,
  status text not null default 'active',
  expires_at timestamp with time zone not null,
  released_at timestamp with time zone,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint capacity_holds_status_check
    check (status in ('active', 'expired', 'released', 'consumed')),
  constraint capacity_holds_expiry_check check (expires_at > created_at),
  constraint capacity_holds_lifecycle_check
    check (
      (status = 'active' and released_at is null and consumed_at is null)
      or
      (status = 'expired' and released_at is null and consumed_at is null)
      or
      (status = 'released' and released_at is not null and consumed_at is null)
      or
      (status = 'consumed' and released_at is null and consumed_at is not null)
    )
);

comment on table public.capacity_holds is
  'Fifteen-minute payment-stage holds. Choosing a date or pickup approval never inserts a hold.';

create table public.fulfillment_audit_events (
  id bigint generated always as identity primary key,
  entity_table text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamp with time zone not null default now(),
  constraint fulfillment_audit_events_entity_table_check
    check (entity_table in ('fulfillment_blackouts', 'capacity_adjustments')),
  constraint fulfillment_audit_events_action_check
    check (action in ('insert', 'update', 'delete')),
  constraint fulfillment_audit_events_payload_check
    check (before_data is not null or after_data is not null)
);

comment on table public.fulfillment_audit_events is
  'Append-only owner audit trail for closures and manual capacity changes.';

create index fulfillment_blackouts_date_scope_idx
  on public.fulfillment_blackouts (fulfillment_date, scope, starts_at);
create index fulfillment_blackouts_created_by_idx
  on public.fulfillment_blackouts (created_by)
  where created_by is not null;
create index checkout_drafts_expires_at_idx
  on public.checkout_drafts (expires_at)
  where status <> 'expired';
create index capacity_adjustments_active_date_idx
  on public.capacity_adjustments (fulfillment_date)
  where status = 'active';
create index capacity_adjustments_created_by_idx
  on public.capacity_adjustments (created_by)
  where created_by is not null;
create index capacity_holds_draft_id_idx
  on public.capacity_holds (checkout_draft_id);
create index capacity_holds_active_date_expiry_idx
  on public.capacity_holds (fulfillment_date, expires_at)
  where status = 'active';
create unique index capacity_holds_one_active_per_draft_idx
  on public.capacity_holds (checkout_draft_id)
  where status = 'active';
create index fulfillment_audit_events_entity_idx
  on public.fulfillment_audit_events (entity_table, entity_id, occurred_at desc);
create index fulfillment_audit_events_actor_idx
  on public.fulfillment_audit_events (actor_user_id)
  where actor_user_id is not null;

create or replace function private.fulfillment_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.fulfillment_prepare_blackout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.version = old.version + 1;
    new.created_by = old.created_by;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.fulfillment_prepare_adjustment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by = old.created_by;
    if old.status = 'released' and new.status <> 'released' then
      raise exception using
        errcode = '23514',
        message = 'Released capacity cannot be reopened.';
    end if;
    if old.status = 'active' and new.status = 'released' and new.released_at is null then
      new.released_at = now();
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.fulfillment_prepare_checkout_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.version = old.version + 1;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.capture_fulfillment_audit_event()
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

  insert into public.fulfillment_audit_events (
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

  if requested_method not in ('delivery', 'pickup') then
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
      and blackout.scope in ('both', requested_method)
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

create or replace function private.enforce_capacity_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_adjustments integer;
  active_holds integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  insert into public.capacity_days (fulfillment_date)
  values (new.fulfillment_date)
  on conflict (fulfillment_date) do nothing;

  perform 1
  from public.capacity_days
  where fulfillment_date = new.fulfillment_date
  for update;

  update public.capacity_holds
  set status = 'expired', updated_at = now()
  where fulfillment_date = new.fulfillment_date
    and status = 'active'
    and expires_at <= now();

  select count(*) into active_adjustments
  from public.capacity_adjustments
  where fulfillment_date = new.fulfillment_date
    and status = 'active'
    and (tg_op = 'INSERT' or id <> new.id);

  select count(*) into active_holds
  from public.capacity_holds
  where fulfillment_date = new.fulfillment_date
    and status = 'active'
    and expires_at > now();

  if active_adjustments + active_holds >= 4 then
    raise exception using
      errcode = 'P0001',
      message = 'The fulfillment date has reached its four-order capacity.';
  end if;

  return new;
end;
$$;

create or replace function public.reserve_fulfillment_capacity(
  p_checkout_draft_id uuid,
  p_idempotency_key uuid,
  p_evaluated_at timestamp with time zone default now()
)
returns table (
  hold_id uuid,
  expires_at timestamp with time zone,
  fulfillment_date date
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft public.checkout_drafts%rowtype;
  existing_hold public.capacity_holds%rowtype;
  settings public.fulfillment_settings%rowtype;
  active_adjustments integer;
  active_holds integer;
  slot_issue text;
begin
  select * into strict settings
  from public.fulfillment_settings
  where singleton;

  select * into draft
  from public.checkout_drafts
  where id = p_checkout_draft_id
  for update;

  if not found or draft.status = 'expired' or draft.expires_at <= p_evaluated_at then
    raise exception using
      errcode = 'P0001',
      message = 'The checkout draft has expired.';
  end if;

  slot_issue = private.fulfillment_slot_issue(
    draft.fulfillment_method,
    draft.fulfillment_date,
    draft.fulfillment_time,
    p_evaluated_at
  );
  if slot_issue is not null then
    raise exception using
      errcode = 'P0001',
      message = 'The selected fulfillment time is no longer available.',
      detail = slot_issue;
  end if;

  select * into existing_hold
  from public.capacity_holds
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_hold.checkout_draft_id <> draft.id then
      raise exception using
        errcode = 'P0001',
        message = 'The idempotency key is already used by another checkout.';
    end if;
    if existing_hold.status = 'active' and existing_hold.expires_at > p_evaluated_at then
      return query select existing_hold.id, existing_hold.expires_at, existing_hold.fulfillment_date;
      return;
    end if;
  end if;

  update public.capacity_holds as hold
  set status = 'expired', updated_at = p_evaluated_at
  where hold.checkout_draft_id = draft.id
    and hold.status = 'active'
    and hold.expires_at <= p_evaluated_at;

  select * into existing_hold
  from public.capacity_holds as hold
  where hold.checkout_draft_id = draft.id
    and hold.status = 'active'
    and hold.expires_at > p_evaluated_at
  for update;

  if found then
    return query select existing_hold.id, existing_hold.expires_at, existing_hold.fulfillment_date;
    return;
  end if;

  insert into public.capacity_days (fulfillment_date)
  values (draft.fulfillment_date)
  on conflict on constraint capacity_days_pkey do nothing;

  perform 1
  from public.capacity_days
  where capacity_days.fulfillment_date = draft.fulfillment_date
  for update;

  update public.capacity_holds as hold
  set status = 'expired', updated_at = p_evaluated_at
  where hold.fulfillment_date = draft.fulfillment_date
    and hold.status = 'active'
    and hold.expires_at <= p_evaluated_at;

  select count(*) into active_adjustments
  from public.capacity_adjustments
  where capacity_adjustments.fulfillment_date = draft.fulfillment_date
    and status = 'active';

  select count(*) into active_holds
  from public.capacity_holds as hold
  where hold.fulfillment_date = draft.fulfillment_date
    and hold.status = 'active'
    and hold.expires_at > p_evaluated_at;

  if active_adjustments + active_holds >= settings.daily_capacity then
    raise exception using
      errcode = 'P0001',
      message = 'The fulfillment date has reached its four-order capacity.';
  end if;

  insert into public.capacity_holds (
    checkout_draft_id,
    fulfillment_date,
    idempotency_key,
    expires_at
  )
  values (
    draft.id,
    draft.fulfillment_date,
    p_idempotency_key,
    p_evaluated_at + make_interval(mins => settings.hold_minutes)
  )
  returning id, capacity_holds.expires_at, capacity_holds.fulfillment_date
  into hold_id, expires_at, fulfillment_date;

  return next;
end;
$$;

revoke all on function private.fulfillment_set_updated_at() from public;
revoke all on function private.fulfillment_prepare_blackout() from public;
revoke all on function private.fulfillment_prepare_adjustment() from public;
revoke all on function private.fulfillment_prepare_checkout_draft() from public;
revoke all on function private.capture_fulfillment_audit_event() from public;
revoke all on function private.fulfillment_slot_issue(text, date, time without time zone, timestamp with time zone) from public;
revoke all on function private.enforce_capacity_adjustment() from public;
revoke all on function public.reserve_fulfillment_capacity(uuid, uuid, timestamp with time zone) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.fulfillment_slot_issue(text, date, time without time zone, timestamp with time zone) to service_role;
grant execute on function public.reserve_fulfillment_capacity(uuid, uuid, timestamp with time zone) to service_role;

create trigger fulfillment_settings_set_updated_at
before update on public.fulfillment_settings
for each row execute function private.fulfillment_set_updated_at();

create trigger fulfillment_hours_set_updated_at
before update on public.fulfillment_hours
for each row execute function private.fulfillment_set_updated_at();

create trigger fulfillment_blackouts_prepare
before update on public.fulfillment_blackouts
for each row execute function private.fulfillment_prepare_blackout();

create trigger checkout_drafts_prepare
before update on public.checkout_drafts
for each row execute function private.fulfillment_prepare_checkout_draft();

create trigger capacity_adjustments_enforce
before insert or update on public.capacity_adjustments
for each row execute function private.enforce_capacity_adjustment();

create trigger capacity_adjustments_prepare
before update on public.capacity_adjustments
for each row execute function private.fulfillment_prepare_adjustment();

create trigger capacity_holds_set_updated_at
before update on public.capacity_holds
for each row execute function private.fulfillment_set_updated_at();

create trigger fulfillment_blackouts_audit
after insert or update or delete on public.fulfillment_blackouts
for each row execute function private.capture_fulfillment_audit_event();

create trigger capacity_adjustments_audit
after insert or update or delete on public.capacity_adjustments
for each row execute function private.capture_fulfillment_audit_event();

insert into public.fulfillment_settings (singleton)
values (true);

insert into public.fulfillment_hours (
  fulfillment_method,
  iso_weekday,
  opens_at,
  last_slot_at
)
values
  ('delivery', 1, '06:00', '19:00'),
  ('delivery', 2, '06:00', '15:30'),
  ('delivery', 4, '06:00', '19:00'),
  ('delivery', 5, '06:00', '19:00'),
  ('delivery', 6, '06:00', '15:30'),
  ('pickup', 1, '09:00', '19:00'),
  ('pickup', 2, '09:00', '15:30'),
  ('pickup', 4, '09:00', '19:00'),
  ('pickup', 5, '09:00', '19:00'),
  ('pickup', 6, '09:00', '15:30');

alter table public.fulfillment_settings enable row level security;
alter table public.fulfillment_settings force row level security;
alter table public.fulfillment_hours enable row level security;
alter table public.fulfillment_hours force row level security;
alter table public.fulfillment_blackouts enable row level security;
alter table public.fulfillment_blackouts force row level security;
alter table public.checkout_drafts enable row level security;
alter table public.checkout_drafts force row level security;
alter table public.capacity_days enable row level security;
alter table public.capacity_days force row level security;
alter table public.capacity_adjustments enable row level security;
alter table public.capacity_adjustments force row level security;
alter table public.capacity_holds enable row level security;
alter table public.capacity_holds force row level security;
alter table public.fulfillment_audit_events enable row level security;
alter table public.fulfillment_audit_events force row level security;

revoke all on table public.fulfillment_settings from anon, authenticated, service_role;
revoke all on table public.fulfillment_hours from anon, authenticated, service_role;
revoke all on table public.fulfillment_blackouts from anon, authenticated, service_role;
revoke all on table public.checkout_drafts from anon, authenticated, service_role;
revoke all on table public.capacity_days from anon, authenticated, service_role;
revoke all on table public.capacity_adjustments from anon, authenticated, service_role;
revoke all on table public.capacity_holds from anon, authenticated, service_role;
revoke all on table public.fulfillment_audit_events from anon, authenticated, service_role;
revoke all on sequence public.fulfillment_audit_events_id_seq from anon, authenticated, service_role;

grant select on table public.fulfillment_settings to authenticated;
grant select on table public.fulfillment_hours to authenticated;
grant select, insert, update, delete on table public.fulfillment_blackouts to authenticated;
grant select, insert, update on table public.capacity_adjustments to authenticated;
grant select on table public.capacity_days to authenticated;
grant select on table public.capacity_holds to authenticated;
grant select on table public.checkout_drafts to authenticated;
grant select on table public.fulfillment_audit_events to authenticated;

grant select, insert, update, delete on table public.fulfillment_settings to service_role;
grant select, insert, update, delete on table public.fulfillment_hours to service_role;
grant select, insert, update, delete on table public.fulfillment_blackouts to service_role;
grant select, insert, update, delete on table public.checkout_drafts to service_role;
grant select, insert, update, delete on table public.capacity_days to service_role;
grant select, insert, update, delete on table public.capacity_adjustments to service_role;
grant select, insert, update, delete on table public.capacity_holds to service_role;
grant select, insert, update, delete on table public.fulfillment_audit_events to service_role;
grant usage, select on sequence public.fulfillment_audit_events_id_seq to service_role;

create policy fulfillment_settings_owner_select
  on public.fulfillment_settings for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy fulfillment_hours_owner_select
  on public.fulfillment_hours for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy fulfillment_blackouts_owner_select
  on public.fulfillment_blackouts for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy fulfillment_blackouts_owner_insert
  on public.fulfillment_blackouts for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy fulfillment_blackouts_owner_update
  on public.fulfillment_blackouts for update to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  )
  with check (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy fulfillment_blackouts_owner_delete
  on public.fulfillment_blackouts for delete to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy capacity_adjustments_owner_select
  on public.capacity_adjustments for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy capacity_adjustments_owner_insert
  on public.capacity_adjustments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and source in ('phone', 'instagram', 'admin', 'other')
    and status = 'active'
    and exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy capacity_adjustments_owner_update
  on public.capacity_adjustments for update to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  )
  with check (
    source in ('phone', 'instagram', 'admin', 'other')
    and status in ('active', 'released')
    and exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy capacity_days_owner_select
  on public.capacity_days for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy capacity_holds_owner_select
  on public.capacity_holds for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy checkout_drafts_owner_select
  on public.checkout_drafts for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );

create policy fulfillment_audit_events_owner_select
  on public.fulfillment_audit_events for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as membership
      where membership.user_id = (select auth.uid())
        and membership.role = 'owner'
        and membership.is_active
    )
  );
