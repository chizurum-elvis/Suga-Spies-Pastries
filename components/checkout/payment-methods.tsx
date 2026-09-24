"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  StripeCheckoutExpressCheckoutElement,
  StripeExpressCheckoutElementConfirmEvent,
  StripePaymentElement,
} from "@stripe/stripe-js";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/catalog/presentation";
import { walletElementOptions } from "@/lib/payments/wallet-options";

export function PaymentMethods({
  clientSecret,
  expiresAt,
  totalCents,
  onProcessingChange,
}: {
  clientSecret: string;
  expiresAt: string;
  totalCents: number;
  onProcessingChange: (processing: boolean) => void;
}) {
  const cardHost = useRef<HTMLDivElement>(null);
  const walletHost = useRef<HTMLDivElement>(null);
  const confirmCard = useRef<(() => Promise<void>) | null>(null);
  const router = useRouter();
  const [state, setState] = useState<
    "loading" | "ready" | "error" | "processing" | "uncertain"
  >("loading");
  const [message, setMessage] = useState("");
  const [wallets, setWallets] = useState<string[]>([]);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let disposed = false;
    let confirming = false;
    let card: StripePaymentElement | undefined;
    let wallet: StripeCheckoutExpressCheckoutElement | undefined;
    const deadline = new Date(expiresAt).getTime();
    const timeout = window.setTimeout(() => {
      if (!disposed) {
        setMessage("The card form took too long to load. Please retry.");
        setState("error");
      }
    }, 15_000);

    const initialize = async () => {
      try {
        const { loadStripe } = await import("@stripe/stripe-js/pure");
        const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!key) throw new Error("Payment is not configured.");
        const stripe = await loadStripe(key);
        if (!stripe) throw new Error("Payment could not load.");
        if (disposed || !cardHost.current || !walletHost.current) return;
        const checkout = stripe.initCheckoutElementsSdk({
          clientSecret,
          elementsOptions: {
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#79377f",
                colorText: "#30252e",
                colorDanger: "#942c24",
                colorBackground: "#ffffff",
                fontFamily: "Arial, sans-serif",
                fontSizeBase: "16px",
                borderRadius: "6px",
                spacingUnit: "4px",
              },
            },
          },
        });
        const loaded = await checkout.loadActions();
        if (loaded.type !== "success")
          throw new Error("Payment could not load.");
        if (disposed || !cardHost.current || !walletHost.current) return;

        const confirm = async (
          event?: StripeExpressCheckoutElementConfirmEvent,
        ) => {
          if (disposed || confirming) return;
          if (Date.now() >= deadline) {
            event?.paymentFailed({ reason: "fail" });
            setMessage(
              "Your payment window ended. Check payment status before trying again.",
            );
            return;
          }
          confirming = true;
          onProcessingChange(true);
          setState("processing");
          setMessage("");
          try {
            const result = await loaded.actions.confirm({
              ...(event ? { expressCheckoutConfirmEvent: event } : {}),
              redirect: "if_required",
            });
            if (disposed) return;
            if (result.type === "error") {
              confirming = false;
              onProcessingChange(false);
              setState("ready");
              setMessage(result.error.message);
            } else {
              // A browser result is not proof of payment. The confirmation route
              // retrieves verified server state before displaying an order.
              router.replace("/checkout/confirmation");
            }
          } catch {
            if (!disposed) {
              setState("uncertain");
              setMessage(
                "We could not confirm the result. Use Check payment status below before trying again.",
              );
              // Keep the duplicate-submission guard until server reconciliation.
              onProcessingChange(false);
            }
          }
        };
        confirmCard.current = () => confirm();
        card = checkout.createPaymentElement({
          layout: "tabs",
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        });
        card.on("ready", () => {
          window.clearTimeout(timeout);
          if (!disposed && !confirming) setState("ready");
        });
        card.on("loaderror", () => {
          window.clearTimeout(timeout);
          if (!disposed && !confirming) {
            setMessage(
              "The secure card form could not load. Check your connection and retry.",
            );
            setState("error");
          }
        });
        card.mount(cardHost.current);

        // Wallet eligibility must never prevent ordinary card entry.
        try {
          wallet = checkout.createExpressCheckoutElement(walletElementOptions);
          wallet.on("ready", (event) => {
            if (!disposed)
              setWallets(
                [
                  event.availablePaymentMethods?.applePay ? "Apple Pay" : null,
                  event.availablePaymentMethods?.googlePay
                    ? "Google Pay"
                    : null,
                ].filter((value): value is string => Boolean(value)),
              );
          });
          wallet.on("loaderror", () => {
            if (!disposed) setWallets([]);
          });
          wallet.on("cancel", () => {
            if (!disposed && !confirming) {
              setMessage(
                "Wallet payment was cancelled. You can try again or pay by card.",
              );
            }
          });
          wallet.on("confirm", (event) => {
            void confirm(event);
          });
          wallet.mount(walletHost.current);
        } catch {
          if (!disposed) setWallets([]);
        }
      } catch {
        window.clearTimeout(timeout);
        if (!disposed) {
          setMessage(
            "Secure payment could not load. Check your connection and retry.",
          );
          setState("error");
        }
      }
    };
    void initialize();
    return () => {
      disposed = true;
      confirmCard.current = null;
      window.clearTimeout(timeout);
      card?.destroy();
      wallet?.destroy();
    };
  }, [clientSecret, expiresAt, retryKey, router, onProcessingChange]);

  const processing = state === "processing";
  return (
    <section aria-label="Payment methods" className="min-w-0 space-y-5">
      <div hidden={!wallets.length || state === "uncertain"}>
        <h3 className="text-ink mb-3 text-sm font-bold">Express payment</h3>
        <p className="sr-only" role="status">
          {wallets.length ? `${wallets.join(" and ")} available.` : ""}
        </p>
        <div ref={walletHost} inert={processing} />
        <div className="text-ink-soft mt-5 flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" />
          or pay by card
          <span className="bg-border h-px flex-1" />
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (state === "ready") void confirmCard.current?.();
        }}
        className="min-w-0 space-y-4"
        aria-busy={processing}
      >
        <h3 className="text-ink text-sm font-bold">Credit or debit card</h3>
        {state === "loading" ? (
          <p role="status" className="text-ink-soft text-sm">
            Loading secure card form…
          </p>
        ) : null}
        <div
          ref={cardHost}
          inert={processing || state === "uncertain"}
          hidden={state === "error"}
          className="min-w-0"
        />
        {message ? (
          <p role="alert" className="text-critical-ink text-sm leading-6">
            {message}
          </p>
        ) : null}
        {state === "error" ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setState("loading");
              setMessage("");
              setWallets([]);
              setRetryKey((value) => value + 1);
            }}
          >
            Reload secure payment
          </Button>
        ) : (
          <Button
            type="submit"
            className="w-full"
            isLoading={processing}
            loadingLabel="Confirming payment…"
            disabled={state !== "ready"}
          >
            <LockKeyhole className="size-4" aria-hidden="true" />
            Pay {formatCents(totalCents)} CAD
          </Button>
        )}
        <p className="text-ink-soft text-xs leading-5">
          {processing
            ? "Keep this page open. Your bank may ask you to verify the payment."
            : "Encrypted and processed securely by Stripe."}
        </p>
      </form>
    </section>
  );
}
