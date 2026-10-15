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
import { InteractableTarget } from './cloudForest';

export class HighSierraRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  private solarMirrorMesh: THREE.Object3D | null = null;
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

    // Paved flagstone causeway running from z = 9.6 to z = -6.0
    const startZ = 9.6;
    const endZ = -6.0;
    const rows = 26;
    const roadWidth = 2.4;

    for (let r = 0; r < rows; r++) {
      const tz = r / (rows - 1);
      const rz = startZ + tz * (endZ - startZ);
      const cols = 4;
      for (let c = 0; c < cols; c++) {
        const tx = (c / (cols - 1)) * 2 - 1;
        const rx = tx * (roadWidth * 0.42) + Math.sin(r * 2.1 + c * 1.7) * 0.06;
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

    // Border curb stones (albarradas) along left and right edges
    const curbSteps = 14;
    for (let i = 0; i < curbSteps; i++) {
      const cz = startZ - (i * (startZ - endZ)) / curbSteps - 0.5;
      const leftY = hAt(-1.35, cz);
      const rightY = hAt(1.35, cz);

      const curbL = new THREE.Mesh(curbGeo, materials.fieldstoneRough);
      curbL.position.set(-1.35, leftY + 0.08, cz);
      curbL.rotation.y = ((i % 3) - 1) * 0.04;
      curbL.receiveShadow = true;
      roadGroup.add(curbL);

      const curbR = new THREE.Mesh(curbGeo, materials.fieldstoneRough);
      curbR.position.set(1.35, rightY + 0.08, cz);
      curbR.rotation.y = ((i % 3) - 1) * -0.04;
      curbR.receiveShadow = true;
      roadGroup.add(curbR);
    }

    // Transverse stone drainage gutters (cunetas) with carved runnels
    const gutterZs = [4.5, 0.0, -4.0];
    for (const gz of gutterZs) {
      const gy = hAt(0, gz);
      const gutter = new THREE.Mesh(gutterGeo, materials.andesiteCut);
      gutter.position.set(0, gy + 0.02, gz);
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
    const tier2Geo = this.createWeatheredBlock(5.4, 0.85, 5.0);
    const altarBaseGeo = this.createWeatheredBlock(2.8, 0.65, 2.8);
    const altarStep2Geo = this.createWeatheredBlock(2.2, 0.55, 2.2);
    const altarTopGeo = this.createWeatheredBlock(1.5, 0.45, 1.5);
    this.geometries.push(baseGeo, tier1Geo, tier2Geo, altarBaseGeo, altarStep2Geo, altarTopGeo);

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

    // Upper platform terrace
    const tier2 = new THREE.Mesh(tier2Geo, materials.andesiteCut);
    tier2.position.set(0, obsY + 1.22, obsZ - 0.2);
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    complex.add(tier2);

    // Stepped Chakana Altar (3 cosmic levels: Uku, Kay, Hanan Pacha)
    const altar1 = new THREE.Mesh(altarBaseGeo, materials.andesiteCut);
    altar1.position.set(0, obsY + 1.95, obsZ - 0.3);
    altar1.castShadow = true;
    altar1.receiveShadow = true;
    complex.add(altar1);

    const altar2 = new THREE.Mesh(altarStep2Geo, materials.andesiteCut);
    altar2.position.set(0, obsY + 2.48, obsZ - 0.3);
    altar2.castShadow = true;
    altar2.receiveShadow = true;
    complex.add(altar2);

    const altar3 = new THREE.Mesh(altarTopGeo, materials.andesiteCut);
    altar3.position.set(0, obsY + 2.92, obsZ - 0.3);
    altar3.castShadow = true;
    altar3.receiveShadow = true;
    complex.add(altar3);

    // Intihuatana Gnomon: Faceted polygonal monolith pillar with angled celestial bevel apex
    const gnomonGeo = this.createIntihuatanaGnomonGeometry();
    this.geometries.push(gnomonGeo);
    const gnomon = new THREE.Mesh(gnomonGeo, materials.andesiteCut);
    gnomon.position.set(0, obsY + 3.15, obsZ - 0.3);
    gnomon.castShadow = true;
    gnomon.receiveShadow = true;
    complex.add(gnomon);

    // Ceremonial Golden Qero (chicha beaker) on the sacred altar ledge
    const qeroGeo = new THREE.CylinderGeometry(0.09, 0.06, 0.22, 12);
    this.geometries.push(qeroGeo);
    const qero = new THREE.Mesh(qeroGeo, materials.goldOrnamental);
    qero.position.set(0.65, obsY + 2.38, obsZ + 0.5);
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
    const mirX = 1.65;
    const mirZ = 6.2;
    const mirY = hAt(mirX, mirZ);

    // Sculpted stone pedestal with stepped Chakana profile
    const pedBaseGeo = this.createWeatheredBlock(0.92, 0.45, 0.92);
    const pedColGeo = this.createWeatheredBlock(0.68, 0.78, 0.68);
    const pedCapGeo = this.createWeatheredBlock(0.82, 0.24, 0.82);
    const forkGeo = new THREE.TorusGeometry(0.56, 0.055, 14, 28, Math.PI);
    forkGeo.rotateZ(Math.PI);
    this.geometries.push(pedBaseGeo, pedColGeo, pedCapGeo, forkGeo);

    const pedGroup = new THREE.Group();
    pedGroup.position.set(mirX, mirY, mirZ);

    const pb = new THREE.Mesh(pedBaseGeo, materials.andesiteCut);
    pb.position.set(0, 0.22, 0);
    pb.castShadow = true;
    pb.receiveShadow = true;
    pedGroup.add(pb);

    const pc = new THREE.Mesh(pedColGeo, materials.andesiteCut);
    pc.position.set(0, 0.82, 0);
    pc.castShadow = true;
    pc.receiveShadow = true;
    pedGroup.add(pc);

    const pcap = new THREE.Mesh(pedCapGeo, materials.andesiteCut);
    pcap.position.set(0, 1.32, 0);
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
    const segLen = 4.2;
    const wallGeo = this.createWeatheredBlock(0.95, 2.35, segLen);
    const snowCapGeo = new THREE.BoxGeometry(1.15, 0.22, segLen);
    this.geometries.push(wallGeo, snowCapGeo);

    const snowMat = new THREE.MeshStandardMaterial({
      name: 'AndenesSnowLedge',
      color: new THREE.Color(5.2, 5.4, 5.8),
      map: materials.highSierraSnow.map,
      roughness: 0.55,
      metalness: 0.0,
    });
    this.materials.push(snowMat);

    for (let side = -1; side <= 1; side += 2) {
      for (let tier = 0; tier < 4; tier++) {
        const wallX = side * (10.2 + tier * 3.4);
        for (let s = 0; s < 8; s++) {
          const zSeg = 8.0 - s * 4.0;
          const baseY = hAt(wallX, zSeg);

          const wall = new THREE.Mesh(wallGeo, materials.andesiteCut);
          wall.position.set(wallX, baseY + 0.15, zSeg);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.group.add(wall);

          if (tier >= 2) {
            const cap = new THREE.Mesh(snowCapGeo, snowMat);
            cap.position.set(wallX + side * 0.2, baseY + 1.32, zSeg);
            cap.receiveShadow = true;
            this.group.add(cap);
          }
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
    // Combed golden-amber ichu straw thatch material using fine furrowed bark normal map
    const thatchMat = new THREE.MeshStandardMaterial({
      name: 'AndeanIchuThatchCombed',
      color: new THREE.Color(0x7e5c30), // rich weathered Andean golden-bronze ichu straw
      map: materials.ropeBraided.map,
      normalMap: materials.woodBark.normalMap,
      normalScale: new THREE.Vector2(0.85, 1.45),
      roughness: 0.94,
      metalness: 0.0,
      side: THREE.DoubleSide,
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

    const gableH = 1.35;
    const eavesOverhang = 0.32;

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
   * Builds stacked Apacheta stone cairns flanking the high-altitude stone road.
   */
  private buildApachetaCairns(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const cairnCoords: Array<[number, number]> = [
      [-2.8, 8.4],
      [2.9, 8.2],
      [-3.4, -3.5],
      [3.5, -3.8],
    ];
    const stoneGeo = new THREE.DodecahedronGeometry(0.36, 1);
    const capStoneGeo = new THREE.DodecahedronGeometry(0.18, 1);
    this.geometries.push(stoneGeo, capStoneGeo);

    for (let c = 0; c < cairnCoords.length; c++) {
      const [cx, cz] = cairnCoords[c];
      const cy = hAt(cx, cz);
      for (let s = 0; s < 5; s++) {
        const scale = 1.0 - s * 0.15;
        const st = new THREE.Mesh(stoneGeo, materials.fieldstoneRough);
        st.position.set(cx + Math.sin(s * 2.1) * 0.04, cy + s * 0.26 + 0.14, cz);
        st.scale.set(scale * 1.2, scale * 0.72, scale * 1.1);
        st.rotation.y = s * 1.1;
        st.castShadow = true;
        st.receiveShadow = true;
        this.group.add(st);
      }
      // Top offering stone: traditional Andean white quartz placed on cairn summit
      const topStone = new THREE.Mesh(capStoneGeo, materials.andesiteCut);
      topStone.position.set(cx, cy + 5 * 0.26 + 0.12, cz);
      topStone.scale.set(0.9, 0.7, 0.9);
      topStone.castShadow = true;
      topStone.receiveShadow = true;
      this.group.add(topStone);
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
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const batter = 0.14; // Inward taper towards the top

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      const normY = (vy + h * 0.5) / h;
      const taper = 1.0 - normY * batter;
      const chip = Math.sin(vx * 4.2 + vy * 5.8 + vz * 4.9) * 0.022;

      pos.setXYZ(i, vx * taper + chip, vy + h * 0.5 + chip * 0.5, vz * taper + chip);
    }
    geo.computeVertexNormals();
    return geo;
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
   * Builds an authentic dual-pitch gabled combed Andean ichu thatch roof geometry
   * with deep eaves overhang, hanging fringe skirts, and gable verge overhangs.
   */
  private createAndeanGableRoofGeometry(
    w: number,
    d: number,
    gableH: number,
    overhang: number
  ): THREE.BufferGeometry {
    const posList: number[] = [];
    const uvList: number[] = [];
    const idxList: number[] = [];
    let vOffset = 0;

    const ow = w * 0.5 + overhang;
    const od = d * 0.5 + overhang;
    const ridgeY = gableH + 0.06;
    const eaveY = 0.0;
    const thickness = 0.16;

    const addQuad = (
      p0: [number, number, number],
      p1: [number, number, number],
      p2: [number, number, number],
      p3: [number, number, number],
      uScale: number = 1.0,
      vScale: number = 1.0
    ) => {
      posList.push(
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
      );
      uvList.push(0, 0, uScale, 0, uScale, vScale, 0, vScale);
      idxList.push(vOffset, vOffset + 1, vOffset + 2, vOffset, vOffset + 2, vOffset + 3);
      vOffset += 4;
    };

    const stepsX = 8;
    const stepsSlope = 5;

    // 1. Front roof slope (+Z)
    for (let is = 0; is < stepsSlope; is++) {
      const ts0 = is / stepsSlope;
      const ts1 = (is + 1) / stepsSlope;

      const y0 = ridgeY * (1 - ts0) + eaveY * ts0 + Math.sin(ts0 * Math.PI) * -0.04;
      const y1 = ridgeY * (1 - ts1) + eaveY * ts1 + Math.sin(ts1 * Math.PI) * -0.04;
      const z0 = ts0 * od;
      const z1 = ts1 * od;

      for (let ix = 0; ix < stepsX; ix++) {
        const tx0 = (ix / stepsX) * 2 - 1;
        const tx1 = ((ix + 1) / stepsX) * 2 - 1;
        const x0 = tx0 * ow;
        const x1 = tx1 * ow;

        addQuad(
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y0, z0],
          [x0, y0, z0],
          1.0, 1.0
        );
      }
    }

    // 2. Back roof slope (-Z)
    for (let is = 0; is < stepsSlope; is++) {
      const ts0 = is / stepsSlope;
      const ts1 = (is + 1) / stepsSlope;

      const y0 = ridgeY * (1 - ts0) + eaveY * ts0 + Math.sin(ts0 * Math.PI) * -0.04;
      const y1 = ridgeY * (1 - ts1) + eaveY * ts1 + Math.sin(ts1 * Math.PI) * -0.04;
      const z0 = -ts0 * od;
      const z1 = -ts1 * od;

      for (let ix = 0; ix < stepsX; ix++) {
        const tx0 = (ix / stepsX) * 2 - 1;
        const tx1 = ((ix + 1) / stepsX) * 2 - 1;
        const x0 = tx0 * ow;
        const x1 = tx1 * ow;

        addQuad(
          [x1, y1, z1],
          [x0, y1, z1],
          [x0, y0, z0],
          [x1, y0, z0],
          1.0, 1.0
        );
      }
    }

    // 3. Front eave hanging fringe skirt
    for (let ix = 0; ix < stepsX; ix++) {
      const tx0 = (ix / stepsX) * 2 - 1;
      const tx1 = ((ix + 1) / stepsX) * 2 - 1;
      const x0 = tx0 * ow;
      const x1 = tx1 * ow;
      addQuad(
        [x0, eaveY - thickness, od],
        [x1, eaveY - thickness, od],
        [x1, eaveY, od],
        [x0, eaveY, od],
        1.0, 0.4
      );
    }

    // 4. Back eave hanging fringe skirt
    for (let ix = 0; ix < stepsX; ix++) {
      const tx0 = (ix / stepsX) * 2 - 1;
      const tx1 = ((ix + 1) / stepsX) * 2 - 1;
      const x0 = tx0 * ow;
      const x1 = tx1 * ow;
      addQuad(
        [x1, eaveY - thickness, -od],
        [x0, eaveY - thickness, -od],
        [x0, eaveY, -od],
        [x1, eaveY, -od],
        1.0, 0.4
      );
    }

    // 5. Left and Right gable verge hanging skirts
    addQuad(
      [-ow, eaveY - thickness, od],
      [-ow, eaveY, od],
      [-ow, ridgeY, 0],
      [-ow, ridgeY - thickness, 0],
      0.8, 0.5
    );
    addQuad(
      [-ow, ridgeY - thickness, 0],
      [-ow, ridgeY, 0],
      [-ow, eaveY, -od],
      [-ow, eaveY - thickness, -od],
      0.8, 0.5
    );

    addQuad(
      [ow, eaveY, od],
      [ow, eaveY - thickness, od],
      [ow, ridgeY - thickness, 0],
      [ow, ridgeY, 0],
      0.8, 0.5
    );
    addQuad(
      [ow, ridgeY, 0],
      [ow, ridgeY - thickness, 0],
      [ow, eaveY - thickness, -od],
      [ow, eaveY, -od],
      0.8, 0.5
    );

    const geo = new THREE.BufferGeometry();
    geo.setIndex(idxList);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posList), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvList), 2));
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds a weathered stone block with chipped edges and subtle batter.
   */
  private createWeatheredBlock(w: number, h: number, d: number): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const normY = (vy + h * 0.5) / h;
      const batter = 1.0 - normY * 0.08;
      const chip = Math.sin(vx * 4.7 + vy * 6.3 + vz * 5.1) * 0.022;
      pos.setXYZ(i, vx * batter + chip, vy + chip * 0.5, vz * batter + chip);
    }
    geo.computeVertexNormals();
    return geo;
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

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.elapsedSec += dt;
    if (this.solarMirrorMesh) {
      this.solarMirrorMesh.rotation.y = Math.sin(this.elapsedSec * 0.5) * 0.25;
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
