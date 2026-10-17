import { Check, CircleDot } from "lucide-react";
import { formatBusinessDateTime } from "@/lib/i18n/format";
import type { FulfillmentStatus, OrderEvent } from "@/lib/orders/status";

export function OrderTimeline({
  events,
  compact = false,
}: {
  currentStatus: FulfillmentStatus;
  events: OrderEvent[];
  compact?: boolean;
  cancelled?: boolean;
}) {
  return (
    <ol aria-label="Order progress" className="space-y-0">
      {events.map((event, index) => {
        const current = index === events.length - 1;
        const Icon = current ? CircleDot : Check;
        return (
          <li
            key={event.id}
            className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3"
          >
            {!current ? (
              <span
                aria-hidden="true"
                className="bg-sage-ink/45 absolute top-9 bottom-0 left-[1.08rem] w-px"
              />
            ) : null}
            <span
              className={`bg-surface relative z-10 grid size-9 place-items-center rounded-full border ${current ? "border-brand bg-brand-soft text-brand-strong" : "border-sage-ink/30 bg-sage text-sage-ink"}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">
                {current ? "Current" : "Completed"}
              </span>
            </span>
            <div
              className={`min-w-0 ${compact ? "pb-5" : "pb-6"}`}
              aria-current={current ? "step" : undefined}
            >
              <p className="text-ink text-sm font-bold">{event.title}</p>
              <p className="text-ink-soft mt-1 text-sm leading-5">
                {event.message}
              </p>
              <time
                dateTime={event.occurredAt}
                className="text-ink-faint mt-1 block text-xs"
              >
                {formatBusinessDateTime(event.occurredAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
