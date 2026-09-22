import { z } from "zod";

import {
  fulfillmentMethodSchema,
  localDateSchema,
} from "@/lib/fulfillment/schema";
import { parseLocalDate } from "@/lib/fulfillment/rules";

const optionalTrimmed = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() ? value.trim() : null,
    z.string().max(maximum).nullable(),
  );

const realDateSchema = localDateSchema.refine(
  (value) => parseLocalDate(value) !== null,
  "Choose a real calendar date.",
);

export const blackoutFormSchema = z.strictObject({
  id: z.uuid().optional(),
  version: z.coerce.number().int().min(1).optional(),
  date: realDateSchema,
  scope: fulfillmentMethodSchema,
  publicReason: optionalTrimmed(120),
  internalNote: optionalTrimmed(500),
});

export const blackoutIdentitySchema = z.strictObject({
  id: z.uuid(),
  version: z.coerce.number().int().min(1),
});

export const capacityAdjustmentFormSchema = z.strictObject({
  date: realDateSchema,
  source: z.enum(["phone", "instagram", "admin", "other"]),
  customerReference: optionalTrimmed(80),
  internalNote: optionalTrimmed(500),
});

export const capacityAdjustmentIdentitySchema = z.strictObject({
  id: z.uuid(),
});
