import { createGame } from "../../src/game/state";
import { TUNING } from "../../src/content/tuning";
import { ArenaRenderer } from "../../src/render/arena-renderer";
import type { Enemy, EnemyKind, GameState } from "../../src/shared/contracts";

const canvas = document.querySelector<HTMLCanvasElement>("#showcase");
const stats = document.querySelector<HTMLOutputElement>("#stats");
if (!canvas || !stats) throw new Error("Missing render showcase elements.");

const dimensions: Record<EnemyKind, [number, number, number]> = {
  drone: [6, 3.5, 1],
  spitter: [6, 4, 1],
  lancer: [4.5, 5, 1],
  bastion: [8, 4.5, 2],
  conductor: [7, 5, 2],
  petal: [13, 6, 2],
  core: [14, 10, 6],
};
const kinds: EnemyKind[] = [
  "drone",
  "spitter",
  "lancer",
  "bastion",
  "conductor",
  "drone",
  "lancer",
  "spitter",
  "bastion",
  "conductor",
  "drone",
  "spitter",
  "lancer",
  "bastion",
  "conductor",
];
const enemies: Enemy[] = kinds.map((kind, index) => {
  const [width, height, hp] = dimensions[kind];
  const row = Math.floor(index / 5);
  return {
    id: 100 + index,
    kind,
    x: 18 + (index % 5) * 16,
    y: 16 + row * 10,
    width,
    height,
    hp: kind === "bastion" && index === 13 ? 1 : hp,
    maxHp: hp,
    phase: index === 6 ? "telegraph" : "formation",
    phaseTime: 0.4,
    lane: index % 5,
    originX: 18 + (index % 5) * 16,
    originY: 16 + row * 10,
  };
});

const state: GameState = {
  ...createGame(),
  tick: 0,
  time: 0,
  seed: 20260916,
  rng: 1,
  status: "playing",
  ball: { id: 0, x: 50, y: 62, vx: 24, vy: -28, radius: 1.1 },
  paddles: [
    { id: 1, x: 28, y: 89, width: TUNING.splitPaddleWidth, height: 1.5 },
    { id: 2, x: 72, y: 89, width: TUNING.splitPaddleWidth, height: 1.5 },
  ],
  enemies,
  projectiles: [
    { id: 600, x: 32, y: 53, vx: 0, vy: 28, radius: 0.7, sourceId: 102 },
    { id: 601, x: 76, y: 64, vx: 0, vy: 28, radius: 0.7, sourceId: 108 },
  ],
  shields: 3,
  graceUntil: 0,
  score: 12400,
  combo: 4,
  kills: 3,
  charge: 3,
  overdriveUntil: 0,
  wave: 3,
  sector: 1,
  restRemaining: 0,
  serveRemaining: 0,
  lastDamage: "",
  events: [],
  nextId: 700,
  nextEventId: 1,
  attackTimer: 1,
  precisionReturns: 1,
  returns: 12,
  transitions: 1,
  controlHistory: "two",
  practice: false,
  bossPhase: 0,
  fairnessInterventions: 0,
  lastEnemyHitAt: -1,
  lastStallShiftAt: -1,
};

const renderer = new ArenaRenderer(canvas);
const reducedEffects = new URLSearchParams(window.location.search).has(
  "reduced",
);
renderer.setOptions({ quality: "high", reducedEffects });

const resize = (): void =>
  renderer.resize(window.innerWidth, window.innerHeight);
window.addEventListener("resize", resize);
resize();

const frame = (now: number): void => {
  const elapsed = now / 1000;
  state.time = elapsed;
  state.ball.x = 50 + Math.sin(elapsed * 0.9) * 21;
  state.ball.y = 62 + Math.cos(elapsed * 1.15) * 13;
  renderer.render(state, [], elapsed);
  const info = renderer.stats;
  stats.value = `${reducedEffects ? "REDUCED · " : ""}${info.drawCalls} calls · ${info.triangles.toLocaleString()} tris`;
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
