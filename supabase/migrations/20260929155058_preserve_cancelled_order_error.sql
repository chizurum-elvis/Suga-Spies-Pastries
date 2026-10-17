-- Preserve the cancellation workflow's established rejection message while
-- keeping discarded redelivery orders equally terminal.
create or replace function private.enforce_order_lifecycle()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.id,new.order_number,new.payment_attempt_id,new.capacity_adjustment_id,
    new.fulfillment_date,new.snapshot,new.test_only,new.created_at)
    is distinct from row(old.id,old.order_number,old.payment_attempt_id,old.capacity_adjustment_id,
    old.fulfillment_date,old.snapshot,old.test_only,old.created_at) then
    raise exception 'order_history_is_immutable';
  end if;
  if new is not distinct from old then return new; end if;
  if new.status = 'cancelled' and old.status = 'confirmed' then
    if current_setting('suga_spies.order_cancellation_id', true) is distinct from old.id::text
      or old.fulfillment_status <> 'received' or new.fulfillment_status <> 'received'
      or old.payment_status <> 'paid' or new.payment_status <> 'refund_pending'
      or clock_timestamp() >= private.order_cancellation_deadline(old.fulfillment_date) then
      raise exception 'order_cancellation_not_allowed';
    end if;
  elsif old.status in ('cancelled','discarded') then
    if current_setting('suga_spies.order_refund_id', true) is distinct from old.id::text
      or new.status <> old.status or new.fulfillment_status <> old.fulfillment_status
      or new.payment_status = 'paid' then
      if old.status = 'cancelled' then raise exception 'order_cancelled'; end if;
      raise exception 'order_terminal';
    end if;
  elsif new.status = 'discarded' then
    if current_setting('suga_spies.redelivery_id', true) is distinct from old.id::text
      or old.status <> 'confirmed' or old.fulfillment_status not in ('delivery_failed','redelivery_out_for_delivery','redelivery_requested')
      or new.fulfillment_status <> 'discarded' or old.payment_status <> 'paid'
      or new.payment_status <> 'refund_pending' then raise exception 'redelivery_discard_not_allowed'; end if;
  else
    if new.payment_status is distinct from old.payment_status then raise exception 'order_payment_state_locked'; end if;
    if new.fulfillment_status = old.fulfillment_status then raise exception 'order_lifecycle_mutation_invalid'; end if;
    if current_setting('suga_spies.order_transition_id', true) = old.id::text then
      if old.status <> 'confirmed' or not (
        (old.fulfillment_status = 'received' and new.fulfillment_status = 'preparing')
        or (old.fulfillment_status = 'preparing' and new.fulfillment_status = 'ready')
        or (old.fulfillment_status = 'ready' and new.fulfillment_status = 'out_for_delivery')
        or (old.fulfillment_status = 'out_for_delivery' and new.fulfillment_status = 'delivered'))
        then raise exception 'order_transition_invalid'; end if;
    elsif current_setting('suga_spies.redelivery_id', true) = old.id::text then
      if old.status <> 'confirmed' or not (
        (old.fulfillment_status = 'out_for_delivery' and new.fulfillment_status = 'delivery_failed')
        or (old.fulfillment_status = 'delivery_failed' and new.fulfillment_status = 'redelivery_requested')
        or (old.fulfillment_status = 'redelivery_requested' and new.fulfillment_status = 'redelivery_scheduled')
        or (old.fulfillment_status = 'redelivery_scheduled' and new.fulfillment_status = 'redelivery_out_for_delivery')
        or (old.fulfillment_status = 'redelivery_out_for_delivery' and new.fulfillment_status = 'delivered'))
        then raise exception 'redelivery_transition_invalid'; end if;
    else raise exception 'use_order_transition_workflow'; end if;
    if new.status is distinct from (case when new.fulfillment_status = 'delivered' then 'completed' else 'confirmed' end)
      then raise exception 'order_lifecycle_mutation_invalid'; end if;
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'order_lifecycle_mutation_invalid';
  end if;
  return new;
end;
$$;
