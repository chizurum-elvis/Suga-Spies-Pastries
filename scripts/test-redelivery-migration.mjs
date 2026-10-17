import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929150250_failed_delivery_redelivery.sql",
    import.meta.url,
  ),
  "utf8",
);
const tests = readFileSync(
  new URL("../supabase/tests/redelivery_test.sql", import.meta.url),
  "utf8",
);
if (
  !tests.trimStart().startsWith("begin;") ||
  !tests.trimEnd().endsWith("rollback;")
)
  throw new Error("Redelivery tests must remain rollback-only.");
const result = spawnSync(
  "node_modules/.bin/supabase",
  [
    "db",
    "query",
    "--linked",
    `begin;\n${migration}\n${tests.replace(/^begin;/, "")}`,
    "--output-format",
    "json",
  ],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(output);
if (result.status !== 0 || /not ok|# Looks like/i.test(output)) process.exit(1);
