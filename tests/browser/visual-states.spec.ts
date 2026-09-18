import { expect, test } from "@playwright/test";
import { syntheticCamera, moveHand } from "../fixtures/camera";
import { mkdir } from "node:fs/promises";
const directory = "docs/validation/screenshots";
test("captures the actual landing layout at laptop size", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mkdir(directory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Invader Break", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${directory}/landing.png`, fullPage: true });
  expect(errors).toEqual([]);
});
for (const scene of ["combat", "boss", "reduced", "powers"] as const) {
  test(`renders ${scene} at 720p without WebGL errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await mkdir(directory, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route("**/src/main.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `
   import '/src/style.css';import {mountShell} from '/src/ui/shell.ts';import {createGame} from '/src/game/state.ts';import {startWave} from '/src/game/encounters.ts';import {TUNING} from '/src/content/tuning.ts';import {activatePower} from '/src/game/powers.ts';import {ArenaRenderer} from '/src/render/arena-renderer.ts';
   const root=document.querySelector('#app');mountShell(root);root.dataset.phase='playing';const canvas=document.querySelector('#arena'),renderer=new ArenaRenderer(canvas);const game=createGame();startWave(game,${scene === "boss" ? 7 : scene === "powers" ? 12 : 6});game.serveRemaining=0;game.time=12;game.score=14250;game.charge=3;game.shields=2;game.ball.x=61;game.ball.y=63;game.ball.vx=-20;game.ball.vy=-50;game.paddles=[{id:1,x:35,y:88,width:TUNING.splitPaddleWidth,height:1.5},{id:2,x:67,y:88,width:TUNING.splitPaddleWidth,height:1.5}];game.projectiles=[{id:990,x:42,y:54,vx:3,vy:35,radius:.7,sourceId:0},{id:991,x:70,y:66,vx:-2,vy:35,radius:.7,sourceId:0}];
   if(${scene === "powers"}) { ['giant','wide','multi','fire'].forEach(kind=>activatePower(game,kind));game.extraBalls[0].x=27;game.extraBalls[0].y=59;game.extraBalls[1].x=77;game.extraBalls[1].y=73;game.pickups=['giant','wide','multi','fire','shield'].map((kind,index)=>({id:1100+index,kind,x:20+15*index,y:42,radius:TUNING.pickupRadius,vy:14}));document.querySelector('#power-status').hidden=false;document.querySelectorAll('[data-power]').forEach(chip=>{chip.hidden=false;chip.querySelector('.power-time').textContent='27s';}); }
   document.querySelector('#hand-bonus').hidden=false;document.querySelector('#score').textContent='014250';document.querySelector('#phase-name').textContent='${scene === "boss" ? "THE ECLIPSE ENGINE" : "ECLIPSE GATE"}';document.querySelector('#wave-label').textContent='${scene === "boss" ? "LEVEL 07 · BOSS" : scene === "powers" ? "LEVEL 12" : "LEVEL 06"}';document.querySelector('#arena-label').textContent='SYNTHETIC VISUAL FIXTURE';document.querySelector('#sector-label').textContent='CYCLE ${scene === "powers" ? 2 : 1} / ECLIPSE GATE';document.querySelector('#tracking-label').textContent='TWO-HAND VIEW';document.querySelector('#mode-label').textContent='02 HANDS · 1.5× POINTS';document.querySelectorAll('#shields svg')[2].classList.add('empty');document.querySelector('#tracking-dock').hidden=false;document.querySelector('#hands-count').textContent='2 HANDS DETECTED';document.querySelector('#quality-label').textContent='CAMERA OFF · VISUAL FIXTURE';
   renderer.setOptions({quality:'auto',reducedEffects:${scene === "reduced"}});const bounds=canvas.getBoundingClientRect();renderer.resize(bounds.width,bounds.height);let last=performance.now();function frame(now){game.ball.x=61+Math.sin(now/700)*4;game.ball.y=63+Math.cos(now/700)*4;renderer.render(game,[],now/1000);window.testRenderStats=renderer.stats;last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  `,
      }),
    );
    await page.goto("/");
    await expect(page.locator("#phase-name")).toHaveText(
      scene === "boss" ? "THE ECLIPSE ENGINE" : "ECLIPSE GATE",
    );
    await page.waitForTimeout(600);
    const stats = await page.evaluate(
      () =>
        (
          window as unknown as {
            testRenderStats: { drawCalls: number; triangles: number };
          }
        ).testRenderStats,
    );
    expect(stats.drawCalls).toBeGreaterThan(0);
    expect(stats.triangles).toBeGreaterThan(0);
    await page.screenshot({
      path: `${directory}/${scene}-720p.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("camera exit stays reachable with larger text at narrow viewport widths", async ({
  page,
}) => {
  await syntheticCamera(page);
  await page.setViewportSize({ width: 800, height: 850 });
  await page.goto("/");
  await moveHand(page, []);
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "align");
  const button = page.getByRole("button", { name: "Disconnect camera" });
  await expect(button).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${directory}/setup-narrow.png`,
    fullPage: true,
  });
  await button.click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "landing");
});
