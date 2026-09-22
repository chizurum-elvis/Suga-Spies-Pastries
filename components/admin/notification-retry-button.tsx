"use client";

import { useActionState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  initialOrderActionState,
  type OrderActionState,
} from "@/lib/orders/action-state";

type RetryAction = (
  state: OrderActionState,
  data: FormData,
) => Promise<OrderActionState>;

export function NotificationRetryButton({
  action,
  notificationId,
  orderId,
}: {
  action: RetryAction;
  notificationId: string;
  orderId: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialOrderActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") {
      toast.success("Email queued", { description: state.message });
      router.refresh();
    }
  }, [router, state.message, state.status, state.submissionId]);
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="notificationId" value={notificationId} />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        isLoading={pending}
        loadingLabel="Queueing…"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Retry email
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-critical-ink text-xs" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
