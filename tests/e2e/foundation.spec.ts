import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const nextImageAndScrollWarnings = [
  /detected as the Largest Contentful Paint \(LCP\)/,
  /Detected `scroll-behavior: smooth`/,
  /has "fill" and parent element with invalid "position"/,
];

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      nextImageAndScrollWarnings.some((warning) => warning.test(message.text()))
    ) {
      errors.push(message.text());
    }
  });

  return errors;
}

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );

  expect(seriousViolations).toEqual([]);
}

async function loadLazyImagesForVisualReview(page: Page) {
  const viewportHeight = page.viewportSize()?.height ?? 800;
  const pageHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );

  for (let y = 0; y < pageHeight; y += Math.floor(viewportHeight * 0.75)) {
    await page.evaluate((scrollTop) => window.scrollTo(0, scrollTop), y);
    await page.waitForTimeout(40);
  }

  await page.waitForFunction(() =>
    Array.from(document.images).every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("storefront foundation is truthful, navigable, and accessible", async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Welcome to Suga & Spies Pastries.",
    }),
  ).toBeVisible();
  await expect(
    page
      .locator("#main-content")
      .getByText(/online checkout is not accepting orders yet/i),
  ).toBeVisible();
  await expect(
    page
      .locator("#main-content")
      .getByText(/your pastries, delivered with care/i),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Our pastry menu" }),
  ).toBeVisible();
  await expect(
    page.locator("#menu").getByText("Browse by category", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("#menu").getByText(/prices are shown in canadian dollars/i),
  ).toHaveCount(0);
  await expect(
    page
      .locator("#main-content figure")
      .getByAltText("Red velvet cookies", { exact: true }),
  ).toHaveAttribute("loading", "eager");
  await expect(
    page
      .locator('#main-content [data-product-slug="red-velvet-cookies"]')
      .getByAltText("Red velvet cookies with white chocolate chips"),
  ).toHaveAttribute("loading", "eager");
  await expect(page.locator("html")).toHaveAttribute(
    "data-scroll-behavior",
    "smooth",
  );
  await expect(page.getByRole("link", { name: "View cookie" })).toHaveAttribute(
    "href",
    "/menu/red-velvet-cookies",
  );
  await expect(page.getByRole("link", { name: "Plan your order" })).toHaveCount(
    0,
  );
  await expect(page.getByText(/start with a favourite/i)).toHaveCount(0);
  await expect(page.getByText(/reference photography/i)).toHaveCount(0);
  await expect(page.getByText(/owner photos coming/i)).toHaveCount(0);
  await expect(page.getByText("Order ahead", { exact: true })).toHaveCount(0);
  await expect(
    page.locator('a[aria-label="Suga and Spies home"] img').first(),
  ).toHaveAttribute("src", /suga-and-spies-logo/);
  await expect(
    page.getByText(
      /cheesecakes, cookies, tarts, muffins, pies, and sausage rolls planned/i,
    ),
  ).toHaveCount(0);
  await expect(page.locator("#full-menu [data-product-slug]")).toHaveCount(10);
  expect(
    await page
      .locator("#menu")
      .evaluate((menu) =>
        menu.previousElementSibling?.querySelector("h1")?.textContent?.trim(),
      ),
  ).toBe("Welcome to Suga & Spies Pastries.");

  const exploreMenu = page.getByRole("link", { name: "Explore the menu" });
  await expect(exploreMenu).toHaveAttribute("href", "#menu");
  await exploreMenu.click();
  await expect(page.locator("#menu")).toBeInViewport();

  await expectNoSeriousAccessibilityViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test("storefront menu is two-up on mobile and three-up on desktop", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Responsive catalogue geometry runs once in Chromium",
  );

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Our pastry menu" }),
  ).toBeVisible();

  const cards = page.locator("#sweet-bakes [data-product-slug]");
  const mobileBoxes = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
    cards.nth(2).boundingBox(),
  ]);

  expect(mobileBoxes.every(Boolean)).toBe(true);
  expect(Math.abs(mobileBoxes[0]!.y - mobileBoxes[1]!.y)).toBeLessThan(2);
  expect(mobileBoxes[2]!.y).toBeGreaterThan(mobileBoxes[0]!.y);

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopBoxes = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
    cards.nth(2).boundingBox(),
    cards.nth(3).boundingBox(),
  ]);

  expect(desktopBoxes.every(Boolean)).toBe(true);
  expect(Math.abs(desktopBoxes[0]!.y - desktopBoxes[1]!.y)).toBeLessThan(2);
  expect(Math.abs(desktopBoxes[0]!.y - desktopBoxes[2]!.y)).toBeLessThan(2);
  expect(desktopBoxes[3]!.y).toBeGreaterThan(desktopBoxes[0]!.y);
});

test("catalogue cards open a complete product detail page", async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/menu");

  await expect(
    page.getByRole("heading", { level: 1, name: "The pastry menu" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Menu categories" })
      .getByText("Browse by category", { exact: true }),
  ).toBeVisible();
  const cheesecake = page.locator(
    '#main-content [data-product-slug="nine-inch-cheesecake"]',
  );
  await expect(cheesecake).toHaveAttribute(
    "href",
    "/menu/nine-inch-cheesecake",
  );
  await expect(
    cheesecake.getByAltText("Berry-topped cheesecake"),
  ).toHaveAttribute("loading", "eager");
  await cheesecake.click();

  await expect(page).toHaveURL(/\/menu\/nine-inch-cheesecake$/);
  await expect(
    page.getByRole("heading", { level: 1, name: '9" Cheesecake' }),
  ).toBeVisible();
  const productHeroImage = page
    .locator("[data-product-hero]")
    .getByAltText("Berry-topped cheesecake");
  await expect(productHeroImage).toHaveAttribute("loading", "eager");
  expect(
    await productHeroImage.evaluate((image) =>
      image.parentElement
        ? window.getComputedStyle(image.parentElement).position
        : null,
    ),
  ).toBe("relative");
  await expect(page.getByText("Minimum 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add 1 to cart" }),
  ).toBeEnabled();

  const quantity = page.getByRole("spinbutton", { name: "Quantity" });
  await page.getByRole("button", { name: "Increase quantity by 1" }).click();
  await expect(quantity).toHaveValue("2");
  await page.getByRole("button", { name: "Decrease quantity by 1" }).click();
  await expect(
    page.getByRole("button", { name: "Decrease quantity by 1" }),
  ).toBeDisabled();

  await expectNoSeriousAccessibilityViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test("menu pricing separates unit price from the minimum order total", async ({
  page,
}) => {
  await page.goto("/menu/mini-cheesecakes");

  await expect(
    page.getByRole("heading", { level: 1, name: '2" Mini Cheesecake' }),
  ).toBeVisible();
  await expect(
    page.getByText("$18.00 for 4", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator("#main-content").getByText("$4.50 each", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#main-content")
      .getByText("Minimum 4 · then add 1 at a time", { exact: true }),
  ).toBeVisible();
});

test("a guest can configure, persist, edit, and remove server-priced cart lines", async ({
  page,
}, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/menu/nine-inch-cheesecake");

  await page.getByRole("button", { name: "Add 1 to cart" }).click();
  const drawer = page.getByRole("dialog", { name: "Your pastry box" });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByText(/1 item · baked for your delivery/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close cart" }).click();
  await expect(
    page.getByRole("button", { name: "Open cart, 1 item" }),
  ).toBeVisible();

  await page.goto("/menu/mini-cheesecakes");
  await page.getByRole("button", { name: "Add 4 to cart" }).click();
  await expect(
    drawer.getByText(/5 items · baked for your delivery/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close cart" }).click();
  await expect(
    page.getByRole("button", { name: "Open cart, 5 items" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open cart, 5 items" }).click();
  await expect(page).toHaveURL(/\/menu\/mini-cheesecakes$/);
  await expect(page.getByText("$58.00", { exact: true })).toBeVisible();

  await page
    .getByRole("button", {
      name: 'Increase 9" Cheesecake quantity by 1',
    })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: '9" Cheesecake quantity' }),
  ).toHaveValue("2");
  await expect(page.getByText("$98.00", { exact: true })).toBeVisible();

  const storedCart = await page.evaluate(() =>
    window.localStorage.getItem("suga-spies:guest-cart"),
  );
  expect(storedCart).not.toMatch(/price|subtotal|cheesecake/i);

  await page.reload();
  await page.getByRole("button", { name: "Open cart, 6 items" }).click();
  await expect(
    page.getByRole("spinbutton", { name: '9" Cheesecake quantity' }),
  ).toHaveValue("2");
  await expect(page.getByText("$98.00", { exact: true })).toBeVisible();

  const miniLine = page.getByRole("listitem").filter({
    has: page.getByRole("link", { name: '2" Mini Cheesecake' }),
  });
  await miniLine.getByRole("button", { name: "Remove" }).click();
  await expect(
    page.getByRole("link", { name: '2" Mini Cheesecake' }),
  ).toHaveCount(0);
  await expect(page.getByText("$80.00", { exact: true }).last()).toBeVisible();

  if (testInfo.project.name === "chromium-desktop") {
    await page.setViewportSize({ width: 320, height: 700 });
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
  }

  await expectNoSeriousAccessibilityViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test("the cart validation endpoint ignores browser prices and rejects injected fields", async ({
  request,
}) => {
  const validLine = {
    productId: "20000000-0000-4000-8000-000000000001",
    variantId: null,
    optionSelections: [],
    quantity: 1,
  };
  const validResponse = await request.post("/api/cart/validate", {
    data: { version: 1, lines: [validLine] },
  });
  expect(validResponse.status()).toBe(200);
  const validBody = await validResponse.json();
  expect(validBody.subtotalCents).toBe(4_000);
  expect(validBody.currency).toBe("CAD");

  const injectedResponse = await request.post("/api/cart/validate", {
    data: {
      version: 1,
      lines: [{ ...validLine, priceCents: 1, lineSubtotalCents: 1 }],
    },
  });
  expect(injectedResponse.status()).toBe(400);
  expect(await injectedResponse.json()).toMatchObject({
    error: { code: "invalid_cart" },
  });
});

test("a guest can save a Toronto delivery date without reserving capacity", async ({
  context,
  page,
}, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/menu/nine-inch-cheesecake");
  await page.getByRole("button", { name: "Add 1 to cart" }).click();
  await page
    .getByRole("button", { name: "Choose delivery date", exact: true })
    .click();
  await expect(page).toHaveURL(/\/menu\/nine-inch-cheesecake$/);
  await expect(page.locator("[data-checkout-order-summary]")).toHaveCount(0);

  const calendar = page.getByRole("grid", { name: /availability/i });
  await expect(calendar).toBeVisible();
  const initiallyFocused = calendar.locator('button[tabindex="0"]');
  await initiallyFocused.focus();
  const originalFocusedDate = await initiallyFocused.getAttribute("data-date");
  await page.keyboard.press("ArrowRight");
  await expect(calendar.locator("button:focus")).not.toHaveAttribute(
    "data-date",
    originalFocusedDate ?? "",
  );

  const disabledDate = calendar.locator('button[aria-disabled="true"]').first();
  const disabledExplanation = await disabledDate.getAttribute("aria-label");
  await disabledDate.focus();
  await disabledDate.press("Enter");
  await expect(page.locator("[data-fulfillment-announcer]")).toContainText(
    disabledExplanation?.replace(/^.*\. /, "") ?? "unavailable",
    { ignoreCase: true },
  );

  const availableDate = calendar
    .locator('button[aria-label$="Available"]')
    .first();
  await availableDate.click();
  const selectedDate = await availableDate.getAttribute("data-date");
  await expect(availableDate).toHaveAttribute("aria-pressed", "true");

  let saveRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/checkout/fulfillment"
    ) {
      saveRequests += 1;
    }
  });
  const saveButton = page.getByRole("button", {
    name: "Continue to checkout",
  });
  await expect(saveButton).toBeEnabled();
  await saveButton.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page).toHaveURL(/\/checkout$/);
  expect(saveRequests).toBe(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "Complete your order" }),
  ).toBeVisible();
  if (testInfo.project.name === "webkit-mobile")
    await page.locator("summary").click();
  await expect(
    page.locator("[data-checkout-order-summary]:visible").first(),
  ).toContainText("1 × $40.00");

  const checkoutCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "suga-spies-checkout",
  );
  expect(checkoutCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });

  await page
    .getByRole("button", { name: "Change date", exact: true })
    .filter({ visible: true })
    .click();
  await expect(calendar).toBeVisible();
  await expect(
    page.locator(`button[data-date="${selectedDate}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('input[name="fulfillment-time"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("M1W 2Y3");

  const replacementDate = calendar
    .locator(
      `button[aria-label$="Available"]:not([data-date="${selectedDate}"])`,
    )
    .first();
  const replacementValue = await replacementDate.getAttribute("data-date");
  await replacementDate.click();
  await saveButton.click();
  await expect(
    page.getByRole("dialog", { name: "Your pastry box" }),
  ).toBeHidden();
  await expect(page).toHaveURL(/\/checkout$/);
  const savedContext = await page.request.get("/api/checkout/fulfillment");
  const savedDraft = (await savedContext.json()).draft;
  expect(savedDraft.date).toBe(replacementValue);
  if (
    testInfo.project.name === "webkit-mobile" &&
    (await page.locator("details").getAttribute("open")) === null
  )
    await page.locator("summary").click();
  await expect(
    page.locator("[data-checkout-order-summary]:visible"),
  ).toContainText(savedDraft.dateLabel);

  if (testInfo.project.name === "chromium-desktop") {
    await page.setViewportSize({ width: 320, height: 700 });
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
  }

  await expectNoSeriousAccessibilityViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test("fulfillment APIs enforce schedule boundaries, privacy, and same-origin writes", async ({
  request,
}) => {
  const torontoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});
  const month = `${torontoDate.year}-${torontoDate.month}`;
  const availabilityResponse = await request.get(
    `/api/fulfillment/availability?method=delivery&month=${month}`,
  );
  expect(availabilityResponse.status()).toBe(200);
  const availability = await availabilityResponse.json();
  expect(availability.timeZone).toBe("America/Toronto");
  expect(availability.minimumNoticeDays).toBe(4);
  expect(availability.minimumDate).toBe(
    new Date(
      Date.UTC(
        Number(torontoDate.year),
        Number(torontoDate.month) - 1,
        Number(torontoDate.day) + 4,
      ),
    )
      .toISOString()
      .slice(0, 10),
  );
  expect(JSON.stringify(availability)).not.toMatch(/M1W 2Y3|internal_note/i);
  expect(
    availability.days.some(
      (day: { isoWeekday: number; reason: { code: string } | null }) =>
        day.isoWeekday === 3 && day.reason?.code === "closed_weekday",
    ),
  ).toBe(true);
  const openTuesday = availability.days.find(
    (day: { isoWeekday: number; selectable: boolean }) =>
      day.isoWeekday === 2 && day.selectable,
  );
  expect(openTuesday).toBeTruthy();
  expect(openTuesday).not.toHaveProperty("slots");

  const crossSiteResponse = await request.post("/api/checkout/fulfillment", {
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
      "Sec-Fetch-Site": "cross-site",
    },
    data: {},
  });
  expect(crossSiteResponse.status()).toBe(403);
  expect(await crossSiteResponse.json()).toMatchObject({
    error: { code: "invalid_origin" },
  });
});

test("unknown and archived product links render the indexed-safe 404", async ({
  page,
}) => {
  await page.goto("/menu/not-a-real-pastry");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This page slipped out of the pastry box.",
    }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/i,
  );
});

test("production responses apply the security header boundary", async ({
  page,
}) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["strict-transport-security"]).toContain("includeSubDomains");
});

test("skip link reaches the main content", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "webkit-mobile",
    "WebKit on macOS does not enable link tabbing by default",
  );

  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("mobile navigation opens, closes with Escape, and restores focus", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "webkit-mobile",
    "Mobile navigation test",
  );

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("foundation controls expose dialog, field error, and toast behavior", async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/foundation");

  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm this example" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Confirm example" }).click();
  await expect(page.getByText("Example confirmed")).toBeVisible();

  const invalidInput = page.getByRole("textbox", { name: "Error example" });
  await expect(invalidInput).toHaveAttribute("aria-invalid", "true");
  await expect(invalidInput).toHaveAccessibleDescription(
    "Choose an available delivery date before continuing.",
  );

  await expectNoSeriousAccessibilityViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test("storefront has no horizontal overflow from 320px through wide desktop", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Responsive matrix runs once in Chromium",
  );

  const viewports = [
    { width: 320, height: 700 },
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  await page.goto("/");

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const overflowElements = Array.from(document.body.querySelectorAll("*"))
        .map((element) => {
          const rectangle = element.getBoundingClientRect();
          return {
            element: `${element.tagName.toLowerCase()}.${element.className}`,
            left: rectangle.left,
            right: rectangle.right,
          };
        })
        .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
        .slice(0, 8);

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth,
        overflowElements,
      };
    });

    expect(
      dimensions.documentWidth,
      `horizontal overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(dimensions.overflowElements)}`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});

test("owner workspace fails closed before rendering private content", async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const response = await page.goto("/admin");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Welcome back to the kitchen side.",
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("alert").filter({ hasText: /sign in.*owner/i }),
  ).toBeVisible();
  await expect(page.getByText(/no public sign-up/i)).toHaveCount(1);
  await expect(page.getByText("Owner workspace", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(/live customer data/i)).toHaveCount(0);

  const headers = response?.headers() ?? {};
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["x-robots-tag"]).toContain("noindex");

  await expectNoSeriousAccessibilityViolations(page);
  expect(runtimeErrors).toEqual([]);
});

test("owner sign-in has no horizontal overflow at narrow and wide widths", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Responsive matrix runs once in Chromium",
  );

  await page.goto("/admin");

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));

    expect(
      dimensions.documentWidth,
      `owner sign-in overflow at ${viewport.width}x${viewport.height}`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});

test("authentication callback cannot redirect to an external origin", async ({
  page,
}) => {
  await page.goto(
    "/admin/auth/callback?next=https%3A%2F%2Fexample.com%2Fsteal-session",
  );

  await expect(page).toHaveURL(/\/admin\/login/);
  expect(new URL(page.url()).hostname).not.toBe("example.com");
});

test("an invalid recovery token is never consumed or accepted", async ({
  page,
}) => {
  await page.goto("/admin/recover?token_hash=short&type=recovery");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Confirm before using this one-time link.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recovery link unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue securely/i }),
  ).toHaveCount(0);
});

test("unknown routes return the custom 404", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This page slipped out of the pastry box.",
    }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("reduced-motion users do not receive long interface animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/foundation");
  await page.getByRole("button", { name: "Open dialog" }).click();

  const duration = await page
    .getByRole("dialog", { name: "Confirm this example" })
    .evaluate((element) => getComputedStyle(element).animationDuration);

  const longestDuration = Math.max(
    ...duration.split(",").map((value) => Number.parseFloat(value) || 0),
  );

  expect(longestDuration).toBeLessThanOrEqual(0.001);
});

test("stable foundation views match approved visual baselines", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium-desktop", "webkit-mobile"].includes(testInfo.project.name),
    "Visual baselines cover desktop Chromium and mobile WebKit",
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Welcome to Suga & Spies Pastries.",
    }),
  ).toBeVisible();
  await loadLazyImagesForVisualReview(page);
  await expect(page).toHaveScreenshot("storefront-foundation.png", {
    fullPage: true,
    animations: "disabled",
  });
  await page.addStyleTag({
    content:
      'header { position: static !important; } a[href="#main-content"] { display: none !important; }',
  });
  await expect(page.locator("#menu")).toHaveScreenshot("storefront-menu.png", {
    animations: "disabled",
  });

  await page.goto("/menu/nine-inch-cheesecake");
  await expect(
    page.getByRole("heading", { level: 1, name: '9" Cheesecake' }),
  ).toBeVisible();
  await loadLazyImagesForVisualReview(page);
  await expect(page).toHaveScreenshot("storefront-product.png", {
    fullPage: true,
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Add 1 to cart" }).click();
  await expect(
    page.getByRole("dialog", { name: "Your pastry box" }),
  ).toBeVisible();
  // A toast lives outside the modal: clicking it dismisses the drawer.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10_000,
  });
  await page.waitForFunction(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>('[role="dialog"] img'),
    ).every((image) => image.complete && image.naturalWidth > 0),
  );
  await expect(
    page.getByRole("button", { name: "Choose delivery date", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("storefront-cart.png", {
    fullPage: false,
    animations: "disabled",
  });

  await page.goto("/admin/login");
  await expect(page).toHaveScreenshot("admin-foundation.png", {
    fullPage: true,
    animations: "disabled",
  });
});
