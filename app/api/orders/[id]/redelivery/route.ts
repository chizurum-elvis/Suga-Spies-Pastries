import { type NextRequest } from "next/server";
import { z } from "zod";
import { CHECKOUT_DRAFT_COOKIE } from "@/lib/fulfillment/checkout-draft";
import { deliveryAddressSchema } from "@/lib/delivery/schema";
import { DeliveryError } from "@/lib/delivery/errors";
import {
  beginRedeliveryPayment,
  requestRedelivery,
} from "@/lib/orders/redelivery";
import { getGuestOrder, orderCookieName } from "@/lib/payments/order-access";
import { paymentFailure, paymentResponse } from "@/lib/payments/http";
import { readCheckoutJson } from "@/lib/security/json-request";
import { getCustomerIdentity } from "@/lib/customer/identity";

const inputSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("request"),
    expectedVersion: z.number().int().positive(),
    address: deliveryAddressSchema,
  }),
  z.strictObject({
    action: z.literal("pay"),
    expectedVersion: z.number().int().positive(),
  }),
]);

export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = inputSchema.safeParse(await readCheckoutJson(request, 4096));
    if (!z.uuid().safeParse(id).success || !input.success)
      throw new DeliveryError(
        "invalid_redelivery",
        "Check the address and try again.",
        400,
      );
    const access = request.cookies.get(orderCookieName(id))?.value;
    const checkoutAccess = request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value;
    const customerId = (await getCustomerIdentity())?.id;
    // An opaque guest-order cookie authorizes this exact order. The body cannot
    // supply a price, distance, date, or owner-selected fulfillment status.
    await getGuestOrder(id, access, checkoutAccess, customerId);
    if (input.data.action === "request") {
      await requestRedelivery(
        id,
        input.data.expectedVersion,
        input.data.address,
      );
      return paymentResponse({
        order: await getGuestOrder(id, access, checkoutAccess, customerId),
      });
    }
    const url = await beginRedeliveryPayment(id, input.data.expectedVersion);
    return paymentResponse({ url });
  } catch (error) {
    return paymentFailure(error);
  }
}
