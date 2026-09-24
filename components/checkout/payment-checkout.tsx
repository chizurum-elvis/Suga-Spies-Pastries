"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { CartEditButton } from "@/components/cart/cart-edit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import {
  PurchaseSummary,
  DeliverySummary,
} from "@/components/checkout/purchase-summary";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import {
  paymentReviewSchema,
  paymentAttemptViewSchema,
  type PaymentReview,
  type PaymentAttemptView,
} from "@/lib/payments/schema";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import { serializeCart } from "@/lib/cart/schema";
import { formatCents } from "@/lib/catalog/presentation";

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
  const { cart, hydrated, openCart, setCheckoutLocked } = useCart();
  const router = useRouter();
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  const requestVersion = useRef(0);
  const publishAttempt = useCallback(
    (next: PaymentAttemptView | null) => {
      setAttempt(next);
      onAttemptChange?.(next);
    },
    [onAttemptChange],
  );
  const load = useCallback(async () => {
    if (!enabled || lock.current) return;
    const version = ++requestVersion.current;
    setError(null);
    try {
      const result = paymentReviewSchema.parse(
        (
          await payload(
            await fetch("/api/checkout/payment", { cache: "no-store" }),
          )
        ).review,
      );
      if (version !== requestVersion.current || lock.current) return;
      setReview(result);
      publishAttempt(result.attempt);
      setAccepted(false);
    } catch (e) {
      if (version !== requestVersion.current || lock.current) return;
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
    if (!attempt || attempt.orderId) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [attempt, load]);
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
  const paymentCanOpen = Boolean(
    attempt && !expired && ["creating", "open"].includes(attempt.status),
  );
  const start = async () => {
    if (lock.current || !review?.reviewToken) return;
    lock.current = true;
    requestVersion.current += 1;
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
    if (lock.current || confirming) return;
    let cancelled = false;
    lock.current = true;
    requestVersion.current += 1;
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
      if (!next || next.status === "expired") {
        cancelled = true;
        publishAttempt(null);
        setAccepted(false);
        setReview(null);
        setCheckoutLocked(false);
        openCart("cart");
      } else if (next.orderId) {
        publishAttempt(next);
        router.replace(`/orders/${next.orderId}`);
      } else {
        publishAttempt(next);
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
      if (cancelled) void load();
    }
  };
  if (!enabled) {
    return (
      <StatePanel
        compact
        tone="neutral"
        title="Confirm delivery before payment"
        description="Confirm your delivery address and fee above to pay by card, Apple Pay, or Google Pay."
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
                href={embedded ? "/checkout#contact" : "/checkout/details"}
              >
                Edit contact & address
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
            {snapshot && !review?.blockers.length ? (
              <section
                aria-labelledby="payment-review-heading"
                className="border-border overflow-hidden border bg-white"
              >
                <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b bg-[#faf6fa] px-4 py-4 sm:px-5">
                  <div>
                    <h2
                      id="payment-review-heading"
                      className="text-ink text-base font-extrabold"
                    >
                      Ready to pay
                    </h2>
                    <p className="text-ink-soft mt-1 text-xs leading-5">
                      Final total, including delivery
                    </p>
                  </div>
                  <p className="text-ink shrink-0 text-lg font-extrabold tabular-nums">
                    {formatCents(snapshot.totalCents)} {snapshot.currency}
                  </p>
                </div>

                <div className="space-y-5 px-4 py-5 sm:px-5">
                  <div className="flex gap-3 text-sm leading-6">
                    <Clock3
                      className="text-brand mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                    />
                    <p>
                      Cancel by{" "}
                      <strong>
                        {formatBusinessDateTime(snapshot.cancellationDeadline)}
                      </strong>{" "}
                      for a full refund to the original payment method.
                    </p>
                  </div>

                  {review?.policies ? (
                    <p className="text-brand flex flex-wrap gap-x-5 gap-y-2 text-sm">
                      <a
                        href={review.policies.termsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        Terms
                      </a>
                      <a
                        href={review.policies.privacyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        Privacy
                      </a>
                      <a
                        href={review.policies.refundUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        Refund policy
                      </a>
                    </p>
                  ) : null}

                  <label className="border-border flex min-h-11 items-start gap-3 border-t pt-4 text-sm leading-6">
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
                    className="w-full"
                    onClick={() => void start()}
                    isLoading={busy}
                    loadingLabel="Reserving your delivery space…"
                    disabled={!hydrated || !accepted || changed}
                  >
                    <LockKeyhole className="size-4" aria-hidden="true" />
                    Continue to payment
                  </Button>

                  <ul className="text-ink-soft grid gap-2 text-xs leading-5 sm:grid-cols-2">
                    <li className="flex gap-2">
                      <ShieldCheck
                        className="text-sage-ink mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      Pay by card, Apple Pay, or Google Pay.
                    </li>
                    <li className="flex gap-2">
                      <Clock3
                        className="text-brand mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      Your delivery space is held for 15 minutes after you
                      continue.
                    </li>
                  </ul>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section
            aria-labelledby="wallet-payment-heading"
            className="border-border overflow-hidden border bg-white"
          >
            <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b bg-[#faf6fa] px-4 py-4 sm:px-5">
              <div>
                <h2
                  id="wallet-payment-heading"
                  className="text-ink text-base font-extrabold"
                >
                  Pay securely
                </h2>
                <p className="text-ink-soft mt-1 text-xs leading-5">
                  {expired
                    ? "The payment window has ended."
                    : `Reserved for ${Math.max(1, Math.ceil((new Date(attempt.expiresAt).getTime() - now) / 60000))} more minutes.`}
                </p>
              </div>
              <p className="text-ink text-lg font-extrabold tabular-nums">
                {formatCents(attempt.snapshot.totalCents)} CAD
              </p>
            </div>

            <div className="space-y-5 px-4 py-5 sm:px-5">
              {paymentCanOpen && attempt.clientSecret && !busy ? (
                <PaymentMethods
                  key={attempt.id}
                  clientSecret={attempt.clientSecret}
                  expiresAt={attempt.expiresAt}
                  totalCents={attempt.snapshot.totalCents}
                  onProcessingChange={setConfirming}
                />
              ) : null}
              {paymentCanOpen && !attempt.clientSecret ? (
                <StatePanel
                  compact
                  tone="loading"
                  title="Preparing secure payment"
                  description="Your delivery space is protected while Stripe prepares your payment options."
                />
              ) : null}
              {attempt.status === "processing" ||
              (attempt.status === "paid" && !attempt.orderId) ? (
                <StatePanel
                  compact
                  tone="loading"
                  title="Confirming your payment"
                  description="Do not pay again. We are waiting for Stripe’s verified result before creating the order."
                />
              ) : null}
              {attempt.status === "needs_review" ? (
                <StatePanel
                  compact
                  tone="error"
                  title="Your payment needs a manual check"
                  description="No order has been confirmed. Please check payment status and contact support before trying to pay again."
                />
              ) : null}
              {attempt.status === "refund_pending" ? (
                <StatePanel
                  compact
                  tone="neutral"
                  title="Your full refund is being processed"
                  description="This payment could not become an order. Do not pay again while the refund is being confirmed."
                />
              ) : null}
              {attempt.status === "refunded" ? (
                <StatePanel
                  compact
                  tone="success"
                  title="Your full refund was issued"
                  description="The money was returned to the original payment method. Your bank controls when it appears."
                />
              ) : null}
              {expired && ["creating", "open"].includes(attempt.status) ? (
                <StatePanel
                  compact
                  tone="neutral"
                  title="The payment window has ended"
                  description="Check the payment result before starting another attempt. Your pastry box remains saved."
                />
              ) : null}

              <div className="grid gap-2 border-t border-[var(--border)] pt-4 sm:justify-items-start">
                <Link
                  href="/checkout/confirmation"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Check payment status
                </Link>
                {["creating", "open"].includes(attempt.status) ? (
                  <Button
                    variant="quiet"
                    onClick={() => void cancel()}
                    isLoading={busy}
                    disabled={confirming}
                    loadingLabel="Checking payment…"
                  >
                    Stop payment and edit order
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        )}
        <p className="text-ink-soft flex gap-2 text-xs leading-5">
          <ShieldCheck
            className="text-sage-ink mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          Your order is confirmed only after Stripe verifies the payment. Suga
          &amp; Spies never receives or stores your card number.
        </p>
      </div>
      {snapshot && !embedded ? <PurchaseSummary snapshot={snapshot} /> : null}
    </div>
  );
}
