-- Redelivery-specific failures are translated in its reservation RPC. The
-- shared adjustment trigger must retain the established error for owner and
-- external orders, which callers and existing capacity tests already use.
create or replace function private.enforce_capacity_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare adjustments integer; holds integer;
begin
  if new.status <> 'active' then return new; end if;
  insert into public.capacity_days(fulfillment_date) values(new.fulfillment_date) on conflict do nothing;
  perform 1 from public.capacity_days where fulfillment_date = new.fulfillment_date for update;
  update public.capacity_holds set status = 'expired',updated_at = clock_timestamp()
    where fulfillment_date = new.fulfillment_date and status = 'active'
      and not payment_pending and expires_at <= clock_timestamp();
  select count(*) into adjustments from public.capacity_adjustments
    where fulfillment_date = new.fulfillment_date and status = 'active'
      and (tg_op = 'INSERT' or id <> new.id);
  select count(*) into holds from public.capacity_holds
    where fulfillment_date = new.fulfillment_date and status = 'active'
      and (expires_at > clock_timestamp() or payment_pending);
  if adjustments + holds >= 4 then
    raise exception using errcode = 'P0001',
      message = 'The fulfillment date has reached its four-order capacity.';
  end if;
  return new;
end;
$$;
