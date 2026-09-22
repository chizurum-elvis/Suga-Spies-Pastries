import type {
  CatalogueOptionGroup,
  CatalogueProduct,
  CatalogueVariant,
} from "@/lib/catalog/types";
import { getCartLineId, normalizeRawCartLine } from "@/lib/cart/identity";
import { quantityIssue, resolveQuantityRule } from "@/lib/cart/quantity";
import type {
  CartIssue,
  CartQuantityRule,
  RawCartLine,
  RawCartOptionSelection,
  ValidatedCartOption,
} from "@/lib/cart/types";

export type ProductConfiguration = {
  variantId: string | null;
  optionSelections: RawCartOptionSelection[];
  quantity: number;
};

export type ConfigurationResult = {
  line: RawCartLine;
  lineId: string;
  variant: CatalogueVariant | null;
  options: ValidatedCartOption[];
  quantityRule: CartQuantityRule;
  baseUnitPriceCents: number | null;
  unitPriceCents: number | null;
  lineSubtotalCents: number | null;
  pricingFingerprint: string | null;
  issues: CartIssue[];
};

function selectedUnits(
  group: CatalogueOptionGroup,
  selections: readonly RawCartOptionSelection[],
): number {
  return selections.reduce(
    (total, selection) =>
      total + (group.selectionType === "quantity" ? selection.quantity : 1),
    0,
  );
}

function selectionLimitIssues(
  group: CatalogueOptionGroup,
  selections: readonly RawCartOptionSelection[],
): CartIssue[] {
  const count = selectedUnits(group, selections);
  const issues: CartIssue[] = [];

  if (group.isRequired && count === 0) {
    issues.push({
      code: "option_selection_required",
      optionGroupId: group.id,
      message: `Choose ${group.name.toLowerCase()} before adding this pastry.`,
    });
    return issues;
  }

  if (count > 0 && count < group.minimumSelections) {
    issues.push({
      code: "option_selection_too_small",
      optionGroupId: group.id,
      message: `${group.name} needs at least ${group.minimumSelections} selection${group.minimumSelections === 1 ? "" : "s"}.`,
    });
  }
  if (group.maximumSelections !== null && count > group.maximumSelections) {
    issues.push({
      code: "option_selection_too_large",
      optionGroupId: group.id,
      message: `${group.name} allows no more than ${group.maximumSelections} selection${group.maximumSelections === 1 ? "" : "s"}.`,
    });
  }
  if (group.selectionType === "single" && count > 1) {
    issues.push({
      code: "option_selection_too_large",
      optionGroupId: group.id,
      message: `Choose only one ${group.name.toLowerCase()} option.`,
    });
  }

  return issues;
}

function safePrice(operation: () => number): number | null {
  const result = operation();
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

export function configureProductLine(
  product: CatalogueProduct,
  configuration: ProductConfiguration,
): ConfigurationResult {
  const line = normalizeRawCartLine({
    productId: product.id,
    variantId: configuration.variantId,
    optionSelections: configuration.optionSelections,
    quantity: configuration.quantity,
  });
  const issues: CartIssue[] = [];
  let variant: CatalogueVariant | null = null;

  if (!product.isAvailable) {
    issues.push({
      code: "product_unavailable",
      message: `${product.name} is temporarily unavailable.`,
    });
  }

  if (product.variants.length > 0) {
    if (!line.variantId) {
      issues.push({
        code: "variant_required",
        message: "Choose a size or style before adding this pastry.",
      });
    } else {
      variant =
        product.variants.find((candidate) => candidate.id === line.variantId) ??
        null;
      if (!variant) {
        issues.push({
          code: "variant_invalid",
          message:
            "The selected size or style no longer belongs to this pastry.",
        });
      } else if (!variant.isAvailable) {
        issues.push({
          code: "variant_unavailable",
          message: `${variant.name} is temporarily unavailable.`,
        });
      }
    }
  } else if (line.variantId) {
    issues.push({
      code: "variant_invalid",
      message: "This pastry does not use the selected size or style.",
    });
  }

  const rule = resolveQuantityRule(product, variant);
  const issue = quantityIssue(line.quantity, rule);
  if (issue === "below") {
    issues.push({
      code: "quantity_below_minimum",
      message: `Choose at least ${rule.minimum}.`,
    });
  } else if (issue === "above") {
    issues.push({
      code: "quantity_above_maximum",
      message: `Choose no more than ${rule.maximum}.`,
    });
  } else if (issue === "step") {
    issues.push({
      code: "quantity_step_invalid",
      message: `After ${rule.minimum}, adjust the quantity in steps of ${rule.step}.`,
    });
  }

  const valueLocations = new Map<
    string,
    { group: CatalogueOptionGroup; valueIndex: number }
  >();
  for (const group of product.optionGroups) {
    group.values.forEach((_, valueIndex) => {
      valueLocations.set(group.values[valueIndex]!.id, { group, valueIndex });
    });
  }

  const selectionsByGroup = new Map<string, RawCartOptionSelection[]>();
  const options: ValidatedCartOption[] = [];
  for (const selection of line.optionSelections) {
    const location = valueLocations.get(selection.optionValueId);
    if (!location) {
      issues.push({
        code: "option_invalid",
        message:
          "A selected flavour or customization no longer belongs to this pastry.",
      });
      continue;
    }
    const value = location.group.values[location.valueIndex]!;
    if (
      location.group.selectionType !== "quantity" &&
      selection.quantity !== 1
    ) {
      issues.push({
        code: "option_quantity_invalid",
        optionGroupId: location.group.id,
        message: `${value.name} can only be selected once.`,
      });
    }
    if (!value.isAvailable) {
      issues.push({
        code: "option_unavailable",
        optionGroupId: location.group.id,
        message: `${value.name} is temporarily unavailable.`,
      });
    }
    const groupSelections = selectionsByGroup.get(location.group.id) ?? [];
    groupSelections.push(selection);
    selectionsByGroup.set(location.group.id, groupSelections);
    options.push({
      id: value.id,
      groupId: location.group.id,
      groupName: location.group.name,
      name: value.name,
      quantity: selection.quantity,
      priceDeltaCents: value.priceDeltaCents,
      selectionType: location.group.selectionType,
    });
  }

  for (const group of product.optionGroups) {
    issues.push(
      ...selectionLimitIssues(group, selectionsByGroup.get(group.id) ?? []),
    );
  }

  const baseUnitPriceCents = variant?.priceCents ?? product.basePriceCents;
  const perUnitOptionCents = options
    .filter((option) => option.selectionType !== "quantity")
    .reduce((total, option) => total + option.priceDeltaCents, 0);
  const allocatedOptionCents = options
    .filter((option) => option.selectionType === "quantity")
    .reduce(
      (total, option) => total + option.priceDeltaCents * option.quantity,
      0,
    );
  const unitPriceCents = safePrice(
    () => baseUnitPriceCents + perUnitOptionCents,
  );
  const lineSubtotalCents =
    unitPriceCents === null
      ? null
      : safePrice(() => unitPriceCents * line.quantity + allocatedOptionCents);
  const pricingFingerprint =
    unitPriceCents === null || lineSubtotalCents === null
      ? null
      : [
          `base=${baseUnitPriceCents}`,
          ...options
            .map((option) => `${option.id}=${option.priceDeltaCents}`)
            .sort(),
        ].join("|");

  if (unitPriceCents === null || lineSubtotalCents === null) {
    issues.push({
      code: "price_unavailable",
      message: "This line could not be priced safely. Remove it and try again.",
    });
  }

  return {
    line,
    lineId: getCartLineId(line),
    variant,
    options,
    quantityRule: rule,
    baseUnitPriceCents,
    unitPriceCents,
    lineSubtotalCents,
    pricingFingerprint,
    issues,
  };
}
