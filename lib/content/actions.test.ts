import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
  updateTag: vi.fn(),
  draft: {
    body: { title: "Refund policy", body: "Approved policy text." },
    version: 2,
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidate,
  updateTag: mocks.updateTag,
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/auth/owner-access", () => ({
  resolveOwnerAccess: mocks.access,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicSupabaseClient: vi.fn(),
}));

import {
  publishSiteContent,
  saveSiteContent,
  type ContentActionState,
} from "@/lib/content/actions";

const previous: ContentActionState = {
  status: "idle",
  message: "",
  submissionId: "",
};
function form(key: string, body?: unknown) {
  const data = new FormData();
  data.set("key", key);
  data.set("version", "2");
  if (body) data.set("body", JSON.stringify(body));
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({
    status: "authorized",
    owner: { id: "owner" },
  });
  mocks.rpc.mockResolvedValue({ data: 2, error: null });
  mocks.from.mockImplementation(() => {
    const chain = {
      update: vi.fn(() => chain),
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(async () => ({ data: mocks.draft, error: null })),
      maybeSingle: vi.fn(async () => ({ data: { version: 3 }, error: null })),
    };
    return chain;
  });
});

describe("owner content actions", () => {
  it("rejects unauthorized draft writes and publication before database mutations", async () => {
    mocks.access.mockResolvedValue({ status: "forbidden" });
    expect(
      (
        await saveSiteContent(
          previous,
          form("contact", { phone: "+1 437 332 7263", email: "" }),
        )
      ).status,
    ).toBe("error");
    expect((await publishSiteContent(previous, form("refund"))).status).toBe(
      "error",
    );
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses invalid FAQ content rather than storing arbitrary JSON", async () => {
    const input = form("faq", {
      items: [{ question: "Delivery?", answer: "" }],
    });
    expect((await saveSiteContent(previous, input)).status).toBe("error");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("saves only a private draft and does not invalidate public pages", async () => {
    const input = form("contact", { phone: "+1 437 332 7263", email: "" });
    expect((await saveSiteContent(previous, input)).status).toBe("success");
    expect(mocks.from).toHaveBeenCalledWith("site_content_drafts");
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("requires affirmative approval for legal policy publication", async () => {
    expect((await publishSiteContent(previous, form("refund"))).status).toBe(
      "error",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("publishes the approved exact saved version and refreshes public content", async () => {
    const input = form("refund");
    input.set("approved", "yes");
    expect((await publishSiteContent(previous, input)).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("publish_site_content", {
      p_key: "refund",
      p_version: 2,
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("site-content");
  });

  it("rejects stale drafts before publication", async () => {
    mocks.draft.version = 3;
    const input = form("refund");
    input.set("approved", "yes");
    expect((await publishSiteContent(previous, input)).message).toMatch(
      /changed elsewhere/i,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.draft.version = 2;
  });
});
