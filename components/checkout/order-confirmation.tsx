"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { buttonVariants } from "@/components/ui/button";
import {
  paymentAttemptViewSchema,
  orderViewSchema,
  type OrderView,
} from "@/lib/payments/schema";
import { useCart } from "@/components/cart/cart-provider";
import {
  PurchaseSummary,
  DeliverySummary,
} from "@/components/checkout/purchase-summary";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import { businessConfig } from "@/lib/config/business";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { OrderTimeline } from "@/components/orders/order-timeline";
import {
  fulfillmentStage,
  nextFulfillmentStatus,
  orderStatusLabel,
} from "@/lib/orders/status";

export function PaymentConfirmation() {
  const router = useRouter();
  const [message, setMessage] = useState(
    "We’re checking your payment. Please don’t pay again.",
  );
  const [failed, setFailed] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const inFlight = useRef(false);
  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/checkout/payment/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body?.error?.message ??
            "Payment status is temporarily unavailable. Please retry.",
        );
      if (!body.attempt) {
        setMessage(
          "No payment has been started. Return to checkout to review your order.",
        );
        setTerminal(true);
        return;
      }
      const attempt = paymentAttemptViewSchema.parse(body.attempt);
      if (attempt.orderId) {
        router.replace(`/orders/${attempt.orderId}`);
        return;
      }
      setFailed(false);
      if (attempt.status === "expired") {
        setMessage(
          "This payment attempt expired without a confirmed order. Your pastry box is saved.",
        );
        setTerminal(true);
      } else if (attempt.status === "refunded") {
        setMessage(
          "This payment could not become an order. A full refund has been issued to the original payment method; bank processing time may vary.",
        );
        setTerminal(true);
      } else if (attempt.status === "refund_pending") {
        setMessage(
          "This payment could not become an order. A full refund is being processed. Please do not pay again.",
        );
      } else if (attempt.status === "needs_review") {
        setMessage(
          "Your payment needs a check from us. No order has been confirmed yet. Please contact support before trying again.",
        );
      } else
        setMessage(
          "We’re confirming the payment result. Your space remains protected while we check. Please don’t pay again.",
        );
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : "Payment status is unavailable.",
      );
    } finally {
      inFlight.current = false;
    }
  }, [router]);
  useEffect(() => {
    const initial = window.setTimeout(() => void check(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden && !terminal) void check();
    }, 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [check, terminal]);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <StatePanel
        tone={failed ? "error" : terminal ? "neutral" : "loading"}
        title={terminal ? "Payment update" : "Confirming your order"}
        description={message}
        onRetry={() => void check()}
        retryLabel="Check again"
      />
      <Link
        href="/checkout#payment"
        className={buttonVariants({ variant: "secondary" })}
      >
        Return to checkout
      </Link>
      <p className="text-ink-soft text-sm">
        Need help?{" "}
        <a
          className="text-brand font-bold underline"
          href={businessConfig.supportPhoneHref}
        >
          {businessConfig.supportPhoneDisplay}
        </a>
      </p>
    </div>
  );
}

export function GuestOrder({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const access = useRef<string | null>(null);
  const orderRef = useRef<OrderView | null>(null);
  const inFlight = useRef(false);
  const { hydrated, clearPurchasedCart } = useCart();
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(Boolean(orderRef.current));
    try {
      setError(null);
      setRefreshError(null);
      if (access.current === null) {
        access.current =
          new URLSearchParams(window.location.hash.slice(1)).get("access") ??
          "";
        if (window.location.hash)
          window.history.replaceState(
            window.history.state,
            "",
            window.location.pathname,
          );
      }
      const response = await fetch(
        `/api/orders/${id}`,
        access.current
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access: access.current }),
              cache: "no-store",
            }
          : { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body?.error?.message ?? "Your order could not be loaded.",
        );
      const nextOrder = orderViewSchema.parse(body.order);
      if (
        orderRef.current &&
        orderRef.current.fulfillmentStatus !== nextOrder.fulfillmentStatus
      ) {
        setAnnouncement(
          `Order updated: ${fulfillmentStage(nextOrder.fulfillmentStatus).label}.`,
        );
      }
      orderRef.current = nextOrder;
      setOrder(nextOrder);
      access.current = "";
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Your order could not be loaded.";
      if (orderRef.current) setRefreshError(message);
      else setError(message);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [id]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 45_000);
    const onVisibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);
  useEffect(() => {
    if (order && hydrated)
      void clearPurchasedCart(order.snapshot.cart, order.id);
  }, [order, hydrated, clearPurchasedCart]);
  if (error)
    return (
      <StatePanel
        tone="error"
        title="We couldn’t open this order"
        description={error}
        onRetry={() => void load()}
      />
    );
  if (!order)
    return (
      <StatePanel
        tone="loading"
        title="Opening your order"
        description="Checking your secure order access."
      />
    );
  const currentStage = fulfillmentStage(order.fulfillmentStatus);
  const nextStatus = nextFulfillmentStatus(order.fulfillmentStatus);
  const nextStage = nextStatus ? fulfillmentStage(nextStatus) : null;
  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <header className="border-border mb-8 border-b pb-6">
        <p className="text-brand text-sm font-bold">
          {order.snapshot.testOnly
            ? "Development test order"
            : "Payment received"}{" "}
          · {order.orderNumber}
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">
          {order.snapshot.testOnly ? "Test order" : currentStage.label}
        </h1>
        <p className="text-ink-soft mt-3 text-sm">
          {order.snapshot.testOnly
            ? "This is a test record, not a real pastry order."
            : currentStage.summary}
        </p>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="status-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2
                  id="status-heading"
                  className="font-display text-brand-strong text-2xl"
                >
                  Track your order
                </h2>
                <p className="text-ink-soft mt-2 text-sm">
                  Times below use Toronto business time.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void load()}
                isLoading={refreshing}
                loadingLabel="Refreshing…"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Refresh status
              </Button>
            </div>
            {refreshError ? (
              <div
                className="border-warning-ink/20 bg-warning text-warning-ink mt-4 rounded-md border p-3 text-sm"
                role="alert"
              >
                {refreshError} Your last loaded order remains below.
              </div>
            ) : null}
            <div className="border-border bg-surface mt-5 rounded-lg border p-5 sm:p-6">
              <OrderTimeline
                currentStatus={order.fulfillmentStatus}
                events={order.events}
              />
            </div>
          </section>
          <section aria-labelledby="order-state-heading">
            <h2 id="order-state-heading" className="sr-only">
              Order states
            </h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="border-border bg-surface rounded-md border p-4">
                <dt className="text-ink-faint text-xs font-bold uppercase">
                  Payment
                </dt>
                <dd className="mt-2">
                  <StatusIndicator label="Paid" tone="success" />
                </dd>
              </div>
              <div className="border-border bg-surface rounded-md border p-4">
                <dt className="text-ink-faint text-xs font-bold uppercase">
                  Order
                </dt>
                <dd className="mt-2">
                  <StatusIndicator
                    label={orderStatusLabel(order.status)}
                    tone={order.status === "completed" ? "success" : "active"}
                  />
                </dd>
              </div>
              <div className="border-border bg-surface rounded-md border p-4">
                <dt className="text-ink-faint text-xs font-bold uppercase">
                  Fulfilment
                </dt>
                <dd className="mt-2">
                  <StatusIndicator
                    label={currentStage.label}
                    tone={
                      order.fulfillmentStatus === "delivered"
                        ? "success"
                        : "active"
                    }
                  />
                </dd>
              </div>
            </dl>
          </section>
          <DeliverySummary snapshot={order.snapshot} />
          <section>
            <h2 className="font-display text-brand-strong text-2xl">
              What happens next?
            </h2>
            <p className="text-ink-soft mt-3 text-sm leading-6">
              {nextStage
                ? `Next: ${nextStage.label}. ${nextStage.summary}`
                : "This delivery is complete. Please contact us if you need help with the order."}
            </p>
            <p className="mt-3 text-sm leading-6">
              Cancellation deadline:{" "}
              {formatBusinessDateTime(order.snapshot.cancellationDeadline)}.
            </p>
            <p className="mt-3 text-sm">
              Questions?{" "}
              <a
                className="text-brand font-bold underline"
                href={businessConfig.supportPhoneHref}
              >
                {businessConfig.supportPhoneDisplay}
              </a>
            </p>
          </section>
          <Link
            href="/menu"
            className={buttonVariants({ variant: "secondary" })}
          >
            Back to the pastries
          </Link>
        </div>
        <PurchaseSummary snapshot={order.snapshot} />
      </div>
    </>
  );
}
