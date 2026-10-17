import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { orderFixture, purchaseFixture } from "../fixtures/payment";
import type { OrderView } from "../../lib/payments/schema";

function orderView(): OrderView {
  const row = orderFixture();
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: "confirmed",
    paymentStatus: "paid",
    fulfillmentStatus: "received",
    version: 1,
    placedAt: "2026-09-30T15:00:00.000Z",
    updatedAt: "2026-09-30T15:00:00.000Z",
    refund: null,
    redelivery: null,
    snapshot: { ...purchaseFixture(), testOnly: false },
    events: [
      {
        id: "98000000-0000-4000-8000-000000000020",
        status: "received",
        title: "Order received",
        message:
          "Your payment was confirmed and your pastry delivery is booked.",
        occurredAt: "2026-09-30T15:00:00.000Z",
      },
    ],
  };
}
function cancelledOrder(before: OrderView): OrderView {
  return {
    ...before,
    status: "cancelled",
    paymentStatus: "refund_pending",
    version: 2,
    updatedAt: "2026-10-01T15:00:00.000Z",
    refund: {
      status: "pending",
      amountCents: 1500,
      requestedAt: "2026-10-01T15:00:00.000Z",
      updatedAt: "2026-10-01T15:00:00.000Z",
      completedAt: null,
    },
    events: [
      ...before.events,
      {
        id: "98000000-0000-4000-8000-000000000021",
        status: "cancelled",
        title: "Order cancelled",
        message:
          "Your order has been cancelled. A full refund to the original payment method has been requested.",
        occurredAt: "2026-10-01T15:00:00.000Z",
      },
    ],
  };
}
async function checkAccessibility(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-01T15:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("customer cancels once, tracks the refund, and keeps keyboard focus", async ({
  page,
}, testInfo) => {
  let order = orderView();
  const original = structuredClone(order);
  let cancellations = 0;
  await page.route(`**/api/orders/${order.id}`, (route) =>
    route.fulfill({ json: { order } }),
  );
  await page.route(`**/api/orders/${order.id}/cancel`, async (route) => {
    cancellations++;
    expect(route.request().postDataJSON()).toEqual({
      expectedVersion: 1,
      confirmed: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    order = cancelledOrder(order);
    await route.fulfill({ json: { order } });
  });
  await page.goto(`/orders/${order.id}`);
  const cancel = page.getByRole("button", {
    name: "Cancel order",
    exact: true,
  });
  await cancel.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Cancel this order?" });
  await expect(dialog).toContainText("Full refund of $15.00 CAD");
  await checkAccessibility(page);
  await page.keyboard.press("Escape");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Enter");

  if (testInfo.project.name === "chromium-desktop") {
    for (const width of [320, 360, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await expect(
        dialog.getByRole("button", { name: "Cancel & refund" }),
      ).toBeInViewport();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.screenshot({
    path: testInfo.outputPath("cancellation-confirmation.png"),
    fullPage: false,
    animations: "disabled",
  });
  const confirm = dialog.getByRole("button", { name: "Cancel & refund" });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Order cancelled", level: 1 }),
  ).toBeFocused();
  expect(cancellations).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Full refund processing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Original delivery details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Order progress" }),
  ).not.toContainText("Upcoming");

  // An older in-flight poll must never overwrite a newer cancellation result.
  const cancelled = order;
  order = original;
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(
    page.getByRole("heading", { name: "Order cancelled", level: 1 }),
  ).toBeVisible();
  order = {
    ...cancelled,
    version: 3,
    paymentStatus: "refunded",
    refund: {
      ...cancelled.refund!,
      status: "succeeded",
      completedAt: "2026-10-01T15:05:00.000Z",
    },
  };
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(
    page.getByRole("heading", { name: "Full refund issued" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Full refund issued" }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({
    path: testInfo.outputPath("cancelled-order.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("preparation starting during review blocks cancellation without losing the order", async ({
  page,
}) => {
  let order = orderView();
  await page.route(`**/api/orders/${order.id}`, (route) =>
    route.fulfill({ json: { order } }),
  );
  await page.route(`**/api/orders/${order.id}/cancel`, async (route) => {
    order = { ...order, fulfillmentStatus: "preparing", version: 2 };
    await route.fulfill({
      status: 409,
      json: {
        error: {
          message:
            "Preparation has started. This order can no longer be cancelled.",
        },
      },
    });
  });
  await page.goto(`/orders/${order.id}`);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByRole("button", { name: "Cancel & refund" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Preparation has started",
  );
  await expect(
    page.getByRole("button", { name: "Cancel & refund" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep order" }).click();
  await expect(
    page.getByRole("heading", { name: "Being prepared", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toHaveCount(0);
});

test("network failure leaves an accessible retry and does not claim success", async ({
  page,
}) => {
  const order = orderView();
  await page.route(`**/api/orders/${order.id}`, (route) =>
    route.fulfill({ json: { order } }),
  );
  await page.route(`**/api/orders/${order.id}/cancel`, (route) =>
    route.abort("failed"),
  );
  await page.goto(`/orders/${order.id}`);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByRole("button", { name: "Cancel & refund" }).click();
  const error = page.getByRole("alert");
  await expect(error).toContainText("could not confirm cancellation");
  await expect(error).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Cancel & refund" }),
  ).toBeEnabled();
  await checkAccessibility(page);
});

test("the deadline removes cancellation and failed refunds stay visibly cancelled", async ({
  page,
}) => {
  const original = orderView();
  let order = original;
  await page.clock.setFixedTime(
    new Date(original.snapshot.cancellationDeadline),
  );
  await page.route(`**/api/orders/${order.id}`, (route) =>
    route.fulfill({ json: { order } }),
  );
  await page.goto(`/orders/${order.id}`);
  await expect(
    page.getByText(
      "The cancellation deadline has passed. This order can no longer be cancelled.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toHaveCount(0);
  const cancelled = cancelledOrder(original);
  order = {
    ...cancelled,
    paymentStatus: "refund_failed",
    version: 3,
    refund: { ...cancelled.refund!, status: "failed" },
  };
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(
    page.getByRole("heading", { name: "Order cancelled", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Refund needs attention" }),
  ).toBeVisible();
  await checkAccessibility(page);
});
