import { z } from "zod";
import type { FulfillmentStatus, OrderStatus } from "@/lib/orders/status";

export const refundStatusSchema = z.enum([
  "queued",
  "pending",
  "succeeded",
  "failed",
  "needs_review",
]);
export type RefundStatus = z.infer<typeof refundStatusSchema>;
export const orderPaymentStatusSchema = z.enum([
  "paid",
  "refund_pending",
  "refunded",
  "refund_failed",
]);
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>;
export const refundViewSchema = z.strictObject({
  status: refundStatusSchema,
  amountCents: z.number().int().min(50).max(99_999_999),
  requestedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type RefundView = z.infer<typeof refundViewSchema>;
export const cancellationInputSchema = z.strictObject({
  expectedVersion: z.number().int().min(1).max(2_147_483_647),
  confirmed: z.literal(true),
});

export function cancellationEligibility(
  order: {
    status: OrderStatus;
    fulfillmentStatus: FulfillmentStatus;
    deadline: string;
  },
  now = Date.now(),
) {
  if (order.status === "cancelled")
    return {
      eligible: false,
      reason: "This order has already been cancelled.",
    };
  if (order.fulfillmentStatus !== "received" || order.status !== "confirmed")
    return {
      eligible: false,
      reason: "Preparation has started. This order can no longer be cancelled.",
    };
  if (
    !Number.isFinite(Date.parse(order.deadline)) ||
    now >= Date.parse(order.deadline)
  )
    return {
      eligible: false,
      reason:
        "The cancellation deadline has passed. This order can no longer be cancelled.",
    };
  return { eligible: true, reason: null };
}

export function orderPaymentLabel(status: OrderPaymentStatus) {
  return {
    paid: "Paid",
    refund_pending: "Refund processing",
    refunded: "Refund issued",
    refund_failed: "Refund needs attention",
  }[status];
}

export function refundMessage(status: RefundStatus) {
  if (status === "succeeded")
    return "Your full refund has been issued to the original payment method. Your bank may take 5–10 business days to show it.";
  if (status === "failed" || status === "needs_review")
    return "Your order is cancelled, but the refund needs our attention. We have been notified. Please contact us if you need help.";
  return "Your order is cancelled. We’re processing your full refund to the original payment method. You can check its progress here.";
}
