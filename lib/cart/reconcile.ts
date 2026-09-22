import type { CatalogueProduct } from "@/lib/catalog/types";
import { configureProductLine } from "@/lib/cart/configuration";
import { getCartLineId } from "@/lib/cart/identity";
import {
  CART_SCHEMA_VERSION,
  type CartIssue,
  type RawCart,
  type ValidatedCart,
  type ValidatedCartLine,
} from "@/lib/cart/types";

function missingProductLine(line: RawCart["lines"][number]): ValidatedCartLine {
  const issue: CartIssue = {
    code: "product_missing",
    message: "This pastry is no longer available on the menu.",
  };
  return {
    lineId: getCartLineId(line),
    productId: line.productId,
    variantId: line.variantId,
    optionSelections: line.optionSelections,
    quantity: line.quantity,
    status: "blocked",
    product: null,
    variant: null,
    options: [],
    quantityRule: null,
    baseUnitPriceCents: null,
    unitPriceCents: null,
    lineSubtotalCents: null,
    pricingFingerprint: null,
    issues: [issue],
  };
}

export function reconcileCart(
  cart: RawCart,
  products: readonly CatalogueProduct[],
  now: Date = new Date(),
): ValidatedCart {
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const lines = cart.lines.map((line): ValidatedCartLine => {
    const product = productsById.get(line.productId);
    if (!product) return missingProductLine(line);

    const configured = configureProductLine(product, {
      variantId: line.variantId,
      optionSelections: line.optionSelections,
      quantity: line.quantity,
    });
    return {
      lineId: configured.lineId,
      productId: product.id,
      variantId: configured.line.variantId,
      optionSelections: configured.line.optionSelections,
      quantity: configured.line.quantity,
      status: configured.issues.length ? "blocked" : "ready",
      product: {
        name: product.name,
        slug: product.slug,
        image: product.images[0] ?? null,
      },
      variant: configured.variant
        ? { id: configured.variant.id, name: configured.variant.name }
        : null,
      options: configured.options,
      quantityRule: configured.quantityRule,
      baseUnitPriceCents: configured.baseUnitPriceCents,
      unitPriceCents: configured.unitPriceCents,
      lineSubtotalCents: configured.lineSubtotalCents,
      pricingFingerprint: configured.pricingFingerprint,
      issues: configured.issues,
    };
  });
  const blocked = lines.some((line) => line.status === "blocked");
  const subtotal = lines.reduce(
    (total, line) => total + (line.lineSubtotalCents ?? 0),
    0,
  );
  const subtotalIsSafe = Number.isSafeInteger(subtotal) && subtotal >= 0;

  return {
    version: CART_SCHEMA_VERSION,
    status: lines.length === 0 ? "empty" : blocked ? "blocked" : "ready",
    currency: "CAD",
    validatedAt: now.toISOString(),
    itemCount: cart.lines.reduce((total, line) => total + line.quantity, 0),
    lineCount: lines.length,
    subtotalCents: blocked || !subtotalIsSafe ? null : subtotal,
    lines,
  };
}
