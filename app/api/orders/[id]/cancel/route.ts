import { type NextRequest } from "next/server";
import { z } from "zod";
import { CHECKOUT_DRAFT_COOKIE } from "@/lib/fulfillment/checkout-draft";
import { cancellationInputSchema } from "@/lib/orders/cancellation";
import { cancellationError } from "@/lib/orders/cancellation-errors";
import { processOrderRefunds } from "@/lib/orders/refund-processor";
import { getGuestOrder, orderCookieName } from "@/lib/payments/order-access";
import { paymentFailure, paymentResponse } from "@/lib/payments/http";
import { readCheckoutJson } from "@/lib/security/json-request";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { DeliveryError } from "@/lib/delivery/errors";
import { getCustomerIdentity } from "@/lib/customer/identity";

export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = cancellationInputSchema.safeParse(
      await readCheckoutJson(request, 1024),
    );
    if (!z.uuid().safeParse(id).success || !input.success)
      throw new DeliveryError(
        "invalid_cancellation",
        "Confirm the order cancellation before continuing.",
        400,
      );
    const access = request.cookies.get(orderCookieName(id))?.value;
    const checkoutAccess = request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value;
    const customerId = (await getCustomerIdentity())?.id;
    // Never accept order access, eligibility, amount or payment identifiers from
    // the submitted body. Authorize the exact order before privileged mutation.
    await getGuestOrder(id, access, checkoutAccess, customerId);
    const result = await createSecretSupabaseClient().rpc("cancel_order", {
      p_order_id: id,
      p_expected_version: input.data.expectedVersion,
    });
    if (result.error) throw cancellationError(result.error);
    try {
      await processOrderRefunds(result.data);
    } catch {
      // Cancellation is committed; the durable worker resumes this refund.
    }
    return paymentResponse({
      order: await getGuestOrder(id, access, checkoutAccess, customerId),
    });
  } catch (error) {
    return paymentFailure(
      error instanceof DeliveryError ? error : cancellationError({}),
    );
  }
}
