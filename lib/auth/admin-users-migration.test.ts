import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828235722_create_admin_users.sql",
  ),
  "utf8",
).toLowerCase();

describe("admin owner allow-list migration", () => {
  it("binds each membership to an Auth user with restrictive constraints", () => {
    expect(migration).toMatch(
      /user_id uuid primary key references auth\.users \(id\) on delete cascade/,
    );
    expect(migration).toContain("constraint admin_users_role_check");
    expect(migration).toContain("role in ('owner')");
    expect(migration).toContain("char_length(display_name) between 1 and 80");
  });

  it("forces RLS and permits authenticated users to read only their own active row", () => {
    expect(migration).toContain(
      "alter table public.admin_users force row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.admin_users from anon, authenticated",
    );
    expect(migration).toMatch(
      /grant select \(user_id, role, is_active, display_name\)[\s\S]+to authenticated/,
    );
    expect(migration).toContain("(select auth.uid()) = user_id and is_active");
  });

  it("does not grant website sessions membership write privileges", () => {
    expect(migration).not.toMatch(
      /grant\s+(?:all|insert|update|delete)[\s\S]*?to\s+(?:anon|authenticated)/,
    );
  });
});
