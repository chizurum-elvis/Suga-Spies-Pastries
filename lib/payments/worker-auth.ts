import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);

  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function isAuthorizedPaymentWorker(
  authorization: string | null,
  secrets: Array<string | undefined>,
  method?: string,
  now = Date.now(),
) {
  const supplied = authorization ?? "";

  if (
    secrets.some((secret) => {
      if (!secret) return false;
      return safeEqual(supplied, `Bearer ${secret}`);
    })
  )
    return true;

  // pg_net request headers can be read by database login roles. Never queue a
  // reusable Bearer secret: accept only a short-lived, POST/action-bound HMAC.
  // Retried calls within this window are safe: the worker's existing payment,
  // notification and refund claims remain the authoritative idempotency gates.
  if (method !== "POST" || !Number.isFinite(now)) return false;
  const signed =
    /^Suga-Scheduler ([1-9][0-9]{9,10}):([a-f0-9]{32}):([a-f0-9]{64})$/.exec(
      supplied,
    );
  if (!signed) return false;
  const [, timestamp, nonce, signature] = signed;
  const age = Math.floor(now / 1000) - Number(timestamp);
  if (age < -5 || age > 60) return false;
  const message = `suga-payment-recovery:v1:POST:/api/internal/payments/reconcile:${timestamp}:${nonce}`;
  return secrets.some((secret) => {
    if (!secret || secret.length < 32) return false;
    return safeEqual(
      signature,
      createHmac("sha256", secret).update(message).digest("hex"),
    );
  });
}
