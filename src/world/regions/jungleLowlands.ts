/**
 * Module: src/world/regions/jungleLowlands.ts
 * Responsibility: Region 3 — Jungle Lowlands (Antisuyu, 800–1,800 m) per Bible §1.7:
 * - Sunken Inca Stepped Cenote Temple encircled by mossy polygonal walls
 * - Stepped stone basin tiers descending into crystalline turquoise water
 * - Submerged serpent conduit unsealed by the Bronze & Stone Hydraulic Sluice Gate
 * - Giant buttressed Amazonian Ceiba trunks with hanging liana vines
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
  public sluiceGateMesh: THREE.Mesh | null = null;
  public poolMesh: THREE.Mesh | null = null;
  public sluiceOpen: boolean = false;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private elapsedSec: number = 0;
  private targetWaterY: number = 0;
  private baseWaterY: number = 0;
  private targetGateY: number = 0;
  private baseGateY: number = 0;

  public build(
    scene: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'Region3_JungleLowlands';
    this.group.visible = false;
    scene.add(this.group);

    if (!materials || !terrain) return;

    // 1. Sunken Antisuyu Stepped Cenote Sanctuary on the North Basin (z = -5.5)
    const cenZ = -5.5;
    const cenY = terrain.getTerrainHeightAt(0, cenZ);
    this.baseWaterY = cenY - 0.45;
    this.targetWaterY = this.baseWaterY;

    // Outer polygonal andesite retaining wall enclosing the sunken cenote
    const ringCount = 14;
    const blockGeo = new THREE.BoxGeometry(2.2, 1.8, 0.9, 3, 3, 2);
    const mossCapGeo = new THREE.BoxGeometry(2.1, 0.24, 0.85);
    this.geometries.push(blockGeo, mossCapGeo);

    for (let i = 0; i < ringCount; i++) {
      // Leave southern stairway entrance gap open
      if (i === 0 || i === ringCount - 1) continue;
      const ang = (i / ringCount) * Math.PI * 2 + Math.PI * 0.5;
      const rx = Math.cos(ang) * 6.5;
      const rz = cenZ + Math.sin(ang) * 6.5;
      const ry = terrain.getTerrainHeightAt(rx, rz);

      const wall = new THREE.Mesh(blockGeo, materials.andesiteCut);
      wall.position.set(rx, ry + 0.65, rz);
      wall.rotation.y = -ang + Math.PI * 0.5;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      const cap = new THREE.Mesh(mossCapGeo, materials.moss);
      cap.position.set(rx, ry + 1.65, rz);
      cap.rotation.y = -ang + Math.PI * 0.5;
      this.group.add(cap);
    }

    // Concentric Stepped Stone Basin Tiers (descending into the sunken pool)
    const tierSteps = [
      { r: 5.6, depth: 0.35, thick: 0.32 },
      { r: 4.6, depth: 0.75, thick: 0.35 },
      { r: 3.6, depth: 1.15, thick: 0.38 },
      { r: 2.6, depth: 1.55, thick: 0.42 },
    ];
    for (let t = 0; t < tierSteps.length; t++) {
      const step = tierSteps[t];
      const stepGeo = new THREE.CylinderGeometry(
        step.r,
        step.r + 0.3,
        step.thick,
        24,
        1,
        false,
        0,
        Math.PI * 1.82
      );
      this.geometries.push(stepGeo);
      const stepMesh = new THREE.Mesh(stepGeo, materials.andesiteCut);
      stepMesh.position.set(0, cenY - step.depth, cenZ);
      stepMesh.rotation.y = Math.PI * 0.59;
      stepMesh.receiveShadow = true;
      this.group.add(stepMesh);
    }

    // Authentic Sunken Turquoise Cenote Pool
    const poolGeo = new THREE.CylinderGeometry(5.2, 5.0, 1.4, 28);
    this.geometries.push(poolGeo);

    // Deep crystalline turquoise water material
    const cenoteWaterMat = new THREE.MeshStandardMaterial({
      name: 'AntisuyuCenoteWater',
      color: new THREE.Color(0x187a74),
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    this.materials.push(cenoteWaterMat);

    this.poolMesh = new THREE.Mesh(poolGeo, cenoteWaterMat);
    this.poolMesh.position.set(0, this.baseWaterY - 0.7, cenZ);
    this.poolMesh.receiveShadow = true;
    this.group.add(this.poolMesh);

    // Central Sunken Sanctuary Altar Pedestal & Carved Serpent Stele
    const altarPedGeo = new THREE.CylinderGeometry(1.6, 1.9, 1.6, 14);
    const serpentSteleGeo = new THREE.BoxGeometry(0.85, 2.8, 0.48);
    const goldInlayGeo = new THREE.BoxGeometry(0.88, 0.18, 0.5);
    this.geometries.push(altarPedGeo, serpentSteleGeo, goldInlayGeo);

    const altar = new THREE.Mesh(altarPedGeo, materials.andesiteCut);
    altar.position.set(0, cenY - 0.75, cenZ);
    altar.castShadow = true;
    altar.receiveShadow = true;
    this.group.add(altar);

    const stele = new THREE.Mesh(serpentSteleGeo, materials.andesiteCut);
    stele.position.set(0, cenY + 1.45, cenZ);
    stele.castShadow = true;
    stele.receiveShadow = true;
    this.group.add(stele);

    const goldInlay = new THREE.Mesh(goldInlayGeo, materials.goldOrnamental);
    goldInlay.position.set(0, cenY + 2.15, cenZ);
    this.group.add(goldInlay);

    // Submerged Serpent Conduit Portal (visible through water, revealed when drained)
    const conduitArchGeo = new THREE.BoxGeometry(1.8, 2.2, 1.4);
    this.geometries.push(conduitArchGeo);
    const conduitArch = new THREE.Mesh(conduitArchGeo, materials.andesiteCut);
    conduitArch.position.set(0, cenY - 0.95, cenZ - 4.6);
    conduitArch.castShadow = true;
    conduitArch.receiveShadow = true;
    this.group.add(conduitArch);

    // 2. Bronze & Stone Hydraulic Sluice Gate on the South Embankment (x = 2.45, z = 6.2)
    const slY = terrain.getTerrainHeightAt(2.45, 6.2);
    this.baseGateY = slY + 0.85;
    this.targetGateY = this.baseGateY;

    const frameGeo = new THREE.BoxGeometry(1.6, 2.4, 0.65);
    const gateGeo = new THREE.BoxGeometry(1.1, 1.5, 0.22);
    const cogGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 16);
    cogGeo.rotateZ(Math.PI / 2);
    this.geometries.push(frameGeo, gateGeo, cogGeo);

    const frame = new THREE.Mesh(frameGeo, materials.andesiteCut);
    frame.position.set(2.45, slY + 1.1, 6.2);
    frame.rotation.y = -0.35;
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.group.add(frame);

    this.sluiceGateMesh = new THREE.Mesh(gateGeo, materials.metalBronze);
    this.sluiceGateMesh.position.set(2.45, this.baseGateY, 6.2);
    this.sluiceGateMesh.rotation.y = -0.35;
    this.sluiceGateMesh.castShadow = true;
    this.group.add(this.sluiceGateMesh);

    const cog = new THREE.Mesh(cogGeo, materials.goldOrnamental);
    cog.position.set(2.45, slY + 2.38, 6.2);
    cog.rotation.y = -0.35;
    cog.castShadow = true;
    this.group.add(cog);

    this.interactables.push({
      id: 'jungle_hydraulic_sluice',
      label: 'Antisuyu Hydraulic Sluice Gate',
      promptText: '[E] Open Antisuyu Cenote Sluice Gate',
      position: new THREE.Vector3(2.45, slY + 1.0, 6.2),
      radius: 3.2,
    });

    // 3. Giant Buttressed Ceiba Trunks & Hanging Liana Vines
    const ceibaCoords = [
      [-6.5, 6.2],
      [6.8, 5.8],
      [-7.8, -5.5],
      [8.2, -5.8],
      [-8.5, -16.5],
      [8.5, -16.8],
    ];
    const trunkGeo = new THREE.CylinderGeometry(0.75, 1.45, 14.5, 10);
    const buttressGeo = new THREE.BoxGeometry(0.35, 3.2, 1.8);
    const vineGeo = new THREE.CylinderGeometry(0.035, 0.035, 7.5, 5);
    this.geometries.push(trunkGeo, buttressGeo, vineGeo);

    for (let i = 0; i < ceibaCoords.length; i++) {
      const [tx, tz] = ceibaCoords[i];
      const ty = terrain.getTerrainHeightAt(tx, tz);
      const trunk = new THREE.Mesh(trunkGeo, materials.woodBark);
      trunk.position.set(tx, ty + 6.5, tz);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      this.group.add(trunk);

      // Flaring buttress root fins
      for (let f = 0; f < 3; f++) {
        const finAng = (f * Math.PI * 2) / 3 + i * 0.8;
        const fin = new THREE.Mesh(buttressGeo, materials.woodBark);
        fin.position.set(
          tx + Math.cos(finAng) * 1.1,
          ty + 1.4,
          tz + Math.sin(finAng) * 1.1
        );
        fin.rotation.y = -finAng;
        fin.castShadow = true;
        fin.receiveShadow = true;
        this.group.add(fin);
      }

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

  public setSluiceOpen(open: boolean): void {
    this.sluiceOpen = open;
    if (open) {
      this.targetGateY = this.baseGateY + 1.25;
      this.targetWaterY = this.baseWaterY - 0.9;
    } else {
      this.targetGateY = this.baseGateY;
      this.targetWaterY = this.baseWaterY;
    }
  }

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.elapsedSec += dt;

    // Smoothly animate sluice gate portcullis lifting/lowering
    if (this.sluiceGateMesh) {
      this.sluiceGateMesh.position.y = THREE.MathUtils.lerp(
        this.sluiceGateMesh.position.y,
        this.targetGateY,
        Math.min(1.0, dt * 2.5)
      );
    }

    // Smoothly animate cenote water level draining/filling
    if (this.poolMesh) {
      const currentTopY = this.poolMesh.position.y + 0.7;
      const newTopY = THREE.MathUtils.lerp(
        currentTopY,
        this.targetWaterY,
        Math.min(1.0, dt * 1.8)
      );
      this.poolMesh.position.y = newTopY - 0.7;
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
    this.interactables.length = 0;
    this.group.removeFromParent();
  }
}
