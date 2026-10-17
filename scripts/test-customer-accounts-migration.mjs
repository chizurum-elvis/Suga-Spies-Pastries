import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const tests = readFileSync(
  new URL("../supabase/tests/customer_accounts_test.sql", import.meta.url),
  "utf8",
);
if (
  !tests.trimStart().startsWith("begin;") ||
  !tests.trimEnd().endsWith("rollback;")
)
  throw new Error("Customer-account tests must remain rollback-only.");
const result = spawnSync(
  "node_modules/.bin/supabase",
  ["db", "query", "--linked", tests, "--output-format", "json"],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(output);
if (result.status !== 0 || /not ok|# Looks like/i.test(output)) process.exit(1);
