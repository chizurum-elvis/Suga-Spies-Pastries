-- Keep the existing owner checks, atomic capacity reservation and immutable
-- history unchanged. Only the privileged implementations move out of the API.
alter function public.create_external_order(
  date,text,text,text,text,text,text,text,text,text,text,jsonb,text
) set schema private;
alter function public.advance_external_order(uuid,integer,text) set schema private;

create function public.create_external_order(
  p_date date, p_source text, p_customer_name text, p_customer_phone text,
  p_customer_email text, p_recipient_name text, p_address_line1 text,
  p_address_line2 text, p_city text, p_postal_code text,
  p_delivery_instructions text, p_items jsonb, p_internal_note text
) returns uuid language sql security invoker set search_path = '' as $$
  select private.create_external_order(
    p_date,p_source,p_customer_name,p_customer_phone,p_customer_email,
    p_recipient_name,p_address_line1,p_address_line2,p_city,p_postal_code,
    p_delivery_instructions,p_items,p_internal_note
  );
$$;
create function public.advance_external_order(p_id uuid,p_version integer,p_next_status text)
returns boolean language sql security invoker set search_path = '' as $$
  select private.advance_external_order(p_id,p_version,p_next_status);
$$;

revoke all on function public.create_external_order(
  date,text,text,text,text,text,text,text,text,text,text,jsonb,text
) from public,anon,service_role;
revoke all on function public.advance_external_order(uuid,integer,text) from public,anon,service_role;
revoke all on function private.create_external_order(
  date,text,text,text,text,text,text,text,text,text,text,jsonb,text
) from public,anon,service_role;
revoke all on function private.advance_external_order(uuid,integer,text) from public,anon,service_role;
grant execute on function public.create_external_order(
  date,text,text,text,text,text,text,text,text,text,text,jsonb,text
), private.create_external_order(
  date,text,text,text,text,text,text,text,text,text,text,jsonb,text
) to authenticated;
grant execute on function public.advance_external_order(uuid,integer,text),
  private.advance_external_order(uuid,integer,text) to authenticated;
