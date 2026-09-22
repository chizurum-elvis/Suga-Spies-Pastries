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
