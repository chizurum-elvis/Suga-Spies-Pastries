-- Drafts are private. Published revisions are immutable public snapshots.
create table public.site_content_drafts (
  key text primary key check (key in ('home', 'contact', 'faq', 'terms', 'privacy', 'refund')),
  body jsonb not null check (jsonb_typeof(body) = 'object' and pg_column_size(body) <= 32768),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.site_content_publications (
  key text not null check (key in ('home', 'contact', 'faq', 'terms', 'privacy', 'refund')),
  version integer not null check (version > 0),
  body jsonb not null check (jsonb_typeof(body) = 'object' and pg_column_size(body) <= 32768),
  is_current boolean not null default true,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  primary key (key, version),
  constraint site_content_published_policy_nonempty check (
    key not in ('terms', 'privacy', 'refund') or coalesce(
      jsonb_typeof(body->'title') = 'string'
      and char_length(btrim(body->>'title')) between 1 and 120
      and jsonb_typeof(body->'body') = 'string'
      and char_length(btrim(body->>'body')) between 1 and 20000,
      false
    )
  )
);
create unique index site_content_one_current_per_key
  on public.site_content_publications(key) where is_current;
create index site_content_publications_publisher_idx
  on public.site_content_publications(published_by) where published_by is not null;
create index site_content_drafts_editor_idx
  on public.site_content_drafts(updated_by) where updated_by is not null;

alter table public.site_content_drafts enable row level security;
alter table public.site_content_drafts force row level security;
alter table public.site_content_publications enable row level security;
alter table public.site_content_publications force row level security;
revoke all on public.site_content_drafts from anon, authenticated;
revoke all on public.site_content_publications from anon, authenticated;
grant select, update on public.site_content_drafts to authenticated;
grant select (key, version, body, is_current, published_at)
  on public.site_content_publications to anon, authenticated;
grant insert, update on public.site_content_publications to authenticated;

create policy site_content_drafts_owner_read on public.site_content_drafts
  for select to authenticated using (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active)
  );
create policy site_content_drafts_owner_update on public.site_content_drafts
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
create policy site_content_publications_read on public.site_content_publications
  for select to anon, authenticated using (true);
create policy site_content_publications_owner_insert on public.site_content_publications
  for insert to authenticated
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));
create policy site_content_publications_owner_update on public.site_content_publications
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner' and is_active));

-- Even the owner cannot rewrite a previously published body or its provenance.
create function public.site_content_publication_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.key is distinct from old.key or new.version is distinct from old.version
    or new.body is distinct from old.body or new.published_at is distinct from old.published_at
    or new.published_by is distinct from old.published_by
    or old.is_current is false or new.is_current is distinct from false then
    raise exception 'Published content is immutable';
  end if;
  return new;
end;
$$;
create trigger site_content_publication_immutable
  before update on public.site_content_publications
  for each row execute function public.site_content_publication_immutable();

-- SECURITY INVOKER: both the explicit allow-list and table RLS must permit publication.
create function public.publish_site_content(p_key text, p_version integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_draft public.site_content_drafts%rowtype;
  v_current integer;
begin
  if not exists (select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'owner' and is_active) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  select * into v_draft from public.site_content_drafts
    where key = p_key for update;
  if not found or v_draft.version <> p_version then
    raise exception 'Draft changed; reload before publishing' using errcode = '40001';
  end if;
  select version into v_current from public.site_content_publications
    where key = p_key and is_current;
  if v_current = p_version then
    return v_current;
  end if;
  if v_current is not null and p_version <= v_current then
    raise exception 'Draft version must follow published version' using errcode = '40001';
  end if;
  update public.site_content_publications set is_current = false
    where key = p_key and is_current;
  insert into public.site_content_publications(key, version, body, published_by)
    values (p_key, p_version, v_draft.body, (select auth.uid()));
  return p_version;
end;
$$;
revoke all on function public.publish_site_content(text, integer) from public, anon;
grant execute on function public.publish_site_content(text, integer) to authenticated;

-- Initial public copy reflects the existing site; no legal policy is invented or published.
insert into public.site_content_drafts(key, body) values
 ('home', '{"announcement":"","heroTitle":"Welcome to Suga & Spies Pastries.","heroDescription":"Cheesecakes, cookies, tarts, muffins, and golden savouries made in Toronto for scheduled delivery across Toronto, Markham, and Mississauga.","storyTitle":"Thoughtful details belong on the menu.","storyBody":"Some pastries offer flavours or decorations. Choose from the options shown on each product page and see any added cost before checkout. For a request that is not listed, contact us before ordering."}'::jsonb),
 ('contact', '{"phone":"+1 (437) 332-7263","email":""}'::jsonb),
 ('faq', '{"items":[{"question":"How far ahead should I order?","answer":"Choose a delivery date at least four Toronto calendar days ahead, and no more than two calendar months ahead. Available dates are shown during checkout."},{"question":"Where do you deliver?","answer":"We deliver to eligible addresses in Toronto, Markham, and Mississauga. Enter your address at checkout to confirm eligibility and see the delivery fee before paying. Pickup is not available."},{"question":"How many pastries do I need to order?","answer":"Most items start at four pieces per box, and you can add one piece at a time after that. A regular cheesecake can be ordered on its own. Each product page shows its exact minimum."},{"question":"When is delivery free?","answer":"Delivery is free when your pastries and paid customizations total at least $100 before the delivery fee. Your address must still be within the delivery area."},{"question":"How can I pay?","answer":"Pay securely by credit or debit card. Apple Pay and Google Pay are available on supported devices and browsers."},{"question":"Can I cancel my order?","answer":"You can cancel for a full refund before the deadline shown at checkout, provided preparation has not started. The deadline is midnight Toronto time on the day before delivery. Check your order page for eligibility and refund progress."}]}'::jsonb),
 ('terms', '{"title":"Terms of sale","body":""}'::jsonb),
 ('privacy', '{"title":"Privacy policy","body":""}'::jsonb),
 ('refund', '{"title":"Cancellation and refund policy","body":""}'::jsonb);

insert into public.site_content_publications(key, version, body)
select key, version, body from public.site_content_drafts
where key in ('home', 'contact', 'faq');
