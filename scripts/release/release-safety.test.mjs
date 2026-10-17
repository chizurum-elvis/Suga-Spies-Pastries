import assert from "node:assert/strict";
import { test } from "node:test";
import {
  releaseSafetyFindings,
  nativeDependencyFindings,
} from "../check-release-safety.mjs";

test("finds private keys without returning their contents", () => {
  const credential = ["sk", "live", "a".repeat(25)].join("_");
  const findings = releaseSafetyFindings(
    "lib/example.ts",
    `first line\n${credential}`,
  );
  assert.deepEqual(findings, [
    { file: "lib/example.ts", line: 2, reason: "Stripe private key" },
  ]);
  assert.ok(!JSON.stringify(findings).includes(credential));
});
test("allows empty examples, short fixtures, and binary images", () => {
  assert.deepEqual(
    releaseSafetyFindings(
      ".env.example",
      "STRIPE_SECRET_KEY=\nORDER_EMAIL_FROM=",
    ),
    [],
  );
  assert.deepEqual(
    releaseSafetyFindings("tests/fixture.ts", "sk_test_example"),
    [],
  );
  assert.deepEqual(releaseSafetyFindings("public/pastry.png", "\0binary"), []);
});
test("blocks accidentally tracked secrets and private test artifacts", () => {
  for (const file of [
    ".env.local",
    ".env",
    "test-results/session.json",
    "playwright-report/index.html",
    ".vercel/project.json",
    "supabase/.temp/access-token",
  ]) {
    assert.ok(releaseSafetyFindings(file, "{}").length);
  }
});

test("retains both framework and image platform packages in the lockfile", () => {
  const lock = {
    packages: {
      "node_modules/next": {
        optionalDependencies: { "@next/swc-linux-x64-gnu": "16.3.8" },
      },
      "node_modules/@next/swc-linux-x64-gnu": { version: "16.3.8" },
      "node_modules/sharp": {
        optionalDependencies: { "@img/sharp-linux-x64": "0.35.5" },
      },
      "node_modules/@img/sharp-linux-x64": { version: "0.35.5" },
    },
  };
  assert.deepEqual(nativeDependencyFindings(lock), []);
  delete lock.packages["node_modules/@img/sharp-linux-x64"];
  assert.equal(nativeDependencyFindings(lock).length, 1);
  lock.packages["node_modules/@img/sharp-linux-x64"] = { version: "0.35.4" };
  assert.equal(nativeDependencyFindings(lock).length, 1);
});

test("rejects a lockfile with missing native-package metadata", () => {
  assert.equal(nativeDependencyFindings({ packages: {} }).length, 2);
});
