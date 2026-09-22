import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { AvailabilityMonth } from "../../lib/fulfillment/types";
import type { ValidatedCart } from "../../lib/cart/types";

async function addPastry(page: Page) {
  await page.goto("/menu/nine-inch-cheesecake");
  await page
    .getByRole("button", { name: "Add 1 to cart", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your pastry box" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose delivery date", exact: true }),
  ).toBeEnabled();
}

test("drawer keeps focus, quantities and dates on the product page", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await addPastry(page);
  const drawer = page.getByRole("dialog", { name: "Your pastry box" });
  const increase = drawer.getByRole("button", {
    name: 'Increase 9" Cheesecake quantity by 1',
  });
  await increase.focus();
  await increase.press("Enter");
  await expect(drawer.getByRole("spinbutton")).toHaveValue("2");
  await expect(increase).toBeFocused();
  await expect(drawer.getByText("2 × $40.00", { exact: true })).toBeVisible();
  await drawer
    .getByRole("button", { name: "Choose delivery date", exact: true })
    .click();
  const calendar = drawer.getByRole("grid");
  await calendar.locator('button[aria-label$="Available"]').first().click();
  const selected = await calendar
    .locator('[aria-pressed="true"]')
    .getAttribute("data-date");
  await drawer
    .getByRole("button", { name: "Your pastries", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Delivery date", exact: true })
    .click();
  await expect(calendar.locator(`[data-date="${selected}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(/\/menu\/nine-inch-cheesecake$/);

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  const trigger = page.getByRole("button", { name: "Open cart, 2 items" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    ),
  ).toBe(true);

  if (testInfo.project.name === "chromium-desktop") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 700 });
      const box = await drawer.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x + box!.width - width)).toBeLessThan(2);
      expect(box!.width).toBeLessThanOrEqual(544);
      expect(
        await drawer.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await expect(
        drawer.getByRole("button", {
          name: "Choose delivery date",
          exact: true,
        }),
      ).toBeInViewport();
    }
    await page.setViewportSize({ width: 320, height: 568 });
  }
  await drawer
    .getByRole("button", { name: "Choose delivery date", exact: true })
    .click();
  await expect(calendar).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Continue to checkout" }),
  ).toBeInViewport();
  expect(
    await drawer.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("delivery-drawer.png"),
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("date context failure offers a retry without losing the cart", async ({
  page,
}) => {
  await addPastry(page);
  let fail = true;
  await page.route("**/api/checkout/fulfillment", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { message: "Unavailable" } },
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Choose delivery date", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "We could not load your delivery date",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page
    .getByRole("button", { name: "Your pastries", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("1 × $40.00", { exact: true }),
  ).toBeVisible();
});

test("a full-date race stays in the drawer and requires another available date", async ({
  page,
}) => {
  await addPastry(page);
  let unavailableDate: string | null = null;
  let failAvailability = true;
  await page.route("**/api/fulfillment/availability?*", async (route) => {
    if (failAvailability)
      return route.fulfill({
        status: 503,
        json: { error: { message: "Please retry availability." } },
      });
    const response = await route.fetch();
    const month: AvailabilityMonth = await response.json();
    if (unavailableDate)
      month.days = month.days.map((day) =>
        day.date === unavailableDate
          ? {
              ...day,
              selectable: false,
              reason: {
                code: "fully_booked",
                message: "This date is fully booked.",
              },
            }
          : day,
      );
    await route.fulfill({ response, json: month });
  });
  await page.route("**/api/checkout/fulfillment", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    unavailableDate = route.request().postDataJSON().date;
    await route.fulfill({
      status: 409,
      json: {
        error: { code: "fully_booked", message: "This date is fully booked." },
      },
    });
  });
  await page
    .getByRole("button", { name: "Choose delivery date", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Availability could not be refreshed",
  );
  const next = page.getByRole("button", { name: "Continue to checkout" });
  await expect(next).toBeDisabled();
  failAvailability = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const calendar = page.getByRole("grid");
  const date = calendar.locator('button[aria-label$="Available"]').first();
  const value = await date.getAttribute("data-date");
  await date.click();
  await next.click();
  await expect(page.getByRole("alert")).toContainText("fully booked");
  await expect(calendar.locator(`[data-date="${value}"]`)).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(next).toBeDisabled();
  await calendar.locator('button[aria-label$="Available"]').first().click();
  await expect(next).toBeEnabled();
  await expect(page).toHaveURL(/\/menu\/nine-inch-cheesecake$/);
});

test("failed initial cart validation is recoverable instead of an endless skeleton", async ({
  page,
}) => {
  await addPastry(page);
  await page.getByRole("button", { name: "Close cart" }).click();
  let fail = true;
  await page.route("**/api/cart/validate", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { message: "Please retry the menu." } },
        })
      : route.continue(),
  );
  await page.reload();
  await page.getByRole("button", { name: "Open cart, 1 item" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "We could not refresh your cart",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry menu check" }).click();
  await expect(
    page.getByRole("button", { name: "Choose delivery date", exact: true }),
  ).toBeEnabled();
});

test("price changes require review and an unavailable item cannot proceed", async ({
  page,
}) => {
  await addPastry(page);
  await page.getByRole("button", { name: "Close cart" }).click();
  let unavailable = false;
  await page.route("**/api/cart/validate", async (route) => {
    const response = await route.fetch();
    const data: ValidatedCart = await response.json();
    data.lines = data.lines.map((line) => ({
      ...line,
      unitPriceCents: 4100,
      baseUnitPriceCents: 4100,
      lineSubtotalCents: 4100 * line.quantity,
      pricingFingerprint: "base=4100",
      ...(unavailable
        ? {
            status: "blocked" as const,
            issues: [
              {
                code: "product_unavailable" as const,
                message: "This pastry is unavailable.",
              },
            ],
          }
        : {}),
    }));
    data.subtotalCents = unavailable ? null : 4100;
    data.status = unavailable ? "blocked" : "ready";
    await route.fulfill({ response, json: data });
  });
  await page.getByRole("button", { name: "Open cart, 1 item" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "current menu price changed",
  );
  await expect(
    page.getByRole("button", { name: "Review the price update" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "I’ve reviewed the update" }).click();
  await expect(
    page.getByRole("button", { name: "Choose delivery date", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close cart" }).click();
  unavailable = true;
  await page.getByRole("button", { name: "Open cart, 1 item" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "This pastry is unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Review your cart above" }),
  ).toBeDisabled();
});
