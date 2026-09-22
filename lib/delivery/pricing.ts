import { DeliveryError } from "@/lib/delivery/errors";
import {
  deliveryPricingSchema,
  type DeliveryPricing,
} from "@/lib/delivery/schema";

// Some Toronto addresses are labelled with the former municipality by Google.
export function deliveryCity(locality: string): string | null {
  const cities: Record<string, string> = {
    toronto: "Toronto",
    scarborough: "Toronto",
    "north york": "Toronto",
    etobicoke: "Toronto",
    "east york": "Toronto",
    york: "Toronto",
    markham: "Markham",
    mississauga: "Mississauga",
  };
  return cities[locality.trim().toLowerCase()] ?? null;
}

export function calculateDeliveryFee(
  distanceMeters: number,
  subtotalCents: number,
  configuration: DeliveryPricing,
) {
  const pricing = deliveryPricingSchema.parse({
    base_distance_meters: configuration.base_distance_meters,
    base_fee_cents: configuration.base_fee_cents,
    extra_km_fee_cents: configuration.extra_km_fee_cents,
    maximum_distance_meters: configuration.maximum_distance_meters,
    free_delivery_threshold_cents: configuration.free_delivery_threshold_cents,
  });
  if (
    !Number.isSafeInteger(distanceMeters) ||
    distanceMeters < 0 ||
    !Number.isSafeInteger(subtotalCents) ||
    subtotalCents < 0
  ) {
    throw new DeliveryError(
      "invalid_quote",
      "We could not calculate delivery. Please try again.",
      503,
    );
  }
  // Eligibility always precedes free delivery. Compare unrounded metres.
  if (distanceMeters > pricing.maximum_distance_meters) {
    throw new DeliveryError(
      "outside_distance",
      "This address is beyond our delivery distance. Please try another address.",
      422,
    );
  }
  const freeDelivery = subtotalCents >= pricing.free_delivery_threshold_cents;
  const extraMeters = Math.max(
    0,
    distanceMeters - pricing.base_distance_meters,
  );
  // Integer numerator gives deterministic half-up CAD rounding at fractional km.
  const feeCents = freeDelivery
    ? 0
    : pricing.base_fee_cents +
      Math.floor((extraMeters * pricing.extra_km_fee_cents + 500) / 1000);
  return { feeCents, freeDelivery };
}
