import { z } from "zod";

import { phoneSchema, postalCodeSchema } from "@/lib/delivery/schema";
import { parseLocalDate } from "@/lib/fulfillment/rules";

const requiredText = (max: number) => z.string().trim().min(2).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

export const externalItemInputSchema = z.strictObject({
  productId: z.uuid(),
  quantity: z
    .string()
    .regex(/^[0-9]{1,5}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(10000)),
  note: optionalText(300),
});

export const externalOrderInputSchema = z.strictObject({
  date: z.string().refine((value) => parseLocalDate(value) !== null),
  source: z.enum(["phone", "instagram", "admin", "other"]),
  customerName: requiredText(120),
  customerPhone: phoneSchema,
  customerEmail: z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.email().max(254)]))
    .transform((value) => value || null),
  recipientName: requiredText(120),
  addressLine1: requiredText(160),
  addressLine2: optionalText(100),
  city: z.enum(["Toronto", "Markham", "Mississauga"]),
  postalCode: postalCodeSchema,
  deliveryInstructions: optionalText(500),
  internalNote: optionalText(500),
  confirmAddress: z.boolean(),
  items: z.array(externalItemInputSchema).min(1).max(50),
});

export const externalItemSnapshotSchema = z.strictObject({
  productId: z.uuid(),
  name: z.string().min(2).max(120),
  quantity: z.number().int().min(1).max(10000),
  note: z.string().max(300).nullable(),
  baseUnitPriceCents: z.number().int().nonnegative(),
});

export type ExternalItemSnapshot = z.infer<typeof externalItemSnapshotSchema>;
