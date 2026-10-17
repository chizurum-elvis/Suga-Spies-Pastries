import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildExternalProductionPlan,
  buildProductionPlan,
  type ProductionOrder,
  type ProductionRedelivery,
} from "@/lib/production/plan";

export async function getProductionData(input: {
  from: string;
  to: string;
  testOnly: boolean;
}) {
  const db = await createServerSupabaseClient();
  const [originals, redeliveries, external, trackedExternal] =
    await Promise.all([
      db
        .from("orders")
        .select(
          "id,order_number,fulfillment_date,fulfillment_status,snapshot,test_only",
        )
        .eq("status", "confirmed")
        .eq("payment_status", "paid")
        .eq("test_only", input.testOnly)
        .in("fulfillment_status", [
          "received",
          "preparing",
          "ready",
          "out_for_delivery",
        ])
        .gte("fulfillment_date", input.from)
        .lte("fulfillment_date", input.to)
        .order("fulfillment_date")
        .limit(500),
      db
        .from("order_redeliveries")
        .select("order_id,selected_date,state,payment_status")
        .in("state", ["scheduled", "out_for_delivery"])
        .in("payment_status", ["not_required", "paid"])
        .gte("selected_date", input.from)
        .lte("selected_date", input.to)
        .order("selected_date")
        .limit(500),
      db
        .from("capacity_adjustments")
        .select("id,fulfillment_date,source,customer_reference")
        .eq("status", "active")
        .in("source", ["phone", "instagram", "admin", "other"])
        .gte("fulfillment_date", input.from)
        .lte("fulfillment_date", input.to)
        .order("fulfillment_date")
        .limit(500),
      db
        .from("external_orders")
        .select(
          "id,order_number,capacity_adjustment_id,fulfillment_date,source,fulfillment_status,items",
        )
        .in("fulfillment_status", [
          "received",
          "preparing",
          "ready",
          "out_for_delivery",
        ])
        .gte("fulfillment_date", input.from)
        .lte("fulfillment_date", input.to)
        .order("fulfillment_date")
        .limit(500),
    ]);
  if (
    originals.error ||
    redeliveries.error ||
    external.error ||
    trackedExternal.error
  )
    throw new Error("The production plan could not be loaded.");

  // A paid order can have moved to a redelivery outside the selected range.
  // Fetch that state too, or the old date would incorrectly reappear in the plan.
  const originalIds = originals.data.map((row) => row.id);
  const movedOriginals = originalIds.length
    ? await db
        .from("order_redeliveries")
        .select("order_id,selected_date,state,payment_status")
        .in("order_id", originalIds)
        .in("state", ["scheduled", "out_for_delivery"])
        .in("payment_status", ["not_required", "paid"])
    : null;
  if (movedOriginals?.error)
    throw new Error("Redelivery production details could not be loaded.");

  const redeliveryIds = redeliveries.data.map((row) => row.order_id);
  const redeliveryOrders = redeliveryIds.length
    ? await db
        .from("orders")
        .select(
          "id,order_number,fulfillment_date,fulfillment_status,snapshot,test_only",
        )
        .in("id", redeliveryIds)
        .eq("status", "confirmed")
        .eq("payment_status", "paid")
        .eq("test_only", input.testOnly)
    : null;
  if (redeliveryOrders?.error)
    throw new Error("Redelivery production details could not be loaded.");

  const orders = new Map<string, ProductionOrder>();
  for (const row of [...originals.data, ...(redeliveryOrders?.data ?? [])]) {
    orders.set(row.id, {
      id: row.id,
      orderNumber: row.order_number,
      fulfillmentDate: row.fulfillment_date,
      fulfillmentStatus: row.fulfillment_status,
      snapshot: row.snapshot,
      testOnly: row.test_only,
    });
  }
  const redeliveryRows: ProductionRedelivery[] = [
    ...redeliveries.data,
    ...(movedOriginals?.data ?? []),
  ].map((row) => ({
    orderId: row.order_id,
    selectedDate: row.selected_date!,
    state: row.state,
    paymentStatus: row.payment_status,
  }));

  const trackedIds = new Set(
    trackedExternal.data.map((row) => row.capacity_adjustment_id),
  );
  return {
    days: buildProductionPlan(
      [...orders.values()],
      redeliveryRows,
      input.from,
      input.to,
    ),
    externalOrders: input.testOnly
      ? []
      : buildExternalProductionPlan(
          trackedExternal.data.map((row) => ({
            id: row.id,
            number: row.order_number,
            date: row.fulfillment_date,
            source: row.source,
            status: row.fulfillment_status,
            items: row.items,
          })),
          input.from,
          input.to,
        ),
    externalReservations: input.testOnly
      ? []
      : external.data.filter((row) => !trackedIds.has(row.id)),
  };
}
