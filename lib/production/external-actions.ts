"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { DeliveryError } from "@/lib/delivery/errors";
import { createGoogleMapsProvider } from "@/lib/delivery/google-maps";
import { deliveryCity } from "@/lib/delivery/pricing";
import { getServerEnvironment } from "@/lib/env/server";
import { getTorontoLocalDate } from "@/lib/fulfillment/rules";
import { externalOrderInputSchema } from "@/lib/production/external-schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ExternalActionState = {
  status: "idle" | "error" | "success";
  message: string;
  submissionId: string;
  orderId?: string;
};

function state(
  status: "error" | "success",
  message: string,
  orderId?: string,
): ExternalActionState {
  return { status, message, submissionId: randomUUID(), orderId };
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/production");
  revalidatePath("/checkout/fulfillment");
}

function errorMessage(message: string) {
  if (message.includes("four-order capacity"))
    return "That date already has four orders or active payment holds.";
  if (message.includes("external_order_date_unavailable"))
    return "That date is closed or does not meet the booking notice.";
  if (message.includes("external_order_item_unavailable"))
    return "A pastry changed or its quantity is invalid. Refresh and review the menu.";
  if (message.includes("external_order_invalid_transition"))
    return "That stage cannot follow the current order stage. Refresh the page.";
  return "This external order could not be saved. Please check its details and try again.";
}

export async function createExternalOrder(
  _previous: ExternalActionState,
  form: FormData,
): Promise<ExternalActionState> {
  const productIds = form.getAll("productId");
  const quantities = form.getAll("quantity");
  const notes = form.getAll("itemNote");
  if (
    productIds.length !== quantities.length ||
    productIds.length !== notes.length
  ) {
    return state(
      "error",
      "Each pastry needs a valid quantity. Review the order and retry.",
    );
  }
  const parsed = externalOrderInputSchema.safeParse({
    date: form.get("date"),
    source: form.get("source"),
    customerName: form.get("customerName"),
    customerPhone: form.get("customerPhone"),
    customerEmail: form.get("customerEmail"),
    recipientName: form.get("recipientName"),
    addressLine1: form.get("addressLine1"),
    addressLine2: form.get("addressLine2"),
    city: form.get("city"),
    postalCode: form.get("postalCode"),
    deliveryInstructions: form.get("deliveryInstructions"),
    internalNote: form.get("internalNote"),
    confirmAddress: form.get("confirmAddress") === "on",
    items: productIds.map((productId, index) => ({
      productId,
      quantity: quantities[index],
      note: notes[index],
    })),
  });
  if (!parsed.success)
    return state(
      "error",
      "Check the customer, address, pastry quantities, and delivery date.",
    );
  const input = parsed.data;
  const today = getTorontoLocalDate();
  if (input.date < today)
    return state("error", "Choose a future delivery date.");

  const db = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(db);
  if (access.status !== "authorized")
    return state("error", "Your owner session expired. Sign in again.");

  // Owner-entered deliveries obey the same geographic limit as website orders.
  const { data: settings, error: settingsError } = await db
    .from("delivery_settings")
    .select("origin_address,allowed_cities,maximum_distance_meters")
    .eq("singleton", true)
    .single();
  if (settingsError || !settings)
    return state(
      "error",
      "Delivery settings are unavailable. Try again shortly.",
    );
  let checkedAddress: {
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
  };
  try {
    const provider = createGoogleMapsProvider(
      getServerEnvironment().GOOGLE_MAPS_SERVER_API_KEY,
    );
    const verified = await provider.validate({
      line1: input.addressLine1,
      line2: input.addressLine2 ?? "",
      city: input.city,
      province: "ON",
      postalCode: input.postalCode,
      country: "CA",
    });
    const city = deliveryCity(verified.address.city);
    if (!city || !settings.allowed_cities.includes(city))
      return state("error", "This address is outside the delivery cities.");
    const distance = await provider.distance(
      settings.origin_address,
      verified.placeId,
    );
    if (distance > settings.maximum_distance_meters)
      return state(
        "error",
        "This address is beyond the delivery distance limit.",
      );
    // A changed or approximate provider address needs owner review before acceptance.
    if (verified.requiresConfirmation && !input.confirmAddress)
      return state(
        "error",
        `Google suggests ${verified.address.line1}${verified.address.line2 ? `, ${verified.address.line2}` : ""}, ${verified.address.city}, ON ${verified.address.postalCode}. Review it and tick address confirmation before saving.`,
      );
    checkedAddress = verified.address;
  } catch (error) {
    if (
      error instanceof DeliveryError &&
      ["address_needs_fix", "address_unverified"].includes(error.code)
    )
      return state("error", error.message);
    return state(
      "error",
      "We could not verify this delivery address now. Please retry later.",
    );
  }

  const { data, error } = await db.rpc("create_external_order", {
    p_date: input.date,
    p_source: input.source,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail,
    p_recipient_name: input.recipientName,
    p_address_line1: checkedAddress.line1,
    p_address_line2: checkedAddress.line2,
    p_city: deliveryCity(checkedAddress.city) ?? input.city,
    p_postal_code: checkedAddress.postalCode,
    p_delivery_instructions: input.deliveryInstructions,
    p_items: input.items,
    p_internal_note: input.internalNote,
  });
  if (error || !data) return state("error", errorMessage(error?.message ?? ""));
  refresh();
  return state(
    "success",
    "External order recorded and one daily space reserved. Payment is not verified by the website.",
    data,
  );
}

export async function advanceExternalOrder(
  _previous: ExternalActionState,
  form: FormData,
): Promise<ExternalActionState> {
  const id = form.get("id");
  const version = Number(form.get("version"));
  const next = form.get("next");
  if (
    typeof id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    typeof next !== "string" ||
    ![
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ].includes(next)
  )
    return state("error", "The order action is invalid. Refresh the page.");
  const db = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(db);
  if (access.status !== "authorized")
    return state("error", "Your owner session expired. Sign in again.");
  const { data, error } = await db.rpc("advance_external_order", {
    p_id: id,
    p_version: version,
    p_next_status: next,
  });
  if (error) return state("error", errorMessage(error.message));
  if (!data)
    return state(
      "error",
      "This order changed in another tab. Refresh before updating it.",
    );
  refresh();
  revalidatePath(`/admin/external-orders/${id}`);
  return state(
    "success",
    next === "cancelled"
      ? "Order cancelled and its daily space released."
      : "Order stage updated.",
  );
}
