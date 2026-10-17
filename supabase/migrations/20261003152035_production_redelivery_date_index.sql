-- The private kitchen plan filters confirmed redeliveries by their new date.
-- Their original orders retain the original fulfillment_date snapshot.
create index order_redeliveries_production_date_idx
  on public.order_redeliveries (selected_date, order_id)
  where state in ('scheduled', 'out_for_delivery')
    and payment_status in ('not_required', 'paid');
