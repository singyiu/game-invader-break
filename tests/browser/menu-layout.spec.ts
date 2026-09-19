import { expect, test } from "@playwright/test";

test("setup instructions and hand-selectable menus remain fully visible with larger text on laptop screens", async ({
  page,
}, testInfo) => {
  await page.route("**/src/main.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `import '/src/style.css';
      import { mountShell } from '/src/ui/shell.ts';
      import { Overlay } from '/src/ui/overlay.ts';
      import { createGame } from '/src/game/state.ts';
      import { defaultProfile } from '/src/storage/local-profile.ts';
      const root=document.querySelector('#app');mountShell(root);
      const overlay=new Overlay(document.querySelector('#overlay'));
      window.testMenu=(phase,settingsPage,large)=>{
        const game=createGame();game.status='won';game.score=12000;
        const settings=defaultProfile().settings;
        settings.uiScale=large?'large':'normal';
        document.documentElement.dataset.ui=settings.uiScale;
        root.dataset.phase=phase;document.querySelector('#tracking-dock').hidden=false;
        overlay.show({phase,settingsPage,game,settings,finish:'standard',unlocks:['aurora','eclipse'],paused:false,needsDwell:false,hands:1,cameraRecover:false,wallSeconds:300,best:12000,error:'',loading:''});
      };`,
    }),
  );
  await page.goto("/");
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 800, height: 850 },
  ]) {
    await page.setViewportSize(viewport);
    for (const large of [false, true]) {
      for (const menu of [
        { phase: "align", settingsPage: 0 },
        { phase: "reach-left", settingsPage: 0 },
        { phase: "reach-right", settingsPage: 0 },
        { phase: "results", settingsPage: 0 },
        { phase: "settings", settingsPage: 0 },
        { phase: "settings", settingsPage: 1 },
      ]) {
        await page.evaluate(
          ({ phase, settingsPage, large }) =>
            (
              window as unknown as {
                testMenu: (
                  phase: string,
                  settingsPage: number,
                  large: boolean,
                ) => void;
              }
            ).testMenu(phase, settingsPage, large),
          { ...menu, large },
        );
        await expect(
          page.getByRole("button", { name: "Disconnect camera" }),
        ).toBeInViewport({ ratio: 1 });
        const layout = await page.locator("#overlay").evaluate((overlay) => {
          const bounds = overlay.getBoundingClientRect();
          return Array.from(
            overlay.querySelectorAll(":scope > *, [data-dwell]"),
          )
            .filter((choice) => choice.getClientRects().length > 0)
            .map((choice) => {
              const box = choice.getBoundingClientRect();
              return {
                id:
                  ((choice as HTMLElement).dataset.dwell ?? choice.className) ||
                  choice.tagName,
                bottom: box.bottom,
                arenaBottom: bounds.bottom,
                inside:
                  box.top >= bounds.top &&
                  box.bottom <= bounds.bottom &&
                  box.left >= bounds.left &&
                  box.right <= bounds.right,
              };
            });
        });
        expect
          .soft(
            layout.filter((item) => !item.inside),
            `${viewport.width}×${viewport.height}, large=${large}, ${menu.phase}/${menu.settingsPage}`,
          )
          .toEqual([]);
        if (large && menu.phase.startsWith("reach-")) {
          const screenshotPath = testInfo.outputPath(
            `${menu.phase}-${viewport.width}.png`,
          );
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await testInfo.attach(`${menu.phase}-${viewport.width}`, {
            path: screenshotPath,
            contentType: "image/png",
          });
        }
      }
    }
  }
});
