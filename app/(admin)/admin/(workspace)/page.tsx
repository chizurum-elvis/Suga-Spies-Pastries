import { AdminLink as Link } from "@/components/navigation/admin-link";
import {
  ArrowRight,
  CalendarDays,
  ChefHat,
  ClipboardList,
  ShoppingBag,
} from "lucide-react";
import { AdminPageHeading } from "@/components/admin/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireOwnerSession } from "@/lib/auth/session";
import { getOverviewData } from "@/lib/admin/overview-data";
import {
  getTorontoLocalDate,
  parseLocalDate,
  addCalendarDays,
  addCalendarMonths,
  formatLocalDateLabel,
} from "@/lib/fulfillment/rules";
import { formatCurrency } from "@/lib/i18n/format";
import { fulfillmentStage } from "@/lib/orders/status";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    mode?: string;
  }>;
}) {
  const owner = await requireOwnerSession("/admin");
  const supplied = await searchParams;
  const today = getTorontoLocalDate();
  const testOnly = supplied.mode === "test";
  const valid = (value?: string) =>
    typeof value === "string" && parseLocalDate(value) ? value : null;
  const requested = valid(supplied.date);
  const date =
    requested && requested >= today && requested <= addCalendarMonths(today, 2)
      ? requested
      : today;
  const from = valid(supplied.from) ?? today.slice(0, 8) + "01";
  const requestedTo = valid(supplied.to) ?? today;
  const to =
    requestedTo >= from && requestedTo <= addCalendarDays(from, 366)
      ? requestedTo
      : from;
  const data = await getOverviewData({ date, from, to, testOnly });
  const day = data.kitchen.days[0];
  const capacity = data.calendar.days[0]!;
  const money = (cents: number) => formatCurrency(cents / 100);
  const attention = [
    {
      count: data.failedDeliveries,
      text: "Failed deliveries or redelivery requests",
    },
    { count: data.refunds, text: "Refunds needing review" },
    { count: data.paymentIssues, text: "Payments needing review" },
    { count: data.emailFailures, text: "Emails not delivered (all orders)" },
  ].filter((item) => item.count > 0);
  return (
    <div className="grid gap-7">
      <AdminPageHeading
        title="Overview"
        description={`Hello, ${owner.displayName ?? "there"}. Here is what needs your attention at the bakery.`}
        action={
          <Link
            href="/admin/production"
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            <ChefHat className="size-4" aria-hidden="true" />
            Open kitchen plan
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-ink-soft">{formatLocalDateLabel(today)} · Toronto</p>
        <Link
          className="text-brand-strong min-h-11 content-center font-bold underline underline-offset-4"
          href={testOnly ? "/admin" : "/admin?mode=test"}
        >
          {testOnly ? "Show live orders" : "Show test orders"}
        </Link>
      </div>
      {testOnly ? (
        <Badge tone="warning">Test orders — not real customer orders</Badge>
      ) : null}
      {!data.acceptingOrders ? (
        <div
          role="status"
          className="border-warning-ink/20 bg-warning/40 rounded-lg border p-4"
        >
          <strong>New orders are paused.</strong> Existing orders continue as
          normal.{" "}
          <Link href="/admin/settings" className="font-bold underline">
            Manage ordering
          </Link>
        </div>
      ) : null}
      <section
        aria-label="Bakery at a glance"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {[
          {
            label: "Deliveries today",
            value: data.orders.filter(
              (order) =>
                order.delivery_date === today &&
                order.fulfillment_status !== "delivered",
            ).length,
            icon: ShoppingBag,
            href: "/admin/orders?date=" + today,
          },
          {
            label: "Awaiting preparation",
            value: data.awaitingPreparation,
            icon: ChefHat,
            href: "/admin/orders?status=received",
          },
          {
            label: "Today's reserved spaces",
            value: `${capacity.consumed} / ${data.calendar.settings.dailyCapacity}`,
            icon: CalendarDays,
            href: "/admin/availability",
          },
          {
            label: "Pastries in selected plan",
            value: day?.pieceCount ?? 0,
            icon: ClipboardList,
            href: "/admin/production?from=" + date + "&to=" + date,
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={
              item.href +
              (testOnly
                ? (item.href.includes("?") ? "&" : "?") + "mode=test"
                : "")
            }
            className="border-border hover:border-brand/40 rounded-lg border bg-white p-4 transition-colors sm:p-5"
          >
            <item.icon className="text-brand mb-3 size-4" aria-hidden="true" />
            <p className="text-ink-soft text-sm">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
          </Link>
        ))}
      </section>
      {attention.length ? (
        <section className="border-warning-ink/20 bg-warning/30 rounded-lg border p-5">
          <h2>Needs attention</h2>
          <ul className="mt-3 grid gap-2">
            {attention.map((item) => (
              <li key={item.text}>
                <Link
                  href="/admin/orders#attention"
                  className="inline-flex min-h-11 items-center gap-3 text-sm underline underline-offset-4"
                >
                  <strong>{item.count}</strong>
                  {item.text}
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card tone="admin">
          <div className="flex flex-wrap justify-between gap-2">
            <h2>Upcoming deliveries</h2>
            <Link
              href={testOnly ? "/admin/orders?mode=test" : "/admin/orders"}
              className="text-brand-strong font-bold underline underline-offset-4"
            >
              All orders
            </Link>
          </div>
          <p className="text-ink-soft mt-1 text-xs">Next 14 days</p>
          {data.orders.length ? (
            <ul className="divide-border mt-4 divide-y">
              {data.orders.slice(0, 12).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-brand-strong font-bold">
                        {order.order_number} · {order.contact_name}
                      </p>
                      <p className="text-ink-soft mt-1 text-xs">
                        {formatLocalDateLabel(order.delivery_date)}
                      </p>
                    </div>
                    <span className="text-ink-soft text-xs">
                      {fulfillmentStage(order.fulfillment_status).label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft py-8 text-sm leading-6">
              No upcoming {testOnly ? "test" : "live"} deliveries. Confirmed
              orders will appear here after payment.
            </p>
          )}
        </Card>
        <Card tone="admin">
          <h2>What to bake and pack</h2>
          <form
            className="admin-chrome mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
            method="get"
            aria-label="Choose overview kitchen date"
          >
            <input
              type="hidden"
              name="mode"
              value={testOnly ? "test" : "live"}
            />
            <label className="grid gap-1 text-xs font-bold">
              Delivery date
              <input
                type="date"
                name="date"
                defaultValue={date}
                min={today}
                max={addCalendarMonths(today, 2)}
                required
                className="border-border-strong min-w-0 border bg-white px-3"
              />
            </label>
            <button
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "self-end",
              })}
            >
              Show
            </button>
          </form>
          {day?.lines.length ? (
            <ul className="divide-border mt-4 divide-y">
              {day.lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-4 py-3">
                  <span>
                    {line.name}
                    {line.variant ? ` · ${line.variant}` : ""}
                  </span>
                  <strong className="tabular-nums">{line.quantity}×</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft py-8 text-sm">
              No paid pastries to prepare on this date.
            </p>
          )}
          <Link
            href={`/admin/production?from=${date}&to=${date}${testOnly ? "&mode=test" : ""}`}
            className="text-brand-strong inline-flex min-h-11 items-center gap-2 font-bold underline underline-offset-4"
          >
            Full plan and customizations{" "}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>
      </div>
      <Card tone="admin">
        <h2>Sales summary</h2>
        <p className="text-ink-soft mt-1 text-xs">
          Orders placed in this range and completed refunds against those
          orders. Redelivery fees are excluded. This is not profit or a Stripe
          payout.
        </p>
        <form
          className="admin-chrome mt-4 flex flex-wrap items-end gap-3"
          method="get"
          aria-label="Choose sales dates"
        >
          <input type="hidden" name="mode" value={testOnly ? "test" : "live"} />
          {[
            { name: "from", label: "From", value: from },
            { name: "to", label: "To", value: to },
          ].map((field) => (
            <label key={field.name} className="grid gap-1 text-xs font-bold">
              {field.label}
              <input
                type="date"
                name={field.name}
                defaultValue={field.value}
                required
                className="border-border-strong border bg-white px-3"
              />
            </label>
          ))}
          <button
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Update summary
          </button>
        </form>
        <dl className="mt-6 grid grid-cols-2 gap-5 xl:grid-cols-5">
          {[
            { label: "Orders", value: data.sales.orders },
            { label: "Total collected", value: money(data.sales.salesCents) },
            {
              label: "Delivery included",
              value: money(data.sales.deliveryCents),
            },
            {
              label: "Refunds completed",
              value: money(data.sales.refundCents),
            },
            {
              label: "After refunds",
              value: money(data.sales.salesCents - data.sales.refundCents),
            },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-ink-soft text-xs">{item.label}</dt>
              <dd className="mt-2 text-xl font-bold tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
