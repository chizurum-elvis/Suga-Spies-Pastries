import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rawCartSchema, serializeCart } from "@/lib/cart/schema";
import { validateCartAgainstCatalogue } from "@/lib/cart/server-validation";
import type { RawCart } from "@/lib/cart/types";
import { getServerEnvironment } from "@/lib/env/server";
import { pricingFingerprint, sha256 } from "@/lib/fulfillment/checkout-draft";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import { validateFulfillmentSelection } from "@/lib/fulfillment/server-data";
import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { DeliveryError } from "@/lib/delivery/errors";
import { createGoogleMapsProvider } from "@/lib/delivery/google-maps";
import { calculateDeliveryFee, deliveryCity } from "@/lib/delivery/pricing";
import {
  deliveryInputSchema,
  deliveryQuoteSchema,
  publicQuoteSchema,
  storedDeliveryInputSchema,
  type DeliveryInput,
  type DeliveryState,
} from "@/lib/delivery/schema";

export async function deliveryContext(token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token))
    throw new DeliveryError(
      "draft_expired",
      "Choose your delivery date again to continue.",
      401,
    );
  const db = createSecretSupabaseClient();
  const { data: draft, error } = await db
    .from("checkout_drafts")
    .select("*")
    .eq("access_token_hash", sha256(token))
    .eq("fulfillment_method", "delivery")
    .eq("status", "ready_for_details")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error)
    throw new DeliveryError(
      "details_unavailable",
      "We could not load your delivery details. Please retry.",
      503,
    );
  if (!draft)
    throw new DeliveryError(
      "draft_expired",
      "Choose your delivery date again to continue.",
      401,
    );
  const [detailsResult, settingsResult] = await Promise.all([
    db
      .from("checkout_delivery_details")
      .select("*")
      .eq("checkout_draft_id", draft.id)
      .maybeSingle(),
    db.from("delivery_settings").select("*").eq("singleton", true).single(),
  ]);
  if (detailsResult.error || settingsResult.error || !settingsResult.data)
    throw new DeliveryError(
      "details_unavailable",
      "Delivery details are temporarily unavailable. Please retry.",
      503,
    );
  return {
    db,
    draft,
    details: detailsResult.data,
    settings: settingsResult.data,
  };
}
type Context = Awaited<ReturnType<typeof deliveryContext>>;

function publicState(context: Context): DeliveryState {
  const { draft, details, settings } = context;
  const input = details ? storedDeliveryInputSchema.parse(details.input) : null;
  const parsedQuote = deliveryQuoteSchema.safeParse(details?.quote);
  const quote = parsedQuote.success ? parsedQuote.data : null;
  const stale = Boolean(
    quote &&
    (new Date(quote.expiresAt).getTime() <= Date.now() ||
      quote.settingsVersion !== settings.version ||
      quote.cartFingerprint !== draft.cart_fingerprint ||
      quote.pricingFingerprint !== draft.pricing_fingerprint),
  );
  return {
    cart: rawCartSchema.parse(draft.cart_payload),
    draftVersion: draft.version,
    version: details?.version ?? 0,
    input,
    status: stale ? "stale" : (details?.status ?? "unverified"),
    quote:
      quote && !stale
        ? publicQuoteSchema.parse({
            id: quote.id,
            address: quote.address,
            requiresConfirmation: quote.requiresConfirmation,
            settingsVersion: quote.settingsVersion,
            subtotalCents: quote.subtotalCents,
            feeCents: quote.feeCents,
            freeDelivery: quote.freeDelivery,
            expiresAt: quote.expiresAt,
          })
        : null,
    dateLabel: formatLocalDateLabel(draft.fulfillment_date),
  };
}

export async function getDeliveryState(token: string | undefined) {
  const context = await deliveryContext(token);
  const state = publicState(context);
  // A stored quote alone is insufficient after a catalogue change.
  if (state.quote) {
    const validated = await validateCartAgainstCatalogue(
      rawCartSchema.parse(context.draft.cart_payload),
    );
    if (
      validated.status !== "ready" ||
      pricingFingerprint(validated) !== context.draft.pricing_fingerprint
    ) {
      state.quote = null;
      state.status = "stale";
    }
  }
  return state;
}

async function validateContext(
  context: Context,
  cart: RawCart,
  draftVersion: number,
  version: number,
) {
  if (
    context.draft.version !== draftVersion ||
    (context.details?.version ?? 0) !== version
  )
    throw new DeliveryError(
      "details_conflict",
      "These details changed in another tab. Reload the saved details before continuing.",
      409,
    );
  if (sha256(serializeCart(cart)) !== context.draft.cart_fingerprint)
    throw new DeliveryError(
      "cart_changed",
      "Your pastry box changed. Review your cart and save your delivery date again.",
      409,
    );
  const validated = await validateCartAgainstCatalogue(cart);
  if (
    validated.status !== "ready" ||
    validated.subtotalCents === null ||
    pricingFingerprint(validated) !== context.draft.pricing_fingerprint
  )
    throw new DeliveryError(
      "cart_changed",
      "Your pastry box or its prices changed. Review your cart before continuing.",
      409,
    );
  const { issue } = await validateFulfillmentSelection({
    method: "delivery",
    date: context.draft.fulfillment_date,
  });
  if (issue)
    throw new DeliveryError(
      "schedule_changed",
      "That delivery date is no longer available. Choose another date; your address will be kept.",
      409,
    );
  return validated.subtotalCents;
}

async function mutate(
  context: Context,
  version: number,
  action: string,
  payload: unknown = {},
) {
  const { error } = await context.db.rpc("mutate_delivery_details", {
    p_draft_id: context.draft.id,
    p_draft_version: context.draft.version,
    p_details_version: version,
    p_action: action,
    p_payload: z.json().parse(payload),
  });
  if (error) {
    if (error.message.includes("delivery_schedule_changed"))
      throw new DeliveryError(
        "schedule_changed",
        "That delivery date is no longer available. Choose another date; your saved address will be kept.",
        409,
      );
    if (error.message.includes("delivery_draft_expired"))
      throw new DeliveryError(
        "draft_expired",
        "Choose your delivery date again to continue.",
        401,
      );
    if (error.message.includes("delivery_conflict"))
      throw new DeliveryError(
        "details_conflict",
        "These details changed in another tab. Reload the saved details before continuing.",
        409,
      );
    if (error.message.includes("delivery_quote_stale"))
      throw new DeliveryError(
        "quote_stale",
        "Delivery pricing changed or this quote expired. Check delivery again.",
        409,
      );
    throw new DeliveryError(
      "details_unavailable",
      "We could not save these details. Please retry.",
      503,
    );
  }
}

export async function saveDeliveryDetails(
  token: string | undefined,
  input: DeliveryInput,
  cart: RawCart,
  draftVersion: number,
  version: number,
) {
  const context = await deliveryContext(token);
  await validateContext(context, cart, draftVersion, version);
  await mutate(context, version, "save", input);
  return getDeliveryState(token);
}

export async function quoteDelivery(
  token: string | undefined,
  cart: RawCart,
  draftVersion: number,
  version: number,
) {
  const context = await deliveryContext(token);
  const subtotalCents = await validateContext(
    context,
    cart,
    draftVersion,
    version,
  );
  if (!context.details)
    throw new DeliveryError(
      "details_required",
      "Enter your delivery address first.",
    );
  const { data: allowed, error } = await context.db.rpc(
    "allow_delivery_provider_request",
    { p_draft_id: context.draft.id },
  );
  if (error)
    throw new DeliveryError(
      "provider_unavailable",
      "We could not check delivery just now. Please retry.",
      503,
    );
  if (!allowed)
    throw new DeliveryError(
      "rate_limited",
      "Address checks are busy. Please wait a minute before trying again.",
      429,
    );
  const input = deliveryInputSchema.parse(context.details.input);
  const provider = createGoogleMapsProvider(
    getServerEnvironment().GOOGLE_MAPS_SERVER_API_KEY,
  );
  const validated = await provider.validate(input.address);
  const city = deliveryCity(validated.address.city);
  if (!city || !context.settings.allowed_cities.includes(city))
    throw new DeliveryError(
      "outside_area",
      "We currently deliver only to eligible addresses in Toronto, Markham, and Mississauga.",
      422,
    );
  const distanceMeters = await provider.distance(
    context.settings.origin_address,
    validated.placeId,
  );
  const pricing = calculateDeliveryFee(
    distanceMeters,
    subtotalCents,
    context.settings,
  );
  const quote = deliveryQuoteSchema.parse({
    id: randomUUID(),
    address: validated.address,
    requiresConfirmation: validated.requiresConfirmation,
    ...pricing,
    subtotalCents,
    settingsVersion: context.settings.version,
    cartFingerprint: context.draft.cart_fingerprint,
    pricingFingerprint: context.draft.pricing_fingerprint,
    expiresAt: new Date(
      Math.min(
        Date.now() + context.settings.quote_minutes * 60000,
        new Date(context.draft.expires_at).getTime(),
      ),
    ).toISOString(),
  });
  await mutate(context, version, "quote", quote);
  return getDeliveryState(token);
}

export async function confirmDelivery(
  token: string | undefined,
  cart: RawCart,
  draftVersion: number,
  version: number,
) {
  const context = await deliveryContext(token);
  await validateContext(context, cart, draftVersion, version);
  await mutate(context, version, "confirm");
  return getDeliveryState(token);
}
