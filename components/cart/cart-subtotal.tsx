"use client";

import { useCart } from "@/components/cart/cart-provider";
import { formatCents } from "@/lib/catalog/presentation";

export function CartSubtotal() {
  const { validation } = useCart();
  const subtotal =
    validation.status === "ready" ? validation.data.subtotalCents : null;
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <p className="text-ink font-bold">
        Subtotal <span className="text-ink-soft text-xs font-normal">CAD</span>
      </p>
      <p
        className="text-ink text-xl font-bold tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {subtotal === null
          ? validation.status === "validating"
            ? "Checking…"
            : "Needs review"
          : formatCents(subtotal)}
      </p>
    </div>
  );
}
