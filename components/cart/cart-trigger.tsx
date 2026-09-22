"use client";

import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils/cn";

export function CartTrigger({ className }: { className?: string }) {
  const { hydrated, itemCount, openCart } = useCart();
  const visualCount = itemCount > 99 ? "99+" : String(itemCount);
  const accessibleCount = hydrated
    ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
    : "loading";

  return (
    <Button
      type="button"
      variant="quiet"
      onClick={(event) => {
        event.currentTarget.focus();
        openCart();
      }}
      className={cn("relative gap-2 px-2.5 sm:px-3", className)}
      aria-label={`Open cart, ${accessibleCount}`}
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      <span className="hidden text-sm font-semibold sm:inline">Cart</span>
      {hydrated && itemCount > 0 ? (
        <span
          className="bg-brand absolute -top-0.5 -right-0.5 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[0.65rem] leading-none font-extrabold text-white sm:static sm:min-h-0 sm:min-w-5 sm:px-1.5 sm:py-1"
          aria-hidden="true"
        >
          {visualCount}
        </span>
      ) : null}
    </Button>
  );
}
