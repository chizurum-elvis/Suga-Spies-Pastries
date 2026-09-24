# Card, wallet payment, and paid-order vertical slice

## What is implemented

The customer reviews one immutable server-priced purchase snapshot containing pastries, chosen options, delivery address and fee, cancellation deadline, and CAD total. Checkout does not collect tax; the total is exactly the authoritative pastry subtotal plus the confirmed delivery fee. A capacity reservation is created only when secure payment begins. It lasts 15 minutes from the database timestamp, remains counted while the payment provider outcome is uncertain, and becomes a website capacity entry and confirmed order only after Stripe is re-read and verifies the session identity, amount, currency, environment, successful PaymentIntent, and supported card payment (ordinary card, Apple Pay, or Google Pay).

Unsupported payment methods, late successes, and successes after capacity release never become an order. The server starts an idempotent full compensation refund and keeps failures visible to the owner. Wrong amounts or identity mismatches fail closed for review. Duplicate webhooks and repeated browser actions cannot create duplicate orders or notifications. Existing database RPC names contain `wallet` for compatibility; both supported card paths use the same protected settlement transaction, without a schema migration.

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
CRON_SECRET=generate-another-private-random-value
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

Production hosting must call the reconciliation route at least once per minute. This repository includes `vercel.json`, which asks Vercel Cron to call `GET /api/internal/payments/reconcile` every minute. Add a strong `CRON_SECRET` to the Vercel project; Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. Every-minute cron schedules require Vercel Pro. If the deployment uses another scheduler, call `POST /api/internal/payments/reconcile` with `Authorization: Bearer <PAYMENT_WORKER_SECRET>` instead.

Checkout deliberately refuses to start when the worker has not checked in for three minutes. This fail-closed check prevents an accepted wallet payment from being left unreconciled. After deployment, the first successful scheduled call creates the health heartbeat and enables checkout. Disabling new checkout does not stop reconciliation of an already accepted payment.

## Wallet test requirements

Stripe Express Checkout requires HTTPS and registered payment-method domains. Register every sandbox domain/subdomain in Stripe, use a compatible non-private browser, and configure Apple Pay or Google Pay on the test device. The page exposes only those two branded wallet buttons. Do not test using real payment details or live mode.

Stripe renders the card form in its secure iframe using the Payment Element; the application never receives raw card details. Cards work independently of wallet eligibility. Express Checkout renders optional Apple Pay and Google Pay buttons, without duplicating wallets inside the card form. Both use the same Checkout Session and confirmation action, including bank authentication. Network-uncertain results direct customers to server reconciliation, not another submission.

“Stop payment and edit order” first expires the Stripe session on the server. Only confirmed cancellation unlocks and opens the cart drawer; an in-flight payment remains locked. The drawer edits pastries and dates. “Edit contact & address” targets `/checkout#contact`; it does not select a delivery date. Stale status requests cannot overwrite a newer cancellation response.

For card testing in Stripe test mode, use `4242 4242 4242 4242` with a future expiry and any three-digit CVC. Use Stripe's [test card scenarios](https://docs.stripe.com/testing) for declines and bank authentication. Never use these test details in live mode or use real card details for test card entry.

## Production activation checklist

1. Add all payment variables to Vercel for the intended environment. Keep secret keys server-only; only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public.
2. In Stripe, enable Cards, Apple Pay, and Google Pay. Keep Link, PayPal, Klarna, Amazon Pay, and other methods disabled for this checkout.
3. Register the exact production HTTPS hostname under Stripe payment-method domains.
4. Create `https://your-domain/api/stripe/webhook` as a Stripe webhook endpoint and subscribe it to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, and `refund.updated`. Save that endpoint's own `whsec_...` value as `STRIPE_WEBHOOK_SECRET`.
5. Add a random `CRON_SECRET` containing at least 32 unpredictable characters, redeploy, and verify the every-minute reconciliation invocation succeeds.
6. Complete one sandbox order on a real compatible Apple Pay device and one on a real compatible Google Pay device. Confirm the amount, delivery fee, order, owner dashboard record, and test email.
7. Repeat the domain registration, webhook, secrets, and smoke test separately when switching from Stripe sandbox to live mode.

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

The database command runs 39 transactional assertions and rolls back all fixtures. It covers payment-worker health, stale/tampered review data, old-tab freezes, the hard four-order limit, duplicate events, provider-confirmed expiry, late-payment compensation, notification leases, and owner RLS.

For a manual sandbox run: start the app, Stripe CLI webhook forwarding, and payment worker; add a pastry; select an allowed delivery date; enter and confirm a supported GTA address; review the subtotal, delivery fee, and total; accept the development acknowledgement; and choose Apple Pay or Google Pay. Expect a processing screen first, then a confirmed order only after provider verification. Confirm the test order under `/admin/orders` and the test email only in `ORDER_TEST_EMAIL`.
