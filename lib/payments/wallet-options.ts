import type { StripeCheckoutExpressCheckoutElementOptions } from "@stripe/stripe-js";

// Stripe renders the branded controls. Keeping this configuration in one
// place prevents an unsupported payment method from appearing accidentally.
export const walletElementOptions = {
  buttonHeight: 52,
  buttonTheme: { applePay: "black", googlePay: "black" },
  buttonType: { applePay: "order", googlePay: "order" },
  layout: { maxColumns: 1, maxRows: 2 },
  paymentMethodOrder: ["apple_pay", "google_pay"],
  paymentMethods: {
    applePay: "always",
    googlePay: "always",
    link: "never",
    paypal: "never",
    amazonPay: "never",
    klarna: "never",
  },
} satisfies StripeCheckoutExpressCheckoutElementOptions;
