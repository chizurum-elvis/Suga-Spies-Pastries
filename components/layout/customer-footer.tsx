import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { getPublishedSiteContent } from "@/lib/content/public-data";
import { contactPhoneHref } from "@/lib/content/schema";

export async function CustomerFooter() {
  const { contact, policies } = await getPublishedSiteContent();
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
            href={contactPhoneHref(contact.phone)}
            className="mt-4 inline-flex min-h-11 items-center rounded-md text-sm font-bold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
          >
            {contact.phone}
          </a>
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="mt-1 block w-fit text-sm font-semibold break-all text-white/85 underline underline-offset-4"
            >
              {contact.email}
            </a>
          ) : null}
          <div className="mt-3">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center rounded-md text-xs font-semibold text-white/60 hover:text-white"
            >
              Contact us
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-white/60">
            <Link
              href="/faq"
              className="min-h-11 content-center hover:text-white"
            >
              FAQ
            </Link>
            {(["terms", "privacy", "refund"] as const).map((key) =>
              policies[key] ? (
                <Link
                  key={key}
                  href={`/policies/${key}`}
                  className="min-h-11 content-center hover:text-white"
                >
                  {key === "terms"
                    ? "Terms"
                    : key === "privacy"
                      ? "Privacy"
                      : "Refund policy"}
                </Link>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/70">
        © {new Date().getFullYear()} Suga &amp; Spies. Toronto, Ontario.
      </div>
    </footer>
  );
}
