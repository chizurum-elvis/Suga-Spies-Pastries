import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider, useCart } from "@/components/cart/cart-provider";
import type { CatalogueProduct } from "@/lib/catalog/types";
import { configureProductLine } from "@/lib/cart/configuration";
import { reconcileCart } from "@/lib/cart/reconcile";
import { CART_SCHEMA_VERSION, CART_STORAGE_KEY } from "@/lib/cart/types";

const productId = "20000000-0000-4000-8000-000000000001";

function currentProduct(price = 400): CatalogueProduct {
  return {
    id: productId,
    category: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Sweet bakes",
      slug: "sweet-bakes",
    },
    name: "Muffin",
    slug: "muffins",
    shortDescription: null,
    description: null,
    basePriceCents: price,
    currency: "CAD",
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    images: [],
    variants: [],
    optionGroups: [],
  };
}

function Probe() {
  const [lastAddResult, setLastAddResult] = useState("idle");
  const {
    acknowledgePriceChanges,
    addLine,
    hydrated,
    itemCount,
    priceChanges,
    refreshCart,
    validation,
  } = useCart();
  const product = currentProduct(400);
  const configured = configureProductLine(product, {
    variantId: null,
    optionSelections: [],
    quantity: 4,
  });

  return (
    <div>
      <output aria-label="hydrated">{String(hydrated)}</output>
      <output aria-label="item count">{itemCount}</output>
      <output aria-label="validation status">{validation.status}</output>
      <output aria-label="price changes">{priceChanges.length}</output>
      <output aria-label="last add result">{lastAddResult}</output>
      <button
        onClick={() =>
          void addLine({
            line: configured.line,
            maximumQuantity: null,
            productName: product.name,
            expectation: {
              pricingFingerprint: configured.pricingFingerprint!,
              lineSubtotalCents: configured.lineSubtotalCents!,
            },
          }).then((added) => setLastAddResult(added ? "added" : "rejected"))
        }
      >
        Add muffin
      </button>
      <button onClick={refreshCart}>Refresh cart</button>
      <button onClick={acknowledgePriceChanges}>Acknowledge changes</button>
    </div>
  );
}

describe("CartProvider", () => {
  let cataloguePrice = 400;
  let catalogueAvailable = true;

  beforeEach(() => {
    window.localStorage.clear();
    cataloguePrice = 400;
    catalogueAvailable = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const raw = JSON.parse(String(init?.body));
        return {
          ok: true,
          json: async () =>
            reconcileCart(raw, [
              {
                ...currentProduct(cataloguePrice),
                isAvailable: catalogueAvailable,
              },
            ]),
        } as Response;
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("hydrates, persists only the raw cart, and adopts another tab's cart", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("hydrated")).toHaveTextContent("true"),
    );
    await user.click(screen.getByRole("button", { name: "Add muffin" }));
    await waitFor(() =>
      expect(screen.getByLabelText("item count")).toHaveTextContent("4"),
    );

    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual({
      version: 1,
      lines: [
        {
          productId,
          variantId: null,
          optionSelections: [],
          quantity: 4,
        },
      ],
    });
    expect(stored).not.toMatch(/price|subtotal|Muffin/i);

    const otherTabCart = JSON.stringify({
      version: CART_SCHEMA_VERSION,
      lines: [
        {
          productId,
          variantId: null,
          optionSelections: [],
          quantity: 7,
        },
      ],
    });
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CART_STORAGE_KEY,
        newValue: otherTabCart,
      }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("item count")).toHaveTextContent("7"),
    );
  });

  it("detects a price change, uses the new total, and requires acknowledgement", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("hydrated")).toHaveTextContent("true"),
    );
    await user.click(screen.getByRole("button", { name: "Add muffin" }));
    await waitFor(() =>
      expect(screen.getByLabelText("validation status")).toHaveTextContent(
        "ready",
      ),
    );
    expect(screen.getByLabelText("price changes")).toHaveTextContent("0");

    cataloguePrice = 500;
    await user.click(screen.getByRole("button", { name: "Refresh cart" }));
    await waitFor(() =>
      expect(screen.getByLabelText("price changes")).toHaveTextContent("1"),
    );
    await user.click(
      screen.getByRole("button", { name: "Acknowledge changes" }),
    );
    expect(screen.getByLabelText("price changes")).toHaveTextContent("0");
  });

  it("does not persist a product that fresh server validation rejects", async () => {
    const user = userEvent.setup();
    catalogueAvailable = false;
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("hydrated")).toHaveTextContent("true"),
    );
    await user.click(screen.getByRole("button", { name: "Add muffin" }));
    await waitFor(() =>
      expect(screen.getByLabelText("last add result")).toHaveTextContent(
        "rejected",
      ),
    );

    expect(screen.getByLabelText("item count")).toHaveTextContent("0");
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });
});
