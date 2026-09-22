# Delivery-date scheduling vertical slice

## Current customer flow

Checkout uses two focused pages:

1. `/checkout/fulfillment` lets the customer choose one available delivery date.
2. `/checkout` keeps contact information, the verified delivery address and fee, the detailed order summary, and review/payment together.

Customers do not choose or receive a promised exact delivery time.

## Authoritative availability rules

- Use `America/Toronto` for calendar boundaries.
- Require four Toronto calendar days of notice.
- Allow booking up to two calendar months ahead.
- Wednesdays, Sundays, December 25, owner-created blackouts, and dates at the four-order capacity are unavailable.
- Monday, Tuesday, Thursday, Friday, and Saturday are normally open.
- Saving a date does not reserve capacity. The ordinary 15-minute capacity hold begins only when wallet payment starts.

The server revalidates the date when delivery details are saved, when payment review is built, and inside the atomic database reservation function.

## Date-only persistence

`checkout_drafts` stores `fulfillment_date` as a PostgreSQL `date`. It does not store a customer-selected time or a fabricated delivery timestamp. Payment snapshots and orders store `fulfillmentDate` using `YYYY-MM-DD`.

The deterministic cancellation cutoff is Toronto midnight at the start of the preceding calendar day. This gives the system a stable date-only cutoff without implying a delivery time.

## Capacity and security

- Website orders, owner-entered orders, phone orders, and Instagram orders share four spaces per date.
- Capacity decisions lock the date row before counting active adjustments and payment holds.
- Expired non-payment holds are removed from the count atomically.
- Browser-supplied availability, totals, and prices are never authoritative.
- The opaque checkout token remains in an HttpOnly, SameSite=Lax cookie; only its SHA-256 hash is stored.
- Public availability responses never expose the private delivery origin or owner notes.

## Owner controls

The owner may add or remove full-day blackouts and record external orders. Partial-time blackouts and exact-time settings are retired because the customer now selects a date only.

## Acceptance checks

1. Add a real pastry to the cart and choose **Choose delivery date**.
2. Confirm the scheduling page contains the calendar and rules but no order summary or time controls.
3. Verify dates earlier than the four-day boundary are disabled.
4. Verify Wednesdays and Sundays are closed.
5. Select an open date and continue.
6. Confirm `/checkout` contains contact/delivery information, review/payment, and the order summary.
7. Confirm each summary line shows quantity and unit price, such as `4 × $3.50`, plus its line subtotal.
8. Return to the date page and confirm the saved date remains selected.
9. Add a full-day owner blackout and confirm the public calendar closes that date without exposing the private note.
