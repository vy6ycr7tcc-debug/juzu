/**
 * Module: src/world/regions/jungleLowlands.ts
 * Responsibility: Region 3 — Jungle Lowlands (Antisuyu, 800–1,800 m) per Bible §1.7:
 * - Sunken Inca Stepped Cenote Temple encircled by battered polygonal andesite walls
 * - Stepped stone descent staircase & concentric basin tiers into crystalline turquoise water
 * - Central sacred Amaru serpent altar with coiled serpent obelisk & radiant sun disc
 * - Submerged serpent conduit unsealed by the Bronze & Stone Hydraulic Sluice Gate
 * - Giant buttressed Amazonian Ceiba/Lupuna trunks with organic flaring root fins and hanging lianas
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts, src/world/regions/cloudForest.ts.
 * Exports: JungleLowlandsRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';
import { IncaMasonrySystem } from '../masonry';
import { InteractableTarget } from './cloudForest';

export class JungleLowlandsRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  public sluiceGateMesh: THREE.Mesh | null = null;
  public poolMesh: THREE.Mesh | null = null;
  public cenoteWaterMat: THREE.MeshStandardMaterial | null = null;
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

    const hAt = (x: number, z: number): number => terrain.getJungleLowlandsHeightAt(x, z);

    // 1. Sunken Antisuyu Stepped Cenote Sanctuary on the North Basin (z = -8.2)
    const cenZ = -8.2;
    const cenY = hAt(0, cenZ);
    this.baseWaterY = 1.88;
    this.targetWaterY = this.baseWaterY;

    // Authentic Sunken Turquoise Cenote Pool Water Surface with dynamic normal maps and depth gradient
    const poolR = 3.6;
    const poolGeo = new THREE.CircleGeometry(poolR, 48);
    poolGeo.rotateX(-Math.PI * 0.5);

    // Color gradient from deep sapphire-emerald abyss to translucent turquoise shallows
    const pos = poolGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const deepCol = new THREE.Color(0x0e3630);
    const midCol = new THREE.Color(0x196e64);
    const rimCol = new THREE.Color(0x2da898);
    const colTmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dist = Math.hypot(vx, vz);
      const ratio = Math.min(1.0, dist / poolR);
      if (ratio < 0.45) {
        colTmp.copy(deepCol).lerp(midCol, ratio / 0.45);
      } else {
        colTmp.copy(midCol).lerp(rimCol, (ratio - 0.45) / 0.55);
      }
      colors[i * 3] = colTmp.r;
      colors[i * 3 + 1] = colTmp.g;
      colors[i * 3 + 2] = colTmp.b;
    }
    poolGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometries.push(poolGeo);

    // Low sunken stone curb lining the pool rim flush with rainforest ground
    const basinStoneGeo = new THREE.CylinderGeometry(poolR + 0.32, poolR + 0.12, 0.46, 48, 1, true);
    this.geometries.push(basinStoneGeo);
    const basinStone = new THREE.Mesh(basinStoneGeo, materials.andesiteCut);
    basinStone.position.set(0, 1.84, cenZ);
    basinStone.receiveShadow = true;
    this.group.add(basinStone);

    this.cenoteWaterMat = materials.water.clone();
    this.cenoteWaterMat.vertexColors = true;
    this.cenoteWaterMat.roughness = 0.05;
    this.cenoteWaterMat.metalness = 0.08;
    this.cenoteWaterMat.transparent = true;
    this.cenoteWaterMat.opacity = 0.92;
    if (this.cenoteWaterMat.normalMap) {
      this.cenoteWaterMat.normalMap = this.cenoteWaterMat.normalMap.clone();
      this.cenoteWaterMat.normalMap.wrapS = THREE.RepeatWrapping;
      this.cenoteWaterMat.normalMap.wrapT = THREE.RepeatWrapping;
      this.cenoteWaterMat.normalMap.repeat.set(6, 6);
    }
    this.materials.push(this.cenoteWaterMat);

    this.poolMesh = new THREE.Mesh(poolGeo, this.cenoteWaterMat);
    this.poolMesh.position.set(0, this.baseWaterY, cenZ);
    this.poolMesh.receiveShadow = true;
    this.group.add(this.poolMesh);

    // Sweeping Curved Retaining Andenes Terraces (North Basin)
    const northTerraceGeo = IncaMasonrySystem.createIncaPillowWallGeometry(14.5, 1.65, 0.95, {
      courses: 3,
      stonesPerCourse: 8,
      pillowBulge: 0.045,
      batter: 0.12,
    });
    const upperTerraceGeo = IncaMasonrySystem.createIncaPillowWallGeometry(16.5, 1.85, 0.95, {
      courses: 3,
      stonesPerCourse: 10,
      pillowBulge: 0.045,
      batter: 0.12,
    });
    this.geometries.push(northTerraceGeo, upperTerraceGeo);

    const northTerrace = new THREE.Mesh(northTerraceGeo, materials.andesiteCut);
    const nY = hAt(0, cenZ - 4.5);
    northTerrace.position.set(0, nY + 0.65, cenZ - 4.5);
    northTerrace.castShadow = true;
    northTerrace.receiveShadow = true;
    this.group.add(northTerrace);

    const upperTerrace = new THREE.Mesh(upperTerraceGeo, materials.andesiteCut);
    const uY = hAt(0, cenZ - 8.5);
    upperTerrace.position.set(0, uY + 0.75, cenZ - 8.5);
    upperTerrace.castShadow = true;
    upperTerrace.receiveShadow = true;
    this.group.add(upperTerrace);

    // Flanking stone staircase descending gently into the cenote basin
    const stairStepCount = 8;
    const stairGeo = this.createChippedBlockGeometry(1.6, 0.24, 0.72);
    this.geometries.push(stairGeo);
    for (let s = 0; s < stairStepCount; s++) {
      const t = s / (stairStepCount - 1);
      const sx = -4.2 - t * 0.4;
      const sz = -1.2 - t * 4.5;
      const groundY = hAt(sx, sz);
      const sy = groundY + 0.12;
      const stair = new THREE.Mesh(stairGeo, materials.andesiteCut);
      stair.position.set(sx, sy, sz);
      stair.rotation.y = 0.25;
      stair.castShadow = true;
      stair.receiveShadow = true;
      this.group.add(stair);
      terrain.registerWalkable(stair);
    }

    // Submerged stone steps descending into the flooded conduit passage
    const subGeo = this.createChippedBlockGeometry(2.4, 0.35, 0.95);
    this.geometries.push(subGeo);
    for (let s = 0; s < 3; s++) {
      const sub = new THREE.Mesh(subGeo, materials.andesiteCut);
      sub.position.set(0, cenY - 0.45 - s * 0.25, cenZ - 1.8 - s * 0.75);
      sub.receiveShadow = true;
      this.group.add(sub);
    }

    // Central Antisuyu Paqcha Water Altar & Carved Amaru Stele (North Bank of Cenote)
    const altarDaisGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.6, 0.72, 2.4, {
      courses: 2,
      stonesPerCourse: 4,
      pillowBulge: 0.042,
    });
    const basinGeo = new THREE.CylinderGeometry(1.05, 1.18, 0.42, 24);
    const steleGeo = IncaMasonrySystem.createIncaPillarGeometry(1.05, 2.8, 0.65, {
      courses: 5,
      pillowBulge: 0.038,
      batter: 0.08,
    });
    const steleCrestGeo = IncaMasonrySystem.createIncaPillowWallGeometry(1.35, 0.45, 0.75, {
      courses: 1,
      stonesPerCourse: 2,
      pillowBulge: 0.035,
    });
    const spoutGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
    spoutGeo.rotateX(Math.PI * 0.5);
    const sunMedallionGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.06, 24);
    sunMedallionGeo.rotateX(Math.PI * 0.5);

    this.geometries.push(
      altarDaisGeo,
      basinGeo,
      steleGeo,
      steleCrestGeo,
      spoutGeo,
      sunMedallionGeo
    );

    const altarZ = -12.6;
    const altarY = hAt(0, altarZ);

    const altarDais = new THREE.Mesh(altarDaisGeo, materials.andesiteCut);
    altarDais.position.set(0, altarY + 0.36, altarZ);
    altarDais.castShadow = true;
    altarDais.receiveShadow = true;
    this.group.add(altarDais);

    const basin = new THREE.Mesh(basinGeo, materials.andesiteCut);
    basin.position.set(0, altarY + 0.42, altarZ + 0.65);
    basin.castShadow = true;
    basin.receiveShadow = true;
    this.group.add(basin);

    const stele = new THREE.Mesh(steleGeo, materials.andesiteCut);
    stele.position.set(0, altarY + 1.85, altarZ);
    stele.castShadow = true;
    stele.receiveShadow = true;
    this.group.add(stele);

    const crest = new THREE.Mesh(steleCrestGeo, materials.andesiteCut);
    crest.position.set(0, altarY + 3.45, altarZ);
    crest.castShadow = true;
    this.group.add(crest);

    // Cast bronze Amaru serpent spout pouring water into the basin
    const spout = new THREE.Mesh(spoutGeo, materials.metalBronze);
    spout.position.set(0, altarY + 1.45, altarZ + 0.38);
    spout.castShadow = true;
    this.group.add(spout);

    // Radiant Bronze Sun Medallion mounted on the upper stele
    const medallion = new THREE.Mesh(sunMedallionGeo, materials.goldOrnamental);
    medallion.position.set(0, altarY + 2.85, altarZ + 0.34);
    medallion.castShadow = true;
    this.group.add(medallion);

    // Submerged Serpent Conduit Portal (revealed when drained)
    const conduitArchGeo = this.createBatteredWallGeometry(2.4, 2.6, 1.4);
    const portalInnerGeo = this.createChippedBlockGeometry(1.4, 2.0, 1.6);
    this.geometries.push(conduitArchGeo, portalInnerGeo);

    const conduitArch = new THREE.Mesh(conduitArchGeo, materials.andesiteCut);
    conduitArch.position.set(0, cenY - 0.55, cenZ - 4.2);
    conduitArch.castShadow = true;
    conduitArch.receiveShadow = true;
    this.group.add(conduitArch);

    const portalInner = new THREE.Mesh(portalInnerGeo, materials.metalIron);
    portalInner.position.set(0, cenY - 0.55, cenZ - 4.2);
    this.group.add(portalInner);

    // 2. Bronze & Stone Hydraulic Sluice Gate on the Embankment (x = 3.6, z = 2.4)
    const slX = 3.6;
    const slZ = 2.4;
    const slY = hAt(slX, slZ);
    this.baseGateY = slY + 0.85;
    this.targetGateY = this.baseGateY;

    // Battered stone pylon towers flanking the sluice gate
    const pylonGeo = this.createBatteredWallGeometry(0.72, 2.85, 0.85);
    const lintelGeo = this.createChippedBlockGeometry(2.5, 0.45, 0.95);
    const gateGeo = new THREE.BoxGeometry(1.25, 1.65, 0.14);
    const winchDrumGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.35, 12);
    winchDrumGeo.rotateZ(Math.PI * 0.5);
    const ropeCoilGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.95, 12);
    ropeCoilGeo.rotateZ(Math.PI * 0.5);
    const cogRimGeo = new THREE.TorusGeometry(0.38, 0.045, 8, 20);
    cogRimGeo.rotateY(Math.PI * 0.5);
    const cogHubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12);
    cogHubGeo.rotateX(Math.PI * 0.5);
    const spokeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6);

    this.geometries.push(
      pylonGeo,
      lintelGeo,
      gateGeo,
      winchDrumGeo,
      ropeCoilGeo,
      cogRimGeo,
      cogHubGeo,
      spokeGeo
    );

    const rotAngle = -0.32;
    for (let side = -1; side <= 1; side += 2) {
      const pylon = new THREE.Mesh(pylonGeo, materials.andesiteCut);
      pylon.position.set(slX + side * 0.82, slY + 1.25, slZ);
      pylon.rotation.y = rotAngle;
      pylon.castShadow = true;
      pylon.receiveShadow = true;
      this.group.add(pylon);
    }

    const lintel = new THREE.Mesh(lintelGeo, materials.andesiteCut);
    lintel.position.set(slX, slY + 2.75, slZ);
    lintel.rotation.y = rotAngle;
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.group.add(lintel);

    // Cast Bronze Portcullis Gate
    this.sluiceGateMesh = new THREE.Mesh(gateGeo, materials.metalBronze);
    this.sluiceGateMesh.position.set(slX, this.baseGateY, slZ);
    this.sluiceGateMesh.rotation.y = rotAngle;
    this.sluiceGateMesh.castShadow = true;
    this.group.add(this.sluiceGateMesh);

    // Mechanical Winch Drum with braided ichu rope wraps
    const drum = new THREE.Mesh(winchDrumGeo, materials.woodAged);
    drum.position.set(slX, slY + 2.35, slZ);
    drum.rotation.y = rotAngle;
    drum.castShadow = true;
    this.group.add(drum);

    const ropeCoil = new THREE.Mesh(ropeCoilGeo, materials.ropeBraided);
    ropeCoil.position.set(slX, slY + 2.35, slZ);
    ropeCoil.rotation.y = rotAngle;
    ropeCoil.castShadow = true;
    this.group.add(ropeCoil);

    // Spoked Bronze Cog Wheel on side of winch
    const cogGroup = new THREE.Group();
    cogGroup.position.set(slX + 0.78, slY + 2.35, slZ);
    cogGroup.rotation.y = rotAngle;

    const cogRim = new THREE.Mesh(cogRimGeo, materials.metalBronze);
    cogRim.castShadow = true;
    cogGroup.add(cogRim);

    const cogHub = new THREE.Mesh(cogHubGeo, materials.metalBronze);
    cogHub.castShadow = true;
    cogGroup.add(cogHub);

    for (let s = 0; s < 4; s++) {
      const sp = new THREE.Mesh(spokeGeo, materials.metalBronze);
      sp.rotation.z = (s / 4) * Math.PI;
      sp.castShadow = true;
      cogGroup.add(sp);
    }
    this.group.add(cogGroup);

    // Stone Water Sluice Channel
    const channelGeo = this.createChippedBlockGeometry(1.6, 0.42, 4.5);
    const channelWaterGeo = new THREE.PlaneGeometry(1.3, 4.4);
    channelWaterGeo.rotateX(-Math.PI * 0.5);
    this.geometries.push(channelGeo, channelWaterGeo);

    const channel = new THREE.Mesh(channelGeo, materials.andesiteCut);
    channel.position.set(slX - 0.8, slY + 0.1, slZ - 2.1);
    channel.rotation.y = 0.25;
    channel.castShadow = true;
    channel.receiveShadow = true;
    this.group.add(channel);

    const chWater = new THREE.Mesh(channelWaterGeo, materials.water);
    chWater.position.set(slX - 0.8, slY + 0.28, slZ - 2.1);
    chWater.rotation.y = 0.25;
    this.group.add(chWater);

    this.interactables.push({
      id: 'jungle_hydraulic_sluice',
      label: 'Antisuyu Hydraulic Sluice Gate',
      promptText: '[E] Open Antisuyu Cenote Sluice Gate',
      position: new THREE.Vector3(slX, slY + 1.0, slZ),
      radius: 3.5,
    });

    // 3. Giant Buttressed Amazonian Ceiba / Lupuna Trunks & Hanging Liana Vines
    const ceibaCoords = [
      [-9.2, 5.2],  // Moved back & outward to frame the vista naturally
      [9.5, 4.8],   // Moved back & outward
      [-8.2, -5.5],
      [8.5, -5.8],
      [-9.2, -16.5],
      [9.2, -16.8],
    ];
    const trunkGeo = this.createOrganicLupunaTrunkGeometry();
    const buttressGeo = this.createCeibaButtressGeometry(2.8, 5.2, 0.45);
    const vineGeo = new THREE.CylinderGeometry(0.028, 0.028, 8.5, 6);
    this.geometries.push(trunkGeo, buttressGeo, vineGeo);

    for (let i = 0; i < ceibaCoords.length; i++) {
      const [tx, tz] = ceibaCoords[i];
      const ty = hAt(tx, tz);
      const trunk = new THREE.Mesh(trunkGeo, materials.woodBark);
      trunk.position.set(tx, ty - 0.4, tz);
      trunk.rotation.y = i * 1.35;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      this.group.add(trunk);

      // Flaring organic buttress root fins (3-4 fins per tree)
      const finCount = 3 + (i % 2);
      for (let f = 0; f < finCount; f++) {
        const finAng = (f * Math.PI * 2) / finCount + i * 0.75;
        const fin = new THREE.Mesh(buttressGeo, materials.woodBark);
        fin.position.set(tx, ty - 0.2, tz);
        fin.rotation.y = finAng;
        fin.castShadow = true;
        fin.receiveShadow = true;
        this.group.add(fin);
      }

      // Hanging and draped liana vines
      for (let v = 0; v < 3; v++) {
        const vine = new THREE.Mesh(vineGeo, v === 0 ? materials.ropeBraided : materials.moss);
        const vAng = (v / 3) * Math.PI * 2 + i;
        vine.position.set(
          tx + Math.cos(vAng) * 1.05,
          ty + 5.8,
          tz + Math.sin(vAng) * 1.05
        );
        vine.rotation.z = Math.sin(v * 2.1) * 0.08;
        vine.rotation.x = Math.cos(v * 1.9) * 0.08;
        vine.castShadow = true;
        this.group.add(vine);
      }
    }
  }

  private createCeibaButtressGeometry(finDepth: number, finHeight: number, baseThick: number): THREE.BufferGeometry {
    const vSteps = 8;
    const positions: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    // Left and right surfaces of the buttress fin
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      for (let i = 0; i <= vSteps; i++) {
        const t = i / vSteps;
        const y = t * finHeight;
        // Hyperbolic decay outward
        const reach = finDepth * Math.pow(1.0 - t, 1.8);
        const thick = (baseThick * (1.0 - t * 0.6) * 0.5) * sign;
        const wavy = Math.sin(t * 5.0) * 0.04;

        // Inner vertex (at trunk surface)
        positions.push(thick * 0.6, y, 0);
        uvs.push(0, t);

        // Outer vertex (flaring into root tip)
        positions.push(thick + wavy, y, reach);
        uvs.push(1, t);
      }
    }

    const rowVerts = 2;
    const sideVertCount = (vSteps + 1) * rowVerts;

    // Quads for Left side (facing -X)
    for (let i = 0; i < vSteps; i++) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = (i + 1) * 2;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }

    // Quads for Right side (facing +X)
    for (let i = 0; i < vSteps; i++) {
      const i0 = sideVertCount + i * 2;
      const i1 = i0 + 1;
      const i2 = sideVertCount + (i + 1) * 2;
      const i3 = i2 + 1;
      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    // Outer ridge spine connecting left and right outer edges
    for (let i = 0; i < vSteps; i++) {
      const leftOut0 = i * 2 + 1;
      const leftOut1 = (i + 1) * 2 + 1;
      const rightOut0 = sideVertCount + i * 2 + 1;
      const rightOut1 = sideVertCount + (i + 1) * 2 + 1;
      indices.push(leftOut0, rightOut0, leftOut1);
      indices.push(rightOut0, rightOut1, leftOut1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private createChippedBlockGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const chip =
        Math.sin(vx * 5.3 + vy * 7.1 + vz * 4.7) * 0.025 +
        Math.cos(vx * 9.2 - vz * 8.4) * 0.015;
      const edgeBevel = Math.abs(vy) > h * 0.45 ? 0.96 : 1.0;
      pos.setXYZ(i, vx * edgeBevel + chip, vy + chip * 0.6, vz * edgeBevel + chip);
    }
    geo.computeVertexNormals();
    return geo;
  }

  private createBatteredWallGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    return IncaMasonrySystem.createIncaPillowWallGeometry(w, h, d, {
      courses: Math.max(3, Math.round(h / 0.65)),
      stonesPerCourse: Math.max(3, Math.round(w / 0.85)),
      pillowBulge: 0.048,
      jointDepth: 0.024,
      batter: 0.08,
    });
  }

  private createAnnularTierGeometry(
    innerR: number,
    outerR: number,
    thick: number,
    startAng: number,
    arcAng: number
  ): THREE.BufferGeometry {
    const segs = 28;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Ring vertices: 2 concentric top, 2 concentric bottom
    for (let i = 0; i <= segs; i++) {
      const a = startAng + (i / segs) * arcAng;
      const cos = Math.cos(a);
      const sin = Math.sin(a);

      // Top inner (0)
      positions.push(cos * innerR, thick * 0.5, sin * innerR);
      uvs.push(0, i / segs);
      // Top outer (1)
      positions.push(cos * outerR, thick * 0.5, sin * outerR);
      uvs.push(1, i / segs);

      // Bottom inner (2)
      positions.push(cos * innerR, -thick * 0.5, sin * innerR);
      uvs.push(0, i / segs);
      // Bottom outer (3)
      positions.push(cos * outerR, -thick * 0.5, sin * outerR);
      uvs.push(1, i / segs);
    }

    const stride = 4;
    for (let i = 0; i < segs; i++) {
      const c = i * stride;
      const n = (i + 1) * stride;

      const topIn0 = c;
      const topOut0 = c + 1;
      const botIn0 = c + 2;
      const botOut0 = c + 3;

      const topIn1 = n;
      const topOut1 = n + 1;
      const botIn1 = n + 2;
      const botOut1 = n + 3;

      // Top surface quad (CCW upward)
      indices.push(topIn0, topOut0, topIn1);
      indices.push(topOut0, topOut1, topIn1);

      // Outer vertical wall quad (CCW facing out)
      indices.push(topOut0, botOut0, topOut1);
      indices.push(botOut0, botOut1, topOut1);

      // Inner vertical wall quad (CCW facing in)
      indices.push(topIn0, topIn1, botIn0);
      indices.push(topIn1, botIn1, botIn0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
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

    // Animate cenote water surface ripples
    if (this.cenoteWaterMat && this.cenoteWaterMat.normalMap) {
      this.cenoteWaterMat.normalMap.offset.x = (this.elapsedSec * 0.02) % 1.0;
      this.cenoteWaterMat.normalMap.offset.y = (this.elapsedSec * 0.015) % 1.0;
    }

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
      this.poolMesh.position.y = THREE.MathUtils.lerp(
        this.poolMesh.position.y,
        this.targetWaterY,
        Math.min(1.0, dt * 1.8)
      );
    }
  }

  /**
   * Builds an organic Amazonian Lupuna/Ceiba trunk geometry with gentle natural curve,
   * fluted buttressed base flare, and realistic taper.
   */
  private createOrganicLupunaTrunkGeometry(): THREE.BufferGeometry {
    const hSegs = 14;
    const radSegs = 12;
    const totalHeight = 16.5;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let h = 0; h <= hSegs; h++) {
      const t = h / hSegs;
      const y = t * totalHeight;
      // Gentle natural curvature in trunk axis
      const cx = Math.sin(t * Math.PI) * 0.35;
      const cz = Math.cos(t * Math.PI * 0.8) * 0.28;

      // Base flare and taper
      const baseFlare = t < 0.22 ? Math.pow((0.22 - t) / 0.22, 1.8) * 1.25 : 0.0;
      const radius = 1.15 * (1.0 - t * 0.55) + baseFlare;

      for (let s = 0; s <= radSegs; s++) {
        const u = s / radSegs;
        const ang = u * Math.PI * 2;
        // 5 fluting waves around the buttressed base
        const fluting = t < 0.25 ? 1.0 + Math.sin(ang * 5.0) * 0.22 * (1.0 - t * 4.0) : 1.0;
        const rx = cx + Math.cos(ang) * radius * fluting;
        const rz = cz + Math.sin(ang) * radius * fluting;

        positions.push(rx, y, rz);
        uvs.push(u * 3.0, t * 8.0);
      }
    }

    const stride = radSegs + 1;
    for (let h = 0; h < hSegs; h++) {
      for (let s = 0; s < radSegs; s++) {
        const a = h * stride + s;
        const b = a + stride;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
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
