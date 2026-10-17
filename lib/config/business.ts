export const BUSINESS_TIME_ZONE = "America/Toronto" as const;
export const BUSINESS_LOCALE = "en-CA" as const;
export const BUSINESS_CURRENCY = "CAD" as const;

export const businessConfig = Object.freeze({
  timeZone: BUSINESS_TIME_ZONE,
  locale: BUSINESS_LOCALE,
  currency: BUSINESS_CURRENCY,
});
