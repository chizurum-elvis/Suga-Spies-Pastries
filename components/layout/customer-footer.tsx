import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { businessConfig } from "@/lib/config/business";

export function CustomerFooter() {
  return (
    <footer className="bg-brand-strong border-t border-white/15 text-white">
      <div className="mx-auto grid w-full max-w-[86rem] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8 lg:py-16">
        <div className="flex items-start">
          <BrandMark inverted />
        </div>

        <div>
          <h2 className="text-xs font-extrabold tracking-[0.14em] text-white/60 uppercase">
            Service
          </h2>
          <ul className="mt-4 grid gap-3 text-sm font-semibold text-white/85">
            <li>Toronto, Markham & Mississauga</li>
            <li>Four days’ minimum notice</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-extrabold tracking-[0.14em] text-white/60 uppercase">
            Support
          </h2>
          <a
            href={businessConfig.supportPhoneHref}
            className="mt-4 inline-flex min-h-11 items-center rounded-md text-sm font-bold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
          >
            {businessConfig.supportPhoneDisplay}
          </a>
          <div className="mt-3">
            <Link
              href="/#menu"
              className="inline-flex min-h-11 items-center rounded-md text-xs font-semibold text-white/60 hover:text-white"
            >
              Browse the starting menu
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/70">
        © {new Date().getFullYear()} Suga &amp; Spies. Toronto, Ontario.
      </div>
    </footer>
  );
}
