import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  lookup: vi.fn(),
  refunds: vi.fn(),
  payment: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({ STRIPE_WEBHOOK_SECRET: "whsec_fixture" }),
}));
vi.mock("@/lib/payments/stripe", () => ({
  stripeClient: () => ({ webhooks: { constructEvent: mocks.verify } }),
}));
vi.mock("@/lib/orders/refund-processor", () => ({
  processOrderRefunds: mocks.refunds,
}));
vi.mock("@/lib/payments/processor", () => ({
  reconcilePayment: mocks.payment,
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({ from: mocks.from }),
}));
import { POST } from "@/app/api/stripe/webhook/route";
function request(signature = "fixture") {
  return new Request("https://pastry.example/api/stripe/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: "signed raw payload",
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockReturnValue({
    id: "evt_fixture",
    type: "refund.updated",
    livemode: false,
    data: { object: { payment_intent: "pi_fixture" } },
  });
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.lookup };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.lookup.mockResolvedValue({
    data: { id: "refund-job", test_only: true },
    error: null,
  });
  mocks.refunds.mockResolvedValue({
    checked: 1,
    failures: 0,
    configured: true,
  });
});
describe("signed refund webhooks", () => {
  it.each(["missing", "invalid"])(
    "rejects a %s signature before accessing order records",
    async (kind) => {
      if (kind === "invalid")
        mocks.verify.mockImplementation(() => {
          throw new Error("bad signature");
        });
      expect(
        (await POST(request(kind === "missing" ? "" : "bad"))).status,
      ).toBe(400);
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.refunds).not.toHaveBeenCalled();
    },
  );
  it.each([
    "refund.created",
    "refund.updated",
    "refund.failed",
    "charge.refunded",
  ])(
    "rechecks Stripe for %s instead of trusting an event's claimed status",
    async (type) => {
      const event = mocks.verify();
      event.type = type;
      const response = await POST(request());
      expect(response.status).toBe(204);
      expect(mocks.verify).toHaveBeenLastCalledWith(
        Buffer.from("signed raw payload"),
        "fixture",
        "whsec_fixture",
      );
      expect(mocks.from).toHaveBeenCalledWith("order_refunds");
      expect(mocks.refunds).toHaveBeenCalledWith("refund-job");
      expect(mocks.payment).not.toHaveBeenCalled();
    },
  );
  it("rejects test/live environment mismatches", async () => {
    mocks.verify().livemode = true;
    expect((await POST(request())).status).toBe(400);
    expect(mocks.refunds).not.toHaveBeenCalled();
  });
  it.each([
    { checked: 0, failures: 0, configured: true },
    { checked: 1, failures: 1, configured: true },
    { checked: 0, failures: 0, configured: false },
  ])("asks Stripe to retry a deferred or failed check", async (result) => {
    mocks.refunds.mockResolvedValue(result);
    expect((await POST(request())).status).toBe(503);
  });
  it("asks Stripe to retry when the database is unavailable", async () => {
    mocks.lookup.mockResolvedValue({ error: { message: "offline" } });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.refunds).not.toHaveBeenCalled();
  });
  it("does not create refund jobs for unknown provider payments", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(204);
    expect(mocks.refunds).not.toHaveBeenCalled();
  });
});
