import { describe, expect, it } from "vitest";

import {
  blackoutFormSchema,
  capacityAdjustmentFormSchema,
} from "@/lib/fulfillment/admin-validation";

describe("owner fulfillment validation", () => {
  it("accepts a date-only blackout", () => {
    expect(
      blackoutFormSchema.safeParse({
        date: "2028-02-29",
        scope: "delivery",
        publicReason: "Private event",
        internalNote: "Owner-only context",
      }).success,
    ).toBe(true);
  });

  it("rejects nonexistent dates and obsolete time fields", () => {
    const nonexistentDate = blackoutFormSchema.safeParse({
      date: "2027-02-29",
      scope: "delivery",
      publicReason: "",
      internalNote: "",
    });
    const obsoleteTime = blackoutFormSchema.safeParse({
      date: "2027-02-28",
      scope: "delivery",
      startsAt: "09:15",
      endsAt: "10:00",
      publicReason: "",
      internalNote: "",
    });
    expect(nonexistentDate.success).toBe(false);
    expect(obsoleteTime.success).toBe(false);
  });

  it("rejects unknown scopes", () => {
    const result = blackoutFormSchema.safeParse({
      date: "2027-04-12",
      scope: "website",
      publicReason: "",
      internalNote: "",
    });
    expect(result.success).toBe(false);
  });

  it("allows only owner-supported external order sources", () => {
    const base = {
      date: "2027-04-12",
      customerReference: "Order 42",
      internalNote: null,
    };
    expect(
      capacityAdjustmentFormSchema.safeParse({ ...base, source: "instagram" })
        .success,
    ).toBe(true);
    expect(
      capacityAdjustmentFormSchema.safeParse({ ...base, source: "website" })
        .success,
    ).toBe(false);
  });
});
