import type { Metadata } from "next";
import Link from "next/link";

import { getPublicFaq } from "@/lib/content/public-data";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Ordering, delivery, payment, and cancellation answers for Suga & Spies pastries.",
};

export default async function FaqPage() {
  const faq = await getPublicFaq();
  return (
    <div className="bg-canvas min-h-[65dvh] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
          Before you order
        </p>
        <h1 className="font-display text-ink mt-3 text-3xl sm:text-4xl">
          Good to know
        </h1>
        <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6">
          A few helpful answers about your pastry delivery.
        </p>
        <div className="border-border mt-9 divide-y border-y">
          {faq.items.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="text-ink focus-visible:outline-brand cursor-pointer pr-4 text-base font-semibold [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-4">
                {item.question}
              </summary>
              <p className="text-ink-soft max-w-2xl pt-4 text-sm leading-7 [overflow-wrap:anywhere] whitespace-pre-line">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
        <p className="text-ink-soft mt-8 text-sm">
          Still have a question?{" "}
          <Link
            href="/contact"
            className="text-brand-strong font-bold underline underline-offset-4"
          >
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
