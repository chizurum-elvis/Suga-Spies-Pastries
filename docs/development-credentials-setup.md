# Development credentials setup

This guide covers the remaining credentials used by checkout, order access,
email delivery, and delivery-address validation. Keep real values in
`.env.local` only. Never commit them, paste them into chat, or prefix a
server-only value with `NEXT_PUBLIC_`.

Checkout does not calculate or collect tax. Do not add
`CHECKOUT_TEST_TAX_BPS` or `CHECKOUT_TAX_JSON`. The payable total is the
server-validated pastry subtotal plus the confirmed delivery fee.

## Safe starting configuration

Keep checkout disabled until every Stripe, order-access, worker, email, and
Google Maps value has been configured:

```dotenv
PAYMENTS_MODE=disabled

ORDER_ACCESS_SECRET=
PAYMENT_WORKER_SECRET=

RESEND_API_KEY=
ORDER_EMAIL_FROM=
ORDER_ALERT_EMAIL=
ORDER_TEST_EMAIL=

GOOGLE_MAPS_SERVER_API_KEY=
```

Restart the development server after changing `.env.local`.

## Generate the two application secrets

`ORDER_ACCESS_SECRET` signs expiring guest order links.
`PAYMENT_WORKER_SECRET` authenticates the internal payment-reconciliation
request. These values come from the developer, not Supabase, Stripe, or Resend.

1. Open Terminal in the project directory.
2. Run `openssl rand -base64 48`.
3. Copy the complete output into `ORDER_ACCESS_SECRET`.
4. Run `openssl rand -base64 48` a second time.
5. Copy the new output into `PAYMENT_WORKER_SECRET`.
6. Confirm the two values are different and each is at least 32 characters.

Do not reuse either value for another service. If one is exposed, generate a
replacement and update every environment that used it.

## Configure Resend email

### Verify a sending domain

1. Sign in to the Resend dashboard.
2. Open **Domains**, choose **Add Domain**, and enter a domain the business
   owns. A dedicated subdomain such as `updates.example.com` is recommended.
3. Open the domain's DNS records in Resend.
4. In the DNS provider that manages the business domain, add the SPF and DKIM
   records exactly as Resend displays them. Do not shorten the values or add
   extra quotation marks.
5. Return to Resend and choose **Verify DNS Records**.
6. Wait for the domain status to become **Verified**. DNS propagation can take
   up to 72 hours, although it is commonly much faster.

Official guide: <https://resend.com/docs/dashboard/domains/introduction>

### Create `RESEND_API_KEY`

1. In Resend, open **API Keys**.
2. Choose **Create API Key**.
3. Name it for the environment, for example `Suga Spies Local`.
4. Choose **Sending access**, not full access.
5. Restrict it to the verified sending domain when Resend offers that choice.
6. Create the key and immediately copy the value beginning with `re_` into
   `RESEND_API_KEY`.

Official guide: <https://resend.com/docs/api-reference/api-keys/create-api-key>

### Set the three email addresses

- `ORDER_EMAIL_FROM` is the sender on the verified domain, for example
  `orders@updates.example.com`. This project expects a plain email address,
  without a display name.
- `ORDER_ALERT_EMAIL` is the private inbox that receives owner alerts for new
  orders and payment exceptions.
- `ORDER_TEST_EMAIL` is the safe developer inbox. In local and staging payment
  mode, all order emails are redirected to this one address so a test cannot
  email a customer accidentally.

Before a domain is available, Resend's test sender
`onboarding@resend.dev` can send only to the email address belonging to the
Resend account. Use that account email as `ORDER_TEST_EMAIL`. Verify a business
domain before testing delivery to any other recipient.

## Configure the Google Maps server key

The application calls Google from the server for Address Validation and Routes.
There is no browser Maps key and this value must not start with `NEXT_PUBLIC_`.

1. Open Google Cloud Console and create or select a development project such as
   `Suga Spies Development`.
2. Open **Billing** and link an active billing account to that project.
3. Open **APIs & Services** > **Library**.
4. Search for **Address Validation API**, open it, and choose **Enable**.
5. Return to the library, search for **Routes API**, open it, and choose
   **Enable**.
6. Open **APIs & Services** > **Credentials**.
7. Choose **Create credentials** > **API key**.
8. Copy the generated value into `GOOGLE_MAPS_SERVER_API_KEY` in `.env.local`.
9. Immediately edit the key. Under **API restrictions**, choose **Restrict key**
   and allow only **Address Validation API** and **Routes API**.
10. For a deployed server with stable outbound IP addresses, add an
    **IP addresses** application restriction containing only those addresses.
    A local machine or serverless host may not have stable egress IPs; keep a
    separate development key, enforce API restrictions and low quotas, and use
    a fixed-egress proxy before production if the host cannot provide stable
    outbound IP addresses.
11. Create billing-budget alerts and conservative API quota limits for the
    development project.

Official security guide:
<https://developers.google.com/maps/api-security-best-practices>

## Configure Stripe sandbox values

Stripe sandbox keys are sufficient during development; no real customer charge
is made. Keep `PAYMENTS_MODE=disabled` until the complete section is ready.

### API keys

1. Sign in to Stripe and select a **Sandbox** or enable test mode.
2. Open **Developers** > **API keys**.
3. Copy the publishable key beginning with `pk_test_` into
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. For initial local testing, reveal the sandbox secret key beginning with
   `sk_test_`, or create a restricted sandbox key beginning with `rk_test_`.
5. If using a restricted key, grant only what this integration uses: write
   access to Checkout Sessions, read access to Payment Intents, and read/write
   access to Refunds. Leave unrelated resources disabled.
6. Copy the server key into `STRIPE_SECRET_KEY`.

Official guide: <https://docs.stripe.com/keys>

### Local webhook secret

1. Install the Stripe CLI. On macOS with Homebrew, run
   `brew install stripe/stripe-cli/stripe`.
2. Run `stripe login` and approve the browser authorization.
3. Run
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. The CLI prints a signing secret beginning with `whsec_`. Copy that exact
   value into `STRIPE_WEBHOOK_SECRET`.
5. Keep the listener running while testing checkout. The CLI secret is not the
   same as the secret for a webhook endpoint created in the Stripe dashboard.

Official signature guide: <https://docs.stripe.com/webhooks/signature>

### Enable sandbox checkout

After all required values are present:

```dotenv
PAYMENTS_MODE=test
```

Start the application, keep the Stripe listener running, and start the payment
reconciler with `npm run payments:worker`. The reconciler must remain active
while testing checkout.

For staging, create a Stripe webhook destination pointing to
`https://your-staging-domain.example/api/stripe/webhook` and subscribe to the
events listed in `app/api/stripe/webhook/route.ts`. Reveal that endpoint's own
`whsec_` signing secret and store it only in the staging environment.

