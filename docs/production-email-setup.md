# Business email setup

Order emails and account emails are separate integrations. Updating
`ORDER_EMAIL_FROM` changes order messages, not Supabase password recovery.

## 1. Verify a domain in Resend

The current website address, `suga-spies-pastries.vercel.app`, is a shared Vercel
subdomain, not an owned email domain. It cannot replace `resend.dev` as the
bakery's verified sender. Buy a domain you control first; the existing website
can stay on Vercel while email verification is configured.

1. Buy a domain you control. You cannot verify `gmail.com`, `outlook.com`,
   `vercel.app`, or another company's shared domain as your own.
2. In Resend, open **Domains → Add domain**. Use your own domain or a sending
   subdomain such as `mail.your-business-domain.ca`. The names here are examples,
   not addresses already created for Suga & Spies.
3. Open the domain's DNS manager wherever its authoritative nameservers point.
   Buying at one registrar does not mean that registrar necessarily hosts DNS.
4. Add the exact sending-verification records Resend displays: names, record
   types, values, and MX priorities. Use Resend's current values, not copied
   records from another account or a tutorial.
5. Preserve existing website records and mailbox MX records. Do not turn on
   inbound receiving or replace root mailbox MX records just to send order
   emails. If the DNS provider automatically appends the domain to a name, enter
   only the relative name it expects. Do not create two SPF records for the
   same hostname; follow the provider's merge guidance if that hostname already
   has one.
6. Return to Resend and verify. Wait until the exact sending domain is
   **Verified**. Disable click and open tracking for these transactional emails,
   especially authentication links. Add a suitable DMARC policy using Resend's
   domain guidance; inspect reports before choosing an aggressive policy.

Official references: [verified domains](https://resend.com/docs/dashboard/domains/introduction)
and [domain management](https://resend.com/docs/dashboard/domains/manage-domains).

## 2. Change the website's order sender

If the verified domain is `mail.your-business-domain.ca`, an example sender is
`orders@mail.your-business-domain.ca`. Resend can send from addresses on a
verified domain without creating a mailbox. Receiving replies still needs a real
inbox or forwarding arrangement; domain verification alone does not create one.

1. In Vercel, select this project → **Settings → Environment Variables**.
2. Set **Production** `ORDER_EMAIL_FROM` to the plain email address on the exact
   verified domain. Do not include `Suga & Spies <...>`: the application adds the
   bakery display name itself.
3. Check `RESEND_API_KEY` belongs to that Resend account and is permitted to send
   from the domain. Keep the key private; it must not start with `NEXT_PUBLIC_`.
   A domain-scoped sending key is preferable to a broad key for the website.
4. Set `ORDER_ALERT_EMAIL` to the owner's inbox. In **Admin → Settings**, check
   the saved owner alert destination too: a saved value overrides that default
   for live owner alerts.
5. Set `ORDER_TEST_EMAIL` to the controlled testing inbox. Test orders always
   send there, not to the customer's entered address or the live owner inbox.
6. Redeploy Vercel so the new environment is loaded. Edit `.env.local` separately
   and restart local development if you want to use the new sender locally too.
   Do not change `PAYMENTS_MODE` to live just to test email.

Live checkout rejects Resend's shared `resend.dev` sender. Sandbox testing may
continue to use it, subject to Resend's test-recipient restrictions.

## 3. Configure Supabase account and recovery emails

1. In the same Supabase project used by the deployed website, open
   **Authentication → Email → SMTP Settings** (or search for Custom SMTP).
2. Enable custom SMTP. Use host `smtp.resend.com`, port `465`, username `resend`,
   and a Resend API key permitted to send from the selected domain as the SMTP
   password. Never put that password in chat, source code, or a public variable.
3. Set the sender email to an address on the verified domain and the sender name
   to `Suga & Spies`. Save and check the provider's SMTP test if available.
4. Set **Authentication → URL Configuration** Site URL to the final HTTPS origin.
   Allow the exact owner and customer callback URLs documented in
   `admin-authentication.md` and `customer-accounts-vertical-slice.md`. Keep
   development URLs separate; do not allow arbitrary production redirects.
5. Keep the project's confirmation and recovery templates. Ensure Resend does
   not rewrite their links with click tracking.
6. Test **Forgot password** from `/admin/login` with the approved owner's email.
   Check inbox and spam, follow the intentional confirmation step, and verify
   the new password works. Avoid locking out the owner during this test.

Official references: [Resend SMTP with Supabase](https://resend.com/docs/send-with-supabase-smtp)
and [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 4. Verify, without claiming more than was tested

After updating local configuration, `npm run check:email` performs read-only
domain inspection. It sends no emails, edits no DNS, and prints no API keys. A
sending-only key may not inspect domains; check the Domains dashboard instead
of broadening the production key solely for this command. This checks the
locally loaded configuration, not Vercel's separate environment values.

Next, use one controlled Stripe sandbox order with `ORDER_TEST_EMAIL` set to
your inbox. Run the payment worker during local testing. Verify:

- Both confirmation messages appear in Resend's email log with the new sender.
- The testing inbox receives them; their order links open the correct order.
- A subsequent test preparation-stage email arrives.
- Admin order detail shows email status and retry controls if a send fails.
- A separate owner password-recovery email arrives through Supabase SMTP.

Admin **Sent** means Resend accepted the message, not guaranteed inbox delivery.
Inspect Resend's delivery/bounce status and the actual inbox. Do not send a real
customer message or place a live charge merely to test configuration.
