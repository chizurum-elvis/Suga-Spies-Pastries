import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRefundRow } from "@/lib/payments/database";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  intent: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/payments/stripe", () => ({
  stripeClient: () => ({
    paymentIntents: { retrieve: mocks.intent },
    refunds: {
      list: mocks.list,
      create: mocks.create,
      retrieve: mocks.retrieve,
    },
  }),
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({ STRIPE_SECRET_KEY: "sk_test_fixture" }),
}));
import {
  processOrderRefunds,
  refundOutcome,
} from "@/lib/orders/refund-processor";

function job(): OrderRefundRow {
  return {
    id: "98200000-0000-4000-8000-000000000010",
    order_id: "98200000-0000-4000-8000-000000000011",
    payment_attempt_id: "98200000-0000-4000-8000-000000000012",
    amount_cents: 1500,
    currency: "cad",
    test_only: true,
    requested_by: "customer",
    actor_user_id: null,
    reason: null,
    status: "queued",
    stripe_payment_intent_id: "pi_fixture",
    stripe_refund_id: null,
    requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    first_attempt_at: new Date().toISOString(),
    attempts: 1,
    next_attempt_at: new Date().toISOString(),
    lease_id: "98200000-0000-4000-8000-000000000013",
    lease_until: new Date(Date.now() + 120_000).toISOString(),
    failure_code: null,
  };
}
const providerRefund = (status = "succeeded") => ({
  id: "re_fixture",
  status,
  payment_intent: "pi_fixture",
  amount: 1500,
  currency: "cad",
  metadata: { order_refund_id: job().id },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.intent.mockResolvedValue({
    id: "pi_fixture",
    status: "succeeded",
    amount_received: 1500,
    currency: "cad",
    livemode: false,
    metadata: { payment_attempt_id: job().payment_attempt_id },
    latest_charge: { disputed: false, amount_refunded: 0 },
  });
  mocks.list.mockResolvedValue({ data: [], has_more: false });
  mocks.create.mockResolvedValue(providerRefund());
  mocks.retrieve.mockResolvedValue(providerRefund());
  mocks.rpc.mockImplementation(async (name) =>
    name === "claim_order_refunds"
      ? { data: [job()], error: null }
      : { data: true, error: null },
  );
});
afterEach(() => vi.useRealTimers());

describe("full order refunds", () => {
  it("refunds the exact paid total including delivery with a stable provider identity", async () => {
    expect(await refundOutcome(job())).toEqual({
      status: "succeeded",
      providerId: "re_fixture",
    });
    expect(mocks.create).toHaveBeenCalledWith(
      {
        payment_intent: "pi_fixture",
        amount: 1500,
        reason: "requested_by_customer",
        metadata: {
          order_refund_id: job().id,
          payment_attempt_id: job().payment_attempt_id,
        },
      },
      { idempotencyKey: `order-cancellation:${job().id}` },
    );
  });
  it("does not label a failed-delivery refund as customer-requested", async () => {
    const systemJob = { ...job(), requested_by: "system" as const };
    await refundOutcome(systemJob);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ reason: "requested_by_customer" }),
      { idempotencyKey: `order-cancellation:${systemJob.id}` },
    );
  });
  it.each(["pending", "succeeded", "failed", "canceled", "requires_action"])(
    "tracks Stripe's %s state truthfully",
    async (status) => {
      mocks.create.mockResolvedValue(providerRefund(status));
      expect((await refundOutcome(job())).status).toBe(
        status === "canceled"
          ? "failed"
          : status === "requires_action"
            ? "needs_review"
            : status,
      );
    },
  );
  it.each([
    "mode",
    "amount",
    "currency",
    "identity",
    "dispute",
    "unpaid",
    "charge",
  ])("does not refund an unverified %s", async (issue) => {
    const intent = await mocks.intent();
    if (issue === "mode") intent.livemode = true;
    if (issue === "amount") intent.amount_received = 1499;
    if (issue === "currency") intent.currency = "usd";
    if (issue === "identity") intent.metadata.payment_attempt_id = "other";
    if (issue === "dispute") intent.latest_charge.disputed = true;
    if (issue === "unpaid") intent.status = "processing";
    if (issue === "charge") intent.latest_charge = null;
    expect((await refundOutcome(job())).status).toBe("needs_review");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["amount", "currency", "identity"])(
    "does not mark a mismatched provider %s as refunded",
    async (field) => {
      const refund = providerRefund();
      if (field === "amount") refund.amount = 100;
      if (field === "currency") refund.currency = "usd";
      if (field === "identity") refund.payment_intent = "pi_other";
      mocks.create.mockResolvedValue(refund);
      expect((await refundOutcome(job())).status).toBe("needs_review");
    },
  );
  it("retrieves a known refund instead of issuing another", async () => {
    await refundOutcome({
      ...job(),
      stripe_refund_id: "re_fixture",
      status: "pending",
    });
    expect(mocks.retrieve).toHaveBeenCalledWith("re_fixture");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("recovers an unsaved Stripe refund after the idempotency window without creating another", async () => {
    mocks.list.mockResolvedValue({ data: [providerRefund()], has_more: false });
    expect(
      (
        await refundOutcome({
          ...job(),
          first_attempt_at: new Date(Date.now() - 48 * 3600_000).toISOString(),
        })
      ).status,
    ).toBe("succeeded");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("recognizes an existing full manual refund", async () => {
    mocks.list.mockResolvedValue({
      data: [{ ...providerRefund(), metadata: {} }],
      has_more: false,
    });
    expect((await refundOutcome(job())).status).toBe("succeeded");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([
    "partial",
    "multiple",
    "truncated",
    "charge_refunded",
    "expired_retry",
    "failed_job",
  ])(
    "requires review rather than risking another refund: %s",
    async (issue) => {
      const row = job();
      if (issue === "partial")
        mocks.list.mockResolvedValue({
          data: [{ ...providerRefund(), metadata: {}, amount: 500 }],
          has_more: false,
        });
      if (issue === "multiple")
        mocks.list.mockResolvedValue({
          data: [
            { ...providerRefund(), metadata: {} },
            { ...providerRefund(), metadata: {} },
          ],
          has_more: false,
        });
      if (issue === "truncated")
        mocks.list.mockResolvedValue({ data: [], has_more: true });
      if (issue === "charge_refunded")
        (await mocks.intent()).latest_charge.amount_refunded = 500;
      if (issue === "expired_retry")
        row.first_attempt_at = new Date(
          Date.now() - 23 * 3600_000,
        ).toISOString();
      if (issue === "failed_job") row.status = "failed";
      expect((await refundOutcome(row)).status).toBe("needs_review");
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("retains unknown provider outcomes for a safe retry", async () => {
    mocks.create.mockRejectedValue(new Error("response lost"));
    expect(await processOrderRefunds(job().id)).toMatchObject({
      checked: 1,
      failures: 1,
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "resolve_order_refund",
      expect.objectContaining({
        p_status: "queued",
        p_lease_id: job().lease_id,
        p_failure_code: "refund_provider_unavailable",
      }),
    );
  });
  it("saves the verified result using the database lease", async () => {
    await processOrderRefunds(job().id);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_order_refunds", {
      p_test_only: true,
      p_refund_id: job().id,
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("resolve_order_refund", {
      p_refund_id: job().id,
      p_lease_id: job().lease_id,
      p_status: "succeeded",
      p_provider_id: "re_fixture",
    });
  });
  it("does not call Stripe when another worker holds the lease", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await processOrderRefunds()).toMatchObject({ checked: 0 });
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it("reports a persistence failure so durable processing can recover", async () => {
    mocks.rpc.mockImplementation(async (name) =>
      name === "claim_order_refunds"
        ? { data: [job()], error: null }
        : { error: { message: "offline" } },
    );
    await expect(processOrderRefunds()).rejects.toThrow(
      "Refund result could not be saved",
    );
  });
});
