import "server-only";

import {
  parseSupabasePublicConfiguration,
  type SupabasePublicConfiguration,
} from "@/lib/supabase/configuration";

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase public configuration is missing or invalid.");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabaseConfigurationState() {
  return parseSupabasePublicConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function requireSupabaseConfiguration(): SupabasePublicConfiguration {
  const configuration = getSupabaseConfigurationState();

  if (configuration.status !== "configured") {
    throw new SupabaseConfigurationError();
  }

  return configuration.value;
}
