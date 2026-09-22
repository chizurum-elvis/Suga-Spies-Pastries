"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { getCartLineId } from "@/lib/cart/identity";
import {
  addCartLine,
  rawCartItemCount,
  removeCartLine,
  updateCartLineQuantity,
  type CartMutationResult,
} from "@/lib/cart/mutations";
import { validatedCartSchema } from "@/lib/cart/response-schema";
import { createEmptyCart, restoreCart, serializeCart } from "@/lib/cart/schema";
import {
  CART_LOCK_NAME,
  CART_STORAGE_KEY,
  type CartPriceChange,
  type CartValidationState,
  type DisplayedLineExpectation,
  type RawCart,
  type RawCartLine,
  type ValidatedCart,
} from "@/lib/cart/types";

type AddLineInput = {
  line: RawCartLine;
  maximumQuantity: number | null;
  productName: string;
  expectation: DisplayedLineExpectation | null;
};

type CartContextValue = {
  cart: RawCart;
  itemCount: number;
  hydrated: boolean;
  drawerOpen: boolean;
  checkoutLocked: boolean;
  setCheckoutLocked: (locked: boolean) => void;
  drawerStep: "cart" | "date";
  preferredDate: string | null;
  setPreferredDate: (date: string | null) => void;
  setDrawerStep: (step: "cart" | "date") => void;
  validation: CartValidationState;
  priceChanges: CartPriceChange[];
  storageWarning: string | null;
  addLine: (input: AddLineInput) => Promise<boolean>;
  updateQuantity: (lineId: string, quantity: number) => Promise<boolean>;
  removeLine: (lineId: string, productName?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearPurchasedCart: (purchased: RawCart, orderId: string) => Promise<void>;
  openCart: (step?: "cart" | "date") => void;
  closeCart: () => void;
  setDrawerOpen: (open: boolean) => void;
  refreshCart: () => void;
  acknowledgePriceChanges: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const initialValidation: CartValidationState = {
  status: "idle",
  data: null,
  message: null,
};

function readCartFromStorage(): ReturnType<typeof restoreCart> {
  return restoreCart(window.localStorage.getItem(CART_STORAGE_KEY));
}

function currentPricingChanges(
  previous: ValidatedCart | null,
  current: ValidatedCart,
  expectations: Map<string, DisplayedLineExpectation>,
): CartPriceChange[] {
  const previousById = new Map(
    (previous?.lines ?? []).map((line) => [line.lineId, line]),
  );

  return current.lines.flatMap((line) => {
    if (!line.product || !line.pricingFingerprint) return [];
    const previousFingerprint = previousById.get(
      line.lineId,
    )?.pricingFingerprint;
    const expectation = expectations.get(line.lineId);
    const changed = previousFingerprint
      ? previousFingerprint !== line.pricingFingerprint
      : expectation
        ? expectation.pricingFingerprint !== line.pricingFingerprint
        : false;

    return changed
      ? [
          {
            lineId: line.lineId,
            productName: line.product.name,
            currentLineSubtotalCents: line.lineSubtotalCents,
          },
        ]
      : [];
  });
}

async function requestValidatedCart(
  cart: RawCart,
  signal?: AbortSignal,
): Promise<ValidatedCart> {
  const response = await fetch("/api/cart/validate", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: serializeCart(cart),
    signal,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : "We could not confirm the current menu. Please retry.";
    throw new Error(message);
  }
  const parsed = validatedCartSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("The menu returned an unexpected response. Please retry.");
  }
  return parsed.data;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<RawCart>(createEmptyCart);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  const [drawerStep, setDrawerStep] = useState<"cart" | "date">("cart");
  const [preferredDate, setPreferredDate] = useState<string | null>(null);
  const [validation, setValidation] =
    useState<CartValidationState>(initialValidation);
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const cartRef = useRef(cart);
  const validationRef = useRef<ValidatedCart | null>(null);
  const expectationRef = useRef(new Map<string, DisplayedLineExpectation>());
  const storageFailedRef = useRef(false);

  const acceptValidation = useCallback(
    (next: ValidatedCart, previous = validationRef.current) => {
      const nextChanges = currentPricingChanges(
        previous,
        next,
        expectationRef.current,
      );
      const activeLineIds = new Set(next.lines.map((line) => line.lineId));
      setPriceChanges((existing) => {
        const merged = new Map(
          existing
            .filter((change) => activeLineIds.has(change.lineId))
            .map((change) => [change.lineId, change]),
        );
        nextChanges.forEach((change) => merged.set(change.lineId, change));
        return [...merged.values()];
      });
      next.lines.forEach((line) => expectationRef.current.delete(line.lineId));
      validationRef.current = next;
      setValidation({ status: "ready", data: next, message: null });
    },
    [],
  );

  const commitCart = useCallback((nextCart: RawCart) => {
    cartRef.current = nextCart;
    setCart(nextCart);
    // Keep rows mounted while revalidating so quantity controls retain focus.
    // The validating state prevents the previous subtotal being used to proceed.
    setValidation((current) => ({
      status: "validating",
      data: current.data,
      message: null,
    }));
    const activeIds = new Set(nextCart.lines.map(getCartLineId));
    setPriceChanges((changes) =>
      changes.filter((change) => activeIds.has(change.lineId)),
    );

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(nextCart));
      storageFailedRef.current = false;
      setStorageWarning(null);
    } catch {
      storageFailedRef.current = true;
      setStorageWarning(
        "Your cart is available in this tab, but this browser could not save it for a refresh.",
      );
    }
  }, []);

  const mutateCart = useCallback(
    async (
      mutation: (current: RawCart) => CartMutationResult,
    ): Promise<CartMutationResult> => {
      const run = () => {
        let base = cartRef.current;
        if (!storageFailedRef.current) {
          try {
            base = readCartFromStorage().cart;
          } catch {
            base = cartRef.current;
          }
        }
        const result = mutation(base);
        if (result.changed) commitCart(result.cart);
        return result;
      };

      if (navigator.locks) {
        return navigator.locks.request(CART_LOCK_NAME, run);
      }
      return run();
    },
    [commitCart],
  );

  useEffect(() => {
    const restored = readCartFromStorage();
    cartRef.current = restored.cart;
    setCart(restored.cart);
    setHydrated(true);
    if (restored.recovered) {
      try {
        window.localStorage.setItem(
          CART_STORAGE_KEY,
          serializeCart(restored.cart),
        );
      } catch {
        storageFailedRef.current = true;
        setStorageWarning(
          "Your cart is available in this tab, but this browser could not save it for a refresh.",
        );
      }
      toast.info("We safely reset unsupported cart data.", {
        description: "Only valid pastry selections were kept.",
      });
    }

    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== CART_STORAGE_KEY) return;
      const next = restoreCart(event.newValue);
      cartRef.current = next.cart;
      setCart(next.cart);
      setValidation(initialValidation);
      validationRef.current = null;
      setPriceChanges([]);
      setStorageWarning(null);
      storageFailedRef.current = false;
      setAnnouncement("Cart updated from another tab.");
    };
    window.addEventListener("storage", syncFromAnotherTab);
    return () => window.removeEventListener("storage", syncFromAnotherTab);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (cart.lines.length === 0) {
      const empty: ValidatedCart = {
        version: 1,
        status: "empty",
        currency: "CAD",
        validatedAt: new Date().toISOString(),
        itemCount: 0,
        lineCount: 0,
        subtotalCents: 0,
        lines: [],
      };
      validationRef.current = empty;
      setValidation({ status: "ready", data: empty, message: null });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setValidation((current) => ({
        status: "validating",
        data: current.data,
        message: null,
      }));
      try {
        acceptValidation(await requestValidatedCart(cart, controller.signal));
      } catch (error) {
        if (controller.signal.aborted) return;
        setValidation((current) => ({
          status: "error",
          data: current.data,
          message:
            error instanceof Error
              ? error.message
              : "We could not confirm the current menu. Please retry.",
        }));
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [acceptValidation, cart, hydrated, refreshSequence]);

  const refreshCart = useCallback(() => {
    setRefreshSequence((sequence) => sequence + 1);
  }, []);

  useEffect(() => {
    if (!hydrated || cart.lines.length === 0) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCart();
    };
    const interval = window.setInterval(refreshCart, 60_000);
    window.addEventListener("focus", refreshCart);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshCart);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [cart.lines.length, hydrated, refreshCart]);

  const addLine = useCallback(
    async ({
      expectation,
      line,
      maximumQuantity,
      productName,
    }: AddLineInput) => {
      const lineId = getCartLineId(line);
      if (expectation) expectationRef.current.set(lineId, expectation);
      const validateAndCommit = async (): Promise<CartMutationResult> => {
        let base = cartRef.current;
        if (!storageFailedRef.current) {
          try {
            base = readCartFromStorage().cart;
          } catch {
            base = cartRef.current;
          }
        }

        const candidate = addCartLine(base, line, maximumQuantity);
        if (!candidate.changed) return candidate;

        let checked: ValidatedCart;
        try {
          checked = await requestValidatedCart(candidate.cart);
        } catch (error) {
          return {
            cart: base,
            changed: false,
            message:
              error instanceof Error
                ? error.message
                : "We could not confirm this pastry. Please retry.",
          };
        }

        const addedLine = checked.lines.find(
          (candidateLine) => candidateLine.lineId === lineId,
        );
        if (!addedLine || addedLine.status !== "ready") {
          return {
            cart: base,
            changed: false,
            message:
              addedLine?.issues[0]?.message ??
              "This pastry is no longer available on the current menu.",
          };
        }

        const previous = validationRef.current;
        commitCart(candidate.cart);
        acceptValidation(checked, previous);
        return candidate;
      };
      const result = navigator.locks
        ? await navigator.locks.request(CART_LOCK_NAME, validateAndCommit)
        : await validateAndCommit();
      if (!result.changed) {
        expectationRef.current.delete(lineId);
        toast.error("This pastry was not added.", {
          description: result.message ?? "Review the selection and try again.",
        });
        return false;
      }

      const count = rawCartItemCount(result.cart);
      setAnnouncement(
        `Added ${line.quantity} ${productName}. Cart now has ${count} item${count === 1 ? "" : "s"}.`,
      );
      toast.success("Added to your pastry box", {
        description: `${line.quantity} × ${productName}`,
      });
      setDrawerStep("cart");
      setDrawerOpen(true);
      return true;
    },
    [acceptValidation, commitCart],
  );

  const updateQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      const result = await mutateCart((current) =>
        updateCartLineQuantity(current, lineId, quantity),
      );
      if (result.message) {
        toast.error("Quantity not updated", { description: result.message });
        return false;
      }
      if (result.changed) {
        setAnnouncement(`Quantity updated to ${quantity}.`);
      }
      return result.changed;
    },
    [mutateCart],
  );

  const removeLine = useCallback(
    async (lineId: string, productName = "Pastry") => {
      const result = await mutateCart((current) =>
        removeCartLine(current, lineId),
      );
      if (result.changed) {
        expectationRef.current.delete(lineId);
        setAnnouncement(`${productName} removed from the cart.`);
        toast.success("Removed from your pastry box", {
          description: productName,
        });
      }
    },
    [mutateCart],
  );

  const clearCart = useCallback(async () => {
    const result = await mutateCart(() => ({
      cart: createEmptyCart(),
      changed: cartRef.current.lines.length > 0,
      message: null,
    }));
    if (result.changed) {
      expectationRef.current.clear();
      setPriceChanges([]);
      setAnnouncement("Cart cleared.");
    }
  }, [mutateCart]);

  const openCart = useCallback(
    (step: "cart" | "date" = "cart") => {
      setDrawerStep(step);
      setDrawerOpen(true);
      refreshCart();
    },
    [refreshCart],
  );
  const closeCart = useCallback(() => setDrawerOpen(false), []);
  const acknowledgePriceChanges = useCallback(() => {
    setPriceChanges([]);
    setAnnouncement("Updated prices reviewed.");
  }, []);

  const clearPurchasedCart = useCallback(
    async (purchased: RawCart, orderId: string) => {
      await mutateCart((current) => {
        const key = `suga-spies:order-cleared:${orderId}`;
        // Mark within the same cross-tab lock. Never clear a newly edited box.
        try {
          if (window.localStorage.getItem(key))
            return { cart: current, changed: false, message: null };
          window.localStorage.setItem(key, "1");
        } catch {
          return { cart: current, changed: false, message: null };
        }
        if (serializeCart(current) !== serializeCart(purchased))
          return { cart: current, changed: false, message: null };
        return {
          cart: createEmptyCart(),
          changed: current.lines.length > 0,
          message: null,
        };
      });
    },
    [mutateCart],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: rawCartItemCount(cart),
      hydrated,
      drawerOpen,
      checkoutLocked,
      setCheckoutLocked,
      drawerStep,
      preferredDate,
      setPreferredDate,
      setDrawerStep,
      validation,
      priceChanges,
      storageWarning,
      addLine,
      updateQuantity,
      removeLine,
      clearCart,
      clearPurchasedCart,
      openCart,
      closeCart,
      setDrawerOpen,
      refreshCart,
      acknowledgePriceChanges,
    }),
    [
      acknowledgePriceChanges,
      addLine,
      cart,
      clearCart,
      clearPurchasedCart,
      closeCart,
      drawerOpen,
      checkoutLocked,
      drawerStep,
      preferredDate,
      hydrated,
      openCart,
      priceChanges,
      refreshCart,
      removeLine,
      storageWarning,
      updateQuantity,
      validation,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
}
