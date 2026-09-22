import { z } from "zod";
import { rawCartSchema } from "@/lib/cart/schema";
import { validatedCartSchema } from "@/lib/cart/response-schema";
import { deliveryInputSchema } from "@/lib/delivery/schema";
import { localDateSchema } from "@/lib/fulfillment/schema";
import { deliveryCancellationDeadline } from "@/lib/fulfillment/rules";
import {
  fulfillmentStatusSchema,
  orderEventSchema,
  orderStatusSchema,
} from "@/lib/orders/status";

export const moneySchema = z.number().int().min(0).max(99_999_999);
export const policySchema = z.strictObject({
  version: z.string().min(1).max(80),
  termsUrl: z.url({ protocol: /^https$/ }),
  privacyUrl: z.url({ protocol: /^https$/ }),
  refundUrl: z.url({ protocol: /^https$/ }),
});
export const purchaseSnapshotSchema = z
  .strictObject({
    version: z.literal(3),
    cart: rawCartSchema,
    validatedCart: validatedCartSchema,
    delivery: deliveryInputSchema,
    fulfillmentDate: localDateSchema,
    cancellationDeadline: z.iso.datetime({ offset: true }),
    subtotalCents: moneySchema,
    deliveryCents: moneySchema,
    totalCents: moneySchema.min(50),
    currency: z.literal("CAD"),
    policyVersion: z.string().min(1).max(80),
    testOnly: z.boolean(),
  })
  .superRefine((snapshot, context) => {
    const { validatedCart: cart } = snapshot;
    const lines = cart.lines;
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (
      cart.status !== "ready" ||
      !lines.length ||
      lines.some(
        (line) =>
          line.status !== "ready" ||
          !line.product ||
          line.unitPriceCents === null ||
          line.lineSubtotalCents === null ||
          line.lineSubtotalCents !== line.unitPriceCents * line.quantity,
      )
    )
      fail("A complete, priced pastry box is required.");
    if (
      snapshot.cart.lines.length !== lines.length ||
      snapshot.cart.lines.some((raw, index) => {
        const line = lines[index];
        return (
          !line ||
          raw.productId !== line.productId ||
          raw.variantId !== line.variantId ||
          raw.quantity !== line.quantity ||
          JSON.stringify(raw.optionSelections) !==
            JSON.stringify(line.optionSelections)
        );
      })
    )
      fail("The purchase selections do not match the validated box.");
    if (
      cart.lineCount !== lines.length ||
      cart.itemCount !== lines.reduce((sum, line) => sum + line.quantity, 0) ||
      new Set(lines.map((line) => line.lineId)).size !== lines.length
    )
      fail("Invalid purchase line identities or quantities.");
    if (
      snapshot.subtotalCents !== cart.subtotalCents ||
      snapshot.subtotalCents !==
        lines.reduce((sum, line) => sum + (line.lineSubtotalCents ?? 0), 0)
    )
      fail("The pastry subtotal does not match its lines.");
    if (snapshot.totalCents !== snapshot.subtotalCents + snapshot.deliveryCents)
      fail("The payment total does not match its breakdown.");
    if (
      snapshot.cancellationDeadline !==
      deliveryCancellationDeadline(snapshot.fulfillmentDate).toISOString()
    )
      fail("The cancellation deadline does not match the delivery date.");
  });
export const paymentStatusSchema = z.enum([
  "creating",
  "open",
  "processing",
  "paid",
  "expired",
  "refund_pending",
  "refunded",
  "needs_review",
]);
export const paymentAttemptViewSchema = z.strictObject({
  id: z.uuid(),
  status: paymentStatusSchema,
  expiresAt: z.iso.datetime({ offset: true }),
  orderId: z.uuid().nullable(),
  clientSecret: z.string().nullable(),
  snapshot: purchaseSnapshotSchema,
});
export const paymentReviewSchema = z.strictObject({
  snapshot: purchaseSnapshotSchema.nullable(),
  reviewToken: z.string().nullable(),
  blockers: z.array(z.string()),
  policies: policySchema.nullable(),
  attempt: paymentAttemptViewSchema.nullable(),
});
export const startPaymentSchema = z.strictObject({
  cart: rawCartSchema,
  reviewToken: z.string().regex(/^[0-9a-f]{64}$/),
  acceptedPolicies: z.literal(true),
});
export const orderViewSchema = z.strictObject({
  id: z.uuid(),
  orderNumber: z.string(),
  placedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  version: z.number().int().min(1),
  status: orderStatusSchema,
  paymentStatus: z.literal("paid"),
  fulfillmentStatus: fulfillmentStatusSchema,
  events: z.array(orderEventSchema).min(1).max(20),
  snapshot: purchaseSnapshotSchema,
});
export type PurchaseSnapshot = z.infer<typeof purchaseSnapshotSchema>;
export type PaymentReview = z.infer<typeof paymentReviewSchema>;
export type PaymentAttemptView = z.infer<typeof paymentAttemptViewSchema>;
export type OrderView = z.infer<typeof orderViewSchema>;
