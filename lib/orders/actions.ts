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
import { cancellationError } from "@/lib/orders/cancellation-errors";
import { processOrderRefunds } from "@/lib/orders/refund-processor";
import { processRedeliveryFeeRefunds } from "@/lib/orders/refund-processor";
import { redeliveryError } from "@/lib/orders/redelivery";

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
  if (error.message?.includes("order_cancelled"))
    return "This order was cancelled and cannot be prepared.";
  return "The order stage could not be saved. Please retry.";
}

export async function cancelOwnerOrder(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const input = z
    .strictObject({
      orderId: z.uuid(),
      expectedVersion: z.coerce.number().int().min(1).max(2_147_483_647),
      reason: z.string().trim().min(3).max(500),
      confirmed: z.literal("yes"),
    })
    .safeParse({
      orderId: formData.get("orderId"),
      expectedVersion: formData.get("expectedVersion"),
      reason: formData.get("reason"),
      confirmed: formData.get("confirmed"),
    });
  if (!input.success)
    return state("error", "Enter a reason and confirm the full cancellation.");
  const client = await authorizedClient();
  if (!client)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await client.rpc("cancel_order", {
    p_order_id: input.data.orderId,
    p_expected_version: input.data.expectedVersion,
    p_reason: input.data.reason,
  });
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/availability");
  if (result.error)
    return state("error", cancellationError(result.error).message);
  try {
    await processOrderRefunds(result.data);
  } catch {
    /* The refund job remains durable. */
  }
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  return state(
    "success",
    "Order cancelled. Its delivery space is released and the full refund is being tracked below.",
  );
}

export async function checkOrderRefund(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const id = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success) return state("error", "That order is invalid.");
  const client = await authorizedClient();
  if (!client)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const refund = await client
    .from("order_refunds")
    .select("id")
    .eq("order_id", id.data)
    .maybeSingle();
  if (refund.error || !refund.data)
    return state("error", "The refund record could not be loaded.");
  try {
    const result = await processOrderRefunds(refund.data.id);
    revalidatePath(`/admin/orders/${id.data}`);
    revalidatePath("/admin/orders");
    if (!result.configured || result.failures)
      return state(
        "error",
        "Stripe could not be reached. The order remains closed; please check again shortly.",
      );
    return state(
      "success",
      result.checked
        ? "Refund status checked with Stripe."
        : "A refund check is already running or was checked recently. Please wait a minute before checking again.",
    );
  } catch {
    return state(
      "error",
      "Refund status is temporarily unavailable. Please retry shortly.",
    );
  }
}

export async function checkRedeliveryFeeRefund(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const id = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success) return state("error", "That order is invalid.");
  const client = await authorizedClient();
  if (!client)
    return state("error", "Your owner session has expired. Sign in again.");
  const refund = await client
    .from("redelivery_fee_refunds")
    .select("id")
    .eq("order_id", id.data)
    .maybeSingle();
  if (refund.error || !refund.data)
    return state("error", "The fee refund could not be loaded.");
  try {
    const result = await processRedeliveryFeeRefunds(refund.data.id);
    revalidatePath(`/admin/orders/${id.data}`);
    if (!result.configured || result.failures)
      return state(
        "error",
        "Stripe could not be reached. Please check this fee refund again shortly.",
      );
    return state("success", "Fee refund status checked with Stripe.");
  } catch {
    return state(
      "error",
      "Fee refund status is temporarily unavailable. Please retry.",
    );
  }
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

export async function markOwnerDeliveryFailed(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const input = z
    .strictObject({
      orderId: z.uuid(),
      expectedVersion: z.coerce.number().int().positive(),
      fault: z.enum(["customer", "business"]),
      reason: z.string().trim().min(3).max(500),
      confirmed: z.literal("yes"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success)
    return state(
      "error",
      "Choose who caused the failed attempt and enter a short reason.",
    );
  const client = await authorizedClient();
  if (!client)
    return state("error", "Your owner session has expired. Sign in again.");
  const result = await client.rpc("mark_delivery_failed", {
    p_order_id: input.data.orderId,
    p_expected_version: input.data.expectedVersion,
    p_fault: input.data.fault,
    p_reason: input.data.reason,
  });
  if (result.error)
    return state("error", redeliveryError(result.error).message);
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  revalidatePath("/admin/orders");
  return state(
    "success",
    "Delivery attempt recorded. The customer has 24 hours to confirm or correct the address.",
  );
}

export async function chooseOwnerRedeliveryDate(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const input = z
    .strictObject({
      orderId: z.uuid(),
      expectedVersion: z.coerce.number().int().positive(),
      date: z.iso.date(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return state("error", "Choose a valid date.");
  const client = await authorizedClient();
  if (!client)
    return state("error", "Your owner session has expired. Sign in again.");
  const result = await client.rpc("select_redelivery_date", {
    p_order_id: input.data.orderId,
    p_expected_version: input.data.expectedVersion,
    p_date: input.data.date,
  });
  if (result.error)
    return state("error", redeliveryError(result.error).message);
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/availability");
  return state(
    "success",
    "Redelivery date saved. A complimentary attempt is confirmed now; a paid attempt awaits the customer's payment.",
  );
}

export async function setOwnerRedeliveryOutcome(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const input = z
    .strictObject({
      orderId: z.uuid(),
      expectedVersion: z.coerce.number().int().positive(),
      outcome: z.enum(["out_for_delivery", "delivered", "failed"]),
      confirmed: z.literal("yes"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return state("error", "Confirm the redelivery outcome.");
  const client = await authorizedClient();
  if (!client)
    return state("error", "Your owner session has expired. Sign in again.");
  const result = await client.rpc("mark_redelivery_outcome", {
    p_order_id: input.data.orderId,
    p_expected_version: input.data.expectedVersion,
    p_outcome: input.data.outcome,
  });
  if (result.error)
    return state("error", redeliveryError(result.error).message);
  if (input.data.outcome === "failed") {
    try {
      const refund = await client
        .from("order_refunds")
        .select("id")
        .eq("order_id", input.data.orderId)
        .single();
      if (refund.data) await processOrderRefunds(refund.data.id);
      await processRedeliveryFeeRefunds();
    } catch {
      /* Both durable refund jobs remain queued. */
    }
  }
  revalidatePath(`/admin/orders/${input.data.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/availability");
  return state(
    "success",
    input.data.outcome === "failed"
      ? "Second attempt closed. The full order and paid redelivery fee refunds are being processed."
      : "Redelivery stage updated.",
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
