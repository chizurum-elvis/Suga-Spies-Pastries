import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260901120651_create_fulfillment_scheduling.sql",
  ),
  "utf8",
).toLowerCase();

const protectedTables = [
  "fulfillment_settings",
  "fulfillment_hours",
  "fulfillment_blackouts",
  "checkout_drafts",
  "capacity_days",
  "capacity_adjustments",
  "capacity_holds",
  "fulfillment_audit_events",
];

describe("fulfillment scheduling migration", () => {
  it("forces RLS and starts every protected table from explicit privileges", () => {
    for (const table of protectedTables) {
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from anon, authenticated, service_role`,
      );
    }
  });

  it("keeps checkout drafts and capacity writes off the browser roles", () => {
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)[^;]+public\.checkout_drafts[^;]+to\s+(?:anon|authenticated)/,
    );
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)[^;]+public\.capacity_holds[^;]+to\s+(?:anon|authenticated)/,
    );
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)[^;]+public\.capacity_days[^;]+to\s+(?:anon|authenticated)/,
    );
  });

  it("exposes the reservation function only to the trusted server role", () => {
    expect(migration).toContain(
      "language plpgsql\nsecurity invoker\nset search_path = ''",
    );
    expect(migration).toContain(
      "revoke all on function public.reserve_fulfillment_capacity(uuid, uuid, timestamp with time zone) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.reserve_fulfillment_capacity(uuid, uuid, timestamp with time zone) to service_role",
    );
  });

  it("serializes final capacity decisions and applies the hard limit", () => {
    expect(migration).toMatch(/from public\.capacity_days[\s\S]+for update/);
    expect(migration).toContain(
      "if active_adjustments + active_holds >= settings.daily_capacity then",
    );
    expect(migration).toContain(
      "constraint fulfillment_settings_capacity_check",
    );
    expect(migration).toContain("check (daily_capacity = 4)");
  });

  it("stores only hashed guest access tokens and no business address", () => {
    expect(migration).toContain("access_token_hash text not null unique");
    expect(migration).toContain("check (access_token_hash ~ '^[0-9a-f]{64}$')");
    expect(migration).not.toContain("m1w 2y3");
  });
});
