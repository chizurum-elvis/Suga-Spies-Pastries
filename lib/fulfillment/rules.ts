import { TZDate } from "@date-fns/tz";

import { BUSINESS_LOCALE, BUSINESS_TIME_ZONE } from "@/lib/config/business";
import type {
  AvailabilityDay,
  AvailabilityMonth,
  AvailabilityReason,
  AvailabilityReasonCode,
  FulfillmentBlackout,
  FulfillmentHours,
  FulfillmentMethod,
  FulfillmentSettings,
} from "@/lib/fulfillment/types";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const reasonMessages: Record<AvailabilityReasonCode, string> = {
  insufficient_notice: "This date does not meet the minimum notice period.",
  beyond_horizon: "This date is outside the current booking period.",
  closed_holiday: "We are closed on December 25.",
  closed_weekday: "We are closed on this day.",
  blackout: "This date is temporarily unavailable.",
  fully_booked: "This date is fully booked.",
};

type LocalDateParts = { year: number; month: number; day: number };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function parseLocalDate(value: string): LocalDateParts | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function parseLocalMonth(value: string) {
  const match = ISO_MONTH_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function fromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addCalendarDays(localDate: string, amount: number) {
  const parts = parseLocalDate(localDate);
  if (!parts) throw new Error("Invalid local date.");
  return fromUtcDate(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount)),
  );
}

export function addCalendarMonths(localDate: string, amount: number) {
  const parts = parseLocalDate(localDate);
  if (!parts) throw new Error("Invalid local date.");
  const targetMonthStart = new Date(
    Date.UTC(parts.year, parts.month - 1 + amount, 1),
  );
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return fromUtcDate(
    new Date(Date.UTC(targetYear, targetMonth, Math.min(parts.day, lastDay))),
  );
}

export function getTorontoLocalDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function getIsoWeekday(localDate: string) {
  const parts = parseLocalDate(localDate);
  if (!parts) throw new Error("Invalid local date.");
  const weekday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function getMonthForDate(localDate: string) {
  const parts = parseLocalDate(localDate);
  if (!parts) throw new Error("Invalid local date.");
  return `${parts.year}-${pad(parts.month)}`;
}

export function shiftMonth(month: string, amount: number) {
  const parts = parseLocalMonth(month);
  if (!parts) throw new Error("Invalid local month.");
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

export function localDateStartInstant(date: string) {
  const dateParts = parseLocalDate(date);
  if (!dateParts) throw new Error("Invalid delivery date.");
  return new Date(
    new TZDate(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      0,
      0,
      0,
      0,
      BUSINESS_TIME_ZONE,
    ).getTime(),
  );
}

export function deliveryCancellationDeadline(date: string) {
  return localDateStartInstant(addCalendarDays(date, -1));
}

export function formatLocalDateLabel(date: string) {
  const parts = parseLocalDate(date);
  if (!parts) return date;
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)));
}

function reason(
  code: AvailabilityReasonCode,
  message?: string | null,
): AvailabilityReason {
  return { code, message: message?.trim() || reasonMessages[code] };
}

function minimumNoticeMessage(days: number) {
  return `This date needs at least ${days} ${days === 1 ? "day" : "days"}’ notice.`;
}

export function getDateLevelReason(input: {
  date: string;
  method: FulfillmentMethod;
  now: Date;
  settings: FulfillmentSettings;
  hours: readonly FulfillmentHours[];
  blackouts: readonly FulfillmentBlackout[];
  consumedCapacity: number;
}): AvailabilityReason | null {
  const today = getTorontoLocalDate(input.now);
  if (input.date < addCalendarDays(today, input.settings.minimumNoticeDays)) {
    return reason(
      "insufficient_notice",
      minimumNoticeMessage(input.settings.minimumNoticeDays),
    );
  }
  if (
    input.date > addCalendarMonths(today, input.settings.bookingHorizonMonths)
  ) {
    return reason("beyond_horizon");
  }
  const dateParts = parseLocalDate(input.date);
  if (!dateParts) return reason("beyond_horizon");
  if (dateParts.month === 12 && dateParts.day === 25) {
    return reason("closed_holiday");
  }
  const schedule = input.hours.find(
    (entry) =>
      entry.method === input.method &&
      entry.isoWeekday === getIsoWeekday(input.date) &&
      entry.isEnabled,
  );
  if (!schedule) return reason("closed_weekday");
  const blackout = input.blackouts.find(
    (blackout) =>
      blackout.date === input.date && blackout.scope === input.method,
  );
  if (blackout) return reason("blackout", blackout.publicReason);
  if (input.consumedCapacity >= input.settings.dailyCapacity) {
    return reason("fully_booked");
  }
  return null;
}

function daysInMonth(month: string) {
  const parts = parseLocalMonth(month);
  if (!parts) throw new Error("Invalid local month.");
  return new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
}

export function buildAvailabilityMonth(input: {
  month: string;
  method: FulfillmentMethod;
  now: Date;
  settings: FulfillmentSettings;
  hours: readonly FulfillmentHours[];
  blackouts: readonly FulfillmentBlackout[];
  consumedCapacityByDate: ReadonlyMap<string, number>;
}): AvailabilityMonth {
  const monthParts = parseLocalMonth(input.month);
  if (!monthParts) throw new Error("Invalid local month.");
  const today = getTorontoLocalDate(input.now);
  const minimumDate = addCalendarDays(today, input.settings.minimumNoticeDays);
  const maximumDate = addCalendarMonths(
    today,
    input.settings.bookingHorizonMonths,
  );
  const minimumMonth = getMonthForDate(today);
  const maximumMonth = getMonthForDate(maximumDate);
  if (input.month < minimumMonth || input.month > maximumMonth) {
    throw new Error("Month is outside the booking period.");
  }

  const days: AvailabilityDay[] = Array.from(
    { length: daysInMonth(input.month) },
    (_, index) => {
      const date = `${input.month}-${pad(index + 1)}`;
      const dateReason = getDateLevelReason({
        date,
        method: input.method,
        now: input.now,
        settings: input.settings,
        hours: input.hours,
        blackouts: input.blackouts,
        consumedCapacity: input.consumedCapacityByDate.get(date) ?? 0,
      });
      return {
        date,
        label: formatLocalDateLabel(date),
        dayNumber: index + 1,
        isoWeekday: getIsoWeekday(date),
        selectable: !dateReason,
        reason: dateReason,
      };
    },
  );

  const monthDate = new Date(
    Date.UTC(monthParts.year, monthParts.month - 1, 1, 12),
  );
  const previous = shiftMonth(input.month, -1);
  const next = shiftMonth(input.month, 1);
  return {
    asOf: input.now.toISOString(),
    timeZone: BUSINESS_TIME_ZONE,
    method: input.method,
    minimumNoticeDays: input.settings.minimumNoticeDays,
    month: input.month,
    monthLabel: new Intl.DateTimeFormat(BUSINESS_LOCALE, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(monthDate),
    minimumDate,
    maximumDate,
    previousMonth: previous >= minimumMonth ? previous : null,
    nextMonth: next <= maximumMonth ? next : null,
    days,
  };
}

export function validateDateSelection(
  availability: AvailabilityMonth,
  date: string,
) {
  const day = availability.days.find((entry) => entry.date === date);
  if (!day?.selectable) {
    return day?.reason ?? reason("closed_weekday");
  }
  return null;
}
