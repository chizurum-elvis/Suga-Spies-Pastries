import Image from "next/image";
import { formatCurrency } from "@/lib/i18n/format";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import type { PurchaseSnapshot } from "@/lib/payments/schema";

export function PurchaseSummary({ snapshot }: { snapshot: PurchaseSnapshot }) {
  return (
    <section
      aria-label="Order summary"
      className="border-border min-w-0 border bg-white p-5 sm:p-7"
    >
      <h2 className="font-display text-brand-strong text-2xl">
        Your pastry box
      </h2>
      <ul className="divide-border mt-5 divide-y">
        {snapshot.validatedCart.lines.map((line) => (
          <li key={line.lineId} className="flex gap-3 py-4 first:pt-0">
            {line.product?.image ? (
              <Image
                src={line.product.image.src}
                alt=""
                width={64}
                height={64}
                sizes="64px"
                className="size-16 shrink-0 object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{line.product?.name}</p>
              {line.variant ? (
                <p className="text-ink-soft text-xs">{line.variant.name}</p>
              ) : null}
              {line.options.length ? (
                <p className="text-ink-soft mt-1 text-xs leading-5">
                  {line.options
                    .map(
                      (option) =>
                        `${option.name}${option.quantity > 1 ? ` × ${option.quantity}` : ""}`,
                    )
                    .join(", ")}
                </p>
              ) : null}
              <p className="text-ink-soft mt-1 text-xs">
                {line.quantity} × {formatCurrency(line.unitPriceCents! / 100)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold">
              {formatCurrency(line.lineSubtotalCents! / 100)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="border-border space-y-3 border-t pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt>Subtotal</dt>
          <dd>{formatCurrency(snapshot.subtotalCents / 100)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Delivery</dt>
          <dd>
            {snapshot.deliveryCents
              ? formatCurrency(snapshot.deliveryCents / 100)
              : "Free"}
          </dd>
        </div>
        <div className="border-border flex justify-between gap-3 border-t pt-4 text-lg font-bold">
          <dt>
            Total <span className="text-xs font-normal">CAD</span>
          </dt>
          <dd>{formatCurrency(snapshot.totalCents / 100)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function DeliverySummary({ snapshot }: { snapshot: PurchaseSnapshot }) {
  const { delivery } = snapshot;
  return (
    <section
      aria-labelledby="delivery-review-heading"
      className="border-border border-b pb-6"
    >
      <h2
        id="delivery-review-heading"
        className="font-display text-brand-strong text-2xl"
      >
        Delivered to your door
      </h2>
      <p className="mt-3 text-sm font-bold">
        {formatLocalDateLabel(snapshot.fulfillmentDate)}
      </p>
      <address className="mt-3 text-sm leading-6 not-italic">
        {delivery.recipientName}
        <br />
        {delivery.address.line1}
        {delivery.address.line2 ? (
          <>
            <br />
            {delivery.address.line2}
          </>
        ) : null}
        <br />
        {delivery.address.city}, ON {delivery.address.postalCode}
      </address>
      <p className="text-ink-soft mt-3 text-sm break-words">
        Confirmation to {delivery.email}
      </p>
      {delivery.instructions ? (
        <p className="text-ink-soft mt-3 text-sm break-words whitespace-pre-wrap">
          Delivery note: {delivery.instructions}
        </p>
      ) : null}
    </section>
  );
}
