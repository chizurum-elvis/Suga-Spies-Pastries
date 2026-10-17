"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CancellationControl } from "@/components/orders/cancellation-control";
import { Button } from "@/components/ui/button";
import {
  cancelOwnerOrder,
  checkOrderRefund,
  checkRedeliveryFeeRefund,
} from "@/lib/orders/actions";
import { initialOrderActionState } from "@/lib/orders/action-state";
import type { OrderView } from "@/lib/payments/schema";

export function OwnerCancellationControl({ order }: { order: OrderView }) {
  const router = useRouter();
  return (
    <CancellationControl
      orderNumber={order.orderNumber}
      status={order.status}
      fulfillmentStatus={order.fulfillmentStatus}
      deadline={order.snapshot.cancellationDeadline}
      amountCents={order.snapshot.totalCents}
      owner
      onConfirm={async (reason) => {
        const data = new FormData();
        data.set("orderId", order.id);
        data.set("expectedVersion", String(order.version));
        data.set("reason", reason);
        data.set("confirmed", "yes");
        const result = await cancelOwnerOrder(initialOrderActionState, data);
        router.refresh();
        if (result.status !== "success")
          return (
            result.message ??
            "Cancellation could not be confirmed. Please refresh the order."
          );
        toast.success("Order cancelled", { description: result.message });
        return null;
      }}
    />
  );
}

export function RefundCheckControl({
  orderId,
  fee = false,
}: {
  orderId: string;
  fee?: boolean;
}) {
  const [state, action, pending] = useActionState(
    fee ? checkRedeliveryFeeRefund : checkOrderRefund,
    initialOrderActionState,
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Button
        type="submit"
        variant="secondary"
        isLoading={pending}
        loadingLabel="Checking Stripe…"
      >
        Check refund status
      </Button>
      {state.message ? (
        <p
          className="text-ink-soft text-sm leading-6"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
