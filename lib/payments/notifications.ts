import "server-only";
import { getServerEnvironment } from "@/lib/env/server";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { createOrderAccess } from "@/lib/payments/order-access";
import { purchaseSnapshotSchema } from "@/lib/payments/schema";
import { formatBusinessDateTime, formatCurrency } from "@/lib/i18n/format";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import type { NotificationRow, OrderRow } from "@/lib/payments/database";
import { businessConfig } from "@/lib/config/business";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function confirmationText(
  order: OrderRow,
  orderUrl: string,
  owner: boolean,
) {
  const s = purchaseSnapshotSchema.parse(order.snapshot);
  return `${s.testOnly ? "DEVELOPMENT TEST — no real order\n\n" : ""}${owner ? "New pastry order" : "Your pastry order is confirmed"}: ${order.order_number}\n\n${s.validatedCart.lines.map((line) => `${line.quantity} × ${line.product?.name}${line.options.length ? ` (${line.options.map((option) => option.name).join(", ")})` : ""} — ${formatCurrency(line.lineSubtotalCents! / 100)}`).join("\n")}\n\nSubtotal: ${formatCurrency(s.subtotalCents / 100)}\nDelivery: ${formatCurrency(s.deliveryCents / 100)}\nTotal paid: ${formatCurrency(s.totalCents / 100)} CAD\n\nDelivery date: ${formatLocalDateLabel(s.fulfillmentDate)}\n${s.delivery.recipientName}\n${s.delivery.address.line1}${s.delivery.address.line2 ? `, ${s.delivery.address.line2}` : ""}\n${s.delivery.address.city}, ON ${s.delivery.address.postalCode}\n\nCancellation deadline: ${formatBusinessDateTime(s.cancellationDeadline)}\n\nView your order: ${orderUrl}`;
}

export function fulfillmentUpdateText(
  order: OrderRow,
  orderUrl: string,
  event: {
    customer_title: string;
    customer_message: string;
    occurred_at: string;
  },
) {
  const snapshot = purchaseSnapshotSchema.parse(order.snapshot);
  return `${snapshot.testOnly ? "DEVELOPMENT TEST — no real order\n\n" : ""}${event.customer_title}: ${order.order_number}\n\n${event.customer_message}\n\nDelivery date: ${formatLocalDateLabel(snapshot.fulfillmentDate)}\nUpdated: ${formatBusinessDateTime(event.occurred_at)}\n\nTrack your order: ${orderUrl}\n\nQuestions? Call ${businessConfig.supportPhoneDisplay}.`;
}

export async function sendOrderNotifications() {
  const env = getServerEnvironment();
  if (!env.RESEND_API_KEY || !env.ORDER_EMAIL_FROM)
    return { sent: 0, failed: 0, configured: false };
  const db = createSecretSupabaseClient();
  const claimed = await db.rpc("claim_order_notifications", { p_limit: 2 });
  if (claimed.error) throw new Error("Notification queue unavailable.");
  let sent = 0,
    failed = 0;
  for (const notification of claimed.data) {
    try {
      if (
        notification.first_attempt_at &&
        Date.now() - Date.parse(notification.first_attempt_at) >= 23 * 3600_000
      )
        throw new Error(
          "Email retry window has ended; manual review required.",
        );
      await sendNotification(notification);
      sent++;
    } catch {
      failed++;
      // Resend deduplicates for 24 hours. Stop ambiguous retries before that window.
      const stop =
        notification.attempts >= 12 ||
        (notification.first_attempt_at &&
          Date.now() - new Date(notification.first_attempt_at).getTime() >
            23 * 3600_000 - 1);
      const result = await db
        .from("order_notifications")
        .update({
          status: stop ? "failed" : "pending",
          failure_code: "notification_delivery_failed",
          next_attempt_at: new Date(
            Date.now() +
              Math.min(3600_000, 2 ** notification.attempts * 60_000),
          ).toISOString(),
        })
        .eq("id", notification.id)
        .eq("lease_id", notification.lease_id!);
      if (result.error)
        throw new Error("Notification failure could not be saved.");
    }
  }
  return { sent, failed, configured: true };
}

async function sendNotification(notification: NotificationRow) {
  const db = createSecretSupabaseClient();
  const env = getServerEnvironment();
  const result = await db
    .from("payment_attempts")
    .select("*")
    .eq("id", notification.payment_attempt_id)
    .single();
  if (result.error) throw new Error("Payment notification unavailable.");
  const snapshot = purchaseSnapshotSchema.parse(result.data.snapshot);
  const owner =
    notification.kind === "owner_order" ||
    notification.kind === "owner_exception";
  const recipient = snapshot.testOnly
    ? env.ORDER_TEST_EMAIL
    : owner
      ? env.ORDER_ALERT_EMAIL
      : snapshot.delivery.email;
  if (!recipient) throw new Error("Notification recipient is not configured.");
  const site = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let text = `A payment needs attention in your dashboard.\n${site}/admin/orders\nReference: ${notification.payment_attempt_id}`;
  let subject = `${snapshot.testOnly ? "[TEST] " : ""}Payment needs attention — Suga & Spies`;
  if (notification.order_id) {
    const order = await db
      .from("orders")
      .select("*")
      .eq("id", notification.order_id)
      .single();
    if (order.error) throw new Error("Order notification unavailable.");
    const url = owner
      ? `${site}/admin/orders/${order.data.id}`
      : `${site}/orders/${order.data.id}#access=${createOrderAccess(order.data.id, snapshot.fulfillmentDate)}`;
    if (notification.order_event_id) {
      const event = await db
        .from("order_events")
        .select("customer_title,customer_message,occurred_at")
        .eq("id", notification.order_event_id)
        .eq("order_id", order.data.id)
        .eq("customer_visible", true)
        .single();
      if (event.error) throw new Error("Order update unavailable.");
      text = fulfillmentUpdateText(order.data, url, event.data);
      subject = `${snapshot.testOnly ? "[TEST] " : ""}${event.data.customer_title} — ${order.data.order_number}`;
    } else {
      text = confirmationText(order.data, url, owner);
      subject = `${snapshot.testOnly ? "[TEST] " : ""}${owner ? "New order" : "Order confirmed"} ${order.data.order_number} — Suga & Spies`;
    }
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `order-notification/${notification.id}`,
    },
    body: JSON.stringify({
      from: env.ORDER_EMAIL_FROM,
      to: [recipient],
      subject,
      text,
      html: `<div style="font-family:Georgia,serif;color:#35233c;max-width:600px;margin:auto"><h1 style="font-size:24px">Suga &amp; Spies</h1><div style="font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap">${escapeHtml(text)}</div></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Email provider unavailable.");
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("id" in body) ||
    typeof body.id !== "string"
  )
    throw new Error("Invalid email response.");
  const saved = await db
    .from("order_notifications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_id: body.id,
      failure_code: null,
    })
    .eq("id", notification.id)
    .eq("lease_id", notification.lease_id!);
  if (saved.error) throw new Error("Email acknowledgement unavailable.");
}
