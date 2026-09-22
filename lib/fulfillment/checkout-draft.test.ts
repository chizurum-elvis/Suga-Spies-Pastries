import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseFixture } from "@/tests/fixtures/payment";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  status: "paid" as string | null,
  insert: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({
    from: (table: string) => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        gt: vi.fn(),
        neq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
        single: vi.fn(),
        insert: mock.insert,
        update: mock.update,
      };
      for (const method of [
        query.select,
        query.eq,
        query.gt,
        query.neq,
        query.order,
        query.limit,
        mock.insert,
        mock.update,
      ])
        method.mockReturnValue(query);
      query.maybeSingle.mockResolvedValue({
        data:
          table === "checkout_drafts"
            ? { id: "old-draft" }
            : mock.status
              ? { status: mock.status }
              : null,
        error: null,
      });
      query.single.mockResolvedValue({
        data: {
          fulfillment_method: "delivery",
          fulfillment_date: "2026-10-12",
          status: "ready_for_details",
          expires_at: "2026-09-18T00:00:00.000Z",
        },
        error: null,
      });
      return query;
    },
  }),
}));
import { saveCheckoutDraft } from "@/lib/fulfillment/checkout-draft";
beforeEach(() => {
  vi.clearAllMocks();
  mock.status = "paid";
});
const input = () => ({
  rawToken: "A".repeat(43),
  cart: purchaseFixture().cart,
  validatedCart: purchaseFixture().validatedCart,
  method: "delivery" as const,
  date: "2026-10-12",
  now: new Date("2026-09-11T00:00:00Z"),
});
describe("checkout after payment", () => {
  it("creates a fresh draft and token after a paid order without changing the old purchase", async () => {
    const result = await saveCheckoutDraft(input());
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.update).not.toHaveBeenCalled();
    expect(result.rawToken).not.toBe(input().rawToken);
  });
  it.each(["creating", "open", "processing", "refund_pending", "needs_review"])(
    "blocks older-tab edits during %s",
    async (status) => {
      mock.status = status;
      await expect(saveCheckoutDraft(input())).rejects.toMatchObject({
        code: "payment_in_progress",
        status: 409,
      });
      expect(mock.insert).not.toHaveBeenCalled();
      expect(mock.update).not.toHaveBeenCalled();
    },
  );
  it.each(["expired", "refunded", null])(
    "allows editing after %s",
    async (status) => {
      mock.status = status;
      await saveCheckoutDraft(input());
      expect(mock.update).toHaveBeenCalledOnce();
      expect(mock.insert).not.toHaveBeenCalled();
    },
  );
});
