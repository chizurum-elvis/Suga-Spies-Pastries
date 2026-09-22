import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  CHECKOUT_DRAFT_COOKIE,
  checkoutDraftCookieOptions,
} from "@/lib/fulfillment/checkout-draft";
import {
  getGuestOrder,
  orderCookieName,
  verifyOrderAccess,
} from "@/lib/payments/order-access";
import { paymentResponse, paymentFailure } from "@/lib/payments/http";
import { readCheckoutJson } from "@/lib/security/json-request";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    return paymentResponse({
      order: await getGuestOrder(
        id,
        request.cookies.get(orderCookieName(id))?.value,
        request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
      ),
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = z
      .strictObject({ access: z.string().max(100) })
      .safeParse(await readCheckoutJson(request, 1024));
    if (!body.success || !verifyOrderAccess(id, body.data.access))
      return paymentResponse(
        {
          error: {
            code: "order_not_found",
            message: "This order link is unavailable or has expired.",
          },
        },
        404,
      );
    const order = await getGuestOrder(id, body.data.access);
    const response = paymentResponse({ order });
    const seconds = Math.max(
      1,
      Math.floor(Number(body.data.access.split(".")[0]) - Date.now() / 1000),
    );
    response.cookies.set(orderCookieName(id), body.data.access, {
      ...checkoutDraftCookieOptions(seconds),
      path: `/api/orders/${id}`,
    });
    return response;
  } catch (error) {
    return paymentFailure(error);
  }
}
