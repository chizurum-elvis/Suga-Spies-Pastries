import { z } from "zod";

const supabasePublicConfigurationSchema = z.strictObject({
  url: z.url({
    protocol: /^https?$/,
    error: "Supabase URL must be a complete http:// or https:// URL.",
  }),
  publishableKey: z
    .string()
    .trim()
    .startsWith(
      "sb_publishable_",
      "Supabase publishable key must begin with sb_publishable_.",
    ),
});

export type SupabasePublicConfiguration = z.infer<
  typeof supabasePublicConfigurationSchema
>;

export type SupabaseConfigurationState =
  | { status: "configured"; value: SupabasePublicConfiguration }
  | { status: "missing" }
  | { status: "invalid" };

export function parseSupabasePublicConfiguration(environment: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}): SupabaseConfigurationState {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !publishableKey) {
    return { status: "missing" };
  }

  const result = supabasePublicConfigurationSchema.safeParse({
    url,
    publishableKey,
  });

  return result.success
    ? { status: "configured", value: result.data }
    : { status: "invalid" };
}
