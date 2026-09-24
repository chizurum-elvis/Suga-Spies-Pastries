import { describe, expect, it } from "vitest";

import { walletElementOptions } from "@/lib/payments/wallet-options";

describe("wallet-only checkout options", () => {
  it("allows only Apple Pay and Google Pay", () => {
    expect(walletElementOptions.paymentMethodOrder).toEqual([
      "apple_pay",
      "google_pay",
    ]);
    expect(walletElementOptions.paymentMethods).toEqual({
      applePay: "always",
      googlePay: "always",
      link: "never",
      paypal: "never",
      amazonPay: "never",
      klarna: "never",
    });
  });

  it("keeps provider-rendered wallet controls touch friendly", () => {
    expect(walletElementOptions.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(walletElementOptions.buttonHeight).toBeLessThanOrEqual(55);
  });
});
