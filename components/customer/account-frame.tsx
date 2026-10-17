import type { ReactNode } from "react";
import Link from "next/link";

export function AccountFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="border-border grid gap-7 border-b pb-7 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)] md:items-end">
        <div>
          <p className="text-brand-strong text-xs font-bold tracking-[0.12em] uppercase">
            {eyebrow}
          </p>
          <h1 className="font-display text-ink mt-3 max-w-2xl text-[clamp(2rem,5vw,3.35rem)] leading-[1.08] text-balance">
            {title}
          </h1>
        </div>
        <p className="text-ink-soft max-w-sm text-sm leading-6 md:justify-self-end">
          {description}
        </p>
      </div>
      <div className="mt-8">{children}</div>
      <p className="text-ink-soft mt-9 text-sm">
        Just browsing?{" "}
        <Link
          href="/menu"
          className="text-brand-strong font-bold underline underline-offset-4"
        >
          See the pastries
        </Link>{" "}
        — no account needed to order.
      </p>
    </div>
  );
}
