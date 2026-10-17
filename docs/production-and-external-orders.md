# Kitchen production and external orders

## What the owner sees

- `/admin/production` groups paid website-order snapshot quantities by delivery date, product, variant, and selected options. Paid redeliveries move to their scheduled date. Cancelled, delivered, and unpaid work is excluded.
- Owner-entered phone/Instagram orders appear in a separate preparation section. Their quantities are useful for the kitchen, but **their payment is not verified by Stripe**.
- Legacy date-only external capacity reservations remain visible as **spaces without item details**, never silently included in pastry totals.
- The test-mode switch applies to website orders only. External orders appear only in live mode.

## Off-site order workflow

1. The owner opens `/admin/external-orders/new` from Production or Availability.
2. They enter customer contact, a delivery date and address, pastries and quantities, plus optional item/owner notes. The current catalogue enforces minimum, step, maximum, publication, and availability rules in the database.
3. Google validates the address and driving distance against the configured delivery area. An approximate or corrected address requires an explicit owner confirmation. The database rechecks the delivery date and atomically creates the record with one capacity reservation; a fifth order fails.
4. The detail page shows the captured items and private contact/address, plus an append-only stage timeline: received → preparing → ready → out for delivery → delivered. Cancellation is only allowed before preparation starts and releases the capacity space.

No charge, email, customer-facing tracking link, or paid status is created for off-site orders. The owner must not treat this record as payment evidence. The business must decide how phone/Instagram customers pay before any payment confirmation, refund, or guest tracking is attached to this workflow.

## Deployment and checks

Apply the migrations in order:

- `20261003152035_production_redelivery_date_index.sql`
- `20261003161000_external_orders.sql`

Do not deploy the new owner pages before the migrations. The `external_orders` and `external_order_events` tables are owner-readable only; writes use guarded RPCs. Run the rollback-only `supabase/tests/external_orders_test.sql` against a migrated database, then verify:

1. A paid website order appears under its delivery date with the right quantity and selections.
2. An off-site order reserves one of four spaces and appears separately with its pastry list.
3. Quantity below the catalogue minimum, closed dates, addresses outside the permitted cities/distance, and a fifth daily order fail without creating an external record.
4. Stage updates append to the timeline. An old tab cannot overwrite a newer stage. Cancelling a received order releases its space; cancelling once preparing has begun is rejected.
5. Existing date-only reservations show a warning instead of becoming fictitious pastry quantities.
