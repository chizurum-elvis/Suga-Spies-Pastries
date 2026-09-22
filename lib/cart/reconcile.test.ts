import { describe, expect, it } from "vitest";

import type { CatalogueProduct } from "@/lib/catalog/types";
import { configureProductLine } from "@/lib/cart/configuration";
import { reconcileCart } from "@/lib/cart/reconcile";
import { CART_SCHEMA_VERSION, type RawCart } from "@/lib/cart/types";

const ids = {
  product: "20000000-0000-4000-8000-000000000001",
  variant: "30000000-0000-4000-8000-000000000001",
  unavailableVariant: "30000000-0000-4000-8000-000000000002",
  singleGroup: "40000000-0000-4000-8000-000000000001",
  quantityGroup: "40000000-0000-4000-8000-000000000002",
  finish: "50000000-0000-4000-8000-000000000001",
  unavailableFinish: "50000000-0000-4000-8000-000000000002",
  berry: "50000000-0000-4000-8000-000000000003",
  lemon: "50000000-0000-4000-8000-000000000004",
  foreignOption: "50000000-0000-4000-8000-000000000099",
};

function product(overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    id: ids.product,
    category: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Sweet bakes",
      slug: "sweet-bakes",
    },
    name: "Celebration Cookie",
    slug: "celebration-cookie",
    shortDescription: null,
    description: null,
    basePriceCents: 400,
    currency: "CAD",
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 2,
    maximumQuantity: 10,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    images: [],
    variants: [],
    optionGroups: [],
    ...overrides,
  };
}

function cartLine(
  overrides: Partial<RawCart["lines"][number]> = {},
): RawCart["lines"][number] {
  return {
    productId: ids.product,
    variantId: null,
    optionSelections: [],
    quantity: 4,
    ...overrides,
  };
}

function cart(line = cartLine()): RawCart {
  return { version: CART_SCHEMA_VERSION, lines: [line] };
}

describe("authoritative cart reconciliation", () => {
  it("calculates a Canadian-dollar subtotal in integer cents", () => {
    const result = reconcileCart(
      cart(cartLine({ quantity: 6 })),
      [product()],
      new Date("2026-09-01T12:00:00.000Z"),
    );

    expect(result.status).toBe("ready");
    expect(result.currency).toBe("CAD");
    expect(result.subtotalCents).toBe(2_400);
    expect(result.validatedAt).toBe("2026-09-01T12:00:00.000Z");
  });

  it.each([
    [2, "quantity_below_minimum"],
    [5, "quantity_step_invalid"],
    [12, "quantity_above_maximum"],
  ] as const)("blocks invalid quantity %s", (quantity, code) => {
    const result = reconcileCart(cart(cartLine({ quantity })), [product()]);

    expect(result.status).toBe("blocked");
    expect(result.subtotalCents).toBeNull();
    expect(result.lines[0]?.issues.map((issue) => issue.code)).toContain(code);
  });

  it("blocks a product that became unavailable after it was added", () => {
    const result = reconcileCart(cart(), [product({ isAvailable: false })]);

    expect(result.status).toBe("blocked");
    expect(result.lines[0]?.issues[0]?.code).toBe("product_unavailable");
  });

  it("does not reveal whether a missing product was drafted or archived", () => {
    const result = reconcileCart(cart(), []);

    expect(result.status).toBe("blocked");
    expect(result.lines[0]?.product).toBeNull();
    expect(result.lines[0]?.issues).toEqual([
      {
        code: "product_missing",
        message: "This pastry is no longer available on the menu.",
      },
    ]);
  });

  it("requires a valid available variant when variants exist", () => {
    const withVariants = product({
      variants: [
        {
          id: ids.variant,
          name: "Gift box",
          priceCents: 600,
          minimumQuantity: null,
          quantityStep: null,
          maximumQuantity: null,
          isAvailable: true,
          isDefault: true,
        },
        {
          id: ids.unavailableVariant,
          name: "Party tray",
          priceCents: 700,
          minimumQuantity: null,
          quantityStep: null,
          maximumQuantity: null,
          isAvailable: false,
          isDefault: false,
        },
      ],
    });

    expect(
      reconcileCart(cart(), [withVariants]).lines[0]?.issues[0]?.code,
    ).toBe("variant_required");
    expect(
      reconcileCart(cart(cartLine({ variantId: ids.unavailableVariant })), [
        withVariants,
      ]).lines[0]?.issues[0]?.code,
    ).toBe("variant_unavailable");
  });

  it("prices variants, per-unit options, and allocated options correctly", () => {
    const configuredProduct = product({
      variants: [
        {
          id: ids.variant,
          name: "Gift box",
          priceCents: 600,
          minimumQuantity: 2,
          quantityStep: 1,
          maximumQuantity: 8,
          isAvailable: true,
          isDefault: true,
        },
      ],
      optionGroups: [
        {
          id: ids.singleGroup,
          name: "Finish",
          selectionType: "single",
          isRequired: true,
          minimumSelections: 1,
          maximumSelections: 1,
          values: [
            {
              id: ids.finish,
              name: "Celebration finish",
              priceDeltaCents: 100,
              isAvailable: true,
            },
          ],
        },
        {
          id: ids.quantityGroup,
          name: "Flavours",
          selectionType: "quantity",
          isRequired: true,
          minimumSelections: 2,
          maximumSelections: 4,
          values: [
            {
              id: ids.berry,
              name: "Berry",
              priceDeltaCents: 50,
              isAvailable: true,
            },
            {
              id: ids.lemon,
              name: "Lemon",
              priceDeltaCents: 0,
              isAvailable: true,
            },
          ],
        },
      ],
    });
    const result = reconcileCart(
      cart(
        cartLine({
          variantId: ids.variant,
          quantity: 4,
          optionSelections: [
            { optionValueId: ids.finish, quantity: 1 },
            { optionValueId: ids.berry, quantity: 2 },
          ],
        }),
      ),
      [configuredProduct],
    );

    expect(result.status).toBe("ready");
    expect(result.lines[0]).toMatchObject({
      baseUnitPriceCents: 600,
      unitPriceCents: 700,
      lineSubtotalCents: 2_900,
    });
    expect(result.subtotalCents).toBe(2_900);
  });

  it("rejects an option ID belonging to another product", () => {
    const configured = configureProductLine(product(), {
      variantId: null,
      quantity: 4,
      optionSelections: [{ optionValueId: ids.foreignOption, quantity: 1 }],
    });

    expect(configured.issues.map((issue) => issue.code)).toContain(
      "option_invalid",
    );
  });

  it("blocks an option that is archived, removed, or made unavailable", () => {
    const unavailableProduct = product({
      optionGroups: [
        {
          id: ids.singleGroup,
          name: "Finish",
          selectionType: "single",
          isRequired: false,
          minimumSelections: 0,
          maximumSelections: 1,
          values: [
            {
              id: ids.unavailableFinish,
              name: "Gold finish",
              priceDeltaCents: 100,
              isAvailable: false,
            },
          ],
        },
      ],
    });
    const unavailable = reconcileCart(
      cart(
        cartLine({
          optionSelections: [
            { optionValueId: ids.unavailableFinish, quantity: 1 },
          ],
        }),
      ),
      [unavailableProduct],
    );
    const removed = reconcileCart(
      cart(
        cartLine({
          optionSelections: [
            { optionValueId: ids.unavailableFinish, quantity: 1 },
          ],
        }),
      ),
      [product()],
    );

    expect(unavailable.lines[0]?.issues[0]?.code).toBe("option_unavailable");
    expect(removed.lines[0]?.issues[0]?.code).toBe("option_invalid");
  });

  it("requires configured mandatory choices", () => {
    const requiredProduct = product({
      optionGroups: [
        {
          id: ids.singleGroup,
          name: "Finish",
          selectionType: "single",
          isRequired: true,
          minimumSelections: 1,
          maximumSelections: 1,
          values: [
            {
              id: ids.finish,
              name: "Plain",
              priceDeltaCents: 0,
              isAvailable: true,
            },
          ],
        },
      ],
    });
    const result = reconcileCart(cart(), [requiredProduct]);

    expect(result.lines[0]?.issues[0]?.code).toBe("option_selection_required");
  });

  it("keeps very large valid integer-cent totals precise", () => {
    const result = reconcileCart(cart(cartLine({ quantity: 10_000 })), [
      product({
        basePriceCents: 100_000_000,
        minimumQuantity: 1,
        quantityStep: 1,
        maximumQuantity: 10_000,
      }),
    ]);

    expect(result.status).toBe("ready");
    expect(result.subtotalCents).toBe(1_000_000_000_000);
    expect(Number.isSafeInteger(result.subtotalCents)).toBe(true);
  });
});
