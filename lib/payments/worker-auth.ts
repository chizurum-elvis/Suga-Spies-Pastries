import "server-only";

import { timingSafeEqual } from "node:crypto";

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
) {
  const supplied = authorization ?? "";

  return secrets.some((secret) => {
    if (!secret) return false;
    return safeEqual(supplied, `Bearer ${secret}`);
  });
}
