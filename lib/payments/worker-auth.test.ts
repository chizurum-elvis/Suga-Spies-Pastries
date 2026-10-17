import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

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

  describe("short-lived Supabase scheduler authentication", () => {
    const now = Date.parse("2026-10-17T17:00:00Z");
    const timestamp = Math.floor(now / 1000);
    const nonce = "8d".repeat(16);
    const sign = (
      issuedAt = timestamp,
      secret = localSecret,
      scope = "suga-payment-recovery:v1:POST:/api/internal/payments/reconcile",
    ) => {
      const signature = createHmac("sha256", secret)
        .update(`${scope}:${issuedAt}:${nonce}`)
        .digest("hex");
      return `Suga-Scheduler ${issuedAt}:${nonce}:${signature}`;
    };
    it("accepts a current POST signed by the Vault credential", () => {
      expect(
        isAuthorizedPaymentWorker(sign(), [localSecret], "POST", now),
      ).toBe(true);
      expect(
        isAuthorizedPaymentWorker(
          sign(timestamp, cronSecret),
          [localSecret, cronSecret],
          "POST",
          now,
        ),
      ).toBe(true);
    });
    it.each([0, 1, 59, 60, -5])(
      "accepts the documented age boundary %s",
      (age) => {
        expect(
          isAuthorizedPaymentWorker(
            sign(timestamp - age),
            [localSecret],
            "POST",
            now,
          ),
        ).toBe(true);
      },
    );
    it.each([61, 600, -6, -60])(
      "rejects expired or future-dated requests %s",
      (age) => {
        expect(
          isAuthorizedPaymentWorker(
            sign(timestamp - age),
            [localSecret],
            "POST",
            now,
          ),
        ).toBe(false);
      },
    );
    it.each([undefined, "GET", "PUT", "post"])(
      "rejects signatures on the wrong method %s",
      (method) => {
        expect(
          isAuthorizedPaymentWorker(sign(), [localSecret], method, now),
        ).toBe(false);
      },
    );
    it.each([
      "suga-payment-recovery:v1:GET:/api/internal/payments/reconcile",
      "suga-payment-recovery:v1:POST:/api/checkout/payment",
      "suga-payment-recovery:v2:POST:/api/internal/payments/reconcile",
    ])("rejects a signature for another action %s", (scope) => {
      expect(
        isAuthorizedPaymentWorker(
          sign(timestamp, localSecret, scope),
          [localSecret],
          "POST",
          now,
        ),
      ).toBe(false);
    });
    it("rejects a different key, missing key and invalid clock", () => {
      expect(
        isAuthorizedPaymentWorker(
          sign(timestamp, cronSecret),
          [localSecret],
          "POST",
          now,
        ),
      ).toBe(false);
      expect(isAuthorizedPaymentWorker(sign(), [undefined], "POST", now)).toBe(
        false,
      );
      expect(
        isAuthorizedPaymentWorker(sign(), [localSecret], "POST", NaN),
      ).toBe(false);
      expect(
        isAuthorizedPaymentWorker(
          sign(timestamp, "short"),
          ["short"],
          "POST",
          now,
        ),
      ).toBe(false);
    });
    it.each([
      () => sign().replace(nonce, "9d".repeat(16)),
      () => sign().replace(String(timestamp), String(timestamp - 1)),
      () => sign() + "0",
      () => sign().slice(0, -1),
      () => sign().replace("Suga-Scheduler ", "Bearer "),
      () => sign().replace(nonce, nonce.toUpperCase()),
      () => sign().replace(String(timestamp), `0${timestamp}`),
      () => sign().replace(nonce, "8d".repeat(15)),
    ])("rejects malformed or tampered signatures %#", (authorization) => {
      expect(
        isAuthorizedPaymentWorker(authorization(), [localSecret], "POST", now),
      ).toBe(false);
    });
    it("does not queue or return the reusable signing credential", () => {
      expect(sign()).not.toContain(localSecret);
    });
  });
});
