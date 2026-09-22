import {
  fulfillmentMethodSchema,
  localMonthSchema,
} from "@/lib/fulfillment/schema";
import { getAvailabilityMonth } from "@/lib/fulfillment/server-data";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const allowed = new Set(["method", "month"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json(
      {
        error: {
          code: "invalid_query",
          message: "The availability request is invalid.",
        },
      },
      400,
    );
  }
  const method = fulfillmentMethodSchema.safeParse(
    url.searchParams.get("method"),
  );
  const month = localMonthSchema.safeParse(url.searchParams.get("month"));
  if (!method.success || !month.success) {
    return json(
      {
        error: {
          code: "invalid_query",
          message: "Choose delivery and a valid month.",
        },
      },
      400,
    );
  }
  try {
    return json(
      await getAvailabilityMonth({ method: method.data, month: month.data }),
    );
  } catch (error) {
    const outsideRange =
      error instanceof Error &&
      /outside the booking period/i.test(error.message);
    return json(
      {
        error: {
          code: outsideRange
            ? "outside_booking_period"
            : "availability_unavailable",
          message: outsideRange
            ? "That month is outside the current booking period."
            : "We could not confirm available dates. Please retry.",
        },
      },
      outsideRange ? 400 : 503,
    );
  }
}
