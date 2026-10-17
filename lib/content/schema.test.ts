import { describe, expect, it } from "vitest";

import {
  contactContentSchema,
  contactPhoneHref,
  faqContentSchema,
  homeContentSchema,
  policyDraftSchema,
  publishablePolicySchema,
} from "@/lib/content/schema";
import {
  defaultContactContent,
  defaultFaqContent,
  defaultHomeContent,
} from "@/lib/content/defaults";

describe("owner-editable website content", () => {
  it("validates every initial public document", () => {
    expect(homeContentSchema.parse(defaultHomeContent)).toEqual(
      defaultHomeContent,
    );
    expect(contactContentSchema.parse(defaultContactContent)).toEqual(
      defaultContactContent,
    );
    expect(faqContentSchema.parse(defaultFaqContent)).toEqual(
      defaultFaqContent,
    );
  });

  it("requires a genuine Canadian support number and derives the safe tel link", () => {
    expect(contactPhoneHref(defaultContactContent.phone)).toBe(
      "tel:+14373327263",
    );
    for (const phone of [
      "+44 20 7946 0958",
      "+1 555 000 0000",
      "javascript:alert(1)",
    ]) {
      expect(contactContentSchema.safeParse({ phone, email: "" }).success).toBe(
        false,
      );
    }
  });

  it("does not allow duplicate, empty, or oversized FAQ entries", () => {
    expect(faqContentSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      faqContentSchema.safeParse({ items: [{ question: "?", answer: "" }] })
        .success,
    ).toBe(false);
    expect(
      faqContentSchema.safeParse({
        items: [
          { question: "How?", answer: "Yes." },
          { question: "HOW?", answer: "No." },
        ],
      }).success,
    ).toBe(false);
    expect(
      faqContentSchema.safeParse({
        items: Array.from({ length: 13 }, (_, index) => ({
          question: `Question ${index}?`,
          answer: "Answer.",
        })),
      }).success,
    ).toBe(false);
  });

  it("permits an unpublished empty policy draft but not a published empty policy", () => {
    expect(
      policyDraftSchema.safeParse({ title: "Privacy policy", body: "" })
        .success,
    ).toBe(true);
    expect(
      publishablePolicySchema.safeParse({ title: "Privacy policy", body: "" })
        .success,
    ).toBe(false);
  });
});
