alter table public.fulfillment_settings
  drop constraint fulfillment_settings_notice_check;

alter table public.fulfillment_settings
  alter column minimum_notice_days set default 4;

update public.fulfillment_settings
set
  minimum_notice_days = 4,
  updated_at = now()
where singleton
  and minimum_notice_days <> 4;

alter table public.fulfillment_settings
  add constraint fulfillment_settings_notice_check
  check (minimum_notice_days = 4);

comment on column public.fulfillment_settings.minimum_notice_days is
  'Exactly four Toronto calendar days; closed dates remain unavailable after the notice boundary.';
