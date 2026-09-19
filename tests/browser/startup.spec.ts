import { expect, test } from "@playwright/test";
import { syntheticCamera } from "../fixtures/camera";

test("keeps the sound warning visible after camera startup", async ({
  page,
}) => {
  await syntheticCamera(page);
  await page.route("**/src/audio/audio-director.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export class AudioDirector {async activate(){return false;}applySettings(){}update(){}suspend(){}dispose(){}}`,
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Enable camera/ }).click();

  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-left",
    { timeout: 12000 },
  );
  await expect(page.locator("#quality-label")).toHaveText(
    "SOUND UNAVAILABLE · VISUAL CUES ACTIVE",
  );
});

for (const exit of ["pagehide", "disconnect"] as const)
  test(`late audio activation stays stopped after ${exit}`, async ({
    page,
  }) => {
    await syntheticCamera(page);
    await page.route("**/src/audio/audio-director.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `export class AudioDirector {constructor(){window.testAudioRunning=false;}activate(){return new Promise(resolve=>{window.testResolveAudio=()=>{window.testAudioRunning=true;resolve(true);};});}applySettings(){}update(){}suspend(){window.testAudioRunning=false;}dispose(){}}`,
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: /Enable camera/ }).click();
    await expect(page.locator("#app")).toHaveAttribute(
      "data-phase",
      "reach-left",
      { timeout: 12000 },
    );
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
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { testAudioRunning: boolean })
              .testAudioRunning,
        ),
      )
      .toBe(false);
    await expect(page.locator("#quality-label")).toHaveText("CAMERA OFF");
    await expect(page.locator("#hands-count")).toContainText("0 HANDS");
    if (exit === "disconnect") {
      await expect(
        page.getByRole("button", { name: /Enable camera/ }),
      ).toBeVisible();
      await expect(page.locator("#tracking-dock")).toBeHidden();
    }
  });
