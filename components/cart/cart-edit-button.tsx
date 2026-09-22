"use client";

import type { ReactNode } from "react";
import { useCart } from "@/components/cart/cart-provider";

/** Opens the same cart from checkout without losing unsaved form input. */
export function CartEditButton({
  children,
  className,
  step = "cart",
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  step?: "cart" | "date";
  disabled?: boolean;
}) {
  const { openCart, checkoutLocked } = useCart();
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || checkoutLocked}
      onClick={(event) => {
        event.currentTarget.focus();
        openCart(step);
      }}
    >
      {children}
    </button>
  );
}
