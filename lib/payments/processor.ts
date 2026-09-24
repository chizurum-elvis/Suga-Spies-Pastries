import "server-only";
import type Stripe from "stripe";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import type { PaymentAttemptRow } from "@/lib/payments/database";
import {
  purchaseSnapshotSchema,
  type PaymentAttemptView,
} from "@/lib/payments/schema";
import { stripeClient, sessionParameters } from "@/lib/payments/stripe";

export async function ensurePaymentSession(attempt: PaymentAttemptRow) {
  const stripe = stripeClient();
  if (attempt.stripe_session_id)
    return stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
  // Do not replay creation after Stripe's idempotency retention could have elapsed.
  if (Date.now() - new Date(attempt.created_at).getTime() > 29 * 60_000)
    throw new Error("Unresolved payment creation requires owner review.");
  const session = await stripe.checkout.sessions.create(
    sessionParameters(attempt),
    { idempotencyKey: `checkout:${attempt.id}` },
  );
  const { error } = await createSecretSupabaseClient()
    .from("payment_attempts")
    .update({
      stripe_session_id: session.id,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "creating");
  if (error)
    throw new Error(
      "Payment session could not be saved. Retry the same attempt.",
    );
  return session;
}

async function resolve(
  attempt: PaymentAttemptRow,
  action: string,
  eventId: string,
  sessionId: string,
  intent?: Stripe.PaymentIntent,
) {
  const { data, error } = await createSecretSupabaseClient().rpc(
    "resolve_wallet_payment",
    {
      p_attempt_id: attempt.id,
      p_action: action,
      p_event_id: eventId,
      p_session_id: sessionId,
      ...(intent
        ? {
            p_payment_id: intent.id,
            p_amount: intent.amount_received,
            p_currency: intent.currency,
            p_live: intent.livemode,
          }
        : {}),
    },
  );
  if (error) throw new Error("Payment resolution could not be committed.");
  return data;
}

export async function reconcilePayment(
  attempt: PaymentAttemptRow,
  eventId?: string,
  cancel = false,
) {
  if (["paid", "expired", "refunded"].includes(attempt.status) && !eventId)
    return;
  const stripe = stripeClient();
  let session = await ensurePaymentSession(attempt);
  if (
    session.client_reference_id !== attempt.id ||
    session.metadata?.payment_attempt_id !== attempt.id ||
    session.livemode === attempt.test_only
  )
    throw new Error("Payment identity mismatch.");
  const timedOut = new Date(attempt.expires_at).getTime() <= Date.now();
  if ((timedOut || cancel) && session.status === "open") {
    try {
      session = await stripe.checkout.sessions.expire(
        session.id,
        {},
        { idempotencyKey: `expire:${attempt.id}` },
      );
    } catch {
      session = await stripe.checkout.sessions.retrieve(session.id);
    }
  }
  // Re-read the provider's current outcome, not the possibly old webhook payload.
  let intent: Stripe.PaymentIntent | undefined;
  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (intentId)
    intent = await stripe.paymentIntents.retrieve(intentId, {
      expand: ["latest_charge"],
    });
  if (intent?.status === "succeeded") {
    if (
      intent.amount_received !== attempt.total_cents ||
      intent.currency !== "cad" ||
      session.amount_total !== attempt.total_cents ||
      intent.livemode === attempt.test_only ||
      intent.metadata.payment_attempt_id !== attempt.id
    ) {
      await resolve(
        attempt,
        "review",
        eventId ?? `review:${intent.id}`,
        session.id,
      );
      return;
    }
    const charge =
      typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const details = charge?.payment_method_details;
    const wallet = details?.card?.wallet;
    const allowedCard =
      details?.type === "card" &&
      Boolean(details.card) &&
      (!wallet || wallet.type === "apple_pay" || wallet.type === "google_pay");
    const withinDeadline =
      typeof charge?.created === "number" &&
      charge.created * 1000 < new Date(attempt.expires_at).getTime();
    const accepted = allowedCard && withinDeadline;
    const orderId = await resolve(
      attempt,
      accepted && attempt.status !== "refund_pending"
        ? "paid"
        : "refund_pending",
      eventId ??
        `settle:${intent.id}:${accepted ? "wallet" : "unsupported-or-late"}`,
      session.id,
      intent,
    );
    if (!orderId) {
      // Capacity was already released, or payment used an unsupported method.
      const refund = attempt.stripe_refund_id
        ? await stripe.refunds.retrieve(attempt.stripe_refund_id)
        : await stripe.refunds.create(
            {
              payment_intent: intent.id,
              amount: attempt.total_cents,
              metadata: { payment_attempt_id: attempt.id },
            },
            { idempotencyKey: `compensation:${attempt.id}` },
          );
      const saved = await createSecretSupabaseClient()
        .from("payment_attempts")
        .update({ stripe_refund_id: refund.id })
        .eq("id", attempt.id);
      if (saved.error) throw new Error("Refund reference could not be saved.");
      if (refund.status === "succeeded")
        await resolve(
          attempt,
          "refunded",
          `refund:${refund.id}:succeeded`,
          session.id,
          intent,
        );
      if (refund.status === "failed" || refund.status === "canceled")
        await resolve(
          attempt,
          "review",
          `refund:${refund.id}:failed`,
          session.id,
        );
    }
  } else if (
    session.status === "expired" &&
    (!intent || ["canceled", "requires_payment_method"].includes(intent.status))
  ) {
    await resolve(
      attempt,
      "expired",
      eventId ?? `expired:${session.id}`,
      session.id,
    );
  } else if (session.status === "complete" || intent?.status === "processing") {
    const { error } = await createSecretSupabaseClient()
      .from("payment_attempts")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", attempt.id)
      .in("status", ["creating", "open"]);
    if (error) throw new Error("Payment processing state could not be saved.");
  }
}

export async function attemptView(
  attempt: PaymentAttemptRow,
  includeSecret = false,
): Promise<PaymentAttemptView> {
  const db = createSecretSupabaseClient();
  const order = await db
    .from("orders")
    .select("id")
    .eq("payment_attempt_id", attempt.id)
    .maybeSingle();
  if (order.error) throw new Error("Order status could not be loaded.");
  let clientSecret: string | null = null;
  if (
    includeSecret &&
    ["creating", "open"].includes(attempt.status) &&
    new Date(attempt.expires_at).getTime() > Date.now()
  ) {
    const session = await ensurePaymentSession(attempt);
    if (session.status === "open") clientSecret = session.client_secret;
  }
  return {
    id: attempt.id,
    status: attempt.status,
    expiresAt: attempt.expires_at,
    orderId: order.data?.id ?? null,
    clientSecret,
    snapshot: purchaseSnapshotSchema.parse(attempt.snapshot),
  };
}
