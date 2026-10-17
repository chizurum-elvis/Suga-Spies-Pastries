import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  rpc: vi.fn(),
  refund: vi.fn(),
  revalidate: vi.fn(),
  from: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/owner-access", () => ({
  resolveOwnerAccess: mocks.access,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));
vi.mock("@/lib/orders/refund-processor", () => ({
  processOrderRefunds: mocks.refund,
}));
import { cancelOwnerOrder, checkOrderRefund } from "@/lib/orders/actions";
import { initialOrderActionState } from "@/lib/orders/action-state";

const id = "98200000-0000-4000-8000-000000000001";
function form() {
  const data = new FormData();
  data.set("orderId", id);
  data.set("expectedVersion", "1");
  data.set("reason", "Customer requested cancellation");
  data.set("confirmed", "yes");
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ status: "authorized" });
  mocks.rpc.mockResolvedValue({ data: "refund-id", error: null });
  mocks.refund.mockResolvedValue({ configured: true, checked: 1, failures: 0 });
});
describe("owner cancellation actions", () => {
  it.each(["unauthenticated", "denied", "unavailable"])(
    "blocks %s owners before a refund mutation",
    async (status) => {
      mocks.access.mockResolvedValue({ status });
      expect(
        (await cancelOwnerOrder(initialOrderActionState, form())).status,
      ).toBe("error");
      expect(
        (await checkOrderRefund(initialOrderActionState, form())).status,
      ).toBe("error");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.refund).not.toHaveBeenCalled();
    },
  );
  it.each(["reason", "confirmed", "orderId", "expectedVersion"])(
    "requires a valid %s",
    async (field) => {
      const data = form();
      data.delete(field);
      expect(
        (await cancelOwnerOrder(initialOrderActionState, data)).status,
      ).toBe("error");
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("uses the session-bound database function and its refund identity", async () => {
    expect(
      (await cancelOwnerOrder(initialOrderActionState, form())).status,
    ).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_order", {
      p_order_id: id,
      p_expected_version: 1,
      p_reason: "Customer requested cancellation",
    });
    expect(mocks.refund).toHaveBeenCalledWith("refund-id");
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/availability");
  });
  it("does not start a refund when preparation won the database race", async () => {
    mocks.rpc.mockResolvedValue({
      error: { message: "order_preparation_started" },
    });
    const result = await cancelOwnerOrder(initialOrderActionState, form());
    expect(result.status).toBe("error");
    expect(result.message).toContain("Preparation has started");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("does not undo committed cancellation when Stripe is unavailable", async () => {
    mocks.refund.mockRejectedValue(new Error("offline"));
    const result = await cancelOwnerOrder(initialOrderActionState, form());
    expect(result.status).toBe("success");
    expect(result.message).toContain("refund is being tracked");
  });
});
