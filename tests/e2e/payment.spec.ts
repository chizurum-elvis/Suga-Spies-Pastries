import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  attemptFixture,
  orderFixture,
  purchaseFixture,
} from "../fixtures/payment";
import type { PurchaseSnapshot } from "../../lib/payments/schema";
import type { DeliveryState } from "../../lib/delivery/schema";

const CART_KEY = "suga-spies:guest-cart";

function confirmedDelivery(snapshot: PurchaseSnapshot): DeliveryState {
  return {
    cart: snapshot.cart,
    draftVersion: 1,
    version: 3,
    input: snapshot.delivery,
    status: "confirmed",
    dateLabel: "Monday, October 12, 2026",
    quote: {
      id: "98000000-0000-4000-8000-000000000011",
      address: snapshot.delivery.address,
      requiresConfirmation: false,
      settingsVersion: 1,
      subtotalCents: snapshot.subtotalCents,
      feeCents: snapshot.deliveryCents,
      freeDelivery: snapshot.deliveryCents === 0,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    },
  };
}

async function mockConfirmedDelivery(
  page: import("@playwright/test").Page,
  snapshot: PurchaseSnapshot,
) {
  await page.route("**/api/checkout/delivery", (route) =>
    route.fulfill({ json: { delivery: confirmedDelivery(snapshot) } }),
  );
}

async function mockCartValidation(
  page: import("@playwright/test").Page,
  snapshot: PurchaseSnapshot,
) {
  await page.route("**/api/cart/validate", (route) =>
    route.fulfill({ json: snapshot.validatedCart }),
  );
}

async function saveDeliveryDate(
  page: import("@playwright/test").Page,
  snapshot: PurchaseSnapshot,
) {
  await page.goto("/");
  const response = await page.request.post("/api/checkout/fulfillment", {
    headers: {
      origin: new URL(page.url()).origin,
      "sec-fetch-site": "same-origin",
    },
    data: {
      cart: snapshot.cart,
      method: "delivery",
      date: snapshot.fulfillmentDate,
    },
  });
  expect(response.status()).toBe(200);
}

async function hasNoSeriousAccessibilityViolations(
  page: import("@playwright/test").Page,
) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
}

test("wallet review is pastry-focused, responsive, and submission-safe", async ({
  page,
}, testInfo) => {
  const snapshot = purchaseFixture();
  await page.addInitScript(
    ([key, cart]) => localStorage.setItem(key, JSON.stringify(cart)),
    [CART_KEY, snapshot.cart] as const,
  );
  await saveDeliveryDate(page, snapshot);
  await mockCartValidation(page, snapshot);
  await mockConfirmedDelivery(page, snapshot);
  let starts = 0;
  await page.route("**/api/checkout/payment", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          review: {
            snapshot,
            reviewToken: "a".repeat(64),
            blockers: [],
            policies: null,
            attempt: null,
          },
        },
      });
      return;
    }
    starts += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 503,
      json: {
        error: {
          message: "The sandbox provider is intentionally unavailable.",
        },
      },
    });
  });
  await page.goto("/checkout/payment");
  await expect(
    page.getByRole("heading", { name: "Complete your order" }),
  ).toBeVisible();
  const contactInput = page.getByLabel(/^Full name/);
  await expect(contactInput).toBeVisible();
  const controlStyle = await contactInput.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    family: getComputedStyle(element).fontFamily,
  }));
  expect(controlStyle.height).toBeGreaterThanOrEqual(44);
  expect(controlStyle.height).toBeLessThanOrEqual(48);
  expect(controlStyle.family).toContain("Lato");
  if (testInfo.project.name === "webkit-mobile")
    expect(controlStyle.fontSize).toBeGreaterThanOrEqual(16);
  await page.screenshot({
    path: testInfo.outputPath("compact-checkout.png"),
    animations: "disabled",
  });
  if (testInfo.project.name === "webkit-mobile")
    await page.locator("summary").click();
  const summary = page.locator("[data-checkout-order-summary]:visible");
  await expect(summary.getByText("Chocolate Chip Cookies")).toBeVisible();
  await expect(summary.getByText("4 × $2.50", { exact: true })).toBeVisible();
  await expect(summary.getByText("$15.00", { exact: true })).toBeVisible();
  const submit = page.getByRole("button", {
    name: "Continue to secure payment",
  });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox").check();
  await submit.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(
    page.getByText("The sandbox provider is intentionally unavailable."),
  ).toBeVisible();
  expect(starts).toBe(1);
  await expect(summary).toHaveCSS("position", "static");
  await hasNoSeriousAccessibilityViolations(page);
  if (testInfo.project.name === "chromium-desktop") {
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }
});

test("a changed local cart blocks payment and sends the customer back for review", async ({
  page,
}) => {
  const snapshot = purchaseFixture();
  await page.addInitScript(
    ([key, cart]) => localStorage.setItem(key, JSON.stringify(cart)),
    [
      CART_KEY,
      { ...snapshot.cart, lines: [{ ...snapshot.cart.lines[0], quantity: 5 }] },
    ] as const,
  );
  await saveDeliveryDate(page, snapshot);
  await mockCartValidation(page, snapshot);
  await mockConfirmedDelivery(page, snapshot);
  await page.route("**/api/checkout/payment", (route) =>
    route.fulfill({
      json: {
        review: {
          snapshot,
          reviewToken: "a".repeat(64),
          blockers: [],
          policies: null,
          attempt: null,
        },
      },
    }),
  );
  await page.goto("/checkout/payment");
  await expect(page.getByText(/Your pastry box changed/).first()).toBeVisible();
  await page.getByRole("button", { name: "Review cart", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Your pastry box" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close cart" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm delivery before payment" }),
  ).toBeVisible();
});

test("an active payment locks drawer editing and preserves its purchase summary across cart refreshes", async ({
  page,
}, testInfo) => {
  const snapshot = purchaseFixture();
  const attempt = {
    id: attemptFixture().id,
    status: "open",
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    orderId: null,
    clientSecret: null,
    snapshot,
  };
  await page.addInitScript(
    ([key, cart]) => localStorage.setItem(key, JSON.stringify(cart)),
    [CART_KEY, snapshot.cart] as const,
  );
  await saveDeliveryDate(page, snapshot);
  await mockCartValidation(page, snapshot);
  await mockConfirmedDelivery(page, snapshot);
  await page.route("**/api/checkout/payment", (route) =>
    route.fulfill({
      json: {
        review: {
          snapshot,
          reviewToken: "a".repeat(64),
          blockers: [],
          policies: null,
          attempt,
        },
      },
    }),
  );
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Pay securely" }),
  ).toBeVisible();
  if (testInfo.project.name === "webkit-mobile")
    await page.locator("summary").click();
  await expect(
    page.getByRole("button", { name: "Return to cart" }),
  ).toBeDisabled();
  const summary = page.locator("[data-checkout-order-summary]:visible");
  await expect(
    summary.getByRole("button", { name: "Edit cart" }),
  ).toBeDisabled();
  await expect(
    summary.getByRole("button", { name: "Change date" }),
  ).toBeDisabled();
  await page.evaluate((key) => {
    const oldValue = localStorage.getItem(key);
    const newValue = JSON.stringify({ version: 1, lines: [] });
    localStorage.setItem(key, newValue);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        oldValue,
        newValue,
        storageArea: localStorage,
      }),
    );
  }, CART_KEY);
  await expect(summary.getByText("4 × $2.50", { exact: true })).toBeVisible();
  await expect(summary.getByText("$15.00", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop payment and edit order" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Return to cart" }),
  ).toBeDisabled();
});

test("provider-confirmed order replaces processing, renders securely, and clears only its cart", async ({
  page,
}) => {
  const order = orderFixture();
  const snapshot = purchaseFixture();
  const attemptRow = attemptFixture();
  const attempt = {
    id: attemptRow.id,
    status: "paid" as const,
    expiresAt: attemptRow.expires_at,
    orderId: order.id,
    clientSecret: null,
    snapshot,
  };
  await page.addInitScript(
    ([key, cart]) => localStorage.setItem(key, JSON.stringify(cart)),
    [CART_KEY, snapshot.cart] as const,
  );
  await page.route("**/api/checkout/payment/status", (route) =>
    route.fulfill({ json: { attempt } }),
  );
  await page.route(`**/api/orders/${order.id}`, (route) =>
    route.fulfill({
      json: {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          placedAt: order.created_at,
          updatedAt: order.updated_at,
          version: order.version,
          status: order.status,
          paymentStatus: order.payment_status,
          fulfillmentStatus: order.fulfillment_status,
          events: [
            {
              id: "98000000-0000-4000-8000-000000000020",
              status: "received",
              title: "Order received",
              message:
                "Your payment was confirmed and your pastry delivery is booked.",
              occurredAt: order.created_at,
            },
          ],
          snapshot,
        },
      },
    }),
  );
  await page.goto("/checkout/confirmation");
  await page.waitForURL(`**/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: "Test order" })).toBeVisible();
  await expect(
    page.getByText(order.order_number, { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Development test order")).toBeVisible();
  await expect(page).toHaveTitle("Your pastry order | Suga & Spies");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), CART_KEY))
    .toBe(JSON.stringify({ version: 1, lines: [] }));
  await hasNoSeriousAccessibilityViolations(page);
});

test("customer tracking refreshes forward without exposing its access token", async ({
  page,
}, testInfo) => {
  const row = orderFixture();
  const snapshot = { ...purchaseFixture(), testOnly: false };
  const receivedAt = "2026-10-01T15:00:00.000Z";
  const preparingAt = "2026-10-01T15:20:00.000Z";
  let reads = 0;

  await page.route(`**/api/orders/${row.id}`, (route) => {
    reads += 1;
    const preparing = reads > 1;
    route.fulfill({
      json: {
        order: {
          id: row.id,
          orderNumber: row.order_number,
          placedAt: receivedAt,
          updatedAt: preparing ? preparingAt : receivedAt,
          version: preparing ? 2 : 1,
          status: "confirmed",
          paymentStatus: "paid",
          fulfillmentStatus: preparing ? "preparing" : "received",
          events: [
            {
              id: "98000000-0000-4000-8000-000000000020",
              status: "received",
              title: "Order received",
              message:
                "Your payment was confirmed and your pastry delivery is booked.",
              occurredAt: receivedAt,
            },
            ...(preparing
              ? [
                  {
                    id: "98000000-0000-4000-8000-000000000021",
                    status: "preparing",
                    title: "Being prepared",
                    message:
                      "Your pastries are now being prepared for your delivery.",
                    occurredAt: preparingAt,
                  },
                ]
              : []),
          ],
          snapshot,
        },
      },
    });
  });

  await page.goto(`/orders/${row.id}#access=${"a".repeat(64)}`);
  await expect(
    page.getByRole("heading", { name: "Order received", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/orders/${row.id}$`));
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(
    page.getByRole("heading", { name: "Being prepared", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Next: Ready for delivery.")).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText(
    "Being prepared",
  );
  await page.screenshot({
    path: testInfo.outputPath("customer-order-tracking.png"),
    animations: "disabled",
    fullPage: true,
  });
  await hasNoSeriousAccessibilityViolations(page);

  if (testInfo.project.name === "chromium-desktop") {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }
});
