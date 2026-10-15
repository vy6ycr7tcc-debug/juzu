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

    // Flanking solid stone stepped balustrades
    for (let s = 0; s < stairStepCount; s++) {
      const tz = -4.2 - s * 0.72;
      const stepGroundY = terrain.getTerrainHeightAt(0, tz);
      const topY = Math.max(stepGroundY + 0.25, ptY + 0.35 + s * 0.28);
      const balH = Math.max(1.1, topY - stepGroundY + 0.95);
      const balGeo = new THREE.BoxGeometry(0.48, balH, 0.76);
      this.geometries.push(balGeo);

      for (let side = -1; side <= 1; side += 2) {
        const bal = new THREE.Mesh(balGeo, materials.andesiteCut);
        bal.position.set(side * 2.05, topY - balH * 0.5 + 0.32, tz);
        bal.castShadow = true;
        bal.receiveShadow = true;
        this.group.add(bal);
      }
    }

    // Sacred Imperial Double-Jamb Sun Portal (Doble Jamba) atop the upper temple terrace
    const portalFloorY = ptY + 4.1; // Surface of upper terrace
    const plinthGeo = new THREE.BoxGeometry(7.2, 2.8, 4.2);
    
    // Outer battered jambs
    const outerJambGeo = new THREE.BoxGeometry(0.92, 4.4, 1.15);
    // Inner recessed jambs creating the authentic double-jamb Inca recess
    const innerJambGeo = new THREE.BoxGeometry(0.45, 3.9, 0.85);

    // Stepped imperial lintels & Chakana pediment
    const lintelLowerGeo = new THREE.BoxGeometry(4.4, 0.55, 1.25);
    const lintelUpperGeo = new THREE.BoxGeometry(5.2, 0.45, 1.35);
    const pedimentGeo = new THREE.BoxGeometry(3.6, 0.65, 1.15);
    const chakanaCrestGeo = new THREE.BoxGeometry(2.2, 0.55, 1.05);

    this.geometries.push(
      plinthGeo,
      outerJambGeo,
      innerJambGeo,
      lintelLowerGeo,
      lintelUpperGeo,
      pedimentGeo,
      chakanaCrestGeo
    );

    // Solid ashlar masonry plinth under the Sun Portal
    const plinth = new THREE.Mesh(plinthGeo, materials.andesiteCut);
    plinth.position.set(0, portalFloorY - 1.3, portalZ);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Left & Right Outer Battered Jambs
    const leftOuterJamb = new THREE.Mesh(outerJambGeo, materials.andesiteCut);
    leftOuterJamb.position.set(-1.62, portalFloorY + 2.1, portalZ);
    leftOuterJamb.rotation.z = -0.06;
    leftOuterJamb.castShadow = true;
    leftOuterJamb.receiveShadow = true;
    this.group.add(leftOuterJamb);

    const rightOuterJamb = new THREE.Mesh(outerJambGeo, materials.andesiteCut);
    rightOuterJamb.position.set(1.62, portalFloorY + 2.1, portalZ);
    rightOuterJamb.rotation.z = 0.06;
    rightOuterJamb.castShadow = true;
    rightOuterJamb.receiveShadow = true;
    this.group.add(rightOuterJamb);

    // Left & Right Inner Recessed Jambs (Sacred Imperial Doble Jamba)
    const leftInnerJamb = new THREE.Mesh(innerJambGeo, materials.andesiteCut);
    leftInnerJamb.position.set(-1.18, portalFloorY + 1.9, portalZ + 0.08);
    leftInnerJamb.rotation.z = -0.06;
    leftInnerJamb.castShadow = true;
    leftInnerJamb.receiveShadow = true;
    this.group.add(leftInnerJamb);

    const rightInnerJamb = new THREE.Mesh(innerJambGeo, materials.andesiteCut);
    rightInnerJamb.position.set(1.18, portalFloorY + 1.9, portalZ + 0.08);
    rightInnerJamb.rotation.z = 0.06;
    rightInnerJamb.castShadow = true;
    rightInnerJamb.receiveShadow = true;
    this.group.add(rightInnerJamb);

    // Stepped Imperial Lintel
    const lintelLower = new THREE.Mesh(lintelLowerGeo, materials.andesiteCut);
    lintelLower.position.set(0, portalFloorY + 4.2, portalZ);
    lintelLower.castShadow = true;
    lintelLower.receiveShadow = true;
    this.group.add(lintelLower);

    const lintelUpper = new THREE.Mesh(lintelUpperGeo, materials.andesiteCut);
    lintelUpper.position.set(0, portalFloorY + 4.7, portalZ);
    lintelUpper.castShadow = true;
    lintelUpper.receiveShadow = true;
    this.group.add(lintelUpper);

    // Chakana stepped stone pediment crest
    const pediment = new THREE.Mesh(pedimentGeo, materials.andesiteCut);
    pediment.position.set(0, portalFloorY + 5.25, portalZ);
    pediment.castShadow = true;
    this.group.add(pediment);

    const crest = new THREE.Mesh(chakanaCrestGeo, materials.andesiteCut);
    crest.position.set(0, portalFloorY + 5.85, portalZ);
    crest.castShadow = true;
    this.group.add(crest);

    // Imperial Golden Sun Disc (Punchao) Assembly
    const sunGroup = new THREE.Group();
    sunGroup.position.set(0, portalFloorY + 6.35, portalZ + 0.24);

    const discRimGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.12, 36);
    discRimGeo.rotateX(Math.PI * 0.5);
    const discFaceGeo = new THREE.CylinderGeometry(1.08, 1.08, 0.15, 36);
    discFaceGeo.rotateX(Math.PI * 0.5);
    const bossGeo = new THREE.SphereGeometry(0.32, 24, 16);
    const rayGeo = new THREE.ConeGeometry(0.09, 0.38, 4);
    rayGeo.rotateX(Math.PI * 0.5);
    const bracketGeo = new THREE.BoxGeometry(0.22, 0.85, 0.45);
    this.geometries.push(discRimGeo, discFaceGeo, bossGeo, rayGeo, bracketGeo);

    const discRim = new THREE.Mesh(discRimGeo, materials.metalBronze);
    discRim.castShadow = true;
    sunGroup.add(discRim);

    const discFace = new THREE.Mesh(discFaceGeo, materials.goldOrnamental);
    discFace.castShadow = true;
    sunGroup.add(discFace);

    const boss = new THREE.Mesh(bossGeo, materials.goldOrnamental);
    boss.position.set(0, 0, 0.08);
    boss.castShadow = true;
    sunGroup.add(boss);

    for (let r = 0; r < 16; r++) {
      const ang = (r / 16) * Math.PI * 2;
      const ray = new THREE.Mesh(rayGeo, materials.goldOrnamental);
      const rad = 1.34;
      ray.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0);
      ray.rotation.z = ang - Math.PI * 0.5;
      ray.castShadow = true;
      sunGroup.add(ray);
    }

    for (let b = -1; b <= 1; b += 2) {
      const br = new THREE.Mesh(bracketGeo, materials.metalBronze);
      br.position.set(b * 0.65, -0.65, -0.15);
      br.castShadow = true;
      sunGroup.add(br);
    }

    this.sunDiscMesh = sunGroup as unknown as THREE.Mesh;
    this.group.add(sunGroup);

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
