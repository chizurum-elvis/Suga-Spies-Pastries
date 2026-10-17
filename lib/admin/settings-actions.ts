"use server";
import { revalidatePath } from "next/cache";
import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  businessSettingsSchema,
  type SettingsActionState,
} from "@/lib/admin/settings-schema";

export async function saveBusinessSettings(
  _state: SettingsActionState,
  form: FormData,
): Promise<SettingsActionState> {
  const parsed = businessSettingsSchema.safeParse({
    version: form.get("version"),
    acceptingOrders: form.get("acceptingOrders") === "on",
    pauseMessage: form.get("pauseMessage"),
    ownerAlertEmail: form.get("ownerAlertEmail"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Enter a valid email and a pause message of 10–240 characters.",
    };
  const db = await createServerSupabaseClient();
  if ((await resolveOwnerAccess(db)).status !== "authorized")
    return {
      status: "error",
      message: "Please sign in again to save settings.",
    };
  const { data, error } = await db
    .from("business_settings")
    .update({
      accepting_orders: parsed.data.acceptingOrders,
      pause_message: parsed.data.pauseMessage,
      owner_alert_email: parsed.data.ownerAlertEmail || null,
    })
    .eq("singleton", true)
    .eq("version", parsed.data.version)
    .select("version")
    .maybeSingle();
  if (error)
    return {
      status: "error",
      message: "Settings could not be saved. Please retry.",
    };
  if (!data)
    return {
      status: "error",
      message: "Settings changed in another tab. Refresh before saving.",
    };
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/");
  return {
    status: "success",
    message: parsed.data.acceptingOrders
      ? "Settings saved. New orders are enabled, subject to payment readiness."
      : "New orders paused. Existing orders, payments, and refunds will continue.",
  };
}
