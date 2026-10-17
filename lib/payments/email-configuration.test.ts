import { describe, expect, it } from "vitest";
import {
  isResendTestSender,
  orderEmailSender,
} from "@/lib/payments/email-configuration";

describe("order email sender", () => {
  it.each([
    "onboarding@resend.dev",
    "orders@resend.dev",
    "  ORDERS@RESEND.DEV  ",
    "orders@demo.resend.dev",
  ])("identifies the shared test domain in %s", (address) => {
    expect(isResendTestSender(address)).toBe(true);
  });

  it.each([
    undefined,
    "",
    "orders@example.com",
    "resend.dev@example.com",
    "orders@resend.dev.example.com",
  ])("does not mistake %s for Resend's shared domain", (address) => {
    expect(isResendTestSender(address)).toBe(false);
  });

  it("uses the bakery name without requiring display-name syntax in the environment", () => {
    expect(orderEmailSender("orders@example.com")).toBe(
      "Suga & Spies <orders@example.com>",
    );
  });
});
