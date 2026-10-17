import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentPolicy, getPolicyRevision } from "@/lib/content/public-data";
import type { PolicyKey } from "@/lib/content/schema";

const policyKeys = ["terms", "privacy", "refund"] as const;
type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ v?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const titles: Record<PolicyKey, string> = {
    terms: "Terms of sale",
    privacy: "Privacy policy",
    refund: "Cancellation and refund policy",
  };
  return {
    title: policyKeys.includes(key as PolicyKey)
      ? titles[key as PolicyKey]
      : "Policy",
    robots: { index: false, follow: false },
  };
}

export default async function PolicyPage({ params, searchParams }: Props) {
  const { key } = await params;
  if (!policyKeys.includes(key as PolicyKey)) notFound();
  const { v } = await searchParams;
  if (v && !/^[1-9]\d{0,8}$/.test(v)) notFound();
  const policy = v
    ? await getPolicyRevision(key as PolicyKey, Number(v))
    : await getCurrentPolicy(key as PolicyKey);
  if (!policy) notFound();
  return (
    <article className="bg-canvas min-h-[65dvh] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
          Suga & Spies
        </p>
        <h1 className="font-display text-ink mt-3 text-3xl [overflow-wrap:anywhere] sm:text-4xl">
          {policy.content.title}
        </h1>
        <p className="text-ink-soft mt-3 text-xs">
          Published version {policy.version} ·{" "}
          {new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Toronto",
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(new Date(policy.publishedAt))}
        </p>
        <div className="border-border text-ink-soft mt-8 border-t pt-7 text-sm leading-8 [overflow-wrap:anywhere] whitespace-pre-wrap">
          {policy.content.body}
        </div>
      </div>
    </article>
  );
}
