import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DeliveryError } from "@/lib/delivery/errors";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  rpc: vi.fn(),
  refund: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("@/lib/payments/order-access", () => ({
  getGuestOrder: mocks.access,
  orderCookieName: (id: string) => `ss-order-${id}`,
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/orders/refund-processor", () => ({
  processOrderRefunds: mocks.refund,
}));
vi.mock("@/lib/customer/identity", () => ({
  getCustomerIdentity: mocks.identity,
}));
import { POST } from "@/app/api/orders/[id]/cancel/route";
const id = "98200000-0000-4000-8000-000000000001";
function request(
  body: unknown = { expectedVersion: 1, confirmed: true },
  origin = "http://localhost:3000",
) {
  return new NextRequest(`http://localhost:3000/api/orders/${id}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: `ss-order-${id}=signed-access`,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ id, status: "cancelled" });
  mocks.rpc.mockResolvedValue({ data: "refund-id", error: null });
  mocks.refund.mockResolvedValue({ checked: 1, failures: 0 });
  mocks.identity.mockResolvedValue(null);
});
describe("guest cancellation endpoint", () => {
  it("requires same-origin submission", async () => {
    expect(
      (
        await POST(request(undefined, "https://attacker.example"), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { expectedVersion: 1, confirmed: false },
    { expectedVersion: 1, confirmed: true, amount: 1 },
    { expectedVersion: 1, confirmed: true, orderId: "other" },
  ])("rejects tampered inputs", async (body) => {
    expect(
      (await POST(request(body), { params: Promise.resolve({ id }) })).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not mutate a guessed or inaccessible order", async () => {
    mocks.access.mockRejectedValue(
      new DeliveryError("order_not_found", "Unavailable", 404),
    );
    expect(
      (await POST(request(), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("authorizes the exact order using its cookie and sends no trusted browser amount", async () => {
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.access).toHaveBeenCalledWith(
      id,
      "signed-access",
      undefined,
      undefined,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_order", {
      p_order_id: id,
      p_expected_version: 1,
    });
    expect(mocks.refund).toHaveBeenCalledWith("refund-id");
  });
  it("accepts a verified linked account through the same order authorization check", async () => {
    mocks.identity.mockResolvedValue({
      id: "98500000-0000-4000-8000-000000000001",
    });
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith(
      id,
      "signed-access",
      undefined,
      "98500000-0000-4000-8000-000000000001",
    );
  });
  it.each([
    "order_preparation_started",
    "order_cancellation_deadline",
    "order_cancellation_conflict",
  ])("handles a database rejection: %s", async (message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    expect(
      (await POST(request(), { params: Promise.resolve({ id }) })).status,
    ).toBe(409);
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("returns committed cancellation even if the immediate provider request fails", async () => {
    mocks.refund.mockRejectedValue(new Error("offline"));
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      order: { id, status: "cancelled" },
    });
  });
  it("does not claim success or leak internal details after an unknown error", async () => {
    mocks.rpc.mockRejectedValue(new Error("private database detail"));
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("Refresh the order to check its status");
    expect(body).not.toContain("private database detail");
    expect(body).not.toContain("Your box is saved");
  });
});
