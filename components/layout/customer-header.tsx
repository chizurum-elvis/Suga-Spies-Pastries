import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { CartTrigger } from "@/components/cart/cart-trigger";
import { StorefrontMobileNav } from "@/components/navigation/storefront-mobile-nav";

const navigationItems = [
  { href: "/menu", label: "Menu" },
  { href: "/#ordering", label: "Order guide" },
  { href: "/#service", label: "Delivery" },
  { href: "/account", label: "Account" },
] as const;

export function CustomerHeader({ announcement }: { announcement: string }) {
  return (
    <>
      {announcement ? (
        <div className="border-brand-strong bg-brand-strong border-b px-4 py-2 text-center text-xs leading-5 font-bold tracking-[0.01em] [overflow-wrap:anywhere] text-white sm:text-sm">
          {announcement}
        </div>
      ) : null}
      <header className="border-border/85 bg-surface/94 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex min-h-20 w-full max-w-[90rem] items-center justify-between gap-5 px-4 sm:px-6 lg:min-h-22 lg:px-8">
          <BrandMark />

          <div className="flex items-center gap-2 lg:gap-5">
            <nav aria-label="Main navigation" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {navigationItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-ink-soft hover:text-brand-strong inline-flex min-h-11 items-center px-3.5 text-sm font-medium transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <CartTrigger />
            <StorefrontMobileNav />
          </div>
        </div>
      </header>
    </>
  );
}
