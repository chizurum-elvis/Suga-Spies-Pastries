import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Read-only inspection of an explicitly approved existing test owner. Do not
// record authentication traffic or persist the session in test artifacts.
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.RUN_OWNER_NAVIGATION_ACCEPTANCE !== "1",
  "Requires explicit approval to inspect the existing test owner's workspace",
);

test("website content and FAQ editing are discoverable at every admin breakpoint", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(360_000);
  page.setDefaultNavigationTimeout(45_000);
  // Wait for the document and assert the actual UI separately, without tying
  // acceptance to image load events on a remote deployment.
  const navigate = async (path: string) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    // Do not log search queries: they can contain private customer information.
    expect(
      response?.status(),
      new URL(path, "https://example.com").pathname,
    ).toBe(200);
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.OWNER_TEST_EMAIL;
  if (!url || !publicKey || !secretKey || !email)
    throw new Error("Owner navigation inspection configuration is incomplete.");
  const boundedFetch: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });

  const admin = createClient(url, secretKey, {
    global: { fetch: boundedFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = users.data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  if (users.error || !existing?.email_confirmed_at)
    throw new Error("An existing verified test owner is required.");
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error || !link.data.properties.hashed_token)
    throw new Error("The private inspection session could not be created.");
  const cookies = new Map<string, string>();
  const owner = createServerClient(url, publicKey, {
    global: { fetch: boundedFetch },
    auth: { autoRefreshToken: false },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => {
        for (const value of values) cookies.set(value.name, value.value);
      },
    },
  });
  try {
    const verified = await owner.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "email",
    });
    if (verified.error || verified.data.user?.id !== existing.id)
      throw new Error("The inspection session could not be verified.");
    const membership = await owner
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (
      membership.error ||
      membership.data?.role !== "owner" ||
      !membership.data.is_active
    )
      throw new Error("The approved account must be an active owner.");

    const base = new URL(
      testInfo.project.use.baseURL ?? "http://127.0.0.1:3100",
    );
    await context.addCookies(
      [...cookies]
        .filter(([, value]) => value)
        .map(([name, value]) => ({
          name,
          value,
          domain: base.hostname,
          path: "/",
          secure: base.protocol === "https:",
          sameSite: "Lax" as const,
        })),
    );

    for (const width of [320, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await navigate("/admin");
      const mobile = width < 1024;
      if (mobile) {
        const trigger = page.getByRole("button", {
          name: "Open admin navigation",
        });
        await trigger.click();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(trigger).toBeFocused();
        await trigger.click();
      }
      const navigation = page.getByRole("navigation", {
        name: "Admin navigation",
      });
      const contentLink = navigation.getByRole("link", {
        name: "Website content",
        exact: true,
      });
      await contentLink.scrollIntoViewIfNeeded();
      await expect(contentLink).toBeInViewport();
      const label = await contentLink.evaluate((link) => {
        const text = link.querySelector("span") ?? link;
        const rect = text.getBoundingClientRect();
        return {
          clip: getComputedStyle(text).clip,
          width: rect.width,
          height: rect.height,
        };
      });
      expect(label.clip).toBe("auto");
      expect(label.width).toBeGreaterThan(30);
      expect(label.height).toBeGreaterThanOrEqual(16);
      if (width === 320)
        await page.screenshot({
          path: testInfo.outputPath("admin-mobile-menu.png"),
        });
      await contentLink.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\/content$/, { timeout: 20_000 });
      await expect(page.getByRole("dialog")).toBeHidden();
      await page
        .getByRole("link", { name: /Frequently asked questions/ })
        .click();
      await expect(page).toHaveURL(/\/admin\/content\/faq$/, {
        timeout: 20_000,
      });
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Frequently asked questions",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Question", exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Answer", exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save draft", exact: true }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if ([320, 1024, 1440].includes(width)) {
        await page.screenshot({
          path: testInfo.outputPath(`faq-editor-${width}.png`),
          fullPage: true,
        });
        const accessibility = await new AxeBuilder({ page }).analyze();
        expect(
          accessibility.violations.filter((violation) =>
            ["serious", "critical"].includes(violation.impact ?? ""),
          ),
        ).toEqual([]);
      }
    }

    await page.setViewportSize({ width: 1024, height: 420 });
    await navigate("/admin");
    const contentLink = page.getByRole("link", {
      name: "Website content",
      exact: true,
    });
    await contentLink.scrollIntoViewIfNeeded();
    await expect(contentLink).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("admin-short-sidebar.png"),
    });
    await contentLink.click();
    await expect(page).toHaveURL(/\/admin\/content$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Website content",
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });

    // Inspect every owner section with the same real, read-only session.
    const sections = [
      { path: "/admin", title: "Overview" },
      { path: "/admin/orders", title: "Orders" },
      { path: "/admin/production", title: "Kitchen plan" },
      { path: "/admin/menu", title: "Menu" },
      { path: "/admin/availability", title: "Delivery calendar" },
      { path: "/admin/content", title: "Website content" },
      { path: "/admin/settings", title: "Settings" },
      { path: "/admin/content/faq", title: "Frequently asked questions" },
    ];
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    for (const section of sections) {
      console.info(`Inspecting ${section.path}`);
      await navigate(section.path);
      for (const width of [320, 360, 390, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: section.title,
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${section.path} must not overflow at ${width}px`,
        ).toBe(true);
        if ([320, 1440].includes(width)) {
          await page.screenshot({
            path: testInfo.outputPath(
              `${section.title.replaceAll(" ", "-").toLowerCase()}-${width}.png`,
            ),
            fullPage: true,
          });
          const result = await new AxeBuilder({ page }).analyze();
          expect(
            result.violations.filter((violation) =>
              ["serious", "critical"].includes(violation.impact ?? ""),
            ),
          ).toEqual([]);
        }
      }
    }
    await navigate("/admin/menu/new");
    expect(
      await page
        .getByRole("button", { name: "Create draft", exact: true })
        .evaluate((button) => getComputedStyle(button.parentElement!).position),
    ).toBe("static");
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("textbox", { name: /Pastry name/ }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if ([320, 1440].includes(width))
        await page.screenshot({
          path: testInfo.outputPath(`new-pastry-${width}.png`),
          fullPage: true,
        });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reference = await owner
      .from("admin_order_index")
      .select("id,order_number,contact_name,contact_email,contact_phone")
      .eq("test_only", true)
      .limit(1)
      .maybeSingle();
    if (reference.error)
      throw new Error("The read-only search fixture could not be loaded.");
    if (reference.data) {
      for (const query of [
        reference.data.order_number,
        reference.data.contact_name,
        reference.data.contact_email,
        reference.data.contact_phone,
      ]) {
        await navigate(
          `/admin/orders?mode=test&q=${encodeURIComponent(query)}`,
        );
        await expect(
          page
            .getByRole("list", { name: "Paid pastry orders" })
            .getByRole("link", {
              name: new RegExp(reference.data.order_number),
            }),
        ).toBeVisible({ timeout: 20_000 });
      }
    }
    await navigate("/admin/orders?mode=test");
    const firstOrder = page
      .getByRole("list", { name: "Paid pastry orders" })
      .getByRole("link")
      .first();
    if (await firstOrder.count()) {
      await firstOrder.click();
      await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/, {
        timeout: 20_000,
      });
      await expect(
        page.getByRole("button", { name: "Print order", exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await page.screenshot({
        path: testInfo.outputPath("order-detail.png"),
        fullPage: true,
      });
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
      await page.emulateMedia({ media: "print" });
      await expect(
        page.getByRole("button", { name: "Print order", exact: true }),
      ).toBeHidden();
      await page.emulateMedia({ media: "screen" });
    }
    expect(runtimeErrors).toEqual([]);
  } finally {
    try {
      await context.clearCookies();
    } finally {
      const signedOut = await owner.auth.signOut({ scope: "local" });
      if (signedOut.error)
        throw new Error(
          "The private inspection session could not be signed out.",
        );
    }
  }
});
