import { CalendarDays, Clock3, LockKeyhole, PackageCheck } from "lucide-react";

import { BlackoutEditor } from "@/components/admin/blackout-editor";
import { BlackoutForm } from "@/components/admin/blackout-form";
import { CapacityAdjustmentForm } from "@/components/admin/capacity-adjustment-form";
import { CapacityEntry } from "@/components/admin/capacity-entry";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getAdminFulfillmentData } from "@/lib/fulfillment/admin-data";

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

export default async function AvailabilityAdminPage() {
  const data = await getAdminFulfillmentData();
  const today = data.days[0]!;
  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="accent">Toronto fulfillment</Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Availability
          </h1>
          <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6 sm:text-base">
            Block dates and record off-site orders. All delivery orders share
            four spaces per day.
          </p>
        </div>
        <Badge tone="success">
          Hard limit: {data.settings.dailyCapacity} orders
        </Badge>
      </header>

      <section
        aria-labelledby="today-capacity-heading"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Today used",
            value: `${today.consumed} / 4`,
            icon: CalendarDays,
          },
          {
            label: "Confirmed website",
            value: today.confirmedWebsiteOrders,
            icon: PackageCheck,
          },
          {
            label: "External orders",
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
            Next 14 days
          </h2>
          <p className="text-ink-soft mt-1 text-sm">
            Active holds disappear from the count automatically after expiry.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {data.days.map((day) => (
            <div
              key={day.date}
              className={
                day.remaining === 0
                  ? "border-critical-ink/25 bg-critical border p-3"
                  : day.blackoutCount
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
                {day.remaining} space{day.remaining === 1 ? "" : "s"} left
              </p>
              {day.blackoutCount ? (
                <p className="text-warning-ink mt-1 text-xs font-bold">
                  {day.blackoutCount} blackout
                  {day.blackoutCount === 1 ? "" : "s"}
                </p>
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
          <div className="mt-5">
            <CapacityAdjustmentForm
              minimumDate={data.today}
              maximumDate={data.maximumDate}
            />
          </div>
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
          <h2 className="text-xl font-extrabold">External order spaces</h2>
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
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-3 py-3 font-extrabold">Day</th>
                  <th className="px-3 py-3 font-extrabold">Availability</th>
                </tr>
              </thead>
              <tbody>
                {data.hours.map((hours) => (
                  <tr
                    key={hours.id}
                    className="border-border border-b last:border-0"
                  >
                    <td className="px-3 py-3">
                      {weekdayNames[hours.isoWeekday]}
                    </td>
                    <td className="px-3 py-3 font-bold">Open for delivery</td>
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
