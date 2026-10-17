import "server-only";
import { cache } from "react";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";

// Private server-side configuration, not a browser-readable settings endpoint.
export const getOperationalSettings = cache(async () => {
  const { data, error } = await createSecretSupabaseClient()
    .from("business_settings")
    .select("accepting_orders,pause_message,owner_alert_email")
    .eq("singleton", true)
    .abortSignal(AbortSignal.timeout(8_000))
    .single();
  if (error || !data)
    throw new Error("Business settings are temporarily unavailable.");
  return data;
});
