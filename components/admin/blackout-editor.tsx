"use client";

import { useActionState, useEffect } from "react";
import { Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { FulfillmentActionMessage } from "@/components/admin/fulfillment-action-message";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { initialFulfillmentActionState } from "@/lib/fulfillment/action-state";
import { deleteBlackout, updateBlackout } from "@/lib/fulfillment/actions";
import type { AdminBlackout } from "@/lib/fulfillment/admin-data";

export function BlackoutEditor({
  blackout,
  maximumDate,
  minimumDate,
}: {
  blackout: AdminBlackout;
  maximumDate: string;
  minimumDate: string;
}) {
  const [updateState, updateAction, updating] = useActionState(
    updateBlackout,
    initialFulfillmentActionState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteBlackout,
    initialFulfillmentActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (updateState.status === "success" || deleteState.status === "success")
      router.refresh();
  }, [
    deleteState.status,
    deleteState.submissionId,
    router,
    updateState.status,
    updateState.submissionId,
  ]);
  return (
    <details className="border-border border bg-white p-4">
      <summary className="text-ink cursor-pointer font-bold">
        {blackout.dateLabel}
        <span className="text-ink-soft ml-2 text-sm font-normal">
          Delivery · Full day
        </span>
      </summary>
      <div className="mt-4 grid gap-4">
        {blackout.publicReason ? (
          <p className="text-ink-soft text-sm">
            Customer: {blackout.publicReason}
          </p>
        ) : null}
        {blackout.internalNote ? (
          <p className="text-ink-faint text-sm">
            Private: {blackout.internalNote}
          </p>
        ) : null}
        <form
          action={updateAction}
          className="border-border grid gap-3 border-t pt-4"
        >
          <FulfillmentActionMessage state={updateState} />
          <input type="hidden" name="id" value={blackout.id} />
          <input type="hidden" name="version" value={blackout.version} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              Date
              <Input
                name="date"
                type="date"
                min={minimumDate}
                max={maximumDate}
                defaultValue={blackout.date}
                required
              />
            </label>
            <input type="hidden" name="scope" value="delivery" />
          </div>
          <label className="grid gap-1.5 text-sm font-bold">
            Customer-facing reason
            <Input
              name="publicReason"
              maxLength={120}
              defaultValue={blackout.publicReason ?? ""}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Private owner note
            <Textarea
              name="internalNote"
              maxLength={500}
              defaultValue={blackout.internalNote ?? ""}
              className="min-h-20"
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            isLoading={updating}
            loadingLabel="Saving…"
            className="justify-self-start"
          >
            <Save className="size-4" aria-hidden="true" />
            Save changes
          </Button>
        </form>
        <form
          action={deleteAction}
          className="border-critical-ink/15 border-t pt-3"
        >
          <FulfillmentActionMessage state={deleteState} />
          <input type="hidden" name="id" value={blackout.id} />
          <input type="hidden" name="version" value={blackout.version} />
          <Button
            type="submit"
            variant="quiet"
            size="sm"
            className="text-critical-ink mt-2"
            isLoading={deleting}
            loadingLabel="Removing…"
            onClick={(event) => {
              if (
                !window.confirm(
                  "Remove this blackout and reopen the normal schedule?",
                )
              )
                event.preventDefault();
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove blackout
          </Button>
        </form>
      </div>
    </details>
  );
}
