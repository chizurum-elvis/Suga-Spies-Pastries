import "server-only";
import { getServerEnvironment } from "@/lib/env/server";
import { DeliveryError } from "@/lib/delivery/errors";
import { createGoogleMapsProvider } from "@/lib/delivery/google-maps";
import { deliveryCity } from "@/lib/delivery/pricing";
import {
  deliveryAddressSchema,
  type DeliveryAddress,
} from "@/lib/delivery/schema";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { stripeClient } from "@/lib/payments/stripe";
import type { RedeliveryRow } from "@/lib/payments/database";
import type Stripe from "stripe";

export function redeliveryError(error: { message?: string }) {
  const message = error.message ?? "";
  if (message.includes("redelivery_conflict"))
    return new DeliveryError(
      "redelivery_conflict",
      "This order changed in another tab. Refresh and retry.",
      409,
    );
  if (message.includes("redelivery_deadline"))
    return new DeliveryError(
      "redelivery_deadline",
      "The 24-hour response window has ended. Contact support about your refund.",
      409,
    );
  if (
    message.includes("redelivery_date_full") ||
    message.includes(
      "The fulfillment date has reached its four-order capacity.",
    )
  )
    return new DeliveryError(
      "redelivery_date_full",
      "That date has filled up. The owner can select another available date.",
      409,
    );
  if (message.includes("redelivery_date_"))
    return new DeliveryError(
      "redelivery_date_invalid",
      "Choose another open delivery date, starting tomorrow.",
      409,
    );
  if (message.includes("redelivery_payment_expired"))
    return new DeliveryError(
      "redelivery_payment_expired",
      "The payment reservation ended. Ask the owner to select another date.",
      409,
    );
  if (
    message.includes("redelivery_transition_invalid") ||
    message.includes("redelivery_discard_not_allowed")
  )
    return new DeliveryError(
      "redelivery_invalid",
      "That delivery action is no longer available. Refresh the order.",
      409,
    );
  return new DeliveryError(
    "redelivery_unavailable",
    "We could not update this delivery. Please retry.",
    503,
  );
}

export async function requestRedelivery(
  orderId: string,
  expectedVersion: number,
  address: DeliveryAddress,
) {
  const db = createSecretSupabaseClient();
  const allowed = await db.rpc("allow_redelivery_provider_request", {
    p_order_id: orderId,
  });
  if (allowed.error) throw redeliveryError(allowed.error);
  if (!allowed.data)
    throw new DeliveryError(
      "redelivery_rate_limited",
      "Address checks are busy. Please wait before retrying.",
      429,
    );
  const settings = await db
    .from("delivery_settings")
    .select("origin_address,allowed_cities,maximum_distance_meters")
    .eq("singleton", true)
    .single();
  if (settings.error)
    throw new DeliveryError(
      "redelivery_unavailable",
      "Delivery settings are unavailable. Please retry.",
      503,
    );
  const provider = createGoogleMapsProvider(
    getServerEnvironment().GOOGLE_MAPS_SERVER_API_KEY,
  );
  const validated = await provider.validate(
    deliveryAddressSchema.parse(address),
  );
  if (validated.requiresConfirmation)
    throw new DeliveryError(
      "address_confirmation_required",
      "Google suggested a different address. Please check your street, unit, city, and postal code, then retry.",
      422,
    );
  const city = deliveryCity(validated.address.city);
  if (!city || !settings.data.allowed_cities.includes(city))
    throw new DeliveryError(
      "outside_area",
      "Redelivery is available only in Toronto, Markham, and Mississauga.",
      422,
    );
  const normalized = { ...validated.address, city };
  const metres = await provider.distance(
    settings.data.origin_address,
    validated.placeId,
  );
  if (metres > settings.data.maximum_distance_meters)
    throw new DeliveryError(
      "outside_distance",
      "This address is beyond our delivery area. Please try another address.",
      422,
    );
  const response = await db.rpc("request_redelivery", {
    p_order_id: orderId,
    p_expected_version: expectedVersion,
    p_address: normalized,
    p_distance_meters: metres,
  });
  if (response.error) throw redeliveryError(response.error);
}

export function redeliverySessionParams(
  row: RedeliveryRow,
  email: string,
  orderNumber: string,
): Stripe.Checkout.SessionCreateParams {
  const site =
    getServerEnvironment().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const returnUrl = `${site}/orders/${row.order_id}`;
  return {
    mode: "payment",
    ui_mode: "hosted",
    payment_method_types: ["card"],
    wallet_options: { link: { display: "never" } },
    automatic_tax: { enabled: false },
    customer_email: email,
    client_reference_id: row.order_id,
    metadata: {
      redelivery_order_id: row.order_id,
      capacity_adjustment_id: row.capacity_adjustment_id!,
    },
    payment_intent_data: { metadata: { redelivery_order_id: row.order_id } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: row.fee_cents!,
          product_data: { name: `Redelivery for ${orderNumber}` },
        },
      },
    ],
    success_url: returnUrl,
    cancel_url: returnUrl,
  };
}

export async function ensureRedeliverySession(row: RedeliveryRow) {
  const stripe = stripeClient();
  if (row.stripe_session_id)
    return stripe.checkout.sessions.retrieve(row.stripe_session_id);
  if (
    !row.capacity_adjustment_id ||
    !row.payment_expires_at ||
    Date.now() >= Date.parse(row.payment_expires_at)
  )
    throw new DeliveryError(
      "redelivery_payment_expired",
      "The redelivery payment reservation ended. Please refresh.",
      409,
    );
  const db = createSecretSupabaseClient();
  const order = await db
    .from("orders")
    .select("order_number,snapshot,test_only")
    .eq("id", row.order_id)
    .single();
  if (order.error)
    throw new DeliveryError(
      "redelivery_unavailable",
      "Order details are unavailable.",
      503,
    );
  const snapshot = order.data.snapshot;
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    !snapshot.delivery ||
    typeof snapshot.delivery !== "object" ||
    Array.isArray(snapshot.delivery) ||
    typeof snapshot.delivery.email !== "string"
  )
    throw new DeliveryError(
      "redelivery_unavailable",
      "Order details are unavailable.",
      503,
    );
  const session = await stripe.checkout.sessions.create(
    redeliverySessionParams(
      row,
      snapshot.delivery.email,
      order.data.order_number,
    ),
    {
      idempotencyKey: `redelivery:${row.order_id}:${row.capacity_adjustment_id}`,
    },
  );
  if (session.livemode === order.data.test_only)
    throw new Error("Redelivery payment environment mismatch.");
  const saved = await db.rpc("save_redelivery_session", {
    p_order_id: row.order_id,
    p_session_id: session.id,
  });
  if (saved.error) throw redeliveryError(saved.error);
  return session;
}

export async function beginRedeliveryPayment(orderId: string, version: number) {
  // Do not reserve a scarce date when payment cannot be reconciled promptly.
  const key = getServerEnvironment().STRIPE_SECRET_KEY;
  if (!key) {
    throw new DeliveryError(
      "redelivery_payment_unavailable",
      "Secure payment is temporarily unavailable. Please retry shortly.",
      503,
    );
  }
  try {
    stripeClient();
  } catch {
    throw new DeliveryError(
      "redelivery_payment_unavailable",
      "Secure payment is temporarily unavailable. Please retry shortly.",
      503,
    );
  }
  const db = createSecretSupabaseClient();
  const worker = await db
    .from("payment_worker_health")
    .select("checked_at")
    .eq("mode", /^(sk|rk)_test_/.test(key) ? "test" : "live")
    .maybeSingle();
  if (
    worker.error ||
    !worker.data ||
    Date.parse(worker.data.checked_at) <= Date.now() - 180_000
  ) {
    throw new DeliveryError(
      "redelivery_payment_unavailable",
      "Payment confirmation is temporarily unavailable. Please retry shortly.",
      503,
    );
  }
  const result = await db.rpc("begin_redelivery_payment", {
    p_order_id: orderId,
    p_expected_version: version,
  });
  if (result.error) throw redeliveryError(result.error);
  const session = await ensureRedeliverySession(result.data);
  if (session.status !== "open" || !session.url)
    throw new DeliveryError(
      "redelivery_payment_expired",
      "This payment link is no longer open. Refresh your order.",
      409,
    );
  return session.url;
}

export async function reconcileRedeliveryPayment(row: RedeliveryRow) {
  if (
    row.state !== "awaiting_payment" ||
    row.payment_status !== "pending" ||
    !row.stripe_session_id
  )
    return;
  const stripe = stripeClient();
  let session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
  if (
    session.id !== row.stripe_session_id ||
    session.client_reference_id !== row.order_id ||
    session.metadata?.redelivery_order_id !== row.order_id ||
    session.metadata?.capacity_adjustment_id !== row.capacity_adjustment_id ||
    session.amount_total !== row.fee_cents
  )
    throw new Error("Redelivery session identity mismatch.");
  const order = await createSecretSupabaseClient()
    .from("orders")
    .select("test_only")
    .eq("id", row.order_id)
    .single();
  if (order.error || session.livemode === order.data.test_only)
    throw new Error("Redelivery environment mismatch.");
  if (
    session.status === "open" &&
    Date.now() >= Date.parse(row.payment_expires_at!)
  ) {
    try {
      session = await stripe.checkout.sessions.expire(session.id);
    } catch {
      session = await stripe.checkout.sessions.retrieve(session.id);
    }
  }
  const paymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  let intent: Stripe.PaymentIntent | null = null;
  if (paymentId)
    intent = await stripe.paymentIntents.retrieve(paymentId, {
      expand: ["latest_charge"],
    });
  if (intent?.status === "succeeded") {
    const charge =
      typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const wallet = charge?.payment_method_details?.card?.wallet;
    if (
      session.payment_status !== "paid" ||
      intent.amount_received !== row.fee_cents ||
      intent.currency !== "cad" ||
      intent.livemode === order.data.test_only ||
      intent.metadata.redelivery_order_id !== row.order_id ||
      !charge ||
      charge.disputed ||
      charge.payment_method_details?.type !== "card" ||
      (wallet && !["apple_pay", "google_pay"].includes(wallet.type))
    ) {
      throw new Error("Redelivery payment requires owner review.");
    }
    const paidAt = new Date(charge.created * 1000).toISOString();
    const saved = await createSecretSupabaseClient().rpc(
      "resolve_redelivery_payment",
      {
        p_order_id: row.order_id,
        p_action:
          charge.created * 1000 < Date.parse(row.payment_expires_at!)
            ? "paid"
            : "late_paid",
        p_session_id: session.id,
        p_payment_id: intent.id,
        p_paid_at: paidAt,
      },
    );
    if (saved.error) throw redeliveryError(saved.error);
    return;
  }
  if (
    session.status === "expired" &&
    (!intent || ["canceled", "requires_payment_method"].includes(intent.status))
  ) {
    const saved = await createSecretSupabaseClient().rpc(
      "resolve_redelivery_payment",
      {
        p_order_id: row.order_id,
        p_action: "expired",
        p_session_id: session.id,
      },
    );
    if (saved.error) throw redeliveryError(saved.error);
  }
}
