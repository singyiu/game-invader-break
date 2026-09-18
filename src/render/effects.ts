import * as THREE from "three";
import type { GameEvent } from "../shared/contracts";
import type { RenderPalette } from "./entity-views";
import { worldY } from "./entity-views";

interface Particle {
  active: boolean;
  born: number;
  lifetime: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  scale: number;
  color: THREE.Color;
}

interface Ring {
  active: boolean;
  born: number;
  lifetime: number;
  x: number;
  y: number;
  size: number;
  color: THREE.Color;
}

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
const AMBER = new THREE.Color(0xff9b40);
const CYAN = new THREE.Color(0x4de9ff);
const CRIMSON = new THREE.Color(0xff526d);
const IVORY = new THREE.Color(0xfff9e9);

function eventColor(kind: GameEvent["kind"]): THREE.Color {
  if (
    kind === "paddle-hit" ||
    kind === "intercept" ||
    kind === "neutralize" ||
    kind === "shield-hit"
  )
    return CYAN;
  if (kind === "shot" || kind === "drain") return CRIMSON;
  if (kind === "wall-hit") return IVORY;
  return AMBER;
}

function hash(value: number): number {
  let result = value | 0;
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  result ^= result >>> 16;
  return (result >>> 0) / 0xffffffff;
}

export class EffectField {
  readonly group = new THREE.Group();
  private readonly particles: Particle[];
  private readonly rings: Ring[];
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly ringMesh: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private capacity: number;
  private particleCursor = 0;
  private ringCursor = 0;

  constructor(maxCapacity: number, palette: RenderPalette) {
    this.capacity = maxCapacity;
    this.particles = Array.from({ length: maxCapacity }, () => ({
      active: false,
      born: 0,
      lifetime: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      scale: 0,
      color: new THREE.Color(),
    }));
    this.rings = Array.from({ length: 16 }, () => ({
      active: false,
      born: 0,
      lifetime: 0,
      x: 0,
      y: 0,
      size: 0,
      color: new THREE.Color(),
    }));

    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      vertexColors: true,
    });
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.48, 0),
      particleMaterial,
      maxCapacity,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    const ringMaterial = palette.faintCyan.clone();
    ringMaterial.opacity = 0.56;
    ringMaterial.vertexColors = true;
    this.ringMesh = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1, 0.07, 4, 24),
      ringMaterial,
      this.rings.length,
    );
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.frustumCulled = false;
    this.group.add(this.particleMesh, this.ringMesh);
    this.group.renderOrder = 14;
    this.hideAll();
  }

  setCapacity(capacity: number): void {
    this.capacity = Math.max(0, Math.min(capacity, this.particles.length));
    for (let index = this.capacity; index < this.particles.length; index += 1)
      this.particles[index].active = false;
  }

  spawn(event: GameEvent, elapsed: number, reducedEffects: boolean): void {
    const color = eventColor(event.kind);
    const ringWorthy =
      event.kind === "paddle-hit" ||
      event.kind === "enemy-hit" ||
      event.kind === "enemy-killed" ||
      event.kind === "shield-hit" ||
      event.kind === "overdrive" ||
      event.kind === "boss-phase";
    if (ringWorthy) this.spawnRing(event, elapsed, color);

    let amount = 3;
    if (event.kind === "enemy-killed") amount = reducedEffects ? 5 : 11;
    else if (event.kind === "enemy-hit" || event.kind === "shield-hit")
      amount = reducedEffects ? 3 : 7;
    else if (
      event.kind === "paddle-hit" ||
      event.kind === "wall-hit" ||
      event.kind === "intercept"
    )
      amount = reducedEffects ? 2 : 5;
    else if (
      event.kind === "shot" ||
      event.kind === "telegraph" ||
      event.kind === "wave-start"
    )
      amount = reducedEffects ? 0 : 2;
    else if (event.kind === "sector-clear" || event.kind === "victory")
      amount = reducedEffects ? 5 : 16;

    for (let index = 0; index < amount; index += 1) {
      const seed = event.id * 131 + index * 17;
      const angle = hash(seed) * Math.PI * 2;
      const speed =
        4 + hash(seed + 1) * (event.kind === "enemy-killed" ? 13 : 8);
      const particle =
        this.particles[this.particleCursor % Math.max(1, this.capacity)];
      this.particleCursor += 1;
      particle.active = this.capacity > 0;
      particle.born = elapsed;
      particle.lifetime = 0.28 + hash(seed + 2) * 0.48;
      particle.x = event.x;
      particle.y = worldY(event.y);
      particle.z = 8 + hash(seed + 3) * 2;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.vz = 1 + hash(seed + 4) * 4;
      particle.spin = (hash(seed + 5) - 0.5) * 10;
      particle.scale = 0.35 + hash(seed + 6) * 0.9;
      particle.color.copy(color);
    }
  }

  private spawnRing(
    event: GameEvent,
    elapsed: number,
    color: THREE.Color,
  ): void {
    const ring = this.rings[this.ringCursor % this.rings.length];
    this.ringCursor += 1;
    ring.active = true;
    ring.born = elapsed;
    ring.lifetime = event.kind === "shield-hit" ? 0.8 : 0.48;
    ring.x = event.x;
    ring.y = worldY(event.y);
    ring.size = event.kind === "shield-hit" ? 2.2 : 1;
    ring.color.copy(color);
  }

  update(elapsed: number): void {
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      const age = elapsed - particle.born;
      if (
        !particle.active ||
        age >= particle.lifetime ||
        index >= this.capacity
      ) {
        particle.active = false;
        this.particleMesh.setMatrixAt(index, HIDDEN_MATRIX);
        continue;
      }
      const t = age / particle.lifetime;
      this.transform.position.set(
        particle.x + particle.vx * age,
        particle.y + particle.vy * age - 8 * age * age,
        particle.z + particle.vz * age,
      );
      this.transform.rotation.set(
        particle.spin * age,
        particle.spin * age * 0.7,
        particle.spin * age * 0.4,
      );
      const scale = particle.scale * (1 - t);
      this.transform.scale.set(scale, scale * 0.62, scale);
      this.transform.updateMatrix();
      this.particleMesh.setMatrixAt(index, this.transform.matrix);
      this.particleMesh.setColorAt(index, particle.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor)
      this.particleMesh.instanceColor.needsUpdate = true;

    for (let index = 0; index < this.rings.length; index += 1) {
      const ring = this.rings[index];
      const age = elapsed - ring.born;
      if (!ring.active || age >= ring.lifetime) {
        ring.active = false;
        this.ringMesh.setMatrixAt(index, HIDDEN_MATRIX);
        continue;
      }
      const t = age / ring.lifetime;
      const scale = ring.size + t * 4.5;
      this.transform.position.set(ring.x, ring.y, 7.4);
      this.transform.rotation.set(0, 0, 0);
      this.transform.scale.setScalar(scale);
      this.transform.updateMatrix();
      this.ringMesh.setMatrixAt(index, this.transform.matrix);
      this.ringMesh.setColorAt(index, ring.color);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (this.ringMesh.instanceColor)
      this.ringMesh.instanceColor.needsUpdate = true;
  }

  private hideAll(): void {
    for (let index = 0; index < this.particles.length; index += 1)
      this.particleMesh.setMatrixAt(index, HIDDEN_MATRIX);
    for (let index = 0; index < this.rings.length; index += 1)
      this.ringMesh.setMatrixAt(index, HIDDEN_MATRIX);
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.particleMesh.geometry.dispose();
    this.ringMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    (this.ringMesh.material as THREE.Material).dispose();
  }
}
