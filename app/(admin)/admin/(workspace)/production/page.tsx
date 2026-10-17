import { AdminLink as Link } from "@/components/navigation/admin-link";
import { CalendarRange, ChevronRight, PackageOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/admin/print-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { requireOwnerSession } from "@/lib/auth/session";
import {
  addCalendarDays,
  addCalendarMonths,
  formatLocalDateLabel,
  getTorontoLocalDate,
  parseLocalDate,
} from "@/lib/fulfillment/rules";
import { fulfillmentStage, fulfillmentStatusSchema } from "@/lib/orders/status";
import { getProductionData } from "@/lib/production/admin-data";

type ProductionSearch = { from?: string; to?: string; mode?: string };

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<ProductionSearch>;
}) {
  await requireOwnerSession("/admin/production");
  const supplied = await searchParams;
  const today = getTorontoLocalDate();
  const horizon = addCalendarMonths(today, 2);
  const requestedFrom =
    typeof supplied.from === "string" && parseLocalDate(supplied.from)
      ? supplied.from
      : today;
  const from =
    requestedFrom >= today && requestedFrom <= horizon ? requestedFrom : today;
  const requestedTo =
    typeof supplied.to === "string" && parseLocalDate(supplied.to)
      ? supplied.to
      : addCalendarDays(from, 13);
  const to =
    requestedTo >= from &&
    requestedTo <= horizon &&
    requestedTo <= addCalendarDays(from, 30)
      ? requestedTo
      : [addCalendarDays(from, 13), horizon].sort()[0]!;
  const testOnly = supplied.mode === "test";
  const plan = await getProductionData({ from, to, testOnly });
  const byDay = new Map(plan.days.map((day) => [day.date, day]));
  const dates = [
    ...new Set([
      ...plan.days.map((day) => day.date),
      ...plan.externalOrders.map((day) => day.date),
      ...plan.externalReservations.map((entry) => entry.fulfillment_date),
    ]),
  ].sort();
  const totalOrders = plan.days.reduce((sum, day) => sum + day.orderCount, 0);
  const totalPieces = plan.days.reduce((sum, day) => sum + day.pieceCount, 0);

  return (
    <div className="grid gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand text-sm font-bold">Kitchen planning</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Kitchen plan
          </h1>
          <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
            Your bake-and-pack list, grouped by delivery date. Paid website
            orders and off-site orders are kept separate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={testOnly ? "warning" : "success"}>
            {testOnly ? "Test website orders" : "Live orders"}
          </Badge>
          <PrintButton label="Print kitchen plan" />
          <Link
            href="/admin/external-orders/new"
            className={buttonVariants({ variant: "secondary" })}
          >
            Record phone / Instagram order
          </Link>
        </div>
      </header>

      <form
        method="get"
        aria-label="Choose production dates"
        className="border-border bg-surface grid gap-4 border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label className="grid gap-1.5 text-sm font-bold">
          <span>From</span>
          <input
            name="from"
            type="date"
            defaultValue={from}
            min={today}
            max={horizon}
            required
            className="border-border-strong min-h-11 w-full rounded-md border bg-white px-3 text-sm"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-bold">
          <span>To · up to 31 days</span>
          <input
            name="to"
            type="date"
            defaultValue={to}
            min={from}
            max={horizon}
            required
            className="border-border-strong min-h-11 w-full rounded-md border bg-white px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className={buttonVariants({ variant: "primary" })}
        >
          <CalendarRange className="size-4" aria-hidden="true" />
          Show plan
        </button>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold sm:col-span-3">
          <input
            type="checkbox"
            name="mode"
            value="test"
            defaultChecked={testOnly}
            className="accent-brand size-4"
          />
          Show test website orders instead
        </label>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card tone="admin" padding="md">
          <p className="text-ink-soft text-sm">Paid orders to prepare</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">
            {totalOrders}
          </p>
        </Card>
        <Card tone="admin" padding="md">
          <p className="text-ink-soft text-sm">Pastry pieces and cakes</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">
            {totalPieces}
          </p>
        </Card>
        <Card tone="admin" padding="md">
          <p className="text-ink-soft text-sm">
            External pastries · payment unverified
          </p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">
            {plan.externalOrders.reduce((sum, day) => sum + day.pieceCount, 0)}
          </p>
        </Card>
      </div>

      {!dates.length ? (
        <StatePanel
          tone="empty"
          title="Nothing to prepare in this range"
          description="Choose other dates or switch between live and test orders. Completed and cancelled orders are excluded."
        />
      ) : (
        <div className="grid gap-8">
          {dates.map((date) => {
            const day = byDay.get(date);
            const externalDay = plan.externalOrders.find(
              (entry) => entry.date === date,
            );
            const external = plan.externalReservations.filter(
              (entry) => entry.fulfillment_date === date,
            );
            return (
              <section key={date} aria-labelledby={`production-${date}`}>
                <div className="border-brand mb-4 flex flex-wrap items-end justify-between gap-2 border-b-2 pb-3">
                  <h2
                    id={`production-${date}`}
                    className="text-xl font-extrabold"
                  >
                    {formatLocalDateLabel(date)}
                  </h2>
                  <p className="text-ink-soft text-sm">
                    {day?.orderCount ?? 0} paid order
                    {day?.orderCount === 1 ? "" : "s"}
                    {external.length
                      ? ` · ${external.length} external space${external.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
                  <Card tone="admin" padding="md">
                    <h3 className="flex items-center gap-2 text-base font-bold">
                      <PackageOpen
                        className="text-brand size-5"
                        aria-hidden="true"
                      />
                      Bake and pack · {day?.pieceCount ?? 0} items
                    </h3>
                    {day?.lines.length ? (
                      <ul className="divide-border mt-4 divide-y">
                        {day.lines.map((line) => (
                          <li
                            key={line.key}
                            className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-3 first:pt-0"
                          >
                            <strong className="text-brand-strong text-xl tabular-nums">
                              {line.quantity}×
                            </strong>
                            <div className="min-w-0">
                              <p className="font-bold">{line.name}</p>
                              {line.variant ? (
                                <p className="text-ink-soft text-sm">
                                  {line.variant}
                                </p>
                              ) : null}
                              {line.choices.length ? (
                                <p className="text-ink-soft mt-1 text-sm">
                                  {line.choices
                                    .map((choice) =>
                                      choice.allocatedQuantity === null
                                        ? choice.label
                                        : `${choice.label} × ${choice.allocatedQuantity}`,
                                    )
                                    .join(" · ")}
                                </p>
                              ) : null}
                              <p className="text-ink-faint mt-1 text-xs">
                                Orders {line.orderNumbers.join(", ")}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-ink-soft mt-4 text-sm">
                        No paid pastry quantities for this date.
                      </p>
                    )}
                  </Card>
                  <div className="grid content-start gap-4">
                    <Card tone="admin" padding="md">
                      <h3 className="font-bold">Orders to review</h3>
                      {day?.orders.length ? (
                        <ul className="mt-3 grid gap-2">
                          {day.orders.map((order) => {
                            const stage = fulfillmentStatusSchema.safeParse(
                              order.stage,
                            );
                            return (
                              <li key={order.id}>
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="border-border hover:border-brand focus-visible:outline-brand flex min-h-11 items-center justify-between gap-2 border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                                >
                                  <span>
                                    <strong>{order.number}</strong>
                                    <span className="text-ink-soft block text-xs">
                                      {order.redelivery ? "Redelivery · " : ""}
                                      {stage.success
                                        ? fulfillmentStage(stage.data).label
                                        : "Review stage"}
                                      {` · ${order.itemCount} items`}
                                    </span>
                                  </span>
                                  <ChevronRight
                                    className="size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-ink-soft mt-3 text-sm">
                          No paid orders.
                        </p>
                      )}
                    </Card>
                    {external.length ? (
                      <Card tone="admin" padding="md">
                        <h3 className="font-bold">External reservations</h3>
                        <p className="text-ink-soft mt-2 text-sm leading-5">
                          These use daily capacity but have no verified pastry
                          list, so they are not included in bake totals.
                        </p>
                        <ul className="mt-3 grid gap-2 text-sm">
                          {external.map((entry) => (
                            <li
                              key={entry.id}
                              className="border-border border px-3 py-2"
                            >
                              <span className="font-bold capitalize">
                                {entry.source}
                              </span>
                              {entry.customer_reference
                                ? ` · ${entry.customer_reference}`
                                : " · No reference"}
                            </li>
                          ))}
                        </ul>
                        <Link
                          href="/admin/availability"
                          className="text-brand-strong mt-3 inline-flex min-h-11 items-center text-sm font-bold underline"
                        >
                          Manage external spaces
                        </Link>
                      </Card>
                    ) : null}
                  </div>
                </div>
                {externalDay ? (
                  <Card tone="admin" padding="md" className="mt-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-bold">
                        Phone & Instagram preparation · {externalDay.pieceCount}{" "}
                        items
                      </h3>
                      <span className="text-warning-ink text-xs font-bold">
                        Payment not verified by website
                      </span>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.6fr)]">
                      <ul className="divide-border divide-y">
                        {externalDay.lines.map((line, index) => (
                          <li
                            key={`${line.name}-${line.note}-${index}`}
                            className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-2 text-sm"
                          >
                            <strong className="text-brand-strong text-lg tabular-nums">
                              {line.quantity}×
                            </strong>
                            <span>
                              <strong>{line.name}</strong>
                              {line.note ? (
                                <span className="text-ink-soft block">
                                  {line.note}
                                </span>
                              ) : null}
                              <span className="text-ink-faint block text-xs">
                                {line.orderNumbers.join(", ")}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <ul className="grid content-start gap-2">
                        {externalDay.orders.map((order) => (
                          <li key={order.id}>
                            <Link
                              href={`/admin/external-orders/${order.id}`}
                              className="border-border hover:border-brand focus-visible:outline-brand flex min-h-11 items-center justify-between border px-3 py-2 text-sm focus-visible:outline-2"
                            >
                              <span>
                                <strong>{order.number}</strong>
                                <span className="text-ink-soft block text-xs capitalize">
                                  {order.source} ·{" "}
                                  {order.status.replaceAll("_", " ")}
                                </span>
                              </span>
                              <ChevronRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
