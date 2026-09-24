import { beforeEach, describe, expect, it, vi } from "vitest";
import { attemptFixture } from "@/tests/fixtures/payment";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  expire: vi.fn(),
  intent: vi.fn(),
  refund: vi.fn(),
  refundRetrieve: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/payments/stripe", () => ({
  stripeClient: () => ({
    checkout: { sessions: { retrieve: mocks.retrieve, expire: mocks.expire } },
    paymentIntents: { retrieve: mocks.intent },
    refunds: { create: mocks.refund, retrieve: mocks.refundRetrieve },
  }),
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ update: mocks.update }),
  }),
}));
import { reconcilePayment } from "@/lib/payments/processor";
beforeEach(() => {
  vi.resetAllMocks();
  const attempt = attemptFixture();
  mocks.retrieve.mockResolvedValue({
    id: attempt.stripe_session_id,
    status: "complete",
    payment_status: "paid",
    amount_total: 1500,
    client_reference_id: attempt.id,
    metadata: { payment_attempt_id: attempt.id },
    livemode: false,
    payment_intent: "pi_test",
  });
  mocks.intent.mockResolvedValue({
    id: "pi_test",
    status: "succeeded",
    amount_received: 1500,
    currency: "cad",
    livemode: false,
    metadata: { payment_attempt_id: attempt.id },
    latest_charge: {
      created: Math.floor(Date.now() / 1000) - 10,
      payment_method_details: {
        type: "card",
        card: { wallet: { type: "apple_pay" } },
      },
    },
  });
  mocks.rpc.mockResolvedValue({ data: "order-id", error: null });
  const query = { eq: vi.fn(), in: vi.fn(), error: null };
  query.eq.mockReturnValue(query);
  query.in.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue(query);
});
describe("verified provider reconciliation", () => {
  it.each(["google_pay", "apple_pay"])(
    "recognizes %s as an allowed wallet",
    async (type) => {
      const intent = await mocks.intent();
      intent.latest_charge.payment_method_details.card.wallet.type = type;
      await reconcilePayment(attemptFixture());
      expect(mocks.rpc).toHaveBeenCalledWith(
        "resolve_wallet_payment",
        expect.objectContaining({ p_action: "paid" }),
      );
    },
  );
  it("accepts a verified ordinary card payment without refunding it", async () => {
    const intent = await mocks.intent();
    intent.latest_charge.payment_method_details.card.wallet = null;
    await reconcilePayment(attemptFixture());
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "paid" }),
    );
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it.each([
    "unsupported_wallet",
    "non_card",
    "missing_details",
    "late_wallet",
    "late_card",
    "capacity_released",
  ])("compensates %s without creating an order", async (scenario) => {
    const intent = await mocks.intent();
    if (scenario === "unsupported_wallet")
      intent.latest_charge.payment_method_details.card.wallet.type = "link";
    if (scenario === "non_card")
      intent.latest_charge.payment_method_details.type = "klarna";
    if (scenario === "missing_details")
      intent.latest_charge.payment_method_details = null;
    if (scenario === "late_card")
      intent.latest_charge.payment_method_details.card.wallet = null;
    if (scenario === "late_wallet" || scenario === "late_card")
      intent.latest_charge.created = Math.floor(Date.now() / 1000) + 1000;
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.refund.mockResolvedValue({ id: "re_test", status: "succeeded" });
    await reconcilePayment(attemptFixture());
    expect(mocks.refund).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_test", amount: 1500 }),
      { idempotencyKey: `compensation:${attemptFixture().id}` },
    );
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "refunded" }),
    );
  });
  it("reuses a pending refund instead of issuing another", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.refundRetrieve.mockResolvedValue({
      id: "re_test",
      status: "pending",
    });
    await reconcilePayment({
      ...attemptFixture(),
      status: "refund_pending",
      stripe_refund_id: "re_test",
    });
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.refundRetrieve).toHaveBeenCalledWith("re_test");
  });
  it("keeps a failed refund visible for owner review", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.refund.mockResolvedValue({ id: "re_test", status: "failed" });
    await reconcilePayment({ ...attemptFixture(), status: "refund_pending" });
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "review" }),
    );
  });
  it("commits an Apple Pay order only after retrieving Stripe", async () => {
    await reconcilePayment(attemptFixture(), "evt_1");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({
        p_action: "paid",
        p_amount: 1500,
        p_currency: "cad",
        p_live: false,
      }),
    );
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("accepts a delayed success notification while capacity remains protected", async () => {
    await reconcilePayment(
      {
        ...attemptFixture(),
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
      "evt_late",
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "paid" }),
    );
  });
  it("checks current provider state instead of trusting an old expired event", async () => {
    await reconcilePayment(attemptFixture(), "evt_old_expired");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "paid" }),
    );
  });
  it("fails closed on amount mismatch", async () => {
    const intent = await mocks.intent();
    mocks.intent.mockResolvedValue({ ...intent, amount_received: 1 });
    await reconcilePayment(attemptFixture(), "evt_wrong");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "review" }),
    );
  });
  it("rejects another checkout's Stripe Session", async () => {
    const session = await mocks.retrieve();
    mocks.retrieve.mockResolvedValue({
      ...session,
      client_reference_id: "other",
    });
    await expect(reconcilePayment(attemptFixture())).rejects.toThrow(
      "identity mismatch",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not release capacity on provider timeout", async () => {
    mocks.retrieve.mockRejectedValue(new Error("timeout"));
    await expect(reconcilePayment(attemptFixture())).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("expires at the provider before releasing capacity", async () => {
    const session = await mocks.retrieve();
    mocks.retrieve.mockResolvedValue({
      ...session,
      status: "open",
      payment_intent: null,
    });
    mocks.expire.mockResolvedValue({
      ...session,
      status: "expired",
      payment_intent: null,
    });
    await reconcilePayment({
      ...attemptFixture(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(mocks.expire).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_wallet_payment",
      expect.objectContaining({ p_action: "expired" }),
    );
  });
  it("keeps an in-flight payment protected when expiry loses the race", async () => {
    const session = await mocks.retrieve();
    mocks.retrieve.mockResolvedValue({ ...session, status: "complete" });
    mocks.intent.mockResolvedValue({ id: "pi_test", status: "processing" });
    await reconcilePayment({
      ...attemptFixture(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" }),
    );
  });
  it("propagates database failure so Stripe retries the event", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(
      reconcilePayment(attemptFixture(), "evt_retry"),
    ).rejects.toThrow("committed");
  });
});
