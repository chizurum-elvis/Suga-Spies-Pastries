import { describe, expect, it } from "vitest";

import {
  formatMinimumOrderPrice,
  formatQuantityRule,
  formatUnitPrice,
} from "@/lib/catalog/presentation";

describe("catalogue price presentation", () => {
  it("shows the minimum purchasable total without changing the unit price", () => {
    const miniCheesecake = {
      basePriceCents: 450,
      isStartingPrice: false,
      minimumQuantity: 4,
      unitLabel: "each",
    } as const;

    expect(formatMinimumOrderPrice(miniCheesecake)).toBe("$18.00 for 4");
    expect(formatUnitPrice(miniCheesecake)).toBe("$4.50 each");
  });

  it("preserves the starting-price meaning for the regular cheesecake", () => {
    const cheesecake = {
      basePriceCents: 4000,
      isStartingPrice: true,
      minimumQuantity: 1,
      unitLabel: "each",
    } as const;

    expect(formatMinimumOrderPrice(cheesecake)).toBe("From $40.00");
    expect(formatUnitPrice(cheesecake)).toBe("From $40.00 each");
  });
});

describe("catalogue quantity presentation", () => {
  it("explains the confirmed increment of one after the minimum of four", () => {
    expect(
      formatQuantityRule({
        minimumQuantity: 4,
        quantityStep: 1,
        maximumQuantity: null,
      }),
    ).toBe("Minimum 4 · then add 1 at a time");
  });

  it("shows configured steps and maximums without implying a step of one", () => {
    expect(
      formatQuantityRule({
        minimumQuantity: 6,
        quantityStep: 2,
        maximumQuantity: 20,
      }),
    ).toBe("Minimum 6 · multiples of 2 · maximum 20");
  });
});
