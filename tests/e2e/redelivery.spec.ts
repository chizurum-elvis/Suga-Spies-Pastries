import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { orderFixture, purchaseFixture } from "../fixtures/payment";
import type { OrderView } from "../../lib/payments/schema";

test("customer corrects a failed-delivery address without losing the order", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-01T15:00:00.000Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = orderFixture().id;
  let order: OrderView = {
    id,
    orderNumber: "SS-123456789ABC",
    status: "confirmed",
    paymentStatus: "paid",
    fulfillmentStatus: "delivery_failed",
    version: 5,
    placedAt: "2026-09-30T15:00:00.000Z",
    updatedAt: "2026-10-01T14:00:00.000Z",
    refund: null,
    snapshot: { ...purchaseFixture(), testOnly: false },
    redelivery: {
      state: "awaiting_customer",
      respondBy: "2026-10-02T14:00:00.000Z",
      requestedAddress: null,
      selectedDate: null,
      feeCents: null,
      freeReason: null,
      paymentStatus: "not_required",
      paymentExpiresAt: null,
      feeRefund: null,
    },
    events: [
      {
        id: "98000000-0000-4000-8000-000000000020",
        status: "received",
        title: "Order received",
        message: "Your pastry order is booked.",
        occurredAt: "2026-09-30T15:00:00.000Z",
      },
      {
        id: "98000000-0000-4000-8000-000000000021",
        status: "delivery_failed",
        title: "Delivery attempt missed",
        message: "Please confirm or correct your address.",
        occurredAt: "2026-10-01T14:00:00.000Z",
      },
    ],
  };
  await page.route(`**/api/orders/${id}`, (route) =>
    route.fulfill({ json: { order } }),
  );
  let requests = 0;
  await page.route(`**/api/orders/${id}/redelivery`, async (route) => {
    requests++;
    const submitted = route.request().postDataJSON();
    expect(submitted).toMatchObject({
      action: "request",
      expectedVersion: 5,
      address: {
        line1: "100 Queen Street West",
        city: "Toronto",
        postalCode: "M5H 2N1",
      },
    });
    expect(submitted).not.toHaveProperty("feeCents");
    expect(submitted).not.toHaveProperty("selectedDate");
    order = {
      ...order,
      version: 6,
      fulfillmentStatus: "redelivery_requested",
      redelivery: {
        ...order.redelivery!,
        state: "awaiting_owner",
        requestedAddress: submitted.address,
        feeCents: 500,
        paymentStatus: "pending",
      },
      events: [
        ...order.events,
        {
          id: "98000000-0000-4000-8000-000000000022",
          status: "redelivery_requested",
          title: "Redelivery requested",
          message: "The owner will choose a date.",
          occurredAt: "2026-10-01T15:01:00.000Z",
        },
      ],
    };
    await route.fulfill({ json: { order } });
  });
  await page.goto(`/orders/${id}`);
  await expect(
    page.getByRole("heading", { name: "Delivery update" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Street address" })
    .fill("100 Queen Street West");
  await page.getByRole("textbox", { name: "Postal code" }).fill("M5H 2N1");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Confirm this address" }).click();
  await expect(page.getByText("Confirmed redelivery address")).toBeVisible();
  await expect(
    page.getByText("We’ll email you when the owner selects an available date."),
  ).toBeVisible();
  expect(requests).toBe(1);
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
