import { policySchema } from "@/lib/payments/schema";

type Configuration = {
  PAYMENTS_MODE: "disabled" | "test" | "live";
  APP_ENV: "local" | "staging" | "production";
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ORDER_ACCESS_SECRET?: string;
  CHECKOUT_POLICIES_JSON?: string;
  PAYMENT_WORKER_SECRET?: string;
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;
  ORDER_ALERT_EMAIL?: string;
  GOOGLE_MAPS_SERVER_API_KEY?: string;
};
export function paymentConfiguration(environment: Configuration) {
  const blockers: string[] = [];
  const testOnly = environment.PAYMENTS_MODE !== "live";
  if (environment.PAYMENTS_MODE === "disabled")
    blockers.push(
      "Online payment is not available yet. Your pastry box is saved.",
    );
  const prefix = testOnly ? "test" : "live";
  if (
    !new RegExp(`^(sk|rk)_${prefix}_`).test(
      environment.STRIPE_SECRET_KEY ?? "",
    ) ||
    !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith(`pk_${prefix}_`)
  )
    blockers.push(
      "Payment configuration is not ready. Please try again later.",
    );
  if (
    !environment.STRIPE_WEBHOOK_SECRET ||
    !environment.ORDER_ACCESS_SECRET ||
    !environment.PAYMENT_WORKER_SECRET
  )
    blockers.push("Payment confirmation is not connected yet.");
  if (!testOnly && environment.APP_ENV !== "production")
    blockers.push("Live payments are disabled in this environment.");
  let policies = null;
  try {
    policies = policySchema.parse(
      JSON.parse(environment.CHECKOUT_POLICIES_JSON ?? "null"),
    );
  } catch {
    /* Missing approval fails closed below. */
  }
  if (!testOnly && !policies)
    blockers.push("Checkout policies are awaiting approval.");
  if (
    !testOnly &&
    (!environment.RESEND_API_KEY ||
      !environment.ORDER_EMAIL_FROM ||
      !environment.ORDER_ALERT_EMAIL)
  )
    blockers.push("Order confirmation emails are not connected yet.");
  if (!testOnly && !environment.GOOGLE_MAPS_SERVER_API_KEY)
    blockers.push("Delivery verification is not connected yet.");
  return { blockers, testOnly, policies };
}
