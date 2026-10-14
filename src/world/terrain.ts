/**
 * Module: src/world/terrain.ts
 * Responsibility: Multi-region Andean terrain heightfield (Cloud Forest gorge &
 * High Sierra stepped agricultural valley with snowline), multi-LOD terrain mesh,
 * jagged Cordillera mountain range with snowcaps, and zero-allocation raycast
 * grounding queries per Bible §1.7, §2.7, and §5.2.
 * Depends on: three, src/world/materials.ts.
 * Exports: RegionBiomeId, TerrainSystem.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from './materials';

export type RegionBiomeId = 'cloudForest' | 'highSierra' | 'jungleLowlands' | 'paititi';

const _rayOrigin = new THREE.Vector3();
const _rayDown = new THREE.Vector3(0, -1, 0);
const _raycaster = new THREE.Raycaster();
const _hits: THREE.Intersection[] = [];

export class TerrainSystem {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly walkableMeshes: THREE.Object3D[] = [];
  public currentBiome: RegionBiomeId = 'cloudForest';

  private lod: THREE.LOD | null = null;
  private highMesh: THREE.Mesh | null = null;
  private medMesh: THREE.Mesh | null = null;
  private lowMesh: THREE.Mesh | null = null;
  private highGeo: THREE.BufferGeometry | null = null;
  private medGeo: THREE.BufferGeometry | null = null;
  private lowGeo: THREE.BufferGeometry | null = null;
  private peakMeshes: THREE.Mesh[] = [];
  private peakMat: THREE.MeshStandardMaterial | null = null;
  private geometries: THREE.BufferGeometry[] = [];

  public build(scene: THREE.Scene, materials: PbrMaterialLibrary): void {
    this.group.name = 'AndeanTerrain';

    const lod = new THREE.LOD();
    this.highGeo = this.createTerrainGeometry(220, 220, 140, 140);
    this.medGeo = this.createTerrainGeometry(220, 220, 70, 70);
    this.lowGeo = this.createTerrainGeometry(220, 220, 35, 35);
    this.geometries.push(this.highGeo, this.medGeo, this.lowGeo);

    this.highMesh = new THREE.Mesh(this.highGeo, materials.groundForestFloor);
    this.highMesh.receiveShadow = true;
    this.highMesh.castShadow = false;

    this.medMesh = new THREE.Mesh(this.medGeo, materials.groundForestFloor);
    this.medMesh.receiveShadow = true;

    this.lowMesh = new THREE.Mesh(this.lowGeo, materials.groundForestFloor);
    this.lowMesh.receiveShadow = true;

    lod.addLevel(this.highMesh, 0);
    lod.addLevel(this.medMesh, 65);
    lod.addLevel(this.lowMesh, 125);

    this.lod = lod;
    this.group.add(lod);
    this.walkableMeshes.push(this.highMesh);

    // Distant jagged Cordillera mountain ridges with snow-capped summits (§2.1 depth layers)
    this.buildCordilleraMountainRange(materials);

    scene.add(this.group);
  }

  public registerWalkable(obj: THREE.Object3D): void {
    this.walkableMeshes.push(obj);
  }

  public setBiomeMode(biome: RegionBiomeId, materials: PbrMaterialLibrary): void {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;

    const isSierra = biome === 'highSierra';
    const mat = isSierra ? materials.highSierraPuna : materials.groundForestFloor;

    if (this.highMesh) this.highMesh.material = mat;
    if (this.medMesh) this.medMesh.material = mat;
    if (this.lowMesh) this.lowMesh.material = mat;

    if (this.highGeo) this.populateTerrainVertices(this.highGeo);
    if (this.medGeo) this.populateTerrainVertices(this.medGeo);
    if (this.lowGeo) this.populateTerrainVertices(this.lowGeo);

    for (let i = 0; i < this.peakMeshes.length; i++) {
      this.populateMassifColors(
        this.peakMeshes[i].geometry as THREE.BufferGeometry,
        isSierra ? 0.32 : 0.48
      );
    }
  }

  public getTerrainHeightAt(x: number, z: number): number {
    if (this.currentBiome === 'highSierra') {
      return this.getHighSierraHeightAt(x, z);
    }

    const ravineCenterZ = Math.sin(x * 0.055) * 1.4;
    const distFromRavine = Math.abs(z - ravineCenterZ);

    let gorgeDepth = 0;
    if (distFromRavine < 7.2) {
      const t = distFromRavine / 7.2;
      const smooth = t * t * (3 - 2 * t);
      gorgeDepth = -6.0 * (1.0 - smooth);
    }

    let northRise = 0;
    if (z < -6.0) {
      const nz = Math.min(35.0, -6.0 - z);
      northRise = nz * 0.22 + Math.sin(nz * 0.45) * 0.25;
    } else if (z > 6.0) {
      const sz = Math.min(35.0, z - 6.0);
      northRise = sz * 0.06;
    }

    const absX = Math.abs(x);
    let valleyWall = 0;
    if (absX > 8.5) {
      const wx = absX - 8.5;
      valleyWall = Math.pow(wx, 1.32) * 0.36;
    }

    const bridgeClearance = Math.min(1.0, Math.hypot(x, z) / 8.5);
    const micro =
      (Math.sin(x * 0.23 + z * 0.19) * 0.28 +
        Math.cos(x * 0.51 - z * 0.43) * 0.12) *
      bridgeClearance;

    return 1.65 + gorgeDepth + northRise + valleyWall + micro;
  }

  public getHighSierraHeightAt(x: number, z: number): number {
    const absX = Math.abs(x);

    let passRise = 0;
    if (z < -4.0) {
      const nz = Math.min(45.0, -4.0 - z);
      passRise = nz * 0.15 + Math.sin(nz * 0.22) * 0.2;
    } else if (z > 6.0) {
      passRise = Math.min(20.0, z - 6.0) * 0.04;
    }

    let terraceRise = 0;
    if (absX > 9.5) {
      const distOut = absX - 9.5;
      const stepWidth = 3.4;
      const stepHeight = 1.25;
      const stepIndex = Math.floor(distOut / stepWidth);
      const frac = (distOut % stepWidth) / stepWidth;
      const ramp = frac < 0.24 ? frac / 0.24 : 1.0;
      if (stepIndex < 5) {
        terraceRise = (stepIndex + ramp) * stepHeight;
      } else {
        const alpineX = distOut - 5 * stepWidth;
        terraceRise = 5 * stepHeight + alpineX * 0.48 + Math.sin(x * 0.25 + z * 0.2) * 0.55;
      }
    }

    const centerClearance = Math.min(1.0, Math.hypot(x, z + 6.0) / 7.0);
    const micro =
      (Math.sin(x * 0.19 + z * 0.17) * 0.14 +
        Math.cos(x * 0.41 - z * 0.37) * 0.07) *
      centerClearance;

    return 2.0 + passRise + terraceRise + micro;
  }

  public sampleGroundY(x: number, z: number, currentY: number = 4.0): number {
    if (
      this.currentBiome !== 'highSierra' &&
      Math.abs(x) <= 1.35 &&
      Math.abs(z) <= 5.85
    ) {
      const normZ = z / 5.85;
      const sag = (1.0 - normZ * normZ) * 0.28;
      return 1.72 - sag;
    }

    if (this.walkableMeshes.length > 0) {
      _rayOrigin.set(x, currentY + 8.0, z);
      _raycaster.set(_rayOrigin, _rayDown);
      _raycaster.near = 0.05;
      _raycaster.far = 30.0;
      _hits.length = 0;
      _raycaster.intersectObjects(this.walkableMeshes, true, _hits);
      if (_hits.length > 0) {
        return _hits[0].point.y;
      }
    }

    return this.getTerrainHeightAt(x, z);
  }

  private createTerrainGeometry(
    width: number,
    depth: number,
    segX: number,
    segZ: number
  ): THREE.BufferGeometry {
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const count = (geo.attributes.position as THREE.BufferAttribute).count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.populateTerrainVertices(geo);
    return geo;
  }

  private populateTerrainVertices(geo: THREE.BufferGeometry): void {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const count = pos.count;

    const isSierra = this.currentBiome === 'highSierra';

    const cMoss = new THREE.Color(0xb8d49c);
    const cEarth = new THREE.Color(0xd4be9e);
    const cRock = new THREE.Color(0xc8c4ba);
    const cRiverBed = new THREE.Color(0x688274);

    const cPunaGold = new THREE.Color(0xd8c696);
    const cTerraceSoil = new THREE.Color(0xa48e6c);
    const cSierraGranite = new THREE.Color(0.85, 0.98, 1.38);
    const cGlacialSnow = new THREE.Color(1.88, 2.22, 3.35);
    const cScratch = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = this.getTerrainHeightAt(vx, vz);
      pos.setY(i, vy);

      const noise = 0.5 + 0.5 * Math.sin(vx * 0.37 + vz * 0.41);

      if (isSierra) {
        const snowThreshold = vz < -18.0 ? 5.2 : 6.4;
        if (vy > snowThreshold + 1.8) {
          cScratch.copy(cGlacialSnow);
        } else if (vy > snowThreshold) {
          const snowT = (vy - snowThreshold) / 1.8;
          cScratch.copy(cSierraGranite).lerp(cGlacialSnow, snowT);
        } else if (Math.abs(vx) > 9.5) {
          const distOut = Math.abs(vx) - 9.5;
          const frac = (distOut % 3.4) / 3.4;
          if (frac < 0.25) {
            cScratch.copy(cSierraGranite);
          } else {
            cScratch.copy(cTerraceSoil).lerp(cPunaGold, 0.48 * noise);
          }
        } else {
          cScratch.copy(cPunaGold).lerp(cTerraceSoil, 0.28 * (1.0 - noise));
        }
      } else {
        const pathFactor = Math.exp(-(vx * vx) * 0.14);
        if (vy < -1.2) {
          cScratch.copy(cRiverBed).lerp(cRock, 0.35 * noise);
        } else if (pathFactor > 0.45 && Math.abs(vz) > 5.4) {
          cScratch.copy(cEarth).lerp(cMoss, 0.28 * noise);
        } else if (Math.abs(vx) > 16.0) {
          cScratch.copy(cRock).lerp(cMoss, 0.55 * noise);
        } else {
          cScratch.copy(cMoss).lerp(cEarth, 0.3 * (1.0 - noise));
        }
      }

      colAttr.setXYZ(i, cScratch.r, cScratch.g, cScratch.b);
    }

    pos.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /**
   * Builds a multi-peak jagged Andean Cordillera mountain range using non-degenerate
   * radial ridge meshes with vertex-colored snowcaps and couloirs (zero pyramid cones, zero spikes).
   */
  private buildCordilleraMountainRange(materials: PbrMaterialLibrary): void {
    this.peakMat = new THREE.MeshStandardMaterial({
      name: 'CordilleraMassifSnowAndRock',
      color: new THREE.Color(0xffffff),
      map: materials.highSierraSnow.map,
      normalMap: materials.fieldstoneRough.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.78,
      metalness: 0.0,
      vertexColors: true,
    });

    const peakSpecs = [
      { x: -68, z: -88, rx: 38, ry: 50, rz: 28, seed: 1.1 },
      { x: -42, z: -94, rx: 32, ry: 46, rz: 26, seed: 1.8 },
      { x: -18, z: -98, rx: 36, ry: 58, rz: 28, seed: 2.3 },
      { x: 4, z: -104, rx: 34, ry: 52, rz: 26, seed: 3.0 },
      { x: 26, z: -96, rx: 38, ry: 62, rz: 28, seed: 3.7 },
      { x: 48, z: -92, rx: 32, ry: 47, rz: 26, seed: 4.3 },
      { x: 70, z: -86, rx: 38, ry: 50, rz: 28, seed: 4.9 },
      { x: -78, z: -46, rx: 32, ry: 44, rz: 36, seed: 5.5 },
      { x: 78, z: -42, rx: 34, ry: 46, rz: 36, seed: 6.8 },
    ];

    for (let i = 0; i < peakSpecs.length; i++) {
      const p = peakSpecs[i];
      const massifGeo = this.createSculptedMassifGeometry(p.rx, p.ry, p.rz, p.seed);
      this.populateMassifColors(massifGeo, 0.44);
      this.geometries.push(massifGeo);

      const massifMesh = new THREE.Mesh(massifGeo, this.peakMat);
      massifMesh.position.set(p.x, -2.0, p.z);
      massifMesh.receiveShadow = true;
      this.group.add(massifMesh);
      this.peakMeshes.push(massifMesh);
    }
  }

  private createSculptedMassifGeometry(
    rx: number,
    ry: number,
    rz: number,
    seed: number
  ): THREE.BufferGeometry {
    const radialSegs = 36;
    const ringSegs = 18;
    const positions: number[] = [];
    const uvs: number[] = [];
    const normHeights: number[] = [];
    const angles: number[] = [];
    const indices: number[] = [];

    for (let rIdx = 0; rIdx <= ringSegs; rIdx++) {
      const t = rIdx / ringSegs; // 0 = summit point, 1 = base skirt
      const baseElev = Math.pow(1.0 - t, 1.18);

      for (let aIdx = 0; aIdx <= radialSegs; aIdx++) {
        const u = aIdx / radialSegs;
        const ang = u * Math.PI * 2;

        // Multi-arête glacial ridge modulation (0 at t=0 so summit closes cleanly with zero crown spikes)
        const arête =
          1.0 +
          t * (0.24 * Math.cos(ang * 3.0 + seed) +
               0.14 * Math.sin(ang * 5.0 - seed * 1.6) +
               0.07 * Math.cos(ang * 7.0 + t * 3.0));

        const rad = t * arête;
        const wx = Math.cos(ang) * rad * rx;
        const wz = Math.sin(ang) * rad * rz;
        // Asymmetric shoulder ridges (zero at t=0 so summit is a natural peak, not a flat line or needle)
        const subPeak =
          Math.sin(t * Math.PI) * (0.14 * Math.cos(ang * 2.0 + seed) + 0.09 * Math.sin(ang * 3.0 - seed));
        const crag =
          Math.sin(t * Math.PI) *
          (Math.sin(ang * 5.0 + seed) * 0.08 + Math.cos(t * 9.0 + ang * 3.0) * 0.05);
        const hNorm = Math.max(0, Math.min(1.18, baseElev + subPeak + crag));
        const wy = hNorm * ry;

        positions.push(wx, wy, wz);
        uvs.push(u * 4.0, t * 4.0);
        normHeights.push(hNorm);
        angles.push(ang + seed);
      }
    }

    const stride = radialSegs + 1;
    for (let rIdx = 0; rIdx < ringSegs; rIdx++) {
      for (let aIdx = 0; aIdx < radialSegs; aIdx++) {
        const a = rIdx * stride + aIdx;
        const b = a + stride;
        // Outward CCW winding so vertex normals point strictly UP (+Y) and OUTWARD!
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(normHeights.length * 3), 3));
    (geo as unknown as { _normHeights: number[]; _angles: number[] })._normHeights = normHeights;
    (geo as unknown as { _normHeights: number[]; _angles: number[] })._angles = angles;
    geo.computeVertexNormals();
    return geo;
  }

  private populateMassifColors(geo: THREE.BufferGeometry, snowlineNorm: number): void {
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const meta = geo as unknown as { _normHeights?: number[]; _angles?: number[] };
    if (!colAttr || !meta._normHeights || !meta._angles) return;

    const cRock = new THREE.Color(0.58, 0.60, 0.66);
    const cSnow = new THREE.Color(2.45, 2.55, 2.75);
    const cScratch = new THREE.Color();

    for (let i = 0; i < meta._normHeights.length; i++) {
      const h = meta._normHeights[i];
      const ang = meta._angles[i];
      // Glacial couloirs extend snow fingers lower down into the gullies
      const couloir = Math.sin(ang * 5.0) * 0.09 + Math.cos(ang * 3.0) * 0.06;
      const localSnowline = snowlineNorm + couloir;

      if (h > localSnowline + 0.14) {
        cScratch.copy(cSnow);
      } else if (h > localSnowline) {
        const t = (h - localSnowline) / 0.14;
        cScratch.copy(cRock).lerp(cSnow, t);
      } else {
        cScratch.copy(cRock);
      }
      colAttr.setXYZ(i, cScratch.r, cScratch.g, cScratch.b);
    }
    colAttr.needsUpdate = true;
  }

  public update(_dt: number): void {}

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    if (this.peakMat) this.peakMat.dispose();
    this.geometries.length = 0;
    this.walkableMeshes.length = 0;
    this.peakMeshes.length = 0;
    this.group.removeFromParent();
  }
}
