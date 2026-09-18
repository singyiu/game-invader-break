import { expect, test } from "@playwright/test";
import {
  syntheticCamera,
  moveHand,
  observeApplication,
  type TestHarness,
} from "../fixtures/camera";
async function alignAndCalibrate(page: import("@playwright/test").Page) {
  await syntheticCamera(page);
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
}
test("calibrates directly into a default run, supports split play, and disconnects back home", async ({
  page,
}) => {
  test.setTimeout(60000);
  await alignAndCalibrate(page);
  expect(
    await page.evaluate(
      () => (window as unknown as TestHarness).testRead().game.practice,
    ),
  ).toBe(false);
  await expect(page.locator('[data-dwell="practice"]')).toHaveCount(0);
  await expect(page.locator('[data-dwell="start"]')).toHaveCount(0);
  await moveHand(page, [0.5, 0.3]);
  await expect(page.locator("#mode-label")).toContainText("02 HANDS", {
    timeout: 8000,
  });
  await moveHand(page, []);
  await expect(page.locator("#overlay")).toContainText("Hands off", {
    timeout: 5000,
  });
  const score = await page.locator("#score").textContent();
  await page.waitForTimeout(400);
  expect(await page.locator("#score").textContent()).toBe(score);
  await moveHand(page, [0.5]);
  await expect(page.locator("#overlay")).toBeHidden({ timeout: 8000 });
  await expect(page.locator("#mode-label")).toContainText("01 HAND");
  await moveHand(page, []);
  await expect(page.locator("#overlay")).toContainText("Hands off");
  await page.getByRole("button", { name: "Disconnect camera" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "landing");
  await expect(
    page.getByRole("button", { name: /Enable camera/ }),
  ).toBeVisible();
  await expect(page.locator("#tracking-dock")).toBeHidden();
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#quality-label")).toHaveText("CAMERA OFF");
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "align");
  await moveHand(page, [0.5]);
  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-left",
    { timeout: 10000 },
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
  expect(
    await page.evaluate(
      () => (window as unknown as TestHarness).testRead().game.shields,
    ),
  ).toBe(3);
});
test("pagehide stops the camera and requires explicit reconnect", async ({
  page,
}) => {
  await syntheticCamera(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-left",
    { timeout: 12000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "suspended");
  await expect(
    page.getByRole("button", { name: "Reconnect camera" }),
  ).toBeVisible();
  await expect(page.locator("#quality-label")).toHaveText("CAMERA OFF");
});
