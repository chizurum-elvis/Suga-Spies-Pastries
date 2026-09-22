import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseConfiguration } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export function createPublicSupabaseClient() {
  const configuration = requireSupabaseConfiguration();

  return createClient<Database>(
    configuration.url,
    configuration.publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
