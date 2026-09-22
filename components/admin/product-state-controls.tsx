"use client";

import { useActionState, useEffect } from "react";
import { Archive, Eye, EyeOff, PackageCheck, PackageX } from "lucide-react";
import { useRouter } from "next/navigation";

import { CatalogueActionMessage } from "@/components/admin/catalogue-action-message";
import { Button } from "@/components/ui/button";
import {
  initialCatalogueActionState,
  type CatalogueActionState,
} from "@/lib/catalog/action-state";
import type { CatalogueStatus } from "@/lib/catalog/types";

type StateAction = (
  state: CatalogueActionState,
  data: FormData,
) => Promise<CatalogueActionState>;

export function ProductStateControls({
  action,
  productId,
  status,
  isAvailable,
  version,
}: {
  action: StateAction;
  productId: string;
  status: CatalogueStatus;
  isAvailable: boolean;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCatalogueActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.submissionId, state.status]);
  const confirmation =
    status === "archived"
      ? undefined
      : "This changes what customers can see or order. Continue?";
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation))
          event.preventDefault();
      }}
      className="grid gap-4"
    >
      <CatalogueActionMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="version" value={version} />
      {status !== "archived" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="submit"
            name="intent"
            value={status === "published" ? "unpublish" : "publish"}
            variant="secondary"
            disabled={pending}
          >
            {status === "published" ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            {status === "published" ? "Move to draft" : "Publish"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value={isAvailable ? "make_unavailable" : "make_available"}
            variant="secondary"
            disabled={pending || status !== "published"}
          >
            {isAvailable ? (
              <PackageX className="size-4" aria-hidden="true" />
            ) : (
              <PackageCheck className="size-4" aria-hidden="true" />
            )}
            {isAvailable ? "Mark unavailable" : "Mark available"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="archive"
            variant="destructive"
            disabled={pending}
            className="sm:col-span-2"
          >
            <Archive className="size-4" aria-hidden="true" />
            Archive product
          </Button>
        </div>
      ) : (
        <p className="text-ink-soft text-sm leading-6">
          This product is archived and hidden from the public catalogue.
          Historical order snapshots will remain intact when orders are added.
        </p>
      )}
    </form>
  );
}
