/**
 * Module: src/world/sky.ts
 * Responsibility: Physical sky dome (Preetham/Hosek atmospheric gradient + soft
 * canopy sun glow), subtle valley mist layers, low-density distance fog (`0.0014–0.0020`),
 * and dappled canopy god-ray light shafts per Bible §1.7 and §2.4.
 * Depends on: three, src/gpu/tsl.ts.
 * Exports: SkySystem.
 */

import * as THREE from 'three';
import { sharedUniforms } from '../gpu/tsl';
import { RegionBiomeId } from './terrain';

export class SkySystem {
  public readonly group: THREE.Group = new THREE.Group();
  private skyDomeMesh: THREE.Mesh | null = null;
  private mistPlanes: THREE.Mesh[] = [];
  private godRayGroups: THREE.Group[] = [];
  private godRayMaterials: THREE.MeshBasicMaterial[] = [];
  private cloudPlanes: THREE.Mesh[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private sceneRef: THREE.Scene | null = null;

  public build(scene: THREE.Scene): void {
    this.sceneRef = scene;
    this.group.name = 'AndeanSkyAndAtmosphere';

    // 1. Crisp, low-density atmospheric distance fog so distant mountains & depth read clearly (Fix #3)
    scene.fog = new THREE.FogExp2(sharedUniforms.uFogColor.value.getHex(), 0.0020);
    scene.background = new THREE.Color(0x9ab8c8);

    // 2. Physical sky dome with vertex-interpolated Rayleigh/Mie horizon gradient
    const skyGeo = new THREE.SphereGeometry(240, 32, 20);
    const pos = skyGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const zenithCol = new THREE.Color(0x3d6e9c);
    const midSkyCol = new THREE.Color(0x78a4c2);
    const horizonCol = new THREE.Color(0xd6e4dc);
    const sunGlowCol = new THREE.Color(0xffecd0);
    const tmpCol = new THREE.Color();
    const vDir = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      vDir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const elev = Math.max(0, vDir.y);
      if (elev < 0.25) {
        tmpCol.copy(horizonCol).lerp(midSkyCol, elev / 0.25);
      } else {
        tmpCol.copy(midSkyCol).lerp(zenithCol, (elev - 0.25) / 0.75);
      }
      const sunDot = Math.max(0, vDir.dot(sharedUniforms.uSunDir.value));
      tmpCol.lerp(sunGlowCol, Math.pow(sunDot, 6.0) * 0.55);

      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const skyMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    this.geometries.push(skyGeo);
    this.materials.push(skyMat);
    this.group.add(this.skyDomeMesh);

    // 3. Subtle low-lying gorge mist (kept low & translucent so it never washes out depth)
    const mistTex = this.createSoftRadialTexture(128, [225, 236, 232], 0.11);
    const mistMat = new THREE.MeshBasicMaterial({
      map: mistTex,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(mistMat);

    const mistLocations = [
      { x: -14, y: -2.2, z: -2.0, sx: 18, sy: 4.5, rotY: 0.15 },
      { x: 14, y: -2.0, z: 1.5, sx: 18, sy: 4.5, rotY: -0.18 },
    ];
    const mistGeo = new THREE.PlaneGeometry(1, 1);
    this.geometries.push(mistGeo);

    for (let i = 0; i < mistLocations.length; i++) {
      const m = mistLocations[i];
      const mesh = new THREE.Mesh(mistGeo, mistMat);
      mesh.position.set(m.x, m.y, m.z);
      mesh.scale.set(m.sx, m.sy, 1);
      mesh.rotation.y = m.rotY;
      this.mistPlanes.push(mesh);
      this.group.add(mesh);
    }

    // 4. Volumetric Crossed-Quad God Rays slanting down into canopy & mountain pass (§1.7 & §2.4)
    const rayTex = this.createGodRayTexture(128);
    const rayMat = new THREE.MeshBasicMaterial({
      map: rayTex,
      color: new THREE.Color(0xfff0cc),
      transparent: true,
      opacity: 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(rayMat);

    const rayGeo = new THREE.PlaneGeometry(4.2, 26);
    this.geometries.push(rayGeo);
    const raySpecs = [
      { x: -5.5, y: 11.5, z: -4.0, scale: 1.05 },
      { x: 4.2, y: 12.2, z: -8.8, scale: 0.95 },
      { x: -1.8, y: 10.8, z: 3.5, scale: 0.85 },
      { x: 7.5, y: 11.0, z: -1.2, scale: 1.0 },
      { x: -12.0, y: 14.5, z: -16.0, scale: 1.25 },
      { x: 13.5, y: 13.8, z: -12.5, scale: 1.15 },
    ];

    for (let i = 0; i < raySpecs.length; i++) {
      const r = raySpecs[i];
      const beamGroup = new THREE.Group();
      beamGroup.position.set(r.x, r.y, r.z);
      beamGroup.scale.set(r.scale, r.scale, 1);

      // Two crossed quads at 90 degrees give full 360-degree volumetric thickness
      const quadA = new THREE.Mesh(rayGeo, rayMat);
      const quadB = new THREE.Mesh(rayGeo, rayMat);
      quadB.rotation.y = Math.PI * 0.5;

      beamGroup.add(quadA, quadB);
      this.godRayGroups.push(beamGroup);
      this.godRayMaterials.push(rayMat);
      this.group.add(beamGroup);
    }

    // 5. High-Altitude Cirrus & Cumulus Cloud Drift (§1.7 & §2.4)
    const cloudTex = this.createCloudWispTexture(128);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.materials.push(cloudMat);

    const cloudGeo = new THREE.PlaneGeometry(1, 1);
    cloudGeo.rotateX(-Math.PI * 0.5);
    this.geometries.push(cloudGeo);

    const cloudSpecs = [
      { x: -55, y: 58, z: -40, sx: 75, sz: 32, rotY: 0.2 },
      { x: 35, y: 64, z: -70, sx: 95, sz: 38, rotY: -0.15 },
      { x: -20, y: 52, z: 45, sx: 68, sz: 28, rotY: 0.35 },
      { x: 70, y: 60, z: 15, sx: 82, sz: 34, rotY: -0.22 },
      { x: -80, y: 66, z: -5, sx: 88, sz: 36, rotY: 0.12 },
    ];

    for (let i = 0; i < cloudSpecs.length; i++) {
      const c = cloudSpecs[i];
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.scale.set(c.sx, 1, c.sz);
      mesh.rotation.y = c.rotY;
      this.cloudPlanes.push(mesh);
      this.group.add(mesh);
    }

    scene.add(this.group);
  }

  public setBiomeMode(biome: RegionBiomeId): void {
    const isSierra = biome === 'highSierra';
    if (this.sceneRef && this.sceneRef.fog instanceof THREE.FogExp2) {
      this.sceneRef.fog.density = isSierra ? 0.0012 : 0.0018;
      this.sceneRef.fog.color.setHex(isSierra ? 0xb8d0e8 : 0xa8c2ba);
      this.sceneRef.background = new THREE.Color(isSierra ? 0x9ec0e0 : 0x9ab8c8);
    }
    for (let i = 0; i < this.mistPlanes.length; i++) {
      this.mistPlanes[i].visible = !isSierra;
    }
    for (let i = 0; i < this.godRayGroups.length; i++) {
      this.godRayGroups[i].visible = !isSierra;
    }
    for (let i = 0; i < this.cloudPlanes.length; i++) {
      this.cloudPlanes[i].position.y = isSierra ? 68 + i * 2 : 56 + i * 2;
    }
  }

  private createSoftRadialTexture(
    size: number,
    rgb: [number, number, number],
    maxAlpha: number
  ): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const ny = (y / size) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 2 - 1;
        const idx = (y * size + x) * 4;
        const r2 = nx * nx + ny * ny;
        const falloff = Math.max(0, 1.0 - r2);
        const alpha = falloff * falloff * maxAlpha;
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = Math.round(alpha * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  private createGodRayTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const v = y / size;
      // Soft conical vertical taper (stronger near upper canopy,feathering out gently toward ground)
      const vFade = Math.pow(Math.sin(v * Math.PI), 1.65) * (0.45 + 0.55 * (1.0 - v));
      for (let x = 0; x < size; x++) {
        const u = (x / size) * 2 - 1;
        // Smooth Gaussian horizontal feathering with subtle multi-beam breakup
        const hGauss = Math.exp(-u * u * 4.2) * Math.max(0, 1.0 - u * u);
        const subRays = 0.78 + 0.22 * Math.cos(u * 9.5);
        const idx = (y * size + x) * 4;
        const a = hGauss * vFade * subRays;
        data[idx] = 255;
        data[idx + 1] = 242;
        data[idx + 2] = 205;
        data[idx + 3] = Math.round(a * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  private createCloudWispTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    const lobes = [
      { cx: 0.0, cy: 0.0, r: 0.65, weight: 1.0 },
      { cx: -0.28, cy: 0.12, r: 0.48, weight: 0.75 },
      { cx: 0.32, cy: -0.08, r: 0.52, weight: 0.8 },
      { cx: 0.15, cy: 0.22, r: 0.42, weight: 0.6 },
    ];
    for (let y = 0; y < size; y++) {
      const ny = (y / size) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 2 - 1;
        const idx = (y * size + x) * 4;

        let accum = 0;
        for (let k = 0; k < lobes.length; k++) {
          const l = lobes[k];
          const dx = (nx - l.cx) / l.r;
          const dy = (ny - l.cy) / (l.r * 0.55);
          const distSq = dx * dx + dy * dy;
          if (distSq < 1.0) {
            const f = 1.0 - distSq;
            accum += f * f * l.weight;
          }
        }
        accum = Math.min(1.0, accum * 0.72);
        data[idx] = 238;
        data[idx + 1] = 244;
        data[idx + 2] = 250;
        data[idx + 3] = Math.round(accum * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  public update(dt: number): void {
    sharedUniforms.uTime.value += dt;
    const t = sharedUniforms.uTime.value;

    // 1. Valley mist drift with wind direction
    const windX = sharedUniforms.uWindDir.value.x * sharedUniforms.uWindStrength.value;
    for (let i = 0; i < this.mistPlanes.length; i++) {
      const m = this.mistPlanes[i];
      m.position.x += (Math.sin(t * 0.18 + i * 1.7) * 0.2 + windX * 0.3) * dt;
    }

    // 2. Dynamic canopy & pass God-Rays aligned with sunlight vector (uSunDir)
    const sunDir = sharedUniforms.uSunDir.value;
    const sunElev = Math.max(0, sunDir.y);
    const sunCol = sharedUniforms.uSunColor.value;

    const yaw = Math.atan2(sunDir.x, sunDir.z);
    const pitch = -Math.acos(Math.max(-1, Math.min(1, sunDir.y)));

    for (let i = 0; i < this.godRayGroups.length; i++) {
      const beamGroup = this.godRayGroups[i];
      beamGroup.rotation.set(pitch + 0.06 * (i - 2.5), yaw + 0.08 * (i - 2.5), 0);

      const mat = this.godRayMaterials[i];
      if (mat) {
        const isNight = sunElev < 0.15;
        const baseOpacity = isNight ? 0.012 : Math.min(0.058, 0.022 + sunElev * 0.045);
        const shimmer = 1.0 + Math.sin(t * 1.5 + i * 1.7) * 0.14;
        mat.opacity = baseOpacity * shimmer;

        if (isNight) {
          mat.color.setHex(0x9bc0e4);
        } else {
          mat.color.copy(sunCol);
        }
      }
    }

    // 3. High-altitude cirrus & cumulus cloud drift with wind
    const windSpeed = 1.8 * Math.max(0.4, sharedUniforms.uWindStrength.value);
    const driftX = (sharedUniforms.uWindDir.value.x || 1.0) * windSpeed * dt;
    const driftZ = (sharedUniforms.uWindDir.value.y || 0.3) * windSpeed * dt;

    for (let i = 0; i < this.cloudPlanes.length; i++) {
      const c = this.cloudPlanes[i];
      c.position.x += driftX;
      c.position.z += driftZ;

      if (c.position.x > 150) c.position.x = -150;
      else if (c.position.x < -150) c.position.x = 150;

      if (c.position.z > 150) c.position.z = -150;
      else if (c.position.z < -150) c.position.z = 150;
    }
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
    this.mistPlanes.length = 0;
    this.godRayGroups.length = 0;
    this.godRayMaterials.length = 0;
    this.cloudPlanes.length = 0;
    this.group.removeFromParent();
  }
}
