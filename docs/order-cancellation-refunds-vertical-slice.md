# Order cancellation and full refunds

## Policy implemented

- Customers cancel from their secure `/orders/[id]` tracking page; accounts are not required.
- Cancellation must arrive before the deadline displayed at checkout: midnight in Toronto on the calendar day before delivery. Calendar arithmetic preserves the existing checkout promise across daylight-saving changes.
- The order must still be confirmed and at **Order received**. Once preparation starts, neither customer nor owner can cancel it.
- Working interpretation of the September 25 request: a cancellation the day after purchase qualifies when both conditions above still hold. There is no separate 24-hour-from-purchase exception.
- Eligible cancellation immediately stops fulfillment and releases exactly one daily capacity space. The full paid amount, including delivery, is refunded to the original Stripe payment method. No tax is added.
- Cancellation and refund completion are separate states. A Stripe outage must not falsely display “refunded” or resurrect a cancelled order.

## Customer and owner surfaces

- Tracking: explicit cancellation dialog, full amount, irreversible-action warning, clear deadline/preparation restrictions, keyboard focus recovery, retry errors, cancelled timeline, and refund progress.
- `/admin/orders`: cancelled filter and refund-attention queue.
- `/admin/orders/[id]`: owner cancellation with a private reason, refund amount/status/reference, and **Check refund status**. Cancelled orders cannot enter preparation.
- Customer and owner cancellation notices use the existing durable email queue. Refund failures notify the owner; separate customer refund-status emails remain disabled.

## Security and recovery

The database transaction locks the order, rechecks its version/status/deadline, releases capacity, creates one refund job, and appends one cancellation event. Preparation takes the same order-row lock. Repeated requests return the original cancellation result.

Guest mutations require the exact order's signed access cookie or matching recent checkout token, same-origin JSON, and explicit confirmation. No browser-supplied amount or provider identity is trusted. Owner actions revalidate the owner session and active database membership. RLS prevents other authenticated users from reading refunds; anonymous clients cannot call cancellation/refund RPCs directly.

The refund processor verifies the original Stripe payment amount, currency, attempt identity, environment, and dispute state. It uses a stable idempotency key plus provider-history recovery. Database leases prevent overlapping workers from processing the same job, and stale leases cannot overwrite a newer result. Unknown/partial/manual outcomes require owner attention rather than risking a second refund. Historical purchase totals and cancellation events remain immutable.

## Deployment requirements

1. Apply `20260925163853_order_cancellation_refunds.sql` before deploying the application changes. This migration was applied to the linked database on September 26, 2026. It does not cancel or refund existing orders.
2. Deploy the application code; a database migration alone does not add the controls to the public website.
3. Keep the existing Stripe secret, webhook secret, order-access secret, email configuration, and authenticated payment worker. No new secret is introduced by this feature.
4. On the existing Stripe webhook destination, retain the payment events and include `refund.created`, `refund.updated`, `refund.failed`, and `charge.refunded`. The destination is `/api/stripe/webhook`. Test and live environments use their own destination signing secrets.
5. Production must invoke `/api/internal/payments/reconcile` at least once per minute. The checked-in once-daily Vercel Hobby schedule is only a fallback, not sufficient for prompt recovery. Use a hosting plan that permits per-minute scheduling or an external scheduler with `Authorization: Bearer <PAYMENT_WORKER_SECRET>`. Do not put secrets in URLs. No hosting upgrade or external scheduler was purchased/configured by this change.
6. In local development, run `npm run payments:worker` in a second terminal. Ensure its `NEXT_PUBLIC_SITE_URL` points at the local app, not the public site.
7. If Stripe reports a failed refund, investigate in Stripe and use **Check refund status**. This deliberately does not issue another refund blindly. Partial refunds, disputes, or refunds requiring a different payout method need manual handling; never mark money returned without provider evidence.

Stripe says card refund visibility commonly takes 5–10 business days; this is not a guaranteed arrival date. See [Stripe refunds](https://docs.stripe.com/refunds). Safe retries follow [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests).

## Manual acceptance test (Stripe test mode only)

1. Start the app and local payment worker. Verify `PAYMENTS_MODE=test` and matching Stripe test keys. Do not use a real customer order.
2. Place a paid test order for an available date at least four days ahead. Keep it at **Order received**.
3. Open the secure tracking page. Click **Cancel order**. Check the order number, complete refund amount, and warning. **Keep order** or Escape must leave the order unchanged.
4. Confirm **Cancel & refund**. The page must say **Order cancelled**, then show processing/issued status. Reload and check that cancellation is preserved.
5. In Stripe's test dashboard, verify one full refund on the original test payment. Clicking/retrying cancellation must never create a second refund.
6. In `/admin/orders`, choose **Cancelled** and open the development test order. Verify the refund and cancellation history. Check `/admin/availability` to confirm that its daily space was released.
7. Place a separate test order. In admin, mark it **Being prepared**. Customer and owner cancellation must now be unavailable, even before the delivery cutoff. Do not prepare an order you still want to use for the happy-path cancellation test.
8. Test an eligible owner cancellation on another test order, entering a reason. Only the owner should see that private reason and Stripe reference; the customer sees the cancellation and refund status.
9. Test on mobile and desktop. Tab through the dialog, close with Escape, and test a slow/offline request. No uncertain network result should be presented as a successful refund.

## Automated verification

- `npm run test:unit`: rule boundaries, API authorization/validation, owner authorization, notification routing, signed webhook processing, Stripe identity verification, duplicate/lost-response recovery.
- `npm run test:db`: all database suites run inside rollback transactions, including cancellation RLS, state transitions, capacity release, lease fencing, immutability and failure recovery.
- Before applying this migration to a fresh database only: `npm run test:db:cancellation:migration` executes the migration and its tests inside a rollback transaction. Once applied, use `npm run test:db` instead.
- Build, then run `node_modules/.bin/playwright test tests/e2e/cancellation.spec.ts tests/e2e/payment.spec.ts --project=chromium-desktop --project=webkit-mobile` for desktop/mobile UI, accessibility, preparation races, network errors and payment regressions. These browser tests mock the order API and payment SDK where marked; they do not constitute a live-money test.
- Opt-in real Stripe sandbox check: `RUN_STRIPE_REFUND_SANDBOX=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/orders/refund-sandbox.test.ts`. It rejects live keys, creates a labelled synthetic CAD15 test payment, fully refunds it, and verifies repeat recovery finds exactly one refund. No real money moves and no customer email is sent.

Local build note: Turbopack was blocked by a process/port permission in the automation environment. The supported `npm run build -- --webpack` production build passed; the project's default build command was not changed.

### Verification results — September 26, 2026

- 415 unit tests passed; the opt-in network test is skipped in ordinary unit runs and was run separately against Stripe sandbox successfully.
- All 14 rollback-only database suites passed after the migration, including 48 cancellation-specific assertions. An older capacity test was scoped to its own test date so unrelated existing bookings do not affect its expected count.
- All 24 cancellation/payment browser cases passed in Chromium desktop and mobile WebKit. Cancellation checks cover keyboard focus, accessibility, reduced motion, and widths from 320 to 1920 pixels.
- Authenticated owner order detail was inspected on desktop and mobile, including axe accessibility checks and blocked cancellation for the existing completed test order. No existing order was changed. The temporary inspection session was revoked; the owner's password and other sessions were unchanged. Eligible owner mutation behavior is covered by action and database tests, not a real-order UI cancellation.
- Type checking, lint, formatting, whitespace checks, and the webpack production build passed.
- Firefox could not launch its browser subprocess under this environment's macOS permissions; Firefox verification remains outstanding.
- Post-migration Supabase security advisors reported only the pre-existing **Leaked Password Protection Disabled** Auth warning, and migration dry-run reported no pending migrations.
- The code has not been pushed to GitHub or deployed to Vercel as part of this work. Production scheduling and webhook event configuration still require the release steps above.
