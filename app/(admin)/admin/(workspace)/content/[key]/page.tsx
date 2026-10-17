import { AdminLink as Link } from "@/components/navigation/admin-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SiteContentEditor } from "@/components/admin/site-content-editor";
import { contentLabels, getAdminContent } from "@/lib/content/admin-data";
import { contentKeySchema, contentSchemaFor } from "@/lib/content/schema";

export default async function ContentDocumentPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key: rawKey } = await params;
  const parsed = contentKeySchema.safeParse(rawKey);
  if (!parsed.success) notFound();
  const key = parsed.data;
  const document = (await getAdminContent(key)).find(
    (item) => item.key === key,
  );
  if (!document?.draft) throw new Error("This content draft is unavailable.");
  const draft = contentSchemaFor(key).safeParse(document.draft.body);
  if (!draft.success) throw new Error("This content draft needs repair.");
  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <Link
        href="/admin/content"
        className="text-brand-strong inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All website content
      </Link>
      <header>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
          Website content
        </p>
        <h1 className="font-display text-ink mt-3 text-3xl sm:text-4xl">
          {contentLabels[key]}
        </h1>
        <p className="text-ink-soft mt-2 text-sm">
          {document.current
            ? `Published version ${document.current.version}. Changes stay private until you publish.`
            : "No public version yet. Save a draft before publishing."}
        </p>
      </header>
      <SiteContentEditor
        key={`${key}:${document.draft.version}`}
        contentKey={key}
        version={document.draft.version}
        initialBody={draft.data}
        publishedVersion={document.current?.version ?? null}
        history={document.history.map((item) => ({
          version: item.version,
          publishedAt: item.published_at,
        }))}
      />
    </div>
  );
}
