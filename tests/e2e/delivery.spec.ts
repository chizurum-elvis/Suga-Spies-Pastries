import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { DeliveryState } from "../../lib/delivery/schema";

async function openDeliveryDetails(page: Page) {
  await page.goto("/menu/nine-inch-cheesecake");
  await page.getByRole("button", { name: "Add 1 to cart" }).click();
  await page
    .getByRole("button", { name: "Choose delivery date", exact: true })
    .click();
  await expect(page).toHaveURL(/\/menu\/nine-inch-cheesecake$/);
  const calendar = page.getByRole("grid", { name: /availability/i });
  await calendar.locator('button[aria-label$="Available"]').first().click();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByLabel(/^Full name/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save and check delivery" }),
  ).toBeEnabled();
}
async function fillAddress(page: Page) {
  await page.getByLabel(/^Full name/).fill("Checkout Test");
  await page.getByLabel(/^Email address/).fill("checkout-test@example.com");
  await page.getByLabel(/^Canadian phone number/).fill("4165550100");
  await page.getByLabel(/^Recipient name/).fill("Delivery Test");
  await page.getByLabel(/^Street address/).fill("123 Test Street");
  await page.getByRole("combobox", { name: /^City/ }).selectOption("Toronto");
  await page.getByLabel(/^Postal code/).fill("M5V3L9");
}
async function accessible(page: Page) {
  // Audit the settled page, not the intermediate opacity of a departing toast.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10_000,
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test("delivery details survive provider failure and refresh without exposing private data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openDeliveryDetails(page);
  await page.getByRole("button", { name: "Save and check delivery" }).click();
  await expect(page.locator("main").getByRole("alert")).toBeFocused();
  await expect(page.getByLabel(/^Full name/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await accessible(page);
  await fillAddress(page);
  await expect(page.getByLabel("Country calling code")).toHaveValue("+1");
  await expect(page.locator("#delivery-province")).toHaveValue("ON");
  await expect(page.locator("#delivery-country")).toHaveValue("CA");
  await expect(page.locator("#delivery-province option")).toHaveCount(1);
  await expect(page.locator("#delivery-country option")).toHaveCount(1);
  await page.getByLabel(/^Canadian phone number/).fill("+44 20 7183 8750");
  await page.getByRole("button", { name: "Save and check delivery" }).click();
  await expect(page.locator("#delivery-phone-error")).toContainText(
    "valid 10-digit Canadian phone number",
  );
  await expect(page.getByLabel(/^Canadian phone number/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel(/^Canadian phone number/).fill("4165550100");
  // Stub only the external-service outcome; save and reload use the real API/database.
  await page.route("**/api/checkout/delivery?action=quote", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "provider_unavailable",
          message:
            "We could not check this address just now. Your details are saved. Please retry.",
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Save and check delivery" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Your details are saved",
  );
  await page.reload();
  await expect(page.getByLabel(/^Full name/)).toHaveValue("Checkout Test");
  await expect(page.getByLabel(/^Street address/)).toHaveValue(
    "123 Test Street",
  );
  await expect(page.getByLabel(/^Postal code/)).toHaveValue("M5V 3L9");
  const response = await page.request.get("/api/checkout/delivery");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toMatch(
    /M1W|origin_address|access_token_hash|distanceMeters/,
  );
  const persisted = await page.evaluate(() => JSON.stringify(localStorage));
  expect(persisted).not.toMatch(
    /checkout-test@example|123 Test Street|4165550100/,
  );
  await expect(page.locator("body")).not.toContainText(/pickup/i);
  await accessible(page);
  expect(errors).toEqual([]);
});

test("customer reviews the address and fee, and editing invalidates the displayed quote", async ({
  page,
}, testInfo) => {
  await openDeliveryDetails(page);
  await fillAddress(page);
  let quoted: DeliveryState | null = null;
  let checks = 0;
  await page.route("**/api/checkout/delivery?action=quote", async (route) => {
    checks += 1;
    const saved = await page.request.get("/api/checkout/delivery");
    const { delivery } = (await saved.json()) as { delivery: DeliveryState };
    quoted = {
      ...delivery,
      version: delivery.version + 1,
      status: "quoted",
      quote: {
        id: "98000000-0000-4000-8000-000000000001",
        address: {
          line1: "123 Test St",
          line2: "",
          city: "Toronto",
          postalCode: "M5V 3L9",
          province: "ON",
          country: "CA",
        },
        requiresConfirmation: true,
        settingsVersion: 1,
        subtotalCents: 4000,
        feeCents: 575,
        freeDelivery: false,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    };
    await route.fulfill({ json: { delivery: quoted } });
  });
  await page.route("**/api/checkout/delivery?action=confirm", async (route) => {
    await route.fulfill({
      json: {
        delivery: {
          ...quoted,
          version: quoted!.version + 1,
          status: "confirmed",
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Save and check delivery" })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(
    page.getByRole("heading", { name: "Review your delivery address" }),
  ).toBeVisible();
  expect(checks).toBe(1);
  await expect(page.getByText("$5.75", { exact: true })).toBeVisible();
  await expect(page.getByText("$45.75", { exact: true })).toBeVisible();
  await expect(page.locator("aside")).toHaveCSS("position", "static");
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath("delivery-review.png"),
    fullPage: true,
  });
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
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
  }
  const confirm = page.getByRole("button", {
    name: "Confirm address and delivery fee",
  });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Delivery details confirmed" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "your order has not been placed" }),
  ).toBeVisible();
  await page.getByLabel(/^Street address/).fill("456 Changed Street");
  await expect(
    page.getByRole("heading", { name: "Delivery details confirmed" }),
  ).toHaveCount(0);
  await expect(page.getByText("$45.75", { exact: true })).toHaveCount(0);
});

test("delivery API protects cookie ownership, rejects injected fees, and serializes tab edits", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/checkout/delivery")).status()).toBe(401);
  expect(
    (
      await request.put("/api/checkout/delivery", {
        headers: { origin: "https://attacker.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(
        "/api/fulfillment/availability?method=pickup&month=2026-09",
      )
    ).status(),
  ).toBe(400);
  await openDeliveryDetails(page);
  const stateResponse = await page.request.get("/api/checkout/delivery");
  const { delivery } = (await stateResponse.json()) as {
    delivery: DeliveryState;
  };
  const body = {
    cart: delivery.cart,
    draftVersion: delivery.draftVersion,
    version: delivery.version,
    input: {
      name: "API Test",
      recipientName: "API Recipient",
      email: "api-test@example.com",
      phone: "4165550100",
      instructions: "",
      address: {
        line1: "123 Test Street",
        line2: "",
        city: "Toronto",
        province: "ON",
        country: "CA",
        postalCode: "M5V3L9",
      },
    },
  };
  const headers = {
    origin: new URL(page.url()).origin,
    "sec-fetch-site": "same-origin",
  };
  expect(
    (
      await page.request.put("/api/checkout/delivery", {
        headers,
        data: { ...body, feeCents: 0 },
      })
    ).status(),
  ).toBe(400);
  for (const input of [
    { ...body.input, phone: "+12133734253" },
    {
      ...body.input,
      address: { ...body.input.address, province: "BC" },
    },
    {
      ...body.input,
      address: { ...body.input.address, country: "US" },
    },
  ])
    expect(
      (
        await page.request.put("/api/checkout/delivery", {
          headers,
          data: { ...body, input },
        })
      ).status(),
    ).toBe(400);
  const writes = await Promise.all([
    page.request.put("/api/checkout/delivery", { headers, data: body }),
    page.request.put("/api/checkout/delivery", {
      headers,
      data: { ...body, input: { ...body.input, name: "Second tab" } },
    }),
  ]);
  expect(writes.map((r) => r.status()).sort()).toEqual([200, 409]);
  const fresh = (await (
    await page.request.get("/api/checkout/delivery")
  ).json()) as { delivery: DeliveryState };
  expect(
    (
      await page.request.post("/api/checkout/delivery?action=confirm", {
        headers,
        data: {
          cart: fresh.delivery.cart,
          version: fresh.delivery.version,
          draftVersion: fresh.delivery.draftVersion,
        },
      })
    ).status(),
  ).toBe(409);
});
