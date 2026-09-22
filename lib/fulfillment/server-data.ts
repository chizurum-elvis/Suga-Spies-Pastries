import "server-only";

import {
  buildAvailabilityMonth,
  parseLocalMonth,
  validateDateSelection,
} from "@/lib/fulfillment/rules";
import type {
  AvailabilityMonth,
  FulfillmentBlackout,
  FulfillmentHours,
  FulfillmentMethod,
  FulfillmentSettings,
} from "@/lib/fulfillment/types";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";

export class FulfillmentDataError extends Error {
  constructor(message = "Fulfillment availability could not be loaded.") {
    super(message);
    this.name = "FulfillmentDataError";
  }
}

function monthBounds(month: string) {
  const parts = parseLocalMonth(month);
  if (!parts) throw new FulfillmentDataError("Choose a valid calendar month.");
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return {
    first: `${month}-01`,
    last: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function requireResult<T>(
  data: T | null,
  error: { message: string } | null,
): T {
  if (error || data === null) throw new FulfillmentDataError();
  return data;
}

export async function getAvailabilityMonth(input: {
  method: FulfillmentMethod;
  month: string;
  now?: Date;
}): Promise<AvailabilityMonth> {
  const now = input.now ?? new Date();
  const bounds = monthBounds(input.month);
  const supabase = createSecretSupabaseClient();

  const [
    settingsResult,
    hoursResult,
    blackoutsResult,
    adjustmentsResult,
    holdsResult,
  ] = await Promise.all([
    supabase
      .from("fulfillment_settings")
      .select("*")
      .eq("singleton", true)
      .single(),
    supabase.from("fulfillment_hours").select("*").eq("is_enabled", true),
    supabase
      .from("fulfillment_blackouts")
      .select("id, fulfillment_date, scope, public_reason")
      .gte("fulfillment_date", bounds.first)
      .lte("fulfillment_date", bounds.last),
    supabase
      .from("capacity_adjustments")
      .select("fulfillment_date")
      .eq("status", "active")
      .gte("fulfillment_date", bounds.first)
      .lte("fulfillment_date", bounds.last),
    supabase
      .from("capacity_holds")
      .select("fulfillment_date")
      .eq("status", "active")
      .or(`expires_at.gt.${now.toISOString()},payment_pending.eq.true`)
      .gte("fulfillment_date", bounds.first)
      .lte("fulfillment_date", bounds.last),
  ]);

  const settingsRow = requireResult(settingsResult.data, settingsResult.error);
  const hourRows = requireResult(hoursResult.data, hoursResult.error);
  const blackoutRows = requireResult(
    blackoutsResult.data,
    blackoutsResult.error,
  );
  const adjustmentRows = requireResult(
    adjustmentsResult.data,
    adjustmentsResult.error,
  );
  const holdRows = requireResult(holdsResult.data, holdsResult.error);

  const settings: FulfillmentSettings = {
    timeZone: settingsRow.business_timezone,
    minimumNoticeDays: settingsRow.minimum_notice_days,
    bookingHorizonMonths: settingsRow.booking_horizon_months,
    dailyCapacity: settingsRow.daily_capacity,
    holdMinutes: settingsRow.hold_minutes,
  };
  const hours: FulfillmentHours[] = hourRows.map((row) => ({
    method: row.fulfillment_method,
    isoWeekday: row.iso_weekday,
    isEnabled: row.is_enabled,
  }));
  const blackouts: FulfillmentBlackout[] = blackoutRows.map((row) => ({
    id: row.id,
    date: row.fulfillment_date,
    scope: row.scope,
    publicReason: row.public_reason,
  }));
  const consumedCapacityByDate = new Map<string, number>();
  for (const row of [...adjustmentRows, ...holdRows]) {
    consumedCapacityByDate.set(
      row.fulfillment_date,
      (consumedCapacityByDate.get(row.fulfillment_date) ?? 0) + 1,
    );
  }

  return buildAvailabilityMonth({
    month: input.month,
    method: input.method,
    now,
    settings,
    hours,
    blackouts,
    consumedCapacityByDate,
  });
}

export async function validateFulfillmentSelection(input: {
  method: FulfillmentMethod;
  date: string;
  now?: Date;
}) {
  const availability = await getAvailabilityMonth({
    method: input.method,
    month: input.date.slice(0, 7),
    now: input.now,
  });
  return {
    availability,
    issue: validateDateSelection(availability, input.date),
  };
}
