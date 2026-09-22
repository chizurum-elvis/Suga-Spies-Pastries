"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";
import { CartEditButton } from "@/components/cart/cart-edit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import {
  PurchaseSummary,
  DeliverySummary,
} from "@/components/checkout/purchase-summary";
import { WalletPayment } from "@/components/checkout/wallet-payment";
import {
  paymentReviewSchema,
  paymentAttemptViewSchema,
  type PaymentReview,
  type PaymentAttemptView,
} from "@/lib/payments/schema";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import { serializeCart } from "@/lib/cart/schema";

async function payload(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : "Checkout could not be loaded.",
    );
  return body;
}
export function PaymentCheckout({
  embedded = false,
  enabled = true,
  onAttemptChange,
  refreshKey = 0,
}: {
  embedded?: boolean;
  enabled?: boolean;
  onAttemptChange?: (attempt: PaymentAttemptView | null) => void;
  refreshKey?: number;
}) {
  const { cart, hydrated } = useCart();
  const router = useRouter();
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  const publishAttempt = useCallback(
    (next: PaymentAttemptView | null) => {
      setAttempt(next);
      onAttemptChange?.(next);
    },
    [onAttemptChange],
  );
  const load = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const result = paymentReviewSchema.parse(
        (
          await payload(
            await fetch("/api/checkout/payment", { cache: "no-store" }),
          )
        ).review,
      );
      setReview(result);
      publishAttempt(result.attempt);
      setAccepted(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout is unavailable.");
    }
  }, [enabled, publishAttempt]);
  useEffect(() => {
    if (!enabled) {
      const timer = window.setTimeout(() => {
        setReview(null);
        setError(null);
        publishAttempt(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, load, publishAttempt, refreshKey]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (attempt?.orderId) router.replace(`/orders/${attempt.orderId}`);
  }, [attempt?.orderId, router]);
  const snapshot = attempt?.snapshot ?? review?.snapshot;
  const changed = Boolean(
    !attempt &&
    snapshot &&
    hydrated &&
    serializeCart(cart) !== serializeCart(snapshot.cart),
  );
  const expired = Boolean(
    attempt && new Date(attempt.expiresAt).getTime() <= now,
  );
  const start = async () => {
    if (lock.current || !review?.reviewToken) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await payload(
        await fetch("/api/checkout/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart,
            reviewToken: review.reviewToken,
            acceptedPolicies: accepted,
          }),
        }),
      );
      publishAttempt(paymentAttemptViewSchema.parse(result.attempt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not start.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await payload(
        await fetch("/api/checkout/payment", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      );
      const next = result.attempt
        ? paymentAttemptViewSchema.parse(result.attempt)
        : null;
      publishAttempt(next);
      if (!next || next.status === "expired") router.push("/checkout#delivery");
      else if (next.orderId) router.replace(`/orders/${next.orderId}`);
      else {
        setError(
          "Payment is still being resolved. Check payment status before changing this order.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Payment could not be stopped.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!enabled) {
    return (
      <StatePanel
        compact
        tone="neutral"
        title="Confirm delivery before payment"
        description="Choose a delivery date, verify the address, and confirm the delivery fee above. Your wallet options will then appear here."
      />
    );
  }
  return (
    <div
      className={
        embedded
          ? "min-w-0"
          : "grid items-start gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12"
      }
    >
      <div className="min-w-0 space-y-6">
        {error ? (
          <StatePanel
            compact
            tone="error"
            title="Let’s check that"
            description={error}
            onRetry={() => void load()}
          />
        ) : null}
        {!review && !error ? (
          <StatePanel
            tone="loading"
            title="Checking your order"
            description="Confirming your pastries, delivery, and total."
          />
        ) : null}
        {snapshot?.testOnly ? (
          <p
            role="status"
            className="border-border bg-butter-soft border p-4 text-sm"
          >
            Development checkout. No real order will be placed.
          </p>
        ) : null}
        {snapshot && !embedded ? <DeliverySummary snapshot={snapshot} /> : null}
        {changed ? (
          <StatePanel
            compact
            tone="error"
            title="Your pastry box changed"
            description="Review your cart and delivery details before paying."
            action={
              <CartEditButton
                className={buttonVariants({ variant: "secondary" })}
              >
                Review cart
              </CartEditButton>
            }
          />
        ) : null}
        {!attempt ? (
          <>
            <nav
              aria-label="Edit checkout"
              className="text-brand flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold"
            >
              <CartEditButton className="min-h-11 underline underline-offset-4">
                Edit pastries
              </CartEditButton>
              <CartEditButton
                className="min-h-11 underline underline-offset-4"
                step="date"
              >
                Edit delivery date
              </CartEditButton>
              <Link
                className="underline underline-offset-4"
                href={embedded ? "/checkout#delivery" : "/checkout/details"}
              >
                Edit delivery details
              </Link>
            </nav>
            {review?.blockers.length ? (
              <StatePanel
                compact
                tone="neutral"
                title="Online payment is not ready yet"
                description={review.blockers.join(" ")}
              />
            ) : null}
            {snapshot ? (
              <section className="space-y-5">
                <h2 className="font-display text-brand-strong text-2xl">
                  One last check
                </h2>
                <p className="text-ink-soft text-sm leading-6">
                  Cancellation deadline:{" "}
                  <strong className="text-ink">
                    {formatBusinessDateTime(snapshot.cancellationDeadline)}
                  </strong>
                  .
                </p>
                {review?.policies ? (
                  <p className="text-brand flex flex-wrap gap-4 text-sm">
                    <a
                      href={review.policies.termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Terms
                    </a>
                    <a
                      href={review.policies.privacyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Privacy
                    </a>
                    <a
                      href={review.policies.refundUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Refund policy
                    </a>
                  </p>
                ) : null}
                <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                    className="accent-brand mt-1 size-5 shrink-0"
                  />
                  <span>
                    {snapshot.testOnly
                      ? "I understand this is a development payment and no real order will be placed."
                      : "I have reviewed my order and agree to the checkout terms and refund policy."}
                  </span>
                </label>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => void start()}
                  isLoading={busy}
                  loadingLabel="Reserving your space…"
                  disabled={
                    !hydrated ||
                    !accepted ||
                    changed ||
                    Boolean(review?.blockers.length)
                  }
                >
                  Continue to secure payment
                </Button>
                <p className="text-ink-soft text-xs leading-5">
                  Your delivery space is reserved for 15 minutes when payment
                  starts. We accept Apple Pay and Google Pay.
                </p>
              </section>
            ) : null}
          </>
        ) : (
          <section className="space-y-5">
            <h2 className="font-display text-brand-strong text-2xl">
              Pay securely
            </h2>
            <p className="text-ink-soft text-sm">
              {expired
                ? "The payment window has ended. Check the result before starting again."
                : `Your space is reserved for ${Math.max(1, Math.ceil((new Date(attempt.expiresAt).getTime() - now) / 60000))} more minutes.`}
            </p>
            {!expired && attempt.clientSecret ? (
              <WalletPayment
                clientSecret={attempt.clientSecret}
                expiresAt={attempt.expiresAt}
              />
            ) : null}
            <Link
              href="/checkout/confirmation"
              className="text-brand inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
            >
              Check payment status
            </Link>
            <Button
              variant="secondary"
              onClick={() => void cancel()}
              isLoading={busy}
            >
              Stop payment and edit order
            </Button>
          </section>
        )}
        <p className="text-ink-soft text-xs leading-5">
          Your order is confirmed only after payment is verified.
        </p>
      </div>
      {snapshot && !embedded ? <PurchaseSummary snapshot={snapshot} /> : null}
    </div>
  );
}
