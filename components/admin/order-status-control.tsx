"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal, ModalClose } from "@/components/ui/modal";
import {
  initialOrderActionState,
  type OrderActionState,
} from "@/lib/orders/action-state";
import {
  fulfillmentStage,
  nextFulfillmentStatus,
  type FulfillmentStatus,
} from "@/lib/orders/status";

type StatusAction = (
  state: OrderActionState,
  data: FormData,
) => Promise<OrderActionState>;

export function OrderStatusControl({
  action,
  currentStatus,
  idempotencyKey,
  orderId,
  orderNumber,
  version,
}: {
  action: StatusAction;
  currentStatus: FulfillmentStatus;
  idempotencyKey: string;
  orderId: string;
  orderNumber: string;
  version: number;
}) {
  const nextStatus = nextFulfillmentStatus(currentStatus);
  const [state, formAction, pending] = useActionState(
    action,
    initialOrderActionState,
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success("Order stage updated", { description: state.message });
    router.refresh();
    const close = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(close);
  }, [router, state.message, state.status, state.submissionId]);

  if (!nextStatus)
    return (
      <div className="border-sage-ink/20 bg-sage text-sage-ink flex items-center gap-3 rounded-md border p-4 text-sm font-bold">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        Fulfilment is complete.
      </div>
    );

  const current = fulfillmentStage(currentStatus);
  const next = fulfillmentStage(nextStatus);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button className="w-full sm:w-auto">
          {current.ownerAction}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      }
      title={current.ownerAction ?? "Update order"}
      description={`Move ${orderNumber} from “${current.label}” to “${next.label}”. The customer email will be queued after the update is saved.`}
    >
      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="expectedStatus" value={currentStatus} />
        <input type="hidden" name="nextStatus" value={nextStatus} />
        <input type="hidden" name="expectedVersion" value={version} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        {state.status === "error" && state.message ? (
          <div
            className="border-critical-ink/20 bg-critical text-critical-ink rounded-md border p-3 text-sm font-bold"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}
        <p className="text-ink-soft text-sm leading-6">
          {next.summary} Status history cannot be edited after it is recorded.
        </p>
        <div className="border-border flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <ModalClose asChild>
            <Button type="button" variant="quiet" disabled={pending}>
              Keep current stage
            </Button>
          </ModalClose>
          <Button
            type="submit"
            isLoading={pending}
            loadingLabel="Saving stage…"
          >
            Confirm {next.label.toLowerCase()}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
