import type { RawCartLine, RawCartOptionSelection } from "@/lib/cart/types";

export function sortOptionSelections(
  selections: readonly RawCartOptionSelection[],
): RawCartOptionSelection[] {
  return [...selections].sort((left, right) =>
    left.optionValueId.localeCompare(right.optionValueId),
  );
}

export function getCartLineId(line: RawCartLine): string {
  const selections = sortOptionSelections(line.optionSelections)
    .map((selection) => `${selection.optionValueId}=${selection.quantity}`)
    .join(",");

  return ["cart-v1", line.productId, line.variantId ?? "base", selections].join(
    "|",
  );
}

export function normalizeRawCartLine(line: RawCartLine): RawCartLine {
  return {
    productId: line.productId,
    variantId: line.variantId,
    optionSelections: sortOptionSelections(line.optionSelections),
    quantity: line.quantity,
  };
}
