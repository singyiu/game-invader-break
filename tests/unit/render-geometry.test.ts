import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Enemy, EnemyKind, Paddle } from "../../src/shared/contracts";
import {
  EnemyView,
  PaddleView,
  createRenderPalette,
  disposeObjectGeometries,
  disposePalette,
} from "../../src/render/entity-views";

const ENEMY_KINDS: EnemyKind[] = [
  "drone",
  "spitter",
  "lancer",
  "bastion",
  "conductor",
  "petal",
  "core",
];

function enemy(kind: EnemyKind, id: number): Enemy {
  const maxHp = 1;
  return {
    id,
    kind,
    x: 50,
    y: 25,
    width: kind === "core" ? 13 : kind === "petal" ? 12 : 11,
    height: kind === "lancer" ? 14 : kind === "core" ? 13 : 9,
    hp: maxHp,
    maxHp,
    phase: "formation",
    phaseTime: 0,
    lane: 0,
    originX: 50,
    originY: 25,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enemy geometry compaction", () => {
  it("constructs every enemy layout without dropping incompatible part families", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const palette = createRenderPalette();
    const views = ENEMY_KINDS.map(
      (kind, index) => new EnemyView(enemy(kind, index + 1), palette),
    );
    const drone = views[0];
    const keepsCeramicEdgeFamily = drone.group.children.some(
      (child) =>
        child instanceof THREE.Mesh && child.material === palette.ceramicEdge,
    );

    expect(consoleError).not.toHaveBeenCalled();
    expect(keepsCeramicEdgeFamily).toBe(true);

    views.forEach((view) => disposeObjectGeometries(view.group));
    disposePalette(palette);
  });
});

describe("paddle visual bounds", () => {
  it.each([9, 18])(
    "keeps a width-%s paddle silhouette inside its collider",
    (width) => {
      const palette = createRenderPalette();
      const view = new PaddleView(palette);
      const paddle: Paddle = { id: 1, x: 0, y: 88, width, height: 1.5 };

      view.update(paddle, 0, false);
      view.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(view.group);

      expect(bounds.min.x).toBeCloseTo(-width / 2, 5);
      expect(bounds.max.x).toBeCloseTo(width / 2, 5);

      disposeObjectGeometries(view.group);
      view.dispose();
      disposePalette(palette);
    },
  );
});
