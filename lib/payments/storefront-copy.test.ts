import { describe, expect, it } from "vitest";

import { storefrontCheckoutNotice } from "@/lib/payments/storefront-copy";

describe("storefront checkout notice", () => {
  it("does not claim checkout is closed when live payment configuration is ready", () => {
    expect(storefrontCheckoutNotice("live", [])).toBeNull();
  });

  it("clearly distinguishes test checkout from a real order", () => {
    expect(storefrontCheckoutNotice("test", [])).toMatch(/test mode/i);
    expect(storefrontCheckoutNotice("test", ["missing key"])).toMatch(
      /no real pastry order/i,
    );
  });

  it("does not imply customers can pay when payments are disabled or misconfigured", () => {
    expect(storefrontCheckoutNotice("disabled", [])).toMatch(/not open/i);
    expect(storefrontCheckoutNotice("live", ["private blocker"])).toMatch(
      /temporarily unavailable/i,
    );
    expect(storefrontCheckoutNotice("live", ["private blocker"])).not.toContain(
      "private blocker",
    );
  });
});
