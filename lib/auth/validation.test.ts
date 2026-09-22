import { describe, expect, it } from "vitest";

import {
  ownerSignInSchema,
  passwordRecoverySchema,
  passwordRecoveryTokenSchema,
  passwordUpdateSchema,
} from "@/lib/auth/validation";

describe("owner authentication validation", () => {
  it("normalizes owner email without modifying the password", () => {
    expect(
      ownerSignInSchema.parse({
        email: " Owner@Example.COM ",
        password: "  exact password  ",
      }),
    ).toEqual({
      email: "owner@example.com",
      password: "  exact password  ",
    });
  });

  it.each([
    "owner@example.com\nattacker@example.com",
    "owner@",
    `${"a".repeat(250)}@example.com`,
  ])("rejects malformed recovery email %j", (email) => {
    expect(passwordRecoverySchema.safeParse({ email }).success).toBe(false);
  });

  it.each([
    { tokenHash: "short", type: "recovery" },
    { tokenHash: "valid-looking-token_hash-123", type: "email" },
    { tokenHash: "token.with.invalid.characters", type: "recovery" },
    { tokenHash: "a".repeat(513), type: "recovery" },
  ])("rejects malformed recovery-link data %#", (input) => {
    expect(passwordRecoveryTokenSchema.safeParse(input).success).toBe(false);
  });

  it("accepts only a bounded recovery token hash", () => {
    expect(
      passwordRecoveryTokenSchema.parse({
        tokenHash: "AbC_def-0123456789",
        type: "recovery",
      }),
    ).toEqual({
      tokenHash: "AbC_def-0123456789",
      type: "recovery",
    });
  });

  it.each([
    "Short1!",
    "alllowercase123!",
    "ALLUPPERCASE123!",
    "NoNumbersHere!",
    "NoSymbolsHere123",
    `${"A".repeat(129)}a1!`,
  ])("rejects weak or excessive new password input", (password) => {
    expect(
      passwordUpdateSchema.safeParse({
        password,
        confirmPassword: password,
      }).success,
    ).toBe(false);
  });

  it("rejects a confirmation mismatch and accepts a strong passphrase", () => {
    expect(
      passwordUpdateSchema.safeParse({
        password: "Long-owner-passphrase-42!",
        confirmPassword: "Long-owner-passphrase-43!",
      }).success,
    ).toBe(false);

    expect(
      passwordUpdateSchema.safeParse({
        password: "Long-owner-passphrase-42!",
        confirmPassword: "Long-owner-passphrase-42!",
      }).success,
    ).toBe(true);
  });
});
