import { getCartLineId, normalizeRawCartLine } from "@/lib/cart/identity";
import {
  CART_SCHEMA_VERSION,
  MAX_CART_LINES,
  MAX_CART_QUANTITY,
  type RawCart,
  type RawCartLine,
} from "@/lib/cart/types";

export type CartMutationResult = {
  cart: RawCart;
  changed: boolean;
  message: string | null;
};

export function addCartLine(
  cart: RawCart,
  originalLine: RawCartLine,
  maximumQuantity: number | null = null,
): CartMutationResult {
  const line = normalizeRawCartLine(originalLine);
  const lineId = getCartLineId(line);
  const existingIndex = cart.lines.findIndex(
    (candidate) => getCartLineId(candidate) === lineId,
  );
  const allowedMaximum = Math.min(
    maximumQuantity ?? MAX_CART_QUANTITY,
    MAX_CART_QUANTITY,
  );

  if (existingIndex >= 0) {
    const existing = cart.lines[existingIndex]!;
    const nextQuantity = existing.quantity + line.quantity;
    if (nextQuantity > allowedMaximum) {
      return {
        cart,
        changed: false,
        message: `This selection cannot exceed ${allowedMaximum}.`,
      };
    }
    const lines = [...cart.lines];
    lines[existingIndex] = { ...existing, quantity: nextQuantity };
    return {
      cart: { version: CART_SCHEMA_VERSION, lines },
      changed: true,
      message: null,
    };
  }

  if (cart.lines.length >= MAX_CART_LINES) {
    return {
      cart,
      changed: false,
      message: `A cart can contain up to ${MAX_CART_LINES} different selections.`,
    };
  }
  if (line.quantity > allowedMaximum) {
    return {
      cart,
      changed: false,
      message: `This selection cannot exceed ${allowedMaximum}.`,
    };
  }

  return {
    cart: { version: CART_SCHEMA_VERSION, lines: [...cart.lines, line] },
    changed: true,
    message: null,
  };
}

export function updateCartLineQuantity(
  cart: RawCart,
  lineId: string,
  quantity: number,
): CartMutationResult {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CART_QUANTITY
  ) {
    return {
      cart,
      changed: false,
      message: `Enter a whole number between 1 and ${MAX_CART_QUANTITY}.`,
    };
  }
  const index = cart.lines.findIndex(
    (candidate) => getCartLineId(candidate) === lineId,
  );
  if (index < 0) return { cart, changed: false, message: null };
  if (cart.lines[index]!.quantity === quantity) {
    return { cart, changed: false, message: null };
  }

  const lines = [...cart.lines];
  lines[index] = { ...lines[index]!, quantity };
  return {
    cart: { version: CART_SCHEMA_VERSION, lines },
    changed: true,
    message: null,
  };
}

export function removeCartLine(
  cart: RawCart,
  lineId: string,
): CartMutationResult {
  const lines = cart.lines.filter(
    (candidate) => getCartLineId(candidate) !== lineId,
  );
  return {
    cart: { version: CART_SCHEMA_VERSION, lines },
    changed: lines.length !== cart.lines.length,
    message: null,
  };
}

export function rawCartItemCount(cart: RawCart): number {
  return cart.lines.reduce((total, line) => total + line.quantity, 0);
}
