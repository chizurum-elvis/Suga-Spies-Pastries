import { expect, it } from "vitest";
import { suggestCatalogueSlug } from "@/lib/catalog/slug";
it.each([
  ["Maple & Walnut Cookies", "maple-walnut-cookies"],
  [" Crème brûlée ", "creme-brulee"],
  ['9" Cheesecake', "9-cheesecake"],
  ["!!!", ""],
  ["Chocolate---Chip", "chocolate-chip"],
])("suggests a safe page address for %s", (name, expected) =>
  expect(suggestCatalogueSlug(name)).toBe(expected),
);
it("respects the address length without leaving a trailing hyphen", () =>
  expect(suggestCatalogueSlug("Chocolate Chip", 10)).toBe("chocolate"));
