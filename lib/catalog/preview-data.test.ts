import { describe, expect, it } from "vitest";

import { previewProducts } from "@/lib/catalog/preview-data";

const expectedLaunchMenu = [
  ['9" Cheesecake', 4000, 1, true],
  ['2" Mini Cheesecake', 450, 4, false],
  ["Chocolate Chip/Chunk Cookie", 250, 4, false],
  ["Red Velvet Cookie", 300, 4, false],
  ["Scone", 350, 4, false],
  ["Muffin", 400, 4, false],
  ['9" Tart', 2000, 4, false],
  ["Meat Pie", 350, 4, false],
  ["Chicken Pie", 400, 4, false],
  ["Sausage Roll", 375, 4, false],
] as const;

describe("preview launch catalogue", () => {
  it("matches the owner-supplied launch names, unit prices, and minimums", () => {
    expect(
      previewProducts.map((product) => [
        product.name,
        product.basePriceCents,
        product.minimumQuantity,
        product.isStartingPrice,
      ]),
    ).toEqual(expectedLaunchMenu);
  });

  it("keeps every launch item available and increments quantities by one", () => {
    expect(previewProducts).toHaveLength(10);
    expect(
      previewProducts.every(
        (product) =>
          product.isAvailable &&
          product.quantityStep === 1 &&
          product.unitLabel === "each",
      ),
    ).toBe(true);
  });

  it("maps a unique, descriptive photograph to every launch item", () => {
    const imageSources = previewProducts.map(
      (product) => product.images[0]?.src,
    );

    expect(imageSources.every(Boolean)).toBe(true);
    expect(new Set(imageSources).size).toBe(expectedLaunchMenu.length);
    expect(
      previewProducts.every(
        (product) => (product.images[0]?.alt.trim().length ?? 0) > 0,
      ),
    ).toBe(true);
  });
});
