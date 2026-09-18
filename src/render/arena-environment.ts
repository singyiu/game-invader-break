import * as THREE from "three";
import { decorativeTime, type RenderBudget } from "./render-layout";

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export class ArenaEnvironment {
  readonly group = new THREE.Group();
  private readonly gradient: THREE.Mesh;
  private readonly atmosphere: THREE.Mesh;
  private readonly planet: THREE.Mesh;
  private readonly orbit: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly debris: THREE.InstancedMesh;
  private readonly ambientDust: THREE.Points;
  private readonly gradientMaterial: THREE.ShaderMaterial;
  private readonly atmosphereMaterial: THREE.ShaderMaterial;
  private readonly debrisTransforms: THREE.Object3D[];

  constructor(maxStars: number, maxDebris: number) {
    this.gradientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        accent: { value: new THREE.Color(0x17334b) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        uniform vec3 accent;
        void main() {
          float horizon = smoothstep(0.02, 0.88, vUv.y);
          float quietPulse = sin(time * 0.08 + vUv.x * 2.2) * 0.012;
          vec3 bottom = vec3(0.008, 0.020, 0.043);
          vec3 top = vec3(0.018, 0.055, 0.088) + accent * 0.10;
          vec3 color = mix(bottom, top, horizon) + quietPulse * accent;
          float orbitalHaze = exp(-18.0 * distance(vUv, vec2(0.73, 0.78)));
          float dustLane = exp(-42.0 * abs(vUv.y - (0.72 - vUv.x * 0.10)));
          color += accent * (orbitalHaze * 0.22 + dustLane * 0.035);
          float vignette = 1.0 - 0.3 * smoothstep(0.38, 0.82, distance(vUv, vec2(0.5)));
          gl_FragColor = vec4(color * vignette, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false,
    });
    this.gradient = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 190),
      this.gradientMaterial,
    );
    this.gradient.position.set(50, 50, -44);

    const planetMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 lightDirection = normalize(vec3(0.92, 0.12, 0.18));
          float light = smoothstep(-0.08, 0.72, dot(normal, lightDirection));
          float limb = pow(1.0 - max(normal.z, 0.0), 2.3);
          float bands = 0.93 + 0.07 * sin(vUv.y * 96.0 + sin(vUv.x * 13.0) * 2.0);
          vec3 night = vec3(0.002, 0.008, 0.018);
          vec3 day = vec3(0.055, 0.16, 0.25) * bands;
          vec3 color = mix(night, day, light * 0.72) + limb * vec3(0.012, 0.045, 0.075);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(25, 40, 24),
      planetMaterial,
    );
    this.planet.position.set(84, 81, -30);
    this.planet.scale.y = 1.04;

    this.atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: { strength: { value: 0.74 } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        uniform float strength;
        void main() {
          float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.2);
          vec3 color = mix(vec3(0.05, 0.24, 0.42), vec3(0.38, 0.76, 1.0), rim);
          gl_FragColor = vec4(color, rim * 0.58 * strength);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(26.15, 40, 24),
      this.atmosphereMaterial,
    );
    this.atmosphere.position.copy(this.planet.position);

    const orbitMaterial = new THREE.MeshStandardMaterial({
      color: 0x304b61,
      emissive: 0x0b2940,
      emissiveIntensity: 0.72,
      metalness: 0.34,
      roughness: 0.4,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    this.orbit = new THREE.Mesh(
      new THREE.TorusGeometry(53, 0.46, 5, 104, Math.PI * 1.58),
      orbitMaterial,
    );
    this.orbit.position.set(49, 73, -27);
    this.orbit.rotation.set(1.03, 0.1, -0.13);

    const starPositions = new Float32Array(maxStars * 3);
    const starColors = new Float32Array(maxStars * 3);
    for (let index = 0; index < maxStars; index += 1) {
      starPositions[index * 3] = -40 + seeded(index, 1) * 180;
      starPositions[index * 3 + 1] = -10 + seeded(index, 2) * 125;
      starPositions[index * 3 + 2] = -39 + seeded(index, 3) * 7;
      const light = 0.42 + seeded(index, 4) * 0.48;
      starColors[index * 3] = light * 0.68;
      starColors[index * 3 + 1] = light * 0.84;
      starColors[index * 3 + 2] = light;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(starColors, 3),
    );
    this.stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        size: 0.22,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );

    const debrisGeometry = new THREE.DodecahedronGeometry(0.8, 0);
    const debrisMaterial = new THREE.MeshStandardMaterial({
      color: 0x101a25,
      metalness: 0.72,
      roughness: 0.58,
    });
    this.debris = new THREE.InstancedMesh(
      debrisGeometry,
      debrisMaterial,
      maxDebris,
    );
    this.debrisTransforms = Array.from({ length: maxDebris }, (_, index) => {
      const transform = new THREE.Object3D();
      transform.position.set(
        -15 + seeded(index, 5) * 145,
        53 + seeded(index, 6) * 44,
        -24 + seeded(index, 7) * 8,
      );
      transform.scale.setScalar(0.25 + seeded(index, 8) * 1.5);
      return transform;
    });

    const dustPositions = new Float32Array(64 * 3);
    for (let index = 0; index < 64; index += 1) {
      dustPositions[index * 3] = seeded(index, 9) * 100;
      dustPositions[index * 3 + 1] = seeded(index, 10) * 100;
      dustPositions[index * 3 + 2] = -9 - seeded(index, 11) * 10;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(dustPositions, 3),
    );
    this.ambientDust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        color: 0x4d8cab,
        size: 0.13,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );

    this.group.add(
      this.gradient,
      this.stars,
      this.planet,
      this.atmosphere,
      this.orbit,
      this.debris,
      this.ambientDust,
    );
    this.addRunwayMarkers();
    this.addFlankStructures();
    this.group.renderOrder = -10;
  }

  private addFlankStructures(): void {
    const material = new THREE.LineBasicMaterial({
      color: 0x285e78,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const points: THREE.Vector3[] = [];
    const addBrokenArc = (
      centerX: number,
      centerY: number,
      radiusX: number,
      radiusY: number,
      start: number,
      end: number,
    ): void => {
      const segments = 58;
      for (let index = 0; index < segments; index += 1) {
        if (index % 9 === 7 || index % 9 === 8) continue;
        const first = start + ((end - start) * index) / segments;
        const second = start + ((end - start) * (index + 1)) / segments;
        points.push(
          new THREE.Vector3(
            centerX + Math.cos(first) * radiusX,
            centerY + Math.sin(first) * radiusY,
            -18,
          ),
          new THREE.Vector3(
            centerX + Math.cos(second) * radiusX,
            centerY + Math.sin(second) * radiusY,
            -18,
          ),
        );
      }
    };

    addBrokenArc(-55, 48, 55, 58, -1.18, 1.18);
    addBrokenArc(-55, 48, 68, 72, -1.08, 1.08);
    addBrokenArc(155, 47, 55, 58, Math.PI - 1.15, Math.PI + 1.15);
    addBrokenArc(155, 47, 68, 72, Math.PI - 1.05, Math.PI + 1.05);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.group.add(new THREE.LineSegments(geometry, material));
  }

  private addRunwayMarkers(): void {
    const material = new THREE.LineBasicMaterial({
      color: 0x38728f,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const points: THREE.Vector3[] = [];
    for (let y = 8; y < 96; y += 9) {
      points.push(
        new THREE.Vector3(1.1, y, -4),
        new THREE.Vector3(y % 18 === 8 ? 4.2 : 3, y, -4),
      );
      points.push(
        new THREE.Vector3(98.9, y, -4),
        new THREE.Vector3(y % 18 === 8 ? 95.8 : 97, y, -4),
      );
    }
    points.push(new THREE.Vector3(5, 10, -4), new THREE.Vector3(95, 10, -4));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.group.add(new THREE.LineSegments(geometry, material));

    const boundaryMaterial = new THREE.LineBasicMaterial({
      color: 0x67cfe8,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const boundaryGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -2.5),
      new THREE.Vector3(0, 100, -2.5),
      new THREE.Vector3(100, 0, -2.5),
      new THREE.Vector3(100, 100, -2.5),
      new THREE.Vector3(0, 100, -2.5),
      new THREE.Vector3(100, 100, -2.5),
      new THREE.Vector3(0, 0, -2.5),
      new THREE.Vector3(100, 0, -2.5),
    ]);
    this.group.add(new THREE.LineSegments(boundaryGeometry, boundaryMaterial));
  }

  setBudget(budget: RenderBudget, reducedEffects: boolean): void {
    this.stars.geometry.setDrawRange(0, budget.starCount);
    this.debris.count = budget.debrisCount;
    this.ambientDust.visible = !reducedEffects;
  }

  update(elapsed: number, sector: number, reducedEffects: boolean): void {
    const motionTime = decorativeTime(elapsed, reducedEffects);
    this.gradientMaterial.uniforms.time.value = motionTime;
    const accent = this.gradientMaterial.uniforms.accent.value as THREE.Color;
    if (sector >= 3) accent.setHex(0x514579);
    else if (sector === 2) accent.setHex(0x66351e);
    else accent.setHex(0x17334b);

    this.planet.rotation.y = motionTime * 0.012;
    this.orbit.rotation.z = -0.13 + motionTime * 0.007;
    this.atmosphereMaterial.uniforms.strength.value = reducedEffects
      ? 0.44
      : 0.74 + Math.sin(motionTime * 0.22) * 0.06;
    this.stars.position.x = reducedEffects
      ? 0
      : Math.sin(motionTime * 0.035) * 0.45;
    this.ambientDust.position.y = reducedEffects ? 0 : (motionTime * 0.16) % 4;

    for (let index = 0; index < this.debris.count; index += 1) {
      const transform = this.debrisTransforms[index];
      transform.rotation.set(
        motionTime * (0.025 + seeded(index, 12) * 0.04),
        motionTime * (0.03 + seeded(index, 13) * 0.035),
        seeded(index, 14) * Math.PI,
      );
      transform.updateMatrix();
      this.debris.setMatrixAt(index, transform.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((child) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.Points
      ) {
        geometries.add(child.geometry);
        if (Array.isArray(child.material))
          child.material.forEach((material) => materials.add(material));
        else materials.add(child.material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
