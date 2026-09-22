import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CartPageClient } from "@/components/cart/cart-page-client";

export const metadata: Metadata = {
  title: "Your pastry cart",
  description:
    "Review your Suga & Spies pastry selections and current Canadian-dollar subtotal.",
};

export default function CartPage() {
  return (
    <div className="bg-canvas min-h-full">
      <div className="mx-auto w-full max-w-[78rem] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <Link
          href="/menu"
          className="text-ink-soft hover:text-brand inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the menu
        </Link>
        <div className="border-border mt-5 grid gap-3 border-b pb-7 sm:pb-9">
          <p className="text-brand-strong text-xs font-bold tracking-[0.14em] uppercase">
            Your order so far
          </p>
          <h1 className="font-display text-ink text-3xl sm:text-4xl">
            Your pastry cart
          </h1>
          <p className="text-ink-soft max-w-2xl text-sm leading-6 sm:text-base">
            Review each pastry and customization. Current prices are confirmed
            directly from the menu before scheduling begins.
          </p>
        </div>
        <div className="mt-3">
          <CartPageClient />
        </div>
      </div>
    </div>
  );
}
