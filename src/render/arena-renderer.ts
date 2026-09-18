import * as THREE from "three";
import type {
  Enemy,
  GameEvent,
  GameState,
  RenderOptions,
} from "../shared/contracts";
import { ArenaEnvironment } from "./arena-environment";
import { EffectField } from "./effects";
import {
  BallViewField,
  EnemyView,
  PaddleView,
  ProjectileView,
  createRenderPalette,
  disposeObjectGeometries,
  disposePalette,
  type RenderPalette,
} from "./entity-views";
import { PowerPickupViewField } from "./power-pickup-view";
import type { PaddleFinish } from "./paddle-finish";
import { FlightPathView } from "./flight-path-view";
import {
  calculateArenaFrustum,
  decorativeTime,
  deriveRenderBudget,
  type RenderBudget,
} from "./render-layout";

export interface RenderStats {
  drawCalls: number;
  triangles: number;
}

const DEFAULT_OPTIONS: RenderOptions = {
  quality: "auto",
  reducedEffects: false,
};
const ENEMY_KINDS: Enemy["kind"][] = [
  "drone",
  "spitter",
  "lancer",
  "bastion",
  "conductor",
  "petal",
  "core",
];

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : 1;
}

export class ArenaRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(
    0,
    100,
    100,
    0,
    0.1,
    260,
  );
  private readonly palette: RenderPalette;
  private readonly environment: ArenaEnvironment;
  private readonly effects: EffectField;
  private readonly balls: BallViewField;
  private readonly pickups: PowerPickupViewField;
  private readonly enemyCoreGlows: THREE.InstancedMesh;
  private readonly coreGlowTransform = new THREE.Object3D();
  private readonly bossMechanism: THREE.Group;
  private readonly enemyViews = new Map<number, EnemyView>();
  private readonly flightPathViews = new Map<number, FlightPathView>();
  private readonly paddleViews = new Map<number, PaddleView>();
  private readonly projectileViews = new Map<number, ProjectileView>();
  private readonly keyLight: THREE.DirectionalLight;
  private readonly coreLight: THREE.PointLight;
  private options: RenderOptions = { ...DEFAULT_OPTIONS };
  private paddleFinish: PaddleFinish = "standard";
  private budget: RenderBudget;
  private width = 1;
  private height = 1;
  private disposed = false;
  private contextLost = false;
  private readonly contextLostCallback?: () => void;

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.contextLostCallback?.();
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.renderer.setPixelRatio(this.budget.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.warmShaders();
  };

  constructor(canvas: HTMLCanvasElement, onContextLost?: () => void) {
    this.canvas = canvas;
    this.contextLostCallback = onContextLost;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.setClearColor(0x030812, 1);
    this.renderer.info.autoReset = true;

    this.camera.position.set(0, 0, 120);
    this.camera.lookAt(0, 0, 0);
    this.palette = createRenderPalette();
    this.budget = deriveRenderBudget(
      this.options,
      globalThis.devicePixelRatio ?? 1,
    );
    this.environment = new ArenaEnvironment(150, 30);
    this.effects = new EffectField(96, this.palette);
    this.balls = new BallViewField(this.scene, this.palette);
    this.pickups = new PowerPickupViewField(this.scene);
    this.enemyCoreGlows = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      this.palette.amberGlow,
      40,
    );
    this.enemyCoreGlows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyCoreGlows.count = 0;
    this.enemyCoreGlows.frustumCulled = false;
    this.enemyCoreGlows.renderOrder = 6;
    this.bossMechanism = this.createBossMechanism();
    this.scene.add(
      this.environment.group,
      this.bossMechanism,
      this.enemyCoreGlows,
      this.effects.group,
    );

    const hemisphere = new THREE.HemisphereLight(0xb8e7ff, 0x07111e, 2.1);
    this.keyLight = new THREE.DirectionalLight(0xd9efff, 4.4);
    this.keyLight.position.set(-28, 70, 90);
    const fillLight = new THREE.DirectionalLight(0x59b9e8, 1.65);
    fillLight.position.set(76, 12, 46);
    this.coreLight = new THREE.PointLight(0xff8a38, 23, 58, 2);
    this.coreLight.position.set(50, 75, 20);
    const shieldLight = new THREE.PointLight(0x39dfff, 18, 42, 2);
    shieldLight.position.set(50, 12, 20);
    this.scene.add(
      hemisphere,
      this.keyLight,
      fillLight,
      this.coreLight,
      shieldLight,
    );

    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    this.setOptions(this.options);
    this.resize(
      canvas.clientWidth || canvas.width || 1,
      canvas.clientHeight || canvas.height || 1,
    );
    this.warmShaders();
  }

  get stats(): RenderStats {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.width = positiveDimension(width);
    this.height = positiveDimension(height);
    const frustum = calculateArenaFrustum(this.width, this.height);
    this.camera.left = frustum.left;
    this.camera.right = frustum.right;
    this.camera.top = 100 - frustum.top;
    this.camera.bottom = 100 - frustum.bottom;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.budget.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
  }

  setOptions(options: RenderOptions): void {
    if (this.disposed) return;
    this.options = { ...options };
    this.budget = deriveRenderBudget(
      this.options,
      globalThis.devicePixelRatio ?? 1,
    );
    this.effects.setCapacity(this.budget.effectCapacity);
    this.environment.setBudget(this.budget, this.options.reducedEffects);
    this.renderer.setPixelRatio(this.budget.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
  }

  setFinish(finish: PaddleFinish): void {
    if (this.disposed || this.paddleFinish === finish) return;
    this.paddleFinish = finish;
    for (const view of this.paddleViews.values()) view.setFinish(finish);
  }

  render(state: GameState, events: GameEvent[], elapsedSeconds: number): void {
    if (this.disposed || this.contextLost) return;
    const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
    this.environment.update(elapsed, state.sector, this.options.reducedEffects);
    this.syncFlightPaths(state, elapsed);
    this.syncEnemies(state, elapsed);
    this.syncPaddles(state, elapsed);
    this.syncProjectiles(state, elapsed);
    this.balls.sync(
      [state.ball, ...state.extraBalls],
      state.overdriveUntil > state.time,
      elapsed,
      this.budget.trailSamples,
      this.options.reducedEffects,
      state.powers.fire > 0,
    );
    this.pickups.sync(state.pickups, elapsed, this.options.reducedEffects);

    for (const event of events)
      this.effects.spawn(event, elapsed, this.options.reducedEffects);
    this.effects.update(elapsed);

    const motionTime = decorativeTime(elapsed, this.options.reducedEffects);
    this.keyLight.intensity = this.options.reducedEffects
      ? 4.25
      : 4.25 + Math.sin(motionTime * 0.19) * 0.15;
    this.coreLight.intensity = this.options.reducedEffects
      ? 21
      : 21 + Math.sin(motionTime * 1.4) * 2;
    this.renderer.render(this.scene, this.camera);
  }

  private syncEnemies(state: GameState, elapsed: number): void {
    const enemies = state.enemies;
    const active = new Set<number>();
    const coreVulnerable =
      state.bossPhase >= 3 || (state.bossPhase === 2 && state.time % 5 < 3.6);
    for (const enemy of enemies) {
      active.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);
      if (!view || view.kind !== enemy.kind) {
        if (view) this.removeEnemyView(enemy.id, view);
        view = new EnemyView(enemy, this.palette);
        this.enemyViews.set(enemy.id, view);
        this.scene.add(view.group);
      }
      view.update(enemy, elapsed, this.options.reducedEffects, coreVulnerable);
    }
    for (const [id, view] of this.enemyViews) {
      if (!active.has(id)) this.removeEnemyView(id, view);
    }
    this.updateEnemyCoreGlows(enemies, elapsed, coreVulnerable);
    this.updateBossMechanism(state, elapsed, coreVulnerable);
  }

  private syncFlightPaths(state: GameState, elapsed: number): void {
    const active = new Set<number>();
    for (const enemy of state.enemies) {
      if (
        !enemy.flight ||
        (enemy.phase !== "telegraph" && enemy.phase !== "diving")
      )
        continue;
      active.add(enemy.id);
      let view = this.flightPathViews.get(enemy.id);
      if (!view) {
        view = new FlightPathView();
        this.flightPathViews.set(enemy.id, view);
        this.scene.add(view.group);
      }
      view.update(enemy, elapsed, this.options.reducedEffects);
    }
    for (const [id, view] of this.flightPathViews) {
      if (active.has(id)) continue;
      this.scene.remove(view.group);
      view.dispose();
      this.flightPathViews.delete(id);
    }
  }

  private updateEnemyCoreGlows(
    enemies: Enemy[],
    elapsed: number,
    coreVulnerable: boolean,
  ): void {
    const count = Math.min(
      enemies.length,
      this.enemyCoreGlows.instanceMatrix.count,
    );
    const motionTime = decorativeTime(elapsed, this.options.reducedEffects);
    for (let index = 0; index < count; index += 1) {
      const enemy = enemies[index];
      const pulse = this.options.reducedEffects
        ? 1
        : 1 + Math.sin(motionTime * 2.4 + enemy.id) * 0.08;
      const scale =
        Math.min(enemy.width, enemy.height) *
        (enemy.kind === "core" ? (coreVulnerable ? 0.22 : 0.1) : 0.13) *
        pulse;
      this.coreGlowTransform.position.set(
        enemy.x + (enemy.kind === "petal" ? enemy.width * 0.28 : 0),
        100 - enemy.y,
        5.1,
      );
      this.coreGlowTransform.rotation.set(0, 0, 0);
      this.coreGlowTransform.scale.setScalar(scale);
      this.coreGlowTransform.updateMatrix();
      this.enemyCoreGlows.setMatrixAt(index, this.coreGlowTransform.matrix);
    }
    this.enemyCoreGlows.count = count;
    this.enemyCoreGlows.instanceMatrix.needsUpdate = true;
  }

  private createBossMechanism(): THREE.Group {
    const mechanism = new THREE.Group();
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.55, 5, 64),
      this.palette.ceramicEdge,
    );
    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(22, 0.28, 4, 72),
      this.palette.titanium,
    );
    ringA.userData.bossRing = 1;
    ringB.userData.bossRing = -1;
    ringA.rotation.x = 0.5;
    ringB.rotation.y = 0.42;
    mechanism.add(ringA, ringB);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.55, 0.8),
        this.palette.ceramic,
      );
      spoke.position.set(Math.cos(angle) * 10.8, Math.sin(angle) * 10.8, -0.4);
      spoke.rotation.z = angle;
      mechanism.add(spoke);
    }
    const reactorRing = new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.2, 4, 48),
      this.palette.amber,
    );
    reactorRing.userData.reactorRing = true;
    mechanism.add(reactorRing);
    mechanism.position.set(50, 76, -0.5);
    mechanism.visible = false;
    mechanism.renderOrder = 2;
    return mechanism;
  }

  private updateBossMechanism(
    state: GameState,
    elapsed: number,
    coreVulnerable: boolean,
  ): void {
    const bossParts = state.enemies.filter(
      (enemy) => enemy.kind === "petal" || enemy.kind === "core",
    );
    this.bossMechanism.visible = state.bossPhase > 0 && bossParts.length > 0;
    if (!this.bossMechanism.visible) return;
    const centerX =
      bossParts.reduce((sum, enemy) => sum + enemy.x, 0) / bossParts.length;
    const centerY =
      bossParts.reduce((sum, enemy) => sum + enemy.y, 0) / bossParts.length;
    this.bossMechanism.position.set(centerX, 100 - centerY, -0.5);
    const motionTime = decorativeTime(elapsed, this.options.reducedEffects);
    this.bossMechanism.children.forEach((child) => {
      const direction = child.userData.bossRing as number | undefined;
      if (direction) child.rotation.z = motionTime * 0.08 * direction;
      if (child.userData.reactorRing) {
        child.visible = state.bossPhase >= 2;
        child.scale.setScalar(
          (coreVulnerable ? 1 : 0.72) +
            (this.options.reducedEffects
              ? 0
              : Math.sin(motionTime * 3) * 0.025),
        );
      }
    });
  }

  private syncPaddles(state: GameState, elapsed: number): void {
    const active = new Set<number>();
    const protectedByGrace = state.graceUntil > state.time;
    for (const paddle of state.paddles) {
      active.add(paddle.id);
      let view = this.paddleViews.get(paddle.id);
      if (!view) {
        view = new PaddleView(this.palette, this.paddleFinish);
        this.paddleViews.set(paddle.id, view);
        this.scene.add(view.group);
      }
      view.update(paddle, elapsed, protectedByGrace);
    }
    for (const [id, view] of this.paddleViews) {
      if (active.has(id)) continue;
      this.scene.remove(view.group);
      disposeObjectGeometries(view.group);
      view.dispose();
      this.paddleViews.delete(id);
    }
  }

  private syncProjectiles(state: GameState, elapsed: number): void {
    const active = new Set<number>();
    for (const projectile of state.projectiles) {
      active.add(projectile.id);
      let view = this.projectileViews.get(projectile.id);
      if (!view) {
        view = new ProjectileView(this.palette);
        this.projectileViews.set(projectile.id, view);
        this.scene.add(view.group);
      }
      view.update(projectile, elapsed, this.options.reducedEffects);
    }
    for (const [id, view] of this.projectileViews) {
      if (active.has(id)) continue;
      this.scene.remove(view.group);
      disposeObjectGeometries(view.group);
      this.projectileViews.delete(id);
    }
  }

  private removeEnemyView(id: number, view: EnemyView): void {
    this.scene.remove(view.group);
    disposeObjectGeometries(view.group);
    this.enemyViews.delete(id);
  }

  private warmShaders(): void {
    if (this.contextLost || this.disposed) return;
    const warmup = new THREE.Group();
    for (let index = 0; index < ENEMY_KINDS.length; index += 1) {
      const enemy: Enemy = {
        id: -index - 1,
        kind: ENEMY_KINDS[index],
        x: -500 - index * 20,
        y: -500,
        width: 10,
        height: 9,
        hp: 2,
        maxHp: 2,
        phase: "formation",
        phaseTime: 0,
        lane: 0,
        originX: 0,
        originY: 0,
      };
      const view = new EnemyView(enemy, this.palette);
      view.group.traverse((child) => {
        child.frustumCulled = false;
      });
      warmup.add(view.group);
    }
    this.scene.add(warmup);
    this.renderer.compile(this.scene, this.camera);
    this.scene.remove(warmup);
    disposeObjectGeometries(warmup);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );

    for (const view of this.enemyViews.values())
      disposeObjectGeometries(view.group);
    for (const view of this.flightPathViews.values()) view.dispose();
    for (const view of this.paddleViews.values()) {
      disposeObjectGeometries(view.group);
      view.dispose();
    }
    for (const view of this.projectileViews.values())
      disposeObjectGeometries(view.group);
    this.enemyViews.clear();
    this.flightPathViews.clear();
    this.paddleViews.clear();
    this.projectileViews.clear();
    this.environment.dispose();
    this.effects.dispose();
    this.balls.dispose();
    this.pickups.dispose();
    this.enemyCoreGlows.geometry.dispose();
    disposeObjectGeometries(this.bossMechanism);
    disposePalette(this.palette);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.scene.clear();
  }
}
