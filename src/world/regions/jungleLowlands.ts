/**
 * Module: src/world/regions/jungleLowlands.ts
 * Responsibility: Region 3 — Jungle Lowlands (Antisuyu, 800–1,800 m) per Bible §1.7:
 * - Sunken Inca Stepped Cenote Temple encircled by mossy polygonal walls
 * - Giant buttressed Amazonian Ceiba trunks with hanging liana vines
 * - Carved serpent stone water conduits and Hydraulic Sluice Gate mechanism
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts, src/world/regions/cloudForest.ts.
 * Exports: JungleLowlandsRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';
import { InteractableTarget } from './cloudForest';

export class JungleLowlandsRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  private sluiceGateMesh: THREE.Mesh | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private elapsedSec: number = 0;

  public build(
    scene: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'Region3_JungleLowlands';
    this.group.visible = false;
    scene.add(this.group);

    if (!materials || !terrain) return;

    // 1. Sunken Antisuyu Stepped Temple & Turquoise Cenote Basin on the North Platform (z = -12.0)
    const cenZ = -5.5;
    const cenY = terrain.getTerrainHeightAt(0, cenZ);

    const ringCount = 12;
    const blockGeo = new THREE.BoxGeometry(2.4, 2.2, 1.1, 3, 3, 2);
    const mossCapGeo = new THREE.BoxGeometry(2.3, 0.28, 1.05);
    this.geometries.push(blockGeo, mossCapGeo);

    for (let i = 0; i < ringCount; i++) {
      // Leave south entrance gap open
      if (i === 0 || i === ringCount - 1) continue;
      const ang = (i / ringCount) * Math.PI * 2 + Math.PI * 0.5;
      const rx = Math.cos(ang) * 6.8;
      const rz = cenZ + Math.sin(ang) * 6.8;
      const ry = terrain.getTerrainHeightAt(rx, rz);

      const wall = new THREE.Mesh(blockGeo, materials.andesiteCut);
      wall.position.set(rx, ry + 0.95, rz);
      wall.rotation.y = -ang + Math.PI * 0.5;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      const cap = new THREE.Mesh(mossCapGeo, materials.moss);
      cap.position.set(rx, ry + 2.12, rz);
      cap.rotation.y = -ang + Math.PI * 0.5;
      this.group.add(cap);
    }

    // Turquoise Cenote Sanctuary Pool & Central Altar Island
    const poolGeo = new THREE.CylinderGeometry(5.6, 5.2, 0.25, 24);
    const islandGeo = new THREE.CylinderGeometry(2.1, 2.4, 0.95, 12);
    const serpentSteleGeo = new THREE.BoxGeometry(0.95, 2.6, 0.55);
    this.geometries.push(poolGeo, islandGeo, serpentSteleGeo);

    const pool = new THREE.Mesh(poolGeo, materials.water);
    pool.position.set(0, cenY + 0.18, cenZ);
    this.group.add(pool);

    const island = new THREE.Mesh(islandGeo, materials.andesiteCut);
    island.position.set(0, cenY + 0.42, cenZ);
    island.castShadow = true;
    island.receiveShadow = true;
    this.group.add(island);

    const stele = new THREE.Mesh(serpentSteleGeo, materials.andesiteCut);
    stele.position.set(0, cenY + 1.85, cenZ);
    stele.castShadow = true;
    stele.receiveShadow = true;
    this.group.add(stele);

    // 2. Bronze & Stone Hydraulic Sluice Gate on the South Rim (x = 1.8, z = 7.4)
    const slY = terrain.getTerrainHeightAt(2.45, 6.2);
    const frameGeo = new THREE.BoxGeometry(1.5, 2.1, 0.55);
    const gateGeo = new THREE.BoxGeometry(1.0, 1.4, 0.24);
    this.geometries.push(frameGeo, gateGeo);

    const frame = new THREE.Mesh(frameGeo, materials.andesiteCut);
    frame.position.set(2.45, slY + 0.95, 6.2);
    frame.rotation.y = -0.35;
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.group.add(frame);

    this.sluiceGateMesh = new THREE.Mesh(gateGeo, materials.metalBronze);
    this.sluiceGateMesh.position.set(2.45, slY + 0.85, 6.2);
    this.sluiceGateMesh.rotation.y = -0.35;
    this.sluiceGateMesh.castShadow = true;
    this.group.add(this.sluiceGateMesh);

    this.interactables.push({
      id: 'jungle_hydraulic_sluice',
      label: 'Antisuyu Hydraulic Sluice Gate',
      promptText: '[E] Open Antisuyu Cenote Sluice Gate',
      position: new THREE.Vector3(1.8, slY + 1.0, 7.4),
      radius: 3.0,
    });

    // 3. Giant Buttressed Ceiba Trees & Hanging Liana Vines
    const ceibaCoords = [
      [-6.5, 6.2],
      [6.8, 5.8],
      [-7.8, -5.5],
      [8.2, -5.8],
      [-8.5, -16.5],
      [8.5, -16.8],
    ];
    const trunkGeo = new THREE.CylinderGeometry(0.75, 1.45, 14.5, 10);
    const vineGeo = new THREE.CylinderGeometry(0.035, 0.035, 7.5, 5);
    this.geometries.push(trunkGeo, vineGeo);

    for (let i = 0; i < ceibaCoords.length; i++) {
      const [tx, tz] = ceibaCoords[i];
      const ty = terrain.getTerrainHeightAt(tx, tz);
      const trunk = new THREE.Mesh(trunkGeo, materials.woodBark);
      trunk.position.set(tx, ty + 6.5, tz);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      this.group.add(trunk);

      for (let v = 0; v < 3; v++) {
        const vine = new THREE.Mesh(vineGeo, materials.moss);
        vine.position.set(
          tx + (v - 1) * 0.85,
          ty + 5.2,
          tz + Math.cos(v * 2.1) * 0.75
        );
        vine.rotation.z = (v - 1) * 0.06;
        this.group.add(vine);
      }
    }
  }

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.elapsedSec += dt;
    if (this.sluiceGateMesh) {
      this.sluiceGateMesh.position.y += Math.sin(this.elapsedSec * 1.5) * 0.0005;
    }
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
