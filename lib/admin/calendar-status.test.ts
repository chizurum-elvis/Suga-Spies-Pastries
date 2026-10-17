import { describe, expect, it } from "vitest";
import { adminCalendarStatus } from "@/lib/admin/calendar-status";
const base = {
  date: "2026-10-22",
  today: "2026-10-17",
  maximumDate: "2026-12-17",
  minimumNoticeDays: 4,
  capacity: 4,
  consumed: 0,
  enabledWeekdays: [1, 2, 4, 5, 6],
  blockedDates: [] as string[],
};
describe("owner calendar presentation", () => {
  it("distinguishes free capacity from actual customer bookability", () => {
    expect(adminCalendarStatus({ ...base, date: "2026-10-19" })).toEqual({
      closure: null,
      customerBookable: false,
    });
  });
  it.each(["2026-10-21", "2026-10-25"])("marks weekly closures %s", (date) => {
    expect(adminCalendarStatus({ ...base, date })).toEqual({
      closure: "Weekly closure",
      customerBookable: false,
    });
  });
  it("marks Christmas closed even when the weekday is normally open", () => {
    expect(
      adminCalendarStatus({
        ...base,
        date: "2026-12-25",
        maximumDate: "2026-12-31",
      }).closure,
    ).toBe("Christmas Day");
  });
  it("shows a blocked date, not spare capacity", () => {
    expect(adminCalendarStatus({ ...base, blockedDates: [base.date] })).toEqual(
      { closure: "Blocked by owner", customerBookable: false },
    );
  });
  it.each([4, 5])(
    "does not offer a full day with %d consumed spaces",
    (consumed) => {
      expect(adminCalendarStatus({ ...base, consumed })).toEqual({
        closure: "Fully booked",
        customerBookable: false,
      });
    },
  );
  it("keeps the inclusive horizon and excludes the next day", () => {
    expect(
      adminCalendarStatus({ ...base, date: base.maximumDate }).customerBookable,
    ).toBe(true);
    expect(
      adminCalendarStatus({ ...base, date: "2026-12-18" }).customerBookable,
    ).toBe(false);
  });
  it("keeps the four-day notice across Toronto DST changes", () => {
    expect(
      adminCalendarStatus({ ...base, today: "2026-10-30", date: "2026-11-03" })
        .customerBookable,
    ).toBe(true);
  });
});
