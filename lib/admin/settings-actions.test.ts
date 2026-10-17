import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  result: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/owner-access", () => ({
  resolveOwnerAccess: mocks.access,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: () => {
      const query = {
        update: mocks.update,
        eq: mocks.eq,
        select: () => query,
        maybeSingle: mocks.result,
      };
      mocks.update.mockReturnValue(query);
      mocks.eq.mockReturnValue(query);
      return query;
    },
  }),
}));
import { saveBusinessSettings } from "@/lib/admin/settings-actions";
import { initialSettingsState } from "@/lib/admin/settings-schema";
function form() {
  const data = new FormData();
  data.set("version", "3");
  data.set("pauseMessage", "We are taking a short break.");
  data.set("ownerAlertEmail", "");
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ status: "authorized" });
  mocks.result.mockResolvedValue({ data: { version: 4 }, error: null });
});
describe("owner settings mutations", () => {
  it.each(["unauthenticated", "forbidden", "unavailable"])(
    "rejects %s before writing",
    async (status) => {
      mocks.access.mockResolvedValue({ status });
      expect(
        (await saveBusinessSettings(initialSettingsState, form())).status,
      ).toBe("error");
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("does not write invalid values", async () => {
    const input = form();
    input.set("pauseMessage", "");
    expect(
      (await saveBusinessSettings(initialSettingsState, input)).status,
    ).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("scopes the write to the exact version and settings row", async () => {
    expect(
      (await saveBusinessSettings(initialSettingsState, form())).status,
    ).toBe("success");
    expect(mocks.eq).toHaveBeenCalledWith("singleton", true);
    expect(mocks.eq).toHaveBeenCalledWith("version", 3);
    expect(mocks.update).toHaveBeenCalledWith({
      accepting_orders: false,
      pause_message: "We are taking a short break.",
      owner_alert_email: null,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/settings");
  });
  it("reports a stale save without claiming success", async () => {
    mocks.result.mockResolvedValue({ data: null, error: null });
    expect(
      (await saveBusinessSettings(initialSettingsState, form())).message,
    ).toMatch(/another tab/i);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not expose database details", async () => {
    mocks.result.mockResolvedValue({
      data: null,
      error: { message: "private database details" },
    });
    expect(
      (await saveBusinessSettings(initialSettingsState, form())).message,
    ).not.toContain("private database");
  });
});
