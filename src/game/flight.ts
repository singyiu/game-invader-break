import type { Enemy, FlightPath, Projectile } from "../shared/contracts";
import { TUNING as T } from "../content/tuning";
import { difficultyForLevel } from "./difficulty";

export function planFlight(enemy: Enemy, level: number): FlightPath {
  const room = Math.max(
    0,
    Math.min(enemy.x - enemy.width / 2, 100 - enemy.width / 2 - enemy.x),
  );
  return {
    pattern: (enemy.id + level) % 2 === 0 ? "swoop" : "weave",
    startX: enemy.x,
    startY: enemy.y,
    amplitude: Math.min(10, room) * (enemy.x < 50 ? 1 : -1),
    speed: 28 * difficultyForLevel(level).hazardSpeed,
  };
}

export function flightDuration(flight: FlightPath): number {
  return Math.max(0, (T.paddleY - flight.startY) / flight.speed);
}

/** Retrace the same curve after the paddle, then stop at the launch position. */
export function flightPosition(flight: FlightPath, elapsed: number) {
  const duration = flightDuration(flight);
  const time = Math.max(0, Math.min(2 * duration, elapsed));
  const routeTime = time <= duration ? time : 2 * duration - time;
  const progress = duration > 0 ? routeTime / duration : 0;
  const turns = flight.pattern === "swoop" ? 1 : 2;
  return {
    x: flight.startX + flight.amplitude * Math.sin(Math.PI * turns * progress),
    y: flight.startY + routeTime * flight.speed,
  };
}

/** Reserve the whole lateral route, without widening its vertical contact window. */
export function flightHazard(
  enemy: Enemy,
  level: number,
): Projectile & { halfHeight: number } {
  const flight = enemy.flight;
  const amplitude = flight?.amplitude ?? 0;
  const swoop = flight?.pattern === "swoop";
  return {
    id: enemy.id,
    sourceId: enemy.id,
    x: flight ? flight.startX + (swoop ? amplitude / 2 : 0) : enemy.x,
    y: enemy.y,
    vx: 0,
    vy: flight
      ? flight.speed *
        (enemy.phaseTime >= flightDuration(flight) && enemy.phase === "diving"
          ? -1
          : 1)
      : 28 * difficultyForLevel(level).hazardSpeed,
    radius: enemy.width / 2 + Math.abs(amplitude) * (swoop ? 0.5 : 1),
    halfHeight: enemy.height / 2,
  };
}
