import { expect, test, type Page } from "@playwright/test";
import {
  syntheticCamera,
  moveHand,
  type TestHarness,
} from "../fixtures/camera";
import type { PowerKind } from "../../src/shared/contracts";

type PowerHarness = TestHarness & {
  testStage: (scenario: string, power?: PowerKind) => void;
};
async function prepare(page: Page) {
  await syntheticCamera(page, true);
  await page.route("**/src/main.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    import '/src/style.css';import {InvaderBreakApp} from '/src/app/application.ts';
    import {createGame} from '/src/game/state.ts';import {spawnEnemy,startWave} from '/src/game/encounters.ts';
    const app=new InvaderBreakApp(document.querySelector('#app'));
    window.testRead=()=>({phase:app.session.phase,game:structuredClone(app.game),calibration:app.profile.calibration});
    window.testStage=(scenario,power)=>{
      // Reproduce a display pause after a dwell action has required leaving its region.
      if(scenario==='latched-safety-pause') {app.performancePaused=true;app.dwell.reset(true);return;}
      if(scenario==='pickup') {
        app.game.serveRemaining=0;
        app.game.ball.x=50;app.game.ball.y=45;app.game.ball.vx=0;app.game.ball.vy=-8;
        app.game.pickups.push({id:app.game.nextId++,kind:power,x:app.game.paddles[0].x,y:84,radius:1.4,vy:14});return;
      }
      const game=createGame();game.paddles=structuredClone(app.game.paddles);game.serveRemaining=0;
      if(scenario==='score') {
        game.enemies=[spawnEnemy(game,'drone',50,35),spawnEnemy(game,'bastion',10,15)];
        Object.assign(game.ball,{x:50,y:40,vx:0,vy:-80});
      }
      if(scenario==='boss') {
        startWave(game,7);game.bossPhase=2;game.serveRemaining=0;
        game.enemies=[spawnEnemy(game,'core',50,35)];game.enemies[0].hp=1;
        Object.assign(game.ball,{x:50,y:43,vx:0,vy:-80});
      }
      if(scenario==='safe') {
        game.enemies=[spawnEnemy(game,'bastion',10,15)];
        Object.assign(game.ball,{x:50,y:45,vx:0,vy:-8});game.shields=2;
      }
      app.game=game;
    };`,
    }),
  );
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
  await moveHand(page, [0.5]);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as PowerHarness).testRead().game.paddles[0].x,
      ),
    )
    .toBeCloseTo(50, 0);
}
async function stage(page: Page, scenario: string, power?: PowerKind) {
  await page.evaluate(
    ({ scenario, power }) =>
      (window as unknown as PowerHarness).testStage(scenario, power),
    { scenario, power },
  );
}

test("catches and stacks timed power capsules, repairs a shield, and freezes timers during hand loss", async ({
  page,
}) => {
  test.setTimeout(60000);
  await prepare(page);
  await stage(page, "safe");
  for (const power of ["giant", "wide", "multi", "fire"] as const) {
    await stage(page, "pickup", power);
    await expect(page.locator(`[data-power="${power}"]`)).toBeVisible();
    await expect(
      page.locator(`[data-power="${power}"] .power-time`),
    ).toContainText(/\d+s/);
  }
  expect(
    await page.evaluate(
      () =>
        (window as unknown as PowerHarness).testRead().game.extraBalls.length,
    ),
  ).toBe(2);
  await stage(page, "pickup", "shield");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as PowerHarness).testRead().game.shields,
      ),
    )
    .toBe(3);
  await page.evaluate(() => {
    (
      window as unknown as { testResumeWhenPrompted: boolean }
    ).testResumeWhenPrompted = false;
  });
  await moveHand(page, []);
  await expect(page.locator("#overlay")).toContainText("Hands off");
  const remaining = await page.evaluate(
    () => (window as unknown as PowerHarness).testRead().game.powers.fire,
  );
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(
      () => (window as unknown as PowerHarness).testRead().game.powers.fire,
    ),
  ).toBe(remaining);
  await page.getByRole("button", { name: "Disconnect camera" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "landing");
});

test("two active hands earn the visible 1.5x score bonus", async ({ page }) => {
  test.setTimeout(40000);
  await prepare(page);
  await moveHand(page, [0.62, 0.38]);
  await expect(page.locator("#hand-bonus")).toBeVisible();
  await expect(page.locator("#hand-bonus")).toContainText("1.5×");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as PowerHarness).testRead().game.paddles.length,
      ),
    )
    .toBe(2);
  await expect(page.locator("#overlay")).toBeHidden();
  await stage(page, "score");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as PowerHarness).testRead().game.score,
      ),
    )
    .toBe(150);
});

test("boss clear continues automatically to level 8 and keeps progression", async ({
  page,
}) => {
  test.setTimeout(40000);
  await prepare(page);
  await stage(page, "boss");
  await expect(page.locator("#overlay")).toContainText("Cycle 1 cleared", {
    timeout: 8000,
  });
  await stage(page, "latched-safety-pause");
  await expect(page.locator("#overlay")).toContainText("Let’s catch up.");
  await expect(page.locator("#wave-label")).toContainText("LEVEL 08", {
    timeout: 15000,
  });
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "playing");
  expect(
    await page.evaluate(
      () => (window as unknown as PowerHarness).testRead().game.bossesDefeated,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Disconnect camera" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("invader-break.profile.v1")!),
  );
  expect(saved.bests.one.level).toBeGreaterThanOrEqual(8);
  expect(saved.unlocks).toContain("aurora");
});
