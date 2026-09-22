import { describe, expect, it } from "vitest";

import {
  buildPrivateAdminHeaders,
  buildSecurityHeaders,
} from "@/lib/security/headers";

describe("security headers", () => {
  it("applies the baseline protections in every environment", () => {
    const headers = new Map(
      buildSecurityHeaders("local").map(({ key, value }) => [key, value]),
    );

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("adds HSTS only for the production HTTPS deployment", () => {
    const productionHeaders = new Map(
      buildSecurityHeaders("production").map(({ key, value }) => [key, value]),
    );
    const stagingHeaders = new Map(
      buildSecurityHeaders("staging").map(({ key, value }) => [key, value]),
    );

    expect(productionHeaders.get("Strict-Transport-Security")).toContain(
      "includeSubDomains",
    );
    expect(stagingHeaders.has("Strict-Transport-Security")).toBe(false);
  });

  it("returns a fresh array so callers cannot mutate shared policy", () => {
    const first = buildSecurityHeaders("local");
    first.pop();

    expect(buildSecurityHeaders("local")).toHaveLength(5);
  });

  it("keeps the owner workspace out of shared caches and search indexes", () => {
    const headers = new Map(
      buildPrivateAdminHeaders().map(({ key, value }) => [key, value]),
    );

    expect(headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0, must-revalidate",
    );
    expect(headers.get("X-Robots-Tag")).toContain("noindex");
  });
});
