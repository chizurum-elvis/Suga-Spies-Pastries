import { type NextRequest } from "next/server";
import { CHECKOUT_DRAFT_COOKIE } from "@/lib/fulfillment/checkout-draft";
import { readCheckoutJson } from "@/lib/security/json-request";
import { paymentResponse, paymentFailure } from "@/lib/payments/http";
import { startPaymentSchema } from "@/lib/payments/schema";
import {
  buildPaymentReview,
  currentAttempt,
  reservePayment,
} from "@/lib/payments/review";
import { attemptView, reconcilePayment } from "@/lib/payments/processor";
import { paymentConfiguration } from "@/lib/payments/configuration";
import { getServerEnvironment } from "@/lib/env/server";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value;
    const attempt = await currentAttempt(token);
    if (attempt && !["expired", "refunded"].includes(attempt.status)) {
      const config = paymentConfiguration(getServerEnvironment());
      return paymentResponse({
        review: {
          snapshot: null,
          reviewToken: null,
          blockers: config.blockers,
          policies: config.policies,
          attempt: await attemptView(attempt, config.blockers.length === 0),
        },
      });
    }
    return paymentResponse({
      review: (await buildPaymentReview(token)).review,
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readCheckoutJson(request);
    const input = startPaymentSchema.safeParse(body);
    if (!input.success)
      return paymentResponse(
        {
          error: {
            code: "review_required",
            message:
              "Review your order and accept the checkout terms before continuing.",
          },
        },
        400,
      );
    const attempt = await reservePayment(
      request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
      input.data,
    );
    const config = paymentConfiguration(getServerEnvironment());
    return paymentResponse({
      attempt: await attemptView(attempt, config.blockers.length === 0),
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await readCheckoutJson(request, 1024);
    const attempt = await currentAttempt(
      request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
    );
    if (attempt && !["paid", "expired", "refunded"].includes(attempt.status))
      await reconcilePayment(attempt, undefined, true);
    const latest = await currentAttempt(
      request.cookies.get(CHECKOUT_DRAFT_COOKIE)?.value,
    );
    return paymentResponse({
      attempt: latest ? await attemptView(latest) : null,
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
