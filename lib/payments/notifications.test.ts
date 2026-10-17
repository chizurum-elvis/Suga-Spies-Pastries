import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  orderFixture,
  attemptFixture,
  purchaseFixture,
} from "@/tests/fixtures/payment";
import type { NotificationRow } from "@/lib/payments/database";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  fetch: vi.fn(),
  testOnly: true,
  env: {
    RESEND_API_KEY: "re_fixture",
    ORDER_EMAIL_FROM: "orders@example.com",
    ORDER_ALERT_EMAIL: "owner@example.com",
    ORDER_TEST_EMAIL: "safe-test@example.com",
    ORDER_ACCESS_SECRET: "a".repeat(64),
    NEXT_PUBLIC_SITE_URL: "https://pastry.example.com",
  },
}));
vi.mock("@/lib/env/server", () => ({ getServerEnvironment: () => mocks.env }));
vi.mock("@/lib/admin/settings", () => ({
  getOperationalSettings: async () => ({
    owner_alert_email: "updated-owner@example.com",
  }),
}));
vi.mock("@/lib/content/public-data", () => ({
  getPublicContact: async () => ({ phone: "+1 (437) 332-7263", email: "" }),
}));
vi.mock("@/lib/supabase/secret", () => ({
  createSecretSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(),
        update: mocks.update,
        error: null,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      mocks.update.mockReturnValue(query);
      query.single.mockResolvedValue({
        data:
          table === "orders"
            ? orderFixture()
            : table === "order_events"
              ? {
                  customer_title: "Being prepared",
                  customer_message: "We have started preparing your pastries.",
                  occurred_at: "2026-10-11T14:00:00.000Z",
                }
              : {
                  ...attemptFixture(),
                  snapshot: { ...purchaseFixture(), testOnly: mocks.testOnly },
                },
        error: null,
      });
      return query;
    },
  }),
}));
import {
  confirmationText,
  sendOrderNotifications,
} from "@/lib/payments/notifications";
const notification = (): NotificationRow => ({
  id: "98000000-0000-4000-8000-000000000010",
  order_id: orderFixture().id,
  payment_attempt_id: attemptFixture().id,
  order_event_id: null,
  kind: "customer_confirmation",
  status: "sending",
  attempts: 1,
  lease_id: "lease",
  first_attempt_at: new Date().toISOString(),
  next_attempt_at: new Date().toISOString(),
  sent_at: null,
  provider_id: null,
  failure_code: null,
});
beforeEach(() => {
  mocks.testOnly = true;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.rpc.mockResolvedValue({ data: [notification()], error: null });
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ id: "email_fixture" }), { status: 200 }),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("durable order confirmation", () => {
  it("includes paid totals, Toronto delivery and cancellation deadline", () => {
    const text = confirmationText(
      orderFixture(),
      "https://example.com/order",
      false,
    );
    expect(text).toContain("DEVELOPMENT TEST");
    expect(text).toContain("4 × Chocolate Chip Cookies");
    expect(text).toContain("$15.00 CAD");
    expect(text).not.toContain("Tax:");
    expect(text).toContain("Cancellation deadline");
    expect(text).toContain("https://example.com/order");
  });
  it("routes sandbox mail only to the explicit test inbox", async () => {
    await sendOrderNotifications();
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(options.body).to).toEqual(["safe-test@example.com"]);
    expect(JSON.parse(options.body).from).toBe(
      "Suga & Spies <orders@example.com>",
    );
    expect(options.headers["Idempotency-Key"]).toBe(
      `order-notification/${notification().id}`,
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", provider_id: "email_fixture" }),
    );
  });
  it("routes live owner alerts to the saved private alert inbox", async () => {
    mocks.testOnly = false;
    mocks.rpc.mockResolvedValue({
      data: [{ ...notification(), kind: "owner_order" }],
      error: null,
    });
    await sendOrderNotifications();
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).to).toEqual([
      "updated-owner@example.com",
    ]);
  });
  it("does not reroute live customer confirmations to the owner's inbox", async () => {
    mocks.testOnly = false;
    await sendOrderNotifications();
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).to).toEqual([
      purchaseFixture().delivery.email,
    ]);
  });
  it("sends a customer stage update to the test inbox, not the owner", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          ...notification(),
          kind: "customer_preparing",
          order_event_id: "98000000-0000-4000-8000-000000000020",
        },
      ],
      error: null,
    });
    await sendOrderNotifications();
    const [, options] = mocks.fetch.mock.calls[0];
    expect(JSON.parse(options.body).to).toEqual(["safe-test@example.com"]);
    expect(JSON.parse(options.body).subject).toContain("Being prepared");
  });
  it("leaves failed email in the retry queue without undoing the paid order", async () => {
    mocks.fetch.mockRejectedValue(new Error("provider offline"));
    expect(await sendOrderNotifications()).toMatchObject({
      sent: 0,
      failed: 1,
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        failure_code: "notification_delivery_failed",
      }),
    );
  });
  it.each([
    "customer_cancelled",
    "owner_cancellation",
    "owner_refund_attention",
  ])(
    "sends a truthful %s notice with the right order destination",
    async (kind) => {
      mocks.rpc.mockResolvedValue({
        data: [{ ...notification(), kind }],
        error: null,
      });
      await sendOrderNotifications();
      const [, options] = mocks.fetch.mock.calls[0];
      const mail = JSON.parse(options.body);
      expect(mail.to).toEqual(["safe-test@example.com"]);
      if (kind === "customer_cancelled") {
        expect(mail.text).toContain(`/orders/${orderFixture().id}#access=`);
        expect(mail.text).not.toContain("/admin/");
      } else {
        expect(mail.text).toContain(`/admin/orders/${orderFixture().id}`);
        expect(mail.text).not.toContain("#access=");
      }
      if (kind === "owner_refund_attention") {
        expect(mail.subject).toContain("Refund needs attention");
        expect(mail.text).toContain("not confirmed for redelivery");
      } else {
        expect(mail.subject).toContain("Order cancelled");
        expect(mail.text).toContain("$15.00 CAD, including delivery");
        expect(mail.text).toContain("has been requested");
        expect(mail.text).not.toContain("has been issued");
      }
    },
  );
  it("never re-sends an ambiguous email beyond the provider idempotency window", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          ...notification(),
          first_attempt_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
        },
      ],
      error: null,
    });
    await sendOrderNotifications();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
