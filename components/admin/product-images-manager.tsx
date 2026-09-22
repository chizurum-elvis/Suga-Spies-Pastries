"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { CatalogueImage } from "@/lib/catalog/types";

type RequestState = { tone: "success" | "error"; message: string } | null;

export function ProductImagesManager({
  images,
  productId,
}: {
  images: CatalogueImage[];
  productId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>(null);

  async function upload(formData: FormData) {
    setPending(true);
    setRequestState(null);
    try {
      const response = await fetch("/admin/menu-images", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(payload.message ?? "The image could not be uploaded.");
      setRequestState({
        tone: "success",
        message: payload.message ?? "Image uploaded.",
      });
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setRequestState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The image could not be uploaded.",
      });
    } finally {
      setPending(false);
    }
  }

  async function remove(image: CatalogueImage) {
    if (!window.confirm(`Remove the image described as “${image.alt}”?`))
      return;
    setPending(true);
    setRequestState(null);
    try {
      const response = await fetch("/admin/menu-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, imageId: image.id }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(payload.message ?? "The image could not be removed.");
      setRequestState({
        tone: "success",
        message: payload.message ?? "Image removed.",
      });
      router.refresh();
    } catch (error) {
      setRequestState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The image could not be removed.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      {requestState ? (
        <div
          role={requestState.tone === "error" ? "alert" : "status"}
          className={
            requestState.tone === "error"
              ? "border-critical-ink/20 bg-critical text-critical-ink rounded-md border p-3 text-sm font-bold"
              : "border-sage-ink/20 bg-sage text-sage-ink rounded-md border p-3 text-sm font-bold"
          }
        >
          {requestState.message}
        </div>
      ) : null}
      {images.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {images.map((image) => (
            <li
              key={image.id}
              className="border-border overflow-hidden rounded-lg border"
            >
              <div className="bg-canvas-strong relative aspect-[4/3]">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  style={{ objectPosition: image.objectPosition }}
                  className="object-cover"
                />
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-bold">{image.alt}</p>
                  {image.isPrimary ? (
                    <p className="text-brand mt-1 text-xs font-extrabold">
                      Primary image
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="quiet"
                  size="icon"
                  disabled={pending}
                  onClick={() => remove(image)}
                  aria-label={`Remove ${image.alt}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-border bg-canvas-strong text-ink-soft rounded-md border border-dashed p-6 text-center text-sm">
          No product image yet. A product needs at least one image before it can
          be published.
        </p>
      )}
      <form
        ref={formRef}
        action={upload}
        className="border-border grid gap-4 rounded-lg border p-4"
        encType="multipart/form-data"
      >
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="objectPosition" value="50% 50%" />
        <Field
          id="product-image"
          label="Image file"
          description="AVIF, JPEG, PNG, or WebP. Maximum 5 MB."
          required
        >
          {(props) => (
            <Input
              {...props}
              name="image"
              type="file"
              accept="image/avif,image/jpeg,image/png,image/webp"
              required
              disabled={pending}
            />
          )}
        </Field>
        <Field
          id="product-image-alt"
          label="Alternative text"
          description="Describe the pastry itself; do not write “image of”."
          required
        >
          {(props) => (
            <Input
              {...props}
              name="altText"
              maxLength={240}
              required
              disabled={pending}
            />
          )}
        </Field>
        <Button
          type="submit"
          isLoading={pending}
          loadingLabel="Uploading image…"
          className="sm:justify-self-start"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          Upload image
        </Button>
      </form>
    </div>
  );
}
