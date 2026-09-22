export type FulfillmentMethod = "delivery";
export type BlackoutScope = FulfillmentMethod;

export type FulfillmentSettings = {
  timeZone: "America/Toronto";
  minimumNoticeDays: number;
  bookingHorizonMonths: number;
  dailyCapacity: number;
  holdMinutes: number;
};

export type FulfillmentHours = {
  method: FulfillmentMethod;
  isoWeekday: number;
  isEnabled: boolean;
};

export type FulfillmentBlackout = {
  id: string;
  date: string;
  scope: BlackoutScope;
  publicReason: string | null;
};

export type AvailabilityReasonCode =
  | "insufficient_notice"
  | "beyond_horizon"
  | "closed_holiday"
  | "closed_weekday"
  | "blackout"
  | "fully_booked";

export type AvailabilityReason = {
  code: AvailabilityReasonCode;
  message: string;
};

export type AvailabilityDay = {
  date: string;
  label: string;
  dayNumber: number;
  isoWeekday: number;
  selectable: boolean;
  reason: AvailabilityReason | null;
};

export type AvailabilityMonth = {
  asOf: string;
  timeZone: "America/Toronto";
  method: FulfillmentMethod;
  minimumNoticeDays: number;
  month: string;
  monthLabel: string;
  minimumDate: string;
  maximumDate: string;
  previousMonth: string | null;
  nextMonth: string | null;
  days: AvailabilityDay[];
};

export type CheckoutDraftSummary = {
  method: FulfillmentMethod;
  date: string;
  dateLabel: string;
  status: "ready_for_details";
  expiresAt: string;
};
