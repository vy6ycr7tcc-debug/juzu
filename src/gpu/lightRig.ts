/**
 * Module: src/gpu/lightRig.ts
 * Responsibility: Photorealistic 4-light Andean exterior rig (Directional Sun +
 * soft shadows, Hemisphere Sky/Ground fill, opposite-direction Terrain Bounce fill,
 * and subtle Character Rim kicker) + 5 Time-of-Day grades and max-8 pooled local
 * point lights per Bible §2.3 and §5.2.
 * Depends on: three, src/gpu/tsl.ts.
 * Exports: TimeOfDayGrade, LightRig.
 */

import * as THREE from 'three';
import { sharedUniforms } from './tsl';

export type TimeOfDayGrade = 'dawn' | 'noon' | 'afternoon' | 'dusk' | 'night';

interface GradeSpec {
  sunAzimuth: number;
  sunElevation: number;
  sunColor: number;
  sunIntensity: number;
  skyColor: number;
  groundColor: number;
  hemiIntensity: number;
  bounceColor: number;
  bounceIntensity: number;
  rimColor: number;
  rimIntensity: number;
  fogColor: number;
  fogDensity: number;
  exposure: number;
}

const GRADES: Record<TimeOfDayGrade, GradeSpec> = {
  dawn: {
    sunAzimuth: 0.65,
    sunElevation: 0.38,
    sunColor: 0xffc8a6,
    sunIntensity: 3.1,
    skyColor: 0x88b0d0,
    groundColor: 0x45543e,
    hemiIntensity: 1.15,
    bounceColor: 0x788c72,
    bounceIntensity: 0.68,
    rimColor: 0xffd8be,
    rimIntensity: 0.52,
    fogColor: 0xb6cad8,
    fogDensity: 0.0018,
    exposure: 1.12,
  },
  noon: {
    sunAzimuth: 0.95,
    sunElevation: 1.05,
    sunColor: 0xfff8eb,
    sunIntensity: 3.5,
    skyColor: 0x7cb0e0,
    groundColor: 0x4e5c42,
    hemiIntensity: 1.28,
    bounceColor: 0x7a926a,
    bounceIntensity: 0.75,
    rimColor: 0xe4f2ff,
    rimIntensity: 0.45,
    fogColor: 0xb8d0e4,
    fogDensity: 0.0014,
    exposure: 1.10,
  },
  afternoon: {
    sunAzimuth: 0.78,
    sunElevation: 0.62,
    sunColor: 0xffebc8,
    sunIntensity: 3.3,
    skyColor: 0x84b0d2,
    groundColor: 0x46563d,
    hemiIntensity: 1.18,
    bounceColor: 0x788a66,
    bounceIntensity: 0.7,
    rimColor: 0xffe6bc,
    rimIntensity: 0.48,
    fogColor: 0xa8c2ba,
    fogDensity: 0.0020,
    exposure: 1.14,
  },
  dusk: {
    sunAzimuth: -0.72,
    sunElevation: 0.28,
    sunColor: 0xff9454,
    sunIntensity: 2.5,
    skyColor: 0x66749c,
    groundColor: 0x3b3430,
    hemiIntensity: 0.92,
    bounceColor: 0x6a564b,
    bounceIntensity: 0.55,
    rimColor: 0xffa86b,
    rimIntensity: 0.55,
    fogColor: 0x887e8e,
    fogDensity: 0.0024,
    exposure: 1.08,
  },
  night: {
    sunAzimuth: -0.85,
    sunElevation: 0.75,
    sunColor: 0x8bb0e0,
    sunIntensity: 1.15,
    skyColor: 0x243654,
    groundColor: 0x1e2b24,
    hemiIntensity: 0.68,
    bounceColor: 0x304258,
    bounceIntensity: 0.42,
    rimColor: 0x98c0f2,
    rimIntensity: 0.42,
    fogColor: 0x243448,
    fogDensity: 0.0028,
    exposure: 1.02,
  },
};

const _sunOffset = new THREE.Vector3();
const _rimOffset = new THREE.Vector3();

export class LightRig {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly sunLight: THREE.DirectionalLight;
  public readonly skyFill: THREE.HemisphereLight;
  public readonly bounceLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly localLights: THREE.PointLight[] = [];

  private currentGrade: TimeOfDayGrade = 'afternoon';
  private elapsedSec: number = 0;

  constructor(shadowMapSize: number = 2048) {
    this.group.name = 'AndeanLightRig';

    this.sunLight = new THREE.DirectionalLight(0xffebc8, 3.3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.sunLight.shadow.camera.near = 2.0;
    this.sunLight.shadow.camera.far = 160.0;
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.022;

    this.skyFill = new THREE.HemisphereLight(0x84b0d2, 0x46563d, 1.18);
    this.skyFill.position.set(0, 60, 0);

    this.bounceLight = new THREE.DirectionalLight(0x788a66, 0.7);
    this.bounceLight.castShadow = false;

    this.rimLight = new THREE.DirectionalLight(0xffe6bc, 0.48);
    this.rimLight.castShadow = false;

    this.group.add(
      this.sunLight,
      this.sunLight.target,
      this.skyFill,
      this.bounceLight,
      this.bounceLight.target,
      this.rimLight,
      this.rimLight.target
    );

    for (let i = 0; i < 4; i++) {
      const pt = new THREE.PointLight(0xff8c3b, 0.0, 14.0, 1.8);
      pt.castShadow = false;
      this.localLights.push(pt);
      this.group.add(pt);
    }
  }

  public build(scene: THREE.Scene, renderer?: THREE.WebGLRenderer): void {
    scene.add(this.group);
    this.applyGrade(this.currentGrade, renderer);
  }

  public setShadowMapSize(size: number): void {
    if (this.sunLight.shadow.mapSize.x === size) return;
    this.sunLight.shadow.mapSize.set(size, size);
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  public getGrade(): TimeOfDayGrade {
    return this.currentGrade;
  }

  public applyGrade(grade: TimeOfDayGrade, renderer?: THREE.WebGLRenderer): void {
    this.currentGrade = grade;
    const spec = GRADES[grade];

    const cosEl = Math.cos(spec.sunElevation);
    const sx = Math.cos(spec.sunAzimuth) * cosEl;
    const sy = Math.sin(spec.sunElevation);
    const sz = Math.sin(spec.sunAzimuth) * cosEl;

    sharedUniforms.uSunDir.value.set(sx, sy, sz).normalize();
    sharedUniforms.uSunColor.value.setHex(spec.sunColor);
    sharedUniforms.uFogColor.value.setHex(spec.fogColor);
    sharedUniforms.uFogDensity.value = spec.fogDensity;

    this.sunLight.color.setHex(spec.sunColor);
    this.sunLight.intensity = spec.sunIntensity;

    this.skyFill.color.setHex(spec.skyColor);
    this.skyFill.groundColor.setHex(spec.groundColor);
    this.skyFill.intensity = spec.hemiIntensity;

    this.bounceLight.color.setHex(spec.bounceColor);
    this.bounceLight.intensity = spec.bounceIntensity;
    this.bounceLight.position.set(-sx * 40, 22, -sz * 40);

    this.rimLight.color.setHex(spec.rimColor);
    this.rimLight.intensity = spec.rimIntensity;

    if (renderer) {
      renderer.toneMappingExposure = spec.exposure;
    }
  }

  public placeTorchLight(index: number, x: number, y: number, z: number, intensity: number = 2.4): void {
    if (index < 0 || index >= this.localLights.length) return;
    const pt = this.localLights[index];
    pt.position.set(x, y, z);
    pt.intensity = intensity;
  }

  public update(dt: number, focusPosition: THREE.Vector3): void {
    this.elapsedSec += dt;

    _sunOffset.copy(sharedUniforms.uSunDir.value).multiplyScalar(55);
    this.sunLight.position.copy(focusPosition).add(_sunOffset);
    this.sunLight.target.position.copy(focusPosition);
    this.sunLight.target.updateMatrixWorld();

    _rimOffset.copy(sharedUniforms.uSunDir.value).multiplyScalar(-24);
    _rimOffset.y = 14;
    this.rimLight.position.copy(focusPosition).add(_rimOffset);
    this.rimLight.target.position.copy(focusPosition);
    this.rimLight.target.updateMatrixWorld();

    for (let i = 0; i < this.localLights.length; i++) {
      const pt = this.localLights[i];
      if (pt.intensity > 0.05) {
        const wave =
          Math.sin(this.elapsedSec * 7.3 + i * 2.1) * 0.14 +
          Math.sin(this.elapsedSec * 13.7 + i * 1.3) * 0.08;
        pt.intensity = 2.2 + wave;
      }
    }
  }

  public dispose(): void {
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
    }
    this.group.removeFromParent();
  }
}
