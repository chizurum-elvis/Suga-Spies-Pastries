import { AdminLink as Link } from "@/components/navigation/admin-link";
import { notFound } from "next/navigation";

import { ExternalOrderStage } from "@/components/admin/external-order-stage";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireOwnerSession } from "@/lib/auth/session";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import { externalItemSnapshotSchema } from "@/lib/production/external-schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

export default async function ExternalOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwnerSession(`/admin/external-orders/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createServerSupabaseClient();
  const [orderResult, eventsResult] = await Promise.all([
    db.from("external_orders").select("*").eq("id", id).maybeSingle(),
    db
      .from("external_order_events")
      .select("version,from_status,to_status,occurred_at")
      .eq("external_order_id", id)
      .order("version"),
  ]);
  const { data: order, error } = orderResult;
  if (error || eventsResult.error)
    throw new Error("The external order could not be loaded.");
  if (!order) notFound();
  const items = z.array(externalItemSnapshotSchema).parse(order.items);
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <Link
          href="/admin/production"
          className="text-brand-strong text-sm font-bold underline"
        >
          ← Kitchen plan
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-[-0.04em]">
            {order.order_number}
          </h1>
          <Badge
            tone={
              order.fulfillment_status === "cancelled" ? "warning" : "accent"
            }
          >
            {order.fulfillment_status.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="text-ink-soft mt-2 text-sm capitalize">
          {order.source} · {formatLocalDateLabel(order.fulfillment_date)}
        </p>
      </header>
      <div className="border-warning-ink/25 bg-warning border p-4 text-sm leading-6">
        This order was entered outside website checkout. Its payment has not
        been verified by Stripe. Do not use this record as proof of payment or
        send an automatic paid-order confirmation.
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
        <Card tone="admin" padding="lg">
          <h2 className="text-lg font-bold">Pastries</h2>
          <ul className="border-border mt-4 divide-y border-t">
            {items.map((item, index) => (
              <li
                key={`${item.productId}-${index}`}
                className="grid grid-cols-[3rem_1fr] gap-3 py-3"
              >
                <strong className="text-brand-strong tabular-nums">
                  {item.quantity}×
                </strong>
                <div>
                  <p className="font-bold">{item.name}</p>
                  {item.note ? (
                    <p className="text-ink-soft text-sm">{item.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-ink-soft mt-3 text-xs">
            Catalogue base prices were captured for reference; any agreed
            off-site price or payment is not verified here.
          </p>
        </Card>
        <div className="grid content-start gap-5">
          <Card tone="admin" padding="lg">
            <h2 className="text-lg font-bold">Delivery</h2>
            <p className="mt-3 font-semibold">{order.recipient_name}</p>
            <p className="text-ink-soft mt-1 text-sm leading-6">
              {order.address_line1}
              {order.address_line2 ? `, ${order.address_line2}` : ""}
              <br />
              {order.city}, ON {order.postal_code}
            </p>
            {order.delivery_instructions ? (
              <p className="text-ink-soft mt-3 text-sm">
                {order.delivery_instructions}
              </p>
            ) : null}
          </Card>
          <Card tone="admin" padding="lg">
            <h2 className="text-lg font-bold">Contact</h2>
            <p className="mt-3 text-sm font-semibold">{order.customer_name}</p>
            <p className="text-ink-soft mt-1 text-sm">{order.customer_phone}</p>
            {order.customer_email ? (
              <p className="text-ink-soft mt-1 text-sm break-all">
                {order.customer_email}
              </p>
            ) : null}
            {order.internal_note ? (
              <p className="border-border text-ink-soft mt-4 border-t pt-3 text-sm">
                Private: {order.internal_note}
              </p>
            ) : null}
          </Card>
        </div>
      </div>
      <Card tone="admin" padding="lg">
        <h2 className="text-lg font-bold">Fulfillment tracking</h2>
        <p className="text-ink-soft mt-2 text-sm">
          Only the owner can see or update this external order. Cancellation is
          available before preparation starts.
        </p>
        <div className="mt-4">
          <ExternalOrderStage
            id={order.id}
            version={order.version}
            status={order.fulfillment_status}
          />
        </div>
        <ol className="border-border mt-5 divide-y border-t text-sm">
          {eventsResult.data?.map((event) => (
            <li
              key={event.version}
              className="flex flex-wrap justify-between gap-2 py-3"
            >
              <span className="font-semibold capitalize">
                {event.to_status.replaceAll("_", " ")}
              </span>
              <time className="text-ink-soft" dateTime={event.occurred_at}>
                {new Intl.DateTimeFormat("en-CA", {
                  timeZone: "America/Toronto",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(event.occurred_at))}
              </time>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
