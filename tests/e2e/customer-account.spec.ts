import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("accounts stay optional and the forms work at mobile and desktop sizes", async ({
  page,
}, testInfo) => {
  await page.goto("/account/register");
  await expect(
    page.getByRole("heading", { name: "Make the next order easier." }),
  ).toBeVisible();
  await expect(
    page.getByText("You can always order as a guest.").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See the pastries" }),
  ).toHaveAttribute("href", "/menu");

  const submit = page.getByRole("button", { name: "Create account" });
  await submit.click();
  await expect(
    page.getByText("Check the highlighted fields and try again."),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("New password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);

  if (testInfo.project.name === "chromium-desktop") {
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
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
  await page.screenshot({
    path: testInfo.outputPath("customer-register.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.goto("/account/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Find your way back." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.locator("#customer-forgot-email-error")).toBeVisible();

  await page.goto("/account/confirm?token_hash=invalid");
  await expect(page.locator("#main-content [role='alert']")).toContainText(
    "incomplete",
  );
  await page.goto("/account/recover?token_hash=invalid");
  await expect(page.locator("#main-content [role='alert']")).toContainText(
    "incomplete",
  );
});
