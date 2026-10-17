import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RedeliveryRow } from "@/lib/payments/database";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  expire: vi.fn(),
  intent: vi.fn(),
  rpc: vi.fn(),
  order: vi.fn(),
  worker: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({
    NEXT_PUBLIC_SITE_URL: "https://pastries.example.com",
    STRIPE_SECRET_KEY: "sk_test_fixture",
  }),
}));
vi.mock("@/lib/payments/stripe", () => ({
  stripeClient: () => ({
    checkout: { sessions: { retrieve: mocks.session, expire: mocks.expire } },
    paymentIntents: { retrieve: mocks.intent },
  }),
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: mocks.order,
          maybeSingle:
            table === "payment_worker_health" ? mocks.worker : vi.fn(),
        }),
      }),
    }),
  }),
}));
import {
  beginRedeliveryPayment,
  reconcileRedeliveryPayment,
  redeliverySessionParams,
} from "@/lib/orders/redelivery";

const orderId = "98300000-0000-4000-8000-000000000101";
const adjustmentId = "98300000-0000-4000-8000-000000000102";
const expiry = "2026-09-29T13:15:00.000Z";
function row(): RedeliveryRow {
  return {
    order_id: orderId,
    state: "awaiting_payment",
    payment_status: "pending",
    stripe_session_id: "cs_test_redelivery",
    capacity_adjustment_id: adjustmentId,
    payment_expires_at: expiry,
    fee_cents: 500,
  } as RedeliveryRow;
}
function session() {
  return {
    id: "cs_test_redelivery",
    client_reference_id: orderId,
    metadata: {
      redelivery_order_id: orderId,
      capacity_adjustment_id: adjustmentId,
    },
    amount_total: 500,
    livemode: false,
    status: "complete",
    payment_status: "paid",
    payment_intent: "pi_redelivery",
  };
}
function intent(created = Date.parse("2026-09-29T13:10:00.000Z") / 1000) {
  return {
    id: "pi_redelivery",
    status: "succeeded",
    amount_received: 500,
    currency: "cad",
    livemode: false,
    metadata: { redelivery_order_id: orderId },
    latest_charge: {
      created,
      disputed: false,
      payment_method_details: {
        type: "card",
        card: { wallet: { type: "apple_pay" } },
      },
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(session());
  mocks.intent.mockResolvedValue(intent());
  mocks.order.mockResolvedValue({ data: { test_only: true }, error: null });
  mocks.worker.mockResolvedValue({
    data: { checked_at: new Date().toISOString() },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: "scheduled", error: null });
});

describe("redelivery fee payment", () => {
  it("refuses a new capacity reservation when reconciliation is not running", async () => {
    mocks.worker.mockResolvedValue({
      data: { checked_at: new Date(Date.now() - 181_000).toISOString() },
      error: null,
    });
    await expect(beginRedeliveryPayment(orderId, 6)).rejects.toMatchObject({
      code: "redelivery_payment_unavailable",
      status: 503,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reuses an existing provider session only while the worker is healthy", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: row(), error: null });
    mocks.session.mockResolvedValueOnce({
      ...session(),
      status: "open",
      url: "https://checkout.stripe.com/c/pay/redelivery",
    });
    await expect(beginRedeliveryPayment(orderId, 6)).resolves.toBe(
      "https://checkout.stripe.com/c/pay/redelivery",
    );
    expect(mocks.rpc).toHaveBeenCalledWith("begin_redelivery_payment", {
      p_order_id: orderId,
      p_expected_version: 6,
    });
  });
  it("creates a CAD card checkout without Link or automatic tax", () => {
    const params = redeliverySessionParams(
      row(),
      "customer@example.com",
      "SS-123",
    );
    expect(params).toMatchObject({
      mode: "payment",
      payment_method_types: ["card"],
      automatic_tax: { enabled: false },
      wallet_options: { link: { display: "never" } },
      client_reference_id: orderId,
      line_items: [
        { quantity: 1, price_data: { currency: "cad", unit_amount: 500 } },
      ],
      success_url: `https://pastries.example.com/orders/${orderId}`,
    });
  });
  it("settles only a provider-verified payment made during the capacity hold", async () => {
    await reconcileRedeliveryPayment(row());
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_redelivery_payment",
      expect.objectContaining({
        p_action: "paid",
        p_order_id: orderId,
        p_payment_id: "pi_redelivery",
      }),
    );
  });
  it("refunds a charge created after the 15-minute hold", async () => {
    mocks.intent.mockResolvedValue(
      intent(Date.parse("2026-09-29T13:15:01.000Z") / 1000),
    );
    await reconcileRedeliveryPayment(row());
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_redelivery_payment",
      expect.objectContaining({
        p_action: "late_paid",
        p_order_id: orderId,
      }),
    );
  });
  it("refuses a session for another order or amount before any state change", async () => {
    mocks.session.mockResolvedValue({ ...session(), amount_total: 100 });
    await expect(reconcileRedeliveryPayment(row())).rejects.toThrow(
      "identity mismatch",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses disputed or non-card charges before confirming a delivery", async () => {
    mocks.intent.mockResolvedValue({
      ...intent(),
      latest_charge: {
        ...intent().latest_charge,
        disputed: true,
      },
    });
    await expect(reconcileRedeliveryPayment(row())).rejects.toThrow(
      "requires owner review",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
