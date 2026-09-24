import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({
    NEXT_PUBLIC_SITE_URL: "https://pastries.example",
  }),
}));

import { attemptFixture } from "@/tests/fixtures/payment";
import { sessionParameters } from "@/lib/payments/stripe";

describe("Stripe Checkout Session contract", () => {
  it("charges the authoritative pastry lines and delivery in CAD", () => {
    const attempt = attemptFixture();
    const parameters = sessionParameters(attempt);
    const lineItems = parameters.line_items ?? [];
    const total = lineItems.reduce((sum, item) => {
      if (typeof item === "string") throw new Error("Expected inline prices");
      return sum + (item.price_data?.unit_amount ?? 0) * (item.quantity ?? 1);
    }, 0);

    expect(parameters.mode).toBe("payment");
    expect(parameters.ui_mode).toBe("elements");
    expect(parameters.payment_method_types).toEqual(["card"]);
    expect(total).toBe(attempt.total_cents);
    expect(lineItems).toHaveLength(2);
    expect(JSON.stringify(parameters)).not.toMatch(/tax|pickup/i);
  });

  it("binds the provider session and PaymentIntent to one attempt", () => {
    const attempt = attemptFixture();
    const parameters = sessionParameters(attempt);

    expect(parameters.client_reference_id).toBe(attempt.id);
    expect(parameters.metadata).toEqual({ payment_attempt_id: attempt.id });
    expect(parameters.payment_intent_data?.metadata).toEqual({
      payment_attempt_id: attempt.id,
    });
    expect(parameters.return_url).toBe(
      "https://pastries.example/checkout/confirmation",
    );
  });
});
