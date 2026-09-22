import "server-only";

import { getFreshPublishedProducts } from "@/lib/catalog/public-data";
import { reconcileCart } from "@/lib/cart/reconcile";
import type { RawCart } from "@/lib/cart/types";

export async function validateCartAgainstCatalogue(cart: RawCart) {
  const products = await getFreshPublishedProducts(
    cart.lines.map((line) => line.productId),
  );

  return reconcileCart(cart, products);
}
