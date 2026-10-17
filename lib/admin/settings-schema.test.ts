import { describe, expect, it } from "vitest";
import { businessSettingsSchema } from "@/lib/admin/settings-schema";

const valid = {
  version: "1",
  acceptingOrders: false,
  pauseMessage: "Taking a short break. Please check back tomorrow.",
  ownerAlertEmail: "owner@example.com",
};
describe("owner operational settings", () => {
  it("accepts a safe pause and blank email fallback", () => {
    expect(
      businessSettingsSchema.parse({ ...valid, ownerAlertEmail: "" })
        .acceptingOrders,
    ).toBe(false);
  });
  it.each([
    { version: 0 },
    { version: "NaN" },
    { acceptingOrders: "false" },
    { pauseMessage: "" },
    { pauseMessage: "a".repeat(241) },
    { ownerAlertEmail: "not-an-email" },
    { ownerAlertEmail: "a@example.com\r\nBcc:b@example.com" },
    { secret: "not-allowed" },
  ])("rejects invalid or unexpected fields %j", (change) => {
    expect(
      businessSettingsSchema.safeParse({ ...valid, ...change }).success,
    ).toBe(false);
  });
});
