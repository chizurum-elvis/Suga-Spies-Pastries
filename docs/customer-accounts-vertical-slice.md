# Optional customer accounts

Guests can still browse, pay, track, cancel, and handle redelivery without registering. A customer who chooses an account can verify an email, sign in, recover a password, view paid orders, and save one preferred contact and Ontario delivery address. The saved address only pre-fills checkout; Google address validation, delivery pricing, availability, and payment checks run again for every order. No tax calculation was added.

Previous guest orders are connected only after Supabase confirms ownership of the **same email used on the paid order**. The server reads the verified Auth identity, never an email or order ID supplied by the browser. A database trigger independently checks the verified Auth email against the paid-order snapshot. The append-only link leaves the purchase and refund audit record unchanged. An account cannot claim an order addressed to a different email; the existing guest access link continues to work.

The linked database migration `20261002082832_customer_accounts.sql` was applied on 2026-10-02. Its rollback-only RLS test passed 18 checks after application. The migration alone does **not** activate signup emails on the hosted Supabase project.

## Required hosted Supabase Auth setup

Use a development/staging Supabase project for the first end-to-end run. In **Authentication → Providers → Email**, enable email signup and **Confirm email**. Keep the owner allow-list (`admin_users`) in place: general signup does not grant owner access. Set the project password policy to at least 12 characters with uppercase, lowercase, number, and symbol. Keep secure password change and Auth rate limits enabled.

In **Authentication → URL Configuration**, set the Site URL to this environment's real origin and add these exact redirect URLs for each environment:

- `http://localhost:3000/account/auth/callback/signup`
- `http://localhost:3000/account/auth/callback/recovery`
- the equivalent staging and production HTTPS URLs
- retain the existing `/admin/auth/callback` URLs for owner recovery

Set `NEXT_PUBLIC_SITE_URL` in that app environment to the same origin, then restart/redeploy the app. A production custom SMTP sender is needed before public signup/recovery: the hosted default mail sender is for limited testing. Disable click tracking on authentication email links.

In **Authentication → Email Templates**, copy `supabase/templates/confirmation.html` to **Confirm signup** and `supabase/templates/recovery.html` to **Reset password**. The reset template is intentionally shared by customer and owner accounts. It routes to the `redirectTo` path chosen by the appropriate server action, so owner recovery remains at `/admin/recover` and customer recovery goes to `/account/recover`. Do not keep the old owner-only reset template once customer recovery is enabled. Both token-hash links land on an intentional confirmation button, preventing email preview scanners from consuming a one-time token via a background GET request. The callback also accepts Supabase PKCE code links as a compatibility path.

Local CLI Auth settings, redirect URLs, and templates are recorded in `supabase/config.toml`. Changing that file does not change the hosted dashboard automatically. [Supabase's email template guide](https://supabase.com/docs/guides/auth/auth-email-templates) describes the template variables and email-prefetch behavior.

## Customer acceptance test

Use a **fresh, non-owner email address** that you can receive mail at. In a staging/test payment environment:

1. While signed out, place a guest test order using that email. Keep its secure tracking link. Confirm checkout never demands an account.
2. Open `/account/register`. Submit an invalid email, short password, and mismatched confirmation; each must show a field error. Register with a valid strong password. The page must ask you to verify your email; order history must not open yet.
3. Open the confirmation email. The first site page must ask you to press **Verify my email**. Press it once. `/account` should show the earlier guest order. Refresh; it must appear only once. Its tracking page must open without the guest link while signed in.
4. Sign out. Open that order in a fresh private window without its access link; it must **not** disclose order details. The original guest link should still work separately.
5. Sign in with the verified customer account. Save a Toronto, Markham, or Mississauga address at `/account/details`; invalid city, foreign phone, or invalid postal code must be rejected. Open a new checkout. The saved information should pre-fill only when no more recent checkout draft details exist. Change it at checkout and verify Google still rechecks the address and fee.
6. Remove saved details. Paid order history must remain; a later checkout should not pre-fill the removed address.
7. Sign out and use **Forgot password?**. Open the email and press **Continue securely** before choosing a new password. The old password should no longer sign in; the new one should. Confirm the existing owner password-recovery flow still reaches `/admin/recover` and requires the owner allow-list.
8. Make a second guest order with a **different** email. It must not appear in the first account's history. Create and verify a second test account for that second email to see it there instead.
9. At 320px mobile width and desktop width, inspect registration, recovery, history, and saved details for overflow, keyboard access, visible focus, readable errors, and sensible tap targets.

Do not test order ownership by altering a real customer's email or creating a customer account with the approved owner email. The automated suite includes return-path, saved-input, callback/prefetch, and cross-account RLS tests, but a real email-delivery and sign-in walkthrough is required before enabling customer accounts on production.
