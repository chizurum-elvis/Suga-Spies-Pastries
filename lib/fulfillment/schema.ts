import { z } from "zod";

import { rawCartSchema } from "@/lib/cart/schema";
import { parseLocalDate } from "@/lib/fulfillment/rules";

export const fulfillmentMethodSchema = z.literal("delivery");
export const localMonthSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "Choose a valid calendar month.");
export const localDateSchema = z
  .string()
  .regex(
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
    "Choose a valid date.",
  )
  .refine(
    (value) => parseLocalDate(value) !== null,
    "Choose a real calendar date.",
  );
export const fulfillmentSelectionSchema = z.strictObject({
  cart: rawCartSchema,
  method: fulfillmentMethodSchema,
  date: localDateSchema,
});

const availabilityReasonSchema = z.strictObject({
  code: z.enum([
    "insufficient_notice",
    "beyond_horizon",
    "closed_holiday",
    "closed_weekday",
    "blackout",
    "fully_booked",
  ]),
  message: z.string().min(1).max(160),
});

export const availabilityMonthSchema = z.strictObject({
  asOf: z.iso.datetime(),
  timeZone: z.literal("America/Toronto"),
  method: fulfillmentMethodSchema,
  minimumNoticeDays: z.number().int().min(1).max(30),
  month: localMonthSchema,
  monthLabel: z.string().min(1).max(80),
  minimumDate: localDateSchema,
  maximumDate: localDateSchema,
  previousMonth: localMonthSchema.nullable(),
  nextMonth: localMonthSchema.nullable(),
  days: z
    .array(
      z.strictObject({
        date: localDateSchema,
        label: z.string().min(1).max(120),
        dayNumber: z.number().int().min(1).max(31),
        isoWeekday: z.number().int().min(1).max(7),
        selectable: z.boolean(),
        reason: availabilityReasonSchema.nullable(),
      }),
    )
    .min(28)
    .max(31),
});

export const checkoutDraftSummarySchema = z.strictObject({
  method: fulfillmentMethodSchema,
  date: localDateSchema,
  dateLabel: z.string().min(1).max(120),
  status: z.literal("ready_for_details"),
  expiresAt: z.iso.datetime({ offset: true }),
});
