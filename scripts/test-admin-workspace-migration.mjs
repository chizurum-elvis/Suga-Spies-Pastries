import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migrations = [
  "20261003152035_production_redelivery_date_index.sql",
  "20261003161000_external_orders.sql",
  "20261017090414_owner_workspace_operations.sql",
];
const history = spawnSync(
  "node_modules/.bin/supabase",
  [
    "db",
    "query",
    "--linked",
    "select version from supabase_migrations.schema_migrations",
    "--output-format",
    "json",
  ],
  { encoding: "utf8" },
);
if (history.status !== 0)
  throw new Error("Migration history could not be read.");
const applied = new Set(
  JSON.parse(history.stdout).rows.map((row) => row.version),
);
const tests = readFileSync("supabase/tests/owner_workspace_test.sql", "utf8");
if (!tests.trim().startsWith("begin;") || !tests.trim().endsWith("rollback;"))
  throw new Error("Tests must roll back.");
const sql =
  "begin;\n" +
  migrations
    .filter((file) => !applied.has(file.slice(0, 14)))
    .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
    .join("\n") +
  "\n" +
  tests.trim().slice("begin;".length);
const result = spawnSync(
  "node_modules/.bin/supabase",
  ["db", "query", "--linked", sql, "--output-format", "json"],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(output);
if (result.status !== 0 || /not ok|# Looks like/i.test(output)) process.exit(1);
