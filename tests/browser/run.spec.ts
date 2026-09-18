import { expect, test } from "@playwright/test";
import {
  syntheticCamera,
  observeApplication,
  moveHand,
  type TestHarness,
} from "../fixtures/camera";
test("real simulation starts after calibration, loses three shields and retries by hand", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // The automated player follows the same center-dwell recovery as a player
  // if software rendering briefly triggers the display-gap safety pause.
  await syntheticCamera(page, true);
  await observeApplication(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-left",
    { timeout: 12000 },
  );
  await moveHand(page, [0.74]);
  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-right",
    { timeout: 10000 },
  );
  await moveHand(page, [0.26]);
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "playing", {
    timeout: 10000,
  });
  // Stay on the far left. A launched ball must eventually drain and all three shields must be consumed.
  await moveHand(page, [0.74]);
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "results", {
    timeout: 60000,
  });
  expect(
    await page.evaluate(
      () => (window as unknown as TestHarness).testRead().game.shields,
    ),
  ).toBe(0);
  // Settings remain available after a run without blocking the initial launch.
  await moveHand(page, [0.5]);
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "settings", {
    timeout: 10000,
  });
  await moveHand(page, [0.8]);
  await page.waitForTimeout(250);
  await moveHand(page, [0.68]);
  await expect(page.locator('[data-dwell="music"]')).toContainText("60%", {
    timeout: 8000,
  });
  await page.waitForTimeout(1600);
  await expect(page.locator('[data-dwell="music"]')).toContainText("60%");
  await moveHand(page, [0.8]);
  await page.waitForTimeout(250);
  await moveHand(page, [0.32]);
  await expect(page.locator('[data-dwell="back"]')).toBeVisible({
    timeout: 8000,
  });
  await moveHand(page, [0.8]);
  await page.waitForTimeout(250);
  await moveHand(page, [0.32]);
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "results", {
    timeout: 8000,
  });
  await moveHand(page, [0.5]);
  await page.waitForTimeout(300);
  await moveHand(page, [0.66]);
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "playing", {
    timeout: 10000,
  });
  expect(
    await page.evaluate(
      () => (window as unknown as TestHarness).testRead().game.shields,
    ),
  ).toBe(3);
  expect(errors).toEqual([]);
});
