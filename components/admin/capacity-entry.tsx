"use client";

import { useActionState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { FulfillmentActionMessage } from "@/components/admin/fulfillment-action-message";
import { Button } from "@/components/ui/button";
import { initialFulfillmentActionState } from "@/lib/fulfillment/action-state";
import { releaseCapacityAdjustment } from "@/lib/fulfillment/actions";
import type { AdminCapacityAdjustment } from "@/lib/fulfillment/admin-data";

export function CapacityEntry({ entry }: { entry: AdminCapacityAdjustment }) {
  const [state, action, pending] = useActionState(
    releaseCapacityAdjustment,
    initialFulfillmentActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status, state.submissionId]);
  return (
    <li className="border-border border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-ink font-bold">{entry.dateLabel}</p>
          <p className="text-ink-soft mt-1 text-sm capitalize">
            {entry.source} order
            {entry.customerReference ? ` · ${entry.customerReference}` : ""}
          </p>
          {entry.internalNote ? (
            <p className="text-ink-faint mt-1 text-xs">{entry.internalNote}</p>
          ) : null}
        </div>
        {entry.source !== "website" ? (
          <form action={action}>
            <input type="hidden" name="id" value={entry.id} />
            <Button
              type="submit"
              variant="quiet"
              size="sm"
              isLoading={pending}
              loadingLabel="Releasing…"
              onClick={(event) => {
                if (!window.confirm("Release this external order space?"))
                  event.preventDefault();
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Release space
            </Button>
          </form>
        ) : (
          <p className="text-ink-soft text-xs">
            Reserved by a paid website order
          </p>
        )}
      </div>
      <div className="mt-3">
        <FulfillmentActionMessage state={state} />
      </div>
    </li>
  );
}
