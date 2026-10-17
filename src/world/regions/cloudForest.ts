import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';

export class CloudForestRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();

  private mirrorHead?: THREE.Group;
  private sunBeamGroup?: THREE.Group;
  private steleChakanaMat?: THREE.MeshStandardMaterial;
  private fireLight?: THREE.PointLight;
  private flameMeshes: THREE.Mesh[] = [];
  private sparkMeshes: THREE.Mesh[] = [];
  private waterfallStrips: THREE.Mesh[] = [];
  private mistPlumes: THREE.Mesh[] = [];
  private mirrorAligned = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_CloudForest';
    scene.add(this.group);

    // Authentic Andean PBR Stone & Timber Materials (world-space UV ready)
    const stoneDiff = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_diff.jpg');
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;

    const stoneNor = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_nor.jpg');
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;

    const stoneArm = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_arm.jpg');
    stoneArm.wrapS = stoneArm.wrapT = THREE.RepeatWrapping;

    const ashlarStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughnessMap: stoneArm,
        metalness: 0.04,
        roughness: 0.82,
        color: 0x8f8879,
      })
    );

    const plankDiff = this.texLoader.load('/juzu/assets/environment-textures/environment-planks.jpeg');
    plankDiff.wrapS = plankDiff.wrapT = THREE.RepeatWrapping;
    plankDiff.repeat.set(1.5, 0.5);

    const plankNor = this.texLoader.load('/juzu/assets/environment-textures/environment-planks-normal.jpg');
    plankNor.wrapS = plankNor.wrapT = THREE.RepeatWrapping;
    plankNor.repeat.set(1.5, 0.5);

    const timberPlankMat = solid(
      new THREE.MeshStandardMaterial({
        map: plankDiff,
        normalMap: plankNor,
        normalScale: new THREE.Vector2(0.9, 0.9),
        color: 0x5c4633,
        roughness: 0.86,
        metalness: 0.02,
      })
    );

    const paveDiff = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_diff.jpg');
    paveDiff.wrapS = paveDiff.wrapT = THREE.RepeatWrapping;

    const paveNor = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_nor.jpg');
    paveNor.wrapS = paveNor.wrapT = THREE.RepeatWrapping;

    const redPavementMat = solid(
      new THREE.MeshStandardMaterial({
        map: paveDiff,
        normalMap: paveNor,
        normalScale: new THREE.Vector2(0.95, 0.95),
        color: 0x8e6f5a,
        roughness: 0.82,
        metalness: 0.03,
      })
    );

    this.buildHangingBridge(timberPlankMat, ashlarStoneMat);
    this.buildIntiSunMirror(ashlarStoneMat, redPavementMat);
    this.buildNorthSanctuaryAndStele(ashlarStoneMat, redPavementMat);
    this.buildCanyonTerraceRuins(ashlarStoneMat);
    this.buildExpeditionBaseCamp(ashlarStoneMat, timberPlankMat);
    this.buildGorgeWaterfall(ashlarStoneMat);
  }

  public alignSunMirror(): void {
    this.mirrorAligned = true;
    if (this.mirrorHead) {
      this.mirrorHead.rotation.y = -0.09;
      this.mirrorHead.rotation.x = -0.04;
    }
    if (this.sunBeamGroup) {
      this.sunBeamGroup.visible = true;
    }
    if (this.steleChakanaMat) {
      this.steleChakanaMat.emissive.setHex(0xd49b24);
      this.steleChakanaMat.emissiveIntensity = 0.65;
    }
  }

  public update(time: number): void {
    if (this.fireLight) {
      this.fireLight.intensity = 2.6 + Math.sin(time * 11.3) * 0.42 + Math.cos(time * 17.7) * 0.22;
    }
    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      f.scale.y = 0.82 + Math.sin(time * 14 + i * 2.1) * 0.26;
      f.scale.x = 0.92 + Math.cos(time * 11 + i * 1.7) * 0.14;
      f.rotation.y = time * 2.2 + i * 1.1;
    }
    for (let i = 0; i < this.sparkMeshes.length; i++) {
      const s = this.sparkMeshes[i];
      const cycle = (time * (0.75 + i * 0.12) + i * 0.37) % 1.0;
      s.position.y = 0.22 + cycle * 1.35;
      s.position.x = Math.sin(time * 3.5 + i * 2.0) * (0.08 + cycle * 0.18);
      s.position.z = Math.cos(time * 3.1 + i * 1.6) * (0.08 + cycle * 0.18);
      const scale = Math.sin(cycle * Math.PI);
      s.scale.setScalar(Math.max(0.01, scale));
    }
    for (let i = 0; i < this.waterfallStrips.length; i++) {
      const w = this.waterfallStrips[i];
      w.scale.x = 0.92 + Math.sin(time * 6.5 + i * 1.7) * 0.12;
      w.position.y = (w.userData.baseY as number) + Math.sin(time * 8.0 + i * 2.3) * 0.18;
    }
    for (let i = 0; i < this.mistPlumes.length; i++) {
      const m = this.mistPlumes[i];
      const s = 1.0 + Math.sin(time * 2.4 + i * 1.5) * 0.18;
      m.scale.set(s, s * 0.75, s);
      m.rotation.y = time * 0.35 * (i % 2 === 0 ? 1 : -1) + i;
    }
  }

  private buildHangingBridge(
    plankMat: THREE.MeshStandardMaterial,
    abutmentMat: THREE.MeshStandardMaterial
  ): void {
    const bridgeGroup = new THREE.Group();

    const ropeDiff = this.texLoader.load('/juzu/assets/character-textures/character-quechua-weave.jpg');
    ropeDiff.wrapS = ropeDiff.wrapT = THREE.RepeatWrapping;
    ropeDiff.repeat.set(16, 1);

    const ropeMat = new THREE.MeshStandardMaterial({
      map: ropeDiff,
      color: 0xa4895c,
      roughness: 0.9,
      metalness: 0.0,
    });

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x9e6c38,
      metalness: 0.85,
      roughness: 0.38,
    });

    // Bridge spans from South Gorge Rim (z = 1.0, y = 4.45) to North Sanctuary Rim (z = -35.0, y = 4.65)
    const zSouth = 1.0;
    const zNorth = -35.0;
    const numPlanks = 56;
    const ySouth = standAt(0, zSouth) + 0.25;
    const yNorth = standAt(0, zNorth) + 0.25;

    for (let i = 0; i <= numPlanks; i++) {
      const t = i / numPlanks;
      const z = THREE.MathUtils.lerp(zSouth, zNorth, t);
      const baseY = THREE.MathUtils.lerp(ySouth, yNorth, t);
      const sag = Math.sin(t * Math.PI) * 1.45;
      const y = baseY - sag;

      // Overlapping collision & visual plank (0.66m pitch, 0.68m depth -> zero gap fall-through)
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 0.68), plankMat);
      plank.position.set(0, y, z);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);

      // Vertical rope droppers every 3rd plank connecting foot cable to handrail cable
      if (i % 3 === 0 && i > 0 && i < numPlanks) {
        const handY = baseY + 1.22 - sag * 0.78;
        const dropperH = Math.max(0.4, handY - y);
        for (const side of [-1.18, 1.18]) {
          const dropper = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, dropperH, 5),
            ropeMat
          );
          dropper.position.set(side, y + dropperH * 0.5, z);
          bridgeGroup.add(dropper);
        }
      }
    }

    // Approach stone ramps at both ends so the player steps smoothly onto the bridge deck
    for (const end of [
      { z: zSouth + 1.1, y: ySouth, rotX: -0.14 },
      { z: zNorth - 1.1, y: yNorth, rotX: 0.14 },
    ]) {
      const ramp = new THREE.Mesh(createIncaBlock(3.2, 0.45, 2.2, 0.08, 1.8), abutmentMat);
      ramp.position.set(0, end.y - 0.12, end.z);
      ramp.rotation.x = end.rotX;
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      bridgeGroup.add(ramp);
    }

    // Handrail & Lower Catenary Suspension Cables
    const zMid = (zSouth + zNorth) * 0.5;
    const yMid = (ySouth + yNorth) * 0.5;
    for (const side of [-1.2, 1.2]) {
      const handCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, ySouth + 1.35, zSouth + 1.6),
        new THREE.Vector3(side, yMid + 0.05, zMid),
        new THREE.Vector3(side, yNorth + 1.35, zNorth - 1.6)
      );
      const handRope = new THREE.Mesh(new THREE.TubeGeometry(handCurve, 40, 0.055, 8, false), ropeMat);
      handRope.castShadow = true;
      bridgeGroup.add(handRope);

      const footCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, ySouth + 0.05, zSouth + 1.6),
        new THREE.Vector3(side, yMid - 1.45, zMid),
        new THREE.Vector3(side, yNorth + 0.05, zNorth - 1.6)
      );
      const footRope = new THREE.Mesh(new THREE.TubeGeometry(footCurve, 40, 0.07, 8, false), ropeMat);
      footRope.castShadow = true;
      bridgeGroup.add(footRope);

      // Battered Trapezoidal Inca Anchor Towers on BOTH South and North Canyon Rims
      for (const zPost of [zSouth + 1.6, zNorth - 1.6]) {
        const towerX = side * 1.65;
        const postH = standAt(towerX, zPost);
        const towerGroup = new THREE.Group();
        towerGroup.position.set(towerX, postH, zPost);

        const plinth = new THREE.Mesh(createIncaBlock(2.3, 1.2, 2.5, 0.08, 1.8), abutmentMat);
        plinth.position.y = 0.5;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        towerGroup.add(plinth);

        const pylon = new THREE.Mesh(createIncaBlock(1.85, 3.8, 1.95, 0.14, 1.8), abutmentMat);
        pylon.position.y = 2.6;
        pylon.castShadow = true;
        pylon.receiveShadow = true;
        towerGroup.add(pylon);

        const cap = new THREE.Mesh(createIncaBlock(1.75, 0.45, 1.85, 0.04, 1.8), abutmentMat);
        cap.position.y = 4.65;
        cap.castShadow = true;
        towerGroup.add(cap);

        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 12), bronzeMat);
        pin.rotation.z = Math.PI / 2;
        pin.position.set(0, 3.2, 0);
        pin.castShadow = true;
        towerGroup.add(pin);

        bridgeGroup.add(towerGroup);
      }
    }

    this.group.add(bridgeGroup);
  }

  private buildIntiSunMirror(
    stoneMat: THREE.MeshStandardMaterial,
    plinthMat: THREE.MeshStandardMaterial
  ): void {
    // Ancient Inca Bronze Inti Sun-Mirror mechanism on the South Gorge Rim at (-4.2, y, 3.8)
    const mirrorGroup = new THREE.Group();
    const mx = -4.2;
    const mz = 3.8;
    const mh = standAt(mx, mz);
    mirrorGroup.position.set(mx, mh, mz);

    const base = new THREE.Mesh(createIncaBlock(1.8, 0.45, 1.8, 0.08, 1.6), plinthMat);
    base.position.y = 0.22;
    base.castShadow = true;
    base.receiveShadow = true;
    mirrorGroup.add(base);

    const pedestal = new THREE.Mesh(createIncaBlock(1.05, 1.35, 1.05, 0.12, 1.6), stoneMat);
    pedestal.position.y = 1.05;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    mirrorGroup.add(pedestal);
    this.interactables.push(pedestal);

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xc8963e,
      metalness: 0.92,
      roughness: 0.22,
    });

    const head = new THREE.Group();
    head.position.set(0, 2.15, 0);
    // Initially angled off-axis until the player rotates it
    head.rotation.y = 0.65;

    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.07, 8, 20, Math.PI), bronzeMat);
    yoke.rotation.z = Math.PI;
    yoke.castShadow = true;
    head.add(yoke);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 24), bronzeMat);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    head.add(disc);
    this.interactables.push(disc);

    this.mirrorHead = head;
    mirrorGroup.add(head);
    this.group.add(mirrorGroup);

    // Volumetric additive golden solar reflection shaft spanning from South Mirror (-4.2, mh+2.15, 3.8) to North Stele (0, nh+2.5, -44)
    const startPos = new THREE.Vector3(mx, mh + 2.15, mz);
    const endPos = new THREE.Vector3(0, standAt(0, -44) + 2.55, -44);
    const beamLen = startPos.distanceTo(endPos);

    const beamGroup = new THREE.Group();
    beamGroup.position.copy(startPos);
    beamGroup.lookAt(endPos);

    // Outer atmospheric dust scatter shaft
    const outerGeom = new THREE.CylinderGeometry(0.14, 0.44, beamLen, 16, 1, true);
    outerGeom.translate(0, beamLen * 0.5, 0);
    outerGeom.rotateX(Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffcc55,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    beamGroup.add(new THREE.Mesh(outerGeom, outerMat));

    // Inner concentrated solar core
    const innerGeom = new THREE.CylinderGeometry(0.045, 0.11, beamLen, 12, 1, true);
    innerGeom.translate(0, beamLen * 0.5, 0);
    innerGeom.rotateX(Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xfff5cc,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    beamGroup.add(new THREE.Mesh(innerGeom, innerMat));

    // Luminous mirror flare & stele impact corona
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xffe488,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const startFlare = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), flareMat);
    beamGroup.add(startFlare);

    const endFlare = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), flareMat);
    endFlare.position.set(0, 0, beamLen);
    beamGroup.add(endFlare);

    beamGroup.visible = false;
    this.sunBeamGroup = beamGroup;
    this.group.add(beamGroup);
  }

  private buildNorthSanctuaryAndStele(
    stoneMat: THREE.MeshStandardMaterial,
    plinthMat: THREE.MeshStandardMaterial
  ): void {
    // North Cliff Sanctuary Gateway at (0, y, -39.5) and Carved Inca Stele at (0, y, -44)
    const gateY = standAt(0, -39.5);
    const gateway = buildTrapezoidalGateway(3.8, 1.5, 4.8, 1.6, stoneMat);
    gateway.position.set(0, gateY - 0.1, -39.5);
    this.group.add(gateway);

    // Ceremonial paved dais at (0, y, -44)
    const steleGroup = new THREE.Group();
    const groundH = standAt(0, -44);
    steleGroup.position.set(0, groundH, -44);

    const dais = new THREE.Mesh(createIncaBlock(5.6, 0.42, 4.8, 0.06, 2.0), plinthMat);
    dais.position.y = 0.21;
    dais.receiveShadow = true;
    dais.castShadow = true;
    steleGroup.add(dais);

    const plinth2 = new THREE.Mesh(createIncaBlock(2.2, 0.45, 1.5, 0.08, 1.8), plinthMat);
    plinth2.position.y = 0.62;
    plinth2.castShadow = true;
    plinth2.receiveShadow = true;
    steleGroup.add(plinth2);

    // Battered Monolithic Carved Inca Stele
    const stele = new THREE.Mesh(createIncaBlock(1.35, 3.4, 0.78, 0.12, 1.6), stoneMat);
    stele.position.y = 2.45;
    stele.castShadow = true;
    stele.receiveShadow = true;
    steleGroup.add(stele);
    this.interactables.push(stele);

    // Inlaid Golden Chakana Stepped Cross
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a028,
      metalness: 0.9,
      roughness: 0.28,
    });
    this.steleChakanaMat = goldMat;

    const crossGroup = new THREE.Group();
    crossGroup.position.set(0, 2.55, 0.38);

    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.05), goldMat);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.05), goldMat);
    const midStep = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.04), goldMat);
    const centerHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.9 })
    );
    centerHole.rotation.x = Math.PI / 2;

    crossGroup.add(barH, barV, midStep, centerHole);
    steleGroup.add(crossGroup);

    // Flanking stone altar columns
    for (const sx of [-2.3, 2.3]) {
      const col = new THREE.Mesh(createIncaBlock(0.85, 1.65, 0.85, 0.1, 1.5), stoneMat);
      col.position.set(sx, 1.2, 0.8);
      col.castShadow = true;
      col.receiveShadow = true;
      steleGroup.add(col);
    }

    this.group.add(steleGroup);
  }

  private buildCanyonTerraceRuins(stoneMat: THREE.MeshStandardMaterial): void {
    // Stepped Inca agricultural retaining terraces (andenes) built into the North & South cliff walls
    const ruinGroup = new THREE.Group();

    const terraces = [
      { x: -14, z: 8, w: 12, h: 2.6, d: 2.0, ry: 0.22 },
      { x: 15, z: 9, w: 12, h: 2.6, d: 2.0, ry: -0.22 },
      { x: -13, z: -42, w: 11, h: 3.0, d: 2.2, ry: -0.18 },
      { x: 13, z: -42, w: 11, h: 3.0, d: 2.2, ry: 0.18 },
    ];

    for (const t of terraces) {
      const ty = standAt(t.x, t.z);
      const wall = new THREE.Mesh(createIncaBlock(t.w, t.h, t.d, 0.12, 2.0), stoneMat);
      wall.position.set(t.x, ty + t.h * 0.42, t.z);
      wall.rotation.y = t.ry;
      wall.castShadow = true;
      wall.receiveShadow = true;
      ruinGroup.add(wall);
    }

    // Climbable stone ledge steps near South camp (-7.5, z = 8..11) for testing Tomb Raider ledge mantling
    const stepBaseY = standAt(-7.5, 9.5);
    const ledge1 = new THREE.Mesh(createIncaBlock(2.8, 1.45, 2.4, 0.06, 1.8), stoneMat);
    ledge1.position.set(-7.5, stepBaseY + 0.72, 9.5);
    ledge1.castShadow = true;
    ledge1.receiveShadow = true;
    ruinGroup.add(ledge1);

    const ledge2 = new THREE.Mesh(createIncaBlock(2.6, 2.75, 2.4, 0.06, 1.8), stoneMat);
    ledge2.position.set(-10.2, stepBaseY + 1.37, 9.5);
    ledge2.castShadow = true;
    ledge2.receiveShadow = true;
    ruinGroup.add(ledge2);

    this.group.add(ruinGroup);
  }

  private buildExpeditionBaseCamp(
    stoneMat: THREE.MeshStandardMaterial,
    timberMat: THREE.MeshStandardMaterial
  ): void {
    // Authentic Tomb Raider Expedition Base Camp at (3.2, y, 8.8) — flush river-cobble hearth, crossed logs, additive flames, rising sparks & gear
    const campGroup = new THREE.Group();
    const gH = standAt(3.2, 8.8);
    campGroup.position.set(3.2, gH, 8.8);

    // Flush scorched charcoal/ash ground patch (no raised cylinder pedestal)
    const ashMat = new THREE.MeshStandardMaterial({
      color: 0x1a1613,
      roughness: 0.98,
      metalness: 0.0,
    });
    const ashBed = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.04, 16), ashMat);
    ashBed.position.y = 0.02;
    ashBed.receiveShadow = true;
    campGroup.add(ashBed);

    // Ring of 10 irregular river cobbles around the fire pit
    const cobbleMat = new THREE.MeshStandardMaterial({
      color: 0x4a453d,
      roughness: 0.88,
      metalness: 0.02,
    });
    for (let c = 0; c < 10; c++) {
      const ang = (c / 10) * Math.PI * 2;
      const rad = 0.6 + (c % 2) * 0.04;
      const cobble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), cobbleMat);
      cobble.scale.set(1.15, 0.68 + (c % 3) * 0.1, 0.95);
      cobble.position.set(Math.cos(ang) * rad, 0.08, Math.sin(ang) * rad);
      cobble.rotation.set(c * 0.4, ang, c * 0.25);
      cobble.castShadow = true;
      cobble.receiveShadow = true;
      campGroup.add(cobble);
    }

    // 5 crossed charred firewood logs resting naturally in the pit
    for (let l = 0; l < 5; l++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.92, 7), timberMat);
      const ang = (l / 5) * Math.PI * 2 + 0.2;
      log.position.set(Math.cos(ang) * 0.08, 0.14 + (l % 2) * 0.03, Math.sin(ang) * 0.08);
      log.rotation.z = Math.PI / 2 - 0.26;
      log.rotation.y = ang;
      log.castShadow = true;
      campGroup.add(log);
    }

    // Glowing coal/ember core at the center of the logs
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xff5518,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.85,
    });
    const emberBed = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), emberMat);
    emberBed.scale.set(1.1, 0.35, 1.1);
    emberBed.position.y = 0.09;
    campGroup.add(emberBed);

    // Multi-layered additive flame tongues (no opaque origami cones)
    const flameSpecs = [
      { r: 0.22, h: 0.62, color: 0xff5a14, op: 0.55, x: 0, z: 0 },
      { r: 0.17, h: 0.78, color: 0xff9422, op: 0.5, x: 0.05, z: -0.04 },
      { r: 0.14, h: 0.68, color: 0xffb838, op: 0.45, x: -0.05, z: 0.04 },
      { r: 0.09, h: 0.52, color: 0xffe875, op: 0.6, x: 0, z: 0 },
    ];
    for (let f = 0; f < flameSpecs.length; f++) {
      const sp = flameSpecs[f];
      const flameMat = new THREE.MeshBasicMaterial({
        color: sp.color,
        transparent: true,
        opacity: sp.op,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const geom = new THREE.ConeGeometry(sp.r, sp.h, 8, 1, true);
      geom.translate(0, sp.h * 0.5, 0);
      const flame = new THREE.Mesh(geom, flameMat);
      flame.position.set(sp.x, 0.12, sp.z);
      this.flameMeshes.push(flame);
      campGroup.add(flame);
    }

    // Rising glowing ember sparks
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let s = 0; s < 6; s++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), sparkMat);
      spark.position.set(0, 0.3 + s * 0.18, 0);
      this.sparkMeshes.push(spark);
      campGroup.add(spark);
    }

    // Expedition Camp Gear beside the hearth: low stone seat, rolled canvas bedroll & warm brass lantern
    const seatStone = new THREE.Mesh(createIncaBlock(0.85, 0.42, 0.58, 0.08, 1.4), stoneMat);
    seatStone.position.set(1.25, 0.18, -0.35);
    seatStone.rotation.y = -0.35;
    seatStone.castShadow = true;
    seatStone.receiveShadow = true;
    campGroup.add(seatStone);

    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0x5d523f,
      roughness: 0.9,
      metalness: 0.02,
    });
    const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.88, 12), canvasMat);
    bedroll.rotation.z = Math.PI / 2;
    bedroll.rotation.y = 0.42;
    bedroll.position.set(-1.18, 0.15, 0.45);
    bedroll.castShadow = true;
    bedroll.receiveShadow = true;
    campGroup.add(bedroll);

    // Brass expedition lantern resting on the stone seat
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb58938,
      metalness: 0.85,
      roughness: 0.32,
    });
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.06, 10), brassMat);
    lanternBase.position.set(1.22, 0.42, -0.32);
    campGroup.add(lanternBase);

    const lanternGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd27d })
    );
    lanternGlass.position.set(1.22, 0.51, -0.32);
    campGroup.add(lanternGlass);

    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 10), brassMat);
    lanternCap.position.set(1.22, 0.6, -0.32);
    campGroup.add(lanternCap);

    const fireLight = new THREE.PointLight(0xff8830, 2.6, 15, 1.4);
    fireLight.position.y = 0.85;
    this.fireLight = fireLight;
    campGroup.add(fireLight);

    this.group.add(campGroup);
  }

  private buildGorgeWaterfall(_stoneMat: THREE.MeshStandardMaterial): void {
    // Cascading Andean mountain waterfall pouring down the Northern Gorge Cliff into the Urubamba River (-2.2m)
    const fallsGroup = new THREE.Group();
    const wx = 17.5;
    const wz = -29.5;
    fallsGroup.position.set(wx, -2.2, wz);

    // Organic wet dark canyon boulders framing the waterfall chute & plunge pool
    const rockDiff = this.texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;
    const rockNor = this.texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;

    const wetRockMat = new THREE.MeshStandardMaterial({
      map: rockDiff,
      normalMap: rockNor,
      color: 0x3b3e36,
      roughness: 0.42,
      metalness: 0.06,
    });

    const boulderClusters = [
      { x: -2.4, y: 1.4, z: -0.6, sx: 1.5, sy: 1.8, sz: 1.4 },
      { x: 2.5, y: 1.5, z: -0.5, sx: 1.6, sy: 1.9, sz: 1.4 },
      { x: -2.2, y: 5.2, z: -1.4, sx: 1.3, sy: 2.2, sz: 1.3 },
      { x: 2.3, y: 5.4, z: -1.4, sx: 1.4, sy: 2.3, sz: 1.3 },
      { x: -1.9, y: 9.2, z: -2.1, sx: 1.2, sy: 1.9, sz: 1.2 },
      { x: 2.0, y: 9.4, z: -2.1, sx: 1.2, sy: 1.9, sz: 1.2 },
    ];
    for (let b = 0; b < boulderClusters.length; b++) {
      const bc = boulderClusters[b];
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.65, 1), wetRockMat);
      rock.position.set(bc.x, bc.y, bc.z);
      rock.scale.set(bc.sx, bc.sy, bc.sz);
      rock.rotation.set(b * 0.5, b * 1.1, b * 0.3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      fallsGroup.add(rock);
    }

    // Multi-layered cascading whitewater ribbons (softened opacity so highlights never clip)
    for (let i = 0; i < 4; i++) {
      const stripMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xc8e6f0 : 0xeaf6fa,
        transparent: true,
        opacity: 0.17 - i * 0.025,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const stripH = 11.8;
      const strip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85 + i * 0.18, 1.55 + i * 0.24, stripH, 12, 1, true),
        stripMat
      );
      const baseY = 5.8;
      strip.position.set((i - 1.5) * 0.16, baseY, -0.5 + i * 0.14);
      strip.rotation.x = 0.18;
      strip.userData.baseY = baseY;
      this.waterfallStrips.push(strip);
      fallsGroup.add(strip);
    }

    // Soft rising misty spray plumes at the plunge pool base
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xd0e6ee,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let m = 0; m < 4; m++) {
      const plume = new THREE.Mesh(new THREE.SphereGeometry(1.4 + (m % 2) * 0.45, 10, 8), mistMat);
      plume.position.set((m - 1.5) * 0.85, 0.45 + (m % 2) * 0.35, 0.7 + (m % 2) * 0.4);
      this.mistPlumes.push(plume);
      fallsGroup.add(plume);
    }

    // Concentric plunge-pool surface foam rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4eaf2,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5 + r * 1.1, 1.85 + r * 1.15, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.06, 0.6);
      fallsGroup.add(ring);
    }

    this.group.add(fallsGroup);
  }
}
