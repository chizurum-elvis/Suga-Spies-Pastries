import { describe, expect, it } from "vitest";
import { calculateDeliveryFee, deliveryCity } from "./pricing";
import {
  deliveryInputSchema,
  deliveryOperationSchema,
  deliveryPricingSchema,
  phoneSchema,
  postalCodeSchema,
  saveDetailsSchema,
  storedDeliveryInputSchema,
} from "./schema";
import { findPublicSecretNames } from "@/lib/env/schema";

const rates = {
  base_distance_meters: 3000,
  base_fee_cents: 500,
  extra_km_fee_cents: 150,
  maximum_distance_meters: 30000,
  free_delivery_threshold_cents: 10000,
};
export const deliveryInput = {
  name: "Test Customer",
  email: "test@example.com",
  phone: "4373327263",
  recipientName: "Test Recipient",
  instructions: "Buzzer 10",
  address: {
    line1: "123 Test Street",
    line2: "Unit 4",
    city: "Toronto",
    province: "ON",
    country: "CA",
    postalCode: "M5V 3L9",
  },
};

describe("delivery pricing: integer CAD arithmetic and service boundaries", () => {
  it.each([
    [0, 500],
    [1, 500],
    [2999, 500],
    [3000, 500],
    [3001, 500],
    [3010, 502],
    [3500, 575],
    [4000, 650],
    [29999, 4550],
    [30000, 4550],
  ])("prices %i metres at %i cents", (distance, expected) => {
    expect(calculateDeliveryFee(distance, 9999, rates)).toEqual({
      feeCents: expected,
      freeDelivery: false,
    });
  });
  it("applies free delivery at exactly $100, but never outside the distance limit", () => {
    expect(calculateDeliveryFee(30000, 10000, rates)).toEqual({
      feeCents: 0,
      freeDelivery: true,
    });
    expect(() => calculateDeliveryFee(30001, 10000, rates)).toThrow();
    expect(() => calculateDeliveryFee(30001, 1, rates)).toThrow();
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid distance/subtotal %s",
    (invalid) => {
      expect(() => calculateDeliveryFee(invalid, 5000, rates)).toThrow();
      expect(() => calculateDeliveryFee(4000, invalid, rates)).toThrow();
    },
  );
  it("uses edited rates rather than client-side constants", () => {
    expect(
      calculateDeliveryFee(4000, 11000, {
        ...rates,
        base_fee_cents: 700,
        extra_km_fee_cents: 200,
        free_delivery_threshold_cents: 12000,
      }),
    ).toEqual({ feeCents: 900, freeDelivery: false });
    expect(
      deliveryPricingSchema.safeParse({
        ...rates,
        maximum_distance_meters: 30001,
      }).success,
    ).toBe(false);
    expect(
      deliveryPricingSchema.safeParse({
        ...rates,
        maximum_distance_meters: 1000,
      }).success,
    ).toBe(false);
  });
  it.each([
    "Toronto",
    "toronto",
    "Scarborough",
    "North York",
    "Etobicoke",
    "East York",
    "York",
    "Markham",
    "Mississauga",
  ])("recognises verified locality %s", (city) => {
    expect(deliveryCity(city)).not.toBeNull();
  });
  it.each([
    "Brampton",
    "Vaughan",
    "Richmond Hill",
    "Torontoish",
    "GTA",
    "Toronto, Ontario",
  ])("does not use fuzzy city matching for %s", (city) => {
    expect(deliveryCity(city)).toBeNull();
  });
});

describe("delivery inputs", () => {
  it("normalises Canadian contact/address input", () => {
    expect(postalCodeSchema.parse(" m5v3l9 ")).toBe("M5V 3L9");
    expect(phoneSchema.parse("+1 (437) 332-7263")).toBe("+14373327263");
    expect(phoneSchema.parse("416 555 0100")).toBe("+14165550100");
    expect(
      deliveryInputSchema.parse({
        ...deliveryInput,
        email: " test@example.com ",
      }).email,
    ).toBe("test@example.com");
  });
  it.each([
    ["United States", "+1 213 373 4253"],
    ["United Kingdom", "+44 20 7183 8750"],
    ["Nigeria", "+234 705 903 1826"],
    ["Jamaica", "+1 876 555 0100"],
    ["invalid Canadian", "416 123 4567"],
  ])("rejects a %s contact number", (_label, phone) => {
    const result = phoneSchema.safeParse(phone);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("Canadian");
  });
  it("keeps a legacy draft editable when its saved phone is no longer accepted", () => {
    const legacy = {
      ...deliveryInput,
      phone: "+44 20 7183 8750",
    };
    expect(storedDeliveryInputSchema.parse(legacy).phone).toBe(
      "+44 20 7183 8750",
    );
    expect(deliveryInputSchema.safeParse(legacy).success).toBe(false);
  });
  it.each(["D1A1A1", "M5V3L", "M5V3L99", "12345", "M5V-3L9"])(
    "rejects malformed postal code %s",
    (code) => {
      expect(postalCodeSchema.safeParse(code).success).toBe(false);
    },
  );
  it("rejects control characters, extra fields and oversized delivery notes", () => {
    for (const input of [
      { ...deliveryInput, name: "Name\u0000" },
      { ...deliveryInput, instructions: "x".repeat(501) },
      { ...deliveryInput, feeCents: 0 },
      { ...deliveryInput, address: { ...deliveryInput.address, latitude: 0 } },
      {
        ...deliveryInput,
        address: { ...deliveryInput.address, country: "US" },
      },
      {
        ...deliveryInput,
        address: { ...deliveryInput.address, province: "BC" },
      },
    ])
      expect(deliveryInputSchema.safeParse(input).success).toBe(false);
  });
  it("does not accept prices, distances, draft IDs, or quote IDs from the browser", () => {
    const operation = {
      cart: { version: 1, lines: [] },
      version: 1,
      draftVersion: 1,
    };
    for (const key of [
      "feeCents",
      "distanceMeters",
      "subtotalCents",
      "draftId",
      "quoteId",
    ])
      expect(
        deliveryOperationSchema.safeParse({ ...operation, [key]: 0 }).success,
      ).toBe(false);
    expect(
      saveDetailsSchema.safeParse({
        ...operation,
        version: 0,
        input: deliveryInput,
      }).success,
    ).toBe(true);
    expect(
      deliveryOperationSchema.safeParse({ ...operation, version: 0 }).success,
    ).toBe(false);
  });
  it("rejects a server Google key in NEXT_PUBLIC variables", () => {
    expect(
      findPublicSecretNames({
        NEXT_PUBLIC_GOOGLE_MAPS_SERVER_API_KEY: "private",
      }),
    ).toEqual(["NEXT_PUBLIC_GOOGLE_MAPS_SERVER_API_KEY"]);
  });
});
