import { NextResponse, type NextRequest } from "next/server";
import { CHECKOUT_DRAFT_COOKIE } from "@/lib/fulfillment/checkout-draft";
import { DeliveryError } from "@/lib/delivery/errors";
import {
  saveDetailsSchema,
  deliveryOperationSchema,
} from "@/lib/delivery/schema";
import {
  getDeliveryState,
  saveDeliveryDetails,
  quoteDelivery,
  confirmDelivery,
} from "@/lib/delivery/server";
import { readCheckoutJson } from "@/lib/security/json-request";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
};
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}
function failure(error: unknown) {
  if (error instanceof DeliveryError)
    return response(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  return response(
    {
      error: {
        code: "delivery_unavailable",
        message: "We could not load delivery details. Please retry.",
      },
    },
    503,
  );
}
export async function GET(request: NextRequest) {
  try {
    return response({
      delivery: await getDeliveryState(
        request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: NextRequest) {
  try {
    const input = saveDetailsSchema.safeParse(await readCheckoutJson(request));
    if (!input.success)
      return response(
        {
          error: {
            code: "invalid_details",
            message: "Check the highlighted delivery details.",
            fields: input.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        400,
      );
    const { input: details, cart, draftVersion, version } = input.data;
    return response({
      delivery: await saveDeliveryDetails(
        request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
        details,
        cart,
        draftVersion,
        version,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readCheckoutJson(request);
    const input = deliveryOperationSchema.safeParse(body);
    const action = request.nextUrl.searchParams.get("action");
    if (!input.success || !["quote", "confirm"].includes(action ?? ""))
      return response(
        {
          error: {
            code: "invalid_details",
            message: "Reload your delivery details and try again.",
          },
        },
        400,
      );
    const { cart, draftVersion, version } = input.data;
    const handler = action === "quote" ? quoteDelivery : confirmDelivery;
    return response({
      delivery: await handler(
        request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
        cart,
        draftVersion,
        version,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
