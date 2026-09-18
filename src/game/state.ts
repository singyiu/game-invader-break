import type { GameOptions, GameState } from "../shared/contracts";
import { TUNING as T } from "../content/tuning";
import { startWave, spawnEnemy } from "./encounters";
export function createGame(options: GameOptions = {}): GameState {
  const seed = options.seed ?? 20260916;
  const state: GameState = {
    tick: 0,
    time: 0,
    seed,
    rng: seed >>> 0,
    status: "playing",
    extraBalls: [],
    pickups: [],
    powers: { giant: 0, wide: 0, multi: 0, fire: 0 },
    killsSinceDrop: 0,
    powerDropCount: 0,
    bossesDefeated: 0,
    perfectBossClears: 0,
    ball: {
      id: 0,
      x: 50,
      y: 84,
      vx: 15,
      vy: -Math.sqrt(T.speed ** 2 - 225),
      radius: T.radius,
    },
    paddles: [
      {
        id: 1,
        x: 50,
        y: T.paddleY,
        width: T.paddleWidth,
        height: T.paddleHeight,
      },
    ],
    enemies: [],
    projectiles: [],
    shields: 3,
    graceUntil: 0,
    score: 0,
    combo: 0,
    kills: 0,
    charge: 0,
    overdriveUntil: 0,
    wave: 1,
    sector: 1,
    restRemaining: 0,
    serveRemaining: options.practice ? 1 : T.serve,
    lastDamage: "",
    events: [],
    nextId: 10,
    nextEventId: 1,
    attackTimer: 2,
    precisionReturns: 0,
    returns: 0,
    transitions: 0,
    controlHistory: "none",
    practice: options.practice ?? false,
    bossPhase: 0,
    fairnessInterventions: 0,
    lastEnemyHitAt: 0,
    lastStallShiftAt: 0,
  };
  if (state.practice)
    state.enemies = [
      spawnEnemy(state, "drone", 30, 25),
      spawnEnemy(state, "drone", 50, 25),
      spawnEnemy(state, "drone", 70, 25),
    ];
  else startWave(state, 1);
  state.events = [];
  return state;
}
