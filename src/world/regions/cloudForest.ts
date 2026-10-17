import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';

export class CloudForestRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();

  private mirrorHead?: THREE.Group;
  private sunBeamMesh?: THREE.Mesh;
  private steleChakanaMat?: THREE.MeshStandardMaterial;
  private fireLight?: THREE.PointLight;
  private flameMeshes: THREE.Mesh[] = [];
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
    this.buildExpeditionBaseCamp(redPavementMat, timberPlankMat);
  }

  public alignSunMirror(): void {
    this.mirrorAligned = true;
    if (this.mirrorHead) {
      this.mirrorHead.rotation.y = -0.09;
      this.mirrorHead.rotation.x = -0.04;
    }
    if (this.sunBeamMesh) {
      this.sunBeamMesh.visible = true;
    }
    if (this.steleChakanaMat) {
      this.steleChakanaMat.emissive.setHex(0xd49b24);
      this.steleChakanaMat.emissiveIntensity = 0.65;
    }
  }

  public update(time: number): void {
    if (this.fireLight) {
      this.fireLight.intensity = 2.8 + Math.sin(time * 11.3) * 0.45 + Math.cos(time * 17.7) * 0.25;
    }
    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      f.scale.y = 0.85 + Math.sin(time * 13 + i * 2.1) * 0.25;
      f.rotation.y = time * 1.8 + i;
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

    // Golden solar reflection beam spanning from South Mirror (-4.2, mh+2.15, 3.8) to North Stele (0, nh+2.5, -44)
    const startPos = new THREE.Vector3(mx, mh + 2.15, mz);
    const endPos = new THREE.Vector3(0, standAt(0, -44) + 2.55, -44);
    const beamLen = startPos.distanceTo(endPos);
    const beamGeom = new THREE.CylinderGeometry(0.08, 0.26, beamLen, 12, 1, true);
    beamGeom.translate(0, beamLen * 0.5, 0);
    beamGeom.rotateX(Math.PI / 2);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffdf78,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.copy(startPos);
    beam.lookAt(endPos);
    beam.visible = false;
    this.sunBeamMesh = beam;
    this.group.add(beam);
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
    pavementMat: THREE.MeshStandardMaterial,
    timberMat: THREE.MeshStandardMaterial
  ): void {
    // Expedition Base Camp hearth with burning logs & dancing flames at (3.2, y, 8.8)
    const campGroup = new THREE.Group();
    const gH = standAt(3.2, 8.8);
    campGroup.position.set(3.2, gH, 8.8);

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.28, 16), pavementMat);
    platform.position.y = 0.14;
    platform.receiveShadow = true;
    campGroup.add(platform);

    const hearthMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x3b352d,
        roughness: 0.92,
        metalness: 0.0,
      })
    );
    const hearthRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.13, 8, 16), hearthMat);
    hearthRing.rotation.x = Math.PI / 2;
    hearthRing.position.y = 0.34;
    hearthRing.castShadow = true;
    campGroup.add(hearthRing);

    // Crossed firewood logs inside the hearth
    for (let l = 0; l < 3; l++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.85, 7), timberMat);
      log.position.set(0, 0.38, 0);
      log.rotation.z = Math.PI / 2 - 0.22;
      log.rotation.y = (l * Math.PI) / 3;
      campGroup.add(log);
    }

    // Glowing ember bed & animated flame cones
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    const emberBed = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.08, 12), emberMat);
    emberBed.position.y = 0.32;
    campGroup.add(emberBed);

    const flameColors = [0xff7718, 0xffaa28, 0xffdd55];
    for (let f = 0; f < 3; f++) {
      const flameMat = new THREE.MeshBasicMaterial({
        color: flameColors[f],
        transparent: true,
        opacity: 0.82 - f * 0.15,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24 - f * 0.05, 0.65 + f * 0.15, 7), flameMat);
      flame.position.set((f - 1) * 0.06, 0.62 + f * 0.06, 0);
      this.flameMeshes.push(flame);
      campGroup.add(flame);
    }

    const fireLight = new THREE.PointLight(0xff8830, 2.8, 14, 1.4);
    fireLight.position.y = 0.95;
    this.fireLight = fireLight;
    campGroup.add(fireLight);

    this.group.add(campGroup);
  }
}
