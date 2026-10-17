import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultContactContent,
  defaultFaqContent,
  defaultHomeContent,
} from "@/lib/content/defaults";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261016090649_owner_editable_site_content.sql",
  ),
  "utf8",
);

describe("website content migration security contract", () => {
  it("seeds the same initial content used for local previews", () => {
    for (const [key, expected] of Object.entries({
      home: defaultHomeContent,
      contact: defaultContactContent,
      faq: defaultFaqContent,
    })) {
      const match = migration.match(
        new RegExp(`\\('${key}', '([^\\n]*)'::jsonb\\)`),
      );
      expect(match).not.toBeNull();
      expect(JSON.parse(match![1].replace(/''/g, "'"))).toEqual(expected);
    }
  });
  it("keeps drafts owner-only with RLS and grants public read only to published revisions", () => {
    expect(migration).toContain(
      "alter table public.site_content_drafts force row level security;",
    );
    expect(migration).toContain(
      "alter table public.site_content_publications force row level security;",
    );
    expect(migration).toContain(
      "revoke all on public.site_content_drafts from anon, authenticated;",
    );
    expect(migration).toContain(
      "grant select (key, version, body, is_current, published_at)",
    );
    expect(migration).not.toMatch(
      /grant[^;]*(?:insert|update|delete)[^;]*site_content_drafts to anon/i,
    );
  });

  it("preserves immutable published versions and leaves legal policies unpublished", () => {
    expect(migration).toContain(
      "create trigger site_content_publication_immutable",
    );
    expect(migration).toContain("where key in ('home', 'contact', 'faq')");
    expect(migration).toContain("security invoker");
  });
});
