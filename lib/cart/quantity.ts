import type { CatalogueProduct, CatalogueVariant } from "@/lib/catalog/types";
import { MAX_CART_QUANTITY, type CartQuantityRule } from "@/lib/cart/types";

export function resolveQuantityRule(
  product: CatalogueProduct,
  variant: CatalogueVariant | null,
): CartQuantityRule {
  return {
    minimum: variant?.minimumQuantity ?? product.minimumQuantity,
    step: variant?.quantityStep ?? product.quantityStep,
    maximum: variant?.maximumQuantity ?? product.maximumQuantity,
  };
}

export function quantityIssue(
  quantity: number,
  rule: CartQuantityRule,
): "below" | "above" | "step" | null {
  if (quantity < rule.minimum) return "below";
  if (rule.maximum !== null && quantity > rule.maximum) return "above";
  if ((quantity - rule.minimum) % rule.step !== 0) return "step";
  return null;
}

export function coerceQuantityToRule(
  quantity: number,
  rule: CartQuantityRule,
): number {
  const hardMaximum = Math.min(
    rule.maximum ?? MAX_CART_QUANTITY,
    MAX_CART_QUANTITY,
  );
  if (!Number.isInteger(quantity) || quantity <= rule.minimum) {
    return rule.minimum;
  }
  if (quantity >= hardMaximum) {
    const steps = Math.floor((hardMaximum - rule.minimum) / rule.step);
    return rule.minimum + steps * rule.step;
  }

  const steps = Math.round((quantity - rule.minimum) / rule.step);
  return Math.min(hardMaximum, rule.minimum + steps * rule.step);
}

export function nextQuantity(quantity: number, rule: CartQuantityRule): number {
  if (quantity < rule.minimum || quantityIssue(quantity, rule) === "step") {
    return coerceQuantityToRule(quantity, rule);
  }
  const maximum = rule.maximum ?? MAX_CART_QUANTITY;
  return Math.min(maximum, quantity + rule.step);
}

export function previousQuantity(
  quantity: number,
  rule: CartQuantityRule,
): number {
  if (quantity <= rule.minimum) return rule.minimum;
  if (quantityIssue(quantity, rule))
    return coerceQuantityToRule(quantity, rule);
  return Math.max(rule.minimum, quantity - rule.step);
}
