import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const credentialPatterns = [
  ["Stripe private key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{20,}\b/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ["Resend API key", /\bre_[A-Za-z0-9_]{24,}\b/],
  ["Google API key", /\bAIza[A-Za-z0-9_-]{35}\b/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

/** Reports only file/line/type; never includes the matched credential. */
export function releaseSafetyFindings(file, content) {
  const findings = [];
  if (/(?:^|\/)\.env(?:\..*)?$/.test(file) && file !== ".env.example")
    findings.push({
      file,
      line: 1,
      reason: "Environment files must not be committed",
    });
  if (
    /^(?:test-results|playwright-report|blob-report|coverage|\.vercel|supabase\/\.temp)\//.test(
      file,
    )
  )
    findings.push({
      file,
      line: 1,
      reason: "Private/generated artifacts must not be committed",
    });
  if (content.includes("\0")) return findings;
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const [reason, pattern] of credentialPatterns) {
      if (pattern.test(line)) findings.push({ file, line: index + 1, reason });
    }
  }
  return findings;
}

export function nativeDependencyFindings(lock) {
  const findings = [];
  for (const name of ["next", "sharp"]) {
    const entry = lock.packages?.[`node_modules/${name}`];
    if (!entry?.optionalDependencies) {
      findings.push({
        file: "package-lock.json",
        line: 1,
        reason: `Missing ${name} platform dependency metadata`,
      });
      continue;
    }
    for (const [dependency, version] of Object.entries(
      entry.optionalDependencies,
    )) {
      if (
        !dependency.startsWith("@next/swc-") &&
        !dependency.startsWith("@img/sharp-")
      )
        continue;
      if (lock.packages[`node_modules/${dependency}`]?.version !== version)
        findings.push({
          file: "package-lock.json",
          line: 1,
          reason: `Missing or inconsistent cross-platform package: ${dependency}`,
        });
    }
  }
  return findings;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const files = [
    ...new Set(
      execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        { encoding: "utf8" },
      )
        .split("\0")
        .filter(Boolean),
    ),
  ];
  const findings = [];
  findings.push(
    ...nativeDependencyFindings(
      JSON.parse(readFileSync("package-lock.json", "utf8")),
    ),
  );
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch (error) {
      // A tracked deletion is an expected part of a release.
      if (error.code === "ENOENT") continue;
      throw new Error("A release file could not be inspected.");
    }
    findings.push(...releaseSafetyFindings(file, content));
  }
  for (const finding of findings)
    console.error(`${finding.file}:${finding.line}: ${finding.reason}`);
  if (findings.length) process.exitCode = 1;
  else
    console.log(
      `Release safety check passed (${files.length} files inspected). This targeted scan does not replace a security review.`,
    );
}
