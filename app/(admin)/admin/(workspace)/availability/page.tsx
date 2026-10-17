import { CalendarDays, Clock3, LockKeyhole, PackageCheck } from "lucide-react";
import { AdminLink as Link } from "@/components/navigation/admin-link";

import { BlackoutEditor } from "@/components/admin/blackout-editor";
import { BlackoutForm } from "@/components/admin/blackout-form";
import { CapacityEntry } from "@/components/admin/capacity-entry";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getAdminFulfillmentData } from "@/lib/fulfillment/admin-data";
import { AdminPageHeading } from "@/components/admin/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { parseLocalDate } from "@/lib/fulfillment/rules";
import { requireOwnerSession } from "@/lib/auth/session";

const weekdayNames = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default async function AvailabilityAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireOwnerSession("/admin/availability");
  const supplied = await searchParams;
  const from =
    typeof supplied.from === "string" && parseLocalDate(supplied.from)
      ? supplied.from
      : undefined;
  const data = await getAdminFulfillmentData(new Date(), from);
  const today = data.days[0]!;
  return (
    <div className="grid gap-8">
      <AdminPageHeading
        title="Delivery calendar"
        description="See booked spaces, block days off, and keep every order within the four-order daily limit."
        action={<Badge>{data.settings.dailyCapacity} spaces per day</Badge>}
      />

      <section
        aria-labelledby="today-capacity-heading"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label:
              today.date === data.today
                ? "Today reserved"
                : "Selected day reserved",
            value: `${today.consumed} / 4`,
            icon: CalendarDays,
          },
          {
            label: "Confirmed website",
            value: today.confirmedWebsiteOrders,
            icon: PackageCheck,
          },
          {
            label: "Other reservations",
            value: today.manualOrders,
            icon: LockKeyhole,
          },
          {
            label: "Active payment holds",
            value: today.activeHolds,
            icon: Clock3,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} tone="admin" padding="md">
              <Icon className="text-brand size-5" aria-hidden="true" />
              <p className="text-ink-faint mt-4 text-xs font-bold tracking-[0.1em] uppercase">
                {item.label}
              </p>
              <p className="text-ink mt-1 text-2xl font-extrabold tabular-nums">
                {item.value}
              </p>
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="capacity-calendar-heading">
        <div className="mb-4">
          <h2 id="capacity-calendar-heading" className="text-xl font-extrabold">
            Delivery availability
          </h2>
          <p className="text-ink-soft mt-1 text-sm">
            Customers need {data.settings.minimumNoticeDays} days’ notice and
            can book {data.settings.bookingHorizonMonths} months ahead.
            Confirmed orders remain valid if you later block their date.
          </p>
        </div>
        <form
          method="get"
          className="admin-chrome mb-4 flex flex-wrap items-end gap-3"
          aria-label="Choose calendar dates"
        >
          <label className="grid gap-1 text-xs font-bold">
            Starting date
            <input
              type="date"
              name="from"
              defaultValue={data.days[0]?.date}
              min={data.today}
              max={data.maximumDate}
              required
              className="border-border-strong border bg-white px-3"
            />
          </label>
          <button
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Show 14 days
          </button>
        </form>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {data.days.map((day) => (
            <div
              key={day.date}
              className={
                day.remaining === 0
                  ? "border-critical-ink/25 bg-critical border p-3"
                  : day.closure
                    ? "border-warning-ink/25 bg-warning/50 border p-3"
                    : "border-border border bg-white p-3"
              }
            >
              <p className="text-ink-faint text-[0.6875rem] font-bold uppercase">
                {day.dateLabel.split(",")[0]}
              </p>
              <p className="text-ink mt-1 font-extrabold tabular-nums">
                {day.date.slice(8)}
              </p>
              <p className="text-ink-soft mt-2 text-xs">
                {day.closure ??
                  (day.customerBookable
                    ? `${day.remaining} spaces left`
                    : "Too soon to book")}
              </p>
              <p className="text-ink-soft mt-1 text-xs">
                {day.consumed} / {data.settings.dailyCapacity} reserved
              </p>
              {day.consumed > 0 ? (
                <Link
                  href={`/admin/orders?date=${day.date}&mode=all`}
                  className="text-brand-strong mt-2 inline-flex min-h-11 items-center text-xs font-bold underline"
                >
                  View orders
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card tone="admin" padding="lg">
          <h2 className="text-xl font-extrabold">Block a delivery date</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Close one date so customers cannot select it for delivery.
          </p>
          <div className="mt-5">
            <BlackoutForm
              minimumDate={data.today}
              maximumDate={data.maximumDate}
            />
          </div>
        </Card>
        <Card tone="admin" padding="lg">
          <h2 className="text-xl font-extrabold">Record an external order</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Phone and Instagram orders must use the same four daily spaces as
            website orders.
          </p>
          <Link
            href="/admin/external-orders/new"
            className="text-brand-strong mt-5 inline-flex min-h-11 items-center font-bold underline"
          >
            Record pastries, delivery, and contact details →
          </Link>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div>
          <h2 className="text-xl font-extrabold">Upcoming blackouts</h2>
          <div className="mt-4 grid gap-3">
            {data.blackouts.length ? (
              data.blackouts.map((blackout) => (
                <BlackoutEditor
                  key={blackout.id}
                  blackout={blackout}
                  minimumDate={data.today}
                  maximumDate={data.maximumDate}
                />
              ))
            ) : (
              <StatePanel
                tone="empty"
                title="No upcoming blackouts"
                description="Normal weekly hours and standard closures control customer availability."
              />
            )}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-extrabold">
            Reservations and booked spaces
          </h2>
          {data.adjustments.length ? (
            <ul className="mt-4 grid gap-3">
              {data.adjustments.map((entry) => (
                <CapacityEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <StatePanel
                tone="empty"
                title="No external orders recorded"
                description="Add phone, Instagram, or owner-entered orders as soon as they are accepted."
              />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="weekly-hours-heading">
        <Card tone="admin" padding="lg">
          <h2 id="weekly-hours-heading" className="text-xl font-extrabold">
            Weekly delivery days
          </h2>
          <p className="text-ink-soft mt-2 text-sm">
            Customers choose a date only. The business calendar uses{" "}
            {data.settings.timeZone}.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-3 py-3 font-extrabold">Day</th>
                  <th className="px-3 py-3 font-extrabold">Availability</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                  <tr
                    key={weekday}
                    className="border-border border-b last:border-0"
                  >
                    <td className="px-3 py-3">{weekdayNames[weekday]}</td>
                    <td className="px-3 py-3 font-bold">
                      {data.hours.some(
                        (hours) =>
                          hours.isoWeekday === weekday && hours.isEnabled,
                      )
                        ? "Open for delivery"
                        : "Closed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
