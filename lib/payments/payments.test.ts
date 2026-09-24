import { describe, expect, it, vi, afterEach } from "vitest";
import { paymentConfiguration } from "@/lib/payments/configuration";
import {
  startPaymentSchema,
  purchaseSnapshotSchema,
} from "@/lib/payments/schema";
import { purchaseFixture } from "@/tests/fixtures/payment";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({ ORDER_ACCESS_SECRET: "a".repeat(64) }),
}));
import {
  createOrderAccess,
  verifyOrderAccess,
} from "@/lib/payments/order-access";
import { snapshotFingerprint } from "@/lib/payments/review";
afterEach(() => vi.useRealTimers());
describe("checkout security boundary", () => {
  it.each(["total", "subtotal", "line", "empty", "quantity", "deadline"])(
    "rejects an inconsistent %s in a purchase snapshot",
    (field) => {
      const snapshot = purchaseFixture();
      if (field === "total") snapshot.totalCents++;
      if (field === "subtotal") snapshot.subtotalCents++;
      if (field === "line")
        snapshot.validatedCart.lines[0].lineSubtotalCents!++;
      if (field === "empty") snapshot.validatedCart.lines = [];
      if (field === "quantity") snapshot.cart.lines[0].quantity++;
      if (field === "deadline")
        snapshot.cancellationDeadline = "2026-10-12T04:00:00.000Z";
      expect(purchaseSnapshotSchema.safeParse(snapshot).success).toBe(false);
    },
  );
  const ready = {
    APP_ENV: "local" as const,
    PAYMENTS_MODE: "test" as const,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_WEBHOOK_SECRET: "whsec_example",
    ORDER_ACCESS_SECRET: "a".repeat(64),
    PAYMENT_WORKER_SECRET: "b".repeat(64),
  };
  it("charges exactly the pastry subtotal plus delivery", () => {
    const snapshot = purchaseFixture();
    expect(snapshot.totalCents).toBe(
      snapshot.subtotalCents + snapshot.deliveryCents,
    );
    expect("tax" in snapshot).toBe(false);
  });
  it("permits fully configured sandbox checkout", () =>
    expect(paymentConfiguration(ready).blockers).toEqual([]));
  it("accepts a protected deployment cron instead of the local worker", () =>
    expect(
      paymentConfiguration({
        ...ready,
        PAYMENT_WORKER_SECRET: undefined,
        CRON_SECRET: "c".repeat(64),
      }).blockers,
    ).toEqual([]));
  it("disables payments by explicit configuration", () =>
    expect(
      paymentConfiguration({ ...ready, PAYMENTS_MODE: "disabled" }).blockers
        .length,
    ).toBeGreaterThan(0));
  it("rejects a live key in sandbox", () =>
    expect(
      paymentConfiguration({ ...ready, STRIPE_SECRET_KEY: "sk_live_example" })
        .blockers.length,
    ).toBeGreaterThan(0));
  it("rejects unapproved live policies", () =>
    expect(
      paymentConfiguration({ ...ready, PAYMENTS_MODE: "live" }).blockers,
    ).toContain("Checkout policies are awaiting approval."));
  it("rejects a browser-supplied price", () =>
    expect(
      startPaymentSchema.safeParse({
        cart: purchaseFixture().cart,
        reviewToken: "b".repeat(64),
        acceptedPolicies: true,
        totalCents: 1,
      }).success,
    ).toBe(false));
  it("requires affirmative policy review", () =>
    expect(
      startPaymentSchema.safeParse({
        cart: purchaseFixture().cart,
        reviewToken: "b".repeat(64),
        acceptedPolicies: false,
      }).success,
    ).toBe(false));
  it("accepts the real purchase fixture", () =>
    expect(purchaseSnapshotSchema.safeParse(purchaseFixture()).success).toBe(
      true,
    ));
  it("review fingerprints ignore validation clock but include amounts and versions", () => {
    const first = purchaseFixture();
    const second = purchaseFixture();
    second.validatedCart.validatedAt = "2026-09-12T10:00:00.000Z";
    expect(snapshotFingerprint(first, 1, 3, "quote")).toBe(
      snapshotFingerprint(second, 1, 3, "quote"),
    );
    second.deliveryCents++;
    expect(snapshotFingerprint(first, 1, 3, "quote")).not.toBe(
      snapshotFingerprint(second, 1, 3, "quote"),
    );
    expect(snapshotFingerprint(first, 1, 3, "quote")).not.toBe(
      snapshotFingerprint(first, 1, 4, "quote"),
    );
  });
  it("guest access is signed, order-bound and expiring", () => {
    const id = "98000000-0000-4000-8000-000000000004";
    const token = createOrderAccess(id, "2026-10-12");
    expect(verifyOrderAccess(id, token, new Date("2026-10-13").getTime())).toBe(
      true,
    );
    expect(verifyOrderAccess("other-order", token, 0)).toBe(false);
    expect(verifyOrderAccess(id, token + "x", 0)).toBe(false);
    expect(verifyOrderAccess(id, token, new Date("2026-12-01").getTime())).toBe(
      false,
    );
  });
});
