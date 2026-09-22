import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const directory = resolve("supabase/tests");
const files = readdirSync(directory)
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const path = resolve(directory, file);
  const sql = readFileSync(path, "utf8").trim();
  if (!sql.startsWith("begin;") || !sql.endsWith("rollback;"))
    throw new Error(`${file} must remain inside a rollback transaction.`);
  const result = spawnSync(
    "npx",
    [
      "supabase",
      "db",
      "query",
      "--linked",
      "--file",
      path,
      "--output-format",
      "json",
    ],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0 || /not ok|# Looks like/i.test(output)) {
    process.stderr.write(output);
    throw new Error(`${file} failed.`);
  }
  process.stdout.write(`✓ ${file}\n`);
}

process.stdout.write(`${files.length} rollback-only database suites passed.\n`);
