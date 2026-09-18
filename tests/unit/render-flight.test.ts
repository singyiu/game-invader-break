import * as THREE from "three";
import { expect, it, vi } from "vitest";
import type { Enemy } from "../../src/shared/contracts";
import { FlightPathView } from "../../src/render/flight-path-view";

type FlightEnemy = Enemy & {
  flight: {
    pattern: "swoop" | "weave";
    startX: number;
    startY: number;
    amplitude: number;
    speed: number;
  };
};

function flightEnemy(phase: "formation" | "telegraph" | "diving"): FlightEnemy {
  return {
    id: 12,
    kind: "lancer",
    x: 50,
    y: 20,
    width: 4.5,
    height: 5,
    hp: 1,
    maxHp: 1,
    phase,
    phaseTime: 0,
    lane: 50,
    originX: 50,
    originY: 20,
    flight: {
      pattern: "weave",
      startX: 50,
      startY: 20,
      amplitude: 12,
      speed: 28,
    },
  };
}

it("draws the remaining flight route in world coordinates and keeps warnings visible in reduced mode", () => {
  const view = new FlightPathView();
  const enemy = flightEnemy("telegraph");

  view.update(enemy, 3.4, true);

  const line = view.group.getObjectByName("flight-path-line") as THREE.Line;
  const endpoint = view.group.getObjectByName(
    "flight-path-endpoint",
  ) as THREE.Mesh;
  const positions = line.geometry.getAttribute("position");
  const quarter = Math.floor((positions.count - 1) / 4);
  expect(view.group.visible).toBe(true);
  expect(line.material).toBeInstanceOf(THREE.LineDashedMaterial);
  expect([positions.getX(0), positions.getY(0)]).toEqual([50, 80]);
  expect(positions.getX(quarter)).toBeCloseTo(62, 5);
  expect(positions.getY(quarter)).toBeCloseTo(63, 5);
  expect([
    positions.getX(positions.count - 1),
    positions.getY(positions.count - 1),
  ]).toEqual([50, 12]);
  expect([endpoint.position.x, endpoint.position.y]).toEqual([50, 12]);
  expect(endpoint.scale.x).toBe(1);

  enemy.phase = "diving";
  enemy.phaseTime = (88 - enemy.flight.startY) / enemy.flight.speed / 4;
  view.update(enemy, 9.1, false);
  expect(positions.getX(0)).toBeCloseTo(62, 5);
  expect(positions.getY(0)).toBeCloseTo(63, 5);
  expect((line.material as THREE.LineDashedMaterial).opacity).toBeLessThan(0.5);

  enemy.phase = "formation";
  view.update(enemy, 10, false);
  expect(view.group.visible).toBe(false);
});

it("draws the return route from the invader to its launch point, then hides it at completion", () => {
  const view = new FlightPathView();
  const enemy = flightEnemy("diving");
  const duration = (88 - 20) / 28;
  enemy.phaseTime = duration * 1.25;

  view.update(enemy, 4.2, true);

  const line = view.group.getObjectByName("flight-path-line") as THREE.Line;
  const endpoint = view.group.getObjectByName(
    "flight-path-endpoint",
  ) as THREE.Mesh;
  const positions = line.geometry.getAttribute("position");
  expect(view.group.visible).toBe(true);
  expect([positions.getX(0), positions.getY(0)]).toEqual([38, 29]);
  expect([
    positions.getX(positions.count - 1),
    positions.getY(positions.count - 1),
  ]).toEqual([50, 80]);
  expect([endpoint.position.x, endpoint.position.y]).toEqual([50, 80]);
  expect(endpoint.scale.x).toBe(1);

  enemy.phaseTime = duration * 2;
  view.update(enemy, 4.8, true);
  expect(view.group.visible).toBe(false);
});

it("disposes the reusable warning geometry and materials", () => {
  const view = new FlightPathView();
  const line = view.group.getObjectByName("flight-path-line") as THREE.Line;
  const endpoint = view.group.getObjectByName(
    "flight-path-endpoint",
  ) as THREE.Mesh;
  const disposals = [
    vi.spyOn(line.geometry, "dispose"),
    vi.spyOn(line.material as THREE.Material, "dispose"),
    vi.spyOn(endpoint.geometry, "dispose"),
    vi.spyOn(endpoint.material as THREE.Material, "dispose"),
  ];

  view.dispose();

  disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
});
