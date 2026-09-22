import type { PurchaseSnapshot } from "../../lib/payments/schema";
import type { PaymentAttemptRow, OrderRow } from "../../lib/payments/database";

export function purchaseFixture(): PurchaseSnapshot {
  const productId = "20000000-0000-4000-8000-000000000001";
  const cart = {
    version: 1 as const,
    lines: [{ productId, variantId: null, optionSelections: [], quantity: 4 }],
  };
  return {
    version: 3,
    cart,
    currency: "CAD",
    subtotalCents: 1000,
    deliveryCents: 500,
    totalCents: 1500,
    testOnly: true,
    policyVersion: "development-only",
    fulfillmentDate: "2026-10-12",
    cancellationDeadline: "2026-10-11T04:00:00.000Z",
    delivery: {
      name: "Checkout Tester",
      email: "checkout-test@example.com",
      phone: "+14165550100",
      recipientName: "Pastry Recipient",
      address: {
        line1: "123 Test Street",
        line2: "Suite 200",
        city: "Toronto",
        province: "ON",
        country: "CA",
        postalCode: "M5V 3L9",
      },
      instructions: "Please ring the bell.",
    },
    validatedCart: {
      version: 1,
      status: "ready",
      currency: "CAD",
      validatedAt: "2026-09-11T10:00:00.000Z",
      itemCount: 4,
      lineCount: 1,
      subtotalCents: 1000,
      lines: [
        {
          ...cart.lines[0],
          lineId: "cookies",
          status: "ready",
          product: {
            name: "Chocolate Chip Cookies",
            slug: "chocolate-chip-cookies",
            image: {
              id: "cookies",
              src: "/images/storefront/chocolate-chunk-cookies.jpg",
              storagePath: null,
              alt: "Chocolate chip cookies",
              objectPosition: "center",
              isPrimary: true,
            },
          },
          variant: null,
          options: [],
          quantityRule: { minimum: 4, step: 1, maximum: null },
          baseUnitPriceCents: 250,
          unitPriceCents: 250,
          lineSubtotalCents: 1000,
          pricingFingerprint: "current-price",
          issues: [],
        },
      ],
    },
  };
}
export function attemptFixture(): PaymentAttemptRow {
  return {
    id: "98000000-0000-4000-8000-000000000001",
    checkout_draft_id: "98000000-0000-4000-8000-000000000002",
    hold_id: "98000000-0000-4000-8000-000000000003",
    access_token_hash: "a".repeat(64),
    review_token: "b".repeat(64),
    snapshot: purchaseFixture(),
    total_cents: 1500,
    currency: "cad",
    test_only: true,
    status: "open",
    stripe_session_id: "cs_test_fixture",
    stripe_payment_intent_id: null,
    stripe_refund_id: null,
    expires_at: new Date(Date.now() + 900_000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_reconcile_at: new Date().toISOString(),
    reconcile_count: 0,
    failure_code: null,
  };
}
export function orderFixture(): OrderRow {
  return {
    id: "98000000-0000-4000-8000-000000000004",
    order_number: "SS-123456789ABC",
    payment_attempt_id: attemptFixture().id,
    capacity_adjustment_id: "98000000-0000-4000-8000-000000000005",
    fulfillment_date: purchaseFixture().fulfillmentDate,
    status: "confirmed",
    payment_status: "paid",
    fulfillment_status: "received",
    snapshot: purchaseFixture(),
    test_only: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  };
}
