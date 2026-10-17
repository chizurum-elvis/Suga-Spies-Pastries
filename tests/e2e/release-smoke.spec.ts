import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// These checks intentionally work without provider credentials. They do not
// replace connected checkout, authenticated owner, or real-device acceptance.
test("every owner section denies signed-out access without leaking workspace data", async ({
  page,
  request,
}) => {
  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/production",
    "/admin/menu",
    "/admin/availability",
    "/admin/content",
    "/admin/content/faq",
    "/admin/settings",
    "/admin/external-orders/new",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location).toMatch(/^\/admin\/login\?/);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  }
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/login\?/);
  await expect(
    page.getByRole("navigation", { name: "Admin navigation" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

test("the pastry menu, minimum quantities, and cart work without exposing browser-trusted prices", async ({
  page,
  request,
}) => {
  await page.goto("/menu/mini-cheesecakes");
  await expect(
    page.getByRole("heading", { level: 1, name: '2" Mini Cheesecake' }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add 4 to cart" }).click();
  const drawer = page.getByRole("dialog", { name: "Your pastry box" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("spinbutton")).toHaveValue("4");
  await expect(
    drawer.getByRole("button", { name: /Decrease .* quantity by 1/ }),
  ).toBeDisabled();
  await drawer
    .getByRole("button", { name: /Increase .* quantity by 1/ })
    .click();
  await expect(drawer.getByRole("spinbutton")).toHaveValue("5");
  const persisted = await page.evaluate(() =>
    localStorage.getItem("suga-spies:guest-cart"),
  );
  expect(persisted).not.toMatch(/price|subtotal|email|phone/i);
  const injected = await request.post("/api/cart/validate", {
    data: {
      version: 1,
      lines: [
        {
          productId: "20000000-0000-4000-8000-000000000001",
          variantId: null,
          optionSelections: [],
          quantity: 1,
          priceCents: 1,
        },
      ],
    },
  });
  expect(injected.status()).toBe(400);
});
