"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StripeCheckoutExpressCheckoutElement } from "@stripe/stripe-js";
import { StatePanel } from "@/components/ui/state-panel";

export function WalletPayment({
  clientSecret,
  expiresAt,
}: {
  clientSecret: string;
  expiresAt: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [state, setState] = useState<
    "loading" | "ready" | "unsupported" | "error" | "processing"
  >("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    let element: StripeCheckoutExpressCheckoutElement | undefined;
    const deadline = new Date(expiresAt).getTime();
    const timeout = window.setTimeout(() => {
      if (!disposed) setState("error");
    }, 15_000);
    const initialize = async () => {
      try {
        const { loadStripe } = await import("@stripe/stripe-js/pure");
        const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!key) throw new Error("Payment is not configured.");
        const stripe = await loadStripe(key);
        if (!stripe) throw new Error("Payment could not load.");
        if (disposed || !host.current) return;
        const checkout = stripe.initCheckoutElementsSdk({ clientSecret });
        const loaded = await checkout.loadActions();
        if (loaded.type !== "success")
          throw new Error("Payment could not load.");
        if (disposed || !host.current) return;
        element = checkout.createExpressCheckoutElement({
          buttonHeight: 48,
          buttonTheme: { applePay: "black", googlePay: "black" },
          buttonType: { applePay: "order", googlePay: "order" },
          layout: { maxColumns: 1, maxRows: 2 },
          paymentMethodOrder: ["apple_pay", "google_pay"],
          paymentMethods: {
            applePay: "always",
            googlePay: "always",
            link: "never",
            paypal: "never",
            amazonPay: "never",
            klarna: "never",
          },
        });
        element.on("ready", (event) => {
          window.clearTimeout(timeout);
          if (!disposed)
            setState(
              event.availablePaymentMethods?.applePay ||
                event.availablePaymentMethods?.googlePay
                ? "ready"
                : "unsupported",
            );
        });
        element.on("loaderror", () => {
          if (!disposed) setState("error");
        });
        element.on("cancel", () => {
          if (!disposed) {
            setState("ready");
            setMessage(
              "Payment was not completed. You can try again while your space is reserved.",
            );
          }
        });
        element.on("confirm", async (event) => {
          if (Date.now() >= deadline) {
            event.paymentFailed({ reason: "fail" });
            setMessage(
              "Your payment window ended. Check payment status before trying again.",
            );
            return;
          }
          setState("processing");
          try {
            const result = await loaded.actions.confirm({
              expressCheckoutConfirmEvent: event,
              redirect: "if_required",
            });
            if (disposed) return;
            if (result.type === "error") {
              setState("ready");
              setMessage(result.error.message);
            } else router.replace("/checkout/confirmation");
          } catch {
            if (!disposed) {
              setState("error");
              setMessage(
                "We could not confirm the result. Check payment status before trying again.",
              );
            }
          }
        });
        element.mount(host.current);
      } catch {
        if (!disposed) setState("error");
      }
    };
    void initialize();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      element?.destroy();
    };
  }, [clientSecret, expiresAt, router]);
  return (
    <section aria-label="Pay securely" className="space-y-4">
      {state === "loading" ? (
        <p role="status" className="text-ink-soft text-sm">
          Checking available wallets…
        </p>
      ) : null}
      <div ref={host} className="min-h-12" hidden={state === "unsupported"} />
      {state === "processing" ? (
        <p role="status" className="text-sm">
          Confirming with your wallet… Please do not start another payment.
        </p>
      ) : null}
      {state === "unsupported" ? (
        <StatePanel
          compact
          tone="neutral"
          title="A supported wallet is needed"
          description="We accept Apple Pay and Google Pay. Open this checkout in a compatible browser with your wallet set up. No order has been placed."
        />
      ) : null}
      {state === "error" ? (
        <StatePanel
          compact
          tone="error"
          title="Payment could not load"
          description={
            message ||
            "Your payment result has not been confirmed. Check payment status or reload this page to retry."
          }
        />
      ) : message ? (
        <p role="status" className="text-ink-soft text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
