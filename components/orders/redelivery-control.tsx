"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefundStatus } from "@/components/orders/refund-status";
import { formatBusinessDateTime, formatCurrency } from "@/lib/i18n/format";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import { usePublicContact } from "@/components/content/contact-provider";
import type { OrderView } from "@/lib/payments/schema";
import { orderViewSchema } from "@/lib/payments/schema";

function Address({
  address,
}: {
  address: NonNullable<
    NonNullable<OrderView["redelivery"]>["requestedAddress"]
  >;
}) {
  return (
    <address className="text-ink-soft text-sm leading-6 not-italic">
      {address.line1}
      {address.line2 ? `, ${address.line2}` : ""}
      <br />
      {address.city}, ON {address.postalCode}
    </address>
  );
}

export function RedeliveryControl({
  order,
  onUpdate,
}: {
  order: OrderView;
  onUpdate: (order: OrderView) => void;
}) {
  const contact = usePublicContact();
  const redelivery = order.redelivery;
  const router = useRouter();
  const original = order.snapshot.delivery.address;
  const [address, setAddress] = useState({ ...original });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  if (!redelivery) return null;

  async function submit(action: "request" | "pay") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/redelivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expectedVersion: order.version,
          ...(action === "request" ? { address } : {}),
        }),
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body?.error?.message ?? "Please retry this step.");
      if (action === "pay") {
        if (
          typeof body.url !== "string" ||
          !body.url.startsWith("https://checkout.stripe.com/")
        )
          throw new Error(
            "The secure payment link is unavailable. Please retry.",
          );
        window.location.assign(body.url);
      } else {
        onUpdate(orderViewSchema.parse(body.order));
        router.refresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Please retry this step.",
      );
    } finally {
      setPending(false);
    }
  }

  const responseOpen =
    redelivery.state === "awaiting_customer" &&
    (!now || now < Date.parse(redelivery.respondBy));
  return (
    <section
      aria-labelledby="redelivery-heading"
      className="border-border bg-surface border p-5 sm:p-7"
    >
      <div className="flex items-start gap-3">
        <MapPin
          className="text-brand mt-1 size-5 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2
            id="redelivery-heading"
            className="font-display text-brand-strong text-2xl"
          >
            Delivery update
          </h2>
          {redelivery.state === "awaiting_customer" ? (
            <p className="text-ink-soft mt-2 text-sm leading-6">
              We could not complete delivery. Confirm or correct your address by{" "}
              {formatBusinessDateTime(redelivery.respondBy)}.
              {responseOpen
                ? " The owner will choose the new date after you respond."
                : " The response window has ended; your refund will be processed."}
            </p>
          ) : null}
        </div>
      </div>

      {responseOpen ? (
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("request");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Street address
              <input
                required
                maxLength={160}
                autoComplete="shipping address-line1"
                value={address.line1}
                onChange={(event) =>
                  setAddress({ ...address, line1: event.target.value })
                }
                className="border-border focus-visible:ring-brand mt-2 min-h-11 w-full rounded-md border bg-white px-3 focus-visible:ring-2"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Apartment or unit (optional)
              <input
                maxLength={80}
                autoComplete="shipping address-line2"
                value={address.line2}
                onChange={(event) =>
                  setAddress({ ...address, line2: event.target.value })
                }
                className="border-border focus-visible:ring-brand mt-2 min-h-11 w-full rounded-md border bg-white px-3 focus-visible:ring-2"
              />
            </label>
            <label className="text-sm font-semibold">
              City
              <select
                required
                autoComplete="shipping address-level2"
                value={address.city}
                onChange={(event) =>
                  setAddress({ ...address, city: event.target.value })
                }
                className="border-border focus-visible:ring-brand mt-2 min-h-11 w-full rounded-md border bg-white px-3 focus-visible:ring-2"
              >
                {["Toronto", "Markham", "Mississauga"].map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Postal code
              <input
                required
                maxLength={7}
                autoComplete="shipping postal-code"
                value={address.postalCode}
                onChange={(event) =>
                  setAddress({ ...address, postalCode: event.target.value })
                }
                className="border-border focus-visible:ring-brand mt-2 min-h-11 w-full rounded-md border bg-white px-3 focus-visible:ring-2"
              />
            </label>
          </div>
          <p className="text-ink-soft text-xs leading-5">
            Ontario, Canada · deliveries must remain within our service area.
          </p>
          <Button
            type="submit"
            isLoading={pending}
            loadingLabel="Checking address…"
          >
            Confirm this address{" "}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </form>
      ) : null}

      {redelivery.requestedAddress ? (
        <div className="border-border mt-5 border-t pt-5">
          <p className="text-ink mb-2 text-sm font-semibold">
            Confirmed redelivery address
          </p>
          <Address address={redelivery.requestedAddress} />
        </div>
      ) : null}
      {redelivery.selectedDate ? (
        <p className="text-ink mt-5 text-sm">
          <span className="font-semibold">Owner-selected date:</span>{" "}
          {formatLocalDateLabel(redelivery.selectedDate)}
        </p>
      ) : null}
      {redelivery.state === "awaiting_owner" ? (
        <p className="text-ink-soft mt-4 text-sm leading-6">
          Your address is saved. We’ll email you when the owner selects an
          available date.
        </p>
      ) : null}
      {redelivery.state === "awaiting_payment" ? (
        <div className="mt-5 space-y-3">
          <p className="text-ink text-sm font-semibold">
            Additional delivery fee:{" "}
            {formatCurrency((redelivery.feeCents ?? 0) / 100)} CAD
          </p>
          <p className="text-ink-soft text-sm leading-6">
            This date is confirmed only after Stripe verifies payment. Your
            space is held for 15 minutes once you start paying.
          </p>
          <Button
            type="button"
            onClick={() => void submit("pay")}
            isLoading={pending}
            loadingLabel="Opening secure payment…"
          >
            Pay redelivery fee{" "}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {redelivery.state === "payment_review" ? (
        <p className="text-critical-ink mt-4 text-sm leading-6">
          The fee payment needs a manual check. Do not pay again. Please call{" "}
          <a href={contact.phoneHref} className="font-bold underline">
            {contact.phone}
          </a>
          .
        </p>
      ) : null}
      {redelivery.state === "scheduled" ? (
        <p className="text-sage-ink mt-4 text-sm font-semibold">
          Your redelivery is confirmed
          {redelivery.feeCents === 0
            ? " at no additional charge"
            : " and the fee was paid"}
          .
        </p>
      ) : null}
      {redelivery.state === "out_for_delivery" ? (
        <p className="text-ink-soft mt-4 text-sm">
          Your pastries are on their way to the address above.
        </p>
      ) : null}
      {redelivery.state === "discarded" ? (
        <p className="text-ink-soft mt-4 text-sm leading-6">
          The order was closed. The full original payment and any paid
          redelivery fee are being returned to their original payment methods.
        </p>
      ) : null}
      {redelivery.feeRefund ? (
        <div className="mt-4">
          <RefundStatus refund={redelivery.feeRefund} />
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="text-critical-ink mt-4 text-sm font-semibold"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
