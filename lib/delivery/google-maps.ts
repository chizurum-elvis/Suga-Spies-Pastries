import "server-only";
import { z } from "zod";
import { DeliveryError } from "@/lib/delivery/errors";
import {
  deliveryAddressSchema,
  type DeliveryAddress,
} from "@/lib/delivery/schema";

const googleResponseSchema = z.object({
  result: z.object({
    verdict: z.object({
      addressComplete: z.boolean().optional(),
      validationGranularity: z.string(),
      possibleNextAction: z.string().optional(),
      hasUnconfirmedComponents: z.boolean().optional(),
      hasInferredComponents: z.boolean().optional(),
      hasReplacedComponents: z.boolean().optional(),
      hasSpellCorrectedComponents: z.boolean().optional(),
    }),
    address: z.object({
      postalAddress: z.object({
        regionCode: z.string(),
        administrativeArea: z.string(),
        locality: z.string(),
        postalCode: z.string(),
        addressLines: z.array(z.string()).min(1).max(3),
      }),
      missingComponentTypes: z.array(z.string()).optional(),
      unresolvedTokens: z.array(z.string()).optional(),
      addressComponents: z
        .array(
          z.object({
            componentType: z.string(),
            confirmationLevel: z.string().optional(),
          }),
        )
        .optional(),
    }),
    geocode: z.object({ placeId: z.string().min(1).max(300) }),
  }),
});

export interface AddressRoutingProvider {
  validate(address: DeliveryAddress): Promise<{
    address: DeliveryAddress;
    placeId: string;
    requiresConfirmation: boolean;
  }>;
  distance(origin: string, destinationPlaceId: string): Promise<number>;
}

export function createGoogleMapsProvider(
  apiKey: string | undefined,
  transport: typeof fetch = fetch,
): AddressRoutingProvider {
  async function request(
    url: string,
    body: unknown,
    fieldMask?: string,
  ): Promise<unknown> {
    if (!apiKey)
      throw new DeliveryError(
        "provider_not_configured",
        "Address checks are temporarily unavailable. Your details are saved; please try again later.",
        503,
      );
    try {
      const response = await transport(url, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
        },
        body: JSON.stringify(body),
      });
      // Never forward Google errors: they can include keys, input, or the private origin.
      if (!response.ok) throw new Error("provider_request_failed");
      return await response.json();
    } catch {
      throw new DeliveryError(
        "provider_unavailable",
        "We could not check this address just now. Your details are saved. Please retry.",
        503,
      );
    }
  }
  return {
    async validate(input) {
      const raw = await request(
        "https://addressvalidation.googleapis.com/v1:validateAddress",
        {
          address: {
            regionCode: "CA",
            administrativeArea: "ON",
            locality: input.city,
            postalCode: input.postalCode,
            addressLines: [input.line1, input.line2].filter(Boolean),
          },
        },
      );
      const parsed = googleResponseSchema.safeParse(raw);
      if (!parsed.success)
        throw new DeliveryError(
          "address_unverified",
          "We could not verify the full address. Check the street number, city, and postal code.",
          422,
        );
      const { verdict, address, geocode } = parsed.data.result;
      const proximityWithConfirmedAddress =
        verdict.validationGranularity === "PREMISE_PROXIMITY" &&
        verdict.possibleNextAction === "ACCEPT" &&
        !verdict.hasUnconfirmedComponents &&
        ["street_number", "route", "postal_code"].every((type) =>
          address.addressComponents?.some(
            (component) =>
              component.componentType === type &&
              component.confirmationLevel === "CONFIRMED",
          ),
        );
      if (
        !verdict.addressComplete ||
        (!proximityWithConfirmedAddress &&
          !["PREMISE", "SUB_PREMISE"].includes(
            verdict.validationGranularity,
          )) ||
        verdict.possibleNextAction === "FIX" ||
        address.missingComponentTypes?.length ||
        address.unresolvedTokens?.length ||
        address.addressComponents?.some(
          (component) =>
            component.confirmationLevel === "UNCONFIRMED_AND_SUSPICIOUS",
        )
      ) {
        throw new DeliveryError(
          "address_needs_fix",
          "Please check your street number, street name, postal code, and apartment or unit number.",
          422,
        );
      }
      const postal = address.postalAddress;
      const normalized = deliveryAddressSchema.safeParse({
        line1: postal.addressLines[0],
        // SUB_PREMISE can put the verified unit into line 1. Do not duplicate it.
        // Otherwise retain a customer-supplied unit when Google verifies the building only.
        line2:
          postal.addressLines.slice(1).join(", ") ||
          (["PREMISE", "PREMISE_PROXIMITY"].includes(
            verdict.validationGranularity,
          )
            ? input.line2
            : ""),
        city: postal.locality,
        province: postal.administrativeArea,
        postalCode: postal.postalCode,
        country: postal.regionCode,
      });
      if (!normalized.success)
        throw new DeliveryError(
          "outside_area",
          "We currently deliver only to eligible addresses in Toronto, Markham, and Mississauga, Ontario.",
          422,
        );
      return {
        address: normalized.data,
        placeId: geocode.placeId,
        requiresConfirmation:
          proximityWithConfirmedAddress ||
          Boolean(
            verdict.hasUnconfirmedComponents ||
            verdict.hasInferredComponents ||
            verdict.hasReplacedComponents ||
            verdict.hasSpellCorrectedComponents,
          ) ||
          (
            [
              "line1",
              "line2",
              "city",
              "province",
              "postalCode",
              "country",
            ] as const
          ).some((field) => normalized.data[field] !== input[field]),
      };
    },
    async distance(origin, destinationPlaceId) {
      const raw = await request(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          origin: { address: origin },
          destination: { placeId: destinationPlaceId },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
          computeAlternativeRoutes: false,
          units: "METRIC",
        },
        "routes.distanceMeters",
      );
      const parsed = z
        .object({
          routes: z
            .array(
              z.object({
                distanceMeters: z.number().int().nonnegative().max(10000000),
              }),
            )
            .min(1),
        })
        .safeParse(raw);
      if (!parsed.success)
        throw new DeliveryError(
          "route_unavailable",
          "We could not find a driving route to this address. Please check it or try again.",
          422,
        );
      return parsed.data.routes[0]!.distanceMeters;
    },
  };
}
