# Order fulfillment and customer tracking

This slice begins after a provider-confirmed payment has created an immutable paid order.

## Lifecycle

Orders move forward through one fixed sequence:

1. `received`
2. `preparing`
3. `ready`
4. `out_for_delivery`
5. `delivered`

The database rejects skipped, reversed, stale, or direct status changes. A successful owner action updates the order, appends the customer-visible event, and queues the matching email in one transaction. The final transition also changes the order from `confirmed` to `completed`.

## Owner workflow

- `/admin/orders` lists paid orders by earliest delivery date and supports order-number, stage, and delivery-date filters.
- `/admin/orders/[id]` shows the purchase snapshot, delivery details, immutable timeline, email status, and only the next valid stage action.
- Every mutation rechecks the authenticated user against the active `admin_users` owner allow-list beside the database write.
- Concurrent or stale tabs receive a conflict instead of overwriting newer work.
- Failed stage emails can be requeued only inside the provider's safe idempotency window.

## Customer workflow

- The signed order link is exchanged for a scoped, HttpOnly access cookie; the token is removed from the visible URL.
- The tracking page returns only customer-safe event fields. Actor IDs, private metadata, and notification failures stay private.
- The page refreshes while visible, supports manual refresh, retains the last good state during a temporary failure, and announces a changed stage to assistive technology.
- Payment, order, and fulfillment states are displayed separately so a paid order cannot appear unpaid while it is being prepared.

## Email delivery

The existing payment worker processes the transactional outbox. It sends the confirmation after payment, then one customer email for each later stage. Resend receives a stable idempotency key so a worker retry cannot intentionally duplicate a message.

The worker must be running in every deployed environment that should send email:

```sh
npm run payments:worker
```

## Verification

The migration has a rollback-only pgTAP suite covering authorization, sequencing, optimistic concurrency, idempotency, append-only history, completion, email outbox creation, and safe retry. Application tests cover lifecycle helpers, notification routing, secure guest tracking, accessibility, mobile overflow, and stage refresh.

Useful commands:

```sh
npm run test:db
npm run test:unit
npm run typecheck
npm run lint
npm run test:e2e
```
