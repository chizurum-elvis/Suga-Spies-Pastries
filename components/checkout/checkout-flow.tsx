"use client";

import Image from "next/image";
import { CartEditButton } from "@/components/cart/cart-edit-button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, LockKeyhole, PencilLine } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { DeliveryDetails } from "@/components/checkout/delivery-details";
import { PaymentCheckout } from "@/components/checkout/payment-checkout";
import { formatCents } from "@/lib/catalog/presentation";
import { serializeCart } from "@/lib/cart/schema";
import type { DeliveryState } from "@/lib/delivery/schema";
import type { CheckoutDraftSummary } from "@/lib/fulfillment/types";
import type { PaymentAttemptView } from "@/lib/payments/schema";
import { cn } from "@/lib/utils/cn";

function StepHeading({
  complete,
  description,
  number,
  title,
}: {
  complete: boolean;
  description: string;
  number: string;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
          complete
            ? "border-brand bg-brand text-white"
            : "border-brand/35 bg-brand-soft/45 text-brand-strong",
        )}
        aria-hidden="true"
      >
        {complete ? <Check className="size-4" /> : number}
      </span>
      <div className="min-w-0">
        <h2 className="text-ink text-xl leading-7 font-bold">{title}</h2>
        <p className="text-ink-soft mt-1 max-w-2xl text-sm leading-5">
          {description}
        </p>
      </div>
    </div>
  );
}

function OrderSummary({
  delivery,
  deliveryReady,
  schedule,
  locked,
  attempt,
}: {
  delivery: DeliveryState | null;
  deliveryReady: boolean;
  schedule: CheckoutDraftSummary;
  locked: boolean;
  attempt: PaymentAttemptView | null;
}) {
  const { validation } = useCart();
  const snapshot = locked ? attempt?.snapshot : null;
  const cart = snapshot?.validatedCart ?? validation.data;
  const quote = deliveryReady ? delivery?.quote : null;
  const subtotal =
    snapshot?.subtotalCents ??
    quote?.subtotalCents ??
    cart?.subtotalCents ??
    null;
  const total =
    snapshot?.totalCents ??
    (quote ? quote.subtotalCents + quote.feeCents : subtotal);

  return (
    <section
      aria-label="Order summary"
      data-checkout-order-summary
      className="border-border min-w-0 border bg-[#faf6fa]"
    >
      <div className="border-border flex items-center justify-between gap-4 border-b px-4 py-4 sm:px-5">
        <h2 className="text-ink text-base font-extrabold">Order summary</h2>
        <CartEditButton
          disabled={locked}
          className="text-brand-strong inline-flex min-h-11 items-center gap-1.5 text-sm font-bold underline underline-offset-4"
        >
          <PencilLine className="size-3.5" aria-hidden="true" />
          Edit cart
        </CartEditButton>
      </div>

      <ul className="divide-border divide-y px-4 sm:px-5">
        {cart?.lines.map((line) => (
          <li key={line.lineId} className="flex gap-3 py-4">
            {line.product?.image ? (
              <span className="border-border relative size-14 shrink-0 overflow-hidden border bg-white">
                <Image
                  src={line.product.image.src}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                  style={{ objectPosition: line.product.image.objectPosition }}
                />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-ink text-sm leading-5 font-bold">
                {line.product?.name ?? "Pastry requiring review"}
              </p>
              {line.variant ? (
                <p className="text-ink-soft mt-0.5 text-xs">
                  {line.variant.name}
                </p>
              ) : null}
              {line.options.length ? (
                <p className="text-ink-soft mt-1 line-clamp-2 text-xs leading-5">
                  {line.options
                    .map(
                      (option) =>
                        `${option.name}${option.quantity > 1 ? ` × ${option.quantity}` : ""}`,
                    )
                    .join(", ")}
                </p>
              ) : null}
              <p className="text-ink-soft mt-1 text-xs tabular-nums">
                {line.unitPriceCents === null
                  ? `${line.quantity} items · price needs review`
                  : `${line.quantity} × ${formatCents(line.unitPriceCents)}`}
              </p>
            </div>
            <p className="text-ink shrink-0 text-sm font-bold tabular-nums">
              {line.lineSubtotalCents === null
                ? "—"
                : formatCents(line.lineSubtotalCents)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-border border-t px-4 py-4 text-sm sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-ink font-bold">{schedule.dateLabel}</p>
            <p className="text-ink-soft mt-1">Delivery date</p>
          </div>
          <CartEditButton
            step="date"
            disabled={locked}
            className="text-brand-strong inline-flex min-h-11 items-center text-xs font-bold underline underline-offset-4"
          >
            Change date
          </CartEditButton>
        </div>
        {deliveryReady && quote ? (
          <address className="text-ink-soft mt-3 leading-6 not-italic">
            {quote.address.line1}
            {quote.address.line2 ? `, ${quote.address.line2}` : ""}
            <br />
            {quote.address.city}, ON {quote.address.postalCode}
          </address>
        ) : null}
      </div>

      <dl className="border-border space-y-3 border-t px-4 py-5 text-sm sm:px-5">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">Pastries</dt>
          <dd className="text-ink font-bold tabular-nums">
            {subtotal === null ? "Needs review" : formatCents(subtotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">Delivery</dt>
          <dd className="text-right font-bold tabular-nums">
            {snapshot
              ? snapshot.deliveryCents === 0
                ? "Free"
                : formatCents(snapshot.deliveryCents)
              : quote
                ? quote.freeDelivery
                  ? "Free"
                  : formatCents(quote.feeCents)
                : "Calculated after address"}
          </dd>
        </div>
        <div className="border-brand/20 flex items-end justify-between gap-4 border-t pt-4">
          <dt className="text-ink text-base font-extrabold">
            Total <span className="text-xs font-medium">CAD</span>
          </dt>
          <dd className="text-ink text-xl font-extrabold tabular-nums">
            {total === null ? "—" : formatCents(total)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function CheckoutFlow({
  initialDraft,
}: {
  initialDraft: CheckoutDraftSummary;
}) {
  const { cart, hydrated, priceChanges, validation, setCheckoutLocked } =
    useCart();
  const [delivery, setDelivery] = useState<DeliveryState | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptView | null>(null);

  const cartReady =
    hydrated &&
    validation.status === "ready" &&
    validation.data.status === "ready" &&
    priceChanges.length === 0;
  const deliveryReady = Boolean(
    delivery?.status === "confirmed" &&
    delivery.quote &&
    cartReady &&
    serializeCart(delivery.cart) === serializeCart(cart),
  );
  const paymentLocked = Boolean(
    attempt &&
    !["expired", "refunded"].includes(attempt.status) &&
    !attempt.orderId,
  );
  useEffect(() => {
    setCheckoutLocked(paymentLocked);
    return () => setCheckoutLocked(false);
  }, [paymentLocked, setCheckoutLocked]);

  const handleDeliveryState = useCallback((next: DeliveryState | null) => {
    setDelivery(next);
  }, []);
  const handleAttemptChange = useCallback(
    (next: PaymentAttemptView | null) => setAttempt(next),
    [],
  );
  const summary = useMemo(
    () => (
      <OrderSummary
        delivery={delivery}
        deliveryReady={deliveryReady}
        schedule={initialDraft}
        locked={paymentLocked}
        attempt={attempt}
      />
    ),
    [delivery, deliveryReady, initialDraft, paymentLocked, attempt],
  );

  return (
    <div className="mx-auto w-full max-w-[72rem] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <header className="border-border mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <h1 className="text-ink text-2xl leading-8 font-normal">
          Complete your order
        </h1>
        <p className="text-ink-soft flex items-center gap-1.5 text-xs">
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          Secure checkout
        </p>
      </header>

      <details className="border-border bg-surface mb-7 border lg:hidden">
        <summary className="focus-visible:ring-focus flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <span className="text-ink font-extrabold">Order summary</span>
          <span className="flex items-center gap-2">
            <span className="text-brand-strong text-sm font-bold">
              {paymentLocked && attempt
                ? formatCents(attempt.snapshot.totalCents)
                : deliveryReady && delivery?.quote
                  ? formatCents(
                      delivery.quote.subtotalCents + delivery.quote.feeCents,
                    )
                  : validation.data?.subtotalCents !== null &&
                      validation.data?.subtotalCents !== undefined
                    ? formatCents(validation.data.subtotalCents)
                    : "Review"}
            </span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </span>
        </summary>
        <div className="border-border border-t">{summary}</div>
      </details>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10">
        <div className="min-w-0">
          <section id="delivery" className="scroll-mt-8 pb-6">
            <StepHeading
              number="1"
              title="Contact & delivery information"
              description="Where should we deliver your pastries?"
              complete={deliveryReady}
            />
            <DeliveryDetails
              embedded
              locked={paymentLocked}
              onStateChange={handleDeliveryState}
            />
          </section>

          <section
            id="payment"
            className="border-border scroll-mt-8 border-t pt-6"
          >
            <StepHeading
              number="2"
              title="Review & pay"
              description="Pay with Apple Pay or Google Pay on a supported device."
              complete={Boolean(attempt?.orderId)}
            />
            <PaymentCheckout
              embedded
              enabled={deliveryReady || paymentLocked}
              onAttemptChange={handleAttemptChange}
              refreshKey={delivery?.version ?? 0}
            />
          </section>
        </div>

        <aside className="hidden min-w-0 lg:block">{summary}</aside>
      </div>
    </div>
  );
}
