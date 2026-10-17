import "server-only";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminFulfillmentData } from "@/lib/fulfillment/admin-data";
import { getProductionData } from "@/lib/production/admin-data";
import { getTorontoLocalDate, addCalendarDays } from "@/lib/fulfillment/rules";

const salesSchema = z.object({
  orders: z.number().int().nonnegative(),
  salesCents: z.number().int().nonnegative(),
  deliveryCents: z.number().int().nonnegative(),
  refundCents: z.number().int().nonnegative(),
});

export async function getOverviewData(input: {
  date: string;
  testOnly: boolean;
  from: string;
  to: string;
}) {
  const db = await createServerSupabaseClient();
  const [
    orders,
    preparing,
    failures,
    refunds,
    feeRefunds,
    emailFailures,
    paymentIssues,
    calendar,
    kitchen,
    sales,
    settings,
  ] = await Promise.all([
    db
      .from("admin_order_index")
      .select(
        "id,order_number,delivery_date,contact_name,fulfillment_status,status",
      )
      .eq("test_only", input.testOnly)
      .eq("status", "confirmed")
      .in("fulfillment_status", [
        "received",
        "preparing",
        "ready",
        "out_for_delivery",
        "redelivery_scheduled",
        "redelivery_out_for_delivery",
      ])
      .gte("delivery_date", getTorontoLocalDate())
      .lte("delivery_date", addCalendarDays(getTorontoLocalDate(), 13))
      .order("delivery_date")
      .limit(56),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("test_only", input.testOnly)
      .eq("status", "confirmed")
      .eq("fulfillment_status", "received"),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("test_only", input.testOnly)
      .in("fulfillment_status", ["delivery_failed", "redelivery_requested"])
      .eq("status", "confirmed"),
    db
      .from("order_refunds")
      .select("id", { count: "exact", head: true })
      .eq("test_only", input.testOnly)
      .in("status", ["failed", "needs_review"]),
    db
      .from("redelivery_fee_refunds")
      .select("id", { count: "exact", head: true })
      .eq("test_only", input.testOnly)
      .in("status", ["failed", "needs_review"]),
    db
      .from("order_notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    db
      .from("payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("test_only", input.testOnly)
      .in("status", ["needs_review", "refund_pending"]),
    getAdminFulfillmentData(),
    getProductionData({
      from: input.date,
      to: input.date,
      testOnly: input.testOnly,
    }),
    db.rpc("owner_sales_summary", {
      p_from: input.from,
      p_to: input.to,
      p_test: input.testOnly,
    }),
    db
      .from("business_settings")
      .select("accepting_orders")
      .eq("singleton", true)
      .single(),
  ]);
  if (
    [
      orders,
      preparing,
      failures,
      refunds,
      feeRefunds,
      emailFailures,
      paymentIssues,
      sales,
      settings,
    ].some((result) => result.error)
  )
    throw new Error("The overview could not be loaded. Please retry.");
  const totals = salesSchema.parse(sales.data);
  return {
    orders: orders.data!,
    awaitingPreparation: preparing.count ?? 0,
    failedDeliveries: failures.count ?? 0,
    refunds: (refunds.count ?? 0) + (feeRefunds.count ?? 0),
    emailFailures: emailFailures.count ?? 0,
    paymentIssues: paymentIssues.count ?? 0,
    calendar,
    kitchen,
    sales: totals,
    acceptingOrders: settings.data!.accepting_orders,
  };
}
