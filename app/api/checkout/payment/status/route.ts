import { type NextRequest } from "next/server";
import { CHECKOUT_DRAFT_COOKIE } from "@/lib/fulfillment/checkout-draft";
import { currentAttempt } from "@/lib/payments/review";
import { attemptView, reconcilePayment } from "@/lib/payments/processor";
import { paymentResponse, paymentFailure } from "@/lib/payments/http";
import { readCheckoutJson } from "@/lib/security/json-request";

export async function GET(request: NextRequest) {
  try {
    const attempt = await currentAttempt(
      request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
    );
    return paymentResponse({
      attempt: attempt ? await attemptView(attempt) : null,
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await readCheckoutJson(request, 1024);
    const token = request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value;
    const attempt = await currentAttempt(token);
    // Shared compare-and-set throttle bounds provider requests from repeated tabs.
    if (attempt && !["paid", "expired", "refunded"].includes(attempt.status)) {
      const { createSecretSupabaseClient } =
        await import("@/lib/supabase/secret");
      const lease = await createSecretSupabaseClient()
        .from("payment_attempts")
        .update({
          next_reconcile_at: new Date(Date.now() + 15_000).toISOString(),
        })
        .eq("id", attempt.id)
        .lte("next_reconcile_at", new Date().toISOString())
        .select("id")
        .maybeSingle();
      if (lease.error) throw new Error("Payment status is unavailable.");
      if (lease.data) await reconcilePayment(attempt);
    }
    const latest = await currentAttempt(token);
    return paymentResponse({
      attempt: latest ? await attemptView(latest) : null,
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
