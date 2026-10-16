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
  ambientColor: number;
  ambientIntensity: number;
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
    groundColor: 0x56644f,
    hemiIntensity: 1.35,
    bounceColor: 0x788c72,
    bounceIntensity: 0.95,
    rimColor: 0xffd8be,
    rimIntensity: 0.52,
    ambientColor: 0x6e8090,
    ambientIntensity: 0.65,
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
    groundColor: 0x607056,
    hemiIntensity: 1.48,
    bounceColor: 0x7a926a,
    bounceIntensity: 1.10,
    rimColor: 0xe4f2ff,
    rimIntensity: 0.45,
    ambientColor: 0x7c8e9c,
    ambientIntensity: 0.72,
    fogColor: 0xb8d0e4,
    fogDensity: 0.0014,
    exposure: 1.10,
  },
  afternoon: {
    sunAzimuth: 0.78,
    sunElevation: 0.62,
    sunColor: 0xffebc8,
    sunIntensity: 3.5,
    skyColor: 0x88b5d8,
    groundColor: 0x5a6a50,
    hemiIntensity: 1.55,
    bounceColor: 0x829670,
    bounceIntensity: 1.20,
    rimColor: 0xffedd0,
    rimIntensity: 0.78,
    ambientColor: 0x7e8c96,
    ambientIntensity: 0.75,
    fogColor: 0xadc4bd,
    fogDensity: 0.0016,
    exposure: 1.18,
  },
  dusk: {
    sunAzimuth: -0.72,
    sunElevation: 0.28,
    sunColor: 0xff9454,
    sunIntensity: 2.5,
    skyColor: 0x66749c,
    groundColor: 0x48423e,
    hemiIntensity: 1.08,
    bounceColor: 0x6a564b,
    bounceIntensity: 0.75,
    rimColor: 0xffa86b,
    rimIntensity: 0.55,
    ambientColor: 0x5e6670,
    ambientIntensity: 0.52,
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
    groundColor: 0x24322a,
    hemiIntensity: 0.78,
    bounceColor: 0x304258,
    bounceIntensity: 0.52,
    rimColor: 0x98c0f2,
    rimIntensity: 0.42,
    ambientColor: 0x2b3748,
    ambientIntensity: 0.38,
    fogColor: 0x243448,
    fogDensity: 0.0028,
    exposure: 1.02,
  },
};

const _sunOffset = new THREE.Vector3();
const _rimOffset = new THREE.Vector3();
const _bounceOffset = new THREE.Vector3();

export class LightRig {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly sunLight: THREE.DirectionalLight;
  public readonly skyFill: THREE.HemisphereLight;
  public readonly bounceLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly ambientLight: THREE.AmbientLight;
  public readonly localLights: THREE.PointLight[] = [];

  private currentGrade: TimeOfDayGrade = 'afternoon';
  private elapsedSec: number = 0;
  private sceneRef: THREE.Scene | null = null;
  private envTextures: Partial<Record<TimeOfDayGrade, THREE.DataTexture>> = {};

  constructor(shadowMapSize: number = 2048) {
    this.group.name = 'AndeanLightRig';

    this.sunLight = new THREE.DirectionalLight(0xffebc8, 3.4);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.sunLight.shadow.camera.near = 1.5;
    this.sunLight.shadow.camera.far = 135.0;
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00025;
    this.sunLight.shadow.normalBias = 0.016;

    this.skyFill = new THREE.HemisphereLight(0x88b5d8, 0x526448, 1.35);
    this.skyFill.position.set(0, 60, 0);

    this.bounceLight = new THREE.DirectionalLight(0x829670, 0.95);
    this.bounceLight.castShadow = false;

    this.rimLight = new THREE.DirectionalLight(0xffedd0, 0.68);
    this.rimLight.castShadow = false;

    this.ambientLight = new THREE.AmbientLight(0x7e8c96, 0.68);

    this.group.add(
      this.sunLight,
      this.sunLight.target,
      this.skyFill,
      this.bounceLight,
      this.bounceLight.target,
      this.rimLight,
      this.rimLight.target,
      this.ambientLight
    );

    for (let i = 0; i < 4; i++) {
      const pt = new THREE.PointLight(0xff8c3b, 0.0, 14.0, 1.8);
      pt.castShadow = false;
      this.localLights.push(pt);
      this.group.add(pt);
    }
  }

  public build(scene: THREE.Scene, renderer?: THREE.WebGLRenderer): void {
    this.sceneRef = scene;
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

    this.ambientLight.color.setHex(spec.ambientColor);
    this.ambientLight.intensity = spec.ambientIntensity;

    if (this.sceneRef) {
      let envTex = this.envTextures[grade];
      if (!envTex) {
        envTex = this.createAndeanEnvironmentTexture(spec, sharedUniforms.uSunDir.value);
        this.envTextures[grade] = envTex;
      }
      this.sceneRef.environment = envTex;
      if ('environmentIntensity' in this.sceneRef) {
        (this.sceneRef as THREE.Scene & { environmentIntensity: number }).environmentIntensity =
          grade === 'night' ? 0.55 : 0.92;
      }
    }

    if (renderer) {
      renderer.toneMappingExposure = spec.exposure;
    }
  }

  /**
   * Builds a rich 256x128 EquirectangularReflectionMapping Andean IBL panorama
   * (Rayleigh/Mie sky dome, sunlit cumulus cloud band, snow-capped Cordillera horizon,
   * solar aureole, and emerald-gold valley bounce) so metallic gold, bronze, water,
   * wet stones, and character gear have authentic reflections in both WebGPU & WebGL2.
   */
  private createAndeanEnvironmentTexture(
    spec: GradeSpec,
    sunDir: THREE.Vector3
  ): THREE.DataTexture {
    const width = 256;
    const height = 128;
    const data = new Uint8Array(width * height * 4);

    const cSky = new THREE.Color(spec.skyColor);
    const cZenith = cSky.clone().multiplyScalar(0.68);
    const cHorizon = new THREE.Color(spec.fogColor).lerp(new THREE.Color(0xffffff), 0.18);
    const cSun = new THREE.Color(spec.sunColor);
    const cGround = new THREE.Color(spec.groundColor);
    const cBounce = new THREE.Color(spec.bounceColor);
    const cPeak = new THREE.Color(0xdce8f2);
    const cTmp = new THREE.Color();
    const dir = new THREE.Vector3();

    for (let y = 0; y < height; y++) {
      // v = 0 at bottom (-pi/2), v = 1 at top (+pi/2)
      const v = (y + 0.5) / height;
      const theta = (v - 0.5) * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width;
        const phi = (u - 0.5) * Math.PI * 2.0;

        dir.set(Math.cos(phi) * cosTheta, sinTheta, Math.sin(phi) * cosTheta).normalize();
        const sunDot = Math.max(0, dir.dot(sunDir));

        if (sinTheta >= 0.0) {
          // Upper sky dome + sunlit cumulus cloud band + Cordillera snow peaks near horizon
          const elevT = Math.min(1.0, sinTheta / 0.35);
          if (sinTheta < 0.35) {
            cTmp.copy(cHorizon).lerp(cSky, elevT);
          } else {
            cTmp.copy(cSky).lerp(cZenith, (sinTheta - 0.35) / 0.65);
          }

          // Distant jagged mountain ridge silhouette along the horizon
          const ridgeH =
            0.05 +
            0.04 * Math.sin(phi * 5.0 + 0.8) +
            0.025 * Math.cos(phi * 11.0 - 0.4);
          if (sinTheta < ridgeH) {
            const snowFactor = Math.max(0, (sinTheta - ridgeH * 0.45) / (ridgeH * 0.55));
            cTmp.lerp(cPeak, 0.35 + snowFactor * 0.45);
          } else {
            // Soft sunlit Andean cloud band
            const cloudWave =
              Math.sin(phi * 3.0 + sinTheta * 6.0) * 0.5 +
              Math.cos(phi * 7.0 - sinTheta * 4.0) * 0.5;
            const cloudMask =
              Math.max(0, cloudWave) *
              Math.exp(-Math.pow((sinTheta - 0.28) * 4.2, 2.0));
            cTmp.lerp(cHorizon, cloudMask * 0.42);
          }

          // Warm Mie solar aureole and specular sun core for realistic metal/water glints
          const halo = Math.pow(sunDot, 6.0) * 0.55 + Math.pow(sunDot, 36.0) * 0.85;
          cTmp.lerp(cSun, Math.min(1.0, halo));
          if (sunDot > 0.96) {
            const core = Math.pow((sunDot - 0.96) / 0.04, 2.0);
            cTmp.r = Math.min(1.0, cTmp.r + core * 0.45);
            cTmp.g = Math.min(1.0, cTmp.g + core * 0.42);
            cTmp.b = Math.min(1.0, cTmp.b + core * 0.35);
          }
        } else {
          // Lower hemisphere: sunlit emerald foliage & warm stone terrace bounce
          const downT = Math.min(1.0, -sinTheta / 0.55);
          cTmp.copy(cHorizon).lerp(cBounce, Math.min(1.0, downT * 1.4));
          cTmp.lerp(cGround, downT * 0.65);
          const groundVari =
            0.5 + 0.5 * Math.sin(phi * 6.0 + sinTheta * 8.0);
          cTmp.lerp(cSun, groundVari * 0.14 * Math.max(0.2, sunDir.y));
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.round(cTmp.r * 255));
        data[idx + 1] = Math.min(255, Math.round(cTmp.g * 255));
        data[idx + 2] = Math.min(255, Math.round(cTmp.b * 255));
        data[idx + 3] = 255;
      }
    }

    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
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

    _bounceOffset.copy(sharedUniforms.uSunDir.value).multiplyScalar(-36);
    _bounceOffset.y = -6;
    this.bounceLight.position.copy(focusPosition).add(_bounceOffset);
    this.bounceLight.target.position.copy(focusPosition);
    this.bounceLight.target.updateMatrixWorld();

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
    const grades = Object.keys(this.envTextures) as TimeOfDayGrade[];
    for (let i = 0; i < grades.length; i++) {
      const tex = this.envTextures[grades[i]];
      if (tex) tex.dispose();
    }
    this.envTextures = {};
    this.group.removeFromParent();
  }
}
