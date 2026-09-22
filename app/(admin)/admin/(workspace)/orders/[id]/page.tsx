import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowLeft, BellRing, CircleAlert } from "lucide-react";
import { notFound } from "next/navigation";

import { NotificationRetryButton } from "@/components/admin/notification-retry-button";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import {
  DeliverySummary,
  PurchaseSummary,
} from "@/components/checkout/purchase-summary";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { requireOwnerSession } from "@/lib/auth/session";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import {
  retryOrderNotification,
  transitionOrderFulfillment,
} from "@/lib/orders/actions";
import {
  fulfillmentStage,
  orderEventSchema,
  orderStatusLabel,
} from "@/lib/orders/status";
import { purchaseSnapshotSchema } from "@/lib/payments/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function notificationLabel(kind: string) {
  const labels: Record<string, string> = {
    customer_confirmation: "Order confirmation to customer",
    customer_preparing: "Preparing update to customer",
    customer_ready: "Ready-for-delivery update to customer",
    customer_out_for_delivery: "Out-for-delivery update to customer",
    customer_delivered: "Delivered update to customer",
    owner_order: "New-order alert to owner",
    owner_exception: "Payment exception alert to owner",
  };
  return labels[kind] ?? "Order email";
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwnerSession(`/admin/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createServerSupabaseClient();
  const [orderResult, eventsResult, notificationsResult] = await Promise.all([
    db.from("orders").select("*").eq("id", id).maybeSingle(),
    db
      .from("order_events")
      .select("id,to_status,customer_title,customer_message,occurred_at")
      .eq("order_id", id)
      .eq("customer_visible", true)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true }),
    db
      .from("order_notifications")
      .select(
        "id,kind,status,attempts,first_attempt_at,next_attempt_at,sent_at,failure_code,order_event_id",
      )
      .eq("order_id", id)
      .order("next_attempt_at", { ascending: true }),
  ]);
  if (orderResult.error) throw new Error("Order could not be loaded.");
  if (!orderResult.data) notFound();
  if (eventsResult.error || !eventsResult.data.length)
    throw new Error("Order timeline could not be loaded.");
  if (notificationsResult.error)
    throw new Error("Notification status could not be loaded.");

  const order = orderResult.data;
  const snapshot = purchaseSnapshotSchema.parse(order.snapshot);
  const events = eventsResult.data.map((event) =>
    orderEventSchema.parse({
      id: event.id,
      status: event.to_status,
      title: event.customer_title,
      message: event.customer_message,
      occurredAt: event.occurred_at,
    }),
  );
  const stage = fulfillmentStage(order.fulfillment_status);

  return (
    <div className="space-y-7">
      <Link
        href="/admin/orders"
        className="text-ink-soft hover:text-brand inline-flex min-h-11 items-center gap-2 text-sm font-bold"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All orders
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {order.test_only ? (
              <Badge tone="warning">Development test</Badge>
            ) : null}
            <StatusIndicator
              label={stage.label}
              tone={
                order.fulfillment_status === "delivered" ? "success" : "active"
              }
            />
            <StatusIndicator label="Paid" tone="success" />
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            {order.order_number}
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Placed {formatBusinessDateTime(order.created_at)} · Version{" "}
            {order.version}
          </p>
        </div>
        <OrderStatusControl
          action={transitionOrderFulfillment}
          currentStatus={order.fulfillment_status}
          idempotencyKey={randomUUID()}
          orderId={order.id}
          orderNumber={order.order_number}
          version={order.version}
        />
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="min-w-0 space-y-6">
          <Card tone="admin" padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Order progress</h2>
                <p className="text-ink-soft mt-1 text-sm">
                  Customer-visible history in Toronto business time.
                </p>
              </div>
              <Badge tone={order.status === "completed" ? "success" : "info"}>
                {orderStatusLabel(order.status)} order
              </Badge>
            </div>
            <div className="mt-6">
              <OrderTimeline
                currentStatus={order.fulfillment_status}
                events={events}
                compact
              />
            </div>
          </Card>

          <Card tone="admin" padding="lg">
            <h2 className="text-lg font-extrabold">Customer and delivery</h2>
            <div className="mt-5">
              <DeliverySummary snapshot={snapshot} />
            </div>
            <div className="border-border mt-5 border-t pt-5 text-sm leading-6">
              <p className="font-bold">{snapshot.delivery.name}</p>
              <a
                href={`mailto:${snapshot.delivery.email}`}
                className="text-brand break-all underline underline-offset-4"
              >
                {snapshot.delivery.email}
              </a>
              <br />
              <a
                href={`tel:${snapshot.delivery.phone}`}
                className="text-brand underline underline-offset-4"
              >
                {snapshot.delivery.phone}
              </a>
              <p className="text-ink-soft mt-3">
                Cancellation deadline:{" "}
                {formatBusinessDateTime(snapshot.cancellationDeadline)}
              </p>
            </div>
          </Card>

          <Card tone="admin" padding="lg">
            <div className="flex items-start gap-3">
              <BellRing
                className="text-brand mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-lg font-extrabold">Customer emails</h2>
                <p className="text-ink-soft mt-1 text-sm leading-5">
                  Stage changes remain saved even if an email needs a retry.
                </p>
              </div>
            </div>
            <ul className="border-border mt-5 divide-y border-y">
              {notificationsResult.data.map((notification) => {
                const canRetry = notification.status === "failed";
                return (
                  <li
                    key={notification.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        {notificationLabel(notification.kind)}
                      </p>
                      <p className="text-ink-soft mt-1 text-xs">
                        {notification.status === "sent" && notification.sent_at
                          ? `Sent ${formatBusinessDateTime(notification.sent_at)}`
                          : notification.status === "failed"
                            ? "Automatic delivery stopped for safe review."
                            : notification.status === "sending"
                              ? "Sending now"
                              : "Queued for delivery"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusIndicator
                        label={notification.status}
                        tone={
                          notification.status === "sent"
                            ? "success"
                            : notification.status === "failed"
                              ? "critical"
                              : "pending"
                        }
                      />
                      {canRetry ? (
                        <NotificationRetryButton
                          action={retryOrderNotification}
                          notificationId={notification.id}
                          orderId={order.id}
                        />
                      ) : null}
                    </div>
                    {notification.status === "failed" ? (
                      <p className="text-critical-ink flex items-start gap-2 text-xs sm:max-w-56">
                        <CircleAlert
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        Retry is allowed only inside the provider’s safe
                        deduplication window; otherwise contact the customer
                        directly.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <PurchaseSummary snapshot={snapshot} />
      </div>
    </div>
  );
}
