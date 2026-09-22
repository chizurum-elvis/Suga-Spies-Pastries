"use client";

import { useActionState, useEffect } from "react";
import { Archive, PackageCheck, PackageX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  initialCatalogueActionState,
  type CatalogueActionState,
} from "@/lib/catalog/action-state";

type NestedAction = (
  state: CatalogueActionState,
  data: FormData,
) => Promise<CatalogueActionState>;

export function NestedStateButton({
  action,
  available,
  itemId,
  itemType,
  productId,
  archived = false,
}: {
  action: NestedAction;
  available?: boolean;
  itemId: string;
  itemType: "variant" | "option_group" | "option_value";
  productId: string;
  archived?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCatalogueActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.submissionId, state.status]);
  if (archived)
    return <span className="text-ink-faint text-xs font-bold">Archived</span>;
  const isGroup = itemType === "option_group";
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-end gap-1.5"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemType" value={itemType} />
      {state.status === "error" ? (
        <span
          className="text-critical-ink w-full text-right text-xs font-bold"
          role="alert"
        >
          {state.message}
        </span>
      ) : null}
      {!isGroup ? (
        <Button
          type="submit"
          name="intent"
          value={available ? "make_unavailable" : "make_available"}
          variant="quiet"
          size="sm"
          disabled={pending}
        >
          {available ? (
            <PackageX className="size-3.5" aria-hidden="true" />
          ) : (
            <PackageCheck className="size-3.5" aria-hidden="true" />
          )}
          {available ? "Pause" : "Make available"}
        </Button>
      ) : null}
      <Button
        type="submit"
        name="intent"
        value="archive"
        variant="quiet"
        size="sm"
        disabled={pending}
        onClick={(event) => {
          if (
            !window.confirm(
              "Archive this choice? Existing order snapshots will not be changed.",
            )
          )
            event.preventDefault();
        }}
      >
        <Archive className="size-3.5" aria-hidden="true" />
        Archive
      </Button>
    </form>
  );
}
