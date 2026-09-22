import { getServerEnvironment } from "@/lib/env/server";
import { stripeClient } from "@/lib/payments/stripe";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { reconcilePayment } from "@/lib/payments/processor";

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
    ].includes(event.type)
  )
    return new Response(null, { status: 204 });
  const metadata = "metadata" in object ? object.metadata : null;
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
