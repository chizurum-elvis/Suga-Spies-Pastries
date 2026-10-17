import { z } from "zod";

export const orderStatusSchema = z.enum([
  "confirmed",
  "completed",
  "cancelled",
  "discarded",
]);
export const fulfillmentStatusSchema = z.enum([
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivery_failed",
  "redelivery_requested",
  "redelivery_scheduled",
  "redelivery_out_for_delivery",
  "delivered",
  "discarded",
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;

type FulfillmentStage = {
  status: FulfillmentStatus;
  label: string;
  summary: string;
  ownerAction: string | null;
};

export const fulfillmentStages = [
  {
    status: "received",
    label: "Order received",
    summary: "Payment is confirmed and the pastry delivery is booked.",
    ownerAction: "Start preparing",
  },
  {
    status: "preparing",
    label: "Being prepared",
    summary: "The pastries are being prepared for the delivery date.",
    ownerAction: "Mark as ready",
  },
  {
    status: "ready",
    label: "Ready for delivery",
    summary: "The pastries are prepared and waiting to leave for delivery.",
    ownerAction: "Send out for delivery",
  },
  {
    status: "out_for_delivery",
    label: "Out for delivery",
    summary: "The order is on its way to the confirmed address.",
    ownerAction: "Mark as delivered",
  },
  {
    status: "delivered",
    label: "Delivered",
    summary: "The pastry order has been marked as delivered.",
    ownerAction: null,
  },
  {
    status: "delivery_failed",
    label: "Delivery missed",
    summary:
      "We could not complete the first delivery. Confirm or correct your address within 24 hours.",
    ownerAction: null,
  },
  {
    status: "redelivery_requested",
    label: "Redelivery requested",
    summary: "The owner will choose a redelivery date.",
    ownerAction: null,
  },
  {
    status: "redelivery_scheduled",
    label: "Redelivery scheduled",
    summary: "The new delivery date is confirmed.",
    ownerAction: null,
  },
  {
    status: "redelivery_out_for_delivery",
    label: "Out for redelivery",
    summary: "Your pastries are on their way to the corrected address.",
    ownerAction: null,
  },
  {
    status: "discarded",
    label: "Delivery closed",
    summary:
      "The pastries could not be delivered. A refund is being processed.",
    ownerAction: null,
  },
] as const satisfies readonly FulfillmentStage[];

const stageIndex = new Map(
  fulfillmentStages.map((stage, index) => [stage.status, index]),
);

export function fulfillmentStage(status: FulfillmentStatus) {
  return fulfillmentStages[stageIndex.get(status) ?? 0];
}

export function fulfillmentStageIndex(status: FulfillmentStatus) {
  return stageIndex.get(status) ?? 0;
}

export function nextFulfillmentStatus(status: FulfillmentStatus) {
  if (
    [
      "delivered",
      "discarded",
      "delivery_failed",
      "redelivery_requested",
      "redelivery_scheduled",
      "redelivery_out_for_delivery",
    ].includes(status)
  )
    return null;
  const next = fulfillmentStages[fulfillmentStageIndex(status) + 1];
  return next?.status ?? null;
}

export function orderStatusLabel(status: OrderStatus) {
  if (status === "cancelled") return "Cancelled";
  if (status === "discarded") return "Closed";
  return status === "completed" ? "Completed" : "Confirmed";
}

export const orderEventSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum([
    ...fulfillmentStatusSchema.options,
    "cancelled",
    "redelivery_date_selected",
    "redelivery_payment_expired",
  ]),
  title: z.string().min(2).max(80),
  message: z.string().min(2).max(300),
  occurredAt: z.iso.datetime({ offset: true }),
});

export type OrderEvent = z.infer<typeof orderEventSchema>;

export const fulfillmentTransitionSchema = z
  .strictObject({
    orderId: z.uuid(),
    expectedStatus: fulfillmentStatusSchema,
    nextStatus: fulfillmentStatusSchema,
    expectedVersion: z.coerce.number().int().min(1).max(2_147_483_647),
    idempotencyKey: z.uuid(),
  })
  .superRefine((value, context) => {
    if (nextFulfillmentStatus(value.expectedStatus) !== value.nextStatus) {
      context.addIssue({
        code: "custom",
        path: ["nextStatus"],
        message: "This order status change is not allowed.",
      });
    }
  });

export const fulfillmentTransitionResultSchema = z.strictObject({
  order_id: z.uuid(),
  fulfillment_status: fulfillmentStatusSchema,
  order_status: orderStatusSchema,
  order_version: z.number().int().min(1),
  order_updated_at: z.iso.datetime({ offset: true }),
  event_id: z.uuid(),
});
