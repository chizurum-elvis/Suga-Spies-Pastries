import { z } from "zod";

import {
  CART_SCHEMA_VERSION,
  MAX_CART_LINES,
  MAX_CART_QUANTITY,
  MAX_OPTION_SELECTIONS_PER_LINE,
} from "@/lib/cart/types";

const nonNegativeMoney = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const cartIssueSchema = z.strictObject({
  code: z.enum([
    "product_missing",
    "product_unavailable",
    "variant_required",
    "variant_invalid",
    "variant_unavailable",
    "option_invalid",
    "option_unavailable",
    "option_selection_required",
    "option_selection_too_small",
    "option_selection_too_large",
    "option_quantity_invalid",
    "quantity_below_minimum",
    "quantity_above_maximum",
    "quantity_step_invalid",
    "price_unavailable",
  ]),
  message: z.string().min(1).max(500),
  optionGroupId: z.uuid().optional(),
});

const optionSelectionSchema = z.strictObject({
  optionValueId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});

const imageSchema = z.strictObject({
  id: z.string().min(1).max(200),
  src: z.string().min(1).max(1_000),
  storagePath: z.string().max(500).nullable(),
  alt: z.string().max(240),
  objectPosition: z.string().max(50),
  isPrimary: z.boolean(),
});

const validatedLineSchema = z.strictObject({
  lineId: z.string().min(1).max(4_000),
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  optionSelections: z
    .array(optionSelectionSchema)
    .max(MAX_OPTION_SELECTIONS_PER_LINE),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
  status: z.enum(["ready", "blocked"]),
  product: z
    .strictObject({
      name: z.string().min(1).max(120),
      slug: z.string().min(1).max(120),
      image: imageSchema.nullable(),
    })
    .nullable(),
  variant: z
    .strictObject({ id: z.uuid(), name: z.string().min(1).max(100) })
    .nullable(),
  options: z
    .array(
      z.strictObject({
        id: z.uuid(),
        groupId: z.uuid(),
        groupName: z.string().min(1).max(100),
        name: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
        priceDeltaCents: nonNegativeMoney,
        selectionType: z.enum(["single", "multiple", "quantity"]),
      }),
    )
    .max(MAX_OPTION_SELECTIONS_PER_LINE),
  quantityRule: z
    .strictObject({
      minimum: z.number().int().min(1).max(MAX_CART_QUANTITY),
      step: z.number().int().min(1).max(MAX_CART_QUANTITY),
      maximum: z.number().int().min(1).max(MAX_CART_QUANTITY).nullable(),
    })
    .nullable(),
  baseUnitPriceCents: nonNegativeMoney.nullable(),
  unitPriceCents: nonNegativeMoney.nullable(),
  lineSubtotalCents: nonNegativeMoney.nullable(),
  pricingFingerprint: z.string().max(6_000).nullable(),
  issues: z.array(cartIssueSchema).max(100),
});

export const validatedCartSchema = z.strictObject({
  version: z.literal(CART_SCHEMA_VERSION),
  status: z.enum(["empty", "ready", "blocked"]),
  currency: z.literal("CAD"),
  validatedAt: z.iso.datetime(),
  itemCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  lineCount: z.number().int().min(0).max(MAX_CART_LINES),
  subtotalCents: nonNegativeMoney.nullable(),
  lines: z.array(validatedLineSchema).max(MAX_CART_LINES),
});
