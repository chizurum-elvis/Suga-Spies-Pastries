import { AdminLink as Link } from "@/components/navigation/admin-link";
import { Filter, Search, ShoppingBag } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { requireOwnerSession } from "@/lib/auth/session";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import { localDateSchema } from "@/lib/fulfillment/schema";
import { formatCurrency } from "@/lib/i18n/format";
import {
  fulfillmentStage,
  fulfillmentStages,
  fulfillmentStatusSchema,
} from "@/lib/orders/status";
import { orderSearchText, orderSearchFilter } from "@/lib/admin/order-filters";
import { orderPaymentLabel } from "@/lib/orders/cancellation";
import { purchaseSnapshotSchema } from "@/lib/payments/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OrderSearch = {
  page?: string;
  status?: string;
  date?: string;
  q?: string;
  mode?: string;
  payment?: string;
};

function pageHref(filters: OrderSearch, page: number) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.date) params.set("date", filters.date);
  if (filters.q) params.set("q", filters.q);
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.payment) params.set("payment", filters.payment);
  params.set("page", String(page));
  return `/admin/orders?${params}`;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrderSearch>;
}) {
  await requireOwnerSession("/admin/orders");
  const supplied = await searchParams;
  const requestedPage = Number(supplied.page ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= 10_000
      ? requestedPage
      : 1;
  const status =
    supplied.status === "cancelled"
      ? "cancelled"
      : fulfillmentStatusSchema.safeParse(supplied.status).data;
  const date = localDateSchema.safeParse(supplied.date).data;
  const q = orderSearchText(supplied.q);
  const mode =
    supplied.mode === "test"
      ? "test"
      : supplied.mode === "all"
        ? "all"
        : "live";
  const payment = (
    ["paid", "refund_pending", "refund_failed", "refunded"] as const
  ).find((value) => value === supplied.payment);
  const filters = { status, date, q, mode, payment };
  const db = await createServerSupabaseClient();

  let orderQuery = db
    .from("admin_order_index")
    .select("*")
    .order("delivery_date", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25);
  if (status === "cancelled") orderQuery = orderQuery.eq("status", "cancelled");
  else if (status)
    orderQuery = orderQuery
      .eq("fulfillment_status", status)
      .neq("status", "cancelled");
  if (date) orderQuery = orderQuery.eq("delivery_date", date);
  if (q) orderQuery = orderQuery.or(orderSearchFilter(q));
  if (mode !== "all") orderQuery = orderQuery.eq("test_only", mode === "test");
  if (payment) orderQuery = orderQuery.eq("payment_status", payment);

  let externalQuery = db
    .from("external_orders")
    .select("id,order_number,customer_name,fulfillment_date,fulfillment_status")
    .order("fulfillment_date", { ascending: false })
    .order("id")
    .limit(26);
  if (date) externalQuery = externalQuery.eq("fulfillment_date", date);
  if (q)
    externalQuery = externalQuery.or(
      orderSearchFilter(q)
        .replaceAll("contact_name.", "customer_name.")
        .replaceAll("contact_email.", "customer_email.")
        .replaceAll("contact_phone.", "customer_phone."),
    );
  const externalStatus = (
    [
      "received",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ] as const
  ).find((value) => value === status);
  if (externalStatus)
    externalQuery = externalQuery.eq("fulfillment_status", externalStatus);
  else if (status) externalQuery = externalQuery.in("fulfillment_status", []);
  const [orders, payments, notifications, refunds, feeRefunds, external] =
    await Promise.all([
      orderQuery,
      db
        .from("payment_attempts")
        .select("id,status,failure_code,created_at,test_only")
        .not("status", "in", "(paid,expired,refunded)")
        .or("status.in.(needs_review,refund_pending),failure_code.not.is.null")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("order_notifications")
        .select("id,kind,status,order_id")
        .eq("status", "failed")
        .limit(30),
      db
        .from("order_refunds")
        .select("id,order_id,status,failure_code")
        .in("status", ["failed", "needs_review"])
        .limit(30),
      db
        .from("redelivery_fee_refunds")
        .select("id,order_id,status,failure_code")
        .in("status", ["failed", "needs_review"])
        .limit(30),
      externalQuery,
    ]);
  if (
    orders.error ||
    payments.error ||
    notifications.error ||
    refunds.error ||
    feeRefunds.error ||
    external.error
  )
    throw new Error("Order records are temporarily unavailable.");

  const hasMore = orders.data.length > 25;
  const visibleOrders = orders.data.slice(0, 25);
  const filtersActive = Boolean(
    status || date || q || payment || mode !== "live",
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Orders
          </h1>
          <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
            Work from the earliest delivery date and move each paid order
            through its customer-visible stages.
          </p>
        </div>
        <StatusIndicator
          label={`${visibleOrders.length} shown`}
          tone="neutral"
        />
      </header>

      <form
        method="get"
        className="border-border bg-surface grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:items-end xl:grid-cols-3"
        aria-label="Filter orders"
      >
        <label className="grid gap-1.5 text-sm font-bold">
          <span>Find an order</span>
          <span className="relative">
            <Search
              className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              name="q"
              defaultValue={q}
              maxLength={120}
              placeholder="Order number, name, email, or phone"
              className="border-border-strong bg-surface min-h-11 w-full rounded-md border py-2 pr-3 pl-10 text-sm"
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          <span>Stage</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="border-border-strong bg-surface min-h-11 rounded-md border px-3 text-sm"
          >
            <option value="">All stages</option>
            {fulfillmentStages.map((stage) => (
              <option key={stage.status} value={stage.status}>
                {stage.label}
              </option>
            ))}
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          <span>Orders to show</span>
          <select
            name="mode"
            defaultValue={mode}
            className="border-border-strong min-h-11 rounded-md border bg-white px-3 text-sm"
          >
            <option value="live">Live orders</option>
            <option value="test">Test orders</option>
            <option value="all">Live and test</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          <span>Payment</span>
          <select
            name="payment"
            defaultValue={payment ?? ""}
            className="border-border-strong min-h-11 rounded-md border bg-white px-3 text-sm"
          >
            <option value="">All payment states</option>
            <option value="paid">Paid</option>
            <option value="refund_pending">Refund pending</option>
            <option value="refund_failed">Refund needs attention</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          <span>Delivery date</span>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="border-border-strong bg-surface min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className={buttonVariants({ variant: "primary" })}
        >
          <Filter className="size-4" aria-hidden="true" />
          Apply
        </button>
        {filtersActive ? (
          <Link
            href="/admin/orders"
            className={buttonVariants({ variant: "quiet" })}
          >
            Clear
          </Link>
        ) : null}
      </form>

      {payments.data.length ||
      notifications.data.length ||
      refunds.data.length ||
      feeRefunds.data.length ? (
        <section
          id="attention"
          className="border-critical-ink/20 bg-critical/40 border p-5"
        >
          <h2 className="text-lg font-bold">Needs attention</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {feeRefunds.data.map((refund) => (
              <li key={refund.id}>
                A redelivery fee refund needs attention.{" "}
                <Link
                  href={`/admin/orders/${refund.order_id}`}
                  className="font-bold underline"
                >
                  Review refund
                </Link>
              </li>
            ))}
            {refunds.data.map((refund) => (
              <li key={refund.id}>
                A cancelled order’s refund needs attention.{" "}
                <Link
                  href={`/admin/orders/${refund.order_id}`}
                  className="font-bold underline"
                >
                  Review refund
                </Link>
              </li>
            ))}
            {payments.data.map((payment) => (
              <li key={payment.id}>
                <span className="font-bold">
                  {payment.test_only ? "Test payment" : "Payment"}:{" "}
                  {payment.status.replaceAll("_", " ")}
                </span>
                <details className="mt-1">
                  <summary className="min-h-11 cursor-pointer content-center text-xs underline">
                    Payment reference
                  </summary>
                  <p className="font-mono text-xs break-all">{payment.id}</p>
                </details>
              </li>
            ))}
            {notifications.data.map((notification) => (
              <li key={notification.id}>
                An {notification.kind.replaceAll("_", " ")} email could not be
                delivered.{" "}
                {notification.order_id ? (
                  <Link
                    href={`/admin/orders/${notification.order_id}`}
                    className="font-bold underline"
                  >
                    Open order
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!visibleOrders.length ? (
        <StatePanel
          tone="empty"
          title={
            filtersActive
              ? "No orders match these filters"
              : "Your first order will appear here"
          }
          description={
            filtersActive
              ? "Clear a filter or try a different delivery date."
              : "Orders are added automatically after payment and delivery capacity are confirmed."
          }
          action={
            filtersActive ? (
              <Link
                href="/admin/orders"
                className={buttonVariants({ variant: "secondary" })}
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3" aria-label="Paid pastry orders">
          {visibleOrders.map((order) => {
            const snapshot = purchaseSnapshotSchema.parse(order.snapshot);
            const stage = fulfillmentStage(order.fulfillment_status);
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="border-border bg-surface hover:border-brand/45 hover:shadow-soft grid min-h-24 gap-4 rounded-lg border p-4 transition-[border-color,box-shadow] sm:grid-cols-[minmax(9rem,0.8fr)_minmax(13rem,1.4fr)_minmax(10rem,1fr)_auto] sm:items-center"
                >
                  <div>
                    <p className="text-brand font-bold">{order.order_number}</p>
                    <p className="text-ink-soft mt-1 text-xs">
                      {order.test_only ? "TEST · " : ""}
                      {orderPaymentLabel(order.payment_status)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      {formatLocalDateLabel(order.delivery_date)}
                    </p>
                    <p className="text-ink-soft mt-1 text-sm">
                      {snapshot.delivery.name} ·{" "}
                      {snapshot.validatedCart.itemCount} pieces
                    </p>
                  </div>
                  <StatusIndicator
                    label={
                      order.status === "discarded"
                        ? "Delivery closed"
                        : order.status === "cancelled"
                          ? "Cancelled"
                          : stage.label
                    }
                    tone={
                      order.status === "cancelled"
                        ? "neutral"
                        : order.fulfillment_status === "delivered"
                          ? "success"
                          : "active"
                    }
                    className="justify-self-start"
                  />
                  <p className="text-sm font-bold sm:text-right">
                    {formatCurrency(snapshot.totalCents / 100)} CAD
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <nav aria-label="Order pages" className="flex items-center gap-5 text-sm">
        {page > 1 ? (
          <Link
            className="min-h-11 content-center font-bold underline"
            href={pageHref(filters, page - 1)}
          >
            Newer orders
          </Link>
        ) : null}
        <span>Page {page}</span>
        {hasMore ? (
          <Link
            className="min-h-11 content-center font-bold underline"
            href={pageHref(filters, page + 1)}
          >
            Later orders
          </Link>
        ) : null}
      </nav>

      {mode !== "test" && !payment ? (
        <section className="border-border rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2>Phone and Instagram orders</h2>
            <Link
              href="/admin/external-orders/new"
              className="text-brand-strong inline-flex min-h-11 items-center font-bold underline"
            >
              Record an order
            </Link>
          </div>
          <p className="text-ink-soft mt-1 text-xs">
            Off-site records share the delivery limit. Payment is not verified
            by this website.
          </p>
          {external.data.length ? (
            <ul className="divide-border mt-3 divide-y">
              {external.data.slice(0, 25).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/external-orders/${order.id}`}
                    className="grid gap-1 py-4 sm:grid-cols-[1fr_auto]"
                  >
                    <span>
                      <strong className="text-brand-strong">
                        {order.order_number}
                      </strong>{" "}
                      · {order.customer_name}
                      <span className="text-ink-soft mt-1 block text-xs">
                        {formatLocalDateLabel(order.fulfillment_date)}
                      </span>
                    </span>
                    <span className="text-ink-soft text-xs">
                      {order.fulfillment_status === "cancelled"
                        ? "Cancelled"
                        : fulfillmentStage(order.fulfillment_status).label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft mt-4 text-sm">
              No off-site orders match this view.
            </p>
          )}
          {external.data.length > 25 ? (
            <p className="text-ink-soft mt-3 text-xs">
              Showing the latest 25. Search by name or order number, or choose a
              delivery date to find older orders.
            </p>
          ) : null}
        </section>
      ) : null}
      <p className="text-ink-faint flex items-center gap-2 text-xs">
        <ShoppingBag className="size-4" aria-hidden="true" />
        Historical prices and customer selections remain unchanged when the menu
        is edited.
      </p>
    </div>
  );
}
