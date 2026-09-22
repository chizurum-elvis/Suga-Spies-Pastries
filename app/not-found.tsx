import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export default function NotFound() {
  return (
    <main className="bg-canvas grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <p className="font-display text-brand mt-12 text-7xl leading-none sm:text-8xl">
          404
        </p>
        <h1 className="font-display mt-6 text-[2.6rem] leading-[0.96] text-balance sm:text-[3.25rem]">
          This page slipped out of the pastry box.
        </h1>
        <p className="text-ink-soft mx-auto mt-5 max-w-lg text-base leading-7 text-pretty">
          The link may be old, mistyped, or not ready yet. Return to the
          storefront and keep exploring from there.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            Return home
          </Link>
          <a
            href="tel:+14373327263"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "w-full sm:w-auto",
            )}
          >
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
