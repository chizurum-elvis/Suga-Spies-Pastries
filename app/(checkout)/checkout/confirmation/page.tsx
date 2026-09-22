import type { Metadata } from "next";

import { PaymentConfirmation } from "@/components/checkout/order-confirmation";

export const metadata: Metadata = {
  title: "Payment confirmation",
  robots: { index: false, follow: false },
};

export default function ConfirmationPage() {
  return (
    <div className="px-4 py-12 sm:px-6">
      <h1 className="sr-only">Payment confirmation</h1>
      <PaymentConfirmation />
    </div>
  );
}
