"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import {
  fulfillmentTransitionResultSchema,
  fulfillmentTransitionSchema,
} from "@/lib/orders/status";
import type { OrderActionState } from "@/lib/orders/action-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function state(status: "error" | "success", message: string): OrderActionState {
  return { status, message, submissionId: randomUUID() };
}

async function authorizedClient() {
  const client = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(client);
  return access.status === "authorized" ? client : null;
}

function transitionError(error: { code?: string; message?: string }) {
  if (error.code === "42501" || error.message?.includes("forbidden"))
    return "Your owner session is no longer allowed to change orders. Sign in again.";
  if (error.message?.includes("order_transition_conflict"))
    return "This order changed in another tab. The latest order has been loaded.";
  if (
    error.message?.includes("order_transition_invalid") ||
    error.message?.includes("use_order_transition_workflow")
  )
    return "That order stage change is not allowed.";
  if (error.message?.includes("order_not_found"))
    return "This order is no longer available.";
  return "The order stage could not be saved. Please retry.";
}

export async function transitionOrderFulfillment(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const input = fulfillmentTransitionSchema.safeParse({
    orderId: formData.get("orderId"),
    expectedStatus: formData.get("expectedStatus"),
    nextStatus: formData.get("nextStatus"),
    expectedVersion: formData.get("expectedVersion"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!input.success)
    return state(
      "error",
      "That order stage change is invalid. Refresh and retry.",
    );

  const client = await authorizedClient();
  if (!client)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );

  const result = await client.rpc("transition_order_fulfillment", {
    p_order_id: input.data.orderId,
    p_expected_status: input.data.expectedStatus,
    p_next_status: input.data.nextStatus,
    p_expected_version: input.data.expectedVersion,
    p_idempotency_key: input.data.idempotencyKey,
  });
  if (result.error) {
    revalidatePath(`/admin/orders/${input.data.orderId}`);
    return state("error", transitionError(result.error));
  }
  const transition = fulfillmentTransitionResultSchema.safeParse(
    result.data?.[0],
  );
  if (!transition.success)
    return state("error", "The saved order stage could not be verified.");

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  return state(
    "success",
    `Order updated to ${input.data.nextStatus.replaceAll("_", " ")}.`,
  );
}

const retryNotificationSchema = z.strictObject({
  orderId: z.uuid(),
  notificationId: z.uuid(),
});

export async function retryOrderNotification(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const input = retryNotificationSchema.safeParse({
    orderId: formData.get("orderId"),
    notificationId: formData.get("notificationId"),
  });
  if (!input.success)
    return state("error", "That notification retry is invalid.");
  const client = await authorizedClient();
  if (!client)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await client.rpc("retry_order_notification", {
    p_order_id: input.data.orderId,
    p_notification_id: input.data.notificationId,
  });
  if (result.error) {
    const message = result.error.message?.includes("retry_window_expired")
      ? "This email is outside the safe automatic retry window. Contact the customer directly."
      : result.error.message?.includes("notification_not_retryable")
        ? "This notification is no longer waiting for a retry."
        : "The notification could not be queued again.";
    return state("error", message);
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  return state(
    "success",
    "The email has been queued for another safe attempt.",
  );
}
