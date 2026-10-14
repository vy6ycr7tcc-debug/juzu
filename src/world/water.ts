/**
 * Module: src/world/water.ts
 * Responsibility: Flowing Andean ravine river, depth-colored water surface,
 * whitewater edge foam, and high-cliff waterfall cascades with spray mist per
 * Bible §1.7 and §2.5.
 * Depends on: three, src/world/materials.ts.
 * Exports: WaterSystem.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from './materials';

export class WaterSystem {
  public readonly group: THREE.Group = new THREE.Group();
  private riverMesh: THREE.Mesh | null = null;
  private waterfallMeshes: THREE.Mesh[] = [];
  private sprayPoints: THREE.Points | null = null;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private elapsedSec: number = 0;

  public build(scene: THREE.Scene, materials: PbrMaterialLibrary): void {
    this.group.name = 'CloudForestWaterSystem';

    // 1. Flowing ravine river (spans x in [-85, 85] along the gorge floor at y = -2.65m)
    const riverGeo = new THREE.PlaneGeometry(170, 11.5, 96, 18);
    riverGeo.rotateX(-Math.PI / 2);

    const pos = riverGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const deepCol = new THREE.Color(0x184742);
    const shallowCol = new THREE.Color(0x3a7a6e);
    const foamCol = new THREE.Color(0xdbeae6);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const centerZ = Math.sin(vx * 0.055) * 1.4;
      const worldZ = vz + centerZ;
      pos.setZ(i, worldZ);

      // Edge foam & depth gradient (§2.5)
      const edgeRatio = Math.min(1.0, Math.abs(vz) / 5.4);
      const rapid = Math.sin(vx * 0.55) * Math.cos(vz * 0.9);
      if (edgeRatio > 0.78 || rapid > 0.65) {
        tmpCol.copy(shallowCol).lerp(foamCol, 0.72);
      } else {
        tmpCol.copy(deepCol).lerp(shallowCol, edgeRatio * 0.85);
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    riverGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    riverGeo.computeVertexNormals();
    this.geometries.push(riverGeo);

    const riverMat = materials.water.clone();
    riverMat.vertexColors = true;
    if (riverMat.normalMap) {
      riverMat.normalMap = riverMat.normalMap.clone();
      riverMat.normalMap.wrapS = THREE.RepeatWrapping;
      riverMat.normalMap.wrapT = THREE.RepeatWrapping;
      riverMat.normalMap.repeat.set(12, 3);
      this.textures.push(riverMat.normalMap);
    }
    this.materials.push(riverMat);

    this.riverMesh = new THREE.Mesh(riverGeo, riverMat);
    this.riverMesh.position.y = -2.55;
    this.riverMesh.receiveShadow = true;
    this.group.add(this.riverMesh);

    // 2. Twin High-Cliff Waterfalls cascading into the ravine (§1.7 "Waterfalls everywhere", §2.5)
    const fallTex = this.createWaterfallTexture(128);
    const fallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd0e8e4),
      map: fallTex,
      roughness: 0.24,
      metalness: 0.0,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    });
    this.materials.push(fallMat);

    const fallSpecs = [
      { x: -26.0, y: 7.5, z: -14.0, width: 2.8, height: 21.0, rotY: 0.48, tiltX: 0.12 },
      { x: 24.0, y: 8.5, z: -12.5, width: 3.2, height: 23.0, rotY: -0.44, tiltX: 0.14 },
    ];

    for (let i = 0; i < fallSpecs.length; i++) {
      const f = fallSpecs[i];
      const fGeo = new THREE.PlaneGeometry(f.width, f.height, 8, 24);
      this.geometries.push(fGeo);
      const fMesh = new THREE.Mesh(fGeo, fallMat);
      fMesh.position.set(f.x, f.y, f.z);
      fMesh.rotation.y = f.rotY;
      fMesh.rotation.x = f.tiltX;
      this.waterfallMeshes.push(fMesh);
      this.group.add(fMesh);

      // Plunge pool foam ring at waterfall base
      const ringGeo = new THREE.RingGeometry(0.6, 4.2, 24);
      ringGeo.rotateX(-Math.PI / 2);
      this.geometries.push(ringGeo);
      const ringMesh = new THREE.Mesh(ringGeo, fallMat);
      ringMesh.position.set(f.x * 0.84, -2.48, f.z * 0.85);
      this.group.add(ringMesh);
    }

    // 3. Ravine river gorge spray & rising mist particles under the bridge & plunge pools (§2.5)
    const sprayCount = 180;
    const sprayPositions = new Float32Array(sprayCount * 3);
    for (let i = 0; i < sprayCount; i++) {
      let bx: number;
      let bz: number;
      if (i < 60) {
        // West waterfall plunge
        bx = -22.0 + (Math.sin(i * 1.7) * 3.5);
        bz = -11.5 + (Math.cos(i * 2.1) * 3.0);
      } else if (i < 120) {
        // East waterfall plunge
        bx = 20.5 + (Math.sin(i * 1.7) * 3.5);
        bz = -10.5 + (Math.cos(i * 2.1) * 3.0);
      } else {
        // Gorge river mist under the hanging bridge
        bx = -14.0 + ((i - 120) / 60) * 28.0;
        bz = Math.sin(i * 0.8) * 3.2;
      }
      sprayPositions[i * 3] = bx;
      sprayPositions[i * 3 + 1] = -2.4 + (i % 20) * 0.24;
      sprayPositions[i * 3 + 2] = bz;
    }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    this.geometries.push(sprayGeo);

    const sprayTex = this.createSoftSprayTexture(64);
    const sprayMat = new THREE.PointsMaterial({
      map: sprayTex,
      color: new THREE.Color(0xe6f4f0),
      size: 1.35,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(sprayMat);
    this.sprayPoints = new THREE.Points(sprayGeo, sprayMat);
    this.group.add(this.sprayPoints);

    scene.add(this.group);
  }

  private createSoftSprayTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const ny = (y / size) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 2 - 1;
        const idx = (y * size + x) * 4;
        const r2 = nx * nx + ny * ny;
        const falloff = Math.max(0, 1.0 - r2);
        const alpha = falloff * falloff * 0.45;
        data[idx] = 225;
        data[idx + 1] = 240;
        data[idx + 2] = 238;
        data[idx + 3] = Math.round(alpha * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  private createWaterfallTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const streak =
          0.55 +
          0.45 * Math.sin(x * 0.45 + Math.cos(y * 0.22) * 1.5) * Math.cos(y * 0.14);
        const edgeFade = Math.sin((x / size) * Math.PI);
        const val = Math.round((155 + streak * 95) * (0.4 + 0.6 * edgeFade));
        data[idx] = Math.min(255, val);
        data[idx + 1] = Math.min(255, val + 12);
        data[idx + 2] = Math.min(255, val + 15);
        data[idx + 3] = Math.round(Math.min(255, (140 + streak * 110) * edgeFade));
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  public update(dt: number): void {
    this.elapsedSec += dt;
    // Scroll normal/albedo maps without any object allocation
    if (this.riverMesh) {
      const mat = this.riverMesh.material as THREE.MeshStandardMaterial;
      if (mat.normalMap) {
        mat.normalMap.offset.x = (this.elapsedSec * 0.045) % 1.0;
        mat.normalMap.offset.y = (this.elapsedSec * 0.018) % 1.0;
      }
    }
    for (let i = 0; i < this.waterfallMeshes.length; i++) {
      const mat = this.waterfallMeshes[i].material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.y = (this.elapsedSec * 0.68) % 1.0;
      }
    }

    if (this.sprayPoints) {
      const pos = this.sprayPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let py = pos.getY(i) + dt * (0.65 + (i % 6) * 0.2);
        if (py > 2.6) {
          py = -2.4 - (i % 5) * 0.12;
        }
        pos.setY(i, py);
        const px = pos.getX(i) + Math.sin(this.elapsedSec * 1.2 + i) * dt * 0.15;
        pos.setX(i, px);
      }
      pos.needsUpdate = true;
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
    this.waterfallMeshes.length = 0;
    this.group.removeFromParent();
  }
}
