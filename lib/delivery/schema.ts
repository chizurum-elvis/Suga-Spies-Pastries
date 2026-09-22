import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { rawCartSchema } from "@/lib/cart/schema";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Remove unsupported characters.",
    );
export const postalCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/,
        "Enter a Canadian postal code, such as M5V 3L9.",
      ),
  )
  .transform((value) => `${value.slice(0, 3)} ${value.slice(3)}`);
const rawPhoneSchema = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .max(30);

export const phoneSchema = rawPhoneSchema.transform((value, context) => {
  const phone = parsePhoneNumberFromString(value, {
    defaultCountry: "CA",
    extract: false,
  });

  if (!phone || phone.country !== "CA" || !phone.isValid() || phone.ext) {
    context.addIssue({
      code: "custom",
      message:
        "Enter a valid 10-digit Canadian phone number, including the area code.",
    });
    return z.NEVER;
  }

  return `${phone.number}`;
});

export const deliveryAddressSchema = z.strictObject({
  line1: text(160),
  line2: z
    .string()
    .trim()
    .max(80)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  city: text(80),
  province: z.literal("ON"),
  postalCode: postalCodeSchema,
  country: z.literal("CA"),
});
const deliveryInputShape = {
  name: text(100),
  email: z
    .string()
    .trim()
    .pipe(z.email("Enter a valid email address.").max(254)),
  recipientName: text(100),
  address: deliveryAddressSchema,
  instructions: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    ),
};

export const deliveryInputSchema = z.strictObject({
  ...deliveryInputShape,
  phone: phoneSchema,
});

// A saved draft can predate a stricter contact rule. Returning its raw phone
// lets the customer correct that one field instead of losing the whole form.
export const storedDeliveryInputSchema = z.strictObject({
  ...deliveryInputShape,
  phone: rawPhoneSchema,
});
const version = z.number().int().nonnegative().max(2147483646);
export const saveDetailsSchema = z.strictObject({
  version,
  draftVersion: version.min(1),
  cart: rawCartSchema,
  input: deliveryInputSchema,
});
export const deliveryOperationSchema = z.strictObject({
  version: version.min(1),
  draftVersion: version.min(1),
  cart: rawCartSchema,
});
export const deliveryQuoteSchema = z.strictObject({
  id: z.uuid(),
  address: deliveryAddressSchema,
  requiresConfirmation: z.boolean(),
  settingsVersion: z.number().int().positive(),
  subtotalCents: z.number().int().nonnegative(),
  feeCents: z.number().int().nonnegative(),
  freeDelivery: z.boolean(),
  cartFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  pricingFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.iso.datetime({ offset: true }),
});
export const publicQuoteSchema = deliveryQuoteSchema.omit({
  cartFingerprint: true,
  pricingFingerprint: true,
});
export const deliveryStateSchema = z.strictObject({
  cart: rawCartSchema,
  draftVersion: version.min(1),
  version,
  input: storedDeliveryInputSchema.nullable(),
  status: z.enum(["unverified", "quoted", "confirmed", "stale"]),
  quote: publicQuoteSchema.nullable(),
  dateLabel: z.string(),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
export type DeliveryInput = z.infer<typeof deliveryInputSchema>;
export type DeliveryQuote = z.infer<typeof deliveryQuoteSchema>;
export type DeliveryState = z.infer<typeof deliveryStateSchema>;

export const deliveryPricingSchema = z
  .strictObject({
    base_distance_meters: z.number().int().min(0).max(30000),
    base_fee_cents: z.number().int().min(0).max(100000),
    extra_km_fee_cents: z.number().int().min(0).max(10000),
    maximum_distance_meters: z.number().int().min(1).max(30000),
    free_delivery_threshold_cents: z.number().int().min(0).max(1000000),
  })
  .refine(
    (value) => value.base_distance_meters <= value.maximum_distance_meters,
    "The base distance cannot exceed the delivery limit.",
  );
export type DeliveryPricing = z.infer<typeof deliveryPricingSchema>;
