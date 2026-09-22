import {
  CHECKOUT_DRAFT_COOKIE,
  checkoutDraftCookieOptions,
  getCheckoutDraft,
  saveCheckoutDraft,
} from "@/lib/fulfillment/checkout-draft";
import { NextResponse, type NextRequest } from "next/server";
import { fulfillmentSelectionSchema } from "@/lib/fulfillment/schema";
import { validateFulfillmentSelection } from "@/lib/fulfillment/server-data";
import { validateCartAgainstCatalogue } from "@/lib/cart/server-validation";
import { isSameOriginMutation } from "@/lib/security/request";
import { DeliveryError } from "@/lib/delivery/errors";
import { getMonthForDate, getTorontoLocalDate } from "@/lib/fulfillment/rules";

const MAX_REQUEST_BYTES = 128 * 1024;
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

// Only the date summary is exposed; the bearer token remains HttpOnly.
export async function GET(request: NextRequest) {
  try {
    const draft = await getCheckoutDraft(
      request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
    );
    return json({
      draft,
      initialMonth: getMonthForDate(getTorontoLocalDate()),
    });
  } catch {
    return json(
      {
        error: {
          code: "draft_unavailable",
          message: "We could not load your delivery date. Please retry.",
        },
      },
      503,
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return json(
      {
        error: {
          code: "invalid_origin",
          message: "Refresh this page before trying again.",
        },
      },
      403,
    );
  }
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim();
  if (mediaType !== "application/json") {
    return json(
      {
        error: {
          code: "unsupported_media_type",
          message: "Send this checkout as JSON.",
        },
      },
      415,
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json(
      {
        error: {
          code: "request_too_large",
          message: "This checkout is too large to process safely.",
        },
      },
      413,
    );
  }

  let input: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return json(
        {
          error: {
            code: "request_too_large",
            message: "This checkout is too large to process safely.",
          },
        },
        413,
      );
    }
    input = JSON.parse(body);
  } catch {
    return json(
      {
        error: {
          code: "invalid_json",
          message: "The fulfillment selection could not be read.",
        },
      },
      400,
    );
  }
  const parsed = fulfillmentSelectionSchema.safeParse(input);
  if (!parsed.success) {
    return json(
      {
        error: {
          code: "invalid_selection",
          message: "Choose an available delivery date.",
        },
      },
      400,
    );
  }

  try {
    const validatedCart = await validateCartAgainstCatalogue(parsed.data.cart);
    if (
      validatedCart.status !== "ready" ||
      validatedCart.subtotalCents === null
    ) {
      return json(
        {
          error: {
            code: "cart_requires_review",
            message:
              "Your pastry cart changed and must be reviewed before scheduling.",
          },
        },
        409,
      );
    }
    const selection = await validateFulfillmentSelection(parsed.data);
    if (selection.issue) {
      return json(
        {
          error: {
            code: selection.issue.code,
            message: selection.issue.message,
          },
        },
        409,
      );
    }
    const existingToken = request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value;
    const saved = await saveCheckoutDraft({
      rawToken: existingToken,
      cart: parsed.data.cart,
      validatedCart,
      method: parsed.data.method,
      date: parsed.data.date,
    });
    const response = json({ draft: saved.draft });
    response.cookies.set(
      CHECKOUT_DRAFT_COOKIE,
      saved.rawToken,
      checkoutDraftCookieOptions(saved.maxAge),
    );
    return response;
  } catch (error) {
    if (error instanceof DeliveryError)
      return json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    return json(
      {
        error: {
          code: "fulfillment_unavailable",
          message:
            "We could not save this delivery date. Your cart is safe—please retry.",
        },
      },
      503,
    );
  }
}
