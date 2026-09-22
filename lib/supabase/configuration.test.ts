import { describe, expect, it } from "vitest";

import { parseSupabasePublicConfiguration } from "@/lib/supabase/configuration";

describe("Supabase public configuration", () => {
  it("treats two absent values as a deliberately disconnected integration", () => {
    expect(parseSupabasePublicConfiguration({})).toEqual({
      status: "missing",
    });
  });

  it.each([
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    },
    {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "legacy-anon-key",
    },
  ])("fails closed for incomplete or malformed values", (environment) => {
    expect(parseSupabasePublicConfiguration(environment).status).toBe(
      "invalid",
    );
  });

  it("trims and returns a complete current-key configuration", () => {
    expect(
      parseSupabasePublicConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_example ",
      }),
    ).toEqual({
      status: "configured",
      value: {
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_example",
      },
    });
  });
});
