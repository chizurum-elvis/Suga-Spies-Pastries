create index if not exists fulfillment_blackouts_created_by_idx
  on public.fulfillment_blackouts (created_by)
  where created_by is not null;
