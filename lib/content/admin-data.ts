import "server-only";

import { contentKeySchema, type ContentKey } from "@/lib/content/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const contentLabels: Record<ContentKey, string> = {
  home: "Homepage",
  contact: "Contact details",
  faq: "Frequently asked questions",
  terms: "Terms of sale",
  privacy: "Privacy policy",
  refund: "Cancellation & refund policy",
};

export async function getAdminContent(contentKey?: ContentKey) {
  const db = await createServerSupabaseClient();
  let draftQuery = db
    .from("site_content_drafts")
    .select("key, body, version, updated_at");
  let publicationQuery = db
    .from("site_content_publications")
    .select("key, version, is_current, published_at")
    .order("version", { ascending: false });
  if (contentKey) {
    draftQuery = draftQuery.eq("key", contentKey);
    publicationQuery = publicationQuery.eq("key", contentKey).limit(20);
  } else {
    publicationQuery = publicationQuery.eq("is_current", true);
  }
  const [drafts, publications] = await Promise.all([
    draftQuery,
    publicationQuery,
  ]);
  if (drafts.error || publications.error)
    throw new Error("Website content could not be loaded.");
  const documents = (contentKey ? [contentKey] : contentKeySchema.options).map(
    (key) => ({
      key,
      draft: drafts.data?.find((item) => item.key === key) ?? null,
      current:
        publications.data?.find(
          (item) => item.key === key && item.is_current,
        ) ?? null,
      history: publications.data?.filter((item) => item.key === key) ?? [],
    }),
  );
  return documents;
}
