import { addCalendarDays, getIsoWeekday } from "@/lib/fulfillment/rules";

export function adminCalendarStatus(input: {
  date: string;
  today: string;
  maximumDate: string;
  minimumNoticeDays: number;
  capacity: number;
  consumed: number;
  enabledWeekdays: readonly number[];
  blockedDates: readonly string[];
}) {
  const closure =
    input.date.slice(5) === "12-25"
      ? "Christmas Day"
      : !input.enabledWeekdays.includes(getIsoWeekday(input.date))
        ? "Weekly closure"
        : input.blockedDates.includes(input.date)
          ? "Blocked by owner"
          : input.consumed >= input.capacity
            ? "Fully booked"
            : null;
  return {
    closure,
    customerBookable:
      !closure &&
      input.date >= addCalendarDays(input.today, input.minimumNoticeDays) &&
      input.date <= input.maximumDate,
  };
}
