import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createGame } from "../../src/game/state";
import { maybeDropPower } from "../../src/game/powers";
import { stepGame } from "../../src/game/step";
import type { Ball, PowerKind, PowerPickup } from "../../src/shared/contracts";
import {
  BallView,
  BallViewField,
  createRenderPalette,
  disposePalette,
} from "../../src/render/entity-views";
import {
  PowerPickupView,
  PowerPickupViewField,
} from "../../src/render/power-pickup-view";

function ball(id: number, x: number, radius = 0.9): Ball {
  return { id, x, y: 40, vx: 12, vy: -45, radius };
}

function pickup(kind: PowerKind, id: number): PowerPickup {
  return { id, kind, x: 20 + id, y: 35, radius: 2, vy: 14 };
}

describe("powered ball visuals", () => {
  it("matches the visible core to the simulation radius and isolates fire styling per ball", () => {
    const palette = createRenderPalette();
    const normal = new BallView(palette);
    const fire = new BallView(palette);

    normal.update(ball(0, 50, 1.62), false, 2, 8, false, false);
    fire.update(ball(9, 65, 1.62), false, 2, 8, false, true);
    normal.group.updateMatrixWorld(true);

    const core = normal.group.getObjectByName("ball-core") as THREE.Mesh;
    const fireCore = fire.group.getObjectByName("ball-core") as THREE.Mesh;
    const diameter = new THREE.Box3()
      .setFromObject(core)
      .getSize(new THREE.Vector3());
    const normalColor = (
      core.material as THREE.MeshStandardMaterial
    ).color.getHex();
    const fireColor = (
      fireCore.material as THREE.MeshStandardMaterial
    ).color.getHex();

    expect(diameter.x).toBeCloseTo(3.24, 2);
    expect(diameter.y).toBeCloseTo(3.24, 2);
    expect(fireColor).not.toBe(normalColor);
    expect(
      (normal.group.getObjectByName("ball-fire-shell") as THREE.Object3D)
        .visible,
    ).toBe(false);
    expect(
      (fire.group.getObjectByName("ball-fire-shell") as THREE.Object3D).visible,
    ).toBe(true);

    normal.dispose();
    fire.dispose();
    disposePalette(palette);
  });

  it("keeps views stable by ID and removes every orphaned group and trail", () => {
    const scene = new THREE.Scene();
    const palette = createRenderPalette();
    const field = new BallViewField(scene, palette);

    field.sync([ball(0, 25), ball(7, 75)], false, 1, 8, false, false);
    const primary = scene.children.find((child) => child.userData.ballId === 0);
    const orphan = scene.children.find(
      (child) => child.userData.ballId === 7,
    ) as THREE.Group;
    const orphanTrail = scene.children.find(
      (child) => child.userData.ballTrailFor === 7,
    ) as THREE.InstancedMesh;
    const disposeGeometry = vi.spyOn(orphanTrail.geometry, "dispose");
    const disposeMaterial = vi.spyOn(
      orphanTrail.material as THREE.Material,
      "dispose",
    );

    field.sync([ball(0, 30)], false, 2, 8, false, false);

    expect(scene.children.find((child) => child.userData.ballId === 0)).toBe(
      primary,
    );
    expect(scene.children).not.toContain(orphan);
    expect(scene.children).not.toContain(orphanTrail);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();

    field.dispose();
    disposePalette(palette);
  });
});

describe("power pickup visuals", () => {
  const kinds: PowerKind[] = ["giant", "wide", "multi", "fire", "shield"];

  it.each([
    { gap: -0.05, caught: true },
    { gap: 0.05, caught: false },
  ])(
    "matches paddle catches to the visible token edge ($gap)",
    ({ gap, caught }) => {
      const state = createGame({ seed: 4 });
      state.serveRemaining = 0;
      state.shields = 2;
      state.killsSinceDrop = 4;
      maybeDropPower(state, 50, 88);
      const item = state.pickups[0];
      const view = new PowerPickupView(item.kind);
      view.update(item, 0, true);
      view.group.updateMatrixWorld(true);
      const body = view.group.getObjectByName("power-token-body")!;
      const size = new THREE.Box3()
        .setFromObject(body)
        .getSize(new THREE.Vector3());
      item.x =
        state.paddles[0].x + state.paddles[0].width / 2 + size.x / 2 + gap;

      stepGame(
        state,
        {
          mode: 1,
          targets: [{ id: 1, x: 0.5 }],
          status: "stable",
          paused: false,
          resumeIn: 0,
          needsDwell: false,
        },
        1 / 120,
      );

      expect(state.shields).toBe(caught ? 3 : 2);
      expect(state.pickups).toHaveLength(caught ? 0 : 1);
      view.dispose();
    },
  );

  it("gives every kind a distinct color and a different built pictogram", () => {
    const views = kinds.map((kind, index) => {
      const view = new PowerPickupView(kind);
      view.update(pickup(kind, index + 1), 0, true);
      return view;
    });

    const colors = views.map((view) => {
      const body = view.group.getObjectByName("power-token-body") as THREE.Mesh;
      return (body.material as THREE.MeshStandardMaterial).color.getHex();
    });
    const badges = views.map((view) => {
      const mark = view.group.getObjectByName("power-badge-mark") as THREE.Mesh;
      mark.geometry.computeBoundingBox();
      const box = mark.geometry.boundingBox as THREE.Box3;
      return `${mark.geometry.getAttribute("position").count}:${box.min.x.toFixed(2)}:${box.max.x.toFixed(2)}`;
    });
    const hues = colors.map(
      (color) => new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).h,
    );

    expect(new Set(colors).size).toBe(kinds.length);
    expect(hues[0]).toBeGreaterThan(0.7); // giant: violet
    expect(hues[1]).toBeCloseTo(0.5, 1); // wide: cyan
    expect(hues[2]).toBeGreaterThan(0.55); // multi: blue
    expect(hues[2]).toBeLessThan(0.7);
    expect(hues[3]).toBeLessThan(0.1); // fire: orange
    expect(hues[4]).toBeGreaterThan(0.25); // shield: green
    expect(hues[4]).toBeLessThan(0.45);
    expect(new Set(badges).size).toBe(kinds.length);

    views.forEach((view) => view.dispose());
  });

  it("tracks pickups by ID and disposes removed views", () => {
    const scene = new THREE.Scene();
    const field = new PowerPickupViewField(scene);
    field.sync([pickup("fire", 4), pickup("shield", 5)], 1, false);
    const retained = scene.children.find(
      (child) => child.userData.powerPickupId === 5,
    );
    expect(
      scene.children.some((child) => child.userData.powerPickupId === 4),
    ).toBe(true);
    expect(retained).toBeDefined();

    field.sync([pickup("shield", 5)], 2, false);

    expect(
      scene.children.some((child) => child.userData.powerPickupId === 4),
    ).toBe(false);
    expect(
      scene.children.find((child) => child.userData.powerPickupId === 5),
    ).toBe(retained);

    field.dispose();
  });
});
