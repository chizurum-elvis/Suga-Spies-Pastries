import "server-only";

import {
  addCalendarDays,
  addCalendarMonths,
  formatLocalDateLabel,
  getTorontoLocalDate,
} from "@/lib/fulfillment/rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminBlackout = {
  id: string;
  date: string;
  dateLabel: string;
  scope: "delivery";
  publicReason: string | null;
  internalNote: string | null;
  version: number;
};

export type AdminCapacityAdjustment = {
  id: string;
  date: string;
  dateLabel: string;
  source: "phone" | "instagram" | "admin" | "other" | "website";
  customerReference: string | null;
  internalNote: string | null;
};

export type AdminCapacityDay = {
  date: string;
  dateLabel: string;
  manualOrders: number;
  confirmedWebsiteOrders: number;
  activeHolds: number;
  consumed: number;
  remaining: number;
  blackoutCount: number;
};

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error || data === null)
    throw new Error("Availability data could not be loaded.");
  return data;
}

export async function getAdminFulfillmentData(now: Date = new Date()) {
  const today = getTorontoLocalDate(now);
  const maximumDate = addCalendarMonths(today, 2);
  const supabase = await createServerSupabaseClient();
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
    supabase
      .from("fulfillment_hours")
      .select("*")
      .order("fulfillment_method")
      .order("iso_weekday"),
    supabase
      .from("fulfillment_blackouts")
      .select("*")
      .gte("fulfillment_date", today)
      .lte("fulfillment_date", maximumDate)
      .order("fulfillment_date"),
    supabase
      .from("capacity_adjustments")
      .select("*")
      .eq("status", "active")
      .gte("fulfillment_date", today)
      .lte("fulfillment_date", maximumDate)
      .order("fulfillment_date")
      .order("created_at"),
    supabase
      .from("capacity_holds")
      .select("id, fulfillment_date, expires_at")
      .eq("status", "active")
      .or(`expires_at.gt.${now.toISOString()},payment_pending.eq.true`)
      .gte("fulfillment_date", today)
      .lte("fulfillment_date", maximumDate),
  ]);
  const settings = requireData(settingsResult.data, settingsResult.error);
  const hours = requireData(hoursResult.data, hoursResult.error);
  const blackoutRows = requireData(blackoutsResult.data, blackoutsResult.error);
  const adjustmentRows = requireData(
    adjustmentsResult.data,
    adjustmentsResult.error,
  );
  const holdRows = requireData(holdsResult.data, holdsResult.error);
  const blackouts: AdminBlackout[] = blackoutRows.map((row) => ({
    id: row.id,
    date: row.fulfillment_date,
    dateLabel: formatLocalDateLabel(row.fulfillment_date),
    scope: row.scope,
    publicReason: row.public_reason,
    internalNote: row.internal_note,
    version: row.version,
  }));
  const adjustments: AdminCapacityAdjustment[] = adjustmentRows.map((row) => ({
    id: row.id,
    date: row.fulfillment_date,
    dateLabel: formatLocalDateLabel(row.fulfillment_date),
    source: row.source,
    customerReference: row.customer_reference,
    internalNote: row.internal_note,
  }));
  const days: AdminCapacityDay[] = Array.from({ length: 14 }, (_, index) => {
    const date = addCalendarDays(today, index);
    const dateAdjustments = adjustmentRows.filter(
      (row) => row.fulfillment_date === date,
    );
    const manualOrders = dateAdjustments.filter(
      (row) => row.source !== "website",
    ).length;
    const confirmedWebsiteOrders = dateAdjustments.length - manualOrders;
    const activeHolds = holdRows.filter(
      (row) => row.fulfillment_date === date,
    ).length;
    const consumed = manualOrders + confirmedWebsiteOrders + activeHolds;
    return {
      date,
      dateLabel: formatLocalDateLabel(date),
      manualOrders,
      confirmedWebsiteOrders,
      activeHolds,
      consumed,
      remaining: Math.max(0, settings.daily_capacity - consumed),
      blackoutCount: blackoutRows.filter((row) => row.fulfillment_date === date)
        .length,
    };
  });

  return {
    today,
    maximumDate,
    settings: {
      timeZone: settings.business_timezone,
      minimumNoticeDays: settings.minimum_notice_days,
      bookingHorizonMonths: settings.booking_horizon_months,
      dailyCapacity: settings.daily_capacity,
      holdMinutes: settings.hold_minutes,
    },
    hours: hours.map((row) => ({
      id: row.id,
      method: row.fulfillment_method,
      isoWeekday: row.iso_weekday,
      isEnabled: row.is_enabled,
    })),
    blackouts,
    adjustments,
    days,
  };
}
