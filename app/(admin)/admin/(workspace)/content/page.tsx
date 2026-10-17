import { AdminLink as Link } from "@/components/navigation/admin-link";
import { ArrowRight, FileText } from "lucide-react";

import { contentLabels, getAdminContent } from "@/lib/content/admin-data";

const descriptions = {
  home: "The welcome and pastry-story copy around the photo-led menu.",
  contact: "The public support number and optional email address.",
  faq: "Short, practical answers customers can read before ordering.",
  terms: "Owner-approved terms of sale. No draft is public.",
  privacy: "Owner-approved privacy wording. No draft is public.",
  refund: "Owner-approved cancellation and refund wording. No draft is public.",
} as const;

export default async function ContentPage() {
  const documents = await getAdminContent();
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-ink">Website content</h1>
        <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6">
          Edit a private draft, review it, then publish. Menu prices, delivery
          rates, and scheduling are managed in their own sections.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {documents.map(({ key, current }) => (
          <Link
            key={key}
            href={`/admin/content/${key}`}
            className="border-border hover:border-brand/40 focus-visible:outline-brand flex min-h-36 flex-col justify-between border bg-white p-5 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2"
          >
            <span className="flex items-start justify-between gap-4">
              <FileText
                className="text-brand size-5 shrink-0"
                aria-hidden="true"
              />
              <span className="text-ink-soft text-xs">
                {current ? "Published" : "Not published"}
              </span>
            </span>
            <span className="mt-4">
              <strong className="text-ink block text-lg">
                {contentLabels[key]}
              </strong>
              <span className="text-ink-soft mt-1 block text-sm leading-5">
                {descriptions[key]}
              </span>
            </span>
            <span className="text-brand-strong mt-4 inline-flex items-center gap-2 text-sm font-bold">
              Edit content <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
