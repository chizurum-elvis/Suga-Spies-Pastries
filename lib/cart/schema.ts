import { z } from "zod";

import { getCartLineId, normalizeRawCartLine } from "@/lib/cart/identity";
import {
  CART_SCHEMA_VERSION,
  MAX_CART_LINES,
  MAX_CART_QUANTITY,
  MAX_OPTION_SELECTIONS_PER_LINE,
  type RawCart,
  type RawCartLine,
} from "@/lib/cart/types";

export const rawCartOptionSelectionSchema = z.strictObject({
  optionValueId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});

export const rawCartLineSchema = z
  .strictObject({
    productId: z.uuid(),
    variantId: z.uuid().nullable(),
    optionSelections: z
      .array(rawCartOptionSelectionSchema)
      .max(MAX_OPTION_SELECTIONS_PER_LINE),
    quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
  })
  .superRefine((line, context) => {
    const ids = line.optionSelections.map(
      (selection) => selection.optionValueId,
    );
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["optionSelections"],
        message: "A cart line cannot contain the same option twice.",
      });
    }
  });

export const rawCartSchema = z.strictObject({
  version: z.literal(CART_SCHEMA_VERSION),
  lines: z.array(rawCartLineSchema).max(MAX_CART_LINES),
});

export function createEmptyCart(): RawCart {
  return { version: CART_SCHEMA_VERSION, lines: [] };
}

function mergeDuplicateLines(lines: readonly RawCartLine[]): RawCartLine[] {
  const byIdentity = new Map<string, RawCartLine>();

  for (const originalLine of lines) {
    const line = normalizeRawCartLine(originalLine);
    const identity = getCartLineId(line);
    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, line);
      continue;
    }

    byIdentity.set(identity, {
      ...existing,
      quantity: Math.min(MAX_CART_QUANTITY, existing.quantity + line.quantity),
    });
  }

  return [...byIdentity.values()];
}

export type RestoredCart = {
  cart: RawCart;
  recovered: boolean;
};

export function restoreCart(serialized: string | null): RestoredCart {
  if (!serialized) return { cart: createEmptyCart(), recovered: false };

  try {
    const result = rawCartSchema.safeParse(JSON.parse(serialized));
    if (!result.success) {
      return { cart: createEmptyCart(), recovered: true };
    }

    const mergedLines = mergeDuplicateLines(result.data.lines);
    return {
      cart: { version: CART_SCHEMA_VERSION, lines: mergedLines },
      recovered: mergedLines.length !== result.data.lines.length,
    };
  } catch {
    return { cart: createEmptyCart(), recovered: true };
  }
}

export function serializeCart(cart: RawCart): string {
  const parsed = rawCartSchema.parse(cart);
  return JSON.stringify({
    version: CART_SCHEMA_VERSION,
    lines: parsed.lines.map(normalizeRawCartLine),
  });
}
