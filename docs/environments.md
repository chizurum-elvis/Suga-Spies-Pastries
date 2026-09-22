# Environments and secrets

Suga Spies has three deployment environments with independent service projects and credentials.

| Environment | Purpose | Data and integrations |
| --- | --- | --- |
| Local | Development on a trusted computer | Local Supabase where available; Stripe test mode only |
| Staging | Owner acceptance and release verification | Separate non-production Supabase project; Stripe test mode |
| Production | Real customers and orders | Production Supabase project; live Stripe credentials |

Set `APP_ENV` to `local`, `staging`, or `production`. `NODE_ENV` remains controlled by Next.js and must only use its supported values: `development`, `test`, or `production`.

## Local setup

Copy `.env.example` to `.env.local`. Never commit `.env.local` or paste its values into tickets, chat, screenshots, or documentation.

For the exact dashboard and terminal steps used to create every checkout,
email, and delivery credential, follow
[`development-credentials-setup.md`](development-credentials-setup.md).

Empty service variables are allowed while their vertical slice has not been connected. Once a Supabase or Stripe integration is enabled, its required public and private variables must be supplied together and validated before handling a request.

Owner authentication currently requires only `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It deliberately does not use the Supabase secret key. Authorization is enforced by the signed-in user's database session and Row Level Security.

## Public versus private values

Variables beginning with `NEXT_PUBLIC_` are embedded into browser JavaScript at build time and are public by definition.

Allowed public values:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Server-only secrets:

- `SUPABASE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_MAPS_SERVER_API_KEY` — Address Validation and Routes; never prefix this server key with `NEXT_PUBLIC_`.
- `ORDER_ACCESS_SECRET` — signs expiring guest order links.
- `PAYMENT_WORKER_SECRET` — authenticates the recurring payment reconciler.
- `RESEND_API_KEY` — sends order confirmation and owner-alert email.

Payment configuration (server-only unless named `NEXT_PUBLIC_`):

- `PAYMENTS_MODE` — `disabled`, `test`, or `live`; it defaults to `disabled`.
- `CHECKOUT_POLICIES_JSON` — approved version and HTTPS terms, privacy, and refund-policy URLs.
- `ORDER_EMAIL_FROM`, `ORDER_ALERT_EMAIL`, and `ORDER_TEST_EMAIL` — sandbox mail is forced to the test inbox.

Checkout does not calculate or collect tax. Do not add a tax environment variable; the payable total is the server-validated pastry subtotal plus delivery.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is only needed when self-hosting the same build across multiple server instances. If that deployment model is chosen, use one stable, randomly generated base64 AES key on every instance and keep it in the hosting platform's encrypted secret store. Next.js safely generates the key for ordinary local and single-build deployments.

Never create variables such as `NEXT_PUBLIC_SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_SECRET_KEY`, `NEXT_PUBLIC_DATABASE_URL`, or `NEXT_PUBLIC_SERVICE_ROLE_KEY`. Supabase secret keys bypass Row Level Security and must only be used after server-side authorization.

## Staging and production

- Store values in the deployment platform's encrypted environment settings, never in committed `.env.staging` or `.env.production` files.
- Build separately for staging and production because `NEXT_PUBLIC_` values are frozen into the client bundle during `next build`.
- Use HTTPS URLs in staging and production.
- Keep Supabase, Stripe, email, maps, and monitoring credentials separate between staging and production.
- Restrict who can read, create, or rotate secrets. Rotate immediately after suspected exposure.
- Redact secrets, authorization headers, payment payloads, and personal data from logs.
- Review Supabase Row Level Security and platform security advisors before production data is introduced.

## Release check

Before deployment:

1. Confirm `APP_ENV` and `NEXT_PUBLIC_SITE_URL` match the target environment.
2. Confirm public keys belong to the same target projects as their server-only counterparts.
3. Search the built client bundles and repository for secret-key prefixes.
4. Run lint, type checking, unit tests, a production build, and browser tests.
5. Verify security headers on the deployed HTTPS origin.
6. Verify the payment reconciler runs at least once per minute; checkout fails closed if it has not checked in for three minutes.
