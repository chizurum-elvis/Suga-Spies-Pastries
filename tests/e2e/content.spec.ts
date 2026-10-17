import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("published FAQ and contact pages work on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/faq");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const questions = page.locator("main details summary");
  await expect(questions.first()).toBeVisible();
  await questions.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main details").first()).toHaveAttribute(
    "open",
    "",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const faqAccessibility = await new AxeBuilder({ page }).analyze();
  expect(
    faqAccessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await page.getByRole("link", { name: "Contact us" }).first().click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Contact us" }),
  ).toBeVisible();
  await expect(page.locator("main a[href^='tel:']")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("M1W 2Y3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("published content stays within mobile, tablet, and desktop widths", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 360, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/faq", "/contact"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});
