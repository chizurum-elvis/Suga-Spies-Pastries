import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/cart-provider";
import { ContactProvider } from "@/components/content/contact-provider";
import { getPublicContact } from "@/lib/content/public-data";
import { contactPhoneHref } from "@/lib/content/schema";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CheckoutHeader } from "@/components/layout/checkout-header";
import { SkipLink } from "@/components/layout/skip-link";

export default async function CheckoutLayout({
  children,
}: {
  children: ReactNode;
}) {
  const contact = await getPublicContact();
  return (
    <ContactProvider
      contact={{ ...contact, phoneHref: contactPhoneHref(contact.phone) }}
    >
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
    </ContactProvider>
  );
}
