import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  buildAvailabilityMonth,
  deliveryCancellationDeadline,
  getTorontoLocalDate,
  localDateStartInstant,
  validateDateSelection,
} from "@/lib/fulfillment/rules";
import type {
  FulfillmentBlackout,
  FulfillmentHours,
  FulfillmentSettings,
} from "@/lib/fulfillment/types";

const settings: FulfillmentSettings = {
  timeZone: "America/Toronto",
  minimumNoticeDays: 4,
  bookingHorizonMonths: 2,
  dailyCapacity: 4,
  holdMinutes: 15,
};

const hours: FulfillmentHours[] = [1, 2, 4, 5, 6].map((isoWeekday) => ({
  method: "delivery",
  isoWeekday,
  isEnabled: true,
}));

const now = new Date("2026-09-01T02:00:00.000Z"); // August 31 at 10 p.m. in Toronto.

function month(
  blackouts: FulfillmentBlackout[] = [],
  capacity = new Map<string, number>(),
) {
  return buildAvailabilityMonth({
    month: "2026-09",
    method: "delivery",
    now,
    settings,
    hours,
    blackouts,
    consumedCapacityByDate: capacity,
  });
}

describe("Toronto date-only delivery rules", () => {
  it("uses Toronto's date instead of the server or customer date", () => {
    expect(getTorontoLocalDate(now)).toBe("2026-08-31");
  });

  it("clamps calendar-month arithmetic at month end and handles leap years", () => {
    expect(addCalendarMonths("2024-12-31", 2)).toBe("2025-02-28");
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("applies notice, Wednesday/Sunday closures, and the two-month horizon", () => {
    const result = month();
    expect(result.days[0]?.reason?.code).toBe("insufficient_notice");
    expect(result.days[0]?.reason?.message).toContain("4 days");
    expect(result.days[3]?.selectable).toBe(true);
    expect(
      result.days.find((day) => day.date === "2026-09-09")?.reason?.code,
    ).toBe("closed_weekday");
    expect(
      result.days.find((day) => day.date === "2026-09-06")?.reason?.code,
    ).toBe("closed_weekday");
    expect(result.maximumDate).toBe("2026-10-31");
  });

  it("allows an open date exactly four Toronto calendar days ahead", () => {
    const result = buildAvailabilityMonth({
      month: "2026-09",
      method: "delivery",
      now: new Date("2026-09-01T16:00:00.000Z"),
      settings,
      hours,
      blackouts: [],
      consumedCapacityByDate: new Map(),
    });
    expect(result.minimumDate).toBe("2026-09-05");
    expect(
      result.days.find((day) => day.date === "2026-09-05")?.selectable,
    ).toBe(true);
  });

  it("keeps the four-day boundary even when its first date is closed", () => {
    const result = buildAvailabilityMonth({
      month: "2026-09",
      method: "delivery",
      now: new Date("2026-09-16T16:00:00.000Z"),
      settings,
      hours,
      blackouts: [],
      consumedCapacityByDate: new Map(),
    });
    expect(result.minimumDate).toBe("2026-09-20");
    expect(
      result.days.find((day) => day.date === "2026-09-19")?.reason?.code,
    ).toBe("insufficient_notice");
    expect(
      result.days.find((day) => day.date === "2026-09-20")?.reason?.code,
    ).toBe("closed_weekday");
    expect(
      result.days.find((day) => day.date === "2026-09-21")?.selectable,
    ).toBe(true);
  });

  it("closes December 25 inside the booking horizon", () => {
    const result = buildAvailabilityMonth({
      month: "2026-12",
      method: "delivery",
      now: new Date("2026-10-25T16:00:00.000Z"),
      settings,
      hours,
      blackouts: [],
      consumedCapacityByDate: new Map(),
    });
    expect(
      result.days.find((day) => day.date === "2026-12-25")?.reason?.code,
    ).toBe("closed_holiday");
  });

  it("applies a full-day blackout without private scheduling fields", () => {
    const blackout: FulfillmentBlackout = {
      id: "10000000-0000-4000-8000-000000000002",
      date: "2026-09-07",
      scope: "delivery",
      publicReason: "Delivery paused",
    };
    expect(
      month([blackout]).days.find((day) => day.date === "2026-09-07"),
    ).toMatchObject({
      selectable: false,
      reason: { code: "blackout", message: "Delivery paused" },
    });
  });

  it("blocks a date at four shared orders but not at three", () => {
    const full = month([], new Map([["2026-09-07", 4]])).days.find(
      (day) => day.date === "2026-09-07",
    )!;
    const open = month([], new Map([["2026-09-08", 3]])).days.find(
      (day) => day.date === "2026-09-08",
    )!;
    expect(full.reason?.code).toBe("fully_booked");
    expect(open.selectable).toBe(true);
  });

  it("validates the exact server-returned date without any time input", () => {
    const availability = month();
    expect(validateDateSelection(availability, "2026-09-07")).toBeNull();
    expect(validateDateSelection(availability, "2026-09-09")?.code).toBe(
      "closed_weekday",
    );
  });

  it("uses Toronto midnight for date-only records across DST seasons", () => {
    expect(localDateStartInstant("2026-07-06").toISOString()).toBe(
      "2026-07-06T04:00:00.000Z",
    );
    expect(localDateStartInstant("2026-12-07").toISOString()).toBe(
      "2026-12-07T05:00:00.000Z",
    );
  });

  it("sets the cancellation cutoff to Toronto midnight one day earlier", () => {
    expect(deliveryCancellationDeadline("2026-11-02").toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
  });
});
