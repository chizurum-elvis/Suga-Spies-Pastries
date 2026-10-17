import type { Metadata } from "next";
import Link from "next/link";

import { getPublicContact } from "@/lib/content/public-data";
import { contactPhoneHref } from "@/lib/content/schema";

export const metadata: Metadata = {
  title: "Contact Suga & Spies",
  description:
    "Contact the Suga & Spies pastry team about an order or delivery.",
};

export default async function ContactPage() {
  const contact = await getPublicContact();
  return (
    <div className="bg-canvas min-h-[65dvh] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
          We are here to help
        </p>
        <h1 className="font-display text-ink mt-3 text-3xl sm:text-4xl">
          Contact us
        </h1>
        <p className="text-ink-soft mt-4 max-w-xl text-sm leading-7">
          Questions about pastries or a delivery? Reach us directly. For an
          existing order, keep your order number handy.
        </p>
        <div className="border-border mt-9 space-y-6 border-y py-7">
          <div>
            <h2 className="text-ink text-sm font-bold">Phone</h2>
            <a
              className="text-brand-strong mt-2 inline-flex min-h-11 items-center text-lg font-semibold underline underline-offset-4"
              href={contactPhoneHref(contact.phone)}
            >
              {contact.phone}
            </a>
          </div>
          {contact.email ? (
            <div>
              <h2 className="text-ink text-sm font-bold">Email</h2>
              <a
                className="text-brand-strong mt-2 inline-flex min-h-11 items-center text-base font-semibold break-all underline underline-offset-4"
                href={`mailto:${contact.email}`}
              >
                {contact.email}
              </a>
            </div>
          ) : null}
        </div>
        <p className="text-ink-soft mt-8 text-sm">
          Looking for order details?{" "}
          <Link
            href="/faq"
            className="text-brand-strong font-bold underline underline-offset-4"
          >
            Read the FAQ
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
