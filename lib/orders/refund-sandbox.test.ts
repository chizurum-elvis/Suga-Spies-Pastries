// Opt-in network check. Ordinary unit runs never contact Stripe.
import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import type { OrderRefundRow } from "@/lib/payments/database";
vi.mock("server-only", () => ({}));
import { refundOutcome } from "@/lib/orders/refund-processor";

it.skipIf(process.env.RUN_STRIPE_REFUND_SANDBOX !== "1")(
  "refunds a real Stripe sandbox payment exactly once and recovers a lost result",
  async () => {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    if (!/^(sk|rk)_test_/.test(key))
      throw new Error(
        "Sandbox verification requires a test secret key; live keys are never accepted.",
      );
    const stripe = new Stripe(key, { timeout: 10_000, maxNetworkRetries: 0 });
    const attemptId = randomUUID();
    const intent = await stripe.paymentIntents.create(
      {
        amount: 1500,
        currency: "cad",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        metadata: {
          payment_attempt_id: attemptId,
          purpose: "cancellation-sandbox-verification",
        },
      },
      { idempotencyKey: `refund-test:${attemptId}` },
    );
    expect(intent.livemode).toBe(false);
    expect(intent.status).toBe("succeeded");
    const job: OrderRefundRow = {
      id: randomUUID(),
      order_id: randomUUID(),
      payment_attempt_id: attemptId,
      amount_cents: 1500,
      currency: "cad",
      test_only: true,
      requested_by: "customer",
      actor_user_id: null,
      reason: null,
      status: "queued",
      stripe_payment_intent_id: intent.id,
      stripe_refund_id: null,
      requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      first_attempt_at: new Date().toISOString(),
      attempts: 1,
      next_attempt_at: new Date().toISOString(),
      lease_id: randomUUID(),
      lease_until: null,
      failure_code: null,
    };
    const first = await refundOutcome(job);
    expect(first.status).toBe("succeeded");
    const recovered = await refundOutcome({
      ...job,
      first_attempt_at: new Date(Date.now() - 48 * 3600_000).toISOString(),
    });
    expect(recovered).toEqual(first);
    const known = await refundOutcome({
      ...job,
      status: "pending",
      stripe_refund_id: first.providerId!,
    });
    expect(known).toEqual(first);
    const refunds = await stripe.refunds.list({ payment_intent: intent.id });
    expect(refunds.data).toHaveLength(1);
    expect(refunds.data[0].amount).toBe(1500);
  },
  60_000,
);
