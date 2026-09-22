import Link from "next/link";
import { Filter, Search, ShoppingBag } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { requireOwnerSession } from "@/lib/auth/session";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import { localDateSchema } from "@/lib/fulfillment/schema";
import { formatCurrency } from "@/lib/i18n/format";
import { fulfillmentStage, fulfillmentStatusSchema } from "@/lib/orders/status";
import { purchaseSnapshotSchema } from "@/lib/payments/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OrderSearch = {
  page?: string;
  status?: string;
  date?: string;
  q?: string;
};

function pageHref(filters: OrderSearch, page: number) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.date) params.set("date", filters.date);
  if (filters.q) params.set("q", filters.q);
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
  const status = fulfillmentStatusSchema.safeParse(supplied.status).data;
  const date = localDateSchema.safeParse(supplied.date).data;
  const q =
    typeof supplied.q === "string" &&
    /^[A-Za-z0-9-]{1,40}$/.test(supplied.q.trim())
      ? supplied.q.trim()
      : undefined;
  const filters = { status, date, q };
  const db = await createServerSupabaseClient();

  let orderQuery = db
    .from("orders")
    .select("*")
    .order("fulfillment_date", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25);
  if (status) orderQuery = orderQuery.eq("fulfillment_status", status);
  if (date) orderQuery = orderQuery.eq("fulfillment_date", date);
  if (q) orderQuery = orderQuery.ilike("order_number", `%${q}%`);

  const [orders, payments, notifications] = await Promise.all([
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
  ]);
  if (orders.error || payments.error || notifications.error)
    throw new Error("Order records are temporarily unavailable.");

  const hasMore = orders.data.length > 25;
  const visibleOrders = orders.data.slice(0, 25);
  const filtersActive = Boolean(status || date || q);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-brand text-sm font-bold">Order operations</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Pastry orders
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
        className="border-border bg-surface grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(11rem,0.7fr)_minmax(11rem,0.7fr)_auto_auto] lg:items-end"
        aria-label="Filter orders"
      >
        <label className="grid gap-1.5 text-sm font-bold">
          <span>Order number</span>
          <span className="relative">
            <Search
              className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              name="q"
              defaultValue={q}
              maxLength={40}
              pattern="[A-Za-z0-9-]+"
              placeholder="SS-1234"
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
            <option value="received">Order received</option>
            <option value="preparing">Being prepared</option>
            <option value="ready">Ready for delivery</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
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

      {payments.data.length || notifications.data.length ? (
        <section className="border-critical-ink/20 bg-critical/40 border p-5">
          <h2 className="text-lg font-bold">Needs attention</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {payments.data.map((payment) => (
              <li key={payment.id}>
                <span className="font-bold">
                  {payment.test_only ? "Test payment" : "Payment"}:{" "}
                  {payment.status.replaceAll("_", " ")}
                </span>
                <p className="text-xs break-all">Reference: {payment.id}</p>
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
                      {order.test_only ? "TEST · " : ""}Paid
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      {formatLocalDateLabel(snapshot.fulfillmentDate)}
                    </p>
                    <p className="text-ink-soft mt-1 text-sm">
                      {snapshot.delivery.name} ·{" "}
                      {snapshot.validatedCart.itemCount} pieces
                    </p>
                  </div>
                  <StatusIndicator
                    label={stage.label}
                    tone={
                      order.fulfillment_status === "delivered"
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

      <p className="text-ink-faint flex items-center gap-2 text-xs">
        <ShoppingBag className="size-4" aria-hidden="true" />
        Historical prices and customer selections remain unchanged when the menu
        is edited.
      </p>
    </div>
  );
}
