import { describe, expect, it } from "vitest";
import { customerLoginPath, safeCustomerReturnPath } from "./paths";

describe("customer return paths", () => {
  it.each([
    "/account",
    "/account/details",
    "/checkout",
    "/orders/98500000-0000-4000-8000-000000000001",
  ])("allows an intended local destination: %s", (path) => {
    expect(safeCustomerReturnPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example/checkout",
    "//evil.example/checkout",
    "/\\evil.example",
    "/admin",
    "/account/auth/callback?code=secret",
    "/orders/not-an-id",
    "/checkout/../admin",
    "/\0account",
    "\n/checkout",
    3,
    null,
  ])("rejects external and unapproved destinations: %s", (path) => {
    expect(safeCustomerReturnPath(path)).toBe("/account");
  });

  it("encodes a safe destination without allowing a second query parameter", () => {
    expect(customerLoginPath("/checkout?section=delivery&note=hello")).toBe(
      "/account/login?next=%2Fcheckout%3Fsection%3Ddelivery%26note%3Dhello",
    );
  });
});
