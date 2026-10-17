import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ content: vi.fn() }));
vi.mock("@/lib/content/public-data", () => ({
  getPublishedSiteContent: mocks.content,
}));

import { resolvedPaymentConfiguration } from "@/lib/payments/server-configuration";

const environment = {
  APP_ENV: "production" as const,
  PAYMENTS_MODE: "live" as const,
  NEXT_PUBLIC_SITE_URL: "https://pastry.example",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_fixture",
  STRIPE_SECRET_KEY: "sk_live_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  ORDER_ACCESS_SECRET: "a".repeat(64),
  PAYMENT_WORKER_SECRET: "b".repeat(64),
  RESEND_API_KEY: "re_fixture",
  ORDER_EMAIL_FROM: "orders@example.com",
  ORDER_ALERT_EMAIL: "owner@example.com",
  GOOGLE_MAPS_SERVER_API_KEY: "fixture",
};
const policy = {
  version: 2,
  content: { title: "Approved policy", body: "Approved policy text." },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.content.mockResolvedValue({
    policies: { terms: policy, privacy: policy, refund: policy },
  });
});

describe("checkout policy source", () => {
  it("activates a complete published set and pins its versions", async () => {
    const configuration = await resolvedPaymentConfiguration(environment);
    expect(configuration.blockers).toEqual([]);
    expect(configuration.policies?.version).toBe("terms-2.privacy-2.refund-2");
    expect(configuration.policies?.refundUrl).toBe(
      "https://pastry.example/policies/refund?v=2",
    );
  });

  it("keeps live checkout blocked when a legal policy is still unpublished", async () => {
    mocks.content.mockResolvedValue({
      policies: { terms: policy, privacy: policy, refund: null },
    });
    const configuration = await resolvedPaymentConfiguration(environment);
    expect(configuration.blockers).toContain(
      "Checkout policies are awaiting approval.",
    );
    expect(configuration.policies).toBeNull();
  });

  it("preserves the configured approved links until the on-site set is complete", async () => {
    mocks.content.mockResolvedValue({
      policies: { terms: null, privacy: null, refund: null },
    });
    const approved = {
      version: "approved-v1",
      termsUrl: "https://pastry.example/terms",
      privacyUrl: "https://pastry.example/privacy",
      refundUrl: "https://pastry.example/refund",
    };
    const configuration = await resolvedPaymentConfiguration({
      ...environment,
      CHECKOUT_POLICIES_JSON: JSON.stringify(approved),
    });
    expect(configuration.blockers).toEqual([]);
    expect(configuration.policies).toEqual(approved);
  });
});
