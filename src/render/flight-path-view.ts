import * as THREE from "three";
import type { Enemy } from "../shared/contracts";
import { flightDuration, flightPosition } from "../game/flight";

const SAMPLE_COUNT = 33;

export class FlightPathView {
  readonly group = new THREE.Group();
  private readonly positions = new Float32Array(SAMPLE_COUNT * 3);
  private readonly distances = new Float32Array(SAMPLE_COUNT);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly lineMaterial = new THREE.LineDashedMaterial({
    color: 0xff7a24,
    dashSize: 1.5,
    gapSize: 1.05,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly line: THREE.Line;
  private readonly endpointMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa347,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  private readonly endpoint: THREE.Mesh;

  constructor() {
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "lineDistance",
      new THREE.BufferAttribute(this.distances, 1),
    );
    this.line = new THREE.Line(this.geometry, this.lineMaterial);
    this.line.name = "flight-path-line";
    this.line.frustumCulled = false;
    this.endpoint = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1.08, 24),
      this.endpointMaterial,
    );
    this.endpoint.name = "flight-path-endpoint";
    this.endpoint.position.z = 0.02;
    this.group.add(this.line, this.endpoint);
    this.group.position.z = 1.65;
    this.group.renderOrder = 3;
    this.group.visible = false;
  }

  update(enemy: Enemy, elapsed: number, reducedEffects: boolean): void {
    const flight = enemy.flight;
    if (!flight || (enemy.phase !== "telegraph" && enemy.phase !== "diving")) {
      this.group.visible = false;
      return;
    }

    const duration = flightDuration(flight);
    const startTime = enemy.phase === "diving" ? enemy.phaseTime : 0;
    const endTime = startTime < duration ? duration : duration * 2;
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      startTime >= duration * 2
    ) {
      this.group.visible = false;
      return;
    }

    let previousX = 0;
    let previousY = 0;
    let distance = 0;
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const progress = index / (SAMPLE_COUNT - 1);
      const point = flightPosition(
        flight,
        startTime + (endTime - startTime) * progress,
      );
      const worldY = 100 - point.y;
      const offset = index * 3;
      this.positions[offset] = point.x;
      this.positions[offset + 1] = worldY;
      this.positions[offset + 2] = 0;
      if (index > 0)
        distance += Math.hypot(point.x - previousX, worldY - previousY);
      this.distances[index] = distance;
      previousX = point.x;
      previousY = worldY;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.lineDistance.needsUpdate = true;

    const endpointOffset = (SAMPLE_COUNT - 1) * 3;
    this.endpoint.position.x = this.positions[endpointOffset];
    this.endpoint.position.y = this.positions[endpointOffset + 1];
    const pulse = reducedEffects ? 1 : 1 + Math.sin(elapsed * 6) * 0.09;
    this.endpoint.scale.setScalar(pulse);
    const telegraphing = enemy.phase === "telegraph";
    this.lineMaterial.opacity = telegraphing ? 0.78 : 0.32;
    this.endpointMaterial.opacity = telegraphing ? 0.9 : 0.42;
    this.group.visible = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.lineMaterial.dispose();
    this.endpoint.geometry.dispose();
    this.endpointMaterial.dispose();
  }
}
