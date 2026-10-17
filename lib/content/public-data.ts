import "server-only";

import { unstable_cache } from "next/cache";

import {
  contactContentSchema,
  faqContentSchema,
  homeContentSchema,
  policyDraftSchema,
  type ContentKey,
  type ContactContent,
  type FaqContent,
  type HomeContent,
  type PolicyContent,
  type PolicyKey,
} from "@/lib/content/schema";
import {
  defaultContactContent,
  defaultFaqContent,
  defaultHomeContent,
} from "@/lib/content/defaults";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const SITE_CONTENT_CACHE_TAG = "site-content";
type PublishedRow = {
  key: ContentKey;
  version: number;
  body: unknown;
  published_at: string;
};

async function loadPublishedRows(): Promise<PublishedRow[]> {
  if (getSupabaseConfigurationState().status !== "configured") return [];
  const result = await createPublicSupabaseClient()
    .from("site_content_publications")
    .select("key, version, body, published_at")
    .eq("is_current", true);
  if (result.error) {
    // Allows code to deploy before the new migration without pretending an
    // unrelated database outage is healthy published content.
    if (result.error.code === "42P01" || result.error.code === "PGRST205")
      return [];
    throw new Error("Published website content is unavailable.");
  }
  return result.data ?? [];
}

const cachedRows = unstable_cache(loadPublishedRows, ["site-content-v1"], {
  tags: [SITE_CONTENT_CACHE_TAG],
  revalidate: 300,
});

export async function getPublishedSiteContent() {
  const rows = await cachedRows();
  const row = (key: ContentKey) => rows.find((entry) => entry.key === key);
  return {
    home: homeContentSchema.parse(row("home")?.body ?? defaultHomeContent),
    contact: contactContentSchema.parse(
      row("contact")?.body ?? defaultContactContent,
    ),
    faq: faqContentSchema.parse(row("faq")?.body ?? defaultFaqContent),
    policies: {
      terms: parsePolicy(row("terms")),
      privacy: parsePolicy(row("privacy")),
      refund: parsePolicy(row("refund")),
    },
  };
}

function parsePolicy(row: PublishedRow | undefined) {
  if (!row) return null;
  return {
    version: row.version,
    publishedAt: row.published_at,
    content: policyDraftSchema.parse(row.body),
  };
}

export async function getPublicHome(): Promise<HomeContent> {
  return (await getPublishedSiteContent()).home;
}
export async function getPublicContact(): Promise<ContactContent> {
  return (await getPublishedSiteContent()).contact;
}
export async function getPublicFaq(): Promise<FaqContent> {
  return (await getPublishedSiteContent()).faq;
}
export async function getCurrentPolicy(key: PolicyKey) {
  return (await getPublishedSiteContent()).policies[key];
}

export async function getPolicyRevision(key: PolicyKey, version: number) {
  if (getSupabaseConfigurationState().status !== "configured") return null;
  const result = await createPublicSupabaseClient()
    .from("site_content_publications")
    .select("body, version, published_at")
    .eq("key", key)
    .eq("version", version)
    .maybeSingle();
  if (result.error) {
    if (result.error.code === "42P01" || result.error.code === "PGRST205")
      return null;
    throw new Error("Policy revision is unavailable.");
  }
  if (!result.data) return null;
  return {
    version: result.data.version,
    publishedAt: result.data.published_at,
    content: policyDraftSchema.parse(result.data.body) as PolicyContent,
  };
}
