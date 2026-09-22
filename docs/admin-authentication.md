# Owner authentication

Suga Spies has one private owner workspace and no public admin sign-up. A valid Supabase Auth session is necessary but not sufficient: the signed-in user must also have an active row in `public.admin_users`. That second check is enforced by Row Level Security and repeated in the server-side authorization layer before the workspace renders.

## What is implemented

- Email and password owner sign-in at `/admin/login`.
- Optimistic session refresh in Next.js Proxy and authoritative authorization in the server-side data-access layer.
- An active-owner allow-list in `public.admin_users`, protected by forced Row Level Security.
- Password recovery using Supabase's SSR-safe token-hash flow, with a deliberate confirmation step before the one-time token is consumed.
- Strong password validation and global session revocation after a password change.
- Local sign-out from desktop and mobile navigation.
- Generic credential and recovery messages that do not reveal whether an email is registered.
- Fail-closed configuration, identity-service, and membership-service states.
- Private, non-cacheable, non-indexable responses for every `/admin` route.

Customer accounts, menu management, orders, and payments are separate vertical slices and are not connected to this workspace yet.

## 1. Add the local environment values

In the Supabase dashboard, open the project's Connect dialog or API settings and copy the project URL and **publishable** key. Add only these values to `.env.local`:

```dotenv
APP_ENV=local
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_VALUE
```

Do not add a secret or service-role key to a `NEXT_PUBLIC_` variable. The owner-authentication slice does not require `SUPABASE_SECRET_KEY`, Stripe keys, or a database password.

Restart `npm run dev` after changing `.env.local`; Next.js public values are read when the app starts.

## 2. Apply the database migration

The migration is `supabase/migrations/20260828235722_create_admin_users.sql`. For a hosted test project, either paste that complete file into the Supabase SQL Editor and run it once, or link the CLI to that test project and run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Never point an unreviewed migration at the production project. Use a separate development or staging Supabase project while building.

## 3. Mirror the hosted Auth settings

The local values are recorded in `supabase/config.toml`. In the hosted Supabase dashboard, configure the equivalent settings:

1. Disable general user sign-ups and email sign-ups.
2. Require at least 12 password characters with lowercase, uppercase, number, and symbol.
3. Keep email confirmation and secure password changes enabled.
4. Set the site URL to the correct environment origin.
5. Add the exact recovery redirect URL for each environment:
   - `http://localhost:3000/admin/auth/callback`
   - your staging equivalent
   - your production equivalent
6. Set the session timebox to 24 hours and inactivity timeout to 8 hours where the project plan supports those controls.

In Authentication → Email Templates → Reset Password, use the contents of `supabase/templates/recovery.html`. The template sends the owner to `/admin/recover` with a token hash. That page requires an intentional button press, preventing email preview or security-prefetch tools from consuming the one-time recovery token on a background GET request.

Use a custom production SMTP provider before relying on password-recovery email in production. Disable click tracking for authentication emails so the provider does not rewrite secure links. Supabase's local mail catcher is appropriate for local testing; the hosted default sender is rate-limited and is not a production mail service.

## 4. Create and approve the owner

In Supabase Dashboard → Authentication → Users, create the owner's user manually. Use the owner's real email and a unique password that meets the policy. There is intentionally no create-account page on the website.

Then run this in the SQL Editor, replacing the placeholder email and display name:

```sql
do $$
declare
  approved_user_id uuid;
begin
  select id
    into approved_user_id
    from auth.users
   where lower(email) = lower('OWNER_EMAIL_HERE');

  if approved_user_id is null then
    raise exception 'No Supabase Auth user matches the supplied owner email.';
  end if;

  insert into public.admin_users (user_id, role, is_active, display_name)
  values (approved_user_id, 'owner', true, 'OWNER_DISPLAY_NAME_HERE')
  on conflict (user_id) do update
    set role = excluded.role,
        is_active = excluded.is_active,
        display_name = excluded.display_name;
end
$$;
```

The migration grants authenticated users read access only to their own active membership row. Website sessions cannot create, change, or delete owner memberships.

## 5. Manual browser test

Start the site with `npm run dev`, then test in a private/incognito window:

1. Open `http://localhost:3000/admin`. It should redirect to `/admin/login?error=auth_required` and must not flash the workspace.
2. Confirm the page says “Welcome back to the kitchen side,” contains no sign-up option, and works at narrow mobile width without horizontal scrolling.
3. Submit an invalid email, an empty password, and an extremely long password. Each attempt should remain on the form, preserve only the email, and never place the password back into the page.
4. Use a valid-looking but incorrect password. The error must not reveal whether the email exists or whether the password alone was wrong.
5. Sign in with the approved owner. The browser should reach `/admin`, show the owner's normalized email in the private shell, and show no customer or order data because those slices are not built yet.
6. Open `/admin` in a second private window. It must still redirect to sign-in.
7. Sign out from desktop navigation, then sign back in and sign out from the mobile menu. The Back button and a direct visit to `/admin` must not reopen the workspace.
8. In Supabase SQL Editor, temporarily set the owner's `is_active` to `false`. A fresh `/admin` request must be denied. Set it back to `true` after the check.
9. Choose “Forgot password?”, submit the owner email, and follow the received link. Confirm that the first page asks you to “Continue securely” before the token is used. Continue, then enter a weak password, mismatched passwords, and finally a valid strong password. After success, all sessions should be revoked and the new password should be required.
10. Visit `/admin/auth/callback?next=https://example.com` directly. It must remain on the Suga Spies origin and report an invalid link; external redirects are rejected.

## 6. Automated verification

Run the complete local quality suite:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

The default browser suite verifies the unauthenticated, fail-closed state without storing owner credentials. A real successful-login check remains a deliberate manual test until a dedicated, non-production end-to-end owner account is created.

## Removing owner access

Set `is_active = false` for the matching row in `public.admin_users`. This blocks the next server authorization check even if an Auth session still exists. For immediate incident response, also revoke that user's active sessions in Supabase Auth and rotate the password.
