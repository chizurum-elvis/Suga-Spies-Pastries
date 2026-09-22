import { describe, expect, it } from "vitest";

import {
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessTime,
  formatCurrency,
} from "@/lib/i18n/format";

describe("Canadian business formatting", () => {
  it("formats CAD with stable cents and separators", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(-42.75)).toBe("-$42.75");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite currency value %s",
    (amount) => {
      expect(() => formatCurrency(amount)).toThrow(RangeError);
    },
  );

  it("uses Toronto time across the daylight-saving spring transition", () => {
    expect(formatBusinessTime("2026-03-08T06:30:00.000Z")).toBe("1:30 a.m.");
    expect(formatBusinessTime("2026-03-08T07:30:00.000Z")).toBe("3:30 a.m.");
    expect(formatBusinessDateTime("2026-03-08T06:30:00.000Z")).toContain("EST");
    expect(formatBusinessDateTime("2026-03-08T07:30:00.000Z")).toContain("EDT");
  });

  it("does not use the machine date near Toronto midnight", () => {
    expect(formatBusinessDate("2026-12-25T04:30:00.000Z")).toBe(
      "Thu, Dec 24, 2026",
    );
  });

  it.each(["", "not-a-date", new Date(Number.NaN)])(
    "rejects invalid date input",
    (value) => {
      expect(() => formatBusinessDate(value)).toThrow(RangeError);
    },
  );

  it("does not mutate Date instances", () => {
    const date = new Date("2026-11-07T20:30:00.000Z");
    const originalTime = date.getTime();

    formatBusinessDateTime(date);

    expect(date.getTime()).toBe(originalTime);
  });
});
