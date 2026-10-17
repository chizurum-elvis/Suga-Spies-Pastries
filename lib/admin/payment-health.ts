/** Presentation only. The caller must read the heartbeat inside an authorized owner request. */
export function paymentWorkerWarnings(
  checkedAt: string | null,
  failed: boolean,
  now = Date.now(),
) {
  const checked = checkedAt ? Date.parse(checkedAt) : NaN;
  return failed || !Number.isFinite(checked) || checked <= now - 180_000
    ? [
        "Automatic payment confirmation needs attention. Ask technical support to restore it before accepting orders.",
      ]
    : [];
}
