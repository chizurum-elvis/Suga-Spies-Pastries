import type { CatalogueImage } from "@/lib/catalog/types";

export const CART_SCHEMA_VERSION = 1 as const;
export const CART_STORAGE_KEY = "suga-spies:guest-cart";
export const CART_LOCK_NAME = "suga-spies:guest-cart-write";
export const MAX_CART_LINES = 50;
export const MAX_OPTION_SELECTIONS_PER_LINE = 32;
export const MAX_CART_QUANTITY = 10_000;

export type RawCartOptionSelection = {
  optionValueId: string;
  quantity: number;
};

export type RawCartLine = {
  productId: string;
  variantId: string | null;
  optionSelections: RawCartOptionSelection[];
  quantity: number;
};

export type RawCart = {
  version: typeof CART_SCHEMA_VERSION;
  lines: RawCartLine[];
};

export type CartQuantityRule = {
  minimum: number;
  step: number;
  maximum: number | null;
};

export type CartIssueCode =
  | "product_missing"
  | "product_unavailable"
  | "variant_required"
  | "variant_invalid"
  | "variant_unavailable"
  | "option_invalid"
  | "option_unavailable"
  | "option_selection_required"
  | "option_selection_too_small"
  | "option_selection_too_large"
  | "option_quantity_invalid"
  | "quantity_below_minimum"
  | "quantity_above_maximum"
  | "quantity_step_invalid"
  | "price_unavailable";

export type CartIssue = {
  code: CartIssueCode;
  message: string;
  optionGroupId?: string;
};

export type ValidatedCartOption = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  quantity: number;
  priceDeltaCents: number;
  selectionType: "single" | "multiple" | "quantity";
};

export type ValidatedCartLine = {
  lineId: string;
  productId: string;
  variantId: string | null;
  optionSelections: RawCartOptionSelection[];
  quantity: number;
  status: "ready" | "blocked";
  product: {
    name: string;
    slug: string;
    image: CatalogueImage | null;
  } | null;
  variant: { id: string; name: string } | null;
  options: ValidatedCartOption[];
  quantityRule: CartQuantityRule | null;
  baseUnitPriceCents: number | null;
  unitPriceCents: number | null;
  lineSubtotalCents: number | null;
  pricingFingerprint: string | null;
  issues: CartIssue[];
};

export type ValidatedCart = {
  version: typeof CART_SCHEMA_VERSION;
  status: "empty" | "ready" | "blocked";
  currency: "CAD";
  validatedAt: string;
  itemCount: number;
  lineCount: number;
  subtotalCents: number | null;
  lines: ValidatedCartLine[];
};

export type CartPriceChange = {
  lineId: string;
  productName: string;
  currentLineSubtotalCents: number | null;
};

export type DisplayedLineExpectation = {
  pricingFingerprint: string;
  lineSubtotalCents: number;
};

export type CartValidationState =
  | { status: "idle"; data: null; message: null }
  | { status: "validating"; data: ValidatedCart | null; message: null }
  | { status: "ready"; data: ValidatedCart; message: null }
  | { status: "error"; data: ValidatedCart | null; message: string };
