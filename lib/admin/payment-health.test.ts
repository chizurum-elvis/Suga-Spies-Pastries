import { expect, it } from "vitest";
import { paymentWorkerWarnings } from "@/lib/admin/payment-health";
const now = Date.parse("2026-10-17T15:00:00Z");
it("reports a fresh heartbeat without a false warning", () =>
  expect(
    paymentWorkerWarnings(new Date(now - 10_000).toISOString(), false, now),
  ).toEqual([]));
it.each([
  null,
  "invalid",
  new Date(now - 180_000).toISOString(),
  new Date(now - 181_000).toISOString(),
])("warns for an unusable heartbeat %s", (value) =>
  expect(paymentWorkerWarnings(value, false, now)).toHaveLength(1),
);
it("does not hide a failed health read behind an old value", () =>
  expect(
    paymentWorkerWarnings(new Date(now).toISOString(), true, now),
  ).toHaveLength(1));
