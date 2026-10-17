import { describe, expect, it } from "vitest";

import { publishedPolicyLinks } from "@/lib/content/policy-links";

const policies = {
  terms: { version: 2, content: { title: "Terms", body: "Approved terms." } },
  privacy: {
    version: 4,
    content: { title: "Privacy", body: "Approved privacy." },
  },
  refund: {
    version: 3,
    content: { title: "Refund", body: "Approved refund." },
  },
};

describe("published checkout policy links", () => {
  it("pins each legal page to an immutable revision", () => {
    expect(publishedPolicyLinks("https://suga.example", policies)).toEqual({
      version: "terms-2.privacy-4.refund-3",
      termsUrl: "https://suga.example/policies/terms?v=2",
      privacyUrl: "https://suga.example/policies/privacy?v=4",
      refundUrl: "https://suga.example/policies/refund?v=3",
    });
  });

  it("never activates an incomplete set, empty policy, or insecure site URL", () => {
    expect(
      publishedPolicyLinks("https://suga.example", {
        ...policies,
        refund: null,
      }),
    ).toBeNull();
    expect(
      publishedPolicyLinks("https://suga.example", {
        ...policies,
        terms: {
          ...policies.terms,
          content: { ...policies.terms.content, body: " " },
        },
      }),
    ).toBeNull();
    expect(publishedPolicyLinks("http://localhost:3000", policies)).toBeNull();
  });
});
