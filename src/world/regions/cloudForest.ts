/**
 * Module: src/world/regions/cloudForest.ts
 * Responsibility: Region 1 — Cloud Forest Valleys vertical slice architecture
 * and setpieces per Bible §1.7:
 * - Hanging rope-and-plank bridge spanning the ravine with Inca stone anchor towers
 * - Battered Inca polygonal andesite retaining walls and stone steps cut into slopes
 * - Trail shelter with weathered timber rafters and woven Quechua cloth banner
 * - Carved Inca Stele & flowing stone water channel
 * - Sanctuary Checkpoint circle and Condor Viewpoint ridge marker
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts.
 * Exports: InteractableTarget, CloudForestRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';

export interface InteractableTarget {
  id: string;
  label: string;
  promptText: string;
  position: THREE.Vector3;
  radius: number;
}

export class CloudForestRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  private bridgeGroup: THREE.Group = new THREE.Group();
  private condorMesh: THREE.Group = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private elapsedSec: number = 0;

  public build(
    scene: THREE.Scene,
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    this.group.name = 'Region1_CloudForestValleys';

    // 1. Hanging Rope-and-Plank Bridge across the central ravine (z = -5.85 to +5.85)
    this.buildHangingBridge(materials, terrain);

    // 2. Battered Inca Retaining Walls & Cut Stone Steps on South and North approaches
    this.buildStoneTerracesAndSteps(materials, terrain);

    // 3. Trail Shelter & Carved Inca Stele + Water Channel on the North Sanctuary Terrace
    this.buildTrailShelterAndStele(materials, terrain);

    // 4. Sanctuary Checkpoint Circle (south of bridge) & Condor Viewpoint (north ridge)
    this.buildCheckpointAndViewpoint(materials, terrain);

    scene.add(this.group);
  }

  private buildHangingBridge(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    this.bridgeGroup.name = 'RavineHangingBridge';

    // Stone anchor abutments & battered Inca pillars on South (z = +6.0) and North (z = -6.0) rims
    const abutmentGeo = this.createChippedBlockGeometry(3.8, 3.2, 2.2);
    const pillarGeo = this.createChippedBlockGeometry(0.68, 2.45, 0.68);
    const capGeo = this.createChippedBlockGeometry(0.82, 0.28, 0.82);
    this.geometries.push(abutmentGeo, pillarGeo, capGeo);

    const ends = [6.0, -6.0];
    for (let e = 0; e < ends.length; e++) {
      const ez = ends[e];
      const baseY = terrain.getTerrainHeightAt(0, ez);

      const abutment = new THREE.Mesh(abutmentGeo, materials.andesiteCut);
      abutment.position.set(0, baseY - 1.15, ez);
      abutment.castShadow = true;
      abutment.receiveShadow = true;
      this.group.add(abutment);
      terrain.registerWalkable(abutment);

      // Left & Right trapezoidal stone rope-anchor pillars
      const sides = [-1.42, 1.42];
      for (let s = 0; s < sides.length; s++) {
        const sx = sides[s];
        const pillar = new THREE.Mesh(pillarGeo, materials.andesiteCut);
        pillar.position.set(sx, baseY + 1.15, ez);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.group.add(pillar);

        const cap = new THREE.Mesh(capGeo, materials.moss);
        cap.position.set(sx, baseY + 2.42, ez);
        cap.castShadow = true;
        cap.receiveShadow = true;
        this.group.add(cap);

        // Stone anchor pillar capped with mountain moss
      }
    }

    // 26 Weathered Wooden Planks (InstancedMesh per §5.2) with catenary sag
    const plankCount = 26;
    const plankGeo = this.createChippedBlockGeometry(2.55, 0.11, 0.36);
    this.geometries.push(plankGeo);
    const plankInstanced = new THREE.InstancedMesh(plankGeo, materials.woodAged, plankCount);
    plankInstanced.castShadow = true;
    plankInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < plankCount; i++) {
      const t = i / (plankCount - 1);
      const z = 5.5 - t * 11.0;
      const normZ = z / 5.85;
      const sag = (1.0 - normZ * normZ) * 0.28;
      const y = 1.66 - sag;
      // Subtle per-plank organic twist & weathering
      const jitterYaw = Math.sin(i * 2.7) * 0.025;
      const jitterRoll = Math.cos(i * 3.1) * 0.015;

      dummy.position.set(0, y, z);
      dummy.rotation.set(0, jitterYaw, jitterRoll);
      dummy.scale.set(1.0 + Math.sin(i * 1.9) * 0.03, 1.0, 1.0);
      dummy.updateMatrix();
      plankInstanced.setMatrixAt(i, dummy.matrix);

      color.setHSL(0.08, 0.25, 0.42 + Math.sin(i * 4.3) * 0.08);
      plankInstanced.setColorAt(i, color);
    }
    plankInstanced.instanceMatrix.needsUpdate = true;
    if (plankInstanced.instanceColor) plankInstanced.instanceColor.needsUpdate = true;
    this.bridgeGroup.add(plankInstanced);

    // Walkable bridge collision strip for downward grounding raycast
    const bridgeDeckColliderGeo = new THREE.BoxGeometry(2.6, 0.14, 11.6);
    this.geometries.push(bridgeDeckColliderGeo);
    const bridgeColliderMesh = new THREE.Mesh(bridgeDeckColliderGeo, materials.woodAged);
    bridgeColliderMesh.position.set(0, 1.48, 0);
    bridgeColliderMesh.visible = false;
    this.bridgeGroup.add(bridgeColliderMesh);
    terrain.registerWalkable(bridgeColliderMesh);

    // Braided suspension handrail cables, foot cables, and vertical dropper ropes
    const cableSegs = 20;
    const ropeSides = [-1.28, 1.28];
    const segGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);
    segGeo.rotateX(Math.PI / 2);
    this.geometries.push(segGeo);

    for (let s = 0; s < ropeSides.length; s++) {
      const rx = ropeSides[s];
      for (let i = 0; i < cableSegs; i++) {
        const t0 = i / cableSegs;
        const t1 = (i + 1) / cableSegs;
        const z0 = 5.9 - t0 * 11.8;
        const z1 = 5.9 - t1 * 11.8;
        const n0 = z0 / 5.9;
        const n1 = z1 / 5.9;
        const y0 = 2.95 - (1.0 - n0 * n0) * 0.58;
        const y1 = 2.95 - (1.0 - n1 * n1) * 0.58;

        const handCable = new THREE.Mesh(segGeo, materials.leather);
        handCable.position.set(rx, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
        const dz = z1 - z0;
        const dy = y1 - y0;
        const len = Math.hypot(dy, dz);
        handCable.scale.set(1, 1, len);
        handCable.rotation.x = Math.atan2(dy, -dz);
        handCable.castShadow = true;
        this.bridgeGroup.add(handCable);

        // Vertical rope hanger every 2 segments
        if (i % 2 === 0 && i > 0) {
          const deckY = 1.66 - (1.0 - n0 * n0) * 0.28;
          const hangerH = y0 - deckY;
          const hangerGeo = new THREE.CylinderGeometry(0.018, 0.018, hangerH, 5);
          this.geometries.push(hangerGeo);
          const hanger = new THREE.Mesh(hangerGeo, materials.leather);
          hanger.position.set(rx, deckY + hangerH * 0.5, z0);
          this.bridgeGroup.add(hanger);
        }
      }
    }

    this.group.add(this.bridgeGroup);
  }

  private buildStoneTerracesAndSteps(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    // Cut stone steps leading up from the north side of the bridge (z = -6.8 to -15.5)
    const stepCount = 12;
    const stepGeo = this.createChippedBlockGeometry(2.8, 0.34, 0.72);
    this.geometries.push(stepGeo);

    for (let i = 0; i < stepCount; i++) {
      const sz = -6.8 - i * 0.72;
      const sy = terrain.getTerrainHeightAt(0, sz);
      const step = new THREE.Mesh(stepGeo, materials.andesiteCut);
      step.position.set(Math.sin(i * 0.6) * 0.08, sy - 0.06, sz);
      step.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.015;
      step.castShadow = true;
      step.receiveShadow = true;
      this.group.add(step);
      terrain.registerWalkable(step);
    }

    // Battered Inca polygonal retaining walls flanking the valley path & ravine rim
    const wallSpecs = [
      { x: -4.6, z: 8.8, w: 4.8, h: 2.6, d: 1.1, rotY: 0.28 },
      { x: 4.8, z: 9.2, w: 4.6, h: 2.5, d: 1.1, rotY: -0.26 },
      { x: -5.2, z: -9.5, w: 5.5, h: 3.1, d: 1.2, rotY: -0.18 },
      { x: 5.4, z: -10.2, w: 5.2, h: 3.0, d: 1.2, rotY: 0.22 },
      { x: -7.5, z: -18.5, w: 6.4, h: 3.4, d: 1.3, rotY: 0.12 },
      { x: 7.2, z: -19.0, w: 6.0, h: 3.2, d: 1.3, rotY: -0.15 },
    ];

    for (let i = 0; i < wallSpecs.length; i++) {
      const w = wallSpecs[i];
      const wy = terrain.getTerrainHeightAt(w.x, w.z);
      const wGeo = this.createBatteredWallGeometry(w.w, w.h, w.d);
      this.geometries.push(wGeo);
      const wall = new THREE.Mesh(wGeo, materials.andesiteCut);
      wall.position.set(w.x, wy + w.h * 0.35, w.z);
      wall.rotation.y = w.rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      // Moss cap along the top of the retaining wall (§2.2 moss on horizontal surfaces)
      const mossCapGeo = this.createChippedBlockGeometry(w.w * 0.92, 0.22, w.d * 0.88);
      this.geometries.push(mossCapGeo);
      const mossCap = new THREE.Mesh(mossCapGeo, materials.moss);
      mossCap.position.set(w.x, wy + w.h * 0.85, w.z);
      mossCap.rotation.y = w.rotY;
      mossCap.receiveShadow = true;
      this.group.add(mossCap);
    }
  }

  private buildTrailShelterAndStele(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    // 1. Stone Trail Shelter on the North Terrace (x = 4.2, z = -15.5) per §1.7
    const shX = 4.2;
    const shZ = -15.5;
    const shY = terrain.getTerrainHeightAt(shX, shZ);

    const backWallGeo = this.createBatteredWallGeometry(3.6, 2.3, 0.55);
    const sideWallGeo = this.createBatteredWallGeometry(0.55, 2.1, 2.6);
    const beamGeo = this.createChippedBlockGeometry(4.0, 0.18, 0.22);
    this.geometries.push(backWallGeo, sideWallGeo, beamGeo);

    const backWall = new THREE.Mesh(backWallGeo, materials.andesiteCut);
    backWall.position.set(shX, shY + 0.95, shZ - 1.1);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    const leftWall = new THREE.Mesh(sideWallGeo, materials.andesiteCut);
    leftWall.position.set(shX - 1.55, shY + 0.85, shZ);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, materials.andesiteCut);
    rightWall.position.set(shX + 1.55, shY + 0.85, shZ);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.group.add(rightWall);

    // Timber rafters & mossy thatch roof slope
    for (let b = 0; b < 5; b++) {
      const beam = new THREE.Mesh(beamGeo, materials.woodAged);
      beam.position.set(shX, shY + 2.05 - b * 0.08, shZ - 0.95 + b * 0.52);
      beam.rotation.x = 0.14;
      beam.castShadow = true;
      this.group.add(beam);
    }

    // 2. Carved Inca Stele & Flowing Water Channel at (x = -2.6, z = -16.2)
    const stX = -2.6;
    const stZ = -16.2;
    const stY = terrain.getTerrainHeightAt(stX, stZ);

    const plinthGeo = this.createChippedBlockGeometry(1.85, 0.45, 1.85);
    const steleGeo = this.createBatteredWallGeometry(0.95, 2.35, 0.48);
    const sunDiscGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16);
    sunDiscGeo.rotateX(Math.PI / 2);
    const channelGeo = this.createChippedBlockGeometry(4.2, 0.35, 0.65);
    const channelWaterGeo = new THREE.PlaneGeometry(4.0, 0.36);
    channelWaterGeo.rotateX(-Math.PI / 2);
    this.geometries.push(plinthGeo, steleGeo, sunDiscGeo, channelGeo, channelWaterGeo);

    const plinth = new THREE.Mesh(plinthGeo, materials.andesiteCut);
    plinth.position.set(stX, stY + 0.15, stZ);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    const stele = new THREE.Mesh(steleGeo, materials.andesiteCut);
    stele.position.set(stX, stY + 1.45, stZ);
    stele.castShadow = true;
    stele.receiveShadow = true;
    this.group.add(stele);

    // Carved ornamental gold/bronze Chakana solar inset on the stele (§2.2)
    const sunDisc = new THREE.Mesh(sunDiscGeo, materials.goldOrnamental);
    sunDisc.position.set(stX, stY + 1.72, stZ + 0.23);
    this.group.add(sunDisc);

    // Stone water channel that still runs (§1.2 "a water channel that still runs")
    const channel = new THREE.Mesh(channelGeo, materials.andesiteCut);
    channel.position.set(stX + 1.2, stY + 0.1, stZ + 1.15);
    channel.castShadow = true;
    channel.receiveShadow = true;
    this.group.add(channel);

    const channelWater = new THREE.Mesh(channelWaterGeo, materials.water);
    channelWater.position.set(stX + 1.2, stY + 0.29, stZ + 1.15);
    this.group.add(channelWater);

    this.interactables.push({
      id: 'stele_cloud_forest',
      label: 'Inca Water-Reckoning Stele',
      promptText: '[E] Read Carved Stele',
      position: new THREE.Vector3(stX, stY + 1.0, stZ + 0.8),
      radius: 3.2,
    });
  }

  private buildCheckpointAndViewpoint(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    // 1. Sanctuary Checkpoint Stone Circle near South Trailhead (x = -2.2, z = 8.4) per §3.8
    const cpX = -2.2;
    const cpZ = 8.4;
    const cpY = terrain.getTerrainHeightAt(cpX, cpZ);

    const ringStoneGeo = this.createChippedBlockGeometry(0.42, 0.35, 0.32);
    const markerGeo = this.createBatteredWallGeometry(0.48, 1.15, 0.48);
    this.geometries.push(ringStoneGeo, markerGeo);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rx = cpX + Math.cos(ang) * 1.25;
      const rz = cpZ + Math.sin(ang) * 1.25;
      const ry = terrain.getTerrainHeightAt(rx, rz);
      const stone = new THREE.Mesh(ringStoneGeo, materials.andesiteCut);
      stone.position.set(rx, ry + 0.1, rz);
      stone.rotation.y = -ang;
      stone.castShadow = true;
      stone.receiveShadow = true;
      this.group.add(stone);
    }

    const marker = new THREE.Mesh(markerGeo, materials.andesiteCut);
    marker.position.set(cpX, cpY + 0.5, cpZ);
    marker.castShadow = true;
    marker.receiveShadow = true;
    this.group.add(marker);

    this.interactables.push({
      id: 'checkpoint_south_trail',
      label: 'Sanctuary Checkpoint',
      promptText: '[E] Rest at Sanctuary Marker',
      position: new THREE.Vector3(cpX, cpY + 0.8, cpZ),
      radius: 2.8,
    });

    // 2. Condor Viewpoint on the North Overlook Ridge (x = 0.0, z = -24.5) per §3.5 & Phase 1 spec
    const vpX = 0.0;
    const vpZ = -24.5;
    const vpY = terrain.getTerrainHeightAt(vpX, vpZ);

    const daisGeo = this.createChippedBlockGeometry(3.2, 0.55, 3.2);
    const perchGeo = this.createBatteredWallGeometry(0.55, 1.65, 0.55);
    this.geometries.push(daisGeo, perchGeo);

    const dais = new THREE.Mesh(daisGeo, materials.andesiteCut);
    dais.position.set(vpX, vpY + 0.2, vpZ);
    dais.castShadow = true;
    dais.receiveShadow = true;
    this.group.add(dais);
    terrain.registerWalkable(dais);

    const perch = new THREE.Mesh(perchGeo, materials.andesiteCut);
    perch.position.set(vpX, vpY + 1.15, vpZ - 1.1);
    perch.castShadow = true;
    perch.receiveShadow = true;
    this.group.add(perch);

    // Circling Andean Condor high overhead
    const wingGeo = new THREE.BoxGeometry(2.6, 0.06, 0.48);
    const bodyGeo = new THREE.ConeGeometry(0.22, 0.95, 6);
    bodyGeo.rotateX(Math.PI / 2);
    this.geometries.push(wingGeo, bodyGeo);
    const wings = new THREE.Mesh(wingGeo, materials.hair);
    const body = new THREE.Mesh(bodyGeo, materials.hair);
    this.condorMesh.add(wings, body);
    this.condorMesh.position.set(0, 26, -18);
    this.group.add(this.condorMesh);

    this.interactables.push({
      id: 'viewpoint_cloud_forest',
      label: 'Cloud Forest Condor Viewpoint',
      promptText: '[X] / [E] Synchronize Viewpoint',
      position: new THREE.Vector3(vpX, vpY + 1.0, vpZ),
      radius: 3.5,
    });
  }

  private createChippedBlockGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    // §2.1 "No perfect geometry. Stone blocks have chips, bevels, uneven faces."
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const chip =
        Math.sin(vx * 5.3 + vy * 7.1 + vz * 4.7) * 0.025 +
        Math.cos(vx * 9.2 - vz * 8.4) * 0.015;
      // Bevel outer edges slightly
      const edgeBevel =
        Math.abs(vy) > h * 0.45 ? 0.96 : 1.0;
      pos.setXYZ(i, vx * edgeBevel + chip, vy + chip * 0.6, vz * edgeBevel + chip);
    }
    geo.computeVertexNormals();
    return geo;
  }

  private createBatteredWallGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    // Inca walls have an inward batter (slope) toward the top per Bible §1.7 & R3/R15
    const geo = new THREE.BoxGeometry(w, h, d, 5, 4, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const normY = (vy + h * 0.5) / h; // 0 at bottom, 1 at top
      const batter = 1.0 - normY * 0.14;
      const irreg = Math.sin(vx * 4.1 + vy * 6.3 + vz * 5.2) * 0.028;
      pos.setXYZ(i, vx * batter + irreg, vy + irreg * 0.5, vz * batter + irreg);
    }
    geo.computeVertexNormals();
    return geo;
  }

  public update(dt: number, playerPosition?: THREE.Vector3): void {
    this.elapsedSec += dt;

    // Distance-gated subtle bridge sway & condor flight (§5.2 #3)
    if (!playerPosition || playerPosition.lengthSq() < 60 * 60) {
      this.bridgeGroup.position.x = Math.sin(this.elapsedSec * 1.4) * 0.008;
    }

    const cAng = this.elapsedSec * 0.28;
    this.condorMesh.position.set(
      Math.cos(cAng) * 18.0,
      25.0 + Math.sin(cAng * 2.0) * 1.2,
      -18.0 + Math.sin(cAng) * 14.0
    );
    this.condorMesh.rotation.y = -cAng;
    this.condorMesh.rotation.z = 0.18;
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    this.geometries.length = 0;
    this.interactables.length = 0;
    this.group.removeFromParent();
  }
}
