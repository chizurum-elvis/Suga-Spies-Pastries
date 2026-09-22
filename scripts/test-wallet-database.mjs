import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// All fixture data and optional schema changes are rolled back, even on failure.
const includeMigration = process.argv.includes("--include-migration");
const migration = includeMigration
  ? readFileSync(
      new URL(
        "../supabase/migrations/20260914131344_remove_checkout_tax.sql",
        import.meta.url,
      ),
      "utf8",
    )
  : "";
const tests = readFileSync(
  new URL("../supabase/tests/wallet_checkout_test.sql", import.meta.url),
  "utf8",
);
if (
  !tests.trimStart().startsWith("begin;") ||
  !tests.trimEnd().endsWith("rollback;")
)
  throw new Error(
    "Database verification must stay inside a rollback transaction.",
  );
const sql = `begin;\n${migration}\n${tests.replace(/^begin;/, "")}`;
const result = spawnSync("npx", ["supabase", "db", "query", "--linked", sql], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
