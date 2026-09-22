import { describe, expect, it } from "vitest";

import {
  availabilityMonthSchema,
  checkoutDraftSummarySchema,
  fulfillmentSelectionSchema,
  localDateSchema,
} from "@/lib/fulfillment/schema";

const cart = {
  version: 1 as const,
  lines: [
    {
      productId: "20000000-0000-4000-8000-000000000001",
      variantId: null,
      optionSelections: [],
      quantity: 1,
    },
  ],
};

describe("fulfillment transport validation", () => {
  it("accepts leap day but rejects calendar dates that only match the shape", () => {
    expect(localDateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(localDateSchema.safeParse("2027-02-29").success).toBe(false);
    expect(localDateSchema.safeParse("2027-04-31").success).toBe(false);
  });

  it("rejects extra fields and malformed fulfillment selections", () => {
    expect(
      fulfillmentSelectionSchema.safeParse({
        cart,
        method: "delivery",
        date: "2027-04-12",
        priceCents: 1,
      }).success,
    ).toBe(false);
    expect(
      fulfillmentSelectionSchema.safeParse({
        cart,
        method: "courier",
        date: "2027-04-12",
      }).success,
    ).toBe(false);
  });

  it("accepts a date-only checkout draft summary", () => {
    expect(
      checkoutDraftSummarySchema.safeParse({
        method: "delivery",
        date: "2027-04-12",
        dateLabel: "Monday, April 12, 2027",
        status: "ready_for_details",
        expiresAt: "2027-04-12T13:00:00+00:00",
      }).success,
    ).toBe(true);
  });

  it("rejects customer availability payloads containing private or unknown fields", () => {
    const day = {
      date: "2027-04-12",
      label: "Monday, April 12, 2027",
      dayNumber: 12,
      isoWeekday: 1,
      selectable: false,
      reason: { code: "blackout", message: "Temporarily unavailable" },
      internalNote: "Private origin information",
    };
    expect(
      availabilityMonthSchema.safeParse({
        asOf: "2027-02-12T12:00:00.000Z",
        timeZone: "America/Toronto",
        method: "delivery",
        minimumNoticeDays: 4,
        month: "2027-04",
        monthLabel: "April 2027",
        minimumDate: "2027-02-14",
        maximumDate: "2027-04-12",
        previousMonth: "2027-03",
        nextMonth: null,
        days: Array.from({ length: 30 }, (_, index) => ({
          ...day,
          date: `2027-04-${String(index + 1).padStart(2, "0")}`,
          dayNumber: index + 1,
        })),
      }).success,
    ).toBe(false);
  });
});
