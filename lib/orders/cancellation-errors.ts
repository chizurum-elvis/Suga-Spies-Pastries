import { DeliveryError } from "@/lib/delivery/errors";

export function cancellationError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "42501")
    return new DeliveryError(
      "cancellation_forbidden",
      "Your session cannot cancel this order. Please sign in again.",
      403,
    );
  if (message.includes("order_not_found"))
    return new DeliveryError(
      "order_not_found",
      "This order is unavailable.",
      404,
    );
  if (message.includes("order_preparation_started"))
    return new DeliveryError(
      "preparation_started",
      "Preparation has started. This order can no longer be cancelled.",
      409,
    );
  if (message.includes("order_cancellation_deadline"))
    return new DeliveryError(
      "deadline_passed",
      "The cancellation deadline has passed. This order can no longer be cancelled.",
      409,
    );
  if (message.includes("conflict"))
    return new DeliveryError(
      "order_changed",
      "This order has changed. Refresh its status before trying again.",
      409,
    );
  return new DeliveryError(
    "cancellation_unavailable",
    "We could not confirm cancellation. Refresh the order to check its status before retrying.",
    503,
  );
}
