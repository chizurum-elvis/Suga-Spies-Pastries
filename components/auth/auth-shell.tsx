import type { ReactNode } from "react";
import { Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { SkipLink } from "@/components/layout/skip-link";
import { BUSINESS_TIME_ZONE } from "@/lib/config/business";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const trustNotes = [
  {
    icon: LockKeyhole,
    title: "Private by design",
    description: "Only the approved owner identity can enter this workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Server verified",
    description: "Identity and owner access are checked again before data use.",
  },
  {
    icon: Clock3,
    title: "Toronto business time",
    description: `Operational dates and cutoffs use ${BUSINESS_TIME_ZONE}.`,
  },
] as const;

export function AuthShell({
  children,
  description,
  eyebrow,
  title,
}: AuthShellProps) {
  return (
    <div className="bg-canvas text-ink min-h-dvh lg:grid lg:grid-cols-[minmax(20rem,0.78fr)_minmax(30rem,1.22fr)]">
      <SkipLink />

      <aside className="bg-ink text-surface relative hidden min-h-dvh overflow-hidden px-8 py-10 lg:flex lg:flex-col xl:px-12 xl:py-12">
        <div
          aria-hidden="true"
          className="border-brand/50 absolute -top-32 -left-32 size-[30rem] rounded-full border"
        />
        <div
          aria-hidden="true"
          className="border-butter/25 absolute right-[-12rem] bottom-[-8rem] size-[32rem] rotate-12 rounded-[5rem] border"
        />
        <div
          aria-hidden="true"
          className="bg-brand/20 absolute top-[44%] right-[-5rem] h-px w-[22rem] -rotate-12"
        />

        <BrandMark inverted className="relative z-10" />

        <div className="relative z-10 my-auto max-w-md py-16">
          <p className="text-butter text-xs font-extrabold tracking-[0.16em] uppercase">
            Owner access
          </p>
          <p className="font-display mt-5 text-[3rem] leading-[0.94] text-balance xl:text-[4rem]">
            The quiet side of every celebration.
          </p>
          <p className="mt-6 max-w-sm text-sm leading-7 text-white/70">
            Orders, production, availability, and business settings stay behind
            one deliberate security boundary.
          </p>
        </div>

        <ul className="relative z-10 grid gap-5 border-t border-white/12 pt-7">
          {trustNotes.map((note) => {
            const Icon = note.icon;
            return (
              <li key={note.title} className="flex gap-3.5">
                <span className="bg-brand/25 text-butter grid size-9 shrink-0 place-items-center rounded-md">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-white">
                    {note.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/60">
                    {note.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 outline-none lg:grid lg:min-h-dvh lg:place-items-center"
      >
        <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-8 sm:py-10 lg:px-10 lg:py-16">
          <div className="border-border flex items-center justify-between gap-4 border-b pb-5 lg:hidden">
            <BrandMark />
            <span className="bg-brand-soft text-brand-strong rounded-full px-3 py-1.5 text-xs font-extrabold">
              Owner only
            </span>
          </div>

          <div className="mt-10 lg:mt-0">
            <p className="text-brand text-xs font-extrabold tracking-[0.14em] uppercase">
              {eyebrow}
            </p>
            <h1 className="font-display mt-3 text-[2.65rem] leading-[0.95] text-balance sm:text-[3.25rem]">
              {title}
            </h1>
            <p className="text-ink-soft mt-4 max-w-lg text-sm leading-6 sm:text-base sm:leading-7">
              {description}
            </p>
          </div>

          <div className="mt-8">{children}</div>

          <div className="text-ink-faint border-border mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs leading-5">
            <p>Private Suga Spies workspace</p>
            <Link
              href="/"
              className="text-ink-soft hover:text-brand-strong decoration-border-strong rounded-sm font-bold underline underline-offset-4 transition-colors"
            >
              Return to storefront
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
