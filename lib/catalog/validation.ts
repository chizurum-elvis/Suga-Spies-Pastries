import { z } from "zod";

const optionalTrimmed = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(maximum).nullable(),
  );

const wholeNumber = (label: string, minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z
      .number({ error: `${label} must be a number.` })
      .int({ error: `${label} must be a whole number.` })
      .min(minimum, { error: `${label} must be at least ${minimum}.` })
      .max(maximum, { error: `${label} must be ${maximum} or less.` }),
  );

const optionalWholeNumber = (label: string, minimum: number, maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? null
        : typeof value === "string"
          ? Number(value)
          : value,
    z
      .number({ error: `${label} must be a number.` })
      .int()
      .min(minimum)
      .max(maximum)
      .nullable(),
  );

export function parseCadAmountToCents(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (
    !/^\$?(?:0|[1-9]\d{0,6}|[1-9]\d{0,2}(?:,\d{3}){1,2})(?:\.\d{1,2})?$/.test(
      input,
    )
  ) {
    return null;
  }
  const normalized = input.replace(/^\$/, "").replace(/,/g, "");
  const [dollars, fraction = ""] = normalized.split(".");
  return Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
}

const priceCents = z.preprocess(
  parseCadAmountToCents,
  z
    .number({ error: "Enter a valid Canadian-dollar price, such as 4.50." })
    .int()
    .min(0)
    .max(100000000),
);

const optionalPriceCents = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? null
      : parseCadAmountToCents(value),
  z
    .number({ error: "Enter a valid Canadian-dollar price." })
    .int()
    .min(0)
    .max(100000000)
    .nullable(),
);

export const productFormSchema = z
  .strictObject({
    id: z.uuid().optional(),
    version: wholeNumber("Version", 1, 2147483647).optional(),
    name: z
      .string({ error: "Enter a product name." })
      .trim()
      .min(2, "Use at least 2 characters.")
      .max(120),
    slug: z
      .string({ error: "Enter a URL slug." })
      .trim()
      .min(2)
      .max(120)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens only.",
      ),
    categoryId: z.uuid({ error: "Choose a valid category." }),
    shortDescription: optionalTrimmed(240),
    description: optionalTrimmed(4000),
    price: priceCents,
    isStartingPrice: z.boolean(),
    unitLabel: optionalTrimmed(40),
    minimumQuantity: wholeNumber("Minimum quantity", 1, 10000),
    quantityStep: wholeNumber("Quantity step", 1, 10000),
    maximumQuantity: optionalWholeNumber("Maximum quantity", 1, 10000),
    ingredients: optionalTrimmed(5000),
    allergenInformation: optionalTrimmed(3000),
    customerInstructions: optionalTrimmed(2000),
    displayOrder: wholeNumber("Display order", 0, 1000000),
  })
  .superRefine((value, context) => {
    if (
      value.maximumQuantity !== null &&
      value.maximumQuantity < value.minimumQuantity
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Maximum quantity cannot be lower than the minimum.",
      });
    }
  });

export const categoryFormSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayOrder: wholeNumber("Display order", 0, 1000000),
});

export const catalogueStatusSchema = z.strictObject({
  productId: z.uuid(),
  version: wholeNumber("Version", 1, 2147483647),
  intent: z.enum([
    "publish",
    "unpublish",
    "archive",
    "make_available",
    "make_unavailable",
  ]),
});

export const imageMetadataSchema = z.strictObject({
  productId: z.uuid(),
  altText: z.string().trim().min(3).max(240),
  objectPosition: z.string().regex(/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/),
});

export const variantFormSchema = z
  .strictObject({
    productId: z.uuid(),
    name: z.string().trim().min(1).max(100),
    price: optionalPriceCents,
    minimumQuantity: optionalWholeNumber("Variant minimum", 1, 10000),
    quantityStep: optionalWholeNumber("Variant quantity step", 1, 10000),
    maximumQuantity: optionalWholeNumber("Variant maximum", 1, 10000),
  })
  .superRefine((value, context) => {
    if (
      value.minimumQuantity !== null &&
      value.maximumQuantity !== null &&
      value.maximumQuantity < value.minimumQuantity
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Variant maximum cannot be below its minimum.",
      });
    }
  });

export const optionGroupFormSchema = z.strictObject({
  productId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  selectionType: z.enum(["single", "multiple", "quantity"]),
  isRequired: z.boolean(),
});

export const optionValueFormSchema = z.strictObject({
  optionGroupId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  price: priceCents,
});

export const nestedCatalogueStateSchema = z.strictObject({
  productId: z.uuid(),
  itemId: z.uuid(),
  itemType: z.enum(["variant", "option_group", "option_value"]),
  intent: z.enum(["make_available", "make_unavailable", "archive"]),
});

export function formBoolean(formData: FormData, name: string) {
  return formData.get(name) === "on";
}
