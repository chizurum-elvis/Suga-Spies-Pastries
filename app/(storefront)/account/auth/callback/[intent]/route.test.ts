import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfigurationState: () => ({ status: "configured" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.client,
}));

import { GET } from "./route";

const request = (path: string) =>
  new NextRequest(`https://pastry.example${path}`);
const context = (intent: string) => ({ params: Promise.resolve({ intent }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchange },
  });
});

describe("customer email callback", () => {
  it.each([
    ["signup", "email", "/account/confirm"],
    ["recovery", "recovery", "/account/recover"],
  ])(
    "does not consume a %s token on a prefetchable GET",
    async (intent, type, destination) => {
      const result = await GET(
        request(
          `/account/auth/callback/${intent}?token_hash=${"a".repeat(32)}&type=${type}`,
        ),
        context(intent),
      );
      expect(result.status).toBe(307);
      expect(new URL(result.headers.get("location")!).pathname).toBe(
        destination,
      );
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("rejects a mismatched token type without calling Supabase", async () => {
    const result = await GET(
      request(
        `/account/auth/callback/signup?token_hash=${"a".repeat(32)}&type=recovery`,
      ),
      context("signup"),
    );
    expect(new URL(result.headers.get("location")!).pathname).toBe(
      "/account/login",
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE code only when Supabase confirms the email", async () => {
    mocks.exchange.mockResolvedValue({
      error: null,
      data: { user: { email_confirmed_at: "2026-10-02T00:00:00Z" } },
    });
    const result = await GET(
      request("/account/auth/callback/signup?code=valid"),
      context("signup"),
    );
    expect(new URL(result.headers.get("location")!).pathname).toBe("/account");
    expect(mocks.exchange).toHaveBeenCalledWith("valid", undefined);
  });

  it("rejects failed or unverified PKCE exchanges", async () => {
    mocks.exchange.mockResolvedValue({
      error: null,
      data: { user: { email_confirmed_at: null } },
    });
    const result = await GET(
      request("/account/auth/callback/recovery?code=valid"),
      context("recovery"),
    );
    expect(new URL(result.headers.get("location")!).pathname).toBe(
      "/account/login",
    );
  });
});
