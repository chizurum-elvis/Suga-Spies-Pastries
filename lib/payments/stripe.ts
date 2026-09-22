import "server-only";
import Stripe from "stripe";
import { getServerEnvironment } from "@/lib/env/server";
import type { PaymentAttemptRow } from "@/lib/payments/database";
import { purchaseSnapshotSchema } from "@/lib/payments/schema";

export function stripeClient() {
  const environment = getServerEnvironment();
  const key = environment.STRIPE_SECRET_KEY;
  if (
    !key ||
    !/^(sk|rk)_(test|live)_/.test(key) ||
    (environment.PAYMENTS_MODE !== "disabled" &&
      !new RegExp(`^(sk|rk)_${environment.PAYMENTS_MODE}_`).test(key))
  )
    throw new Error("Stripe is not configured for this payment environment.");
  // Durable worker/webhook retries supply idempotency; keep individual requests bounded.
  return new Stripe(key, { maxNetworkRetries: 0, timeout: 8_000 });
}

export function sessionParameters(
  attempt: PaymentAttemptRow,
): Stripe.Checkout.SessionCreateParams {
  const snapshot = purchaseSnapshotSchema.parse(attempt.snapshot);
  const site =
    getServerEnvironment().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] =
    snapshot.validatedCart.lines.map((line) => ({
      quantity: 1,
      price_data: {
        currency: "cad",
        unit_amount: line.lineSubtotalCents!,
        product_data: {
          name: `${line.quantity} × ${line.product!.name}`,
          description:
            [
              line.variant?.name,
              ...line.options.map(
                (option) =>
                  `${option.name}${option.quantity > 1 ? ` × ${option.quantity}` : ""}`,
              ),
            ]
              .filter(Boolean)
              .join(", ")
              .slice(0, 500) || undefined,
        },
      },
    }));
  if (snapshot.deliveryCents > 0)
    items.push({
      quantity: 1,
      price_data: {
        currency: "cad",
        unit_amount: snapshot.deliveryCents,
        product_data: { name: "Delivery" },
      },
    });
  return {
    ui_mode: "elements",
    mode: "payment",
    payment_method_types: ["card"],
    line_items: items,
    customer_email: snapshot.delivery.email,
    client_reference_id: attempt.id,
    metadata: { payment_attempt_id: attempt.id },
    payment_intent_data: { metadata: { payment_attempt_id: attempt.id } },
    return_url: `${site}/checkout/confirmation`,
    // Stripe's default is a fallback only. The worker explicitly expires at 15 minutes.
    // Omitting expires_at keeps creation parameters identical across delayed retries.
  };
}
