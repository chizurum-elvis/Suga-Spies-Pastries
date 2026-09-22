import { Suspense, type ReactNode } from "react";
import { CartRouteOpener } from "@/components/cart/cart-route-opener";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { CustomerFooter } from "@/components/layout/customer-footer";
import { CustomerHeader } from "@/components/layout/customer-header";
import { SkipLink } from "@/components/layout/skip-link";

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col">
        <SkipLink />
        <CustomerHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <CustomerFooter />
      </div>
      <CartDrawer />
      <Suspense fallback={null}>
        <CartRouteOpener />
      </Suspense>
    </CartProvider>
  );
}
