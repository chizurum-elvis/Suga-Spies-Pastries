import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { serializeCart } from "@/lib/cart/schema";
import type { RawCart, ValidatedCart } from "@/lib/cart/types";
import { getServerEnvironment } from "@/lib/env/server";
import { DeliveryError } from "@/lib/delivery/errors";
import {
  formatLocalDateLabel,
  localDateStartInstant,
} from "@/lib/fulfillment/rules";
import type {
  CheckoutDraftSummary,
  FulfillmentMethod,
} from "@/lib/fulfillment/types";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";

export const CHECKOUT_DRAFT_COOKIE = "suga-spies-checkout";
const DRAFT_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

export function pricingFingerprint(cart: ValidatedCart) {
  return sha256(
    JSON.stringify({
      currency: cart.currency,
      subtotalCents: cart.subtotalCents,
      lines: cart.lines.map((line) => ({
        lineId: line.lineId,
        pricingFingerprint: line.pricingFingerprint,
        lineSubtotalCents: line.lineSubtotalCents,
      })),
    }),
  );
}

function summary(row: {
  fulfillment_method: FulfillmentMethod;
  fulfillment_date: string;
  status: string;
  expires_at: string;
}): CheckoutDraftSummary | null {
  if (row.status !== "ready_for_details") return null;
  return {
    method: row.fulfillment_method,
    date: row.fulfillment_date,
    dateLabel: formatLocalDateLabel(row.fulfillment_date),
    status: "ready_for_details",
    expiresAt: row.expires_at,
  };
}

export function checkoutDraftCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getServerEnvironment().APP_ENV !== "local",
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export async function getCheckoutDraft(rawToken: string | undefined) {
  if (!rawToken || !TOKEN_PATTERN.test(rawToken)) return null;
  const supabase = createSecretSupabaseClient();
  const result = await supabase
    .from("checkout_drafts")
    .select("fulfillment_method, fulfillment_date, status, expires_at")
    .eq("access_token_hash", sha256(rawToken))
    .eq("fulfillment_method", "delivery")
    .gt("expires_at", new Date().toISOString())
    .neq("status", "expired")
    .maybeSingle();
  if (result.error || !result.data) return null;
  return summary(result.data);
}

export async function saveCheckoutDraft(input: {
  rawToken?: string;
  cart: RawCart;
  validatedCart: ValidatedCart;
  method: FulfillmentMethod;
  date: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const deliveryDateStart = localDateStartInstant(input.date);
  const expiration = new Date(
    Math.min(
      now.getTime() + DRAFT_LIFETIME_MILLISECONDS,
      deliveryDateStart.getTime(),
    ),
  );
  let rawToken =
    input.rawToken && TOKEN_PATTERN.test(input.rawToken)
      ? input.rawToken
      : newToken();
  const tokenHash = sha256(rawToken);
  const cartSerialized = serializeCart(input.cart);
  const jsonSchema = z.json();
  const values = {
    access_token_hash: tokenHash,
    cart_payload: jsonSchema.parse(JSON.parse(cartSerialized) as unknown),
    cart_fingerprint: sha256(cartSerialized),
    cart_validation_snapshot: jsonSchema.parse(input.validatedCart),
    pricing_fingerprint: pricingFingerprint(input.validatedCart),
    fulfillment_method: input.method,
    fulfillment_date: input.date,
    status: "ready_for_details" as const,
    schema_version: 1,
    expires_at: expiration.toISOString(),
  };
  const supabase = createSecretSupabaseClient();
  const existing = await supabase
    .from("checkout_drafts")
    .select("id")
    .eq("access_token_hash", tokenHash)
    .eq("fulfillment_method", "delivery")
    .gt("expires_at", now.toISOString())
    .neq("status", "expired")
    .maybeSingle();
  if (existing.error)
    throw new Error("The checkout draft could not be verified.");

  let existingId = existing.data?.id;
  if (existingId) {
    const payment = await supabase
      .from("payment_attempts")
      .select("status")
      .eq("checkout_draft_id", existingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payment.error) throw new Error("Payment status could not be verified.");
    if (payment.data?.status === "paid") existingId = undefined;
    else if (
      payment.data &&
      !["expired", "refunded"].includes(payment.data.status)
    )
      throw new DeliveryError(
        "payment_in_progress",
        "Your payment is still open. Return to Review & pay to finish it or stop the payment before changing delivery.",
        409,
      );
  }
  // Completed orders keep their original immutable draft; a new purchase gets a new token.
  if (!existingId) {
    rawToken = newToken();
    values.access_token_hash = sha256(rawToken);
  }

  const result = existingId
    ? await supabase
        .from("checkout_drafts")
        .update(values)
        .eq("id", existingId)
        .select("fulfillment_method, fulfillment_date, status, expires_at")
        .single()
    : await supabase
        .from("checkout_drafts")
        .insert(values)
        .select("fulfillment_method, fulfillment_date, status, expires_at")
        .single();
  if (result.error || !result.data) {
    throw new Error("The checkout draft could not be saved.");
  }
  const draft = summary(result.data);
  if (!draft) throw new Error("The checkout draft returned an invalid state.");
  return {
    rawToken,
    maxAge: Math.max(
      1,
      Math.floor((expiration.getTime() - now.getTime()) / 1_000),
    ),
    draft,
  };
}
