import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830160958_create_catalogue.sql",
  ),
  "utf8",
);

describe("catalogue migration security contract", () => {
  it.each([
    "categories",
    "products",
    "product_images",
    "product_variants",
    "product_option_groups",
    "product_option_values",
    "catalog_audit_events",
  ])("enables and forces RLS for %s", (table) => {
    expect(migration).toContain(
      `alter table public.${table} enable row level security;`,
    );
    expect(migration).toContain(
      `alter table public.${table} force row level security;`,
    );
  });

  it("does not grant hard deletion of products or catalogue choices", () => {
    expect(migration).not.toMatch(
      /grant[^;]*delete[^;]*public\.(?:products|categories|product_variants|product_option_groups|product_option_values)/i,
    );
  });

  it("keeps public reads and owner writes distinct", () => {
    expect(migration).toContain("create policy products_public_select");
    expect(migration).toContain("create policy products_owner_update");
    expect(migration).toContain("status = 'published'");
  });

  it("makes the audit log append-only to application roles", () => {
    expect(migration).toContain(
      "grant select on table public.catalog_audit_events to authenticated;",
    );
    expect(migration).not.toMatch(
      /grant[^;]*(?:insert|update|delete)[^;]*public\.catalog_audit_events/i,
    );
  });

  it("limits owner image uploads at the bucket and policy layers", () => {
    expect(migration).toContain("5242880");
    expect(migration).toContain("product_images_storage_owner_insert");
    expect(migration).toContain("product_images_storage_owner_delete");
  });
});
