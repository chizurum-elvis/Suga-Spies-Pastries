import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";
import { sha256 } from "@/lib/fulfillment/checkout-draft";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { purchaseSnapshotSchema, type OrderView } from "@/lib/payments/schema";
import type {
  OrderEventRow,
  OrderRow,
  OrderRefundRow,
  RedeliveryRow,
} from "@/lib/payments/database";
import { DeliveryError } from "@/lib/delivery/errors";
import { deliveryAddressSchema } from "@/lib/delivery/schema";
import { localDateStartInstant } from "@/lib/fulfillment/rules";

export function orderCookieName(id: string) {
  return `ss-order-${id}`;
}
export function createOrderAccess(id: string, fulfillmentDate: string) {
  const secret = getServerEnvironment().ORDER_ACCESS_SECRET;
  if (!secret) throw new Error("Order access is not configured.");
  const expires =
    Math.floor(localDateStartInstant(fulfillmentDate).getTime() / 1000) +
    120 * 86400;
  return `${expires}.${createHmac("sha256", secret).update(`${id}:${expires}`).digest("base64url")}`;
}
export function verifyOrderAccess(
  id: string,
  token: string | undefined,
  now = Date.now(),
) {
  const secret = getServerEnvironment().ORDER_ACCESS_SECRET;
  if (!secret || !token || !/^\d{10}\.[A-Za-z0-9_-]{43}$/.test(token))
    return false;
  const [expires, signature] = token.split(".");
  if (Number(expires) * 1000 <= now) return false;
  const expected = createHmac("sha256", secret)
    .update(`${id}:${expires}`)
    .digest("base64url");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function orderView(
  row: OrderRow,
  events: Pick<
    OrderEventRow,
    "id" | "to_status" | "customer_title" | "customer_message" | "occurred_at"
  >[],
  refund: Pick<
    OrderRefundRow,
    "status" | "amount_cents" | "requested_at" | "updated_at" | "completed_at"
  > | null = null,
  redelivery: RedeliveryRow | null = null,
  feeRefund: Pick<
    OrderRefundRow,
    "status" | "amount_cents" | "requested_at" | "updated_at" | "completed_at"
  > | null = null,
): OrderView {
  return {
    id: row.id,
    orderNumber: row.order_number,
    placedAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    status: row.status,
    paymentStatus: row.payment_status,
    refund: refund
      ? {
          status: refund.status,
          amountCents: refund.amount_cents,
          requestedAt: refund.requested_at,
          updatedAt: refund.updated_at,
          completedAt: refund.completed_at,
        }
      : null,
    redelivery: redelivery
      ? {
          state: redelivery.state,
          respondBy: redelivery.respond_by,
          requestedAddress: redelivery.requested_address
            ? deliveryAddressSchema.parse(redelivery.requested_address)
            : null,
          selectedDate: redelivery.selected_date,
          feeCents: redelivery.fee_cents,
          freeReason: redelivery.free_reason,
          paymentStatus: redelivery.payment_status,
          paymentExpiresAt: redelivery.payment_expires_at,
          feeRefund: feeRefund
            ? {
                status: feeRefund.status,
                amountCents: feeRefund.amount_cents,
                requestedAt: feeRefund.requested_at,
                updatedAt: feeRefund.updated_at,
                completedAt: feeRefund.completed_at,
              }
            : null,
        }
      : null,
    fulfillmentStatus: row.fulfillment_status,
    events: events.map((event) => ({
      id: event.id,
      status: event.to_status,
      title: event.customer_title,
      message: event.customer_message,
      occurredAt: event.occurred_at,
    })),
    snapshot: purchaseSnapshotSchema.parse(row.snapshot),
  };
}
export async function getGuestOrder(
  id: string,
  access?: string,
  checkoutToken?: string,
  customerId?: string,
  consistencyAttempt = 0,
): Promise<OrderView> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new DeliveryError(
      "order_not_found",
      "This order link is unavailable or has expired.",
      404,
    );
  const db = createSecretSupabaseClient();
  const result = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (result.error)
    throw new DeliveryError(
      "order_unavailable",
      "We could not load your order. Please retry.",
      503,
    );
  let allowed = verifyOrderAccess(id, access);
  if (!allowed && customerId && result.data) {
    const link = await db
      .from("customer_order_links")
      .select("order_id")
      .eq("order_id", id)
      .eq("user_id", customerId)
      .maybeSingle();
    if (link.error) throw new Error("Order access unavailable");
    allowed = Boolean(link.data);
  }
  if (
    !allowed &&
    checkoutToken &&
    /^[A-Za-z0-9_-]{40,64}$/.test(checkoutToken) &&
    result.data
  ) {
    const attempt = await db
      .from("payment_attempts")
      .select("id")
      .eq("id", result.data.payment_attempt_id)
      .eq("access_token_hash", sha256(checkoutToken))
      .gt("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
      .maybeSingle();
    if (attempt.error) throw new Error("Order access unavailable");
    allowed = Boolean(attempt.data);
  }
  if (!result.data || !allowed)
    throw new DeliveryError(
      "order_not_found",
      "This order link is unavailable or has expired.",
      404,
    );
  const events = await db
    .from("order_events")
    .select("id,to_status,customer_title,customer_message,occurred_at")
    .eq("order_id", result.data.id)
    .eq("customer_visible", true)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true });
  if (events.error || !events.data.length)
    throw new DeliveryError(
      "order_unavailable",
      "We could not load your order timeline. Please retry.",
      503,
    );
  const refund = await db
    .from("order_refunds")
    .select("status,amount_cents,requested_at,updated_at,completed_at")
    .eq("order_id", id)
    .maybeSingle();
  if (refund.error)
    throw new DeliveryError(
      "order_unavailable",
      "We could not load your refund status. Please retry.",
      503,
    );
  const [redelivery, feeRefund] = await Promise.all([
    db.from("order_redeliveries").select("*").eq("order_id", id).maybeSingle(),
    db
      .from("redelivery_fee_refunds")
      .select("status,amount_cents,requested_at,updated_at,completed_at")
      .eq("order_id", id)
      .maybeSingle(),
  ]);
  if (redelivery.error || feeRefund.error)
    throw new DeliveryError(
      "order_unavailable",
      "We could not load your delivery update. Please retry.",
      503,
    );
  const current = await db
    .from("orders")
    .select("version")
    .eq("id", id)
    .single();
  if (current.error)
    throw new DeliveryError(
      "order_unavailable",
      "We could not load your order. Please retry.",
      503,
    );
  if (current.data.version !== result.data.version) {
    if (consistencyAttempt >= 2)
      throw new DeliveryError(
        "order_updating",
        "Your order is updating. Please refresh its status.",
        503,
      );
    return getGuestOrder(
      id,
      access,
      checkoutToken,
      customerId,
      consistencyAttempt + 1,
    );
  }
  return orderView(
    result.data,
    events.data,
    refund.data,
    redelivery.data,
    feeRefund.data,
  );
}
