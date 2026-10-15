/**
 * Module: src/world/regions/highSierra.ts
 * Responsibility: Region 2 — High Sierra (3,800–4,800 m) per Bible §1.7:
 * - Stepped Inca agricultural terraces (andenes) with stone retaining walls & flights of stairs
 * - High-altitude Andean stone village (kancha dwellings with authentic battered walls,
 *   trapezoidal doorways, stone gable peg-ties, round timber purlins, & combed ichu thatch roofs)
 * - Paved Qhapaq Ñan Inca Royal Road with weathered andesite flagstones, curb stones, & drainage cunetas
 * - Intihuatana Stepped Solar Observatory & Usnu platform with ceremonial staircase & gnomon pillar
 * - Interactive Bronze Solar Alignment Mirror with Chakana pedestal and radiant Inti sunbeams
 * - Glacial tarn (crystal alpine cirque pool) & snowdrifts framing the northern mountain pass
 * - Wind-fluttering Quechua textile saywa boundary poles & apacheta cairns
 * - Multi-blade 3D golden ichu grass tussocks
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts, src/world/regions/cloudForest.ts.
 * Exports: HighSierraRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';
import { IncaMasonrySystem } from '../masonry';
import { applyNanoHexagonRelief } from '../../rendering/nanoHex';
import { InteractableTarget } from './cloudForest';

export class HighSierraRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  public solarAligned: boolean = false;
  private solarMirrorMesh: THREE.Object3D | null = null;
  private solarBeamMesh: THREE.Mesh | null = null;
  private solarBeamMat: THREE.MeshBasicMaterial | null = null;
  private gnomonFlareMesh: THREE.Mesh | null = null;
  private gnomonFlareMat: THREE.MeshBasicMaterial | null = null;
  private readonly streamerMeshes: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private elapsedSec: number = 0;

  public build(
    scene: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'Region2_HighSierra';
    this.group.visible = false;
    scene.add(this.group);

    if (!materials || !terrain) return;

    const hAt = (x: number, z: number): number => terrain.getHighSierraHeightAt(x, z);

    // 1. Stepped Inca Agricultural Terraces (Andenes) flanking West & East slopes
    this.buildAndenesTerraces(materials, hAt);

    // 2. Qhapaq Ñan: Paved Inca Royal Road along the central valley pass
    this.buildQhapaqNanRoad(materials, hAt);

    // 3. High-Altitude Stone Village (Kancha Dwellings with Battered Walls & Combed Thatch)
    this.buildStoneVillage(materials, hAt);

    // 4. Intihuatana & Usnu Stepped Ceremonial Observatory (x = 0, z = -10.5)
    this.buildIntihuatanaComplex(materials, hAt);

    // 5. Interactive Bronze Solar Alignment Mirror (x = 1.65, z = 6.2)
    this.buildSolarAlignmentMirror(materials, hAt);

    // 6. Glacial Snowline Ridges & Alpine Tarn in the Northern Mountain Pass
    this.buildGlacialPassAndTarn(materials, hAt);

    // 7. Stacked Apacheta Trail Cairns flanking the mountain crossing
    this.buildApachetaCairns(materials, hAt);

    // 8. Saywa Ridge Boundary Poles with Fluttering Quechua Textile Banners
    this.buildSaywaBoundaryPoles(materials, hAt);

    // 9. True Multi-Blade 3D Golden Ichu Grass Tussocks
    this.buildIchuGrassField(materials, hAt);
  }

  /**
   * Builds the paved Qhapaq Ñan Inca Royal Road along the central pass.
   * Features fitted weathered polygonal flagstones, raised stone curbs (albarradas),
   * and transverse drainage runnels (cunetas) crossing the road.
   */
  private buildQhapaqNanRoad(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const roadGroup = new THREE.Group();
    const flagGeo = this.createWeatheredBlock(0.68, 0.12, 0.58);
    const curbGeo = this.createWeatheredBlock(0.24, 0.18, 1.15);
    const gutterGeo = this.createWeatheredBlock(2.7, 0.08, 0.28);
    this.geometries.push(flagGeo, curbGeo, gutterGeo);

    // Paved flagstone causeway running from z = 9.6 to z = -6.0 with gentle mountain pass meander
    const startZ = 9.6;
    const endZ = -6.0;
    const rows = 26;
    const roadWidth = 2.4;

    for (let r = 0; r < rows; r++) {
      const tz = r / (rows - 1);
      const rz = startZ + tz * (endZ - startZ);
      const roadCenterX = Math.sin(rz * 0.08) * 0.45;
      const cols = 4;
      for (let c = 0; c < cols; c++) {
        const tx = (c / (cols - 1)) * 2 - 1;
        const rx = roadCenterX + tx * (roadWidth * 0.44) + Math.sin(r * 2.1 + c * 1.7) * 0.08;
        const ry = hAt(rx, rz);

        const flag = new THREE.Mesh(flagGeo, materials.andesiteCut);
        flag.position.set(rx, ry + 0.04, rz);
        flag.rotation.y = (r * 1.3 + c * 0.7) % 0.35 - 0.17;
        const sc = 0.88 + ((r + c) % 3) * 0.12;
        flag.scale.set(sc, 1.0, sc * 0.95);
        flag.receiveShadow = true;
        roadGroup.add(flag);
      }
    }

    // Border curb stones (albarradas) along left and right edges tracing the meander
    const curbSteps = 14;
    for (let i = 0; i < curbSteps; i++) {
      const cz = startZ - (i * (startZ - endZ)) / curbSteps - 0.5;
      const roadCenterX = Math.sin(cz * 0.08) * 0.45;
      const leftX = roadCenterX - 1.38;
      const rightX = roadCenterX + 1.38;
      const leftY = hAt(leftX, cz);
      const rightY = hAt(rightX, cz);

      const curbL = new THREE.Mesh(curbGeo, materials.fieldstoneRough);
      curbL.position.set(leftX, leftY + 0.08, cz);
      curbL.rotation.y = Math.cos(cz * 0.08) * 0.08 + ((i % 3) - 1) * 0.04;
      curbL.receiveShadow = true;
      roadGroup.add(curbL);

      const curbR = new THREE.Mesh(curbGeo, materials.fieldstoneRough);
      curbR.position.set(rightX, rightY + 0.08, cz);
      curbR.rotation.y = Math.cos(cz * 0.08) * 0.08 + ((i % 3) - 1) * -0.04;
      curbR.receiveShadow = true;
      roadGroup.add(curbR);
    }

    // Transverse stone drainage gutters (cunetas) with carved runnels
    const gutterZs = [4.5, 0.0, -4.0];
    for (const gz of gutterZs) {
      const gCenterX = Math.sin(gz * 0.08) * 0.45;
      const gy = hAt(gCenterX, gz);
      const gutter = new THREE.Mesh(gutterGeo, materials.andesiteCut);
      gutter.position.set(gCenterX, gy + 0.02, gz);
      gutter.rotation.y = Math.cos(gz * 0.08) * 0.08;
      gutter.receiveShadow = true;
      roadGroup.add(gutter);
    }

    this.group.add(roadGroup);
  }

  /**
   * Builds the Intihuatana & Usnu Ceremonial Complex at x = 0, z = -10.5:
   * - Deeply embedded foundation retaining wall that levels the hill slope
   * - Ceremonial staircase of 8 wide dressed ashlar steps ascending from the Qhapaq Ñan
   * - Lower terrace platform with decorative Inca ceremonial niches
   * - Upper flight of steps leading to the Usnu platform
   * - Living bedrock altar with 3 cosmic Chakana tiers & faceted solar gnomon monolith
   */
  private buildIntihuatanaComplex(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const obsZ = -10.5;
    const obsY = hAt(0, obsZ);
    const complex = new THREE.Group();

    // 1. Deep foundation retaining base (buries into the slope so the front NEVER floats)
    const baseGeo = this.createWeatheredBlock(8.8, 2.4, 8.8);
    const tier1Geo = this.createWeatheredBlock(7.6, 0.85, 7.2);
    // Monumental living-bedrock Ushnu monolith sculpted from mountain granite (replaces concentric boxes)
    const ushnuBedrockGeo = IncaMasonrySystem.createIncaUshnuBedrockGeometry(5.4, 2.2, 4.8);
    this.geometries.push(baseGeo, tier1Geo, ushnuBedrockGeo);

    // Deep base foundation
    const base = new THREE.Mesh(baseGeo, materials.fieldstoneRough);
    base.position.set(0, obsY - 0.7, obsZ);
    base.castShadow = true;
    base.receiveShadow = true;
    complex.add(base);

    // Lower platform terrace
    const tier1 = new THREE.Mesh(tier1Geo, materials.andesiteCut);
    tier1.position.set(0, obsY + 0.42, obsZ);
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    complex.add(tier1);

    // Monumental sculpted bedrock altar with asymmetrical ritual seats & sacred Chakana levels
    const ushnu = new THREE.Mesh(ushnuBedrockGeo, materials.andesiteCut);
    ushnu.position.set(0, obsY + 1.85, obsZ - 0.25);
    ushnu.castShadow = true;
    ushnu.receiveShadow = true;
    complex.add(ushnu);

    // Intihuatana Gnomon: Faceted polygonal monolith pillar rising seamlessly from Hanan Pacha tier
    const gnomonGeo = this.createIntihuatanaGnomonGeometry();
    this.geometries.push(gnomonGeo);
    const gnomon = new THREE.Mesh(gnomonGeo, materials.andesiteCut);
    gnomon.position.set(0.45, obsY + 3.12, obsZ - 0.45);
    gnomon.castShadow = true;
    gnomon.receiveShadow = true;
    complex.add(gnomon);

    // Ceremonial Golden Qero (chicha beaker) on the sacred Uku/Kay Pacha altar ledge
    const qeroGeo = new THREE.CylinderGeometry(0.09, 0.06, 0.22, 12);
    this.geometries.push(qeroGeo);
    const qero = new THREE.Mesh(qeroGeo, materials.goldOrnamental);
    qero.position.set(-0.85, obsY + 2.45, obsZ + 0.35);
    qero.castShadow = true;
    complex.add(qero);

    // Central Ceremonial Staircase: 8 wide dressed ashlar steps ascending from z = -5.8 to z = -7.4
    const stepCount = 8;
    const stepStart = -5.8;
    const stepEnd = -7.3;
    const stepGeo = this.createWeatheredBlock(2.2, 0.22, 0.34);
    const parapetGeo = this.createWeatheredBlock(0.28, 0.34, 0.34);
    this.geometries.push(stepGeo, parapetGeo);

    const groundAtStart = hAt(0, stepStart);
    const targetY = obsY + 0.42;

    for (let s = 0; s < stepCount; s++) {
      const ts = s / (stepCount - 1);
      const sz = stepStart + ts * (stepEnd - stepStart);
      const sy = groundAtStart + ts * (targetY - groundAtStart) + 0.1;

      const step = new THREE.Mesh(stepGeo, materials.andesiteCut);
      step.position.set(0, sy, sz);
      step.castShadow = true;
      step.receiveShadow = true;
      complex.add(step);

      // Flanking stepped stone ramp balustrades
      const paraL = new THREE.Mesh(parapetGeo, materials.fieldstoneRough);
      paraL.position.set(-1.22, sy + 0.14, sz);
      paraL.receiveShadow = true;
      complex.add(paraL);

      const paraR = new THREE.Mesh(parapetGeo, materials.fieldstoneRough);
      paraR.position.set(1.22, sy + 0.14, sz);
      paraR.receiveShadow = true;
      complex.add(paraR);
    }

    // Upper staircase flight: 4 steps from z = -8.0 to z = -8.8
    const upStepGeo = this.createWeatheredBlock(1.5, 0.22, 0.28);
    this.geometries.push(upStepGeo);
    for (let u = 0; u < 4; u++) {
      const tu = u / 3;
      const uz = -7.9 - tu * 0.9;
      const uy = obsY + 0.42 + tu * 0.8;
      const upStep = new THREE.Mesh(upStepGeo, materials.andesiteCut);
      upStep.position.set(0, uy, uz);
      upStep.castShadow = true;
      upStep.receiveShadow = true;
      complex.add(upStep);
    }

    this.group.add(complex);
  }

  /**
   * Creates an authentic sculpted Intihuatana gnomon monolith with living bedrock
   * facets, stepped cosmic planes, and an angled celestial shadow-casting apex.
   */
  private createIntihuatanaGnomonGeometry(): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(0.22, 0.38, 1.45, 6);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);

      // Angle the top apex toward the celestial June solstice (-0.28 rad pitch)
      const topFactor = Math.max(0, (py + 0.3) / 1.0);
      const bevelZ = -topFactor * 0.16;
      const facetChip = Math.sin(px * 6.2 + py * 7.5 + pz * 5.8) * 0.02;

      pos.setXYZ(i, px + facetChip, py + facetChip, pz + bevelZ + facetChip);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds the Interactive Bronze Solar Alignment Mirror assembly on the south plaza.
   */
  private buildSolarAlignmentMirror(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const mirX = 3.2;
    const mirZ = 4.8;
    const mirY = hAt(mirX, mirZ);

    // Sculpted monolithic andesite pedestal with authentic Inca pillow masonry and battered profile
    const pedBaseGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(0.88, 0.24, 16);
    const pedColGeo = IncaMasonrySystem.createIncaPillarGeometry(0.72, 1.05, 0.72, {
      courses: 3,
      pillowBulge: 0.045,
      jointDepth: 0.022,
      batter: 0.07,
    });
    const pedCapGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(0.62, 0.16, 16);
    const forkGeo = new THREE.TorusGeometry(0.56, 0.055, 14, 28, Math.PI);
    forkGeo.rotateZ(Math.PI);
    this.geometries.push(pedBaseGeo, pedColGeo, pedCapGeo, forkGeo);

    const pedGroup = new THREE.Group();
    pedGroup.position.set(mirX, mirY, mirZ);

    const pb = new THREE.Mesh(pedBaseGeo, materials.andesiteCut);
    pb.position.set(0, 0.12, 0);
    pb.castShadow = true;
    pb.receiveShadow = true;
    pedGroup.add(pb);

    const pc = new THREE.Mesh(pedColGeo, materials.andesiteCut);
    pc.position.set(0, 0.72, 0);
    pc.castShadow = true;
    pc.receiveShadow = true;
    pedGroup.add(pc);

    const pcap = new THREE.Mesh(pedCapGeo, materials.andesiteCut);
    pcap.position.set(0, 1.30, 0);
    pcap.castShadow = true;
    pcap.receiveShadow = true;
    pedGroup.add(pcap);

    const fork = new THREE.Mesh(forkGeo, materials.metalBronze);
    fork.position.set(0, 1.55, 0);
    fork.castShadow = true;
    pedGroup.add(fork);

    this.group.add(pedGroup);

    // Ornate Bronze Solar Mirror Assembly (Inti sun rays, central boss, concentric bezels)
    const mirrorAssembly = new THREE.Group();
    mirrorAssembly.position.set(mirX, mirY + 1.55, mirZ);
    mirrorAssembly.rotation.x = 0.18;

    const rimGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.07, 36);
    rimGeo.rotateX(Math.PI * 0.5);
    const faceGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.08, 36);
    faceGeo.rotateX(Math.PI * 0.5);
    const bossGeo = new THREE.SphereGeometry(0.15, 16, 12);
    const rayGeo = new THREE.ConeGeometry(0.048, 0.22, 4);
    rayGeo.rotateX(Math.PI * 0.5);
    const pivotGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.20, 12);
    pivotGeo.rotateZ(Math.PI * 0.5);
    this.geometries.push(rimGeo, faceGeo, bossGeo, rayGeo, pivotGeo);

    const rim = new THREE.Mesh(rimGeo, materials.metalBronze);
    rim.castShadow = true;
    mirrorAssembly.add(rim);

    const face = new THREE.Mesh(faceGeo, materials.goldOrnamental);
    face.castShadow = true;
    mirrorAssembly.add(face);

    const boss = new THREE.Mesh(bossGeo, materials.goldOrnamental);
    boss.position.set(0, 0, 0.045);
    boss.castShadow = true;
    mirrorAssembly.add(boss);

    for (let r = 0; r < 16; r++) {
      const ang = (r / 16) * Math.PI * 2;
      const ray = new THREE.Mesh(rayGeo, materials.goldOrnamental);
      const rad = 0.66;
      ray.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0);
      ray.rotation.z = ang - Math.PI * 0.5;
      ray.castShadow = true;
      mirrorAssembly.add(ray);
    }

    const trunnionL = new THREE.Mesh(pivotGeo, materials.metalBronze);
    trunnionL.position.set(-0.62, 0, 0);
    mirrorAssembly.add(trunnionL);
    const trunnionR = new THREE.Mesh(pivotGeo, materials.metalBronze);
    trunnionR.position.set(0.62, 0, 0);
    mirrorAssembly.add(trunnionR);

    this.solarMirrorMesh = mirrorAssembly;
    this.group.add(mirrorAssembly);

    // Inti-k'anchay Volumetric Solar Reflection Beam connecting Mirror to Intihuatana Gnomon
    const mirPos = new THREE.Vector3(mirX, mirY + 1.55, mirZ);
    const obsZ = -10.5;
    const obsY = hAt(0, obsZ);
    const gnomonApex = new THREE.Vector3(0.45, obsY + 3.85, obsZ - 0.45);
    const beamDist = mirPos.distanceTo(gnomonApex);

    const beamGeo = new THREE.CylinderGeometry(0.08, 0.28, beamDist, 14, 1, true);
    beamGeo.rotateX(Math.PI * 0.5);
    const flareGeo = new THREE.CircleGeometry(0.85, 18);
    this.geometries.push(beamGeo, flareGeo);

    this.solarBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffe28a,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.materials.push(this.solarBeamMat);

    this.solarBeamMesh = new THREE.Mesh(beamGeo, this.solarBeamMat);
    this.solarBeamMesh.position.copy(mirPos).lerp(gnomonApex, 0.5);
    this.solarBeamMesh.lookAt(gnomonApex);
    this.group.add(this.solarBeamMesh);

    this.gnomonFlareMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.materials.push(this.gnomonFlareMat);

    this.gnomonFlareMesh = new THREE.Mesh(flareGeo, this.gnomonFlareMat);
    this.gnomonFlareMesh.position.copy(gnomonApex);
    this.gnomonFlareMesh.rotation.x = -Math.PI * 0.35;
    this.group.add(this.gnomonFlareMesh);

    this.interactables.push({
      id: 'sierra_solar_mirror',
      label: 'Intihuatana Solar Mirror',
      promptText: '[E] Align Bronze Solar Mirror with Intihuatana Gnomon',
      position: new THREE.Vector3(mirX, mirY + 0.8, mirZ),
      radius: 3.2,
    });
  }

  /**
   * Builds 4 tiers of battered Inca stone agricultural retaining walls (andenes)
   * on both the West and East slopes of the High Sierra pass.
   */
  private buildAndenesTerraces(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const snowMat = new THREE.MeshStandardMaterial({
      name: 'AndenesSnowLedge',
      color: new THREE.Color(2.2, 2.3, 2.5),
      map: materials.highSierraSnow.map,
      roughness: 0.65,
      metalness: 0.0,
    });
    this.materials.push(snowMat);

    // 4 sweeping continuous curved andenes agricultural terraces flanking East and West slopes
    for (let side = -1; side <= 1; side += 2) {
      for (let tier = 0; tier < 4; tier++) {
        const segs = 32;
        const zStart = 8.8;
        const zEnd = -15.5;

        const posList: number[] = [];
        const normList: number[] = [];
        const uvList: number[] = [];
        const idxList: number[] = [];

        const snowPosList: number[] = [];
        const snowNormList: number[] = [];
        const snowUvList: number[] = [];
        const snowIdxList: number[] = [];

        const wallThick = 0.85;
        const batter = 0.12;

        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const z = zStart + t * (zEnd - zStart);
          const contour = Math.sin(z * 0.18) * 1.4 + Math.cos(z * 0.38) * 0.6;
          const frontX = side * (9.2 + tier * 3.2 + contour);
          const backX = frontX + side * wallThick;

          // Upper ground terrace level and lower ground terrace level
          const lowerGroundY = hAt(frontX - side * 1.6, z);
          const upperGroundY = hAt(frontX, z);

          // Retaining wall face: rises from lower ground up to upper terrace lip
          const bottomY = lowerGroundY - 0.35;
          const topY = Math.max(upperGroundY + 0.18, lowerGroundY + 1.25);
          const topFrontX = frontX + side * ((topY - bottomY) * batter);
          const topBackX = backX + side * ((topY - bottomY) * batter);

          const bulge = Math.sin(t * Math.PI * 14) * 0.028;

          posList.push(
            frontX, bottomY, z,
            topFrontX + side * bulge, topY, z,
            topBackX, topY, z,
            backX, bottomY, z
          );

          const fnx = -side * Math.cos(batter);
          const fny = Math.sin(batter);
          normList.push(
            fnx, fny, 0,
            fnx, fny, 0,
            0, 1, 0,
            0, 1, 0
          );

          uvList.push(
            t * 10.0, 0.0,
            t * 10.0, 2.5,
            t * 10.0, 3.0,
            t * 10.0, 0.0
          );

          if (tier >= 2) {
            snowPosList.push(
              topFrontX + side * bulge - side * 0.06, topY + 0.02, z,
              topBackX + side * 0.06, topY + 0.10 + Math.sin(t * 8) * 0.03, z
            );
            snowNormList.push(0, 1, 0, 0, 1, 0);
            snowUvList.push(t * 5.0, 0, t * 5.0, 1);
          }
        }

        for (let i = 0; i < segs; i++) {
          const v0 = i * 4;
          const v1 = (i + 1) * 4;
          // Correct counter-clockwise winding facing inwards into valley
          if (side === 1) {
            idxList.push(v0, v0 + 1, v1, v1, v0 + 1, v1 + 1);
            idxList.push(v0 + 1, v0 + 2, v1 + 1, v1 + 1, v0 + 2, v1 + 2);
          } else {
            idxList.push(v0, v1, v0 + 1, v1, v1 + 1, v0 + 1);
            idxList.push(v0 + 1, v1 + 1, v0 + 2, v1 + 1, v1 + 2, v0 + 2);
          }

          if (tier >= 2) {
            const sv0 = i * 2;
            const sv1 = (i + 1) * 2;
            if (side === 1) {
              snowIdxList.push(sv0, sv0 + 1, sv1, sv1, sv0 + 1, sv1 + 1);
            } else {
              snowIdxList.push(sv0, sv1, sv0 + 1, sv1, sv1 + 1, sv0 + 1);
            }
          }
        }

        const wallGeo = new THREE.BufferGeometry();
        wallGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posList), 3));
        wallGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normList), 3));
        wallGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvList), 2));
        wallGeo.setIndex(idxList);
        wallGeo.computeVertexNormals();
        this.geometries.push(wallGeo);

        const wallMesh = new THREE.Mesh(wallGeo, materials.andesiteCut);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        this.group.add(wallMesh);

        if (tier >= 2) {
          const snowGeo = new THREE.BufferGeometry();
          snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(snowPosList), 3));
          snowGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(snowNormList), 3));
          snowGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(snowUvList), 2));
          snowGeo.setIndex(snowIdxList);
          snowGeo.computeVertexNormals();
          this.geometries.push(snowGeo);

          const snowMesh = new THREE.Mesh(snowGeo, snowMat);
          snowMesh.receiveShadow = true;
          this.group.add(snowMesh);
        }
      }
    }
  }

  /**
   * Builds an authentic Andean High-Sierra stone village (Kancha dwellings) with:
   * - Inward-battered stone walls (3.5-degree slope)
   * - Monolithic trapezoidal doorway on the long side wall (sheltered under the thatch eaves)
   * - Triangular stone gables (mojinetes) on the end walls with protruding stone tie-pegs (chakitakllas)
   * - Round timber ridgepole and purlins extending past the gables
   * - Combed golden-amber ichu thatch roof with deep eaves overhang, hanging fringe skirt,
   *   and wrapped ridge cap bundle (cumbrera)
   */
  private buildStoneVillage(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const thatchAlbedo = materials.highSierraPuna.map ? materials.highSierraPuna.map.clone() : null;
    if (thatchAlbedo) {
      thatchAlbedo.wrapS = THREE.RepeatWrapping;
      thatchAlbedo.wrapT = THREE.RepeatWrapping;
      thatchAlbedo.repeat.set(1.5, 2.0);
    }
    const thatchNormal = materials.woodBark.normalMap ? materials.woodBark.normalMap.clone() : null;
    if (thatchNormal) {
      thatchNormal.wrapS = THREE.RepeatWrapping;
      thatchNormal.wrapT = THREE.RepeatWrapping;
      thatchNormal.repeat.set(3.0, 8.0);
    }

    const thatchMat = new THREE.MeshStandardMaterial({
      name: 'AndeanIchuThatchCombed',
      color: new THREE.Color(0xffffff), // driven by rich vertex color gradient and maps
      map: thatchAlbedo,
      normalMap: thatchNormal,
      normalScale: new THREE.Vector2(1.5, 3.5),
      roughness: 0.95,
      metalness: 0.0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    applyNanoHexagonRelief(thatchMat, {
      scale: 64.0,
      reliefStrength: 0.38,
      grooveDepth: 0.24,
      hexTiling: false,
    });
    this.materials.push(thatchMat);

    const doorInteriorMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
    this.materials.push(doorInteriorMat);

    const houses = [
      { x: -6.8, z: -4.2, w: 4.4, d: 3.2, h: 2.75, rotY: 0.28 },
      { x: -7.6, z: -11.8, w: 4.4, d: 3.4, h: 2.85, rotY: 0.45 },
      { x: 6.8, z: -4.6, w: 4.4, d: 3.2, h: 2.75, rotY: -0.30 },
      { x: 7.5, z: -12.4, w: 4.4, d: 3.4, h: 2.85, rotY: -0.42 },
    ];

    const gableH = 1.85;
    const eavesOverhang = 0.42;

    for (let i = 0; i < houses.length; i++) {
      const hs = houses[i];
      const groundY = hAt(hs.x, hs.z);
      const houseGrp = new THREE.Group();
      houseGrp.position.set(hs.x, groundY - 0.15, hs.z);
      houseGrp.rotation.y = hs.rotY;

      // 1. Deep stone foundation plinth
      const plinthGeo = this.createWeatheredBlock(hs.w + 0.6, 1.4, hs.d + 0.6);
      this.geometries.push(plinthGeo);
      const plinth = new THREE.Mesh(plinthGeo, materials.fieldstoneRough);
      plinth.position.set(0, -0.45, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      houseGrp.add(plinth);

      // 2. Inward-battered stone dwelling walls
      const wallGeo = this.createBatteredHouseWallsGeometry(hs.w, hs.h, hs.d);
      this.geometries.push(wallGeo);
      const walls = new THREE.Mesh(wallGeo, materials.andesiteCut);
      walls.position.set(0, hs.h * 0.5, 0);
      walls.castShadow = true;
      walls.receiveShadow = true;
      houseGrp.add(walls);

      // 3. Monolithic trapezoidal doorway on the front wall (local +Z)
      const sillW = 1.05;
      const topW = 0.86;
      const doorH = 1.82;
      const doorThick = 0.35;

      const doorOpeningGeo = this.createTrapezoidalDoorGeometry(sillW, topW, doorH, doorThick);
      const lintelGeo = this.createWeatheredBlock(topW + 0.55, 0.28, 0.45);
      const doorBackdropGeo = new THREE.PlaneGeometry(sillW, doorH);
      this.geometries.push(doorOpeningGeo, lintelGeo, doorBackdropGeo);

      const doorMesh = new THREE.Mesh(doorOpeningGeo, materials.andesiteCut);
      doorMesh.position.set(0, 0, hs.d * 0.5 + 0.05);
      doorMesh.castShadow = true;
      doorMesh.receiveShadow = true;
      houseGrp.add(doorMesh);

      const lintel = new THREE.Mesh(lintelGeo, materials.andesiteCut);
      lintel.position.set(0, doorH + 0.14, hs.d * 0.5 + 0.05);
      lintel.castShadow = true;
      houseGrp.add(lintel);

      const doorBackdrop = new THREE.Mesh(doorBackdropGeo, doorInteriorMat);
      doorBackdrop.position.set(0, doorH * 0.5, hs.d * 0.5 - 0.08);
      houseGrp.add(doorBackdrop);

      // 4. Triangular stone gables (mojinetes) on the LEFT and RIGHT end walls (local ±X)
      const gableGeo = this.createGableTriangleGeometry(hs.d * 0.94, gableH, 0.32);
      const pegGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.28, 8);
      pegGeo.rotateZ(Math.PI * 0.5); // Oriented along local X
      this.geometries.push(gableGeo, pegGeo);

      for (let side = -1; side <= 1; side += 2) {
        const gable = new THREE.Mesh(gableGeo, materials.andesiteCut);
        gable.position.set(side * (hs.w * 0.46), hs.h, 0);
        gable.castShadow = true;
        gable.receiveShadow = true;
        houseGrp.add(gable);

        // 3 stone tie-pegs jutting out along X from the exterior gable face
        const pegOffsets = [
          [-hs.d * 0.25, hs.h + gableH * 0.32],
          [0.0, hs.h + gableH * 0.72],
          [hs.d * 0.25, hs.h + gableH * 0.32],
        ];
        for (const [pz, py] of pegOffsets) {
          const peg = new THREE.Mesh(pegGeo, materials.fieldstoneRough);
          peg.position.set(side * (hs.w * 0.46 + 0.16), py, pz);
          peg.castShadow = true;
          houseGrp.add(peg);
        }
      }

      // 5. Round timber rafters and ridgepole running along X and projecting past the gables
      const beamGeo = new THREE.CylinderGeometry(0.07, 0.075, hs.w + 1.2, 8);
      beamGeo.rotateZ(Math.PI * 0.5); // Oriented along local X
      this.geometries.push(beamGeo);

      const ridgePole = new THREE.Mesh(beamGeo, materials.woodAged);
      ridgePole.position.set(0, hs.h + gableH - 0.05, 0);
      ridgePole.castShadow = true;
      houseGrp.add(ridgePole);

      const purlinFront = new THREE.Mesh(beamGeo, materials.woodAged);
      purlinFront.position.set(0, hs.h + gableH * 0.48, hs.d * 0.26);
      purlinFront.castShadow = true;
      houseGrp.add(purlinFront);

      const purlinBack = new THREE.Mesh(beamGeo, materials.woodAged);
      purlinBack.position.set(0, hs.h + gableH * 0.48, -hs.d * 0.26);
      purlinBack.castShadow = true;
      houseGrp.add(purlinBack);

      // Protruding round timber rafter tails jutting out under the thatch eaves
      const rafterTailGeo = new THREE.CylinderGeometry(0.045, 0.048, 0.55, 6);
      rafterTailGeo.rotateX(Math.PI * 0.5);
      this.geometries.push(rafterTailGeo);
      for (let r = 0; r < 7; r++) {
        const rx = -hs.w * 0.45 + (r / 6) * hs.w * 0.9;
        const rafF = new THREE.Mesh(rafterTailGeo, materials.woodAged);
        rafF.position.set(rx, hs.h + 0.06, hs.d * 0.5 + eavesOverhang * 0.55);
        rafF.rotation.x = -0.35;
        rafF.castShadow = true;
        houseGrp.add(rafF);

        const rafB = new THREE.Mesh(rafterTailGeo, materials.woodAged);
        rafB.position.set(rx, hs.h + 0.06, -hs.d * 0.5 - eavesOverhang * 0.55);
        rafB.rotation.x = 0.35;
        rafB.castShadow = true;
        houseGrp.add(rafB);
      }

      // 6. Sculpted High-Altitude Combed Ichu Thatch Roof (true gabled form)
      const roofGeo = this.createAndeanGableRoofGeometry(hs.w, hs.d, gableH, eavesOverhang);
      this.geometries.push(roofGeo);
      const roof = new THREE.Mesh(roofGeo, thatchMat);
      roof.position.set(0, hs.h, 0);
      roof.castShadow = true;
      roof.receiveShadow = true;
      houseGrp.add(roof);

      // 7. Cylindrical bundled thatch ridge cap (cumbrera de paja) along the summit
      const ridgeCapGeo = new THREE.CylinderGeometry(0.12, 0.12, hs.w + 2 * eavesOverhang + 0.1, 12);
      ridgeCapGeo.rotateZ(Math.PI * 0.5);
      this.geometries.push(ridgeCapGeo);
      const ridgeCap = new THREE.Mesh(ridgeCapGeo, thatchMat);
      ridgeCap.position.set(0, hs.h + gableH + 0.08, 0);
      ridgeCap.castShadow = true;
      houseGrp.add(ridgeCap);

      // Braided ichu rope wraps securing the ridge cap
      const ropeWrapGeo = new THREE.TorusGeometry(0.13, 0.022, 8, 16);
      ropeWrapGeo.rotateY(Math.PI * 0.5);
      this.geometries.push(ropeWrapGeo);
      for (let rw = -2; rw <= 2; rw++) {
        const ropeWrap = new THREE.Mesh(ropeWrapGeo, materials.ropeBraided);
        ropeWrap.position.set(rw * (hs.w * 0.2), hs.h + gableH + 0.08, 0);
        ropeWrap.castShadow = true;
        houseGrp.add(ropeWrap);
      }

      // 8. Tambo life details: Carved stone storage bins & clay water urns
      const urnGeo = new THREE.CylinderGeometry(0.18, 0.09, 0.44, 12);
      this.geometries.push(urnGeo);
      const urn = new THREE.Mesh(urnGeo, materials.fieldstoneRough);
      urn.position.set(hs.w * 0.48 + 0.35, 0.22, hs.d * 0.5);
      urn.castShadow = true;
      houseGrp.add(urn);

      // Firewood bundle tied with braided ichu rope
      const logGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6);
      logGeo.rotateZ(Math.PI * 0.5);
      this.geometries.push(logGeo);
      for (let l = 0; l < 4; l++) {
        const log = new THREE.Mesh(logGeo, materials.woodAged);
        log.position.set(-hs.w * 0.48 - 0.3, 0.06 + l * 0.08, hs.d * 0.35 + (l % 2) * 0.05);
        log.castShadow = true;
        houseGrp.add(log);
      }

      this.group.add(houseGrp);
    }
  }

  /**
   * Builds the Glacial Snowline Ridges and an authentic crystal alpine tarn
   * (glacial cirque pool) in the northern pass beyond the Intihuatana.
   */
  private buildGlacialPassAndTarn(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const snowMat = new THREE.MeshStandardMaterial({
      name: 'GlacialSnowpackBright',
      color: new THREE.Color(5.2, 5.4, 5.8),
      map: materials.highSierraSnow.map,
      roughness: 0.52,
      metalness: 0.0,
    });
    this.materials.push(snowMat);

    // Sculpted non-degenerate snowdrifts along the northern pass & upper terraces
    const driftSpecs = [
      { x: -13.5, z: -18.5, w: 7.5, d: 6.5, h: 1.45 },
      { x: 13.5, z: -18.5, w: 7.5, d: 6.5, h: 1.45 },
      { x: -8.5, z: -24.5, w: 9.0, d: 7.0, h: 1.65 },
      { x: 8.5, z: -24.5, w: 9.0, d: 7.0, h: 1.65 },
      { x: 0.0, z: -27.5, w: 12.0, d: 7.5, h: 1.55 },
    ];

    for (let i = 0; i < driftSpecs.length; i++) {
      const s = driftSpecs[i];
      const geo = new THREE.PlaneGeometry(s.w, s.d, 12, 12);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const lx = pos.getX(v);
        const lz = pos.getZ(v);
        const nx = lx / (s.w * 0.5);
        const nz = lz / (s.d * 0.5);
        const dome = Math.max(0, 1.0 - (nx * nx + nz * nz));
        const wy = hAt(s.x + lx, s.z + lz) + dome * dome * s.h - 0.12;
        pos.setXYZ(v, s.x + lx, wy, s.z + lz);
      }
      geo.computeVertexNormals();
      this.geometries.push(geo);

      const mesh = new THREE.Mesh(geo, snowMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // High Alpine Glacial Tarn (Cirque Lake) at x = 0, z = -22.5
    const tarnRadius = 5.2;
    const tarnY = hAt(0, -22.5) + 0.12;
    const tarnGeo = new THREE.CircleGeometry(tarnRadius, 32);
    tarnGeo.rotateX(-Math.PI * 0.5);
    this.geometries.push(tarnGeo);

    const tarnMat = new THREE.MeshStandardMaterial({
      name: 'GlacialTarnWater',
      color: new THREE.Color(0x388ba8),
      roughness: 0.08,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    this.materials.push(tarnMat);

    const tarn = new THREE.Mesh(tarnGeo, tarnMat);
    tarn.position.set(0, tarnY, -22.5);
    tarn.receiveShadow = true;
    this.group.add(tarn);

    // Granite glacial moraine boulders ringing the tarn shoreline
    const boulderGeo = new THREE.DodecahedronGeometry(0.75, 1);
    this.geometries.push(boulderGeo);
    for (let b = 0; b < 14; b++) {
      const ang = (b / 14) * Math.PI * 2 + (b % 3) * 0.2;
      const bx = Math.cos(ang) * (tarnRadius + 0.45);
      const bz = -22.5 + Math.sin(ang) * (tarnRadius + 0.45);
      const by = hAt(bx, bz);

      const boulder = new THREE.Mesh(boulderGeo, materials.fieldstoneRough);
      boulder.position.set(bx, by + 0.25, bz);
      const sc = 0.65 + (b % 4) * 0.18;
      boulder.scale.set(sc * 1.3, sc * 0.75, sc);
      boulder.rotation.set((b % 3) * 0.4, b * 0.8, (b % 2) * 0.3);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.group.add(boulder);
    }
  }

  /**
   * Builds authentic conical Apacheta stone cairns composed of angular rock slabs,
   * natural repose angles, and a sacred white quartz mineral shard at the apex.
   */
  private buildApachetaCairns(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const cairnCoords: Array<[number, number]> = [
      [-2.8, 8.4],
      [3.6, 7.6],
      [-3.4, -3.5],
      [3.5, -3.8],
    ];

    const slabGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const smallSlabGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const quartzGeo = new THREE.DodecahedronGeometry(0.14, 0);
    this.geometries.push(slabGeo, smallSlabGeo, quartzGeo);

    // Weathered pale granitic apu offering stone for summit (Illa de roca sagrada)
    const quartzMat = new THREE.MeshStandardMaterial({
      name: 'AndeanSacredGraniteStone',
      color: new THREE.Color(0xb8b0a2),
      map: materials.fieldstoneRough.map,
      normalMap: materials.fieldstoneRough.normalMap,
      roughness: 0.86,
      metalness: 0.0,
    });
    this.materials.push(quartzMat);

    for (let c = 0; c < cairnCoords.length; c++) {
      const [cx, cz] = cairnCoords[c];
      const cy = hAt(cx, cz);

      // Layer 1 (Base): 12 angular rock slabs forming a broad circular mound of radius 0.85m
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + (i % 3) * 0.15;
        const rad = 0.65 + (i % 4) * 0.06;
        const rx = cx + Math.cos(ang) * rad;
        const rz = cz + Math.sin(ang) * rad;
        const ry = cy + 0.06 + (i % 2) * 0.04;

        const slab = new THREE.Mesh(slabGeo, (i + c) % 2 === 0 ? materials.fieldstoneRough : materials.andesiteCut);
        slab.position.set(rx, ry, rz);
        slab.scale.set(1.4 + (i % 3) * 0.3, 0.55 + (i % 2) * 0.2, 1.2 + (i % 4) * 0.2);
        slab.rotation.set((i % 4) * 0.2 - 0.3, ang + (i % 5) * 0.4, (i % 3) * 0.25 - 0.1);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
      }

      // Layer 2 (Mid-tier): 8 overlapping stones filling crevices and stepping inward (radius 0.48m)
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.35;
        const rad = 0.38 + (i % 3) * 0.06;
        const rx = cx + Math.cos(ang) * rad;
        const rz = cz + Math.sin(ang) * rad;
        const ry = cy + 0.24 + (i % 2) * 0.05;

        const slab = new THREE.Mesh(slabGeo, (i + c) % 2 === 1 ? materials.fieldstoneRough : materials.andesiteCut);
        slab.position.set(rx, ry, rz);
        slab.scale.set(1.2 + (i % 2) * 0.2, 0.65, 1.1 + (i % 3) * 0.2);
        slab.rotation.set((i % 3) * 0.3 - 0.15, ang + 0.8, (i % 2) * 0.3 - 0.15);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
      }

      // Layer 3 (Upper tier): 5 stones tapering to the summit (radius 0.24m)
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.7;
        const rad = 0.18 + (i % 2) * 0.04;
        const rx = cx + Math.cos(ang) * rad;
        const rz = cz + Math.sin(ang) * rad;
        const ry = cy + 0.44 + (i % 2) * 0.05;

        const slab = new THREE.Mesh(smallSlabGeo, materials.fieldstoneRough);
        slab.position.set(rx, ry, rz);
        slab.scale.set(1.1, 0.75, 1.0);
        slab.rotation.set((i % 2) * 0.25, ang + 1.2, (i % 3) * 0.2);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
      }

      // Layer 4 (Apex capstones): 2 support stones
      for (let i = 0; i < 2; i++) {
        const slab = new THREE.Mesh(smallSlabGeo, materials.andesiteCut);
        slab.position.set(cx + (i === 0 ? -0.06 : 0.06), cy + 0.62, cz + (i === 0 ? -0.04 : 0.04));
        slab.scale.set(0.9, 0.65, 0.85);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
      }

      // Sacred offering crown: Upright white quartz mineral crystal shard (Illa)
      const apexQuartz = new THREE.Mesh(quartzGeo, quartzMat);
      apexQuartz.position.set(cx, cy + 0.76, cz);
      apexQuartz.scale.set(0.85, 1.65, 0.75);
      apexQuartz.rotation.set(0.12, c * 1.4, -0.08);
      apexQuartz.castShadow = true;
      apexQuartz.receiveShadow = true;
      this.group.add(apexQuartz);
    }
  }

  /**
   * Builds tall cedar Saywa boundary poles with fluttering Quechua textile streamers
   * marking the mountain pass and trail crossing.
   */
  private buildSaywaBoundaryPoles(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const poleCoords: Array<[number, number]> = [
      [-2.6, 3.8],
      [2.7, 3.5],
      [-2.8, -1.8],
      [2.9, -1.5],
    ];

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 4.2, 10);
    const streamerGeo = new THREE.PlaneGeometry(0.28, 1.25, 4, 8);
    this.geometries.push(poleGeo, streamerGeo);

    const streamerMat = new THREE.MeshStandardMaterial({
      name: 'QuechuaSaywaStreamer',
      color: new THREE.Color(0xd43828),
      map: materials.clothQuechuaRed.map,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.materials.push(streamerMat);

    for (let p = 0; p < poleCoords.length; p++) {
      const [px, pz] = poleCoords[p];
      const py = hAt(px, pz);

      const pole = new THREE.Mesh(poleGeo, materials.woodAged);
      pole.position.set(px, py + 1.9, pz);
      pole.castShadow = true;
      pole.receiveShadow = true;
      this.group.add(pole);

      // Fluttering textile streamer attached near top of pole
      const streamer = new THREE.Mesh(streamerGeo, streamerMat);
      streamer.position.set(px + 0.16, py + 3.4, pz);
      streamer.rotation.y = Math.PI * 0.45;
      streamer.castShadow = true;
      this.group.add(streamer);
      this.streamerMeshes.push(streamer);
    }
  }

  /**
   * Builds an instanced field of 3D multi-blade golden Ichu bunchgrass tussocks.
   */
  private buildIchuGrassField(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const ichuGeo = this.createIchuTussockGeometry();
    this.geometries.push(ichuGeo);
    const ichuMat = new THREE.MeshStandardMaterial({
      name: 'HighSierraIchuGrass',
      color: new THREE.Color(0xd8bc72),
      map: materials.highSierraPuna.map,
      roughness: 0.86,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.materials.push(ichuMat);

    const maxIchu = 140;
    const ichuInst = new THREE.InstancedMesh(ichuGeo, ichuMat, maxIchu);
    ichuInst.castShadow = true;
    ichuInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let validIdx = 0;
    for (let i = 0; i < maxIchu * 2 && validIdx < maxIchu; i++) {
      const row = Math.floor(i / 14);
      const col = i % 14;
      const ix = -22.0 + col * 3.3 + Math.sin(i * 1.9) * 0.9;
      const iz = 11.0 - row * 2.6 + Math.cos(i * 2.3) * 0.8;
      if (Math.abs(ix) < 2.2 && iz > -14.0 && iz < 10.0) continue; // Keep paved road clear
      if (Math.abs(ix) > 4.8 && Math.abs(ix) < 9.8 && iz < -1.0 && iz > -15.0) continue; // Keep village clear
      if (Math.hypot(ix, iz - 12.0) < 5.5) continue; // Keep foreground camera lens clear
      const iy = hAt(ix, iz);
      dummy.position.set(ix, iy - 0.05, iz);
      dummy.rotation.set(((i % 3) - 1) * 0.06, i * 1.37, (((i + 1) % 3) - 1) * 0.06);
      const sc = 0.72 + (i % 5) * 0.18;
      dummy.scale.set(sc, sc * (0.95 + (i % 3) * 0.15), sc);
      dummy.updateMatrix();
      ichuInst.setMatrixAt(validIdx, dummy.matrix);
      validIdx++;
    }
    ichuInst.count = validIdx;
    ichuInst.instanceMatrix.needsUpdate = true;
    this.group.add(ichuInst);
  }

  /**
   * Builds an authentic inward-battered dwelling wall geometry (3.5-degree slope).
   */
  private createBatteredHouseWallsGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    return IncaMasonrySystem.createIncaPillowWallGeometry(w, h, d, {
      courses: Math.max(3, Math.round(h / 0.65)),
      stonesPerCourse: Math.max(3, Math.round(w / 0.85)),
      pillowBulge: 0.048,
      jointDepth: 0.024,
      batter: 0.12,
    });
  }

  /**
   * Creates an authentic trapezoidal doorway surround (wider at sill, narrower at lintel).
   */
  private createTrapezoidalDoorGeometry(
    sillW: number,
    topW: number,
    h: number,
    thick: number
  ): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(sillW + 0.45, h, thick, 2, 2, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      const normY = (vy + h * 0.5) / h;
      const spanW = sillW * (1.0 - normY) + topW * normY;
      const xFactor = spanW / sillW;

      pos.setXYZ(i, vx * xFactor, vy + h * 0.5, vz);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Creates a fitted stone triangular gable (mojinete) in the YZ plane with beveled stone edges.
   */
  private createGableTriangleGeometry(d: number, gableH: number, thick: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(-d * 0.5, 0);
    shape.lineTo(d * 0.5, 0);
    shape.lineTo(0, gableH);
    shape.closePath();

    const extrudeSettings = {
      depth: thick,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Orient so triangle is in YZ plane and extrudes along X
    geo.rotateY(Math.PI * 0.5);
    geo.translate(-thick * 0.5, 0, 0);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds an authentic volumetric combed Andean ichu thatch roof geometry
   * with vertical straw bundle fluting, continuous drainage slope, deep rounded eaves,
   * and thick gable verge trims.
   */
  private createAndeanGableRoofGeometry(
    w: number,
    d: number,
    gableH: number,
    overhang: number
  ): THREE.BufferGeometry {
    const posList: number[] = [];
    const normList: number[] = [];
    const uvList: number[] = [];
    const colList: number[] = [];
    const idxList: number[] = [];
    let vOffset = 0;

    const ow = w * 0.5 + overhang;
    const od = d * 0.5 + overhang;
    const ridgeY = gableH + 0.08;
    const eaveY = 0.0;
    const stepsSlope = 8;
    const stepsX = 16;
    const eaveThick = 0.28;

    const addQuad = (
      p0: [number, number, number],
      p1: [number, number, number],
      p2: [number, number, number],
      p3: [number, number, number],
      n: [number, number, number],
      u0: number, v0: number, u1: number, v1: number,
      c0: [number, number, number] = [0.85, 0.68, 0.38],
      c1: [number, number, number] = [0.85, 0.68, 0.38],
      c2: [number, number, number] = [0.85, 0.68, 0.38],
      c3: [number, number, number] = [0.85, 0.68, 0.38]
    ) => {
      posList.push(
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
      );
      normList.push(
        n[0], n[1], n[2],
        n[0], n[1], n[2],
        n[0], n[1], n[2],
        n[0], n[1], n[2]
      );
      uvList.push(u0, v0, u1, v0, u1, v1, u0, v1);
      colList.push(
        c0[0], c0[1], c0[2],
        c1[0], c1[1], c1[2],
        c2[0], c2[1], c2[2],
        c3[0], c3[1], c3[2]
      );
      idxList.push(vOffset, vOffset + 1, vOffset + 2, vOffset, vOffset + 2, vOffset + 3);
      vOffset += 4;
    };

    const strawCol = (ts: number, x: number): [number, number, number] => {
      // Authentic aged Andean ichu bunchgrass: natural bundles with subtle sun-bleached fluting
      const bundleGrain = 0.94 + 0.06 * Math.sin(x * 22.0);
      const agingNoise = 0.92 + 0.16 * Math.abs(Math.sin(x * 6.5 + ts * 4.2));
      const flute = bundleGrain * agingNoise;
      if (ts < 0.25) {
        // Sun-bleached tawny upper thatch & ridge cap
        return [0.46 * flute, 0.40 * flute, 0.30 * flute];
      } else if (ts < 0.75) {
        // Mid-slope weathered golden-amber grass
        return [0.41 * flute, 0.35 * flute, 0.26 * flute];
      } else {
        // Lower eaves shadow and weathered aged straw
        return [0.33 * flute, 0.28 * flute, 0.21 * flute];
      }
    };

    // Build combed vertical straw thatch slopes on Front (+Z) and Back (-Z)
    for (let side = -1; side <= 1; side += 2) {
      for (let is = 0; is < stepsSlope; is++) {
        const ts0 = is / stepsSlope;
        const ts1 = (is + 1) / stepsSlope;

        // Graceful natural straw curve: gentle flare at the eaves for water shedding
        const sag0 = Math.sin(ts0 * Math.PI) * -0.045;
        const sag1 = Math.sin(ts1 * Math.PI) * -0.045;
        const y0 = ridgeY * (1.0 - ts0) + eaveY * ts0 + sag0;
        const y1 = ridgeY * (1.0 - ts1) + eaveY * ts1 + sag1;
        const z0 = side * (ts0 * od);
        const z1 = side * (ts1 * od);

        const dy = y1 - y0;
        const dz = z1 - z0;
        const len = Math.hypot(dy, dz);
        const snY = Math.abs(dz) / len;
        const snZ = (side * -dy) / len;

        for (let ix = 0; ix < stepsX; ix++) {
          const tx0 = (ix / stepsX) * 2 - 1;
          const tx1 = ((ix + 1) / stepsX) * 2 - 1;
          const x0 = tx0 * ow;
          const x1 = tx1 * ow;

          // Vertical combed straw bundle fluting along the slope
          const flute0 = Math.sin(x0 * 18.0) * 0.018 + Math.cos(x0 * 36.0) * 0.008;
          const flute1 = Math.sin(x1 * 18.0) * 0.018 + Math.cos(x1 * 36.0) * 0.008;

          if (side === 1) {
            const col0 = strawCol(ts1, x0);
            const col1 = strawCol(ts1, x1);
            const col2 = strawCol(ts0, x1);
            const col3 = strawCol(ts0, x0);
            addQuad(
              [x0, y1 + flute0, z1],
              [x1, y1 + flute1, z1],
              [x1, y0 + flute1, z0],
              [x0, y0 + flute0, z0],
              [0, snY, snZ],
              ix / stepsX, ts1 * 3.0, (ix + 1) / stepsX, ts0 * 3.0,
              col0, col1, col2, col3
            );
          } else {
            const col0 = strawCol(ts1, x1);
            const col1 = strawCol(ts1, x0);
            const col2 = strawCol(ts0, x0);
            const col3 = strawCol(ts0, x1);
            addQuad(
              [x1, y1 + flute1, z1],
              [x0, y1 + flute0, z1],
              [x0, y0 + flute0, z0],
              [x1, y0 + flute1, z0],
              [0, snY, snZ],
              (ix + 1) / stepsX, ts1 * 3.0, ix / stepsX, ts0 * 3.0,
              col0, col1, col2, col3
            );
          }
        }
      }

      // Rounded volumetric eave overhang lip curling downward
      const eaveZ = side * od;
      const eaveFaceCol: [number, number, number] = [0.34, 0.29, 0.22];
      const eaveUnderCol: [number, number, number] = [0.18, 0.15, 0.11];
      for (let ix = 0; ix < stepsX; ix++) {
        const tx0 = (ix / stepsX) * 2 - 1;
        const tx1 = ((ix + 1) / stepsX) * 2 - 1;
        const x0 = tx0 * ow;
        const x1 = tx1 * ow;

        if (side === 1) {
          // Front eave vertical face
          addQuad(
            [x0, eaveY - eaveThick, eaveZ],
            [x1, eaveY - eaveThick, eaveZ],
            [x1, eaveY, eaveZ],
            [x0, eaveY, eaveZ],
            [0, 0, 1],
            ix / stepsX, 0, (ix + 1) / stepsX, 0.4,
            eaveFaceCol, eaveFaceCol, eaveFaceCol, eaveFaceCol
          );
          // Eave underside returning toward wall
          addQuad(
            [x0, eaveY - eaveThick, eaveZ],
            [x0, eaveY - eaveThick * 0.3, eaveZ - 0.35],
            [x1, eaveY - eaveThick * 0.3, eaveZ - 0.35],
            [x1, eaveY - eaveThick, eaveZ],
            [0, -1, 0],
            ix / stepsX, 0, (ix + 1) / stepsX, 0.3,
            eaveUnderCol, eaveUnderCol, eaveUnderCol, eaveUnderCol
          );
        } else {
          // Back eave vertical face
          addQuad(
            [x1, eaveY - eaveThick, eaveZ],
            [x0, eaveY - eaveThick, eaveZ],
            [x0, eaveY, eaveZ],
            [x1, eaveY, eaveZ],
            [0, 0, -1],
            (ix + 1) / stepsX, 0, ix / stepsX, 0.4,
            eaveFaceCol, eaveFaceCol, eaveFaceCol, eaveFaceCol
          );
          // Back eave underside
          addQuad(
            [x1, eaveY - eaveThick, eaveZ],
            [x1, eaveY - eaveThick * 0.3, eaveZ + 0.35],
            [x0, eaveY - eaveThick * 0.3, eaveZ + 0.35],
            [x0, eaveY - eaveThick, eaveZ],
            [0, -1, 0],
            (ix + 1) / stepsX, 0, ix / stepsX, 0.3,
            eaveUnderCol, eaveUnderCol, eaveUnderCol, eaveUnderCol
          );
        }
      }
    }

    // 3D Gable verge edge faces closing the left (-X) and right (+X) ends
    const vergeCol: [number, number, number] = [0.38, 0.32, 0.24];
    for (let end = -1; end <= 1; end += 2) {
      const vx = end * ow;
      const normalX = end;

      // Front slope verge (+Z)
      for (let is = 0; is < stepsSlope; is++) {
        const ts0 = is / stepsSlope;
        const ts1 = (is + 1) / stepsSlope;
        const y0 = ridgeY * (1.0 - ts0) + eaveY * ts0;
        const y1 = ridgeY * (1.0 - ts1) + eaveY * ts1;
        const z0 = ts0 * od;
        const z1 = ts1 * od;

        if (end === 1) {
          addQuad(
            [vx, y0, z0],
            [vx, y1, z1],
            [vx, y1 - eaveThick, z1],
            [vx, y0 - eaveThick, z0],
            [normalX, 0, 0],
            ts0, 0, ts1, 0.4,
            vergeCol, vergeCol, vergeCol, vergeCol
          );
        } else {
          addQuad(
            [vx, y1, z1],
            [vx, y0, z0],
            [vx, y0 - eaveThick, z0],
            [vx, y1 - eaveThick, z1],
            [normalX, 0, 0],
            ts0, 0, ts1, 0.4,
            vergeCol, vergeCol, vergeCol, vergeCol
          );
        }
      }

      // Back slope verge (-Z)
      for (let is = 0; is < stepsSlope; is++) {
        const ts0 = is / stepsSlope;
        const ts1 = (is + 1) / stepsSlope;
        const y0 = ridgeY * (1.0 - ts0) + eaveY * ts0;
        const y1 = ridgeY * (1.0 - ts1) + eaveY * ts1;
        const z0 = -ts0 * od;
        const z1 = -ts1 * od;

        if (end === 1) {
          addQuad(
            [vx, y1, z1],
            [vx, y0, z0],
            [vx, y0 - eaveThick, z0],
            [vx, y1 - eaveThick, z1],
            [normalX, 0, 0],
            ts0, 0, ts1, 0.4,
            vergeCol, vergeCol, vergeCol, vergeCol
          );
        } else {
          addQuad(
            [vx, y0, z0],
            [vx, y1, z1],
            [vx, y1 - eaveThick, z1],
            [vx, y0 - eaveThick, z0],
            [normalX, 0, 0],
            ts0, 0, ts1, 0.4,
            vergeCol, vergeCol, vergeCol, vergeCol
          );
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posList), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normList), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvList), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colList), 3));
    geo.setIndex(idxList);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds a weathered stone block with chipped edges and subtle batter.
   */
  private createWeatheredBlock(w: number, h: number, d: number): THREE.BufferGeometry {
    return IncaMasonrySystem.createIncaPillowWallGeometry(w, h, d, {
      courses: Math.max(2, Math.round(h / 0.65)),
      stonesPerCourse: Math.max(3, Math.round(w / 0.85)),
      pillowBulge: 0.045,
      jointDepth: 0.022,
      batter: 0.08,
    });
  }

  /**
   * Builds a true 3D multi-blade golden Ichu bunchgrass tussock from 12 radiating arched blades.
   */
  private createIchuTussockGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const bladeCount = 12;
    const segs = 4;
    let vOff = 0;

    for (let b = 0; b < bladeCount; b++) {
      const ang = (b / bladeCount) * Math.PI * 2 + (b % 3) * 0.19;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const px = -sinA;
      const pz = cosA;
      const reach = 0.28 + (b % 3) * 0.11;
      const height = 0.48 + ((b + 1) % 3) * 0.14;

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const r = 0.02 + t * reach;
        const y = Math.sin(t * Math.PI * 0.68) * height;
        const hw = (1.0 - t * 0.85) * 0.045;
        const cx = cosA * r;
        const cz = sinA * r;

        positions.push(
          cx - px * hw, y, cz - pz * hw,
          cx + px * hw, y, cz + pz * hw
        );
        uvs.push(0, t, 1, t);
      }

      for (let s = 0; s < segs; s++) {
        const a = vOff + s * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      vOff += (segs + 1) * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.computeVertexNormals();
    return geo;
  }

  public setSolarAligned(aligned: boolean): void {
    this.solarAligned = aligned;
  }

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.elapsedSec += dt;

    if (this.solarMirrorMesh) {
      if (this.solarAligned) {
        // Lock mirror heading onto the gnomon bearing vector
        const targetAngle = -2.97;
        this.solarMirrorMesh.rotation.y = THREE.MathUtils.lerp(
          this.solarMirrorMesh.rotation.y,
          targetAngle,
          Math.min(1.0, dt * 3.5)
        );
        if (this.solarBeamMat) {
          const pulse = 0.65 + Math.sin(this.elapsedSec * 4.5) * 0.15;
          this.solarBeamMat.opacity = THREE.MathUtils.lerp(this.solarBeamMat.opacity, pulse, dt * 4.0);
        }
        if (this.gnomonFlareMat) {
          const flarePulse = 0.75 + Math.sin(this.elapsedSec * 6.0) * 0.2;
          this.gnomonFlareMat.opacity = THREE.MathUtils.lerp(this.gnomonFlareMat.opacity, flarePulse, dt * 4.0);
        }
      } else {
        this.solarMirrorMesh.rotation.y = Math.sin(this.elapsedSec * 0.5) * 0.25;
        if (this.solarBeamMat) this.solarBeamMat.opacity = 0;
        if (this.gnomonFlareMat) this.gnomonFlareMat.opacity = 0;
      }
    }

    // Subtle alpine wind sway on the Quechua saywa textile streamers
    for (let i = 0; i < this.streamerMeshes.length; i++) {
      const st = this.streamerMeshes[i];
      const windWave = Math.sin(this.elapsedSec * 3.8 + i * 1.7) * 0.18;
      st.rotation.z = windWave;
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
    this.streamerMeshes.length = 0;
    this.interactables.length = 0;
    this.group.removeFromParent();
  }
}
