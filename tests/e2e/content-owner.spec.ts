import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { expect as baseExpect, test } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30_000 });

// Explicit opt-in: uses the existing approved test owner and restores the public
// contact record. Never run automatically against a business owner's account.
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(
  process.env.RUN_OWNER_CONTENT_ACCEPTANCE !== "1",
  "Requires explicit owner acceptance testing against the connected database",
);

test("approved owner can save, publish and restore contact content", async ({
  page,
  context,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.OWNER_TEST_EMAIL;
  if (!url || !publicKey || !secretKey || !email)
    throw new Error("Owner acceptance configuration is incomplete.");

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error("Could not verify the existing test owner.");
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user?.email_confirmed_at)
    throw new Error("The existing test owner must have a verified email.");
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error || !link.data.properties.hashed_token)
    throw new Error("Could not create the private test session.");
  const cookies = new Map<string, string>();
  const owner = createServerClient(url, publicKey, {
    auth: { autoRefreshToken: false },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => {
        for (const value of values) cookies.set(value.name, value.value);
      },
    },
  });
  const verified = await owner.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (verified.error || verified.data.user?.id !== user.id) {
    await owner.auth.signOut({ scope: "local" });
    throw new Error("The private owner session could not be verified.");
  }
  const membership = await owner
    .from("admin_users")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    membership.error ||
    membership.data?.role !== "owner" ||
    !membership.data.is_active
  ) {
    await owner.auth.signOut({ scope: "local" });
    throw new Error("The chosen test account is not an active owner.");
  }

  const base = new URL(testInfo.project.use.baseURL ?? "http://127.0.0.1:3100");
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
  const guestContext = await browser.newContext({ baseURL: base.origin });
  const guest = await guestContext.newPage();
  async function closeTestSession() {
    await guestContext.close();
    await owner.auth.signOut({ scope: "local" });
    await context.clearCookies();
  }

  const draft = await owner
    .from("site_content_drafts")
    .select("body,version")
    .eq("key", "contact")
    .single();
  const publication = await owner
    .from("site_content_publications")
    .select("body,version")
    .eq("key", "contact")
    .eq("is_current", true)
    .single();
  if (draft.error || publication.error) {
    await closeTestSession();
    throw new Error(
      "Contact content could not be loaded through the owner session.",
    );
  }
  if (
    JSON.stringify(draft.data.body) !== JSON.stringify(publication.data.body)
  ) {
    await closeTestSession();
    throw new Error(
      "Existing unpublished contact edits must be preserved; acceptance test stopped.",
    );
  }
  const original = draft.data.body as { phone: string; email: string };
  const digits = original.phone.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("1")) {
    await closeTestSession();
    throw new Error("Unexpected public support number format.");
  }
  const spaced = `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  const alternate =
    spaced === original.phone
      ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
      : spaced;
  let changed = false;

  async function restoreThroughUi() {
    await page.goto("/admin/content/contact");
    const field = page.getByLabel("Public support phone");
    if ((await field.inputValue()) !== original.phone) {
      await field.fill(original.phone);
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Save draft", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Publish version", exact: true }),
      ).toBeEnabled();
    }
    const publish = page.getByRole("button", {
      name: /^(Publish version|Refresh public pages)$/,
    });
    if (await publish.isEnabled()) {
      await publish.click();
      await expect(
        page.getByText("Published. Customers can now see this version.", {
          exact: true,
        }),
      ).toBeVisible();
    }
  }

  try {
    await page.goto("/admin/content");
    await expect(
      page.getByRole("heading", { name: "What customers read" }),
    ).toBeVisible();
    await page.goto("/admin/content/contact");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contact details" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh public pages", exact: true })
      .click();
    await expect(
      page.getByText("Published. Customers can now see this version.", {
        exact: true,
      }),
    ).toBeVisible();
    await guest.goto("/contact");
    await expect(guest.locator("main a[href^='tel:']")).toHaveText(
      original.phone,
    );
    await page.getByLabel("Public support phone").fill(alternate);
    changed = true;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByText(`Draft version ${draft.data.version + 1}.`, {
        exact: false,
      }),
    ).toBeVisible();
    await guest.reload();
    await expect(guest.locator("main a[href^='tel:']")).toHaveText(
      original.phone,
    );
    await page
      .getByRole("button", { name: "Publish version", exact: true })
      .click();
    await expect(
      page.getByText(`Published version ${draft.data.version + 1}.`, {
        exact: false,
      }),
    ).toBeVisible();
    await guest.reload();
    await expect(guest.locator("main a[href^='tel:']")).toHaveText(alternate);
    await expect(guest.locator("footer a[href^='tel:']")).toHaveText(alternate);
    await page.screenshot({
      path: testInfo.outputPath("owner-content-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("owner-content-mobile.png"),
      fullPage: true,
    });

    const originalRow = page
      .getByRole("listitem")
      .filter({ hasText: `Version ${publication.data.version}` });
    await originalRow.getByRole("button", { name: "Restore as draft" }).click();
    await expect(
      page.getByText(`Draft version ${draft.data.version + 2}.`, {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Publish version", exact: true })
      .click();
    await expect(
      page.getByText(`Published version ${draft.data.version + 2}.`, {
        exact: false,
      }),
    ).toBeVisible();
    await guest.reload();
    await expect(guest.locator("main a[href^='tel:']")).toHaveText(
      original.phone,
    );
    await expect(guest.locator("footer a[href^='tel:']")).toHaveText(
      original.phone,
    );
    changed = false;
  } finally {
    try {
      if (changed) await restoreThroughUi();
    } finally {
      await closeTestSession();
    }
  }
});
