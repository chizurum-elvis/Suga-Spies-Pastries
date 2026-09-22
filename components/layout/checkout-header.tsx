import { CartEditButton } from "@/components/cart/cart-edit-button";
import { ArrowLeft } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";

export function CheckoutHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex min-h-18 w-full max-w-[72rem] items-center justify-between gap-4 px-4 sm:min-h-20 sm:px-6 lg:px-8">
        <BrandMark compact />
        <div className="flex items-center gap-3 sm:gap-5">
          <CartEditButton className="text-brand-strong inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Return to cart
          </CartEditButton>
        </div>
      </div>
    </header>
  );
}
