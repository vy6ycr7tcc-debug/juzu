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
    this.materials.push(riverMat);

    this.riverMesh = new THREE.Mesh(riverGeo, riverMat);
    this.riverMesh.position.y = -2.55;
    this.riverMesh.receiveShadow = true;
    this.group.add(this.riverMesh);

    // 2. Twin High-Cliff Waterfalls cascading into the ravine (§1.7 "Waterfalls everywhere", §2.5)
    const fallTex = this.createWaterfallTexture(128);
    const fallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdcf0ec),
      map: fallTex,
      roughness: 0.18,
      metalness: 0.0,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
    });
    this.materials.push(fallMat);

    const fallSpecs = [
      { x: -16.5, y: 8.5, z: -4.2, width: 3.4, height: 23.0, rotY: 0.35, tiltX: 0.14 },
      { x: 18.0, y: 9.5, z: -2.8, width: 3.8, height: 25.0, rotY: -0.38, tiltX: 0.15 },
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

    // 3. Waterfall base spray & mist particles (§2.5)
    const sprayCount = 120;
    const sprayPositions = new Float32Array(sprayCount * 3);
    for (let i = 0; i < sprayCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const baseX = side < 0 ? -14.2 : 15.2;
      const baseZ = side < 0 ? -3.6 : -2.4;
      const angle = (i * 1.618) * Math.PI * 2;
      const rad = (i % 11) * 0.35;
      sprayPositions[i * 3] = baseX + Math.cos(angle) * rad;
      sprayPositions[i * 3 + 1] = -2.2 + (i % 15) * 0.28;
      sprayPositions[i * 3 + 2] = baseZ + Math.sin(angle) * rad;
    }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    this.geometries.push(sprayGeo);

    const sprayMat = new THREE.PointsMaterial({
      color: new THREE.Color(0xe6f4f0),
      size: 0.85,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.materials.push(sprayMat);
    this.sprayPoints = new THREE.Points(sprayGeo, sprayMat);
    this.group.add(this.sprayPoints);

    scene.add(this.group);
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
        mat.normalMap.offset.x = (this.elapsedSec * 0.08) % 1.0;
        mat.normalMap.offset.y = (this.elapsedSec * 0.03) % 1.0;
      }
    }
    for (let i = 0; i < this.waterfallMeshes.length; i++) {
      const mat = this.waterfallMeshes[i].material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.y = (this.elapsedSec * 0.65) % 1.0;
      }
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
