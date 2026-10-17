import "server-only";

import { z } from "zod";
import { deliveryInputSchema, type DeliveryInput } from "@/lib/delivery/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { CustomerIdentity } from "@/lib/customer/identity";

export const savedDetailsSchema = deliveryInputSchema
  .omit({ email: true })
  .refine(
    (value) =>
      ["Toronto", "Markham", "Mississauga"].includes(value.address.city),
    { path: ["address", "city"], message: "Choose a delivery city." },
  );

export type SavedDetails = z.infer<typeof savedDetailsSchema>;
export type CustomerProfile =
  Database["public"]["Tables"]["customer_profiles"]["Row"];

export async function getCustomerProfile(identity: CustomerIdentity) {
  const client = await createServerSupabaseClient();
  const result = await client
    .from("customer_profiles")
    .select("*")
    .eq("user_id", identity.id)
    .maybeSingle();
  if (result.error)
    throw new Error("Saved details are temporarily unavailable.");
  return result.data;
}

export function profileToDeliveryInput(
  profile: CustomerProfile,
  email: string,
): DeliveryInput {
  return deliveryInputSchema.parse({
    name: profile.full_name,
    email,
    phone: profile.phone,
    recipientName: profile.recipient_name,
    instructions: profile.delivery_instructions,
    address: {
      line1: profile.address_line1,
      line2: profile.address_line2,
      city: profile.city,
      province: profile.province,
      postalCode: profile.postal_code,
      country: profile.country,
    },
  });
}

export function profileValues(
  identity: CustomerIdentity,
  details: SavedDetails,
) {
  return {
    user_id: identity.id,
    full_name: details.name,
    phone: details.phone,
    recipient_name: details.recipientName,
    address_line1: details.address.line1,
    address_line2: details.address.line2,
    city: details.address.city as "Toronto" | "Markham" | "Mississauga",
    province: details.address.province,
    postal_code: details.address.postalCode,
    country: details.address.country,
    delivery_instructions: details.instructions,
    updated_at: new Date().toISOString(),
  };
}
