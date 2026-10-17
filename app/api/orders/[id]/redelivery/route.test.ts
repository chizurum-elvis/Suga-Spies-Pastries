import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DeliveryError } from "@/lib/delivery/errors";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  request: vi.fn(),
  begin: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("@/lib/payments/order-access", () => ({
  getGuestOrder: mocks.access,
  orderCookieName: (id: string) => `ss-order-${id}`,
}));
vi.mock("@/lib/orders/redelivery", () => ({
  requestRedelivery: mocks.request,
  beginRedeliveryPayment: mocks.begin,
}));
vi.mock("@/lib/customer/identity", () => ({
  getCustomerIdentity: mocks.identity,
}));
import { POST } from "@/app/api/orders/[id]/redelivery/route";

const id = "98300000-0000-4000-8000-000000000101";
const address = {
  line1: "100 Queen Street West",
  line2: "",
  city: "Toronto",
  province: "ON",
  postalCode: "M5H 2N1",
  country: "CA",
};
function request(
  body: unknown,
  origin = "http://localhost:3000",
  cookie = `ss-order-${id}=signed-access`,
) {
  return new NextRequest(`http://localhost:3000/api/orders/${id}/redelivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}
const context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ id, version: 6 });
  mocks.begin.mockResolvedValue("https://checkout.stripe.com/c/pay/secure");
  mocks.identity.mockResolvedValue(null);
});

describe("guest redelivery endpoint", () => {
  it("rejects cross-site mutation before calling the provider", async () => {
    const response = await POST(
      request(
        { action: "request", expectedVersion: 6, address },
        "https://attacker.example",
      ),
      context,
    );
    expect(response.status).toBe(403);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("requires the exact secure guest order access", async () => {
    mocks.access.mockRejectedValue(
      new DeliveryError("order_not_found", "Unavailable", 404),
    );
    const response = await POST(
      request(
        { action: "request", expectedVersion: 6, address },
        undefined,
        "",
      ),
      context,
    );
    expect(response.status).toBe(404);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it.each([
    { action: "request", expectedVersion: 6, address, feeCents: 0 },
    {
      action: "request",
      expectedVersion: 6,
      address: { ...address, city: "Ottawa" },
      selectedDate: "2026-10-01",
    },
    { action: "pay", expectedVersion: 6, amount: 1 },
    { action: "pay", expectedVersion: -1 },
  ])("rejects price/date/state injection or invalid versions", async (body) => {
    const response = await POST(request(body), context);
    expect(response.status).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("passes only an address and expected version to server-side validation", async () => {
    const response = await POST(
      request({ action: "request", expectedVersion: 6, address }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith(
      id,
      "signed-access",
      undefined,
      undefined,
    );
    expect(mocks.request).toHaveBeenCalledWith(id, 6, address);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("passes verified customer identity to the exact-order access check", async () => {
    mocks.identity.mockResolvedValue({
      id: "98500000-0000-4000-8000-000000000001",
    });
    const response = await POST(
      request({ action: "request", expectedVersion: 6, address }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith(
      id,
      "signed-access",
      undefined,
      "98500000-0000-4000-8000-000000000001",
    );
  });
  it("starts payment without accepting a browser price", async () => {
    const response = await POST(
      request({ action: "pay", expectedVersion: 6 }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://checkout.stripe.com/c/pay/secure",
    });
    expect(mocks.begin).toHaveBeenCalledWith(id, 6);
  });
  it("reports a closed response window without pretending the request was saved", async () => {
    mocks.request.mockRejectedValue(
      new DeliveryError(
        "redelivery_deadline",
        "The 24-hour window ended.",
        409,
      ),
    );
    const response = await POST(
      request({ action: "request", expectedVersion: 6, address }),
      context,
    );
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("24-hour window ended");
  });
});
