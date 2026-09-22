import { randomUUID } from "node:crypto";

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { CATALOGUE_CACHE_TAG } from "@/lib/catalog/public-data";
import { imageMetadataSchema } from "@/lib/catalog/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const extensions = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function hasValidSignature(bytes: Uint8Array, mime: keyof typeof extensions) {
  if (mime === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  if (mime === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return String.fromCharCode(...bytes.slice(4, 12)).startsWith("ftypavi");
}

async function ownerClient() {
  const supabase = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(supabase);
  return access.status === "authorized" ? supabase : null;
}

function refresh(productId: string) {
  revalidateTag(CATALOGUE_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath(`/admin/menu/${productId}`);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return jsonError("Cross-origin uploads are not allowed.", 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 128 * 1024)
    return jsonError("The upload is larger than 5 MB.", 413);
  const supabase = await ownerClient();
  if (!supabase) return jsonError("Owner authorization is required.", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("The upload could not be read.", 400);
  }
  const validation = imageMetadataSchema.safeParse({
    productId: formData.get("productId"),
    altText: formData.get("altText"),
    objectPosition: formData.get("objectPosition"),
  });
  if (!validation.success)
    return jsonError(
      "Add useful alternative text and a valid image focus position.",
      400,
    );
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0)
    return jsonError("Choose an image to upload.", 400);
  if (file.size > MAX_BYTES)
    return jsonError("The image must be 5 MB or smaller.", 413);
  if (!(file.type in extensions))
    return jsonError("Use an AVIF, JPEG, PNG, or WebP image.", 415);

  const mime = file.type as keyof typeof extensions;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(bytes, mime))
    return jsonError(
      "The file contents do not match the selected image type.",
      415,
    );

  const productResult = await supabase
    .from("products")
    .select("id")
    .eq("id", validation.data.productId)
    .maybeSingle();
  if (productResult.error || !productResult.data)
    return jsonError("The product could not be verified.", 404);
  const primaryResult = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", validation.data.productId)
    .eq("is_primary", true);
  if (primaryResult.error)
    return jsonError("Existing product images could not be verified.", 503);

  const path = `${validation.data.productId}/${randomUUID()}.${extensions[mime]}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: mime,
    upsert: false,
  });
  if (upload.error)
    return jsonError("The image could not be uploaded. Please try again.", 503);

  const imageResult = await supabase
    .from("product_images")
    .insert({
      product_id: validation.data.productId,
      source_type: "storage",
      path,
      alt_text: validation.data.altText,
      object_position: validation.data.objectPosition,
      is_primary: !primaryResult.count,
    })
    .select("id")
    .single();
  if (imageResult.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return jsonError("The image metadata could not be saved.", 503);
  }
  refresh(validation.data.productId);
  return NextResponse.json(
    {
      ok: true,
      message: "Product image uploaded.",
      imageId: imageResult.data.id,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

const deleteSchema = z.strictObject({ productId: z.uuid(), imageId: z.uuid() });

export async function DELETE(request: Request) {
  if (!isSameOrigin(request))
    return jsonError("Cross-origin removals are not allowed.", 403);
  const supabase = await ownerClient();
  if (!supabase) return jsonError("Owner authorization is required.", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The removal request is invalid.", 400);
  }
  const validation = deleteSchema.safeParse(body);
  if (!validation.success)
    return jsonError("The removal request is invalid.", 400);
  const imageResult = await supabase
    .from("product_images")
    .select("id, product_id, source_type, path, is_primary")
    .eq("id", validation.data.imageId)
    .eq("product_id", validation.data.productId)
    .maybeSingle();
  if (imageResult.error || !imageResult.data)
    return jsonError("The image was not found.", 404);
  const deletion = await supabase
    .from("product_images")
    .delete()
    .eq("id", validation.data.imageId)
    .eq("product_id", validation.data.productId);
  if (deletion.error) return jsonError("The image could not be removed.", 503);
  let warning: string | undefined;
  if (imageResult.data.source_type === "storage") {
    const storageRemoval = await supabase.storage
      .from(BUCKET)
      .remove([imageResult.data.path]);
    if (storageRemoval.error)
      warning =
        "The menu image was removed, but its unused storage file needs cleanup.";
  }
  if (imageResult.data.is_primary) {
    const replacement = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", validation.data.productId)
      .order("display_order")
      .limit(1)
      .maybeSingle();
    if (replacement.data) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", replacement.data.id);
    }
  }
  refresh(validation.data.productId);
  return NextResponse.json(
    { ok: true, message: warning ?? "Product image removed.", warning },
    { headers: { "Cache-Control": "no-store" } },
  );
}
