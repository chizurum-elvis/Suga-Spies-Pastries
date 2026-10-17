import { describe, expect, it } from "vitest";
import { orderSearchText, orderSearchFilter } from "@/lib/admin/order-filters";
describe("owner order search", () => {
  it.each([
    "SS-1234",
    "Chizurum Okere-Olujie",
    "baker@example.com",
    "+1 437 332 7263",
    "Renée O'Brien",
    "pastry_buyer@example.com",
    "(437) 332-7263",
  ])("accepts %s", (text) => expect(orderSearchText(text)).toBe(text));
  it.each([
    "x,or(status.eq.confirmed)",
    'a"',
    "a\\",
    "%",
    "a\nadmin",
    "x".repeat(121),
    null,
  ])("rejects filter syntax %j", (text) =>
    expect(orderSearchText(text)).toBeUndefined(),
  );
  it("normalizes phone search without trusting filter syntax", () => {
    expect(orderSearchFilter("+1 437 332 7263")).toContain(
      'contact_phone.ilike."%+14373327263%"',
    );
  });
  it("rejects bypassing the input validator", () =>
    expect(() => orderSearchFilter("x,or(status.eq.confirmed)")).toThrow());
  it("escapes underscores as literal characters", () =>
    expect(orderSearchFilter("pastry_buyer@example.com")).toContain(
      JSON.stringify("%pastry\\_buyer@example.com%"),
    ));
});
