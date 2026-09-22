import type { Metadata } from "next";

import { FoundationPlayground } from "@/components/foundation/foundation-playground";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BUSINESS_CURRENCY,
  BUSINESS_LOCALE,
  BUSINESS_TIME_ZONE,
} from "@/lib/config/business";
import {
  formatBusinessDate,
  formatBusinessDateTime,
  formatCurrency,
} from "@/lib/i18n/format";

export const metadata: Metadata = {
  title: "Interface foundation",
  robots: { index: false, follow: false },
};

const exampleDate = "2026-11-07T20:30:00.000Z";

export default function FoundationPage() {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <header className="max-w-3xl">
        <Badge tone="accent">Internal preview · no customer data</Badge>
        <h1 className="font-display mt-5 text-[3rem] leading-[0.94] text-balance sm:text-[4rem]">
          Suga Spies interface foundation
        </h1>
        <p className="text-ink-soft mt-6 text-base leading-7 text-pretty sm:text-lg sm:leading-8">
          Reusable visual, responsive, accessible, localization, and feedback
          primitives for the storefront and owner workspace. Brand tokens remain
          reversible until final assets are approved.
        </p>
      </header>

      <section aria-labelledby="tokens-heading" className="mt-14">
        <h2
          id="tokens-heading"
          className="text-2xl font-semibold tracking-[-0.02em]"
        >
          Business-format contract
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Currency", formatCurrency(128.5), BUSINESS_CURRENCY],
            ["Date", formatBusinessDate(exampleDate), BUSINESS_LOCALE],
            [
              "Date & time",
              formatBusinessDateTime(exampleDate),
              BUSINESS_TIME_ZONE,
            ],
            [
              "Business timezone",
              BUSINESS_TIME_ZONE,
              "Never device-local time",
            ],
          ].map(([label, value, note]) => (
            <Card key={label} tone="raised" padding="sm">
              <p className="text-ink-faint text-xs font-semibold tracking-[0.12em] uppercase">
                {label}
              </p>
              <p className="text-ink mt-3 font-semibold">{value}</p>
              <p className="text-ink-soft mt-1 text-xs leading-5">{note}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-16">
        <FoundationPlayground />
      </div>
    </div>
  );
}
