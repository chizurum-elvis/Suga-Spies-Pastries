"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { CartQuantityControl } from "@/components/cart/cart-quantity-control";
import { useCart } from "@/components/cart/cart-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/catalog/presentation";
import type { ValidatedCartLine } from "@/lib/cart/types";
import { cn } from "@/lib/utils/cn";

function lineChoiceSummary(line: ValidatedCartLine) {
  const choices: string[] = [];
  if (line.variant) choices.push(line.variant.name);
  for (const option of line.options) {
    choices.push(
      option.selectionType === "quantity" && option.quantity > 1
        ? `${option.groupName}: ${option.name} × ${option.quantity}`
        : `${option.groupName}: ${option.name}`,
    );
  }
  return choices;
}

function CartLine({ line }: { line: ValidatedCartLine }) {
  const { removeLine, closeCart } = useCart();
  const name = line.product?.name ?? "Unavailable pastry";
  const choices = lineChoiceSummary(line);

  return (
    <li className="border-border grid grid-cols-[4rem_minmax(0,1fr)] gap-3 border-b py-5 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4">
      <div className="bg-butter-soft relative aspect-square overflow-hidden rounded-lg">
        {line.product?.image ? (
          <Image
            src={line.product.image.src}
            alt={line.product.image.alt}
            fill
            sizes="96px"
            style={{ objectPosition: line.product.image.objectPosition }}
            className="object-cover"
          />
        ) : (
          <div className="text-brand-strong grid size-full place-items-center">
            <ShoppingBag className="size-6" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            {line.product ? (
              <Link
                href={`/menu/${line.product.slug}`}
                onClick={closeCart}
                className="text-ink hover:text-brand-strong font-semibold text-pretty underline-offset-4 hover:underline"
              >
                {name}
              </Link>
            ) : (
              <p className="text-ink font-semibold">{name}</p>
            )}
            {choices.length ? (
              <ul className="text-ink-soft mt-1 grid gap-0.5 text-xs leading-5">
                {choices.map((choice) => (
                  <li key={choice}>{choice}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {line.lineSubtotalCents !== null ? (
            <p className="text-ink shrink-0 text-sm font-bold tabular-nums">
              {formatCents(line.lineSubtotalCents)}
            </p>
          ) : null}
        </div>

        {line.unitPriceCents !== null ? (
          <p className="text-ink-faint mt-2 text-xs tabular-nums">
            {line.quantity} × {formatCents(line.unitPriceCents)}
          </p>
        ) : null}

        {line.issues.length ? (
          <div
            className="bg-warning/55 text-warning-ink mt-3 rounded-md px-3 py-2 text-xs leading-5"
            role="alert"
          >
            <div className="flex gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <ul className="grid gap-1">
                {line.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          {line.quantityRule ? (
            <CartQuantityControl
              lineId={line.lineId}
              productName={name}
              quantity={line.quantity}
              rule={line.quantityRule}
            />
          ) : (
            <p className="text-ink-soft text-sm">Quantity {line.quantity}</p>
          )}
          <Button
            variant="quiet"
            size="sm"
            className="text-ink-soft hover:text-critical-ink px-2"
            onClick={() => void removeLine(line.lineId, name)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

function LoadingCart() {
  return (
    <div className="grid gap-4 py-7" aria-label="Loading cart" role="status">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="grid grid-cols-[5rem_1fr] gap-4 motion-safe:animate-pulse"
        >
          <div className="bg-canvas-strong aspect-square rounded-lg" />
          <div className="grid content-center gap-2">
            <div className="bg-canvas-strong h-4 w-3/4 rounded" />
            <div className="bg-canvas-strong h-3 w-1/2 rounded" />
            <div className="bg-canvas-strong h-10 w-32 rounded" />
          </div>
        </div>
      ))}
      <span className="sr-only">Confirming your pastry selections…</span>
    </div>
  );
}

export function CartContents({
  mode,
  showFooter = true,
}: {
  mode: "drawer" | "page";
  showFooter?: boolean;
}) {
  const {
    acknowledgePriceChanges,
    cart,
    clearCart,
    closeCart,
    hydrated,
    priceChanges,
    refreshCart,
    storageWarning,
    validation,
    openCart,
  } = useCart();
  const data = validation.data;

  if (
    !hydrated ||
    (cart.lines.length > 0 && !data && validation.status !== "error")
  ) {
    return <LoadingCart />;
  }

  if (cart.lines.length === 0 || data?.status === "empty") {
    return (
      <div className="grid place-items-center px-2 py-12 text-center">
        <div className="bg-butter-soft text-brand-strong grid size-16 place-items-center rounded-full">
          <ShoppingBag className="size-7" aria-hidden="true" />
        </div>
        <h2 className="font-display text-ink mt-5 text-3xl leading-none">
          Your pastry box is empty
        </h2>
        <p className="text-ink-soft mt-3 max-w-sm text-sm leading-6">
          Choose a cheesecake, cookie, pie, or another favourite from the pastry
          menu.
        </p>
        <Link
          href="/menu"
          onClick={mode === "drawer" ? closeCart : undefined}
          className={cn(buttonVariants({ size: "lg" }), "mt-6")}
        >
          Browse the pastry menu
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5" aria-busy={validation.status === "validating"}>
      {storageWarning ? (
        <div
          className="bg-warning/60 text-warning-ink rounded-md px-4 py-3 text-sm leading-6"
          role="alert"
        >
          {storageWarning}
        </div>
      ) : null}

      {validation.status === "error" ? (
        <div
          className="bg-critical/70 text-critical-ink rounded-md px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-bold">We could not refresh your cart.</p>
          <p className="mt-1 text-sm leading-6">{validation.message}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={refreshCart}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry menu check
          </Button>
        </div>
      ) : null}

      {priceChanges.length ? (
        <div
          className="border-warning-ink/25 bg-warning/55 text-warning-ink rounded-lg border p-4"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold">The current menu price changed.</p>
              <ul className="mt-1 grid gap-1 text-sm leading-6">
                {priceChanges.map((change) => (
                  <li key={change.lineId}>
                    {change.productName}
                    {change.currentLineSubtotalCents !== null
                      ? ` is now ${formatCents(change.currentLineSubtotalCents)} for this quantity.`
                      : " has an updated price."}
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={acknowledgePriceChanges}
              >
                I’ve reviewed the update
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {validation.status === "validating" ? (
        <p
          className="text-ink-soft flex items-center gap-2 text-xs"
          role="status"
        >
          <RefreshCw
            className="size-3.5 motion-safe:animate-spin"
            aria-hidden="true"
          />
          Confirming the latest menu and prices…
        </p>
      ) : null}

      <ul className="border-border border-t">
        {data?.lines.map((line) => (
          <CartLine key={line.lineId} line={line} />
        ))}
      </ul>

      {showFooter ? (
        <div className="border-border grid gap-4 border-t pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-ink font-semibold">Pastry subtotal</p>
              <p className="text-ink-faint mt-1 text-xs leading-5">
                Delivery is confirmed during checkout.
              </p>
            </div>
            <p className="text-ink text-xl font-bold tabular-nums">
              {data?.subtotalCents === null || data?.subtotalCents === undefined
                ? "Needs review"
                : formatCents(data.subtotalCents)}
            </p>
          </div>

          {validation.status === "ready" &&
          data?.status === "ready" &&
          priceChanges.length === 0 ? (
            <Button
              onClick={() => openCart("date")}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
              aria-describedby="checkout-next-step"
            >
              Choose delivery date
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              disabled
              aria-describedby="checkout-next-step"
            >
              {data?.status === "blocked"
                ? "Resolve cart issues to continue"
                : priceChanges.length
                  ? "Review the updated price to continue"
                  : "Confirming your cart…"}
            </Button>
          )}
          {mode === "page" ? (
            <p
              id="checkout-next-step"
              className="text-ink-faint text-center text-xs leading-5"
            >
              Your cart is saved in this browser. Choose a delivery date first;
              contact information and payment follow together.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/menu"
              onClick={mode === "drawer" ? closeCart : undefined}
              className="text-brand-strong min-h-11 content-center text-sm font-bold underline underline-offset-4"
            >
              Add another pastry
            </Link>
            <Button variant="quiet" size="sm" onClick={() => void clearCart()}>
              Clear cart
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
