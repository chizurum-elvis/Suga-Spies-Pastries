import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260922031124_order_fulfillment_tracking.sql",
    import.meta.url,
  ),
  "utf8",
);
const tests = readFileSync(
  new URL(
    "../supabase/tests/order_fulfillment_tracking_test.sql",
    import.meta.url,
  ),
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
  encoding: "utf8",
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(output);
if (result.status !== 0 || /not ok|# Looks like/i.test(output)) process.exit(1);
