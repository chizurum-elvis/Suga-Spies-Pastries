import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  result: vi.fn(),
  group: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/catalog/public-data", () => ({
  CATALOGUE_CACHE_TAG: "catalogue",
}));
vi.mock("@/lib/auth/owner-access", () => ({
  resolveOwnerAccess: mocks.access,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        update: mocks.update,
        eq: mocks.eq,
        single: async () => ({
          data: { minimum_quantity: 4, maximum_quantity: 100 },
          error: null,
        }),
        maybeSingle:
          table === "product_option_groups" ? mocks.group : mocks.result,
      };
      mocks.update.mockReturnValue(query);
      mocks.eq.mockReturnValue(query);
      return query;
    },
  }),
}));
import { updateCatalogueChoice } from "@/lib/catalog/actions";
import { initialCatalogueActionState } from "@/lib/catalog/action-state";
const productId = "98700000-0000-4000-8000-000000000001";
const itemId = "98700000-0000-4000-8000-000000000002";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    productId,
    itemId,
    itemType: "variant",
    updatedAt: "2026-10-17T10:00:00+00:00",
    name: "Large",
    price: "5.25",
    minimumQuantity: "4",
    quantityStep: "1",
    maximumQuantity: "",
  }))
    data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ status: "authorized" });
  mocks.result.mockResolvedValue({ data: { id: itemId }, error: null });
  mocks.group.mockResolvedValue({ data: { id: itemId }, error: null });
});
describe("editable menu choices", () => {
  it.each(["unauthenticated", "forbidden", "unavailable"])(
    "rejects %s before writing",
    async (status) => {
      mocks.access.mockResolvedValue({ status });
      expect(
        (await updateCatalogueChoice(initialCatalogueActionState, form()))
          .status,
      ).toBe("error");
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("uses integer cents and scopes variant edits by pastry and timestamp", async () => {
    expect(
      (await updateCatalogueChoice(initialCatalogueActionState, form())).status,
    ).toBe("success");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ price_cents: 525 }),
    );
    expect(mocks.eq).toHaveBeenCalledWith("product_id", productId);
    expect(mocks.eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-10-17T10:00:00+00:00",
    );
  });
  it("rejects a maximum lower than an inherited minimum", async () => {
    const input = form();
    input.set("minimumQuantity", "");
    input.set("maximumQuantity", "2");
    expect(
      (await updateCatalogueChoice(initialCatalogueActionState, input)).status,
    ).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a choice from another pastry", async () => {
    const input = form();
    input.set("itemType", "option_value");
    input.set("optionGroupId", itemId);
    mocks.group.mockResolvedValue({ data: null, error: null });
    expect(
      (await updateCatalogueChoice(initialCatalogueActionState, input)).status,
    ).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not overwrite a concurrently changed choice", async () => {
    mocks.result.mockResolvedValue({ data: null, error: null });
    expect(
      (await updateCatalogueChoice(initialCatalogueActionState, form()))
        .message,
    ).toMatch(/another tab/);
  });
});
