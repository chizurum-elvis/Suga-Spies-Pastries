import { formatCurrency } from "@/lib/i18n/format";
import type { CatalogueProduct } from "@/lib/catalog/types";

export function formatCents(cents: number) {
  return formatCurrency(cents / 100);
}

export function formatMinimumOrderPrice(
  product: Pick<
    CatalogueProduct,
    "basePriceCents" | "isStartingPrice" | "minimumQuantity"
  >,
) {
  const amount = formatCents(product.basePriceCents * product.minimumQuantity);
  const prefix = product.isStartingPrice ? "From " : "";
  const quantity =
    product.minimumQuantity > 1 ? ` for ${product.minimumQuantity}` : "";

  return `${prefix}${amount}${quantity}`;
}

export function formatUnitPrice(
  product: Pick<
    CatalogueProduct,
    "basePriceCents" | "isStartingPrice" | "unitLabel"
  >,
) {
  const amount = formatCents(product.basePriceCents);
  const prefix = product.isStartingPrice ? "From " : "";
  const unit = product.unitLabel ? ` ${product.unitLabel}` : "";

  return `${prefix}${amount}${unit}`;
}

export function formatQuantityRule(
  product: Pick<
    CatalogueProduct,
    "minimumQuantity" | "quantityStep" | "maximumQuantity"
  >,
) {
  const minimum = `Minimum ${product.minimumQuantity}`;
  const step =
    product.quantityStep > 1
      ? ` · multiples of ${product.quantityStep}`
      : product.minimumQuantity > 1
        ? " · then add 1 at a time"
        : "";
  const maximum = product.maximumQuantity
    ? ` · maximum ${product.maximumQuantity}`
    : "";
  return `${minimum}${step}${maximum}`;
}
