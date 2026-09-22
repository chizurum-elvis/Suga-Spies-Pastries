"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import type { FulfillmentActionState } from "@/lib/fulfillment/action-state";
import {
  blackoutFormSchema,
  blackoutIdentitySchema,
  capacityAdjustmentFormSchema,
  capacityAdjustmentIdentitySchema,
} from "@/lib/fulfillment/admin-validation";
import {
  addCalendarMonths,
  getTorontoLocalDate,
} from "@/lib/fulfillment/rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function state(
  status: "error" | "success",
  message: string,
): FulfillmentActionState {
  return { status, message, submissionId: randomUUID() };
}

async function authorizedClient() {
  const supabase = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(supabase);
  return access.status === "authorized"
    ? { supabase, owner: access.owner }
    : null;
}

function refreshAvailability() {
  revalidatePath("/admin");
  revalidatePath("/admin/availability");
  revalidatePath("/checkout/fulfillment");
}

async function activeCommitmentsForDate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  date: string,
) {
  const now = new Date().toISOString();
  const [orders, holds] = await Promise.all([
    supabase
      .from("capacity_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("fulfillment_date", date)
      .eq("status", "active"),
    supabase
      .from("capacity_holds")
      .select("id", { count: "exact", head: true })
      .eq("fulfillment_date", date)
      .eq("status", "active")
      .or(`expires_at.gt.${now},payment_pending.eq.true`),
  ]);
  if (orders.error || holds.error) return 0;
  return (orders.count ?? 0) + (holds.count ?? 0);
}

function blackoutSavedMessage(
  commitments: number,
  action: "created" | "updated",
) {
  if (commitments === 0) {
    return action === "created"
      ? "The blackout is now applied to customer availability."
      : "Blackout updated.";
  }
  return `Blackout ${action}. This date already has ${commitments} active ${commitments === 1 ? "order or payment hold" : "orders or payment holds"}; existing commitments remain valid.`;
}

function safeDatabaseMessage(error: { code?: string; message: string }) {
  if (error.message.includes("four-order capacity")) {
    return "That date already uses all four order spaces.";
  }
  if (error.code === "23514")
    return "One of the scheduling values is outside the allowed range.";
  if (error.code === "23505") return "This scheduling entry already exists.";
  return "The availability change could not be saved. Please try again.";
}

function blackoutInput(formData: FormData) {
  return {
    id: formData.get("id") ?? undefined,
    version: formData.get("version") ?? undefined,
    date: formData.get("date"),
    scope: formData.get("scope"),
    publicReason: formData.get("publicReason"),
    internalNote: formData.get("internalNote"),
  };
}

function dateAllowed(date: string) {
  const today = getTorontoLocalDate();
  return date >= today && date <= addCalendarMonths(today, 2);
}

export async function createBlackout(
  _previous: FulfillmentActionState,
  formData: FormData,
): Promise<FulfillmentActionState> {
  const parsed = blackoutFormSchema.safeParse(blackoutInput(formData));
  if (!parsed.success || !dateAllowed(parsed.data.date)) {
    return state("error", "Choose a valid future delivery date.");
  }
  const access = await authorizedClient();
  if (!access)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await access.supabase.from("fulfillment_blackouts").insert({
    fulfillment_date: parsed.data.date,
    scope: parsed.data.scope,
    public_reason: parsed.data.publicReason,
    internal_note: parsed.data.internalNote,
    created_by: access.owner.id,
  });
  if (result.error) return state("error", safeDatabaseMessage(result.error));
  const commitments = await activeCommitmentsForDate(
    access.supabase,
    parsed.data.date,
  );
  refreshAvailability();
  return state("success", blackoutSavedMessage(commitments, "created"));
}

export async function updateBlackout(
  _previous: FulfillmentActionState,
  formData: FormData,
): Promise<FulfillmentActionState> {
  const parsed = blackoutFormSchema.safeParse(blackoutInput(formData));
  if (
    !parsed.success ||
    !parsed.data.id ||
    !parsed.data.version ||
    !dateAllowed(parsed.data.date)
  ) {
    return state("error", "Choose a valid future delivery date.");
  }
  const access = await authorizedClient();
  if (!access)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await access.supabase
    .from("fulfillment_blackouts")
    .update({
      fulfillment_date: parsed.data.date,
      scope: parsed.data.scope,
      public_reason: parsed.data.publicReason,
      internal_note: parsed.data.internalNote,
    })
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id")
    .maybeSingle();
  if (result.error) return state("error", safeDatabaseMessage(result.error));
  if (!result.data)
    return state(
      "error",
      "This blackout changed in another tab. Refresh before editing it.",
    );
  const commitments = await activeCommitmentsForDate(
    access.supabase,
    parsed.data.date,
  );
  refreshAvailability();
  return state("success", blackoutSavedMessage(commitments, "updated"));
}

export async function deleteBlackout(
  _previous: FulfillmentActionState,
  formData: FormData,
): Promise<FulfillmentActionState> {
  const parsed = blackoutIdentitySchema.safeParse({
    id: formData.get("id"),
    version: formData.get("version"),
  });
  if (!parsed.success)
    return state("error", "The blackout could not be identified.");
  const access = await authorizedClient();
  if (!access)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await access.supabase
    .from("fulfillment_blackouts")
    .delete()
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id")
    .maybeSingle();
  if (result.error) return state("error", safeDatabaseMessage(result.error));
  if (!result.data)
    return state(
      "error",
      "This blackout changed or was already removed. Refresh the page.",
    );
  refreshAvailability();
  return state(
    "success",
    "Blackout removed. Customers can use the normal schedule again.",
  );
}

export async function createCapacityAdjustment(
  _previous: FulfillmentActionState,
  formData: FormData,
): Promise<FulfillmentActionState> {
  const parsed = capacityAdjustmentFormSchema.safeParse({
    date: formData.get("date"),
    source: formData.get("source"),
    customerReference: formData.get("customerReference"),
    internalNote: formData.get("internalNote"),
  });
  if (!parsed.success || !dateAllowed(parsed.data.date)) {
    return state(
      "error",
      "Choose a valid future fulfillment date and order source.",
    );
  }
  const access = await authorizedClient();
  if (!access)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await access.supabase.from("capacity_adjustments").insert({
    fulfillment_date: parsed.data.date,
    source: parsed.data.source,
    customer_reference: parsed.data.customerReference,
    internal_note: parsed.data.internalNote,
    created_by: access.owner.id,
  });
  if (result.error) return state("error", safeDatabaseMessage(result.error));
  refreshAvailability();
  return state(
    "success",
    "The external order now uses one of the four daily spaces.",
  );
}

export async function releaseCapacityAdjustment(
  _previous: FulfillmentActionState,
  formData: FormData,
): Promise<FulfillmentActionState> {
  const parsed = capacityAdjustmentIdentitySchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success)
    return state("error", "The capacity entry could not be identified.");
  const access = await authorizedClient();
  if (!access)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await access.supabase
    .from("capacity_adjustments")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("status", "active")
    .neq("source", "website")
    .select("id")
    .maybeSingle();
  if (result.error) return state("error", safeDatabaseMessage(result.error));
  if (!result.data)
    return state(
      "error",
      "This capacity entry was already released. Refresh the page.",
    );
  refreshAvailability();
  return state("success", "The daily order space has been released.");
}
