/**
 * Module: src/world/regions/paititi.ts
 * Responsibility: Region 4 — Paititi: The Living City (2,800 m hidden caldera) per Bible §1.7:
 * - Monumental curved Coricancha-style Inca sun-temple terraces
 * - Imperial stepped grand staircase ascending to the Golden Sun Portal
 * - Firmly grounded trapezoidal Sanctuary Portal crowned with an embossed Gold Solar Disc
 * - Grand Quipu Archive Sanctuary Chamber with authentic stone niches and living knotted cord records (Chapters 10–12)
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts, src/world/regions/cloudForest.ts.
 * Exports: PaititiRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';
import { InteractableTarget } from './cloudForest';

export class PaititiRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  private sunDiscMesh: THREE.Mesh | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private elapsedSec: number = 0;

  public build(
    scene: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'Region4_Paititi';
    this.group.visible = false;
    scene.add(this.group);

    if (!materials || !terrain) return;

    // 1. Curved Coricancha Sun-Temple Terraces & Crowned Golden Sun Portal (z = -12.5)
    const ptZ = -12.5;
    const ptY = terrain.getTerrainHeightAt(0, ptZ);

    const curvedTerraceGeo = new THREE.CylinderGeometry(8.5, 9.4, 2.2, 28, 2, false, -Math.PI * 0.45, Math.PI * 0.9);
    const upperTerraceGeo = new THREE.CylinderGeometry(5.8, 6.5, 2.0, 24, 2, false, -Math.PI * 0.42, Math.PI * 0.84);
    this.geometries.push(curvedTerraceGeo, upperTerraceGeo);

    const lowerTerrace = new THREE.Mesh(curvedTerraceGeo, materials.andesiteCut);
    lowerTerrace.position.set(0, ptY + 1.1, ptZ);
    lowerTerrace.rotation.y = Math.PI;
    lowerTerrace.castShadow = true;
    lowerTerrace.receiveShadow = true;
    this.group.add(lowerTerrace);

    const portalZ = ptZ - 1.8; // -14.3
    const upperTerrace = new THREE.Mesh(upperTerraceGeo, materials.andesiteCut);
    upperTerrace.position.set(0, ptY + 3.1, portalZ);
    upperTerrace.rotation.y = Math.PI;
    upperTerrace.castShadow = true;
    upperTerrace.receiveShadow = true;
    this.group.add(upperTerrace);

    // Monumental Imperial Stepped Staircase ascending the Coricancha terraces
    const stairStepCount = 14;
    for (let s = 0; s < stairStepCount; s++) {
      const tz = -4.2 - s * 0.72;
      const stepGroundY = terrain.getTerrainHeightAt(0, tz);
      const topY = Math.max(stepGroundY + 0.25, ptY + 0.35 + s * 0.28);
      const stepH = Math.max(0.8, topY - stepGroundY + 0.6);
      const stepGeo = new THREE.BoxGeometry(3.6, stepH, 0.85);
      this.geometries.push(stepGeo);

      const st = new THREE.Mesh(stepGeo, materials.andesiteCut);
      st.position.set(0, topY - stepH * 0.5, tz);
      st.castShadow = true;
      st.receiveShadow = true;
      this.group.add(st);
    }

    // Firmly Grounded Monumental Sun Portal atop the upper temple terrace
    const portalFloorY = ptY + 4.1; // Surface of upper terrace
    const plinthGeo = new THREE.BoxGeometry(6.6, 2.8, 4.2);
    const jambGeo = new THREE.BoxGeometry(1.05, 4.4, 1.05);
    const lintelGeo = new THREE.BoxGeometry(4.2, 0.92, 1.15);
    const goldBandGeo = new THREE.BoxGeometry(4.25, 0.28, 1.18);
    const sunDiscGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.15, 28);
    sunDiscGeo.rotateX(Math.PI / 2);
    this.geometries.push(plinthGeo, jambGeo, lintelGeo, goldBandGeo, sunDiscGeo);

    // Solid ashlar masonry plinth under the Sun Portal
    const plinth = new THREE.Mesh(plinthGeo, materials.andesiteCut);
    plinth.position.set(0, portalFloorY - 1.3, portalZ);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    const leftJamb = new THREE.Mesh(jambGeo, materials.andesiteCut);
    leftJamb.position.set(-1.45, portalFloorY + 2.1, portalZ);
    leftJamb.rotation.z = -0.06;
    leftJamb.castShadow = true;
    leftJamb.receiveShadow = true;
    this.group.add(leftJamb);

    const rightJamb = new THREE.Mesh(jambGeo, materials.andesiteCut);
    rightJamb.position.set(1.45, portalFloorY + 2.1, portalZ);
    rightJamb.rotation.z = 0.06;
    rightJamb.castShadow = true;
    rightJamb.receiveShadow = true;
    this.group.add(rightJamb);

    const lintel = new THREE.Mesh(lintelGeo, materials.andesiteCut);
    lintel.position.set(0, portalFloorY + 4.3 + 0.44, portalZ);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.group.add(lintel);

    const goldBand = new THREE.Mesh(goldBandGeo, materials.goldOrnamental);
    goldBand.position.set(0, portalFloorY + 4.3 + 0.05, portalZ + 0.05);
    this.group.add(goldBand);

    this.sunDiscMesh = new THREE.Mesh(sunDiscGeo, materials.goldOrnamental);
    this.sunDiscMesh.position.set(0, portalFloorY + 5.85, portalZ + 0.15);
    this.sunDiscMesh.castShadow = true;
    this.group.add(this.sunDiscMesh);

    // 2. Twin Golden Aqueduct Channels & Fountains flanking the Central Esplanade
    const aqY = terrain.getTerrainHeightAt(0, 7.2);
    const channelGeo = new THREE.BoxGeometry(0.95, 0.85, 5.2);
    const goldLiningGeo = new THREE.BoxGeometry(0.55, 0.12, 5.1);
    this.geometries.push(channelGeo, goldLiningGeo);

    const sides = [-3.4, 3.4];
    for (let s = 0; s < sides.length; s++) {
      const sx = sides[s];
      const ch = new THREE.Mesh(channelGeo, materials.andesiteCut);
      ch.position.set(sx, aqY + 0.35, 7.8);
      ch.castShadow = true;
      ch.receiveShadow = true;
      this.group.add(ch);

      const gl = new THREE.Mesh(goldLiningGeo, materials.goldOrnamental);
      gl.position.set(sx, aqY + 0.78, 7.8);
      this.group.add(gl);
    }

    // 3. Grand Quipu Archive Chamber on the South Sanctuary Plaza (z = 7.8)
    // Authentic trapezoidal Inca ashlar stone sanctuary building
    const archBackGeo = new THREE.BoxGeometry(4.8, 3.2, 0.65);
    const archSideGeo = new THREE.BoxGeometry(0.65, 3.2, 3.2);
    const archRoofGeo = new THREE.BoxGeometry(5.2, 0.42, 3.6);
    const nicheGeo = new THREE.BoxGeometry(0.65, 0.85, 0.45);
    this.geometries.push(archBackGeo, archSideGeo, archRoofGeo, nicheGeo);

    const backWall = new THREE.Mesh(archBackGeo, materials.andesiteCut);
    backWall.position.set(0, aqY + 1.6, 9.2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    const wallL = new THREE.Mesh(archSideGeo, materials.andesiteCut);
    wallL.position.set(-2.2, aqY + 1.6, 7.8);
    wallL.castShadow = true;
    wallL.receiveShadow = true;
    this.group.add(wallL);

    const wallR = new THREE.Mesh(archSideGeo, materials.andesiteCut);
    wallR.position.set(2.2, aqY + 1.6, 7.8);
    wallR.castShadow = true;
    wallR.receiveShadow = true;
    this.group.add(wallR);

    const roof = new THREE.Mesh(archRoofGeo, materials.andesiteCut);
    roof.position.set(0, aqY + 3.35, 7.8);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.group.add(roof);

    // Trapezoidal ceremonial niches with gold qiru offerings
    const qiruGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.32, 12);
    this.geometries.push(qiruGeo);
    for (let n = -1; n <= 1; n++) {
      const niche = new THREE.Mesh(nicheGeo, materials.fieldstoneRough);
      niche.position.set(n * 1.4, aqY + 1.55, 8.95);
      this.group.add(niche);

      const qiru = new THREE.Mesh(qiruGeo, materials.goldOrnamental);
      qiru.position.set(n * 1.4, aqY + 1.32, 8.95);
      qiru.castShadow = true;
      this.group.add(qiru);
    }

    // Cedar Quipu Support Rack & Knotted Woven Cords
    const rackBarGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8);
    rackBarGeo.rotateZ(Math.PI / 2);
    const cordGeo = new THREE.CylinderGeometry(0.016, 0.012, 1.45, 6);
    this.geometries.push(rackBarGeo, cordGeo);

    const rackBar = new THREE.Mesh(rackBarGeo, materials.woodAged);
    rackBar.position.set(0, aqY + 2.1, 8.4);
    rackBar.castShadow = true;
    this.group.add(rackBar);

    // Multi-strand primary and pendant quipu cords (crimson, natural vicuña amber, indigo, gold)
    const cordMatVicuna = new THREE.MeshStandardMaterial({
      name: 'QuipuVicuna',
      color: new THREE.Color(0xb5894b),
      roughness: 0.88,
      metalness: 0.0,
    });
    const cordMatIndigo = new THREE.MeshStandardMaterial({
      name: 'QuipuIndigo',
      color: new THREE.Color(0x283d58),
      roughness: 0.85,
      metalness: 0.0,
    });
    this.materials.push(cordMatVicuna, cordMatIndigo);

    const quipuColors = [
      materials.clothQuechuaRed,
      cordMatVicuna,
      cordMatIndigo,
      materials.goldOrnamental,
    ];

    for (let q = 0; q < 15; q++) {
      const cordMat = quipuColors[q % quipuColors.length];
      const cord = new THREE.Mesh(cordGeo, cordMat);
      cord.position.set(-1.3 + q * 0.185, aqY + 1.35, 8.4);
      cord.rotation.z = Math.sin(q * 1.7) * 0.04;
      cord.castShadow = true;
      this.group.add(cord);
    }

    // Warm Ceremonial Braziers flanking the sanctuary entry
    const brazierGeo = new THREE.CylinderGeometry(0.32, 0.18, 0.72, 12);
    this.geometries.push(brazierGeo);
    for (const bx of [-1.8, 1.8]) {
      const bz = new THREE.Mesh(brazierGeo, materials.metalBronze);
      bz.position.set(bx, aqY + 0.36, 6.6);
      bz.castShadow = true;
      this.group.add(bz);
    }

    this.interactables.push({
      id: 'paititi_quipu_archive',
      label: 'Grand Quipu Archive of Paititi',
      promptText: '[E] Examine the Living Quipu Archive (Chapter 11: The Decision)',
      position: new THREE.Vector3(0, aqY + 1.0, 7.8),
      radius: 3.6,
    });
  }

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.elapsedSec += dt;
    if (this.sunDiscMesh) {
      this.sunDiscMesh.rotation.z = Math.sin(this.elapsedSec * 0.35) * 0.04;
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
