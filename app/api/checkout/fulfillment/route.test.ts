// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getDraft: vi.fn(), saveDraft: vi.fn() }));
vi.mock("@/lib/fulfillment/checkout-draft", () => ({
  CHECKOUT_DRAFT_COOKIE: "suga-spies-checkout",
  checkoutDraftCookieOptions: vi.fn(),
  getCheckoutDraft: mocks.getDraft,
  saveCheckoutDraft: mocks.saveDraft,
}));
vi.mock("@/lib/fulfillment/server-data", () => ({
  validateFulfillmentSelection: vi.fn(),
}));
vi.mock("@/lib/cart/server-validation", () => ({
  validateCartAgainstCatalogue: vi.fn(),
}));
import { GET } from "@/app/api/checkout/fulfillment/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("drawer delivery context", () => {
  it("returns the Toronto month for a new guest without creating a draft", async () => {
    mocks.getDraft.mockResolvedValue(null);
    const response = await GET(
      new NextRequest("http://localhost/api/checkout/fulfillment"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      draft: null,
      initialMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
    });
    expect(mocks.getDraft).toHaveBeenCalledWith(undefined);
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain(
      "private, no-store",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("loads only the guest-cookie date summary, without returning the secret token", async () => {
    const draft = {
      method: "delivery",
      date: "2026-10-12",
      dateLabel: "Monday, October 12, 2026",
      status: "ready_for_details",
      expiresAt: "2026-09-28T12:00:00Z",
    };
    mocks.getDraft.mockResolvedValue(draft);
    const response = await GET(
      new NextRequest("http://localhost/api/checkout/fulfillment", {
        headers: { cookie: "suga-spies-checkout=private-token" },
      }),
    );
    expect(mocks.getDraft).toHaveBeenCalledWith("private-token");
    const body = await response.text();
    expect(JSON.parse(body).draft).toEqual(draft);
    expect(body).not.toMatch(/private-token|access_token|M1W|email|phone/);
  });
  it("returns a safe retry response on failure", async () => {
    mocks.getDraft.mockRejectedValue(new Error("private database diagnostic"));
    const response = await GET(
      new NextRequest("http://localhost/api/checkout/fulfillment"),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database diagnostic");
  });
});
