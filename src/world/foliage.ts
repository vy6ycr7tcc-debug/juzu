/**
 * Module: src/world/foliage.ts
 * Responsibility: 100% Instanced volumetric Cloud Forest vegetation (multi-bough
 * 7-cluster 3D tree crowns with radiating leaf-spray cards, 10-frond 3D arched fern
 * rosettes, 14-blade 3D broadleaf understory shrubs, terracotta bromeliads, and
 * slope-embedded craggy boulders) with per-instance color/scale/rotation variation
 * and gentle wind sway per Bible §1.7, §2.6, and §5.2 (zero flat discs).
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts.
 * Exports: FoliageSystem.
 */

import * as THREE from 'three';
import { sharedUniforms } from '../gpu/tsl';
import { PbrMaterialLibrary } from './materials';
import { TerrainSystem } from './terrain';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class FoliageSystem {
  public readonly group: THREE.Group = new THREE.Group();
  public trunkInstanced!: THREE.InstancedMesh;
  public canopyInstanced!: THREE.InstancedMesh;
  public fernInstanced!: THREE.InstancedMesh;
  public bushInstanced!: THREE.InstancedMesh;
  public mossInstanced!: THREE.InstancedMesh;
  public boulderInstanced!: THREE.InstancedMesh;
  public bromeliadInstanced!: THREE.InstancedMesh;

  private elapsedSec: number = 0;
  private materialsRef: PbrMaterialLibrary | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  public build(
    scene: THREE.Scene,
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem,
    densityMultiplier: number = 1.0
  ): void {
    this.materialsRef = materials;
    this.group.name = 'CloudForestFoliage';

    let seed = 42069;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    materials.foliageLeaf.side = THREE.DoubleSide;
    materials.foliageFern.side = THREE.DoubleSide;

    // 1. Cloud Forest Canopy Trees (Gnarled buttressed trunks + 7-cluster volumetric 3D crowns)
    const treeCount = Math.floor(84 * densityMultiplier);
    const trunkGeo = this.createGnarledTrunkGeometry();
    const canopyGeo = this.createVolumetricCanopyGeometry();
    this.geometries.push(trunkGeo, canopyGeo);

    this.trunkInstanced = new THREE.InstancedMesh(trunkGeo, materials.woodBark, treeCount);
    this.trunkInstanced.castShadow = true;
    this.trunkInstanced.receiveShadow = true;

    this.canopyInstanced = new THREE.InstancedMesh(canopyGeo, materials.foliageLeaf, treeCount);
    this.canopyInstanced.castShadow = true;
    this.canopyInstanced.receiveShadow = true;

    let tIdx = 0;
    for (let attempt = 0; attempt < treeCount * 5 && tIdx < treeCount; attempt++) {
      const side = attempt % 2 === 0 ? -1 : 1;
      const x = side * (6.5 + rand() * 22.0);
      const z = -38.0 + rand() * 72.0;
      if (Math.abs(x) < 7.2 && z > -24.0 && z < 16.0) continue;

      const y = terrain.getTerrainHeightAt(x, z);
      if (y < -0.6 || y > 14.5) continue;

      const scaleXZ = 0.88 + rand() * 0.65;
      const scaleY = 0.92 + rand() * 0.75;
      const rotY = rand() * Math.PI * 2;
      const tiltX = (rand() - 0.5) * 0.1;
      const tiltZ = (rand() - 0.5) * 0.1;

      // Embed trunk base 0.45 m into slope so roots never float
      _dummy.position.set(x, y - 0.45, z);
      _dummy.rotation.set(tiltX, rotY, tiltZ);
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      _dummy.updateMatrix();
      this.trunkInstanced.setMatrixAt(tIdx, _dummy.matrix);

      _color.setHSL(0.08 + (rand() - 0.5) * 0.03, 0.3, 0.36 + rand() * 0.14);
      this.trunkInstanced.setColorAt(tIdx, _color);

      // Volumetric multi-cluster crown seated atop the forked trunk boughs
      _dummy.position.set(x, y + 7.2 * scaleY, z);
      _dummy.rotation.set(tiltX * 0.4, rotY + 0.6, tiltZ * 0.4);
      _dummy.scale.set(scaleXZ * 1.12, scaleY * 1.05, scaleXZ * 1.12);
      _dummy.updateMatrix();
      this.canopyInstanced.setMatrixAt(tIdx, _dummy.matrix);

      // Per-instance leaf hue & sunlit variation (§2.6)
      _color.setHSL(0.27 + (rand() - 0.5) * 0.06, 0.52 + rand() * 0.14, 0.34 + rand() * 0.18);
      this.canopyInstanced.setColorAt(tIdx, _color);
      tIdx++;
    }
    this.trunkInstanced.count = tIdx;
    this.canopyInstanced.count = tIdx;
    this.trunkInstanced.instanceMatrix.needsUpdate = true;
    this.canopyInstanced.instanceMatrix.needsUpdate = true;
    if (this.trunkInstanced.instanceColor) this.trunkInstanced.instanceColor.needsUpdate = true;
    if (this.canopyInstanced.instanceColor) this.canopyInstanced.instanceColor.needsUpdate = true;
    this.group.add(this.trunkInstanced, this.canopyInstanced);

    // 2. Multi-frond 3D Arched Fern Rosettes (10 fronds in 2 tiers, zero flat discs)
    const fernCount = Math.floor(240 * densityMultiplier);
    const fernGeo = this.createFernRosetteGeometry(10, 0.92, 0.64);
    this.geometries.push(fernGeo);
    this.fernInstanced = new THREE.InstancedMesh(fernGeo, materials.foliageFern, fernCount);
    this.fernInstanced.castShadow = true;
    this.fernInstanced.receiveShadow = true;

    let fIdx = 0;
    for (let i = 0; i < fernCount * 3 && fIdx < fernCount; i++) {
      const x = (rand() - 0.5) * 44.0;
      const z = -34.0 + rand() * 64.0;
      if (Math.abs(x) < 1.75 && z > -24 && z < 16) continue;
      const y = terrain.getTerrainHeightAt(x, z);
      if (y < -1.2 || y > 11.0) continue;

      const s = 0.68 + rand() * 1.12;
      _dummy.position.set(x, y - 0.06, z);
      _dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
      _dummy.scale.set(s, s * (0.9 + rand() * 0.35), s);
      _dummy.updateMatrix();
      this.fernInstanced.setMatrixAt(fIdx, _dummy.matrix);

      _color.setHSL(0.27 + (rand() - 0.5) * 0.06, 0.56, 0.34 + rand() * 0.2);
      this.fernInstanced.setColorAt(fIdx, _color);
      fIdx++;
    }
    this.fernInstanced.count = fIdx;
    this.fernInstanced.instanceMatrix.needsUpdate = true;
    if (this.fernInstanced.instanceColor) this.fernInstanced.instanceColor.needsUpdate = true;
    this.group.add(this.fernInstanced);

    // 3. 14-Blade 3D Broadleaf Understory Shrubs (replaces squashed-sphere discs!)
    const bushCount = Math.floor(160 * densityMultiplier);
    const bushGeo = this.createUnderstoryBushGeometry();
    this.geometries.push(bushGeo);
    this.bushInstanced = new THREE.InstancedMesh(bushGeo, materials.foliageLeaf, bushCount);
    this.bushInstanced.castShadow = true;
    this.bushInstanced.receiveShadow = true;

    let bIdx = 0;
    for (let i = 0; i < bushCount * 3 && bIdx < bushCount; i++) {
      const x = (rand() - 0.5) * 42.0;
      const z = -32.0 + rand() * 60.0;
      if (Math.abs(x) < 2.8 && Math.abs(z) < 18.0) continue;
      const y = terrain.getTerrainHeightAt(x, z);
      if (y < -1.0 || y > 10.5) continue;

      const s = 0.78 + rand() * 1.15;
      _dummy.position.set(x, y - 0.08, z);
      _dummy.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12);
      _dummy.scale.set(s, s * (0.88 + rand() * 0.4), s);
      _dummy.updateMatrix();
      this.bushInstanced.setMatrixAt(bIdx, _dummy.matrix);

      _color.setHSL(0.28 + (rand() - 0.5) * 0.06, 0.5, 0.3 + rand() * 0.18);
      this.bushInstanced.setColorAt(bIdx, _color);
      bIdx++;
    }
    this.bushInstanced.count = bIdx;
    this.bushInstanced.instanceMatrix.needsUpdate = true;
    if (this.bushInstanced.instanceColor) this.bushInstanced.instanceColor.needsUpdate = true;
    this.group.add(this.bushInstanced);

    // 4. Tufted Ground Moss Clusters along trail edges & terrace bases (kept off steep walls)
    const mossCount = Math.floor(110 * densityMultiplier);
    const mossGeo = this.createFernRosetteGeometry(7, 0.52, 0.32);
    this.geometries.push(mossGeo);
    this.mossInstanced = new THREE.InstancedMesh(mossGeo, materials.moss, mossCount);
    this.mossInstanced.receiveShadow = true;

    let mIdx = 0;
    for (let i = 0; i < mossCount * 3 && mIdx < mossCount; i++) {
      const x = (rand() - 0.5) * 26.0;
      const z = -28.0 + rand() * 52.0;
      if (Math.abs(x) < 1.35 && Math.abs(z) < 14.0) continue;
      const y = terrain.getTerrainHeightAt(x, z);
      if (y < 0.0 || y > 6.5) continue;

      const s = 0.55 + rand() * 0.85;
      _dummy.position.set(x, y - 0.04, z);
      _dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.mossInstanced.setMatrixAt(mIdx, _dummy.matrix);

      _color.setHSL(0.24 + (rand() - 0.5) * 0.05, 0.54, 0.32 + rand() * 0.16);
      this.mossInstanced.setColorAt(mIdx, _color);
      mIdx++;
    }
    this.mossInstanced.count = mIdx;
    this.mossInstanced.instanceMatrix.needsUpdate = true;
    if (this.mossInstanced.instanceColor) this.mossInstanced.instanceColor.needsUpdate = true;
    this.group.add(this.mossInstanced);

    // 5. Embedded Craggy Valley Boulders (deeply seated into flat/gentle terrain, never floating on slopes)
    const boulderCount = Math.floor(65 * densityMultiplier);
    const boulderGeo = this.createCraggyBoulderGeometry();
    this.geometries.push(boulderGeo);
    this.boulderInstanced = new THREE.InstancedMesh(boulderGeo, materials.fieldstoneRough, boulderCount);
    this.boulderInstanced.castShadow = true;
    this.boulderInstanced.receiveShadow = true;

    let rIdx = 0;
    for (let i = 0; i < boulderCount * 4 && rIdx < boulderCount; i++) {
      const x = (rand() - 0.5) * 24.0;
      const z = -28.0 + rand() * 52.0;
      if (Math.abs(x) < 3.2 && z > -22 && z < 16) continue;
      // Keep clear of direct camera shot cones to avoid giant foreground obstruction
      if (Math.hypot(x - 1.15, z - 5.2) < 4.8) continue; // Paititi camera cone
      if (Math.hypot(x - 1.1, z - 12.0) < 4.8) continue;  // Jungle camera cone
      if (Math.hypot(x - 1.15, z - 11.5) < 4.8) continue; // High Sierra camera cone
      if (Math.hypot(x - 1.85, z - 5.35) < 4.5) continue; // Bridge camera cone

      const y = terrain.getTerrainHeightAt(x, z);
      if (y > 6.2) continue; // Keep off steep canyon walls so boulders never protrude horizontally

      const sx = 0.72 + rand() * 0.45;
      const sy = 0.65 + rand() * 0.45;
      const sz = 0.72 + rand() * 0.45;
      // Sink boulder 55% into ground so base is firmly rooted in mountain bedrock
      _dummy.position.set(x, y - sy * 0.55, z);
      _dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
      _dummy.scale.set(sx, sy, sz);
      _dummy.updateMatrix();
      this.boulderInstanced.setMatrixAt(rIdx, _dummy.matrix);

      _color.setHSL(0.1 + (rand() - 0.5) * 0.04, 0.12, 0.42 + rand() * 0.18);
      this.boulderInstanced.setColorAt(rIdx, _color);
      rIdx++;
    }
    this.boulderInstanced.count = rIdx;
    this.boulderInstanced.instanceMatrix.needsUpdate = true;
    if (this.boulderInstanced.instanceColor) this.boulderInstanced.instanceColor.needsUpdate = true;
    this.group.add(this.boulderInstanced);

    // 6. Terracotta / Crimson Andean Bromeliads & Heliconias (§1.6 accent palette)
    const bromCount = Math.floor(64 * densityMultiplier);
    const bromGeo = this.createFernRosetteGeometry(7, 0.45, 0.38);
    const bromMat = new THREE.MeshStandardMaterial({
      name: 'AndeanBromeliadAccent',
      color: new THREE.Color(0x8a3826),
      map: materials.foliageFern.map,
      normalMap: materials.foliageFern.normalMap,
      roughness: 0.82,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.geometries.push(bromGeo);
    this.materials.push(bromMat);
    this.bromeliadInstanced = new THREE.InstancedMesh(bromGeo, bromMat, bromCount);

    let brIdx = 0;
    for (let i = 0; i < bromCount * 3 && brIdx < bromCount; i++) {
      const x = (rand() - 0.5) * 28.0;
      const z = -24.0 + rand() * 44.0;
      if (Math.abs(x) < 2.0) continue;
      const y = terrain.getTerrainHeightAt(x, z);
      if (y < 0.0 || y > 7.5) continue;

      _dummy.position.set(x, y + 0.02, z);
      _dummy.rotation.set((rand() - 0.5) * 0.18, rand() * Math.PI * 2, (rand() - 0.5) * 0.18);
      const s = 0.65 + rand() * 0.55;
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.bromeliadInstanced.setMatrixAt(brIdx, _dummy.matrix);

      _color.setHSL(0.04 + rand() * 0.04, 0.32, 0.40 + rand() * 0.12);
      this.bromeliadInstanced.setColorAt(brIdx, _color);
      brIdx++;
    }
    this.bromeliadInstanced.count = brIdx;
    this.bromeliadInstanced.instanceMatrix.needsUpdate = true;
    if (this.bromeliadInstanced.instanceColor) this.bromeliadInstanced.instanceColor.needsUpdate = true;
    this.group.add(this.bromeliadInstanced);

    scene.add(this.group);
  }

  /**
   * Builds a gnarled Cloud Forest trunk with flared buttress roots AND 3 forked upper
   * canopy branches so the crown is organically supported by wooden limbs.
   */
  private createGnarledTrunkGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vOff = 0;

    const appendTube = (
      x0: number, y0: number, z0: number, r0: number,
      x1: number, y1: number, z1: number, r1: number,
      radSegs: number, hSegs: number, bendAmp: number
    ): void => {
      for (let h = 0; h <= hSegs; h++) {
        const t = h / hSegs;
        const cx = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bendAmp;
        const cy = y0 + (y1 - y0) * t;
        const cz = z0 + (z1 - z0) * t + Math.cos(t * Math.PI) * bendAmp * 0.7;
        const rootFlare = (y0 === 0 && t < 0.18) ? (0.18 - t) * 2.2 : 0.0;
        const r = (r0 + (r1 - r0) * t) * (1.0 + rootFlare);

        for (let s = 0; s <= radSegs; s++) {
          const u = s / radSegs;
          const ang = u * Math.PI * 2;
          const fluting = 1.0 + (y0 === 0 && t < 0.25 ? Math.sin(ang * 5.0) * 0.18 * (1.0 - t * 4.0) : 0.0);
          positions.push(
            cx + Math.cos(ang) * r * fluting,
            cy,
            cz + Math.sin(ang) * r * fluting
          );
          uvs.push(u * 2.0, t * 4.0);
        }
      }
      const stride = radSegs + 1;
      for (let h = 0; h < hSegs; h++) {
        for (let s = 0; s < radSegs; s++) {
          const a = vOff + h * stride + s;
          const b = a + stride;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      vOff += (hSegs + 1) * stride;
    };

    // Main trunk (0 to 6.4m)
    appendTube(0, 0, 0, 0.52, 0.08, 6.4, -0.05, 0.24, 10, 8, 0.22);
    // 3 primary forked upper limbs reaching into the volumetric sub-crowns
    appendTube(0.06, 5.4, -0.04, 0.22, -1.65, 7.6, 0.95, 0.09, 7, 4, 0.12);
    appendTube(0.06, 5.6, -0.04, 0.21, 1.72, 7.7, 0.82, 0.09, 7, 4, -0.12);
    appendTube(0.06, 5.5, -0.04, 0.20, -0.15, 7.8, -1.65, 0.09, 7, 4, 0.10);

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds a dense 3D volumetric tree canopy from intersecting angled leaf cards
   * with spherical normal smoothing (zero solid polygon blobs, authentic AAA foliage).
   */
  private createVolumetricCanopyGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vOff = 0;

    // 12 bough clusters arranged in a broad Andean cloud-forest umbrella crown
    const boughs: Array<[number, number, number, number]> = [
      [0.0, 1.45, 0.0, 2.4],       // High central dome
      [-1.65, 0.75, 1.15, 2.0],    // Front-left upper bough
      [1.72, 0.82, 0.95, 2.0],     // Front-right upper bough
      [-1.52, 0.65, -1.35, 1.9],   // Back-left upper bough
      [1.58, 0.70, -1.28, 1.9],    // Back-right upper bough
      [0.0, 0.35, 2.15, 1.8],      // Front low skirt
      [-0.15, 0.30, -2.10, 1.8],   // Back low skirt
      [-2.35, -0.15, 0.25, 1.7],   // Far-left drooping bough
      [2.38, -0.10, -0.20, 1.7],   // Far-right drooping bough
      [1.42, -0.25, 1.65, 1.6],    // Low front-right skirt
      [-1.38, -0.28, -1.62, 1.6],  // Low back-left skirt
      [0.10, 2.25, -0.20, 1.7],    // Topmost crest cluster
    ];

    const crownCenter = new THREE.Vector3(0, 0.8, 0);

    for (let b = 0; b < boughs.length; b++) {
      const [bx, by, bz, bRad] = boughs[b];
      // 8 crossed foliage cards per bough cluster at diverse 3D angles
      const cardCount = 8;
      for (let k = 0; k < cardCount; k++) {
        const yaw = (k / cardCount) * Math.PI + (b * 0.47);
        const pitch = ((k % 3) - 1.0) * 0.42;
        const roll = (((k * 5) % 4) - 1.5) * 0.25;

        const hw = bRad * (0.62 + ((k * 3) % 4) * 0.12);
        const hh = bRad * (0.58 + ((k * 5) % 4) * 0.12);

        // Sub-cluster jitter within the bough
        const jx = Math.sin(k * 2.3 + b) * bRad * 0.32;
        const jy = Math.cos(k * 1.9 + b) * bRad * 0.24;
        const jz = Math.sin(k * 3.1 - b) * bRad * 0.32;

        const cx = bx + jx;
        const cy = by + jy;
        const cz = bz + jz;

        // Basis vectors for the oriented quad
        const euler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
        const q = new THREE.Quaternion().setFromEuler(euler);

        const rVec = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const uVec = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

        const p0 = new THREE.Vector3(cx, cy, cz).addScaledVector(rVec, -hw).addScaledVector(uVec, -hh);
        const p1 = new THREE.Vector3(cx, cy, cz).addScaledVector(rVec,  hw).addScaledVector(uVec, -hh);
        const p2 = new THREE.Vector3(cx, cy, cz).addScaledVector(rVec,  hw).addScaledVector(uVec,  hh);
        const p3 = new THREE.Vector3(cx, cy, cz).addScaledVector(rVec, -hw).addScaledVector(uVec,  hh);

        const quadPts = [p0, p1, p2, p3];
        for (let pIdx = 0; pIdx < 4; pIdx++) {
          const pt = quadPts[pIdx];
          positions.push(pt.x, pt.y, pt.z);

          // Spherical outward normal from crown center for soft, voluminous lighting
          const sNorm = pt.clone().sub(crownCenter).normalize();
          normals.push(sNorm.x, sNorm.y, sNorm.z);
        }

        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(vOff, vOff + 1, vOff + 2, vOff, vOff + 2, vOff + 3);
        // Double-sided backfaces
        indices.push(vOff, vOff + 2, vOff + 1, vOff, vOff + 3, vOff + 2);
        vOff += 4;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    return geo;
  }

  /**
   * Builds a true 3D multi-frond fern/bromeliad rosette from 2 concentric tiers of
   * radiating arched leaf ribbons (zero closed cones or discs).
   */
  private createFernRosetteGeometry(
    frondCount: number = 10,
    radius: number = 0.92,
    height: number = 0.64
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const segs = 5;
    let vOffset = 0;

    for (let f = 0; f < frondCount; f++) {
      const isInner = f % 2 === 1;
      const baseAngle = (f / frondCount) * Math.PI * 2 + (isInner ? 0.24 : 0.0);
      const cosA = Math.cos(baseAngle);
      const sinA = Math.sin(baseAngle);
      const perpX = -sinA;
      const perpZ = cosA;
      const frondLen = radius * (isInner ? 0.68 : 0.95 + (f % 3) * 0.08);
      const frondH = height * (isInner ? 1.12 : 0.82 + ((f + 1) % 3) * 0.12);

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const r = 0.03 + t * frondLen;
        const archY = Math.sin(t * Math.PI * (isInner ? 0.72 : 0.86)) * frondH;
        const halfW = Math.sin(t * Math.PI * 0.92) * 0.17 * (1.08 - t * 0.38);

        const cx = cosA * r;
        const cz = sinA * r;

        positions.push(cx - perpX * halfW, archY, cz - perpZ * halfW);
        uvs.push(0.0, t);

        positions.push(cx, archY + 0.04 * (1 - t * 0.5), cz);
        uvs.push(0.5, t);

        positions.push(cx + perpX * halfW, archY, cz + perpZ * halfW);
        uvs.push(1.0, t);
      }

      for (let s = 0; s < segs; s++) {
        const r0 = vOffset + s * 3;
        const r1 = vOffset + (s + 1) * 3;
        indices.push(r0, r1, r0 + 1, r1, r1 + 1, r0 + 1);
        indices.push(r0 + 1, r1 + 1, r0 + 2, r1 + 1, r1 + 2, r0 + 2);
      }
      vOffset += (segs + 1) * 3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds a multi-stem 3D tropical broadleaf shrub from 14 radiating arched leaf
   * stems at varied pitch/yaw angles (replaces squashed-sphere discs completely).
   */
  private createUnderstoryBushGeometry(): THREE.BufferGeometry {
    return this.createFernRosetteGeometry(14, 1.05, 0.88);
  }

  private createCraggyBoulderGeometry(): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(0.95, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uvs = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Cleavage planes & angular fracturing along tectonic fracture joints
      const plane = Math.sign(x * 0.6 + y * 0.8 - z * 0.3);
      const fracture = 1.0 + 0.18 * plane + 0.12 * Math.sin(x * 3.5 + z * 2.8);
      x *= fracture;
      y *= (fracture * 0.95);
      z *= fracture;

      pos.setXYZ(i, x, y, z);

      // Triplanar-style projection for UVs to avoid texture stretching
      uvs[i * 2] = (x + z) * 0.75;
      uvs[i * 2 + 1] = (y + x * 0.5) * 0.75;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  public update(dt: number, _playerPosition?: THREE.Vector3): void {
    this.elapsedSec += dt;
    const t = this.elapsedSec;
    const windDir = sharedUniforms.uWindDir.value;
    const windStrength = sharedUniforms.uWindStrength.value;

    // 1. Canopy tree crowns sway slowly in the Andean mountain breeze
    if (this.canopyInstanced) {
      const swayX = Math.sin(t * 1.15) * 0.008 * windStrength * windDir.x;
      const swayZ = Math.cos(t * 0.95) * 0.008 * windStrength * windDir.y;
      this.canopyInstanced.rotation.set(swayX, 0, swayZ);
    }

    // 2. Ground ferns & understory shrubs flutter at higher wind frequencies
    if (this.fernInstanced) {
      const flutterZ = Math.sin(t * 2.6) * 0.012 * windStrength;
      const flutterX = Math.cos(t * 2.1) * 0.012 * windStrength;
      this.fernInstanced.rotation.set(flutterX, 0, flutterZ);
    }
    if (this.bushInstanced) {
      const bushSway = Math.sin(t * 1.8 + 0.5) * 0.009 * windStrength;
      this.bushInstanced.rotation.set(bushSway * 0.5, 0, bushSway);
    }

    // 3. Material roughness dynamically responds to rain & mist wetness (Bible §2.6)
    // Wet leaves develop glossy Andean rain sheen (roughness decreases from 0.62 to 0.30)
    const wetness = sharedUniforms.uWetness.value;
    if (this.materialsRef) {
      const baseLeafRoughness = 0.62;
      const baseFernRoughness = 0.58;
      this.materialsRef.foliageLeaf.roughness = baseLeafRoughness - wetness * 0.32;
      this.materialsRef.foliageFern.roughness = baseFernRoughness - wetness * 0.30;
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    for (let i = 0; i < this.materials.length; i++) {
      this.materials[i].dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.group.removeFromParent();
  }
}
