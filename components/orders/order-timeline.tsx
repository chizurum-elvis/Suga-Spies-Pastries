import { Check, Circle, CircleDot } from "lucide-react";

import { formatBusinessDateTime } from "@/lib/i18n/format";
import {
  fulfillmentStageIndex,
  fulfillmentStages,
  type FulfillmentStatus,
  type OrderEvent,
} from "@/lib/orders/status";
import { cn } from "@/lib/utils/cn";

export function OrderTimeline({
  currentStatus,
  events,
  compact = false,
}: {
  currentStatus: FulfillmentStatus;
  events: OrderEvent[];
  compact?: boolean;
}) {
  const currentIndex = fulfillmentStageIndex(currentStatus);
  const eventByStatus = new Map(events.map((event) => [event.status, event]));

  return (
    <ol aria-label="Order progress" className="grid">
      {fulfillmentStages.map((stage, index) => {
        const event = eventByStatus.get(stage.status);
        const current = index === currentIndex;
        const complete =
          index < currentIndex || (current && currentStatus === "delivered");
        const Icon = complete ? Check : current ? CircleDot : Circle;
        return (
          <li
            key={stage.status}
            className={cn(
              "relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3",
              !compact && "sm:grid-cols-[2.5rem_minmax(0,1fr)]",
            )}
            aria-current={current ? "step" : undefined}
          >
            {index < fulfillmentStages.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "bg-border absolute top-9 bottom-0 left-[1.08rem] w-px",
                  !compact && "sm:left-[1.2rem]",
                  index < currentIndex && "bg-sage-ink/45",
                )}
              />
            ) : null}
            <span
              className={cn(
                "bg-surface relative z-10 grid size-9 place-items-center rounded-full border",
                complete && "border-sage-ink/30 bg-sage text-sage-ink",
                current && "border-brand bg-brand-soft text-brand-strong",
                !complete && !current && "border-border text-ink-faint",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">
                {complete ? "Completed" : current ? "Current" : "Upcoming"}
              </span>
            </span>
            <div className={cn("min-w-0 pb-6", compact && "pb-5")}>
              <p
                className={cn(
                  "text-sm font-bold",
                  !event && !current ? "text-ink-faint" : "text-ink",
                )}
              >
                {event?.title ?? stage.label}
              </p>
              {event ? (
                <>
                  <p className="text-ink-soft mt-1 text-sm leading-5">
                    {event.message}
                  </p>
                  <time
                    dateTime={event.occurredAt}
                    className="text-ink-faint mt-1 block text-xs"
                  >
                    {formatBusinessDateTime(event.occurredAt)}
                  </time>
                </>
              ) : current ? (
                <p className="text-ink-soft mt-1 text-sm leading-5">
                  {stage.summary}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
