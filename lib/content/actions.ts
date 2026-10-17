"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { SITE_CONTENT_CACHE_TAG } from "@/lib/content/public-data";
import {
  contentKeySchema,
  contentSchemaFor,
  publishablePolicySchema,
  type ContentKey,
} from "@/lib/content/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type ContentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  submissionId: string;
};

const result = (
  status: "success" | "error",
  message: string,
): ContentActionState => ({
  status,
  message,
  submissionId: randomUUID(),
});

const versionSchema = z.coerce.number<number>().int().positive();

async function ownerClient() {
  const db = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(db);
  return access.status === "authorized" ? { db, owner: access.owner } : null;
}

function refreshPublicContent(key: ContentKey) {
  updateTag(SITE_CONTENT_CACHE_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/faq");
  revalidatePath("/contact");
  if (["terms", "privacy", "refund"].includes(key)) {
    revalidatePath(`/policies/${key}`);
    revalidatePath("/checkout");
  }
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${key}`);
}

function parseBody(key: ContentKey, raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > 30000)
    return null;
  try {
    return contentSchemaFor(key).safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveSiteContent(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const access = await ownerClient();
  if (!access)
    return result("error", "Your owner session has ended. Sign in again.");
  const key = contentKeySchema.safeParse(formData.get("key"));
  const version = versionSchema.safeParse(formData.get("version"));
  if (!key.success || !version.success)
    return result("error", "Reload this page and try again.");
  const body = parseBody(key.data, formData.get("body"));
  if (!body?.success)
    return result(
      "error",
      body && !body.success
        ? (body.error.issues[0]?.message ??
            "Check the content fields and try again.")
        : "This content could not be read or is too long. Check the fields and shorten it if needed.",
    );
  const saved = await access.db
    .from("site_content_drafts")
    .update({
      body: body.data as Json,
      version: version.data + 1,
      updated_at: new Date().toISOString(),
      updated_by: access.owner.id,
    })
    .eq("key", key.data)
    .eq("version", version.data)
    .select("version")
    .maybeSingle();
  if (saved.error)
    return result("error", "The draft could not be saved. Please retry.");
  if (!saved.data)
    return result(
      "error",
      "This draft changed elsewhere. Reload before saving.",
    );
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${key.data}`);
  return result(
    "success",
    "Draft saved. Customers cannot see it until you publish.",
  );
}

export async function publishSiteContent(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const access = await ownerClient();
  if (!access)
    return result("error", "Your owner session has ended. Sign in again.");
  const key = contentKeySchema.safeParse(formData.get("key"));
  const version = versionSchema.safeParse(formData.get("version"));
  if (!key.success || !version.success)
    return result("error", "Reload this page and try again.");
  const draft = await access.db
    .from("site_content_drafts")
    .select("body, version")
    .eq("key", key.data)
    .single();
  if (draft.error || !draft.data)
    return result("error", "The draft could not be loaded.");
  if (draft.data.version !== version.data)
    return result(
      "error",
      "This draft changed elsewhere. Reload before publishing.",
    );
  const schema = ["terms", "privacy", "refund"].includes(key.data)
    ? publishablePolicySchema
    : contentSchemaFor(key.data);
  if (!schema.safeParse(draft.data.body).success)
    return result(
      "error",
      "Complete and save valid content before publishing.",
    );
  if (
    ["terms", "privacy", "refund"].includes(key.data) &&
    formData.get("approved") !== "yes"
  )
    return result(
      "error",
      "Confirm that the policy wording is approved before publishing.",
    );
  const published = await access.db.rpc("publish_site_content", {
    p_key: key.data,
    p_version: version.data,
  });
  if (published.error)
    return result(
      "error",
      "Publication failed or the draft changed. Reload and retry.",
    );
  refreshPublicContent(key.data);
  return result("success", "Published. Customers can now see this version.");
}

export async function restoreSiteContent(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const access = await ownerClient();
  if (!access)
    return result("error", "Your owner session has ended. Sign in again.");
  const key = contentKeySchema.safeParse(formData.get("key"));
  const source = versionSchema.safeParse(formData.get("sourceVersion"));
  const current = versionSchema.safeParse(formData.get("version"));
  if (!key.success || !source.success || !current.success)
    return result("error", "Reload this page and try again.");
  const prior = await access.db
    .from("site_content_publications")
    .select("body")
    .eq("key", key.data)
    .eq("version", source.data)
    .maybeSingle();
  if (prior.error || !prior.data)
    return result("error", "That published version was not found.");
  if (!contentSchemaFor(key.data).safeParse(prior.data.body).success)
    return result("error", "That version cannot be restored safely.");
  const saved = await access.db
    .from("site_content_drafts")
    .update({
      body: prior.data.body,
      version: current.data + 1,
      updated_at: new Date().toISOString(),
      updated_by: access.owner.id,
    })
    .eq("key", key.data)
    .eq("version", current.data)
    .select("version")
    .maybeSingle();
  if (saved.error || !saved.data)
    return result("error", "The draft changed. Reload before restoring.");
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${key.data}`);
  return result(
    "success",
    "Older content copied into a new draft. Publish to make it public.",
  );
}
