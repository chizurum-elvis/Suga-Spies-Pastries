import { describe, expect, it } from "vitest";

import {
  findPublicSecretNames,
  publicEnvironmentSchema,
  serverEnvironmentSchema,
} from "@/lib/env/schema";

describe("environment contract", () => {
  it("provides a safe local URL while integrations are disconnected", () => {
    const result = publicEnvironmentSchema.parse({ APP_ENV: "local" });

    expect(result.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("normalizes empty example-file values as absent", () => {
    const result = serverEnvironmentSchema.parse({
      APP_ENV: "local",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "  ",
      SUPABASE_SECRET_KEY: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
    });

    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(result.SUPABASE_SECRET_KEY).toBeUndefined();
  });

  it.each(["staging", "production"] as const)(
    "requires an HTTPS public URL for %s",
    (appEnvironment) => {
      expect(() =>
        publicEnvironmentSchema.parse({
          APP_ENV: appEnvironment,
          NEXT_PUBLIC_SITE_URL: "http://example.com",
        }),
      ).toThrow(/must use HTTPS/i);
    },
  );

  it("accepts an HTTPS staging URL", () => {
    const result = publicEnvironmentSchema.parse({
      APP_ENV: "staging",
      NEXT_PUBLIC_SITE_URL: "https://staging.sugaspies.ca",
    });

    expect(result.NEXT_PUBLIC_SITE_URL).toBe("https://staging.sugaspies.ca");
  });

  it("requires the Supabase URL and publishable key as a pair", () => {
    expect(() =>
      publicEnvironmentSchema.parse({
        APP_ENV: "local",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow(/must either both be present or both be absent/i);
  });

  it("rejects legacy or malformed key prefixes", () => {
    expect(() =>
      publicEnvironmentSchema.parse({
        APP_ENV: "local",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "eyJlegacy-anon-key",
      }),
    ).toThrow(/sb_publishable_/i);

    expect(() =>
      serverEnvironmentSchema.parse({
        APP_ENV: "local",
        SUPABASE_SECRET_KEY: "service_role_legacy",
      }),
    ).toThrow(/sb_secret_/i);
  });

  it("finds secret-like names accidentally marked public", () => {
    expect(
      findPublicSecretNames({
        NEXT_PUBLIC_SITE_URL: "https://example.com",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "do-not-expose",
        NEXT_PUBLIC_DATABASE_URL: "do-not-expose",
        STRIPE_SECRET_KEY: "server-only-is-fine",
      }),
    ).toEqual(["NEXT_PUBLIC_SUPABASE_SECRET_KEY", "NEXT_PUBLIC_DATABASE_URL"]);
  });

  it("rejects unknown variables passed into the strict schema", () => {
    expect(() =>
      publicEnvironmentSchema.parse({
        APP_ENV: "local",
        NEXT_PUBLIC_UNREVIEWED_VALUE: "surprise",
      }),
    ).toThrow(/unrecognized key/i);
  });
});
