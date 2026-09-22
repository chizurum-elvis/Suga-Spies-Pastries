import { NextResponse } from "next/server";
import { DeliveryError } from "@/lib/delivery/errors";

export const paymentHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
export function paymentResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: paymentHeaders });
}
export function paymentFailure(error: unknown) {
  if (error instanceof DeliveryError)
    return paymentResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  return paymentResponse(
    {
      error: {
        code: "payment_unavailable",
        message:
          "We could not check payment just now. Your box is saved. Please retry without starting another payment.",
      },
    },
    503,
  );
}
