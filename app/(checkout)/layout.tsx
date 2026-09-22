import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/cart-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CheckoutHeader } from "@/components/layout/checkout-header";
import { SkipLink } from "@/components/layout/skip-link";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="checkout-surface flex min-h-dvh flex-col bg-white">
        <SkipLink />
        <CheckoutHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
