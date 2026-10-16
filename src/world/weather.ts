/**
 * Module: src/world/weather.ts
 * Responsibility: Biome-specific atmospheric weather precipitation (Cloud Forest rain drizzle,
 * High Sierra blowing snow flurries, Jungle humidity mist) and dynamic archaeologist
 * cavern lantern/torchlight with multi-harmonic organic flicker per Bible §1.7, §2.3, §2.4.
 * Depends on: three, src/world/terrain.ts.
 * Exports: WeatherSystem, WeatherType.
 */

import * as THREE from 'three';
import { RegionBiomeId } from './terrain';

export type WeatherType = 'clear' | 'drizzle' | 'snowFlurries' | 'tropicalMist';

export class WeatherSystem {
  public readonly group: THREE.Group = new THREE.Group();
  private currentWeather: WeatherType = 'drizzle';

  // Precipitation particle systems
  private rainPoints: THREE.Points | null = null;
  private snowPoints: THREE.Points | null = null;
  private motesPoints: THREE.Points | null = null;
  private rainPositions: Float32Array = new Float32Array(0);
  private snowPositions: Float32Array = new Float32Array(0);
  private snowVelocities: Float32Array = new Float32Array(0);
  private motesPositions: Float32Array = new Float32Array(0);
  private motesPhase: Float32Array = new Float32Array(0);

  // Archaeologist lantern / cavern torchlight
  public readonly cavernTorch: THREE.PointLight;
  private torchTargetIntensity: number = 0.0;
  private torchCurrentIntensity: number = 0.0;
  private torchFlickerTimer: number = 0.0;

  // Cleanup references
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  constructor() {
    this.group.name = 'BiomeWeatherAndTorchSystem';

    // Warm archaeologist brass field lantern / torchlight (golden tungsten 2400K)
    this.cavernTorch = new THREE.PointLight(0xffa24c, 0.0, 11.5, 1.6);
    this.cavernTorch.castShadow = false;
    this.group.add(this.cavernTorch);
  }

  public build(scene: THREE.Scene): void {
    // 1. Cloud Forest Drizzle Rain System (260 particles centered around camera)
    const rainCount = 260;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 28.0;
      rainPos[i * 3 + 1] = Math.random() * 16.0 - 2.0;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 28.0;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rainPositions = rainPos;
    this.geometries.push(rainGeo);

    const rainTex = this.createDropletTexture(64);
    const rainMat = new THREE.PointsMaterial({
      size: 0.22,
      map: rainTex,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xbedcf0,
    });
    this.materials.push(rainMat);
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.name = 'RainDrizzlePoints';
    this.group.add(this.rainPoints);

    // 2. High Sierra Blowing Snow Flurries System (300 swirling flakes)
    const snowCount = 300;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    const snowVel = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 32.0;
      snowPos[i * 3 + 1] = Math.random() * 18.0 - 2.0;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 32.0;

      // Drift velocities: strong horizontal alpine wind + slow downward drift
      snowVel[i * 3] = 1.8 + Math.random() * 2.2;     // Wind eastward
      snowVel[i * 3 + 1] = -(1.2 + Math.random() * 1.4); // Falling
      snowVel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;  // Swirl
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    this.snowPositions = snowPos;
    this.snowVelocities = snowVel;
    this.geometries.push(snowGeo);

    const snowTex = this.createSnowflakeTexture(64);
    const snowMat = new THREE.PointsMaterial({
      size: 0.20,
      map: snowTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: 0xffffff,
    });
    this.materials.push(snowMat);
    this.snowPoints = new THREE.Points(snowGeo, snowMat);
    this.snowPoints.name = 'SnowFlurriesPoints';
    this.snowPoints.visible = false;
    this.group.add(this.snowPoints);

    // 3. Sunlit Ambient Atmospheric Motes (140 micro-particles catching god rays & canopy sunlight)
    const motesCount = 140;
    const motesGeo = new THREE.BufferGeometry();
    const motesPos = new Float32Array(motesCount * 3);
    const motesPh = new Float32Array(motesCount);
    for (let i = 0; i < motesCount; i++) {
      motesPos[i * 3] = (Math.random() - 0.5) * 24.0;
      motesPos[i * 3 + 1] = Math.random() * 12.0;
      motesPos[i * 3 + 2] = (Math.random() - 0.5) * 24.0;
      motesPh[i] = Math.random() * Math.PI * 2.0;
    }
    motesGeo.setAttribute('position', new THREE.BufferAttribute(motesPos, 3));
    this.motesPositions = motesPos;
    this.motesPhase = motesPh;
    this.geometries.push(motesGeo);

    const motesTex = this.createSnowflakeTexture(64);
    const motesMat = new THREE.PointsMaterial({
      size: 0.13,
      map: motesTex,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffeaae,
    });
    this.materials.push(motesMat);
    this.motesPoints = new THREE.Points(motesGeo, motesMat);
    this.motesPoints.name = 'SunlitMotesPoints';
    this.group.add(this.motesPoints);

    scene.add(this.group);
  }

  public setBiome(biome: RegionBiomeId): void {
    if (this.motesPoints) {
      const mat = this.motesPoints.material as THREE.PointsMaterial;
      if (biome === 'highSierra') {
        mat.color.setHex(0xd8eeff);
        mat.opacity = 0.28;
      } else {
        mat.color.setHex(0xffeaae);
        mat.opacity = 0.24;
      }
    }

    if (biome === 'highSierra') {
      this.currentWeather = 'snowFlurries';
      if (this.rainPoints) this.rainPoints.visible = false;
      if (this.snowPoints) this.snowPoints.visible = true;
    } else if (biome === 'jungleLowlands') {
      this.currentWeather = 'tropicalMist';
      if (this.rainPoints) {
        this.rainPoints.visible = true;
        (this.rainPoints.material as THREE.PointsMaterial).opacity = 0.34;
      }
      if (this.snowPoints) this.snowPoints.visible = false;
    } else if (biome === 'paititi') {
      this.currentWeather = 'clear';
      if (this.rainPoints) this.rainPoints.visible = false;
      if (this.snowPoints) this.snowPoints.visible = false;
    } else {
      // Cloud Forest
      this.currentWeather = 'drizzle';
      if (this.rainPoints) {
        this.rainPoints.visible = true;
        (this.rainPoints.material as THREE.PointsMaterial).opacity = 0.26;
      }
      if (this.snowPoints) this.snowPoints.visible = false;
    }
  }

  /**
   * Adjusts the cavern/ruin torchlight based on player position.
   * Activates when inside dark subterranean structures (archives, north cave, cenote tunnels).
   */
  public updateTorch(playerPos: THREE.Vector3, isInterior: boolean = false): void {
    // Check if player is in interior ruin spaces (e.g. North Sanctuary Portal z < -16,
    // or Quipu Archive cave, or low elevation subterranean chambers)
    const inCavern =
      isInterior ||
      playerPos.z < -16.2 ||
      (playerPos.x > 8.0 && playerPos.z < -10.0 && playerPos.y < 3.0) ||
      playerPos.y < 0.2;

    this.torchTargetIntensity = inCavern ? 2.3 : 0.0;

    // Follow player slightly forward and right (handheld lantern position)
    this.cavernTorch.position.set(
      playerPos.x + 0.32,
      playerPos.y + 1.15,
      playerPos.z - 0.22
    );
  }

  public setTorchManual(active: boolean, intensity: number = 2.4): void {
    this.torchTargetIntensity = active ? intensity : 0.0;
  }

  public update(dt: number, focusPosition: THREE.Vector3): void {
    this.torchFlickerTimer += dt;

    // Smooth torch intensity transition with organic dual-frequency harmonic flicker
    this.torchCurrentIntensity += (this.torchTargetIntensity - this.torchCurrentIntensity) * Math.min(1.0, dt * 4.0);
    if (this.torchCurrentIntensity > 0.05) {
      const flicker =
        Math.sin(this.torchFlickerTimer * 15.3) * 0.16 +
        Math.sin(this.torchFlickerTimer * 28.7) * 0.09 +
        (Math.random() - 0.5) * 0.05;
      this.cavernTorch.intensity = Math.max(0.0, this.torchCurrentIntensity + flicker);
    } else {
      this.cavernTorch.intensity = 0.0;
    }

    // 1. Update rain drizzle particles
    if (this.rainPoints && this.rainPoints.visible) {
      const posAttr = this.rainPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const count = posAttr.count;
      const boxSize = 28.0;
      const halfBox = boxSize * 0.5;

      for (let i = 0; i < count; i++) {
        let x = this.rainPositions[i * 3];
        let y = this.rainPositions[i * 3 + 1];
        let z = this.rainPositions[i * 3 + 2];

        // Fall rapidly with slight mountain breeze
        y -= dt * 11.5;
        x += dt * 0.8;
        z -= dt * 0.3;

        // Wrap around focus position
        const relX = x - focusPosition.x;
        const relY = y - focusPosition.y;
        const relZ = z - focusPosition.z;

        if (relY < -4.0) y = focusPosition.y + 12.0 + Math.random() * 2.0;
        if (relX > halfBox) x -= boxSize;
        if (relX < -halfBox) x += boxSize;
        if (relZ > halfBox) z -= boxSize;
        if (relZ < -halfBox) z += boxSize;

        this.rainPositions[i * 3] = x;
        this.rainPositions[i * 3 + 1] = y;
        this.rainPositions[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;
    }

    // 2. Update snow flurries particles
    if (this.snowPoints && this.snowPoints.visible) {
      const posAttr = this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const count = posAttr.count;
      const boxSize = 32.0;
      const halfBox = boxSize * 0.5;

      for (let i = 0; i < count; i++) {
        let x = this.snowPositions[i * 3];
        let y = this.snowPositions[i * 3 + 1];
        let z = this.snowPositions[i * 3 + 2];

        const vx = this.snowVelocities[i * 3];
        const vy = this.snowVelocities[i * 3 + 1];
        const vz = this.snowVelocities[i * 3 + 2];

        // Alpine wind gusts with sinusoidal turbulence
        const gust = Math.sin(this.torchFlickerTimer * 1.8 + i * 0.3) * 0.65;
        x += (vx + gust) * dt;
        y += vy * dt;
        z += (vz + Math.cos(this.torchFlickerTimer * 2.2 + i * 0.5) * 0.5) * dt;

        const relX = x - focusPosition.x;
        const relY = y - focusPosition.y;
        const relZ = z - focusPosition.z;

        if (relY < -4.0) y = focusPosition.y + 14.0 + Math.random() * 2.0;
        if (relX > halfBox) x -= boxSize;
        if (relX < -halfBox) x += boxSize;
        if (relZ > halfBox) z -= boxSize;
        if (relZ < -halfBox) z += boxSize;

        this.snowPositions[i * 3] = x;
        this.snowPositions[i * 3 + 1] = y;
        this.snowPositions[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;
    }

    // 3. Update sunlit ambient atmospheric motes (gentle Brownian drift catching sunbeams)
    if (this.motesPoints && this.motesPoints.visible) {
      const posAttr = this.motesPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const count = posAttr.count;
      const boxSize = 24.0;
      const halfBox = boxSize * 0.5;

      for (let i = 0; i < count; i++) {
        let x = this.motesPositions[i * 3];
        let y = this.motesPositions[i * 3 + 1];
        let z = this.motesPositions[i * 3 + 2];
        const phase = this.motesPhase[i];

        // Subtle thermal lift & hovering oscillation
        y += Math.sin(this.torchFlickerTimer * 1.1 + phase) * 0.06 * dt + 0.12 * dt;
        x += Math.cos(this.torchFlickerTimer * 0.8 + phase) * 0.08 * dt;
        z += Math.sin(this.torchFlickerTimer * 0.7 + phase * 1.3) * 0.07 * dt;

        const relX = x - focusPosition.x;
        const relY = y - focusPosition.y;
        const relZ = z - focusPosition.z;

        if (relX > halfBox) x -= boxSize;
        else if (relX < -halfBox) x += boxSize;

        if (relY > 12.0) y = focusPosition.y + Math.random() * 2.0;
        else if (relY < -1.5) y = focusPosition.y + 10.0;

        if (relZ > halfBox) z -= boxSize;
        else if (relZ < -halfBox) z += boxSize;

        this.motesPositions[i * 3] = x;
        this.motesPositions[i * 3 + 1] = y;
        this.motesPositions[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;
    }
  }

  private createDropletTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const ny = (y / size) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 2 - 1;
        const idx = (y * size + x) * 4;
        // Elongated droplet along Y
        const d = (nx * nx) * 3.5 + (ny * ny) * 0.8;
        const alpha = Math.max(0, 1.0 - d);
        data[idx] = 200;
        data[idx + 1] = 225;
        data[idx + 2] = 245;
        data[idx + 3] = Math.round(alpha * 210);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  private createSnowflakeTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const ny = (y / size) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 2 - 1;
        const idx = (y * size + x) * 4;
        const r2 = nx * nx + ny * ny;
        const alpha = Math.max(0, 1.0 - r2);
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = Math.round(Math.pow(alpha, 1.5) * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    for (let i = 0; i < this.materials.length; i++) {
      this.materials[i].dispose();
    }
    for (let i = 0; i < this.textures.length; i++) {
      this.textures[i].dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.group.removeFromParent();
  }
}
