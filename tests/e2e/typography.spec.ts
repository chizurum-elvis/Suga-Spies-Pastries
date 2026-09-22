import { expect, test } from "@playwright/test";

test("bakery typography stays restrained and readable across storefront widths", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const title = page.getByRole("heading", { level: 1 });
  const style = await title.evaluate((element) => ({
    family: getComputedStyle(element).fontFamily,
    size: Number.parseFloat(getComputedStyle(element).fontSize),
    weight: getComputedStyle(element).fontWeight,
    transform: getComputedStyle(element).textTransform,
  }));
  expect(style.family).toContain("Libre Baskerville");
  expect(style.size).toBeLessThanOrEqual(52);
  expect(style.weight).toBe("400");
  expect(style.transform).toBe("none");
  await page.screenshot({
    path: testInfo.outputPath("bakery-typography.png"),
    animations: "disabled",
  });
  if (testInfo.project.name === "chromium-desktop") {
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
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
  await page.goto("/menu");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-weight",
    "400",
  );
  expect(
    await page
      .getByRole("heading", { level: 1 })
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
  ).toBeLessThanOrEqual(36);
});
