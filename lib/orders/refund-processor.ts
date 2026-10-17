import "server-only";
import type Stripe from "stripe";
import { getServerEnvironment } from "@/lib/env/server";
import type {
  OrderRefundRow,
  RedeliveryFeeRefundRow,
} from "@/lib/payments/database";
import { stripeClient } from "@/lib/payments/stripe";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import type { RefundStatus } from "@/lib/orders/cancellation";

type Outcome = {
  status: RefundStatus;
  providerId?: string;
  failureCode?: string;
};

function providerOutcome(refund: Stripe.Refund, job: OrderRefundRow): Outcome {
  const paymentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;
  if (
    paymentId !== job.stripe_payment_intent_id ||
    refund.amount !== job.amount_cents ||
    refund.currency !== "cad"
  )
    return { status: "needs_review", failureCode: "refund_identity_mismatch" };
  if (refund.status === "succeeded")
    return { status: "succeeded", providerId: refund.id };
  if (refund.status === "failed" || refund.status === "canceled")
    return {
      status: "failed",
      providerId: refund.id,
      failureCode: "provider_refund_failed",
    };
  if (refund.status === "pending")
    return { status: "pending", providerId: refund.id };
  return {
    status: "needs_review",
    providerId: refund.id,
    failureCode: "provider_action_required",
  };
}

export async function refundOutcome(
  job: OrderRefundRow,
  fee = false,
): Promise<Outcome> {
  const stripe = stripeClient();
  // Recheck the original charge and environment before any money movement.
  const intent = await stripe.paymentIntents.retrieve(
    job.stripe_payment_intent_id,
    { expand: ["latest_charge"] },
  );
  const charge =
    typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  if (
    intent.status !== "succeeded" ||
    intent.amount_received !== job.amount_cents ||
    intent.currency !== job.currency ||
    intent.livemode === job.test_only ||
    intent.metadata[fee ? "redelivery_order_id" : "payment_attempt_id"] !==
      (fee ? job.order_id : job.payment_attempt_id) ||
    !charge ||
    charge.disputed
  )
    return { status: "needs_review", failureCode: "refund_payment_unverified" };

  if (job.stripe_refund_id)
    return providerOutcome(
      await stripe.refunds.retrieve(job.stripe_refund_id),
      job,
    );

  // Recover a provider response lost after success, including after the 24-hour
  // idempotency window. Existing outside/manual refunds must not be duplicated.
  const existing = await stripe.refunds.list({
    payment_intent: intent.id,
    limit: 100,
  });
  if (existing.has_more)
    return {
      status: "needs_review",
      failureCode: "refund_history_needs_review",
    };
  const ours = existing.data.find(
    (refund) =>
      refund.metadata?.[
        fee ? "redelivery_fee_refund_id" : "order_refund_id"
      ] === job.id,
  );
  if (ours) return providerOutcome(ours, job);
  if (
    existing.data.length === 1 &&
    existing.data[0].amount === job.amount_cents &&
    ["pending", "succeeded"].includes(existing.data[0].status ?? "")
  )
    return providerOutcome(existing.data[0], job);
  if (existing.data.length || charge.amount_refunded > 0)
    return {
      status: "needs_review",
      failureCode: "existing_refund_needs_review",
    };
  if (
    !job.first_attempt_at ||
    Date.now() - Date.parse(job.first_attempt_at) >= 23 * 3600_000
  )
    return {
      status: "needs_review",
      failureCode: "refund_retry_window_expired",
    };
  if (
    job.status === "failed" ||
    job.status === "needs_review" ||
    job.status === "succeeded"
  )
    return {
      status: "needs_review",
      failureCode: "refund_manual_review_required",
    };

  const refund = await stripe.refunds.create(
    {
      payment_intent: intent.id,
      amount: job.amount_cents,
      ...(job.requested_by === "customer"
        ? { reason: "requested_by_customer" as const }
        : {}),
      metadata: {
        [fee ? "redelivery_fee_refund_id" : "order_refund_id"]: job.id,
        payment_attempt_id: job.payment_attempt_id,
      },
    },
    {
      idempotencyKey: `${fee ? "redelivery-fee" : "order-cancellation"}:${job.id}`,
    },
  );
  return providerOutcome(refund, job);
}

export async function processOrderRefunds(refundId?: string) {
  const key = getServerEnvironment().STRIPE_SECRET_KEY;
  if (!key) return { checked: 0, failures: 0, configured: false };
  const db = createSecretSupabaseClient();
  const claimed = await db.rpc("claim_order_refunds", {
    p_test_only: /^(sk|rk)_test_/.test(key),
    ...(refundId ? { p_refund_id: refundId } : {}),
  });
  if (claimed.error) throw new Error("Refund queue unavailable.");
  let failures = 0;
  await Promise.all(
    claimed.data.map(async (job) => {
      let outcome: Outcome;
      try {
        outcome = await refundOutcome(job);
      } catch {
        failures++;
        // Unknown provider outcomes stay queued for the same idempotent request.
        outcome = {
          status: job.status === "queued" ? "queued" : job.status,
          failureCode: "refund_provider_unavailable",
        };
      }
      const saved = await db.rpc("resolve_order_refund", {
        p_refund_id: job.id,
        p_lease_id: job.lease_id!,
        p_status: outcome.status,
        ...(outcome.providerId ? { p_provider_id: outcome.providerId } : {}),
        ...(outcome.failureCode ? { p_failure_code: outcome.failureCode } : {}),
      });
      if (saved.error)
        throw new Error(
          "Refund result could not be saved; the lease will be retried.",
        );
    }),
  );
  return { checked: claimed.data.length, failures, configured: true };
}

export async function processRedeliveryFeeRefunds(refundId?: string) {
  const key = getServerEnvironment().STRIPE_SECRET_KEY;
  if (!key) return { checked: 0, failures: 0, configured: false };
  const db = createSecretSupabaseClient();
  const claimed = await db.rpc("claim_redelivery_fee_refunds", {
    p_test_only: /^(sk|rk)_test_/.test(key),
    ...(refundId ? { p_refund_id: refundId } : {}),
  });
  if (claimed.error)
    throw new Error("Redelivery fee refund queue unavailable.");
  let failures = 0;
  await Promise.all(
    claimed.data.map(async (job: RedeliveryFeeRefundRow) => {
      let outcome: Outcome;
      try {
        outcome = await refundOutcome(job, true);
      } catch {
        failures++;
        outcome = {
          status: job.status === "queued" ? "queued" : job.status,
          failureCode: "refund_provider_unavailable",
        };
      }
      const saved = await db.rpc("resolve_redelivery_fee_refund", {
        p_refund_id: job.id,
        p_lease_id: job.lease_id!,
        p_status: outcome.status,
        ...(outcome.providerId ? { p_provider_id: outcome.providerId } : {}),
        ...(outcome.failureCode ? { p_failure_code: outcome.failureCode } : {}),
      });
      if (saved.error)
        throw new Error("Redelivery fee refund result could not be saved.");
    }),
  );
  return { checked: claimed.data.length, failures, configured: true };
}
