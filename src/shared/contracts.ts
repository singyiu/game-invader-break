/** Image landmarks are unmirrored source coordinates. Game positions use a 100 × 100 arena, y down. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}
export interface HandObservation {
  landmarks: Landmark[];
  handedness?: string;
  handednessScore?: number;
}
export interface HandFrame {
  version: 1;
  frameId: number;
  capturedAt: number;
  arrivedAt: number;
  mediaTime: number;
  inferenceMs: number;
  hands: HandObservation[];
}
export interface Calibration {
  min: number;
  max: number;
}
export type TrackingStatus =
  | "searching"
  | "stable"
  | "uncertain"
  | "stale"
  | "reconfiguring"
  | "paused";
export interface PaddleTarget {
  id: number;
  x: number;
}
export interface PaddleIntent {
  mode: 0 | 1 | 2;
  targets: PaddleTarget[];
  status: TrackingStatus;
  paused: boolean;
  resumeIn: number;
  needsDwell: boolean;
}
export interface TrackedHand {
  id: number;
  x: number;
  rawX: number;
  y: number;
  landmarks: Landmark[];
}
export type EnemyKind =
  | "drone"
  | "spitter"
  | "lancer"
  | "bastion"
  | "conductor"
  | "petal"
  | "core";
export type PowerKind = "giant" | "wide" | "multi" | "fire" | "shield";
export type TimedPowerKind = Exclude<PowerKind, "shield">;
export interface PowerPickup {
  id: number;
  kind: PowerKind;
  x: number;
  y: number;
  radius: number;
  vy: number;
}
export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail?: { x: number; y: number }[];
}
export interface Paddle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  phase: "formation" | "telegraph" | "diving";
  phaseTime: number;
  lane: number;
  originX: number;
  originY: number;
  flight?: FlightPath;
}
/** A flight is locked before its warning starts; it never homes on the hand. */
export interface FlightPath {
  pattern: "swoop" | "weave";
  startX: number;
  startY: number;
  amplitude: number;
  speed: number;
}
export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sourceId: number;
}
export type GameEventKind =
  | "paddle-hit"
  | "wall-hit"
  | "enemy-hit"
  | "enemy-killed"
  | "shot"
  | "telegraph"
  | "shield-hit"
  | "drain"
  | "intercept"
  | "neutralize"
  | "overdrive"
  | "wave-start"
  | "sector-clear"
  | "boss-phase"
  | "victory"
  | "game-over"
  | "power-drop"
  | "power-collected"
  | "power-expired"
  | "cycle-clear";
export interface GameEvent {
  id: number;
  tick: number;
  kind: GameEventKind;
  x: number;
  y: number;
  entityId?: number;
  cause?: string;
  value?: number;
}
export interface GameState {
  tick: number;
  time: number;
  seed: number;
  rng: number;
  status: "playing" | "rest" | "won" | "lost";
  ball: Ball;
  extraBalls: Ball[];
  pickups: PowerPickup[];
  powers: Record<TimedPowerKind, number>;
  killsSinceDrop: number;
  powerDropCount: number;
  bossesDefeated: number;
  perfectBossClears: number;
  paddles: Paddle[];
  enemies: Enemy[];
  projectiles: Projectile[];
  shields: number;
  graceUntil: number;
  score: number;
  combo: number;
  kills: number;
  charge: number;
  overdriveUntil: number;
  wave: number;
  sector: number;
  restRemaining: number;
  serveRemaining: number;
  lastDamage: string;
  events: GameEvent[];
  nextId: number;
  nextEventId: number;
  attackTimer: number;
  precisionReturns: number;
  returns: number;
  transitions: number;
  controlHistory: "one" | "two" | "mixed" | "none";
  practice: boolean;
  bossPhase: number;
  fairnessInterventions: number;
  lastEnemyHitAt: number;
  lastStallShiftAt: number;
}
export interface GameOptions {
  seed?: number;
  practice?: boolean;
}
export interface RenderOptions {
  reducedEffects: boolean;
  quality: "auto" | "high" | "low";
}
export interface PlayerSettings {
  reducedEffects: boolean;
  music: number;
  effects: number;
  sensitivity: "comfortable" | "small";
  uiScale: "normal" | "large";
}
