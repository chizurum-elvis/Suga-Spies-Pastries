import { describe, expect, it } from "vitest";

import { getCartLineId } from "@/lib/cart/identity";
import { normalizeRawCartLine } from "@/lib/cart/identity";
import {
  addCartLine,
  rawCartItemCount,
  removeCartLine,
  updateCartLineQuantity,
} from "@/lib/cart/mutations";
import {
  coerceQuantityToRule,
  nextQuantity,
  previousQuantity,
  quantityIssue,
} from "@/lib/cart/quantity";
import {
  createEmptyCart,
  rawCartLineSchema,
  restoreCart,
  serializeCart,
} from "@/lib/cart/schema";
import { CART_SCHEMA_VERSION, MAX_CART_LINES } from "@/lib/cart/types";

const productId = "20000000-0000-4000-8000-000000000001";
const variantId = "30000000-0000-4000-8000-000000000001";
const firstOptionId = "50000000-0000-4000-8000-000000000001";
const secondOptionId = "50000000-0000-4000-8000-000000000002";

const baseLine = {
  productId,
  variantId,
  optionSelections: [
    { optionValueId: secondOptionId, quantity: 2 },
    { optionValueId: firstOptionId, quantity: 1 },
  ],
  quantity: 4,
};

describe("cart identity and persistence", () => {
  it("derives the same identity regardless of option input order", () => {
    const reversed = {
      ...baseLine,
      optionSelections: [...baseLine.optionSelections].reverse(),
    };

    expect(getCartLineId(baseLine)).toBe(getCartLineId(reversed));
    expect(getCartLineId(baseLine)).not.toContain("quantity=4");
  });

  it("persists identifiers and quantities without persisting prices", () => {
    const cart = { version: CART_SCHEMA_VERSION, lines: [baseLine] };
    const serialized = serializeCart(cart);
    const normalizedCart = {
      version: CART_SCHEMA_VERSION,
      lines: [normalizeRawCartLine(baseLine)],
    };

    expect(JSON.parse(serialized)).toEqual(normalizedCart);
    expect(serialized).not.toMatch(/price|subtotal|name|email/i);
    expect(restoreCart(serialized)).toEqual({
      cart: normalizedCart,
      recovered: false,
    });
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 0, lines: [] }),
    JSON.stringify({ version: 1, lines: "wrong" }),
    JSON.stringify({ version: 1, lines: [], injected: true }),
  ])("safely resets corrupted or unsupported persisted data", (serialized) => {
    expect(restoreCart(serialized)).toEqual({
      cart: createEmptyCart(),
      recovered: true,
    });
  });

  it("merges duplicate stored identities without exceeding the safety cap", () => {
    const restored = restoreCart(
      JSON.stringify({
        version: 1,
        lines: [baseLine, { ...baseLine, quantity: 5 }],
      }),
    );

    expect(restored.recovered).toBe(true);
    expect(restored.cart.lines).toHaveLength(1);
    expect(restored.cart.lines[0]?.quantity).toBe(9);
  });

  it("rejects duplicate option IDs in one line", () => {
    const parsed = rawCartLineSchema.safeParse({
      ...baseLine,
      optionSelections: [
        { optionValueId: firstOptionId, quantity: 1 },
        { optionValueId: firstOptionId, quantity: 1 },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("cart mutations", () => {
  it("combines repeated add-to-cart actions for the same configuration", () => {
    const first = addCartLine(createEmptyCart(), baseLine, 20);
    const second = addCartLine(first.cart, { ...baseLine, quantity: 5 }, 20);

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(true);
    expect(second.cart.lines).toHaveLength(1);
    expect(second.cart.lines[0]?.quantity).toBe(9);
    expect(rawCartItemCount(second.cart)).toBe(9);
  });

  it("does not silently cap repeated clicks above the configured maximum", () => {
    const first = addCartLine(createEmptyCart(), baseLine, 8);
    const second = addCartLine(first.cart, { ...baseLine, quantity: 5 }, 8);

    expect(second.changed).toBe(false);
    expect(second.message).toContain("cannot exceed 8");
    expect(second.cart.lines[0]?.quantity).toBe(4);
  });

  it("supports two sequential writers by applying each change to the latest cart", () => {
    const firstTab = addCartLine(createEmptyCart(), baseLine, null).cart;
    const secondTab = addCartLine(
      firstTab,
      { ...baseLine, variantId: null },
      null,
    ).cart;

    expect(secondTab.lines).toHaveLength(2);
    expect(rawCartItemCount(secondTab)).toBe(8);
  });

  it("rejects a fifty-first distinct cart line", () => {
    const lines = Array.from({ length: MAX_CART_LINES }, (_, index) => ({
      productId: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      variantId: null,
      optionSelections: [],
      quantity: 1,
    }));
    const result = addCartLine(
      { version: CART_SCHEMA_VERSION, lines },
      {
        productId: "20000000-0000-4000-8000-000000000099",
        variantId: null,
        optionSelections: [],
        quantity: 1,
      },
    );

    expect(result.changed).toBe(false);
    expect(result.message).toContain(String(MAX_CART_LINES));
  });

  it("updates and removes by stable identity", () => {
    const added = addCartLine(createEmptyCart(), baseLine).cart;
    const lineId = getCartLineId(baseLine);
    const updated = updateCartLineQuantity(added, lineId, 7);
    const removed = removeCartLine(updated.cart, lineId);

    expect(updated.cart.lines[0]?.quantity).toBe(7);
    expect(removed.cart.lines).toEqual([]);
  });
});

describe("quantity rules", () => {
  const rule = { minimum: 4, step: 3, maximum: 13 };

  it.each([
    [3, "below"],
    [4, null],
    [5, "step"],
    [7, null],
    [14, "above"],
  ] as const)("classifies quantity %s", (quantity, expected) => {
    expect(quantityIssue(quantity, rule)).toBe(expected);
  });

  it("moves and repairs quantities without escaping the rule", () => {
    expect(nextQuantity(4, rule)).toBe(7);
    expect(previousQuantity(7, rule)).toBe(4);
    expect(coerceQuantityToRule(5, rule)).toBe(4);
    expect(coerceQuantityToRule(12, rule)).toBe(13);
    expect(coerceQuantityToRule(99, rule)).toBe(13);
  });
});
