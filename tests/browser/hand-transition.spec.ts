import { expect, test, type Page } from "@playwright/test";
import { moveHand, syntheticCamera } from "../fixtures/camera";
import type { GameState, PaddleIntent } from "../../src/shared/contracts";

interface IntentSample {
  at: number;
  mode: PaddleIntent["mode"];
  paused: boolean;
  status: PaddleIntent["status"];
  resumeIn: number;
}

interface TransitionState {
  game: GameState;
  intent: PaddleIntent;
  samples: IntentSample[];
  rallyNotice: string;
  overlayHidden: boolean;
}

interface TransitionHarness {
  testReadTransition: () => TransitionState;
  testStageTransition: () => void;
}

async function prepare(page: Page): Promise<void> {
  await syntheticCamera(page);
  await page.route("**/src/main.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        import '/src/style.css';
        import { InvaderBreakApp } from '/src/app/application.ts';
        const app = new InvaderBreakApp(document.querySelector('#app'));
        const samples = [];
        const originalIntent = app.controller.intent.bind(app.controller);
        app.controller.intent = (now) => {
          const intent = originalIntent(now);
          if (app.session.phase === 'playing') {
            samples.push({
              at: now,
              mode: intent.mode,
              paused: intent.paused,
              status: intent.status,
              resumeIn: intent.resumeIn,
            });
          }
          return intent;
        };
        window.testReadTransition = () => ({
          game: structuredClone(app.game),
          intent: structuredClone(app.controller.intent(performance.now())),
          samples: structuredClone(samples),
          rallyNotice: document.querySelector('#rally-notice').textContent.trim(),
          overlayHidden: document.querySelector('#overlay').hidden,
        });
        window.testStageTransition = () => {
          app.game.serveRemaining = 0;
          app.game.projectiles = [];
          app.game.pickups = [];
          Object.assign(app.game.ball, { x: 50, y: 55, vx: 6, vy: -4 });
          samples.length = 0;
        };
      `,
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
    .poll(() => read(page).then((state) => state.game.paddles[0]?.x))
    .toBeCloseTo(50, 0);
  await page.evaluate(() =>
    (window as unknown as TransitionHarness).testStageTransition(),
  );
}

async function read(page: Page): Promise<TransitionState> {
  return page.evaluate(() =>
    (window as unknown as TransitionHarness).testReadTransition(),
  );
}

function expectSimulationAdvanced(
  before: TransitionState,
  after: TransitionState,
): void {
  expect(after.game.time).toBeGreaterThan(before.game.time + 0.05);
  expect(after.game.tick).toBeGreaterThan(before.game.tick + 6);
  expect(
    Math.hypot(
      after.game.ball.x - before.game.ball.x,
      after.game.ball.y - before.game.ball.y,
    ),
  ).toBeGreaterThan(0.2);
}

test("keeps combat moving while one-hand control splits and merges", async ({
  page,
}) => {
  test.setTimeout(45000);
  await prepare(page);

  const oneHand = await read(page);
  const survivorId = oneHand.intent.targets[0]!.id;

  await moveHand(page, [0.5, 0.3]);
  await expect
    .poll(() => read(page).then((state) => state.intent.mode))
    .toBe(2);
  const splitStarted = await read(page);
  await page.waitForTimeout(120);
  const splitMoving = await read(page);
  await expect
    .poll(() => read(page).then((state) => state.game.paddles.length))
    .toBe(2);

  await moveHand(page, [0.5]);
  await expect
    .poll(() => read(page).then((state) => state.intent.mode))
    .toBe(1);
  const mergeStarted = await read(page);
  await page.waitForTimeout(120);
  const mergeMoving = await read(page);
  await expect
    .poll(() => read(page).then((state) => state.game.paddles.length))
    .toBe(1);
  const complete = await read(page);

  expectSimulationAdvanced(splitStarted, splitMoving);
  expectSimulationAdvanced(mergeStarted, mergeMoving);
  expect(complete.intent.targets.map((target) => target.id)).toEqual([
    survivorId,
  ]);
  expect(complete.game.paddles.map((paddle) => paddle.id)).toEqual([
    survivorId,
  ]);
  expect(
    complete.samples.filter((sample) => sample.paused || sample.resumeIn > 0),
    "split/merge must not emit a paused intent or resume countdown",
  ).toEqual([]);
  expect([splitMoving.rallyNotice, mergeMoving.rallyNotice]).toEqual(["", ""]);
  expect([splitMoving.overlayHidden, mergeMoving.overlayHidden]).toEqual([
    true,
    true,
  ]);
});
