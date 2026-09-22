// Development worker. Production must schedule this authenticated endpoint every minute.
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const secret = process.env.PAYMENT_WORKER_SECRET;
if (!secret)
  throw new Error("Set PAYMENT_WORKER_SECRET before starting the worker.");
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
while (!stopped) {
  try {
    const result = await fetch(
      new URL("/api/internal/payments/reconcile", site),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(55_000),
      },
    );
    console.log(`Payment worker: HTTP ${result.status}`);
  } catch {
    console.error(
      "Payment worker could not reach the application. It will retry.",
    );
  }
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
