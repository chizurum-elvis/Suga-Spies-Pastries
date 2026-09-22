"use client";

import { useEffect } from "react";

import { CartContents } from "@/components/cart/cart-contents";
import { useCart } from "@/components/cart/cart-provider";

export function CartPageClient() {
  const { refreshCart } = useCart();

  useEffect(() => refreshCart(), [refreshCart]);

  return <CartContents mode="page" />;
}
