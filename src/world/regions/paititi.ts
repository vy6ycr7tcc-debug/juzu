/**
 * Module: src/world/regions/paititi.ts
 * Responsibility: Region 4 — Paititi: The Living City (2,800 m hidden caldera) per Bible §1.7:
 * - Monumental curved Coricancha-style Inca sun-temple terraces
 * - Twin golden stone aqueduct channels pouring water into carved basins
 * - Towering trapezoidal Sanctuary Portal crowned with an embossed Gold Solar Disc
 * - Grand Quipu Archive Chamber housing the living knotted cord records (Chapters 10–12)
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

    // 1. Curved Coricancha Sun-Temple Terrace & Trapezoidal Golden Sanctuary Portal (z = -12.5)
    const ptZ = -12.5;
    const ptY = terrain.getTerrainHeightAt(0, ptZ);

    const curvedTerraceGeo = new THREE.CylinderGeometry(8.2, 9.1, 2.2, 24, 2, false, -Math.PI * 0.45, Math.PI * 0.9);
    const upperTerraceGeo = new THREE.CylinderGeometry(5.6, 6.2, 2.0, 20, 2, false, -Math.PI * 0.4, Math.PI * 0.8);
    this.geometries.push(curvedTerraceGeo, upperTerraceGeo);

    const lowerTerrace = new THREE.Mesh(curvedTerraceGeo, materials.andesiteCut);
    lowerTerrace.position.set(0, ptY + 0.95, ptZ);
    lowerTerrace.rotation.y = Math.PI;
    lowerTerrace.castShadow = true;
    lowerTerrace.receiveShadow = true;
    this.group.add(lowerTerrace);

    const upperTerrace = new THREE.Mesh(upperTerraceGeo, materials.andesiteCut);
    upperTerrace.position.set(0, ptY + 2.85, ptZ - 1.2);
    upperTerrace.rotation.y = Math.PI;
    upperTerrace.castShadow = true;
    upperTerrace.receiveShadow = true;
    this.group.add(upperTerrace);

    // Towering Trapezoidal Sun Portal & Embossed Ornamental Gold Inti Solar Disc
    const jambGeo = new THREE.BoxGeometry(0.95, 3.8, 0.95);
    const lintelGeo = new THREE.BoxGeometry(3.8, 0.85, 1.05);
    const goldBandGeo = new THREE.BoxGeometry(3.85, 0.26, 1.08);
    const sunDiscGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.14, 24);
    sunDiscGeo.rotateX(Math.PI / 2);
    this.geometries.push(jambGeo, lintelGeo, goldBandGeo, sunDiscGeo);

    const leftJamb = new THREE.Mesh(jambGeo, materials.andesiteCut);
    leftJamb.position.set(-1.35, ptY + 4.6, ptZ + 5.6);
    leftJamb.rotation.z = -0.08;
    leftJamb.castShadow = true;
    leftJamb.receiveShadow = true;
    this.group.add(leftJamb);

    const rightJamb = new THREE.Mesh(jambGeo, materials.andesiteCut);
    rightJamb.position.set(1.35, ptY + 4.6, ptZ + 5.6);
    rightJamb.rotation.z = 0.08;
    rightJamb.castShadow = true;
    rightJamb.receiveShadow = true;
    this.group.add(rightJamb);

    const lintel = new THREE.Mesh(lintelGeo, materials.andesiteCut);
    lintel.position.set(0, ptY + 6.55, ptZ + 5.6);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.group.add(lintel);

    const goldBand = new THREE.Mesh(goldBandGeo, materials.goldOrnamental);
    goldBand.position.set(0, ptY + 6.15, ptZ + 5.65);
    this.group.add(goldBand);

    this.sunDiscMesh = new THREE.Mesh(sunDiscGeo, materials.goldOrnamental);
    this.sunDiscMesh.position.set(0, ptY + 7.65, ptZ + 5.75);
    this.sunDiscMesh.castShadow = true;
    this.group.add(this.sunDiscMesh);

    // 2. Twin Golden Aqueduct Channels & Woven Quipu Archive Rack on the South Plaza (z = 7.2)
    const aqY = terrain.getTerrainHeightAt(0, 7.2);
    const channelGeo = new THREE.BoxGeometry(0.95, 0.85, 5.2);
    const goldLiningGeo = new THREE.BoxGeometry(0.55, 0.12, 5.1);
    this.geometries.push(channelGeo, goldLiningGeo);

    const sides = [-3.2, 3.2];
    for (let s = 0; s < sides.length; s++) {
      const sx = sides[s];
      const ch = new THREE.Mesh(channelGeo, materials.andesiteCut);
      ch.position.set(sx, aqY + 0.35, 8.2);
      ch.castShadow = true;
      ch.receiveShadow = true;
      this.group.add(ch);

      const gl = new THREE.Mesh(goldLiningGeo, materials.goldOrnamental);
      gl.position.set(sx, aqY + 0.78, 8.2);
      this.group.add(gl);
    }

    // Grand Quipu Archive Frame on the South Sanctuary Plaza (x = -1.5, z = 7.4)
    const rackPostGeo = new THREE.CylinderGeometry(0.08, 0.09, 2.1, 8);
    const rackBarGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
    rackBarGeo.rotateZ(Math.PI / 2);
    const cordGeo = new THREE.CylinderGeometry(0.015, 0.012, 1.25, 5);
    this.geometries.push(rackPostGeo, rackBarGeo, cordGeo);

    const postL = new THREE.Mesh(rackPostGeo, materials.woodAged);
    postL.position.set(-2.3, aqY + 1.0, 7.4);
    this.group.add(postL);

    const postR = new THREE.Mesh(rackPostGeo, materials.woodAged);
    postR.position.set(-0.7, aqY + 1.0, 7.4);
    this.group.add(postR);

    const crossBar = new THREE.Mesh(rackBarGeo, materials.goldOrnamental);
    crossBar.position.set(-1.5, aqY + 1.92, 7.4);
    this.group.add(crossBar);

    for (let q = 0; q < 9; q++) {
      const cord = new THREE.Mesh(
        cordGeo,
        q % 2 === 0 ? materials.clothQuechuaRed : materials.goldOrnamental
      );
      cord.position.set(-2.1 + q * 0.15, aqY + 1.28, 7.4);
      this.group.add(cord);
    }

    this.interactables.push({
      id: 'paititi_quipu_archive',
      label: 'Grand Quipu Archive of Paititi',
      promptText: '[E] Examine the Living Quipu Archive (Chapter 11: The Decision)',
      position: new THREE.Vector3(-1.5, aqY + 1.0, 7.4),
      radius: 3.2,
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
    this.geometries.length = 0;
    this.interactables.length = 0;
    this.group.removeFromParent();
  }
}
