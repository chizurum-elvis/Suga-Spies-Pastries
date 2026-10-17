import { getServerEnvironment } from "@/lib/env/server";
import { stripeClient } from "@/lib/payments/stripe";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { reconcilePayment } from "@/lib/payments/processor";
import {
  processOrderRefunds,
  processRedeliveryFeeRefunds,
} from "@/lib/orders/refund-processor";
import { reconcileRedeliveryPayment } from "@/lib/orders/redelivery";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = getServerEnvironment().STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook unavailable", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  // Do not parse JSON before verification. Bound even chunked webhook bodies.
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing payload", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 256 * 1024) {
        await reader.cancel();
        return new Response("Payload too large", { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return new Response("Invalid payload", { status: 400 });
  } finally {
    reader.releaseLock();
  }
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      Buffer.concat(chunks),
      signature,
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const object = event.data.object;
  if (
    ![
      "checkout.session.completed",
      "checkout.session.expired",
      "checkout.session.async_payment_succeeded",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.refunded",
      "refund.updated",
      "refund.created",
      "refund.failed",
    ].includes(event.type)
  )
    return new Response(null, { status: 204 });
  const metadata = "metadata" in object ? object.metadata : null;
  // Refund payloads are notifications, not proof of the final money state.
  // Re-read Stripe under the same lease used by the scheduled worker.
  if (event.type.startsWith("refund.") || event.type === "charge.refunded") {
    const payment = "payment_intent" in object ? object.payment_intent : null;
    const paymentId = typeof payment === "string" ? payment : payment?.id;
    if (paymentId) {
      try {
        const job = await createSecretSupabaseClient()
          .from("order_refunds")
          .select("id,test_only")
          .eq("stripe_payment_intent_id", paymentId)
          .maybeSingle();
        if (job.error) throw new Error("Refund lookup unavailable");
        if (job.data) {
          if (job.data.test_only === event.livemode)
            return new Response("Environment mismatch", { status: 400 });
          const result = await processOrderRefunds(job.data.id);
          if (!result.configured || !result.checked || result.failures)
            return new Response("Refund check deferred; retry required", {
              status: 503,
            });
          return new Response(null, { status: 204 });
        }
        const feeJob = await createSecretSupabaseClient()
          .from("redelivery_fee_refunds")
          .select("id,test_only")
          .eq("stripe_payment_intent_id", paymentId)
          .maybeSingle();
        if (feeJob.error)
          throw new Error("Redelivery refund lookup unavailable");
        if (feeJob.data) {
          if (feeJob.data.test_only === event.livemode)
            return new Response("Environment mismatch", { status: 400 });
          const result = await processRedeliveryFeeRefunds(feeJob.data.id);
          if (!result.configured || !result.checked || result.failures)
            return new Response("Refund check deferred; retry required", {
              status: 503,
            });
          return new Response(null, { status: 204 });
        }
      } catch {
        return new Response("Refund event not committed; retry required", {
          status: 503,
        });
      }
    }
  }
  const redeliveryId = metadata?.redelivery_order_id;
  if (redeliveryId && /^[0-9a-f-]{36}$/i.test(redeliveryId)) {
    try {
      const db = createSecretSupabaseClient();
      const row = await db
        .from("order_redeliveries")
        .select("*")
        .eq("order_id", redeliveryId)
        .maybeSingle();
      if (row.error) throw new Error("Redelivery unavailable");
      if (row.data) await reconcileRedeliveryPayment(row.data);
      return new Response(null, { status: 204 });
    } catch {
      return new Response("Redelivery event not committed; retry required", {
        status: 503,
      });
    }
  }
  const attemptId = metadata?.payment_attempt_id;
  if (!attemptId || !/^[0-9a-f-]{36}$/i.test(attemptId))
    return new Response(null, { status: 204 });
  try {
    const result = await createSecretSupabaseClient()
      .from("payment_attempts")
      .select("*")
      .eq("id", attemptId)
      .maybeSingle();
    if (result.error) throw new Error("Database unavailable");
    if (!result.data) return new Response(null, { status: 204 });
    if (result.data.test_only === event.livemode)
      return new Response("Environment mismatch", { status: 400 });
    await reconcilePayment(result.data, event.id);
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Payment event not committed; retry required", {
      status: 503,
    });
  }
}
