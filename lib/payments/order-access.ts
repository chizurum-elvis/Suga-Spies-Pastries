import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";
import { sha256 } from "@/lib/fulfillment/checkout-draft";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { purchaseSnapshotSchema, type OrderView } from "@/lib/payments/schema";
import type { OrderEventRow, OrderRow } from "@/lib/payments/database";
import { DeliveryError } from "@/lib/delivery/errors";
import { localDateStartInstant } from "@/lib/fulfillment/rules";

export function orderCookieName(id: string) {
  return `ss-order-${id}`;
}
export function createOrderAccess(id: string, fulfillmentDate: string) {
  const secret = getServerEnvironment().ORDER_ACCESS_SECRET;
  if (!secret) throw new Error("Order access is not configured.");
  const expires =
    Math.floor(localDateStartInstant(fulfillmentDate).getTime() / 1000) +
    30 * 86400;
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
): OrderView {
  return {
    id: row.id,
    orderNumber: row.order_number,
    placedAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    status: row.status,
    paymentStatus: row.payment_status,
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
) {
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
  return orderView(result.data, events.data);
}
