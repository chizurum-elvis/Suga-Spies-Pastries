import { describe, expect, it } from "vitest";

import {
  buildAdminLoginPath,
  isPublicAdminPath,
  sanitizeAdminReturnPath,
} from "@/lib/auth/paths";

describe("admin authentication paths", () => {
  it.each([
    undefined,
    null,
    "",
    "https://attacker.example/admin",
    "//attacker.example/admin",
    "/\\attacker.example/admin",
    "/admin/login",
    "/admin/forgot-password?next=/admin",
    "/admin/auth/callback",
    "/admin/update-password",
    "/storefront",
  ])("rejects unsafe or looping return path %j", (value) => {
    expect(sanitizeAdminReturnPath(value)).toBe("/admin");
  });

  it.each(["/admin", "/admin/orders", "/admin/orders?status=ready#order-120"])(
    "preserves safe internal owner paths %s",
    (value) => {
      expect(sanitizeAdminReturnPath(value)).toBe(value);
    },
  );

  it("encodes the safe destination and error without string concatenation", () => {
    expect(
      buildAdminLoginPath("/admin/orders?status=ready", "auth_required"),
    ).toBe(
      "/admin/login?next=%2Fadmin%2Forders%3Fstatus%3Dready&error=auth_required",
    );
  });

  it("does not permit public recovery routes as post-login destinations", () => {
    expect(sanitizeAdminReturnPath("/admin/update-password")).toBe("/admin");
    expect(sanitizeAdminReturnPath("/admin/recover")).toBe("/admin");
  });

  it("keeps only deliberately public owner-authentication routes public", () => {
    expect(isPublicAdminPath("/admin/login")).toBe(true);
    expect(isPublicAdminPath("/admin/recover")).toBe(true);
    expect(isPublicAdminPath("/admin/auth/callback")).toBe(true);
    expect(isPublicAdminPath("/admin/update-password")).toBe(false);
    expect(isPublicAdminPath("/admin/orders")).toBe(false);
  });
});
