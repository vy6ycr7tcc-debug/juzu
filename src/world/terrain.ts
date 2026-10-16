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
    if (this.currentBiome === 'jungleLowlands') {
      return this.getJungleLowlandsHeightAt(x, z);
    }
    if (this.currentBiome === 'paititi') {
      return this.getPaititiHeightAt(x, z);
    }

    return this.getCloudForestHeightAt(x, z);
  }

  public getCloudForestHeightAt(x: number, z: number): number {
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

    // North-West stepped Inca terrace riser supporting the upper lookout shelf behind the crag
    let nwBluff = 0;
    if (x < -2.4 && z < -17.6) {
      const tz = Math.min(1.0, (-17.6 - z) / 2.2);
      const tx = Math.min(1.0, (-2.4 - x) / 1.6);
      nwBluff = tz * tz * (3.0 - 2.0 * tz) * tx * 3.85;
    }

    const bridgeClearance = Math.min(1.0, Math.hypot(x, z) / 8.5);
    const micro =
      (Math.sin(x * 0.23 + z * 0.19) * 0.28 +
        Math.cos(x * 0.51 - z * 0.43) * 0.12) *
      bridgeClearance;

    return 1.65 + gorgeDepth + northRise + valleyWall + nwBluff + micro;
  }

  public getJungleLowlandsHeightAt(x: number, z: number): number {
    const cenX = 0.0;
    const cenZ = -8.2;
    const distToCenote = Math.hypot(x - cenX, z - cenZ);

    // Sunken limestone basin holding the crystalline cenote pool
    let cenoteDepth = 0;
    if (distToCenote < 4.6) {
      const t = distToCenote / 4.6;
      // Dished parabolic basin bowl (depth 1.05m at center)
      cenoteDepth = (1.0 - t * t) * 1.05;
    }

    // Lush Andean rainforest foothills rising behind the north altar
    let northRise = 0;
    if (z < -10.5) {
      const nz = Math.min(35.0, -10.5 - z);
      northRise = nz * 0.24 + Math.sin(nz * 0.36) * 0.22;
    }

    // Gentle south rainforest approach
    let southSlope = 0;
    if (z > -4.0) {
      const sz = Math.min(30.0, z - (-4.0));
      southSlope = sz * 0.035;
    }

    // Flanking jungle hillsides
    const absX = Math.abs(x);
    let lateralHills = 0;
    if (absX > 8.8) {
      const wx = absX - 8.8;
      lateralHills = Math.pow(wx, 1.28) * 0.34;
    }

    // Shallow natural drainage stream for the hydraulic sluice gate near (3.6, 2.4)
    let drainageChannel = 0;
    const distToDrain = Math.hypot(x - 3.6, z - 2.4);
    if (distToDrain < 2.2) {
      const dt = distToDrain / 2.2;
      drainageChannel = (1.0 - dt * dt) * 0.38;
    }

    // Natural undulating moss knolls and root hummocks
    const centerClearance = Math.min(1.0, distToCenote / 5.2);
    const swells =
      (Math.sin(x * 0.24 + z * 0.21) * 0.18 +
        Math.cos(x * 0.44 - z * 0.32) * 0.10) *
      centerClearance;

    return 2.15 - cenoteDepth - drainageChannel + northRise + southSlope + lateralHills + swells;
  }

  public getPaititiHeightAt(x: number, z: number): number {
    const absX = Math.abs(x);

    // Monolithic Coricancha temple approach:
    // z in [-3.5, -14.5] is the monumental grand ceremonial stairway incline
    let centralIncline = 0;
    if (z < -3.5) {
      const climbZ = Math.min(11.0, -3.5 - z);
      centralIncline = (climbZ / 11.0) * 3.65;
    }

    // Sanctuary platform level for z <= -14.5, rising into caldera back wall beyond -20.0
    let sanctuaryBack = 0;
    if (z < -14.5) {
      const pz = -14.5 - z;
      if (pz > 5.5) {
        sanctuaryBack = (pz - 5.5) * 0.38 + Math.sin(pz * 0.3) * 0.25;
      }
    }

    // South sun plaza floor for z > 0
    let southPlaza = 0;
    if (z > 0.0) {
      southPlaza = Math.min(25.0, z) * 0.02;
    }

    // Stepped lateral Coricancha terraces flanking the grand staircase
    let terraceRise = 0;
    if (absX > 4.6) {
      const distOut = absX - 4.6;
      const stepWidth = 3.2;
      const stepHeight = 1.15;
      const stepIdx = Math.floor(distOut / stepWidth);
      const frac = (distOut % stepWidth) / stepWidth;
      const ramp = frac < 0.2 ? frac / 0.2 : 1.0;
      if (stepIdx < 4) {
        terraceRise = (stepIdx + ramp) * stepHeight;
      } else {
        const calderaEdge = distOut - 4 * stepWidth;
        terraceRise = 4 * stepHeight + calderaEdge * 0.45;
      }
    }

    const stairClearance = Math.min(1.0, Math.max(0, absX - 3.8) / 2.0);
    const micro =
      (Math.sin(x * 0.16 + z * 0.14) * 0.08 +
        Math.cos(x * 0.35 - z * 0.28) * 0.05) *
      stairClearance;

    return 2.15 + centralIncline + sanctuaryBack + southPlaza + terraceRise + micro;
  }

  public getHighSierraHeightAt(x: number, z: number): number {
    let passRise = 0;
    if (z < -4.0) {
      const nz = Math.min(45.0, -4.0 - z);
      passRise = nz * 0.15 + Math.sin(nz * 0.22) * 0.2;
    } else if (z > 6.0) {
      passRise = Math.min(20.0, z - 6.0) * 0.04;
    }

    // Natural winding valley center and organic fluctuating valley floor width
    const valleyCenter = Math.sin(z * 0.07) * 1.5 + Math.sin(z * 0.14) * 0.6;
    const valleyWidth = 9.2 + Math.sin(z * 0.09 + 1.2) * 2.2 + Math.cos(z * 0.04) * 1.4;
    const lateralDist = Math.abs(x - valleyCenter);

    let terraceRise = 0;
    if (lateralDist > valleyWidth) {
      const distOut = lateralDist - valleyWidth;
      // Contour line curvature tracking mountain topography
      const contourJitter = Math.sin(z * 0.18 + x * 0.12) * 0.6 + Math.cos(z * 0.08) * 0.4;
      const adjustedDist = Math.max(0, distOut + contourJitter);
      const stepWidth = 3.6;
      const stepHeight = 1.15;
      const stepIndex = Math.floor(adjustedDist / stepWidth);
      const frac = (adjustedDist % stepWidth) / stepWidth;
      // Smooth organic stone coping and rounded terrace lip
      const ramp = Math.min(1.0, Math.max(0.0, (frac - 0.06) / 0.32));
      const smoothRamp = ramp * ramp * (3.0 - 2.0 * ramp);
      if (stepIndex < 4) {
        terraceRise = (stepIndex + smoothRamp) * stepHeight;
      } else {
        const alpineDist = adjustedDist - 4 * stepWidth;
        const cragRidges =
          Math.sin(x * 0.22 + z * 0.18) * 0.65 +
          Math.abs(Math.cos(x * 0.38 - z * 0.31)) * 0.48 +
          Math.sin(x * 0.75 + z * 0.62) * 0.24;
        terraceRise = 4 * stepHeight + Math.pow(alpineDist, 1.18) * 0.42 + cragRidges;
      }
    }

    const centerClearance = Math.min(1.0, Math.hypot(x - valleyCenter, z + 6.0) / 7.0);
    const micro =
      (Math.sin(x * 0.19 + z * 0.17) * 0.14 +
        Math.cos(x * 0.41 - z * 0.37) * 0.07 +
        Math.sin(x * 0.72 + z * 0.65) * 0.04) *
      centerClearance;

    return 2.0 + passRise + terraceRise + micro;
  }

  private isWalkableActive(obj: THREE.Object3D | null): boolean {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      if (!curr.visible) return false;
      curr = curr.parent;
    }
    return true;
  }

  public sampleGroundY(
    x: number,
    z: number,
    currentY: number = 4.0,
    maxStepUp: number = 0.72
  ): number {
    if (
      this.currentBiome === 'cloudForest' &&
      Math.abs(x) <= 1.35 &&
      Math.abs(z) <= 5.85
    ) {
      const normZ = z / 5.85;
      const sag = (1.0 - normZ * normZ) * 0.28;
      return 1.72 - sag;
    }

    const baseTerrainY = this.getTerrainHeightAt(x, z);

    if (this.walkableMeshes.length > 0) {
      const maxAllowedY = currentY + maxStepUp;
      _rayOrigin.set(x, maxAllowedY + 0.35, z);
      _raycaster.set(_rayOrigin, _rayDown);
      _raycaster.near = 0.05;
      _raycaster.far = 30.0;
      _hits.length = 0;
      _raycaster.intersectObjects(this.walkableMeshes, true, _hits);

      let bestY = -Infinity;
      for (let i = 0; i < _hits.length; i++) {
        const hit = _hits[i];
        if (!this.isWalkableActive(hit.object)) continue;
        if (hit.point.y <= maxAllowedY && hit.point.y > bestY) {
          bestY = hit.point.y;
        }
      }
      if (bestY > -Infinity) {
        return Math.max(baseTerrainY, bestY);
      }
    }

    return baseTerrainY;
  }

  /**
   * Probes for the highest active walkable ledge/platform/terrace top at (x, z)
   * up to `maxReachAbove` meters above `currentY` for vault and jump-mantle detection.
   */
  public sampleLedgeHeight(
    x: number,
    z: number,
    currentY: number,
    maxReachAbove: number = 2.2
  ): number {
    return this.sampleGroundY(x, z, currentY, maxReachAbove);
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

    const biome = this.currentBiome;
    const isSierra = biome === 'highSierra';

    const cMoss = new THREE.Color(0x98bc7c);
    const cDeepMoss = new THREE.Color(0x6e9458);
    const cEarth = new THREE.Color(0xb89e7c);
    const cRock = new THREE.Color(0xa6a298);
    const cRiverBed = new THREE.Color(0x526e62);

    // Calibrated for neutral-dark photographic snow-rock/stonework albedo (0.32 average luminance)
    const cPunaGold = new THREE.Color(1.62, 1.42, 0.96);
    const cTerraceSoil = new THREE.Color(1.12, 0.94, 0.72);
    const cSierraGranite = new THREE.Color(1.48, 1.50, 1.56);
    const cAlpineSlate = new THREE.Color(1.14, 1.18, 1.24);
    const cGlacialSnow = new THREE.Color(3.4, 3.6, 3.9);
    const cScratch = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = this.getTerrainHeightAt(vx, vz);
      pos.setY(i, vy);

      const noise = 0.5 + 0.5 * Math.sin(vx * 0.37 + vz * 0.41);
      const fineNoise = 0.5 + 0.5 * Math.cos(vx * 0.83 - vz * 0.79);

      if (isSierra) {
        const snowThreshold = vz < -18.0 ? 5.2 : 6.4;
        if (vy > snowThreshold + 2.2) {
          cScratch.copy(cGlacialSnow);
        } else if (vy > snowThreshold) {
          const snowT = (vy - snowThreshold) / 2.2;
          cScratch.copy(cSierraGranite).lerp(cGlacialSnow, snowT * (0.45 + 0.55 * fineNoise));
        } else {
          const valleyCenter = Math.sin(vz * 0.07) * 1.5 + Math.sin(vz * 0.14) * 0.6;
          const valleyWidth = 9.2 + Math.sin(vz * 0.09 + 1.2) * 2.2 + Math.cos(vz * 0.04) * 1.4;
          const lateralDist = Math.abs(vx - valleyCenter);

          if (lateralDist > valleyWidth) {
            const distOut = lateralDist - valleyWidth;
            const contourJitter = Math.sin(vz * 0.18 + vx * 0.12) * 0.6 + Math.cos(vz * 0.08) * 0.4;
            const adjustedDist = Math.max(0, distOut + contourJitter);
            const stepIndex = Math.floor(adjustedDist / 3.6);
            const frac = (adjustedDist % 3.6) / 3.6;
            if (stepIndex >= 4) {
              // Steep outer alpine crags: weathered Andean slate & granite with golden lichen & frost
              cScratch.copy(cAlpineSlate).lerp(cSierraGranite, 0.58 * noise).lerp(cPunaGold, 0.18 * fineNoise);
            } else if (frac < 0.36) {
              // Coursed stone terrace riser face
              cScratch.copy(cAlpineSlate).lerp(cSierraGranite, 0.65 * fineNoise);
            } else {
              // Cultivated agricultural terrace bench (rich dark Andean soil + golden ichu tufts)
              cScratch.copy(cTerraceSoil).lerp(cPunaGold, 0.45 * noise);
            }
          } else {
            const roadCenter = Math.sin(vz * 0.08) * 0.45;
            const pathDist = Math.abs(vx - roadCenter);
            if (pathDist < 1.8) {
              // Road bed under the Qhapaq Ñan: crushed granite & dark earth
              cScratch.copy(cAlpineSlate).lerp(cTerraceSoil, 0.48 * noise);
            } else {
              cScratch.copy(cPunaGold).lerp(cSierraGranite, 0.38 * noise).lerp(cTerraceSoil, 0.30 * fineNoise);
            }
          }
        }
      } else if (biome === 'paititi') {
        // Paititi Sanctuary: stone ceremonial staircase & emerald caldera terraces
        const absX = Math.abs(vx);
        if (absX < 4.6 && vz < 2.0) {
          cScratch.copy(cRock).lerp(cEarth, 0.25 * noise);
        } else if (absX > 4.6) {
          const frac = ((absX - 4.6) % 3.2) / 3.2;
          if (frac < 0.28) {
            cScratch.copy(cRock).lerp(cDeepMoss, 0.35 * fineNoise);
          } else {
            cScratch.copy(cMoss).lerp(cEarth, 0.32 * noise);
          }
        } else {
          cScratch.copy(cMoss).lerp(cRock, 0.35 * noise);
        }
      } else if (biome === 'jungleLowlands') {
        // Antisuyu Jungle Lowlands: lush emerald rainforest floor & wet limestone cenote basin
        const distToCenote = Math.hypot(vx, vz + 8.2);
        if (distToCenote < 4.8) {
          cScratch.copy(cRiverBed).lerp(cRock, 0.45 * fineNoise);
        } else if (Math.abs(vx) < 2.4 && vz > -3.5) {
          cScratch.copy(cEarth).lerp(cDeepMoss, 0.48 * noise);
        } else {
          cScratch.copy(cDeepMoss).lerp(cMoss, 0.55 * noise).lerp(cEarth, 0.22 * fineNoise);
        }
      } else {
        // Cloud Forest gorge & Inca approach trail
        const pathFactor = Math.exp(-(vx * vx) * 0.14);
        if (vy < -1.2) {
          cScratch.copy(cRiverBed).lerp(cRock, 0.35 * noise);
        } else if (pathFactor > 0.45 && Math.abs(vz) > 5.4) {
          cScratch.copy(cEarth).lerp(cMoss, 0.32 * noise);
        } else if (Math.abs(vx) > 12.0) {
          cScratch.copy(cRock).lerp(cDeepMoss, 0.52 * noise);
        } else {
          cScratch.copy(cMoss).lerp(cDeepMoss, 0.35 * fineNoise).lerp(cEarth, 0.25 * (1.0 - noise));
        }
      }

      colAttr.setXYZ(i, cScratch.r, cScratch.g, cScratch.b);
    }

    pos.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
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
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.82,
      metalness: 0.02,
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    const peakSpecs = [
      // Central iconic Andean massif with multiple asymmetric horns and sharp arête
      { x: -5, z: -105, rx: 125, ry: 48, rz: 85, seed: 1.4, snow: 0.38 },
      // Left and right peaks framing the central gap
      { x: -60, z: -118, rx: 105, ry: 45, rz: 80, seed: 2.7, snow: 0.42 },
      { x: 55, z: -115, rx: 105, ry: 44, rz: 80, seed: 3.9, snow: 0.42 },
      // Far left and right horns
      { x: -100, z: -140, rx: 120, ry: 58, rz: 90, seed: 4.5, snow: 0.38 },
      { x: 100, z: -140, rx: 120, ry: 56, rz: 90, seed: 5.2, snow: 0.38 },
      // Colossal backdrop summits piercing the upper sky
      { x: -35, z: -175, rx: 135, ry: 78, rz: 105, seed: 6.3, snow: 0.32 },
      { x: 40, z: -180, rx: 135, ry: 80, rz: 105, seed: 7.1, snow: 0.32 },
      { x: -130, z: -195, rx: 145, ry: 86, rz: 110, seed: 8.2, snow: 0.30 },
      { x: 130, z: -195, rx: 145, ry: 84, rz: 110, seed: 9.0, snow: 0.30 },
    ];

    for (let i = 0; i < peakSpecs.length; i++) {
      const p = peakSpecs[i];
      const massifGeo = this.createSculptedMassifGeometry(p.rx, p.ry, p.rz, p.seed);
      this.populateMassifColors(massifGeo, p.snow);
      this.geometries.push(massifGeo);

      const massifMesh = new THREE.Mesh(massifGeo, this.peakMat);
      massifMesh.position.set(p.x, -2.0, p.z);
      massifMesh.receiveShadow = true;
      this.group.add(massifMesh);
      this.peakMeshes.push(massifMesh);
    }
  }

  private createSculptedMassifGeometry(
    width: number,
    maxHeight: number,
    depth: number,
    seed: number
  ): THREE.BufferGeometry {
    const segs = 48;
    const geo = new THREE.PlaneGeometry(width, depth, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const count = pos.count;
    const rawH = new Float32Array(count);
    let maxRaw = 0.001;

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const nx = x / (width * 0.5);
      const nz = z / (depth * 0.5);
      const dist = Math.hypot(nx, nz);

      if (dist >= 1.0) {
        rawH[i] = 0;
        continue;
      }

      // 1. Tectonic arête ridgeline curving diagonally through the massif
      const ridgeZ = (Math.sin(nx * 2.2 + seed) * 0.22 + nx * 0.12) * (depth * 0.5);
      const distToRidge = Math.abs(z - ridgeZ) / (depth * 0.5);
      // Majestic mountain slope cross-section with broad shoulders
      const ridgeShape = Math.exp(-Math.pow(distToRidge * 1.85, 1.35));

      // 2. Multi-summit jagged crest profile (multiple horns + sharp cols, zero smooth cones)
      const p1X = -0.20 + Math.sin(seed * 1.7) * 0.08;
      const p2X = 0.28 + Math.cos(seed * 2.1) * 0.08;
      const p3X = -0.62;
      const p4X = 0.65;
      const horn1 = Math.exp(-Math.pow((nx - p1X) * 2.6, 2)) * 1.0;
      const horn2 = Math.exp(-Math.pow((nx - p2X) * 3.0, 2)) * 0.88;
      const shoulder1 = Math.exp(-Math.pow((nx - p3X) * 3.4, 2)) * 0.72;
      const shoulder2 = Math.exp(-Math.pow((nx - p4X) * 3.6, 2)) * 0.65;
      const crestSpine =
        Math.max(horn1, Math.max(horn2, Math.max(shoulder1, shoulder2))) *
        (1.0 - Math.pow(Math.abs(nx), 1.4) * 0.38);

      // 3. Glacial cirque erosion: deep concave scoop carved into one face
      const cirqueX = 0.08 + Math.sin(seed * 3.1) * 0.1;
      const cirqueZ = 0.18;
      const cirqueDist = Math.hypot(nx - cirqueX, nz - cirqueZ);
      const cirqueHollow = Math.exp(-cirqueDist * cirqueDist * 9.0) * 0.32;

      // 4. Asymmetric slope: sheer precipice vs stepped glaciated couloir
      const asym = z > ridgeZ ? 0.74 : 1.26;

      // 5. Tilted Andean geological rock strata and stepped fracture planes (25-degree tilt)
      const strata =
        Math.sin((x * 0.24 + z * 0.18 + seed) * 1.4) * 0.09 +
        Math.abs(Math.cos((x * 0.48 - z * 0.32 + seed * 2.1) * 1.2)) * 0.06;

      // 6. Avalanche couloirs / rock chutes running down the cliff faces
      const couloirs =
        Math.sin(nx * 16.0 + seed * 4.3) * 0.045 * Math.max(0, 1.0 - distToRidge * 2.2);

      // 7. High-frequency micro-crag noise
      const fbm =
        Math.sin(x * 0.18 + z * 0.14 + seed) * 0.08 +
        Math.cos(x * 0.42 - z * 0.36) * 0.04 +
        Math.sin(x * 0.88 + z * 0.78) * 0.02;

      const falloff = Math.cos(Math.min(1.0, dist) * Math.PI * 0.5);
      const rawRidge = ridgeShape * crestSpine * asym - cirqueHollow;
      const h = Math.max(0, (rawRidge + strata + couloirs + fbm) * Math.pow(falloff, 1.15));
      rawH[i] = h;
      if (h > maxRaw) maxRaw = h;
    }

    const normHeights = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const hNorm = rawH[i] / maxRaw;
      normHeights[i] = hNorm;
      const y = hNorm * maxHeight;
      pos.setY(i, y);
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Project UV with vertical slope contribution so steep cliff faces do not stretch textures vertically
      uv.setXY(
        i,
        (x / width + 0.5) * 6.0 + (y / maxHeight) * 2.5,
        (z / depth + 0.5) * 6.0 + (y / maxHeight) * 2.5
      );
    }

    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    (geo as unknown as { _normHeights: Float32Array })._normHeights = normHeights;
    geo.computeVertexNormals();
    return geo;
  }

  private populateMassifColors(geo: THREE.BufferGeometry, snowlineNorm: number): void {
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const normAttr = geo.attributes.normal as THREE.BufferAttribute;
    const meta = geo as unknown as { _normHeights?: Float32Array };
    if (!colAttr || !meta._normHeights || !normAttr) return;

    // Physically accurate PBR Andean rock and snow albedos (compensated for dark albedo texture)
    const cRock = new THREE.Color(2.2, 2.3, 2.5);
    const cSnow = new THREE.Color(5.2, 5.4, 5.8);
    const cIce = new THREE.Color(3.6, 4.4, 5.2);
    const cScratch = new THREE.Color();

    for (let i = 0; i < meta._normHeights.length; i++) {
      const h = meta._normHeights[i];
      const ny = normAttr.getY(i);

      // Fluted Andean snow clings to slopes down to ~75 degrees (ny > 0.16)
      const slopeFactor = Math.max(0, Math.min(1.0, (ny - 0.16) / 0.22));

      if (h > snowlineNorm && (slopeFactor > 0.1 || h > 0.72)) {
        const summitBoost = h > 0.75 ? Math.min(1.0, (h - 0.75) / 0.15) : 0.0;
        const effectiveSlope = Math.max(slopeFactor, summitBoost * 0.85);
        const tSnow = Math.min(1.0, (h - snowlineNorm) / 0.22) * effectiveSlope;
        const snowShade = cIce.clone().lerp(cSnow, Math.min(1.0, (h - snowlineNorm) / 0.12));
        cScratch.copy(cRock).lerp(snowShade, tSnow);
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
