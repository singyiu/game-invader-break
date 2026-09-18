import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Ball, Enemy, Paddle, Projectile } from "../shared/contracts";
import { getPaddleFinishColors, type PaddleFinish } from "./paddle-finish";
import { decorativeTime } from "./render-layout";

export const worldY = (gameY: number): number => 100 - gameY;

export interface RenderPalette {
  ceramic: THREE.MeshPhysicalMaterial;
  ceramicEdge: THREE.MeshStandardMaterial;
  titanium: THREE.MeshStandardMaterial;
  amber: THREE.MeshStandardMaterial;
  amberGlow: THREE.MeshBasicMaterial;
  cyan: THREE.MeshStandardMaterial;
  ivory: THREE.MeshStandardMaterial;
  crimson: THREE.MeshStandardMaterial;
  crimsonTrail: THREE.MeshBasicMaterial;
  faintCyan: THREE.MeshBasicMaterial;
}

export function createRenderPalette(): RenderPalette {
  return {
    ceramic: new THREE.MeshPhysicalMaterial({
      color: 0x1a2c42,
      emissive: 0x061321,
      emissiveIntensity: 0.78,
      metalness: 0.18,
      roughness: 0.34,
      clearcoat: 0.62,
      clearcoatRoughness: 0.3,
    }),
    ceramicEdge: new THREE.MeshStandardMaterial({
      color: 0x547493,
      emissive: 0x0c263d,
      emissiveIntensity: 0.9,
      metalness: 0.3,
      roughness: 0.32,
    }),
    titanium: new THREE.MeshStandardMaterial({
      color: 0xbdd6df,
      emissive: 0x0b202d,
      emissiveIntensity: 0.6,
      metalness: 0.46,
      roughness: 0.3,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: 0x8a2e0a,
      emissive: 0xff5b0a,
      emissiveIntensity: 2.05,
      roughness: 0.24,
      metalness: 0.1,
    }),
    amberGlow: new THREE.MeshBasicMaterial({
      color: 0xff4912,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    }),
    cyan: new THREE.MeshStandardMaterial({
      color: 0x7eefff,
      emissive: 0x09bad4,
      emissiveIntensity: 2.6,
      roughness: 0.18,
      metalness: 0.08,
    }),
    ivory: new THREE.MeshStandardMaterial({
      color: 0xfff9e9,
      emissive: 0xbcecff,
      emissiveIntensity: 3.8,
      roughness: 0.12,
      toneMapped: false,
    }),
    crimson: new THREE.MeshStandardMaterial({
      color: 0xff657a,
      emissive: 0xff173d,
      emissiveIntensity: 2.2,
      roughness: 0.22,
    }),
    crimsonTrail: new THREE.MeshBasicMaterial({
      color: 0xff3159,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    faintCyan: new THREE.MeshBasicMaterial({
      color: 0x4de9ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  };
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  return result;
}

function armor(meshValue: THREE.Mesh, index: number): THREE.Mesh {
  meshValue.userData.armorIndex = index;
  return meshValue;
}

function compactEnemyArmor(
  group: THREE.Group,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
  maxHp: number,
): void {
  const coreSet = new Set(cores);
  const splitAt = Math.ceil(panels.length / 2);
  const batches = new Map<
    string,
    {
      bucket: number;
      material: THREE.Material;
      geometries: THREE.BufferGeometry[];
      sources: THREE.Mesh[];
    }
  >();
  const retainedPanels: { mesh: THREE.Mesh; bucket: number }[] = [];

  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || coreSet.has(child)) continue;
    const armorIndex = child.userData.armorIndex as number | undefined;
    const bucket = maxHp > 1 && (armorIndex ?? 0) >= splitAt ? 1 : 0;
    if (child.userData.satellite !== undefined) {
      retainedPanels.push({ mesh: child, bucket });
      continue;
    }
    const material = child.material as THREE.Material;
    const key = `${bucket}:${material.uuid}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { bucket, material, geometries: [], sources: [] };
      batches.set(key, batch);
    }
    child.updateMatrix();
    const geometry = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    batch.geometries.push(geometry.applyMatrix4(child.matrix));
    batch.sources.push(child);
  }

  const mergedPanels: { mesh: THREE.Mesh; bucket: number }[] = [];
  const compactedSources: THREE.Mesh[] = [];
  for (const batch of batches.values()) {
    if (batch.sources.length === 1) {
      batch.geometries[0].dispose();
      retainedPanels.push({ mesh: batch.sources[0], bucket: batch.bucket });
      continue;
    }
    const geometry = mergeGeometries(batch.geometries, false);
    batch.geometries.forEach((part) => part.dispose());
    if (!geometry) {
      batch.sources.forEach((source) =>
        retainedPanels.push({ mesh: source, bucket: batch.bucket }),
      );
      continue;
    }
    const merged = mesh(geometry, batch.material);
    merged.userData.armorIndex = batch.bucket;
    mergedPanels.push({ mesh: merged, bucket: batch.bucket });
    compactedSources.push(...batch.sources);
  }

  const sourceGeometries = new Set(
    compactedSources.map((source) => source.geometry),
  );
  compactedSources.forEach((source) => group.remove(source));
  sourceGeometries.forEach((geometry) => geometry.dispose());
  panels.length = 0;
  [...mergedPanels, ...retainedPanels]
    .sort((left, right) => left.bucket - right.bucket)
    .forEach(({ mesh: merged }) => {
      group.add(merged);
      panels.push(merged);
    });
}

function addDrone(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const shellGeometry = new THREE.DodecahedronGeometry(3.15, 0);
  const left = armor(mesh(shellGeometry, palette.ceramic, [-3.05, 0.1, 0]), 0);
  const right = armor(mesh(shellGeometry, palette.ceramic, [3.05, 0.1, 0]), 1);
  left.scale.set(1.08, 0.72, 0.62);
  right.scale.set(1.08, 0.72, 0.62);
  left.rotation.z = -0.13;
  right.rotation.z = 0.13;
  group.add(left, right);
  panels.push(left, right);

  const brow = armor(
    mesh(
      new THREE.OctahedronGeometry(2.35, 0),
      palette.ceramicEdge,
      [0, 1.5, 0.2],
    ),
    2,
  );
  brow.scale.set(1.55, 0.48, 0.72);
  group.add(brow);
  panels.push(brow);

  const core = mesh(
    new THREE.BoxGeometry(1.35, 4.2, 1.45),
    palette.amber,
    [0, -0.15, 1.3],
  );
  group.add(core);
  cores.push(core);

  const legGeometry = new THREE.ConeGeometry(0.72, 3.1, 4);
  for (const side of [-1, 1]) {
    for (const inner of [-1, 1]) {
      const leg = mesh(legGeometry, palette.ceramicEdge, [
        side * (2.7 + inner * 1.25),
        -2.75,
        -0.15,
      ]);
      leg.rotation.z = side * (0.42 + inner * 0.08);
      group.add(leg);
    }
  }
}

function addLancer(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const body = armor(
    mesh(new THREE.OctahedronGeometry(3.25, 0), palette.ceramic, [0, 0, 0]),
    0,
  );
  body.scale.set(0.82, 2.05, 0.7);
  group.add(body);
  panels.push(body);

  const spine = armor(
    mesh(
      new THREE.ConeGeometry(1.3, 10.5, 4),
      palette.ceramicEdge,
      [0, 0, 0.6],
    ),
    1,
  );
  group.add(spine);
  panels.push(spine);

  for (const side of [-1, 1]) {
    const fin = armor(
      mesh(new THREE.ConeGeometry(1.05, 6.8, 3), palette.ceramicEdge, [
        side * 3.2,
        -0.2,
        -0.1,
      ]),
      side < 0 ? 2 : 3,
    );
    fin.rotation.z = side * -0.28;
    group.add(fin);
    panels.push(fin);
  }

  const core = mesh(
    new THREE.OctahedronGeometry(1.48, 0),
    palette.amber,
    [0, 0, 2],
  );
  core.scale.y = 2.2;
  group.add(core);
  cores.push(core);
}

function addSpitter(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const hub = armor(
    mesh(
      new THREE.DodecahedronGeometry(3.25, 0),
      palette.ceramic,
      [0, 0.15, 0],
    ),
    0,
  );
  hub.scale.y = 0.8;
  group.add(hub);
  panels.push(hub);

  for (let index = 0; index < 3; index += 1) {
    const angle = -Math.PI / 2 + (index - 1) * 0.82;
    const prong = armor(
      mesh(new THREE.ConeGeometry(1.05, 5.8, 4), palette.ceramicEdge, [
        Math.cos(angle) * 3.7,
        Math.sin(angle) * 2.9,
        0.3,
      ]),
      index + 1,
    );
    prong.rotation.z = angle - Math.PI / 2;
    group.add(prong);
    panels.push(prong);
  }

  const core = mesh(
    new THREE.SphereGeometry(1.5, 12, 8),
    palette.amber,
    [0, -0.35, 2.55],
  );
  group.add(core);
  cores.push(core);
}

function addBastion(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const shoulderGeometry = new THREE.BoxGeometry(4.3, 7.2, 3.4, 2, 2, 1);
  for (const side of [-1, 1]) {
    const shoulder = armor(
      mesh(shoulderGeometry, palette.ceramic, [side * 3.75, 0.6, 0]),
      side < 0 ? 0 : 1,
    );
    shoulder.rotation.z = side * -0.26;
    group.add(shoulder);
    panels.push(shoulder);
    const claw = armor(
      mesh(new THREE.ConeGeometry(1.1, 4.5, 4), palette.ceramicEdge, [
        side * 5,
        -3.4,
        0,
      ]),
      side < 0 ? 2 : 3,
    );
    claw.rotation.z = side * -0.3;
    group.add(claw);
    panels.push(claw);
  }
  const bridge = armor(
    mesh(
      new THREE.BoxGeometry(5.8, 1.6, 3.8),
      palette.titanium,
      [0, 3.15, -0.15],
    ),
    4,
  );
  group.add(bridge);
  panels.push(bridge);
  const core = mesh(
    new THREE.BoxGeometry(1.65, 5.2, 2),
    palette.amber,
    [0, 0.25, 1.8],
  );
  group.add(core);
  cores.push(core);
}

function addConductor(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const trunk = armor(
    mesh(new THREE.BoxGeometry(2.6, 6.2, 2.8), palette.ceramic, [0, -0.6, 0]),
    0,
  );
  trunk.rotation.z = Math.PI / 4;
  group.add(trunk);
  panels.push(trunk);
  for (const side of [-1, 1]) {
    const fork = armor(
      mesh(new THREE.BoxGeometry(2, 7.5, 2.4), palette.ceramicEdge, [
        side * 2.7,
        1.5,
        0,
      ]),
      side < 0 ? 1 : 2,
    );
    fork.rotation.z = side * -0.25;
    group.add(fork);
    panels.push(fork);
    const satellite = armor(
      mesh(new THREE.OctahedronGeometry(1.25, 0), palette.titanium, [
        side * 5.1,
        0,
        0.4,
      ]),
      side < 0 ? 3 : 4,
    );
    satellite.userData.satellite = side;
    group.add(satellite);
    panels.push(satellite);
  }
  const core = mesh(
    new THREE.SphereGeometry(1.45, 12, 8),
    palette.amber,
    [0, -0.6, 2.1],
  );
  group.add(core);
  cores.push(core);
}

function addPetal(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const root = armor(
    mesh(
      new THREE.CylinderGeometry(3.3, 5.1, 8.5, 5),
      palette.ceramic,
      [0, 0, 0],
    ),
    0,
  );
  root.rotation.z = Math.PI / 2;
  root.scale.z = 0.6;
  group.add(root);
  panels.push(root);
  const face = armor(
    mesh(new THREE.ConeGeometry(4.6, 8.2, 5), palette.ceramicEdge, [0, 0, 1.3]),
    1,
  );
  face.rotation.z = -Math.PI / 2;
  face.scale.z = 0.55;
  group.add(face);
  panels.push(face);
  const core = mesh(
    new THREE.SphereGeometry(1.2, 12, 8),
    palette.amber,
    [3.5, 0, 2.1],
  );
  group.add(core);
  cores.push(core);
}

function addCore(
  group: THREE.Group,
  palette: RenderPalette,
  panels: THREE.Mesh[],
  cores: THREE.Object3D[],
): void {
  const outer = armor(
    mesh(new THREE.TorusGeometry(5.4, 1.15, 6, 24), palette.ceramic, [0, 0, 0]),
    0,
  );
  const inner = armor(
    mesh(
      new THREE.TorusGeometry(3.8, 0.55, 5, 24),
      palette.titanium,
      [0, 0, 0.5],
    ),
    1,
  );
  outer.rotation.x = 0.25;
  inner.rotation.y = 0.28;
  group.add(outer, inner);
  panels.push(outer, inner);
  const core = mesh(
    new THREE.IcosahedronGeometry(2.65, 1),
    palette.amber,
    [0, 0, 2],
  );
  group.add(core);
  cores.push(core);
}

export class EnemyView {
  readonly group = new THREE.Group();
  readonly kind: Enemy["kind"];
  private readonly armorPanels: THREE.Mesh[] = [];
  private readonly cores: THREE.Object3D[] = [];
  private readonly telegraph: THREE.Mesh;

  constructor(enemy: Enemy, palette: RenderPalette) {
    this.kind = enemy.kind;
    this.group.renderOrder = 4;
    switch (enemy.kind) {
      case "drone":
        addDrone(this.group, palette, this.armorPanels, this.cores);
        break;
      case "spitter":
        addSpitter(this.group, palette, this.armorPanels, this.cores);
        break;
      case "lancer":
        addLancer(this.group, palette, this.armorPanels, this.cores);
        break;
      case "bastion":
        addBastion(this.group, palette, this.armorPanels, this.cores);
        break;
      case "conductor":
        addConductor(this.group, palette, this.armorPanels, this.cores);
        break;
      case "petal":
        addPetal(this.group, palette, this.armorPanels, this.cores);
        break;
      case "core":
        addCore(this.group, palette, this.armorPanels, this.cores);
        break;
    }
    if (enemy.kind !== "petal" && enemy.kind !== "core") {
      compactEnemyArmor(this.group, this.armorPanels, this.cores, enemy.maxHp);
    }
    this.telegraph = mesh(
      new THREE.TorusGeometry(5.9, 0.14, 4, 32),
      palette.faintCyan,
    );
    this.telegraph.position.z = -0.5;
    this.telegraph.visible = false;
    this.group.add(this.telegraph);
    this.update(enemy, 0, false, true);
  }

  update(
    enemy: Enemy,
    elapsed: number,
    reducedEffects: boolean,
    coreVulnerable = true,
  ): void {
    const motionTime = decorativeTime(elapsed, reducedEffects);
    const canonicalWidth =
      enemy.kind === "core" ? 13 : enemy.kind === "petal" ? 12 : 11;
    const canonicalHeight =
      enemy.kind === "lancer" ? 14 : enemy.kind === "core" ? 13 : 9;
    this.group.position.set(
      enemy.x,
      worldY(enemy.y),
      2.2 + Math.sin(motionTime * 0.7 + enemy.id) * (reducedEffects ? 0 : 0.32),
    );
    this.group.scale.set(
      enemy.width / canonicalWidth,
      enemy.height / canonicalHeight,
      Math.min(enemy.width / canonicalWidth, enemy.height / canonicalHeight),
    );
    this.group.rotation.x = reducedEffects
      ? 0.08
      : 0.12 + Math.sin(motionTime * 0.6 + enemy.id * 0.31) * 0.05;
    this.group.rotation.y = reducedEffects
      ? 0
      : Math.sin(motionTime * 0.48 + enemy.id) * 0.11;

    const hpRatio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 0;
    const visiblePanels = Math.max(
      1,
      Math.ceil(this.armorPanels.length * hpRatio),
    );
    this.armorPanels.forEach((panel, index) => {
      panel.visible = index < visiblePanels;
      const satellite = panel.userData.satellite as number | undefined;
      if (satellite !== undefined) {
        const angle = motionTime * 0.9 + (satellite < 0 ? Math.PI : 0);
        panel.position.x = Math.cos(angle) * 5.2;
        panel.position.y = Math.sin(angle) * 2.8;
      }
    });

    const pulse = reducedEffects
      ? enemy.phase === "telegraph"
        ? 1.12
        : 1
      : 1 +
        Math.sin(
          motionTime * (enemy.phase === "telegraph" ? 10 : 2.4) + enemy.id,
        ) *
          (enemy.phase === "telegraph" ? 0.22 : 0.06);
    const coreScale =
      enemy.kind === "core" ? pulse * (coreVulnerable ? 1.2 : 0.48) : pulse;
    this.cores.forEach((core) => core.scale.setScalar(coreScale));
    if (enemy.kind === "core") {
      const openAmount = coreVulnerable ? 1 : 0;
      const outer = this.armorPanels[0];
      const inner = this.armorPanels[1];
      if (outer) outer.rotation.x = 0.25 + openAmount * 0.72;
      if (inner) inner.rotation.y = 0.28 + openAmount * 0.88;
    }
    this.telegraph.visible = enemy.phase === "telegraph";
    this.telegraph.scale.setScalar(
      reducedEffects ? 1 : 1 + Math.sin(motionTime * 8) * 0.09,
    );
    this.telegraph.rotation.z = motionTime * 0.65;

    if (
      !reducedEffects &&
      enemy.kind === "lancer" &&
      enemy.phase === "diving"
    ) {
      this.group.rotation.z = Math.sin(motionTime * 4 + enemy.id) * 0.07;
    } else {
      this.group.rotation.z = 0;
    }
  }
}

export class PaddleView {
  readonly group = new THREE.Group();
  private readonly energy: THREE.Mesh;
  private readonly innerGlow: THREE.Mesh;
  private readonly energyMaterial: THREE.MeshStandardMaterial;
  private readonly glowMaterial: THREE.MeshBasicMaterial;
  private readonly capMaterial: THREE.MeshStandardMaterial;
  private readonly trimMaterial: THREE.MeshStandardMaterial;
  private readonly leftCap: THREE.Group;
  private readonly rightCap: THREE.Group;
  private readonly ripple: THREE.Mesh;

  constructor(palette: RenderPalette, finish: PaddleFinish = "standard") {
    this.energyMaterial = palette.cyan.clone();
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x4de9ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.capMaterial = palette.titanium.clone();
    this.trimMaterial = palette.ceramicEdge.clone();
    this.energy = mesh(
      new THREE.BoxGeometry(1, 1, 1.25),
      this.energyMaterial,
      [0, 0, 0.5],
    );
    this.innerGlow = mesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.glowMaterial,
      [0, 0, -0.2],
    );
    this.leftCap = this.makeEndcap(-1);
    this.rightCap = this.makeEndcap(1);
    this.ripple = mesh(
      new THREE.TorusGeometry(1, 0.08, 4, 24),
      this.glowMaterial,
      [0, 0.35, 1.4],
    );
    this.ripple.rotation.x = Math.PI / 2;
    this.group.add(
      this.energy,
      this.innerGlow,
      this.leftCap,
      this.rightCap,
      this.ripple,
    );
    this.group.renderOrder = 8;
    this.setFinish(finish);
  }

  private makeEndcap(side: number): THREE.Group {
    const cap = new THREE.Group();
    const block = mesh(new THREE.BoxGeometry(2.3, 3.2, 2.4), this.capMaterial);
    block.rotation.z = Math.PI / 4;
    const ceramic = mesh(
      new THREE.BoxGeometry(1.45, 2.2, 2.8),
      this.trimMaterial,
      [side * 0.65, 0, 0],
    );
    ceramic.rotation.z = Math.PI / 4;
    cap.add(block, ceramic);
    return cap;
  }

  setFinish(finish: PaddleFinish): void {
    const colors = getPaddleFinishColors(finish);
    this.energyMaterial.color.setHex(colors.energy);
    this.energyMaterial.emissive.setHex(colors.emissive);
    this.glowMaterial.color.setHex(colors.glow);
    this.capMaterial.color.setHex(colors.cap);
    this.trimMaterial.color.setHex(colors.trim);
  }

  update(paddle: Paddle, elapsed: number, protectedByGrace: boolean): void {
    this.group.position.set(paddle.x, worldY(paddle.y), 4.5);
    this.energy.scale.set(
      Math.max(0.1, paddle.width),
      Math.max(0.6, paddle.height * 0.72),
      1,
    );
    this.innerGlow.scale.set(
      Math.max(0.1, paddle.width),
      Math.max(0.75, paddle.height * 1.25),
      1,
    );
    const endcapHalfWidth = ((2.3 + 3.2) * Math.SQRT1_2) / 2;
    const endcapCenter = Math.max(0, paddle.width / 2 - endcapHalfWidth);
    this.leftCap.position.x = -endcapCenter;
    this.rightCap.position.x = endcapCenter;
    this.group.scale.y =
      1 + (protectedByGrace ? Math.sin(elapsed * 18) * 0.05 : 0);
    this.ripple.visible = protectedByGrace;
    this.ripple.scale.set(
      paddle.width * (0.055 + ((elapsed * 1.8) % 1) * 0.08),
      1,
      1,
    );
    this.energyMaterial.emissiveIntensity = protectedByGrace
      ? 5.6 + Math.sin(elapsed * 16)
      : 4;
  }

  dispose(): void {
    this.energyMaterial.dispose();
    this.glowMaterial.dispose();
    this.capMaterial.dispose();
    this.trimMaterial.dispose();
  }
}

export class ProjectileView {
  readonly group = new THREE.Group();
  private readonly diamond: THREE.Mesh;

  constructor(palette: RenderPalette) {
    this.diamond = mesh(
      new THREE.OctahedronGeometry(1, 0),
      palette.crimson,
      [0, 0, 1],
    );
    this.diamond.scale.set(0.75, 1.55, 0.5);
    const tail = mesh(
      new THREE.CylinderGeometry(0.05, 0.28, 2.35, 4),
      palette.crimsonTrail,
      [0, 2.55, 0.2],
    );
    this.group.add(this.diamond, tail);
    this.group.renderOrder = 9;
  }

  update(
    projectile: Projectile,
    elapsed: number,
    reducedEffects: boolean,
  ): void {
    this.group.position.set(projectile.x, worldY(projectile.y), 5.5);
    this.group.scale.setScalar(Math.max(0.75, projectile.radius));
    const motionTime = decorativeTime(elapsed, reducedEffects);
    this.diamond.scale.x = reducedEffects
      ? 0.72
      : 0.72 + Math.sin(motionTime * 13 + projectile.id) * 0.08;
  }
}

export class BallView {
  readonly group = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly halo: THREE.Mesh;
  private readonly overdriveRing: THREE.Mesh;
  private readonly fireShell: THREE.Mesh;
  private readonly trail: THREE.InstancedMesh;
  private readonly coreMaterial: THREE.MeshStandardMaterial;
  private readonly ringMaterial: THREE.MeshStandardMaterial;
  private readonly haloMaterial: THREE.MeshBasicMaterial;
  private readonly fireMaterial: THREE.MeshBasicMaterial;
  private readonly trailMaterial: THREE.MeshBasicMaterial;
  private readonly trailTransform = new THREE.Object3D();
  private readonly trailHistory: THREE.Vector2[] = [];
  private lastTrailSample = Number.NEGATIVE_INFINITY;
  private lastBallX = Number.NaN;
  private lastBallY = Number.NaN;

  constructor(palette: RenderPalette, maxTrailSamples = 16) {
    this.coreMaterial = palette.ivory.clone();
    this.core = mesh(
      new THREE.SphereGeometry(1, 16, 12),
      this.coreMaterial,
      [0, 0, 0],
    );
    this.core.name = "ball-core";
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fefff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.halo = mesh(new THREE.SphereGeometry(1.5, 14, 10), this.haloMaterial);
    this.halo.name = "ball-halo";
    this.ringMaterial = palette.cyan.clone();
    this.overdriveRing = mesh(
      new THREE.TorusGeometry(1.65, 0.11, 5, 28),
      this.ringMaterial,
      [0, 0, 0.2],
    );
    this.overdriveRing.name = "ball-overdrive-ring";
    this.fireMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5a12,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });
    this.fireShell = mesh(
      new THREE.IcosahedronGeometry(1.28, 1),
      this.fireMaterial,
      [0, 0, -0.05],
    );
    this.fireShell.name = "ball-fire-shell";
    this.fireShell.visible = false;
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x70dcff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.trail = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.42, 7, 5),
      this.trailMaterial,
      maxTrailSamples,
    );
    this.trail.name = "ball-trail";
    this.trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.trail.count = 0;
    this.trail.frustumCulled = false;
    this.group.add(this.core, this.halo, this.overdriveRing, this.fireShell);
    this.group.renderOrder = 12;
  }

  update(
    ball: Ball,
    overdrive: boolean,
    elapsed: number,
    trailSamples: number,
    reducedEffects: boolean,
    fire = false,
  ): void {
    const motionTime = decorativeTime(elapsed, reducedEffects);
    this.group.position.set(ball.x, worldY(ball.y), 7);
    this.group.scale.setScalar(ball.radius);
    this.halo.scale.setScalar(
      reducedEffects ? 1.05 : 1.05 + Math.sin(motionTime * 8) * 0.06,
    );
    this.coreMaterial.color.setHex(fire ? 0xffe2a3 : 0xfff9e9);
    this.coreMaterial.emissive.setHex(fire ? 0xff4a00 : 0xbcecff);
    this.coreMaterial.emissiveIntensity = fire ? 5.4 : 3.8;
    this.haloMaterial.color.setHex(fire ? 0xff7a1a : 0x9fefff);
    this.haloMaterial.opacity = fire ? 0.3 : 0.18;
    this.ringMaterial.color.setHex(fire ? 0xffb02e : 0x7eefff);
    this.ringMaterial.emissive.setHex(fire ? 0xff3c00 : 0x09bad4);
    this.trailMaterial.color.setHex(fire ? 0xff641c : 0x70dcff);
    this.fireShell.visible = fire;
    this.fireShell.scale.setScalar(
      reducedEffects ? 1 : 1 + Math.sin(motionTime * 11) * 0.07,
    );
    this.fireShell.rotation.set(
      reducedEffects ? 0 : motionTime * 0.7,
      reducedEffects ? 0 : motionTime * 0.45,
      reducedEffects ? 0 : motionTime * 0.3,
    );
    this.overdriveRing.visible = overdrive;
    this.overdriveRing.rotation.z = motionTime * 2;

    const samples = ball.trail?.length
      ? ball.trail
      : this.captureTrail(ball, elapsed, trailSamples);
    const count = Math.min(
      samples.length,
      trailSamples,
      this.trail.instanceMatrix.count,
    );
    const start = samples.length - count;
    for (let index = 0; index < count; index += 1) {
      const sample = samples[start + index];
      const taper = (index + 1) / Math.max(1, count);
      this.trailTransform.position.set(sample.x, worldY(sample.y), 6.5);
      this.trailTransform.scale.setScalar(0.18 + taper * 0.5);
      this.trailTransform.updateMatrix();
      this.trail.setMatrixAt(index, this.trailTransform.matrix);
    }
    this.trail.count = count;
    this.trail.instanceMatrix.needsUpdate = true;
  }

  private captureTrail(
    ball: Ball,
    elapsed: number,
    capacity: number,
  ): { x: number; y: number }[] {
    const jumped =
      Number.isFinite(this.lastBallX) &&
      Math.hypot(ball.x - this.lastBallX, ball.y - this.lastBallY) > 12;
    if (jumped || elapsed < this.lastTrailSample) this.trailHistory.length = 0;
    if (
      !Number.isFinite(this.lastTrailSample) ||
      elapsed - this.lastTrailSample >= 1 / 90
    ) {
      this.trailHistory.push(new THREE.Vector2(ball.x, ball.y));
      while (this.trailHistory.length > Math.max(1, capacity))
        this.trailHistory.shift();
      this.lastTrailSample = elapsed;
      this.lastBallX = ball.x;
      this.lastBallY = ball.y;
    }
    return this.trailHistory;
  }

  attachTrail(scene: THREE.Scene, ballId?: number): void {
    if (ballId !== undefined) this.trail.userData.ballTrailFor = ballId;
    scene.add(this.trail);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.trail.removeFromParent();
    this.core.geometry.dispose();
    this.halo.geometry.dispose();
    this.overdriveRing.geometry.dispose();
    this.fireShell.geometry.dispose();
    this.trail.geometry.dispose();
    this.coreMaterial.dispose();
    this.haloMaterial.dispose();
    this.ringMaterial.dispose();
    this.fireMaterial.dispose();
    this.trailMaterial.dispose();
  }
}

export class BallViewField {
  private readonly views = new Map<number, BallView>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly palette: RenderPalette,
    private readonly maxTrailSamples = 16,
  ) {}

  sync(
    balls: readonly Ball[],
    overdrive: boolean,
    elapsed: number,
    trailSamples: number,
    reducedEffects: boolean,
    fire: boolean,
  ): void {
    const active = new Set<number>();
    for (const ball of balls) {
      active.add(ball.id);
      let view = this.views.get(ball.id);
      if (!view) {
        view = new BallView(this.palette, this.maxTrailSamples);
        view.group.userData.ballId = ball.id;
        view.attachTrail(this.scene, ball.id);
        this.scene.add(view.group);
        this.views.set(ball.id, view);
      }
      view.update(ball, overdrive, elapsed, trailSamples, reducedEffects, fire);
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

export function disposePalette(palette: RenderPalette): void {
  for (const material of Object.values(palette)) material.dispose();
}

export function disposeObjectGeometries(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      geometries.add(child.geometry);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
}
