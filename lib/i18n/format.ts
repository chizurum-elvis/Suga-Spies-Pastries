import {
  BUSINESS_CURRENCY,
  BUSINESS_LOCALE,
  BUSINESS_TIME_ZONE,
} from "@/lib/config/business";

type DateInput = Date | number | string;

const currencyFormatter = new Intl.NumberFormat(BUSINESS_LOCALE, {
  style: "currency",
  currency: BUSINESS_CURRENCY,
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

const dateTimeFormatter = new Intl.DateTimeFormat(BUSINESS_LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
  timeZoneName: "short",
});

function toValidDate(value: DateInput) {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(
      "A valid date is required for business-time formatting.",
    );
  }

  return date;
}

export function formatCurrency(amount: number) {
  if (!Number.isFinite(amount)) {
    throw new RangeError(
      "A finite amount is required for currency formatting.",
    );
  }

  return currencyFormatter.format(amount);
}

export function formatBusinessDate(value: DateInput) {
  return dateFormatter.format(toValidDate(value));
}

export function formatBusinessTime(value: DateInput) {
  return timeFormatter.format(toValidDate(value));
}

export function formatBusinessDateTime(value: DateInput) {
  return dateTimeFormatter.format(toValidDate(value));
}
