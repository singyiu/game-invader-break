import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const screenshotDirectory = "docs/validation/screenshots";

test("renders readable outbound and return flight paths in the reduced-effects arena", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mkdir(screenshotDirectory, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route("**/src/main.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        import '/src/style.css';
        import {mountShell} from '/src/ui/shell.ts';
        import {createGame} from '/src/game/state.ts';
        import {spawnEnemy} from '/src/game/encounters.ts';
        import {flightDuration,flightPosition} from '/src/game/flight.ts';
        import {ArenaRenderer} from '/src/render/arena-renderer.ts';

        const root=document.querySelector('#app');mountShell(root);root.dataset.phase='playing';
        const canvas=document.querySelector('#arena');const renderer=new ArenaRenderer(canvas);
        const game=createGame();game.serveRemaining=0;game.time=12;game.score=8600;game.shields=2;
        game.ball.x=50;game.ball.y=62;game.ball.vx=18;game.ball.vy=-52;
        const left=spawnEnemy(game,'lancer',31,21);const right=spawnEnemy(game,'drone',69,24);
        const leftFlight={pattern:'weave',startX:31,startY:21,amplitude:10,speed:28};
        const rightFlight={pattern:'swoop',startX:69,startY:24,amplitude:-10,speed:30};
        game.enemies=[left,right];
        document.querySelector('#score').textContent='008600';
        document.querySelector('#phase-name').textContent='READ THE FLIGHT';
        document.querySelector('#wave-label').textContent='LEVEL 06';
        document.querySelector('#arena-label').textContent='PATTERN WARNING FIXTURE';
        document.querySelector('#sector-label').textContent='EMBER FOUNDRY';
        document.querySelector('#quality-label').textContent='REDUCED EFFECTS · VISUAL FIXTURE';
        const bounds=canvas.getBoundingClientRect();renderer.resize(bounds.width,bounds.height);
        window.testStageFlights=(stage)=>{
          if(stage==='baseline') {
            left.phase='formation';right.phase='formation';delete left.flight;delete right.flight;
            renderer.setOptions({quality:'auto',reducedEffects:false});
          } else if(stage==='returning-baseline'||stage==='returning') {
            left.phase='diving';left.phaseTime=flightDuration(leftFlight)*1.25;
            right.phase='diving';right.phaseTime=flightDuration(rightFlight)*1.25;
            Object.assign(left,flightPosition(leftFlight,left.phaseTime));
            Object.assign(right,flightPosition(rightFlight,right.phaseTime));
            if(stage==='returning') {
              left.flight=leftFlight;right.flight=rightFlight;
            } else {
              delete left.flight;delete right.flight;
            }
            renderer.setOptions({quality:'auto',reducedEffects:true});
          } else {
            left.flight=leftFlight;left.phase='telegraph';left.phaseTime=.35;left.x=31;left.y=21;
            right.flight=rightFlight;right.phase='diving';right.phaseTime=.58;
            Object.assign(right,flightPosition(rightFlight,right.phaseTime));
            renderer.setOptions({quality:'auto',reducedEffects:stage==='reduced'});
          }
          renderer.render(game,[],12);
          return renderer.stats;
        };
        window.testStageFlights('baseline');
      `,
    }),
  );

  await page.goto("/");
  const baseline = await page.evaluate(() =>
    (
      window as unknown as {
        testStageFlights(stage: string): {
          drawCalls: number;
          triangles: number;
        };
      }
    ).testStageFlights("baseline"),
  );
  const warnings = await page.evaluate(() =>
    (
      window as unknown as {
        testStageFlights(stage: string): {
          drawCalls: number;
          triangles: number;
        };
      }
    ).testStageFlights("warnings"),
  );
  expect(warnings.drawCalls).toBeGreaterThanOrEqual(baseline.drawCalls + 4);
  expect(warnings.triangles).toBeGreaterThan(baseline.triangles);

  const reduced = await page.evaluate(() =>
    (
      window as unknown as {
        testStageFlights(stage: string): {
          drawCalls: number;
          triangles: number;
        };
      }
    ).testStageFlights("reduced"),
  );
  expect(reduced.drawCalls).toBeGreaterThanOrEqual(baseline.drawCalls + 4);
  await page.screenshot({
    path: `${screenshotDirectory}/flights-720p.png`,
    fullPage: true,
  });
  const returningBaseline = await page.evaluate(() =>
    (
      window as unknown as {
        testStageFlights(stage: string): {
          drawCalls: number;
          triangles: number;
        };
      }
    ).testStageFlights("returning-baseline"),
  );
  const returning = await page.evaluate(() =>
    (
      window as unknown as {
        testStageFlights(stage: string): {
          drawCalls: number;
          triangles: number;
        };
      }
    ).testStageFlights("returning"),
  );
  expect(returning.drawCalls).toBeGreaterThanOrEqual(
    returningBaseline.drawCalls + 4,
  );
  expect(returning.triangles).toBeGreaterThan(returningBaseline.triangles);
  await page.screenshot({
    path: `${screenshotDirectory}/return-flight-720p.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
