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
import { IncaMasonrySystem } from '../masonry';
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

    const hAt = (x: number, z: number): number => terrain.getPaititiHeightAt(x, z);

    // 1. Curved Coricancha Sun-Temple Terraces & Crowned Golden Sun Portal (z = -12.5)
    const ptZ = -12.5;
    const ptY = hAt(0, ptZ);

    const curvedTerraceGeo = new THREE.CylinderGeometry(8.5, 9.4, 2.2, 28, 2, false, -Math.PI * 0.45, Math.PI * 0.9);
    const upperTerraceGeo = new THREE.CylinderGeometry(5.8, 6.5, 2.0, 24, 2, false, -Math.PI * 0.42, Math.PI * 0.84);
    this.geometries.push(curvedTerraceGeo, upperTerraceGeo);

    const lowerTerrace = new THREE.Mesh(curvedTerraceGeo, materials.andesiteCut);
    lowerTerrace.position.set(0, ptY + 1.1, ptZ);
    lowerTerrace.rotation.y = Math.PI;
    lowerTerrace.castShadow = true;
    lowerTerrace.receiveShadow = true;
    this.group.add(lowerTerrace);
    terrain.registerWalkable(lowerTerrace);

    const portalZ = ptZ - 1.8; // -14.3
    const upperTerrace = new THREE.Mesh(upperTerraceGeo, materials.andesiteCut);
    upperTerrace.position.set(0, ptY + 3.1, portalZ);
    upperTerrace.rotation.y = Math.PI;
    upperTerrace.castShadow = true;
    upperTerrace.receiveShadow = true;
    this.group.add(upperTerrace);
    terrain.registerWalkable(upperTerrace);

    // Monumental Imperial Stepped Staircase ascending the Coricancha terraces
    const stairStepCount = 14;
    const startGroundY = hAt(0, -3.8);
    const portalFloorY = hAt(0, portalZ) + 0.08; // Exact surface of upper terrace

    for (let s = 0; s < stairStepCount; s++) {
      const t = s / (stairStepCount - 1);
      const tz = -3.8 - s * 0.70;
      const stepW = 5.8 - t * 2.0;
      const topY = THREE.MathUtils.lerp(startGroundY + 0.22, portalFloorY, t);
      const stepGroundY = hAt(0, tz);
      const stepH = Math.max(0.95, topY - stepGroundY + 0.65);
      const stepCurve = 0.32 * (1.0 - t * 0.75);
      const stepGeo = this.createCurvedStepGeometry(stepW, stepH, 1.08, stepCurve);
      this.geometries.push(stepGeo);

      const st = new THREE.Mesh(stepGeo, materials.andesiteCut);
      st.position.set(0, topY - stepH * 0.5, tz);
      st.castShadow = true;
      st.receiveShadow = true;
      this.group.add(st);
      terrain.registerWalkable(st);
    }

    // Continuous Battered Inca Cheek Ramparts (flanking the staircase)
    const leftNodes: Array<{ xIn: number; xOut: number; yTop: number; yBot: number; z: number }> = [];
    const rightNodes: Array<{ xIn: number; xOut: number; yTop: number; yBot: number; z: number }> = [];

    for (let s = 0; s < stairStepCount; s++) {
      const t = s / (stairStepCount - 1);
      const tz = -3.8 - s * 0.70;
      const stepW = 5.8 - t * 2.0;
      const topY = THREE.MathUtils.lerp(startGroundY + 0.22, portalFloorY, t);

      // Left cheek wall
      const xInL = -stepW * 0.5;
      const xOutL = xInL - 0.75;
      const groundYL = hAt(xOutL, tz);
      leftNodes.push({
        xIn: xInL,
        xOut: xOutL,
        yTop: topY,
        yBot: Math.min(topY - 1.1, groundYL - 0.55),
        z: tz,
      });

      // Right cheek wall
      const xInR = stepW * 0.5;
      const xOutR = xInR + 0.75;
      const groundYR = hAt(xOutR, tz);
      rightNodes.push({
        xIn: xInR,
        xOut: xOutR,
        yTop: topY,
        yBot: Math.min(topY - 1.1, groundYR - 0.55),
        z: tz,
      });
    }

    const leftRampartGeo = this.createCheekRampartGeometry(leftNodes, -1);
    const rightRampartGeo = this.createCheekRampartGeometry(rightNodes, 1);
    this.geometries.push(leftRampartGeo, rightRampartGeo);

    const leftRampart = new THREE.Mesh(leftRampartGeo, materials.andesiteCut);
    leftRampart.castShadow = true;
    leftRampart.receiveShadow = true;
    this.group.add(leftRampart);

    const rightRampart = new THREE.Mesh(rightRampartGeo, materials.andesiteCut);
    rightRampart.castShadow = true;
    rightRampart.receiveShadow = true;
    this.group.add(rightRampart);

    // Sacred Imperial Double-Jamb Sun Portal & Monumental Ashlar Facade Wall
    // Deep foundation ashlar facade walls (Hawa Pirqa) extending into bedrock
    const facadeWallGeo = IncaMasonrySystem.createIncaPillowWallGeometry(4.8, 5.8, 1.45, {
      courses: 9,
      stonesPerCourse: 5,
      pillowBulge: 0.045,
      batter: 0.08,
    });
    const wingReturnGeo = IncaMasonrySystem.createIncaPillowWallGeometry(4.2, 5.2, 1.35, {
      courses: 8,
      stonesPerCourse: 4,
      pillowBulge: 0.045,
      batter: 0.08,
    });
    const facadeNicheGeo = new THREE.BoxGeometry(0.55, 0.78, 0.35);
    const facadeQiruGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.32, 12);
    const facadeBermGeo = IncaMasonrySystem.createWallFootingBermGeometry(5.2, 0.38, 0.55);
    this.geometries.push(facadeWallGeo, wingReturnGeo, facadeNicheGeo, facadeQiruGeo, facadeBermGeo);

    for (let side = -1; side <= 1; side += 2) {
      // Main facade wing wall sunk 1.65m into terrace floor
      const facade = new THREE.Mesh(facadeWallGeo, materials.andesiteCut);
      facade.position.set(side * 4.35, portalFloorY + 1.25, portalZ);
      facade.castShadow = true;
      facade.receiveShadow = true;
      this.group.add(facade);

      // Lateral retaining wing return anchoring into the mountain caldera slopes
      const returnWall = new THREE.Mesh(wingReturnGeo, materials.andesiteCut);
      returnWall.position.set(side * 6.85, portalFloorY + 1.15, portalZ - 1.2);
      returnWall.rotation.y = side * 0.42;
      returnWall.castShadow = true;
      returnWall.receiveShadow = true;
      this.group.add(returnWall);

      // Footing berm along the base of the facade wall
      const berm = new THREE.Mesh(facadeBermGeo, materials.groundForestFloor);
      berm.position.set(side * 4.35, portalFloorY + 0.1, portalZ + 0.55);
      berm.receiveShadow = true;
      this.group.add(berm);

      // Sacred trapezoidal ceremonial niche in the facade wall
      const niche = new THREE.Mesh(facadeNicheGeo, materials.fieldstoneRough);
      niche.position.set(side * 3.8, portalFloorY + 1.65, portalZ + 0.48);
      this.group.add(niche);

      const qiru = new THREE.Mesh(facadeQiruGeo, materials.goldOrnamental);
      qiru.position.set(side * 3.8, portalFloorY + 1.45, portalZ + 0.48);
      qiru.castShadow = true;
      this.group.add(qiru);
    }

    // Outer battered jambs (leaning inward 6 degrees, wider opening at threshold)
    const outerJambGeo = IncaMasonrySystem.createIncaPillarGeometry(0.85, 4.0, 1.25, {
      courses: 6,
      pillowBulge: 0.042,
      batter: 0.06,
    });
    // Inner recessed jambs creating authentic double-jamb Inca recess
    const innerJambGeo = IncaMasonrySystem.createIncaPillarGeometry(0.48, 3.6, 0.95, {
      courses: 5,
      pillowBulge: 0.035,
      batter: 0.06,
    });
    // Colossal monolithic lintel megalith spanning across portal and locking into facade walls
    const lintelMegalithGeo = IncaMasonrySystem.createIncaPillowWallGeometry(5.8, 0.78, 1.45, {
      courses: 1,
      stonesPerCourse: 3,
      pillowBulge: 0.042,
    });
    // Stepped Chakana pediment & crest
    const pedimentGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.4, 0.55, 1.15, {
      courses: 1,
      stonesPerCourse: 2,
      pillowBulge: 0.035,
    });
    const crestGeo = IncaMasonrySystem.createIncaPillowWallGeometry(1.9, 0.45, 1.05, {
      courses: 1,
      stonesPerCourse: 2,
      pillowBulge: 0.035,
    });

    this.geometries.push(
      outerJambGeo,
      innerJambGeo,
      lintelMegalithGeo,
      pedimentGeo,
      crestGeo
    );

    // Left & Right Outer Battered Jambs
    const leftOuterJamb = new THREE.Mesh(outerJambGeo, materials.andesiteCut);
    leftOuterJamb.position.set(-1.85, portalFloorY + 1.9, portalZ);
    leftOuterJamb.rotation.z = -0.07;
    leftOuterJamb.castShadow = true;
    leftOuterJamb.receiveShadow = true;
    this.group.add(leftOuterJamb);

    const rightOuterJamb = new THREE.Mesh(outerJambGeo, materials.andesiteCut);
    rightOuterJamb.position.set(1.85, portalFloorY + 1.9, portalZ);
    rightOuterJamb.rotation.z = 0.07;
    rightOuterJamb.castShadow = true;
    rightOuterJamb.receiveShadow = true;
    this.group.add(rightOuterJamb);

    // Left & Right Inner Recessed Jambs (Sacred Imperial Doble Jamba)
    const leftInnerJamb = new THREE.Mesh(innerJambGeo, materials.andesiteCut);
    leftInnerJamb.position.set(-1.40, portalFloorY + 1.7, portalZ + 0.12);
    leftInnerJamb.rotation.z = -0.07;
    leftInnerJamb.castShadow = true;
    leftInnerJamb.receiveShadow = true;
    this.group.add(leftInnerJamb);

    const rightInnerJamb = new THREE.Mesh(innerJambGeo, materials.andesiteCut);
    rightInnerJamb.position.set(1.40, portalFloorY + 1.7, portalZ + 0.12);
    rightInnerJamb.rotation.z = 0.07;
    rightInnerJamb.castShadow = true;
    rightInnerJamb.receiveShadow = true;
    this.group.add(rightInnerJamb);

    // Monolithic Imperial Lintel
    const lintel = new THREE.Mesh(lintelMegalithGeo, materials.andesiteCut);
    lintel.position.set(0, portalFloorY + 3.85, portalZ);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.group.add(lintel);

    // Stepped Chakana pediment & crest
    const pediment = new THREE.Mesh(pedimentGeo, materials.andesiteCut);
    pediment.position.set(0, portalFloorY + 4.45, portalZ);
    pediment.castShadow = true;
    this.group.add(pediment);

    const crest = new THREE.Mesh(crestGeo, materials.andesiteCut);
    crest.position.set(0, portalFloorY + 4.95, portalZ);
    crest.castShadow = true;
    this.group.add(crest);

    // Imperial Golden Sun Disc (Punchao) Assembly
    const sunGroup = new THREE.Group();
    sunGroup.position.set(0, portalFloorY + 5.65, portalZ + 0.22);

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
    const aqY = hAt(0, 7.2);
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
    const archBackGeo = IncaMasonrySystem.createIncaPillowWallGeometry(4.8, 3.2, 0.65, { courses: 5, stonesPerCourse: 5, pillowBulge: 0.045 });
    const archSideGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.2, 3.2, 0.65, { courses: 5, stonesPerCourse: 4, pillowBulge: 0.045 });
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

  /**
   * Generates an authentic monumental curved Inca andesite step geometry
   * with convex front nosing arc, pillowed riser, and beveled bullnose edge.
   */
  private createCurvedStepGeometry(
    width: number,
    riserH: number,
    treadD: number,
    curveBulge: number
  ): THREE.BufferGeometry {
    const xSegs = 16;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Profile points along Z for each slice across width:
    // 0: back bottom (-treadD*0.5, -riserH*0.5)
    // 1: back top (-treadD*0.5, riserH*0.5)
    // 2: front top edge (+treadD*0.5 + curve, riserH*0.5)
    // 3: front bullnose (+treadD*0.5 + curve + 0.035, riserH*0.5 - 0.04)
    // 4: front bottom (+treadD*0.5 + curve, -riserH*0.5)
    for (let i = 0; i <= xSegs; i++) {
      const u = i / xSegs;
      const x = -width * 0.5 + u * width;
      const curve = Math.sin(u * Math.PI) * curveBulge;

      // 0: back bottom
      positions.push(x, -riserH * 0.5, -treadD * 0.5);
      uvs.push(u * 2.0, 0);

      // 1: back top
      positions.push(x, riserH * 0.5, -treadD * 0.5);
      uvs.push(u * 2.0, 1.0);

      // 2: front top edge
      positions.push(x, riserH * 0.5, treadD * 0.5 + curve);
      uvs.push(u * 2.0, 1.8);

      // 3: front bullnose bevel
      positions.push(x, riserH * 0.5 - 0.04, treadD * 0.5 + curve + 0.035);
      uvs.push(u * 2.0, 1.9);

      // 4: front bottom
      positions.push(x, -riserH * 0.5, treadD * 0.5 + curve);
      uvs.push(u * 2.0, 2.6);
    }

    const stride = 5;
    for (let i = 0; i < xSegs; i++) {
      const c = i * stride;
      const n = (i + 1) * stride;

      // Top tread quad (1 -> 2)
      indices.push(c + 1, c + 2, n + 2);
      indices.push(c + 1, n + 2, n + 1);

      // Bullnose bevel quad (2 -> 3)
      indices.push(c + 2, c + 3, n + 3);
      indices.push(c + 2, n + 3, n + 2);

      // Front riser quad (3 -> 4)
      indices.push(c + 3, c + 4, n + 4);
      indices.push(c + 3, n + 4, n + 3);

      // Bottom quad (0 -> 4)
      indices.push(c + 0, n + 0, n + 4);
      indices.push(c + 0, n + 4, c + 4);

      // Back quad (0 -> 1)
      indices.push(c + 0, c + 1, n + 1);
      indices.push(c + 0, n + 1, n + 0);
    }

    // Left endcap (i = 0, normal facing -X)
    indices.push(0, 2, 1);
    indices.push(0, 3, 2);
    indices.push(0, 4, 3);

    // Right endcap (i = xSegs, normal facing +X)
    const last = xSegs * stride;
    indices.push(last + 0, last + 1, last + 2);
    indices.push(last + 0, last + 2, last + 3);
    indices.push(last + 0, last + 3, last + 4);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Generates continuous sweeping battered Inca cheek ramparts flanking the staircase
   * with sloping coping stones and battered retaining faces.
   */
  private createCheekRampartGeometry(
    nodes: Array<{ xIn: number; xOut: number; yTop: number; yBot: number; z: number }>,
    side: number
  ): THREE.BufferGeometry {
    const count = nodes.length;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s < count; s++) {
      const n = nodes[s];
      const v = s / (count - 1);

      // 0: inner top (above step edge)
      positions.push(n.xIn, n.yTop + 0.32, n.z);
      uvs.push(0, v * 4.0);

      // 1: outer top (coping beveled edge)
      positions.push(n.xOut, n.yTop + 0.24, n.z);
      uvs.push(0.5, v * 4.0);

      // 2: outer bot (battered outward at base)
      positions.push(n.xOut + side * 0.22, n.yBot, n.z);
      uvs.push(1.5, v * 4.0);

      // 3: inner bot
      positions.push(n.xIn, n.yTop - 0.25, n.z);
      uvs.push(0, v * 4.0);
    }

    const stride = 4;
    for (let s = 0; s < count - 1; s++) {
      const c = s * stride;
      const next = (s + 1) * stride;

      if (side === 1) {
        // Right side (facing +X)
        // Top surface (0 -> 1)
        indices.push(c + 0, c + 1, next + 1);
        indices.push(c + 0, next + 1, next + 0);

        // Outer battered wall (1 -> 2, facing +X)
        indices.push(c + 1, c + 2, next + 2);
        indices.push(c + 1, next + 2, next + 1);

        // Inner wall (3 -> 0, facing -X)
        indices.push(c + 3, next + 0, c + 0);
        indices.push(c + 3, next + 3, next + 0);
      } else {
        // Left side (facing -X)
        // Top surface (0 -> 1)
        indices.push(c + 0, next + 1, c + 1);
        indices.push(c + 0, next + 0, next + 1);

        // Outer battered wall (1 -> 2, facing -X)
        indices.push(c + 1, next + 2, c + 2);
        indices.push(c + 1, next + 1, next + 2);

        // Inner wall (3 -> 0, facing +X)
        indices.push(c + 3, c + 0, next + 0);
        indices.push(c + 3, next + 0, next + 3);
      }
    }

    // Front cap at s = 0 (facing +Z toward approach plaza)
    if (side === 1) {
      indices.push(0, 2, 1);
      indices.push(0, 3, 2);
    } else {
      indices.push(0, 1, 2);
      indices.push(0, 2, 3);
    }

    // Back cap at s = count - 1 (facing -Z into terrace)
    const last = (count - 1) * stride;
    if (side === 1) {
      indices.push(last + 0, last + 1, last + 2);
      indices.push(last + 0, last + 2, last + 3);
    } else {
      indices.push(last + 0, last + 2, last + 1);
      indices.push(last + 0, last + 3, last + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
}
