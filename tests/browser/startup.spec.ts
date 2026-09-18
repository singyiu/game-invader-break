import { expect, test } from "@playwright/test";
import { syntheticCamera } from "../fixtures/camera";
for (const exit of ["pagehide", "disconnect"] as const)
  test(`${exit} during audio startup cannot open a camera afterward`, async ({
    page,
  }) => {
    await syntheticCamera(page);
    await page.route("**/src/audio/audio-director.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `export class AudioDirector {activate(){return new Promise(resolve=>{window.testResolveAudio=()=>resolve(true);});}applySettings(){}update(){}suspend(){}dispose(){}}`,
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: /Enable camera/ }).click();
    await expect(page.locator("#app")).toHaveAttribute("data-phase", "loading");
    if (exit === "pagehide")
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    else await page.getByRole("button", { name: "Disconnect camera" }).click();
    await expect(page.locator("#app")).toHaveAttribute(
      "data-phase",
      exit === "pagehide" ? "suspended" : "landing",
    );
    await page.evaluate(() =>
      (
        window as unknown as { testResolveAudio: () => void }
      ).testResolveAudio(),
    );
    await page.waitForTimeout(400);
    await expect(page.locator("#quality-label")).toHaveText("CAMERA OFF");
    await expect(page.locator("#hands-count")).toContainText("0 HANDS");
    if (exit === "disconnect") {
      await expect(
        page.getByRole("button", { name: /Enable camera/ }),
      ).toBeVisible();
      await expect(page.locator("#tracking-dock")).toBeHidden();
    }
  });
