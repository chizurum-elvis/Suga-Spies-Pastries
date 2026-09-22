import { describe, expect, it } from "vitest";

import { isSameOriginMutation } from "@/lib/security/request";

describe("same-origin mutation protection", () => {
  it("accepts matching browser origins", () => {
    expect(
      isSameOriginMutation(
        new Request("https://sugaspies.ca/api/checkout/fulfillment", {
          headers: {
            origin: "https://sugaspies.ca",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts browser-verified same-origin requests behind an internal host", () => {
    expect(
      isSameOriginMutation(
        new Request("http://internal:3000/api/checkout/fulfillment", {
          headers: {
            origin: "https://sugaspies.ca",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects cross-site and deceptive subdomain origins", () => {
    expect(
      isSameOriginMutation(
        new Request("https://sugaspies.ca/api/checkout/fulfillment", {
          headers: {
            origin: "https://sugaspies.ca.attacker.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toBe(false);
  });

  it("fails closed when browser origin evidence is absent", () => {
    expect(
      isSameOriginMutation(
        new Request("https://sugaspies.ca/api/checkout/fulfillment"),
      ),
    ).toBe(false);
  });
});
