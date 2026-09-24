import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isAuthorizedPaymentWorker } from "@/lib/payments/worker-auth";

describe("payment worker authentication", () => {
  const localSecret = "l".repeat(64);
  const cronSecret = "c".repeat(64);

  it("accepts either configured worker credential", () => {
    expect(
      isAuthorizedPaymentWorker(`Bearer ${localSecret}`, [
        localSecret,
        cronSecret,
      ]),
    ).toBe(true);
    expect(
      isAuthorizedPaymentWorker(`Bearer ${cronSecret}`, [
        localSecret,
        cronSecret,
      ]),
    ).toBe(true);
  });

  it.each([
    null,
    "",
    "Bearer",
    `Bearer ${"x".repeat(64)}`,
    localSecret,
    `Basic ${localSecret}`,
  ])("rejects an invalid authorization value %#", (authorization) => {
    expect(
      isAuthorizedPaymentWorker(authorization, [localSecret, cronSecret]),
    ).toBe(false);
  });

  it("fails closed when no worker secret is configured", () => {
    expect(
      isAuthorizedPaymentWorker("Bearer undefined", [undefined, undefined]),
    ).toBe(false);
  });
});
