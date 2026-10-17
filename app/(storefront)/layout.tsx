import { Suspense, type ReactNode } from "react";
import { CartRouteOpener } from "@/components/cart/cart-route-opener";
import { ContactProvider } from "@/components/content/contact-provider";
import { getPublishedSiteContent } from "@/lib/content/public-data";
import { contactPhoneHref } from "@/lib/content/schema";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { CustomerFooter } from "@/components/layout/customer-footer";
import { CustomerHeader } from "@/components/layout/customer-header";
import { SkipLink } from "@/components/layout/skip-link";

export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { contact, home } = await getPublishedSiteContent();
  return (
    <ContactProvider
      contact={{ ...contact, phoneHref: contactPhoneHref(contact.phone) }}
    >
      <CartProvider>
        <div className="flex min-h-dvh flex-col">
          <SkipLink />
          <CustomerHeader announcement={home.announcement} />
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
    </ContactProvider>
  );
}
