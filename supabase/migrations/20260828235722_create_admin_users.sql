create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'owner',
  is_active boolean not null default true,
  display_name text,
  created_at timestamp with time zone not null default now(),
  constraint admin_users_role_check check (role in ('owner')),
  constraint admin_users_display_name_length_check
    check (display_name is null or char_length(display_name) between 1 and 80)
);

comment on table public.admin_users is
  'Server-verified allow-list for the private Suga Spies owner workspace.';

comment on column public.admin_users.user_id is
  'References the corresponding Supabase Auth identity.';

alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;

revoke all on table public.admin_users from anon, authenticated;

grant select (user_id, role, is_active, display_name)
  on table public.admin_users
  to authenticated;

create policy admin_users_select_own_active_membership
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id and is_active);
