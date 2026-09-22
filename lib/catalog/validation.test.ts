import { describe, expect, it } from "vitest";

import {
  parseCadAmountToCents,
  productFormSchema,
} from "@/lib/catalog/validation";

describe("catalogue validation", () => {
  it.each([
    ["0", 0],
    ["4.5", 450],
    ["4.50", 450],
    ["1,200.09", 120009],
    ["$40", 4000],
  ])("converts %s to integer cents", (input, expected) =>
    expect(parseCadAmountToCents(input)).toBe(expected),
  );
  it.each(["-1", "1.999", "NaN", "Infinity", "1e3", "", "12,34"])(
    "rejects unsafe money input %s",
    (input) => expect(parseCadAmountToCents(input)).toBeNull(),
  );
  it("rejects a maximum below the minimum", () => {
    const result = productFormSchema.safeParse({
      name: "Cookies",
      slug: "cookies",
      categoryId: "10000000-0000-4000-8000-000000000001",
      shortDescription: null,
      description: null,
      price: "4.50",
      isStartingPrice: false,
      unitLabel: null,
      minimumQuantity: "4",
      quantityStep: "1",
      maximumQuantity: "3",
      ingredients: null,
      allergenInformation: null,
      customerInstructions: null,
      displayOrder: "0",
    });
    expect(result.success).toBe(false);
  });
  it("rejects ambiguous and traversal-like slugs", () => {
    for (const slug of ["../cookies", "Cookies", "cookie--box", "cookie box"]) {
      expect(
        productFormSchema.safeParse({
          name: "Cookies",
          slug,
          categoryId: "10000000-0000-4000-8000-000000000001",
          shortDescription: null,
          description: null,
          price: "4.50",
          isStartingPrice: false,
          unitLabel: null,
          minimumQuantity: "4",
          quantityStep: "1",
          maximumQuantity: null,
          ingredients: null,
          allergenInformation: null,
          customerInstructions: null,
          displayOrder: "0",
        }).success,
      ).toBe(false);
    }
  });
});
