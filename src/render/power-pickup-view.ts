import * as THREE from "three";
import { POWER_ART } from "../shared/power-art";
import type { PowerKind, PowerPickup } from "../shared/contracts";
import { decorativeTime } from "./render-layout";
import { worldY } from "./entity-views";

const TOKEN_HALF_SIZE = 2.3;
const TOKEN_BEVEL = 0.12;

function iconGeometry(kind: PowerKind, cutout = false): THREE.BufferGeometry {
  const shapes = POWER_ART[kind].shapes
    .filter((part) => Boolean(part.cutout) === cutout)
    .map(({ commands }) => {
      const shape = new THREE.Shape();
      for (const command of commands) {
        switch (command[0]) {
          case "M":
            shape.moveTo(command[1], command[2]);
            break;
          case "L":
            shape.lineTo(command[1], command[2]);
            break;
          case "C":
            shape.bezierCurveTo(
              command[1],
              command[2],
              command[3],
              command[4],
              command[5],
              command[6],
            );
            break;
          case "Z":
            shape.closePath();
            break;
        }
      }
      shape.closePath();
      return shape;
    });
  const geometry = new THREE.ShapeGeometry(shapes, 10);
  // SVG's downward Y axis becomes the arena's upward Y axis.
  geometry.translate(-12, -12, 0);
  geometry.rotateX(Math.PI);
  geometry.scale(0.15, 0.15, 1);
  return geometry;
}

function tokenShape(radius: number): THREE.Shape {
  const bevel = radius * 0.3;
  const points = [
    [-radius + bevel, -radius],
    [radius - bevel, -radius],
    [radius, -radius + bevel],
    [radius, radius - bevel],
    [radius - bevel, radius],
    [-radius + bevel, radius],
    [-radius, radius - bevel],
    [-radius, -radius + bevel],
  ];
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

export class PowerPickupView {
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly casing: THREE.Mesh;
  private readonly badge: THREE.Mesh;
  private readonly badgeMark: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private readonly materials: THREE.Material[];

  constructor(readonly kind: PowerKind) {
    const color = POWER_ART[kind].color;
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.75,
      metalness: 0.15,
      roughness: 0.24,
    });
    const casingMaterial = new THREE.MeshStandardMaterial({
      color: 0x16243b,
      emissive: 0x07111f,
      emissiveIntensity: 0.3,
      metalness: 0.64,
      roughness: 0.26,
    });
    const badgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x06111f,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const markMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.materials = [
      bodyMaterial,
      casingMaterial,
      badgeMaterial,
      markMaterial,
      glowMaterial,
    ];

    this.body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tokenShape(TOKEN_HALF_SIZE), {
        depth: 0.4,
        bevelEnabled: true,
        bevelSize: TOKEN_BEVEL,
        bevelThickness: TOKEN_BEVEL,
        bevelSegments: 1,
        steps: 1,
      }),
      bodyMaterial,
    );
    this.body.name = "power-token-body";
    this.casing = new THREE.Mesh(
      new THREE.ShapeGeometry(tokenShape(2.12)),
      casingMaterial,
    );
    this.casing.position.z = 0.54;
    this.casing.name = "power-token-inset";
    this.badge = new THREE.Mesh(
      new THREE.ShapeGeometry(tokenShape(1.98)),
      badgeMaterial,
    );
    this.badge.position.z = 0.56;
    this.badge.name = "power-badge";
    this.badgeMark = new THREE.Mesh(iconGeometry(kind), markMaterial);
    this.badgeMark.position.z = 0.6;
    this.badgeMark.name = "power-badge-mark";
    if (POWER_ART[kind].shapes.some((shape) => shape.cutout)) {
      const cutout = new THREE.Mesh(iconGeometry(kind, true), badgeMaterial);
      cutout.position.z = 0.62;
      cutout.name = "power-badge-cutout";
      this.group.add(cutout);
    }
    this.glow = new THREE.Mesh(
      new THREE.ShapeGeometry(tokenShape(2.7)),
      glowMaterial,
    );
    this.glow.position.z = -0.2;
    this.glow.name = "power-token-glow";
    this.group.add(
      this.glow,
      this.body,
      this.casing,
      this.badge,
      this.badgeMark,
    );
    this.group.renderOrder = 10;
  }

  update(pickup: PowerPickup, elapsed: number, reducedEffects: boolean): void {
    const motionTime = decorativeTime(elapsed, reducedEffects);
    this.group.position.set(pickup.x, worldY(pickup.y), 6.5);
    // The solid rim fits the catch bounds; only its decorative halo extends out.
    this.group.scale.setScalar(pickup.radius / (TOKEN_HALF_SIZE + TOKEN_BEVEL));
    // Keep the pictogram upright and the solid silhouette aligned to catch bounds.
    this.glow.scale.setScalar(
      reducedEffects ? 1 : 1 + Math.sin(motionTime * 5 + pickup.id) * 0.06,
    );
  }

  dispose(): void {
    this.group.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.add(child.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }
}

export class PowerPickupViewField {
  private readonly views = new Map<number, PowerPickupView>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(
    pickups: readonly PowerPickup[],
    elapsed: number,
    reducedEffects: boolean,
  ): void {
    const active = new Set<number>();
    for (const pickup of pickups) {
      active.add(pickup.id);
      let view = this.views.get(pickup.id);
      if (!view || view.kind !== pickup.kind) {
        if (view) view.dispose();
        view = new PowerPickupView(pickup.kind);
        view.group.userData.powerPickupId = pickup.id;
        this.scene.add(view.group);
        this.views.set(pickup.id, view);
      }
      view.update(pickup, elapsed, reducedEffects);
    }
    for (const [id, view] of this.views) {
      if (active.has(id)) continue;
      view.dispose();
      this.views.delete(id);
    }
  }

  dispose(): void {
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
  }
}
