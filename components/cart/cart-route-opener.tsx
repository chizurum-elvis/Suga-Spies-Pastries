"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";

/** Recover an expired checkout in the menu drawer, not a separate date page. */
export function CartRouteOpener() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { openCart } = useCart();
  useEffect(() => {
    const step = params.get("cart");
    if (step !== "cart" && step !== "date") return;
    openCart(step);
    const remaining = new URLSearchParams(params.toString());
    remaining.delete("cart");
    router.replace(`${pathname}${remaining.size ? `?${remaining}` : ""}`, {
      scroll: false,
    });
  }, [openCart, params, pathname, router]);
  return null;
}
