# Wallet payment and paid-order vertical slice

## What is implemented

The customer now reviews one immutable server-priced purchase snapshot containing pastries, chosen options, delivery address and fee, cancellation deadline, and CAD total. Checkout does not collect tax; the total is exactly the authoritative pastry subtotal plus the confirmed delivery fee. A capacity reservation is created only when secure payment begins. It lasts 15 minutes from the database timestamp, remains counted while the payment provider outcome is uncertain, and becomes a website capacity entry and confirmed order only after Stripe is re-read and verifies the session identity, amount, currency, environment, successful PaymentIntent, and Apple Pay or Google Pay wallet.

Ordinary card payments, wrong amounts, late successes, and successes after capacity release never become an order. The server starts an idempotent full compensation refund and keeps failures visible to the owner. Duplicate webhooks and repeated browser actions cannot create duplicate orders or notifications.

The customer receives a private confirmation page and a signed order link. The raw link credential is carried in the URL fragment, exchanged for an HttpOnly order-scoped cookie, and removed from the visible URL. The owner receives a paginated order list, full delivery/order detail, payment exceptions, and email status. Row Level Security denies these records to anonymous and non-owner browser sessions.

## Sandbox variables

Keep `PAYMENTS_MODE=disabled` until every required value is ready. For development, use:

```dotenv
APP_ENV=local
PAYMENTS_MODE=test
NEXT_PUBLIC_SITE_URL=https://your-development-tunnel.example
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=rk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ORDER_ACCESS_SECRET=generate-a-private-random-value
PAYMENT_WORKER_SECRET=generate-a-different-private-random-value
RESEND_API_KEY=re_...
ORDER_EMAIL_FROM=orders@your-verified-domain.example
ORDER_ALERT_EMAIL=owner@example.com
ORDER_TEST_EMAIL=developer-test-inbox@example.com
```

No tax key is required in sandbox or live environments. Live checkout requires approved policy URLs in `CHECKOUT_POLICIES_JSON`, Google delivery verification, production email, a production HTTPS origin, and `APP_ENV=production`.

Prefer a Stripe restricted sandbox key (`rk_test_...`) with only the permissions this application uses: Checkout Sessions write, PaymentIntents read, Charges read, and Refunds write/read. A sandbox secret key (`sk_test_...`) also works during early development but has broader access. Only the publishable key can appear in browser code.

## Webhook and worker

For local webhook testing, install and authenticate the Stripe CLI, then forward events to the app:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the command's temporary `whsec_...` value to `STRIPE_WEBHOOK_SECRET` and restart the app. In a deployed sandbox, create a Stripe webhook endpoint at `https://your-domain/api/stripe/webhook` and use that endpoint's own signing secret. Sandbox and live endpoints have different secrets.

In another terminal run the recovery worker while testing:

```bash
npm run payments:worker
```

Production hosting must call `POST /api/internal/payments/reconcile` with `Authorization: Bearer <PAYMENT_WORKER_SECRET>` at least once per minute. Use the hosting provider's secret scheduler. Checkout deliberately refuses to start when the worker has not checked in for three minutes. Disabling new checkout does not stop reconciliation of an already accepted payment.

## Wallet test requirements

Stripe Express Checkout requires HTTPS and registered payment-method domains. Register every sandbox domain/subdomain in Stripe, use a compatible non-private browser, and configure Apple Pay or Google Pay on the test device. The page exposes only those two branded wallet buttons. Do not test using real payment details or live mode.

## Verification

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:db:payments
npm run test:db
npm run build
npm run test:e2e
```

The database command runs 38 transactional assertions and rolls back all fixtures. It covers payment-worker health, stale/tampered review data, old-tab freezes, the hard four-order limit, duplicate events, provider-confirmed expiry, late-payment compensation, notification leases, and owner RLS.

For a manual sandbox run: start the app, Stripe CLI webhook forwarding, and payment worker; add a pastry; select an allowed delivery date; enter and confirm a supported GTA address; review the subtotal, delivery fee, and total; accept the development acknowledgement; and choose Apple Pay or Google Pay. Expect a processing screen first, then a confirmed order only after provider verification. Confirm the test order under `/admin/orders` and the test email only in `ORDER_TEST_EMAIL`.
