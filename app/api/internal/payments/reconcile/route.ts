import { getServerEnvironment } from "@/lib/env/server";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { reconcilePayment } from "@/lib/payments/processor";
import { sendOrderNotifications } from "@/lib/payments/notifications";
import { isAuthorizedPaymentWorker } from "@/lib/payments/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

async function reconcilePayments(request: Request) {
  const env = getServerEnvironment();
  if (
    !isAuthorizedPaymentWorker(request.headers.get("authorization"), [
      env.PAYMENT_WORKER_SECRET,
      env.CRON_SECRET,
    ])
  )
    return new Response("Unauthorized", { status: 401 });
  // Disabling new payments must not strand an already accepted payment.
  if (!env.STRIPE_SECRET_KEY)
    return new Response("Provider not configured", { status: 503 });
  const testOnly = /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY);
  const db = createSecretSupabaseClient();
  const due = await db
    .from("payment_attempts")
    .select("*")
    .eq("test_only", testOnly)
    .not("status", "in", "(paid,expired,refunded)")
    .lte("next_reconcile_at", new Date().toISOString())
    .order("next_reconcile_at")
    .limit(4);
  if (due.error) return new Response("Worker unavailable", { status: 503 });
  let failures = 0;
  const paymentWork = Promise.all(
    due.data.map(async (attempt) => {
      const lease = await db
        .from("payment_attempts")
        .update({
          next_reconcile_at: new Date(Date.now() + 60_000).toISOString(),
          reconcile_count: attempt.reconcile_count + 1,
        })
        .eq("id", attempt.id)
        .eq("reconcile_count", attempt.reconcile_count)
        .select("id")
        .maybeSingle();
      if (lease.error) {
        failures++;
        return;
      }
      if (!lease.data) return;
      try {
        await reconcilePayment(attempt);
      } catch {
        failures++;
        await db
          .from("payment_attempts")
          .update({ failure_code: "provider_reconciliation_failed" })
          .eq("id", attempt.id);
        if (attempt.reconcile_count >= 4)
          await db
            .from("order_notifications")
            .upsert(
              { payment_attempt_id: attempt.id, kind: "owner_exception" },
              { onConflict: "payment_attempt_id,kind", ignoreDuplicates: true },
            );
      }
    }),
  );
  let notifications;
  try {
    [, notifications] = await Promise.all([
      paymentWork,
      sendOrderNotifications(),
    ]);
    if (!failures) {
      const health = await db.from("payment_worker_health").upsert({
        mode: testOnly ? "test" : "live",
        checked_at: new Date().toISOString(),
      });
      if (health.error)
        return new Response("Worker health unavailable", { status: 503 });
    }
  } catch {
    return new Response("Worker unavailable", { status: 503 });
  }
  return Response.json(
    { checked: due.data.length, failures, notifications },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Vercel Cron invokes routes with GET and sends CRON_SECRET as a Bearer token.
export async function GET(request: Request) {
  return reconcilePayments(request);
}

// The local worker and other authenticated schedulers use POST.
export async function POST(request: Request) {
  return reconcilePayments(request);
}
