"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deliveryPricingSchema } from "@/lib/delivery/schema";
import type { FulfillmentActionState } from "@/lib/fulfillment/action-state";

function decimalToInteger(value: FormDataEntryValue | null, scale: number) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value))
    return NaN;
  return Math.round(Number(value) * scale);
}
export async function updateDeliveryPricing(
  _previous: FulfillmentActionState,
  form: FormData,
): Promise<FulfillmentActionState> {
  const state = (status: "success" | "error", message: string) => ({
    status,
    message,
    submissionId: randomUUID(),
  });
  const db = await createServerSupabaseClient();
  if ((await resolveOwnerAccess(db)).status !== "authorized")
    return state("error", "Sign in as the owner to change delivery pricing.");
  const version = Number(form.get("version"));
  const parsed = deliveryPricingSchema.safeParse({
    base_distance_meters: decimalToInteger(form.get("baseDistance"), 1000),
    maximum_distance_meters: decimalToInteger(
      form.get("maximumDistance"),
      1000,
    ),
    base_fee_cents: decimalToInteger(form.get("baseFee"), 100),
    extra_km_fee_cents: decimalToInteger(form.get("extraFee"), 100),
    free_delivery_threshold_cents: decimalToInteger(
      form.get("freeThreshold"),
      100,
    ),
  });
  if (!parsed.success || !Number.isSafeInteger(version) || version < 1)
    return state(
      "error",
      "Check the amounts and distances. The delivery limit must be no more than 30 km and no smaller than the base distance.",
    );
  const { data, error } = await db
    .from("delivery_settings")
    .update(parsed.data)
    .eq("singleton", true)
    .eq("version", version)
    .select("version")
    .maybeSingle();
  if (error)
    return state("error", "Delivery pricing could not be saved. Please retry.");
  if (!data)
    return state(
      "error",
      "Delivery pricing changed in another tab. Refresh before editing it.",
    );
  revalidatePath("/admin/delivery");
  return state(
    "success",
    "Delivery pricing saved. Customers with older quotes must review the updated fee before continuing.",
  );
}
