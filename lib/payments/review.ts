import "server-only";
import { z } from "zod";
import { serializeCart, rawCartSchema } from "@/lib/cart/schema";
import { validateCartAgainstCatalogue } from "@/lib/cart/server-validation";
import { DeliveryError } from "@/lib/delivery/errors";
import { deliveryContext } from "@/lib/delivery/server";
import {
  deliveryInputSchema,
  deliveryQuoteSchema,
} from "@/lib/delivery/schema";
import { getServerEnvironment } from "@/lib/env/server";
import { pricingFingerprint, sha256 } from "@/lib/fulfillment/checkout-draft";
import { validateFulfillmentSelection } from "@/lib/fulfillment/server-data";
import { deliveryCancellationDeadline } from "@/lib/fulfillment/rules";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { paymentConfiguration } from "@/lib/payments/configuration";
import {
  purchaseSnapshotSchema,
  type PaymentReview,
  type PurchaseSnapshot,
} from "@/lib/payments/schema";

export async function checkoutIdentity(token?: string) {
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token))
    throw new DeliveryError(
      "draft_expired",
      "Choose your delivery date to continue.",
      401,
    );
  const db = createSecretSupabaseClient();
  const { data, error } = await db
    .from("checkout_drafts")
    .select("id, access_token_hash")
    .eq("access_token_hash", sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error)
    throw new DeliveryError(
      "checkout_unavailable",
      "Checkout is temporarily unavailable. Please retry.",
      503,
    );
  if (!data)
    throw new DeliveryError(
      "draft_expired",
      "Choose your delivery date to continue.",
      401,
    );
  return { db, draft: data };
}

export async function currentAttempt(token?: string) {
  const { db, draft } = await checkoutIdentity(token);
  const result = await db
    .from("payment_attempts")
    .select("*")
    .eq("checkout_draft_id", draft.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error)
    throw new DeliveryError(
      "checkout_unavailable",
      "Payment checkout is not available yet. Your box is saved.",
      503,
    );
  return result.data;
}

export function snapshotFingerprint(
  snapshot: PurchaseSnapshot,
  draftVersion: number,
  detailsVersion: number,
  quoteId: string,
) {
  return sha256(
    JSON.stringify({
      snapshot: {
        ...snapshot,
        validatedCart: { ...snapshot.validatedCart, validatedAt: "" },
      },
      draftVersion,
      detailsVersion,
      quoteId,
    }),
  );
}

export async function buildPaymentReview(token?: string) {
  const environment = getServerEnvironment();
  const config = paymentConfiguration(environment);
  const context = await deliveryContext(token);
  const worker = await createSecretSupabaseClient()
    .from("payment_worker_health")
    .select("checked_at")
    .eq("mode", config.testOnly ? "test" : "live")
    .maybeSingle();
  if (
    worker.error ||
    !worker.data ||
    Date.parse(worker.data.checked_at) <= Date.now() - 180_000
  )
    config.blockers.push(
      "Payment confirmation is temporarily unavailable. Please try again shortly.",
    );
  const { draft, details, settings } = context;
  const quote = deliveryQuoteSchema.safeParse(details?.quote);
  if (
    !details ||
    details.status !== "confirmed" ||
    !quote.success ||
    new Date(quote.data.expiresAt).getTime() <= Date.now() ||
    quote.data.settingsVersion !== settings.version ||
    quote.data.cartFingerprint !== draft.cart_fingerprint ||
    quote.data.pricingFingerprint !== draft.pricing_fingerprint
  )
    throw new DeliveryError(
      "delivery_review_required",
      "Review and confirm your delivery address and fee first.",
      409,
    );
  const cart = rawCartSchema.parse(draft.cart_payload);
  const validated = await validateCartAgainstCatalogue(cart);
  if (
    validated.status !== "ready" ||
    pricingFingerprint(validated) !== draft.pricing_fingerprint
  )
    throw new DeliveryError(
      "cart_changed",
      "Your pastry box or its prices changed. Please review your cart.",
      409,
    );
  const selection = await validateFulfillmentSelection({
    method: "delivery",
    date: draft.fulfillment_date,
  });
  if (selection.issue)
    throw new DeliveryError(
      "schedule_changed",
      "That delivery date is no longer available. Choose another date.",
      409,
    );
  const snapshot: PurchaseSnapshot = purchaseSnapshotSchema.parse({
    version: 3,
    cart,
    validatedCart: validated,
    delivery: {
      ...deliveryInputSchema.parse(details.input),
      address: quote.data.address,
    },
    fulfillmentDate: draft.fulfillment_date,
    cancellationDeadline: deliveryCancellationDeadline(
      draft.fulfillment_date,
    ).toISOString(),
    subtotalCents: validated.subtotalCents,
    deliveryCents: quote.data.feeCents,
    totalCents: validated.subtotalCents! + quote.data.feeCents,
    currency: "CAD",
    policyVersion: config.policies?.version ?? "development-only",
    testOnly: config.testOnly,
  });
  const review: PaymentReview = {
    snapshot,
    reviewToken: snapshotFingerprint(
      snapshot,
      draft.version,
      details.version,
      quote.data.id,
    ),
    blockers: config.blockers,
    policies: config.policies,
    attempt: null,
  };
  return { context, review };
}

export async function reservePayment(
  token: string | undefined,
  body: { cart: z.infer<typeof rawCartSchema>; reviewToken: string },
) {
  const existing = await currentAttempt(token);
  if (existing && !["expired", "refunded"].includes(existing.status)) {
    if (
      existing.review_token !== body.reviewToken ||
      serializeCart(body.cart) !==
        serializeCart(purchaseSnapshotSchema.parse(existing.snapshot).cart)
    )
      throw new DeliveryError(
        "payment_in_progress",
        "A payment is already in progress. Return to payment before changing your box.",
        409,
      );
    return existing;
  }
  const { context, review } = await buildPaymentReview(token);
  if (review.blockers.length || !review.snapshot)
    throw new DeliveryError(
      "payment_unavailable",
      review.blockers[0] ?? "Payment is not available yet.",
      503,
    );
  if (
    body.reviewToken !== review.reviewToken ||
    sha256(serializeCart(body.cart)) !== context.draft.cart_fingerprint
  )
    throw new DeliveryError(
      "review_changed",
      "Your order changed. Review the updated total before paying.",
      409,
    );
  const result = await context.db.rpc("begin_wallet_payment", {
    p_draft_id: context.draft.id,
    p_draft_version: context.draft.version,
    p_details_version: context.details!.version,
    p_review_token: body.reviewToken,
    p_snapshot: z.json().parse(review.snapshot),
  });
  if (result.error)
    throw new DeliveryError(
      "reservation_failed",
      result.error.message.includes("capacity")
        ? "That day just filled up. Choose another delivery date; your box is saved."
        : "Checkout changed. Please review your delivery details again.",
      409,
    );
  const attempt = await context.db
    .from("payment_attempts")
    .select("*")
    .eq("id", result.data)
    .single();
  if (attempt.error)
    throw new DeliveryError(
      "payment_unavailable",
      "We could not load payment. Please retry; your reservation is saved.",
      503,
    );
  return attempt.data;
}
