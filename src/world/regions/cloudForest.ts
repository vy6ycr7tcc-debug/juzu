import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { standAt } from '../terrain';
import { solid, passable } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';
import { MOBILE } from '../../core/quality';

export class CloudForestRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();

  private mirrorHead?: THREE.Group;
  private sunBeamGroup?: THREE.Group;
  private steleChakanaMat?: THREE.MeshStandardMaterial;
  private steleLight?: THREE.PointLight;
  private fireLight?: THREE.PointLight;
  private flameMeshes: THREE.Mesh[] = [];
  private sparkMeshes: THREE.Mesh[] = [];
  private waterfallStrips: THREE.Mesh[] = [];
  private mistPlumes: THREE.Mesh[] = [];
  private pollenPoints?: THREE.Points;
  private waterfallNormalMap?: THREE.Texture;
  private fallsGroup = new THREE.Group();
  private scansRequested = false;
  private mirrorAligned = false;
  public isLoaded = false;
  public bridgePlanks: Array<{ mesh: THREE.Mesh; restY: number; z: number; restX: number }> = [];
  private skidParticles?: THREE.Points;
  private skidPositions = new Float32Array(90 * 3);
  private skidVelocities = new Float32Array(90 * 3);
  private skidLifetimes = new Float32Array(90);
  private skidIdx = 0;
  private lastSkidTime = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_CloudForest';
    scene.add(this.group);

    // Authentic Andean Scanned PBR Ashlar Masonry & Qhapaq Ñan Pavement (Poly Haven CC0)
    const stoneDiff = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_diffuse_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_diffuse_2k.webp'
    );
    stoneDiff.colorSpace = THREE.SRGBColorSpace;
    stoneDiff.anisotropy = MOBILE ? 2 : 8;
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;

    const stoneNor = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_nor_gl_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_nor_gl_2k.webp'
    );
    stoneNor.anisotropy = MOBILE ? 2 : 8;
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;

    const stoneRough = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_rough_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_rough_2k.webp'
    );
    stoneRough.anisotropy = MOBILE ? 2 : 8;
    stoneRough.wrapS = stoneRough.wrapT = THREE.RepeatWrapping;

    const stoneAO = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_ao_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_ao_2k.webp'
    );
    stoneAO.wrapS = stoneAO.wrapT = THREE.RepeatWrapping;

    const ashlarStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: stoneRough,
        aoMap: stoneAO,
        aoMapIntensity: 0.85,
        metalness: 0.02,
        roughness: 0.86,
        color: 0xffffff,
        vertexColors: true,
      })
    );

    const plankDiff = this.texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-planks_1k.webp'
        : '/juzu/assets/environment-textures/environment-planks.jpeg'
    );
    plankDiff.colorSpace = THREE.SRGBColorSpace;
    plankDiff.anisotropy = MOBILE ? 2 : 8;
    plankDiff.wrapS = plankDiff.wrapT = THREE.RepeatWrapping;
    plankDiff.repeat.set(1.0, 0.35);

    const plankNor = this.texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-planks-normal_1k.webp'
        : '/juzu/assets/environment-textures/environment-planks-normal.jpg'
    );
    plankNor.anisotropy = MOBILE ? 2 : 8;
    plankNor.wrapS = plankNor.wrapT = THREE.RepeatWrapping;
    plankNor.repeat.set(1.0, 0.35);

    const plankRough = this.texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-planks-roughness_1k.webp'
        : '/juzu/assets/environment-textures/environment-planks-roughness.jpg'
    );
    plankRough.anisotropy = MOBILE ? 2 : 8;
    plankRough.wrapS = plankRough.wrapT = THREE.RepeatWrapping;
    plankRough.repeat.set(1.0, 0.35);

    const timberPlankMat = solid(
      new THREE.MeshStandardMaterial({
        map: plankDiff,
        normalMap: plankNor,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: plankRough,
        color: 0xb8a48c,
        roughness: 0.84,
        metalness: 0.02,
      })
    );

    const paveDiff = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_diffuse_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_diffuse_2k.webp'
    );
    paveDiff.colorSpace = THREE.SRGBColorSpace;
    paveDiff.anisotropy = MOBILE ? 2 : 8;
    paveDiff.wrapS = paveDiff.wrapT = THREE.RepeatWrapping;

    const paveNor = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_nor_gl_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_nor_gl_2k.webp'
    );
    paveNor.anisotropy = MOBILE ? 2 : 8;
    paveNor.wrapS = paveNor.wrapT = THREE.RepeatWrapping;

    const paveRough = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_rough_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_rough_2k.webp'
    );
    paveRough.anisotropy = MOBILE ? 2 : 8;
    paveRough.wrapS = paveRough.wrapT = THREE.RepeatWrapping;

    const paveARM = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_arm_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_arm_2k.webp'
    );
    paveARM.wrapS = paveARM.wrapT = THREE.RepeatWrapping;

    const redPavementMat = solid(
      new THREE.MeshStandardMaterial({
        map: paveDiff,
        normalMap: paveNor,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: paveRough,
        aoMap: paveARM,
        aoMapIntensity: 0.80,
        color: 0xe0d4c4,
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.02,
      })
    );

    this.buildHangingBridge(timberPlankMat, ashlarStoneMat);
    this.buildIntiSunMirror(ashlarStoneMat, redPavementMat);
    this.buildNorthSanctuaryAndStele(ashlarStoneMat, redPavementMat);
    this.buildCanyonTerraceRuins(ashlarStoneMat);
    this.buildExpeditionBaseCamp(ashlarStoneMat, timberPlankMat);
    this.buildGorgeWaterfall(ashlarStoneMat);
    this.buildAtmosphereMotes();
    this.buildSkidDebrisSystem();
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
    if (this.steleLight) {
      this.steleLight.intensity = 3.8;
    }
  }

  public update(
    time: number,
    playerPos?: THREE.Vector3,
    playerSpeed?: number,
    isSkiddingOrPivoting?: boolean
  ): void {
    // Tactile Suspension Bridge Dynamics: footstep depression & harmonic sway
    if (this.bridgePlanks.length > 0) {
      const onBridge =
        playerPos &&
        Math.abs(playerPos.x) < 1.6 &&
        playerPos.z <= 1.2 &&
        playerPos.z >= -35.2;

      for (const p of this.bridgePlanks) {
        let dip = 0;
        let sway = 0;
        if (onBridge && playerPos) {
          const dz = Math.abs(p.z - playerPos.z);
          if (dz < 2.4) {
            const bell = Math.cos((dz / 2.4) * (Math.PI / 2));
            dip = -0.048 * bell * bell;
          }
          const swayAmp = 0.015 * Math.min(1, (playerSpeed || 0) / 2.5);
          sway = Math.sin(time * 4.2 + p.z * 0.18) * swayAmp;
        }
        p.mesh.position.y = THREE.MathUtils.lerp(p.mesh.position.y, p.restY + dip, 0.22);
        p.mesh.position.x = THREE.MathUtils.lerp(p.mesh.position.x, p.restX + sway, 0.22);
      }
    }

    if (this.mirrorAligned && this.steleLight) {
      this.steleLight.intensity = 3.8 + Math.sin(time * 7.5) * 0.45;
    }
    if (this.fireLight) {
      this.fireLight.intensity = 2.6 + Math.sin(time * 11.3) * 0.42 + Math.cos(time * 17.7) * 0.22;
    }
    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      f.scale.y = 0.78 + Math.sin(time * 14 + i * 2.1) * 0.24;
      f.scale.x = 0.90 + Math.cos(time * 11 + i * 1.7) * 0.16;
      f.rotation.y = time * 2.2 + i * 1.1;
    }
    for (let i = 0; i < this.sparkMeshes.length; i++) {
      const s = this.sparkMeshes[i];
      const cycle = (time * (0.75 + i * 0.12) + i * 0.37) % 1.0;
      s.position.y = 0.18 + cycle * 1.15;
      s.position.x = Math.sin(time * 3.5 + i * 2.0) * (0.08 + cycle * 0.16);
      s.position.z = Math.cos(time * 3.1 + i * 1.6) * (0.08 + cycle * 0.16);
      const scale = Math.sin(cycle * Math.PI);
      s.scale.setScalar(Math.max(0.01, scale));
    }
    for (let i = 0; i < this.waterfallStrips.length; i++) {
      const w = this.waterfallStrips[i];
      w.scale.x = 0.96 + Math.sin(time * 5.0 + i * 1.5) * 0.06;
      w.position.y = (w.userData.baseY as number) + Math.sin(time * 6.0 + i * 2.0) * 0.08;
    }
    if (this.waterfallNormalMap) {
      this.waterfallNormalMap.offset.y = -(time * 1.85) % 1.0;
      this.waterfallNormalMap.offset.x = Math.sin(time * 0.7) * 0.03;
    }
    for (let i = 0; i < this.mistPlumes.length; i++) {
      const m = this.mistPlumes[i];
      const s = 1.0 + Math.sin(time * 2.4 + i * 1.5) * 0.18;
      m.scale.set(s, s * 0.75, s);
      m.rotation.y = time * 0.35 * (i % 2 === 0 ? 1 : -1) + i;
    }
    if (this.pollenPoints) {
      this.pollenPoints.position.y = Math.sin(time * 0.45) * 0.18;
      this.pollenPoints.position.x = Math.cos(time * 0.28) * 0.14;
    }

    // Dynamic Footstep Skid & Soil Debris Emission
    if (isSkiddingOrPivoting && playerPos && time - this.lastSkidTime > 0.08) {
      this.lastSkidTime = time;
      this.emitSkidDebris(playerPos);
    }

    if (this.skidParticles) {
      let needsPosUpdate = false;
      const dt = 0.016;
      for (let i = 0; i < 90; i++) {
        if (this.skidLifetimes[i] > 0) {
          this.skidLifetimes[i] -= dt;
          this.skidPositions[i * 3] += this.skidVelocities[i * 3] * dt;
          this.skidPositions[i * 3 + 1] += this.skidVelocities[i * 3 + 1] * dt;
          this.skidPositions[i * 3 + 2] += this.skidVelocities[i * 3 + 2] * dt;
          this.skidVelocities[i * 3 + 1] -= 3.2 * dt;
          if (this.skidLifetimes[i] <= 0) {
            this.skidPositions[i * 3 + 1] = -999;
          }
          needsPosUpdate = true;
        }
      }
      if (needsPosUpdate) {
        this.skidParticles.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  private buildHangingBridge(
    plankMat: THREE.MeshStandardMaterial,
    abutmentMat: THREE.MeshStandardMaterial
  ): void {
    const bridgeGroup = new THREE.Group();

    const ropeNor = this.texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-planks-normal_1k.webp'
        : '/juzu/assets/environment-textures/environment-planks-normal.jpg'
    );
    ropeNor.wrapS = ropeNor.wrapT = THREE.RepeatWrapping;
    ropeNor.repeat.set(24, 2);

    const ropeRough = this.texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-planks-roughness_1k.webp'
        : '/juzu/assets/environment-textures/environment-planks-roughness.jpg'
    );
    ropeRough.wrapS = ropeRough.wrapT = THREE.RepeatWrapping;
    ropeRough.repeat.set(24, 2);

    // Authentic Q'eswachaka hand-woven ichu-grass fiber cable (golden-tan twisted Andean grass, never rainbow cloth)
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xb59862,
      normalMap: ropeNor,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: ropeRough,
      roughness: 0.88,
      metalness: 0.0,
    });

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x8a6436,
      metalness: 0.78,
      roughness: 0.44,
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
      const plank = passable(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 0.68), plankMat));
      plank.position.set(0, y, z);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
      this.bridgePlanks.push({ mesh: plank, restY: y, z, restX: 0 });

      // Authentic V-shaped woven Inca rope side-netting lacings every 2nd plank (matching ref_gorge_waterfall_bridge)
      if (i % 2 === 0 && i > 0 && i < numPlanks) {
        const handY = baseY + 1.22 - sag * 0.78;
        const dropperH = Math.max(0.45, handY - y);
        for (const side of [-1.18, 1.18]) {
          for (const slant of [-0.24, 0.24]) {
            const dropper = new THREE.Mesh(
              new THREE.CylinderGeometry(0.015, 0.015, dropperH * 1.04, 5),
              ropeMat
            );
            dropper.position.set(side, y + dropperH * 0.5, z);
            dropper.rotation.x = slant;
            bridgeGroup.add(dropper);
          }
        }
      }
    }

    // Approach stone ramps + worn trail stepping-stones at both ends
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

    // Worn stone footpath slabs leading across South Camp (z = 3.5..11.5) and North Sanctuary (z = -37..-42.5)
    const trailZs = [3.6, 5.4, 7.2, 9.0, 10.8, -37.2, -39.2, -41.2];
    for (let s = 0; s < trailZs.length; s++) {
      const tz = trailZs[s];
      const tx = Math.sin(s * 1.7) * 0.28;
      const ty = standAt(tx, tz);
      const slab = passable(new THREE.Mesh(
        createIncaBlock(1.65 + (s % 2) * 0.30, 0.14, 1.15, 0.10, 1.4),
        abutmentMat
      ));
      slab.position.set(tx, ty - 0.05, tz);
      slab.rotation.y = ((s % 3) - 1) * 0.14;
      slab.receiveShadow = true;
      bridgeGroup.add(slab);
    }

    // Handrail, Mid-Rail & Lower Catenary Suspension Cables
    const zMid = (zSouth + zNorth) * 0.5;
    const yMid = (ySouth + yNorth) * 0.5;
    // Shadowed recessed stone material for Ollantaytambo-style trapezoidal niches (textured, never flat black)
    const nicheBackMat = abutmentMat.clone();
    nicheBackMat.color = new THREE.Color(0x3e3830);
    nicheBackMat.roughness = 0.94;

    for (const side of [-1.2, 1.2]) {
      const handCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, ySouth + 1.35, zSouth + 1.6),
        new THREE.Vector3(side, yMid + 0.05, zMid),
        new THREE.Vector3(side, yNorth + 1.35, zNorth - 1.6)
      );
      const handRope = new THREE.Mesh(new THREE.TubeGeometry(handCurve, 40, 0.058, 8, false), ropeMat);
      handRope.castShadow = true;
      bridgeGroup.add(handRope);

      const midCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, ySouth + 0.68, zSouth + 1.6),
        new THREE.Vector3(side, yMid - 0.68, zMid),
        new THREE.Vector3(side, yNorth + 0.68, zNorth - 1.6)
      );
      const midRope = new THREE.Mesh(new THREE.TubeGeometry(midCurve, 40, 0.032, 6, false), ropeMat);
      bridgeGroup.add(midRope);

      const footCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, ySouth + 0.05, zSouth + 1.6),
        new THREE.Vector3(side, yMid - 1.45, zMid),
        new THREE.Vector3(side, yNorth + 0.05, zNorth - 1.6)
      );
      const footRope = new THREE.Mesh(new THREE.TubeGeometry(footCurve, 40, 0.072, 8, false), ropeMat);
      footRope.castShadow = true;
      bridgeGroup.add(footRope);

      // Battered Trapezoidal Inca Anchor Towers with Framed Recessed Niches on BOTH South and North Canyon Rims
      for (const zPost of [zSouth + 1.6, zNorth - 1.6]) {
        const towerX = side * 1.65;
        const postH = standAt(towerX, zPost);
        const towerGroup = new THREE.Group();
        towerGroup.position.set(towerX, postH, zPost);

        const plinth = new THREE.Mesh(createIncaBlock(2.35, 1.2, 2.55, 0.08, 1.8), abutmentMat);
        plinth.position.y = 0.5;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        towerGroup.add(plinth);

        const pylon = new THREE.Mesh(createIncaBlock(1.88, 3.8, 1.98, 0.14, 1.8), abutmentMat);
        pylon.position.y = 2.6;
        pylon.castShadow = true;
        pylon.receiveShadow = true;
        towerGroup.add(pylon);

        // Ollantaytambo-style framed trapezoidal niche on the south & north faces of each bridge tower
        for (const fz of [-0.90, 0.90]) {
          const signZ = Math.sign(fz);
          // Deep shadowed stone backplate
          const nicheBack = new THREE.Mesh(createIncaBlock(0.56, 1.05, 0.08, 0.16, 0.8), nicheBackMat);
          nicheBack.position.set(0, 2.62, fz);
          nicheBack.receiveShadow = true;
          towerGroup.add(nicheBack);

          // Heavy monolithic stone lintel above the trapezoidal niche
          const lintel = new THREE.Mesh(createIncaBlock(0.86, 0.22, 0.24, 0.04, 0.8), abutmentMat);
          lintel.position.set(0, 3.22, fz + signZ * 0.03);
          lintel.castShadow = true;
          lintel.receiveShadow = true;
          towerGroup.add(lintel);

          // Projecting stone sill at the base of the niche
          const sill = new THREE.Mesh(createIncaBlock(0.92, 0.16, 0.22, 0.02, 0.8), abutmentMat);
          sill.position.set(0, 2.04, fz + signZ * 0.03);
          sill.castShadow = true;
          sill.receiveShadow = true;
          towerGroup.add(sill);

          // Inward-battered left and right stone jamb blocks framing the recess
          for (const jSide of [-1, 1]) {
            const jamb = new THREE.Mesh(createIncaBlock(0.18, 1.04, 0.20, 0.04, 0.6), abutmentMat);
            jamb.position.set(jSide * 0.34, 2.62, fz + signZ * 0.02);
            jamb.rotation.z = -jSide * 0.08;
            jamb.castShadow = true;
            jamb.receiveShadow = true;
            towerGroup.add(jamb);
          }
        }

        const cap = new THREE.Mesh(createIncaBlock(1.82, 0.48, 1.92, 0.04, 1.8), abutmentMat);
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
    // Ancient Inca Engraved Bronze Inti Sun-Mirror on the South Gorge Rim at (-4.2, y, 3.8)
    // Modeled 1:1 after ref_camp_and_sun_mirror: mossy stepped stone altar + 16-ray engraved solar calendar disc + Inti face medallion
    const mirrorGroup = new THREE.Group();
    const mx = -4.2;
    const mz = 3.8;
    const mh = standAt(mx, mz);
    mirrorGroup.position.set(mx, mh, mz);

    const base = new THREE.Mesh(createIncaBlock(1.9, 0.48, 1.9, 0.08, 1.6), plinthMat);
    base.position.y = 0.24;
    base.castShadow = true;
    base.receiveShadow = true;
    mirrorGroup.add(base);

    const pedestal = new THREE.Mesh(createIncaBlock(1.25, 1.38, 1.15, 0.10, 1.5), stoneMat);
    pedestal.position.y = 1.08;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    mirrorGroup.add(pedestal);
    this.interactables.push(pedestal);

    const capSlab = new THREE.Mesh(createIncaBlock(1.42, 0.26, 1.32, 0.04, 1.4), stoneMat);
    capSlab.position.y = 1.82;
    capSlab.castShadow = true;
    capSlab.receiveShadow = true;
    mirrorGroup.add(capSlab);

    // Hammered, centuries-old Inca arsenical bronze with weathered mountain patina
    const bronzeRimMat = new THREE.MeshStandardMaterial({
      color: 0x74582e,
      normalMap: stoneMat.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: stoneMat.roughnessMap,
      metalness: 0.82,
      roughness: 0.46,
    });
    const goldReliefMat = new THREE.MeshStandardMaterial({
      color: 0xb88c38,
      normalMap: stoneMat.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      metalness: 0.88,
      roughness: 0.32,
      emissive: 0x241604,
      emissiveIntensity: 0.12,
    });

    const head = new THREE.Group();
    head.position.set(0, 2.62, 0);
    // Angled slightly toward the sun/camp so the engraved golden face & solar rays catch the light immediately
    head.rotation.y = 0.28;

    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.065, 8, 24, Math.PI), bronzeRimMat);
    yoke.rotation.z = Math.PI;
    yoke.castShadow = true;
    head.add(yoke);

    // Base bronze calendar disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.70, 0.70, 0.09, 28), bronzeRimMat);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    head.add(disc);
    this.interactables.push(disc);

    // Concentric engraved calendar rings on both faces (z = +0.048 and -0.048)
    for (const fz of [-0.048, 0.048]) {
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.032, 8, 28), goldReliefMat);
      outerRing.position.z = fz;
      head.add(outerRing);

      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.024, 8, 24), goldReliefMat);
      innerRing.position.z = fz;
      head.add(innerRing);

      // 16 radiating stepped Inca solar rays around the ring (flattened hammered bronze relief)
      for (let r = 0; r < 16; r++) {
        const ang = (r / 16) * Math.PI * 2;
        const rayLen = r % 2 === 0 ? 0.22 : 0.16;
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.042, rayLen, 4), goldReliefMat);
        ray.scale.set(1.0, 1.0, 0.35);
        const rad = 0.34 + rayLen * 0.45;
        ray.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, fz);
        ray.rotation.z = ang - Math.PI / 2;
        head.add(ray);
      }

      // Central embossed Inti Sun-God face medallion
      const sunFace = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), goldReliefMat);
      sunFace.scale.set(1.0, 1.0, 0.22);
      sunFace.position.z = fz;
      head.add(sunFace);
    }

    this.mirrorHead = head;
    mirrorGroup.add(head);
    this.group.add(mirrorGroup);

    // Volumetric additive golden solar reflection shaft spanning from South Mirror (-4.2, mh+2.62, 3.8) to North Stele (0, nh+2.5, -44)
    const startPos = new THREE.Vector3(mx, mh + 2.62, mz);
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

    // Inlaid Hammered Golden Chakana Stepped Cross
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xc89628,
      normalMap: stoneMat.normalMap,
      normalScale: new THREE.Vector2(0.30, 0.30),
      roughnessMap: stoneMat.roughnessMap,
      metalness: 0.88,
      roughness: 0.34,
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

    const steleLight = new THREE.PointLight(0xffd566, 0.0, 16, 1.4);
    steleLight.position.set(0, 2.55, 0.65);
    steleGroup.add(steleLight);
    this.steleLight = steleLight;

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

    // Authentic inclined Inca terrace ramp (andene kallanka ramp) connecting clearing floor to first terrace
    const rampLen = 4.6;
    const rampAngle = 0.32; // ~18.3 deg slope
    const terraceRamp = new THREE.Mesh(createIncaBlock(rampLen, 0.42, 3.2, 0.06, 1.8), stoneMat);
    terraceRamp.position.set(-4.8, stepBaseY + 0.45, 9.5);
    terraceRamp.rotation.z = -rampAngle;
    terraceRamp.castShadow = true;
    terraceRamp.receiveShadow = true;
    ruinGroup.add(terraceRamp);

    // Stone ashlar border kerbs framing both edges of the terrace ramp
    for (const sideZ of [-1.55, 1.55]) {
      const kerb = new THREE.Mesh(createIncaBlock(rampLen * 1.02, 0.28, 0.32, 0.04, 1.4), stoneMat);
      kerb.position.set(-4.8, stepBaseY + 0.58, 9.5 + sideZ);
      kerb.rotation.z = -rampAngle;
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      ruinGroup.add(kerb);
    }

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
    // Authentic Tomb Raider Expedition Base Camp at (3.2, y, 8.8) — modeled 1:1 after ref_camp_and_sun_mirror:
    // River-cobble ring, charred logs with glowing orange ember tips, iron cooking tripod + suspended kettle,
    // multi-lobed organic flames, and weathered canvas A-frame expedition shelter tent.
    const campGroup = new THREE.Group();
    const gH = standAt(2.3, 7.2);
    campGroup.position.set(2.3, gH, 7.2);

    // Flush scorched charcoal/ash ground patch
    const ashMat = new THREE.MeshStandardMaterial({
      color: 0x1a1613,
      roughness: 0.98,
      metalness: 0.0,
    });
    const ashBed = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.04, 18), ashMat);
    ashBed.position.y = 0.02;
    ashBed.receiveShadow = true;
    campGroup.add(ashBed);

    // Ring of 14 irregular textured river cobbles around the fire pit
    const cobbleMat = stoneMat.clone();
    cobbleMat.color = new THREE.Color(0x6e665c);
    cobbleMat.roughness = 0.88;
    for (let c = 0; c < 14; c++) {
      const ang = (c / 14) * Math.PI * 2;
      const rad = 0.64 + (c % 2) * 0.04;
      const cobble = new THREE.Mesh(
        createIncaBlock(0.26 + (c % 3) * 0.04, 0.16 + (c % 2) * 0.04, 0.22, 0.12, 0.8),
        cobbleMat
      );
      cobble.position.set(Math.cos(ang) * rad, 0.065, Math.sin(ang) * rad);
      cobble.rotation.set((c % 2) * 0.12, -ang + (c % 3) * 0.2, 0);
      cobble.castShadow = true;
      cobble.receiveShadow = true;
      campGroup.add(cobble);
    }

    // 6 radial charred firewood logs with glowing orange-red ember tips at the center
    const emberTipMat = new THREE.MeshBasicMaterial({ color: 0xff4e14 });
    for (let l = 0; l < 6; l++) {
      const ang = (l / 6) * Math.PI * 2 + 0.15;
      const logGroup = new THREE.Group();
      logGroup.position.set(Math.cos(ang) * 0.24, 0.11 + (l % 2) * 0.02, Math.sin(ang) * 0.24);
      logGroup.rotation.y = -ang + Math.PI / 2;
      logGroup.rotation.x = 0.22;

      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.062, 0.56, 7), timberMat);
      log.rotation.x = Math.PI / 2;
      log.castShadow = true;
      logGroup.add(log);

      const emberTip = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.050, 0.16, 7), emberTipMat);
      emberTip.rotation.x = Math.PI / 2;
      emberTip.position.z = -0.22;
      logGroup.add(emberTip);

      campGroup.add(logGroup);
    }

    // Glowing coal/ember bed at the center of the logs
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xff5518,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.88,
    });
    const emberBed = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), emberMat);
    emberBed.scale.set(1.15, 0.28, 1.15);
    emberBed.position.y = 0.08;
    campGroup.add(emberBed);

    // Organic Multi-Lobed Flickering Fire (8 low, wide, overlapping flame tongues — no giant pointy triangle!)
    const flameSpecs = [
      { r: 0.20, h: 0.36, color: 0xff5212, op: 0.45, x: 0.0, z: 0.0 },
      { r: 0.16, h: 0.44, color: 0xff881c, op: 0.42, x: 0.07, z: -0.05 },
      { r: 0.15, h: 0.40, color: 0xff9824, op: 0.40, x: -0.07, z: 0.05 },
      { r: 0.14, h: 0.38, color: 0xffaa2c, op: 0.38, x: 0.05, z: 0.07 },
      { r: 0.14, h: 0.35, color: 0xff7418, op: 0.42, x: -0.06, z: -0.06 },
      { r: 0.11, h: 0.48, color: 0xffcc44, op: 0.44, x: 0.02, z: -0.02 },
      { r: 0.09, h: 0.34, color: 0xffe880, op: 0.52, x: -0.02, z: 0.02 },
      { r: 0.12, h: 0.28, color: 0xfff2aa, op: 0.55, x: 0.0, z: 0.0 },
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
      // Softly rounded teardrop/ovoid flame lobe instead of a sharp cone
      const geom = new THREE.SphereGeometry(sp.r, 8, 8);
      geom.scale(0.85, sp.h / (sp.r * 2), 0.85);
      geom.translate(0, sp.h * 0.45, 0);
      const flame = new THREE.Mesh(geom, flameMat);
      flame.position.set(sp.x, 0.08, sp.z);
      this.flameMeshes.push(flame);
      campGroup.add(flame);
    }

    // 3-Legged Iron Cooking Tripod + Suspended Cast-Iron Kettle over the Fire (matching ref_camp_and_sun_mirror!)
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x262422,
      metalness: 0.78,
      roughness: 0.42,
    });
    const tripodApexY = 1.32;
    const tripodRadius = 0.74;
    for (let leg = 0; leg < 3; leg++) {
      const ang = (leg / 3) * Math.PI * 2 + 0.35;
      const startV = new THREE.Vector3(Math.cos(ang) * tripodRadius, 0.0, Math.sin(ang) * tripodRadius);
      const endV = new THREE.Vector3(0, tripodApexY, 0);
      const legLen = startV.distanceTo(endV);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, legLen, 6), ironMat);
      pole.position.copy(startV).lerp(endV, 0.5);
      pole.lookAt(endV);
      pole.rotateX(Math.PI / 2);
      pole.castShadow = true;
      campGroup.add(pole);
    }
    // Hanging iron chain & cast-iron camp cooking pot
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.58, 6), ironMat);
    chain.position.set(0, tripodApexY - 0.29, 0);
    campGroup.add(chain);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.20, 14), ironMat);
    pot.position.set(0, 0.64, 0);
    pot.castShadow = true;
    campGroup.add(pot);

    const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 14), ironMat);
    potRim.rotation.x = Math.PI / 2;
    potRim.position.set(0, 0.74, 0);
    campGroup.add(potRim);

    // Rising glowing ember sparks
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let s = 0; s < 6; s++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), sparkMat);
      spark.position.set(0, 0.25 + s * 0.16, 0);
      this.sparkMeshes.push(spark);
      campGroup.add(spark);
    }

    // Weathered Olive-Canvas Expedition A-Frame Shelter Tent & Camp Gear beside the fire (matching ref_camp_and_sun_mirror)
    const tentCanvasTex = this.texLoader.load(
      MOBILE
        ? '/juzu/assets/character-textures/character-canvas_1k.webp'
        : '/juzu/assets/character-textures/character-canvas.jpeg'
    );
    tentCanvasTex.colorSpace = THREE.SRGBColorSpace;
    tentCanvasTex.anisotropy = MOBILE ? 2 : 8;
    tentCanvasTex.wrapS = tentCanvasTex.wrapT = THREE.ClampToEdgeWrapping;
    tentCanvasTex.offset.set(0.08, 0.08);
    tentCanvasTex.repeat.set(0.84, 0.84);

    const tentCanvasMat = new THREE.MeshStandardMaterial({
      map: tentCanvasTex,
      bumpMap: tentCanvasTex,
      bumpScale: 0.018,
      color: 0x7e765a,
      roughness: 0.90,
      metalness: 0.01,
      side: THREE.DoubleSide,
    });
    const tentDarkInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x161410,
      roughness: 0.96,
    });
    const tentGroup = new THREE.Group();
    tentGroup.position.set(1.55, 0.0, -1.05);
    tentGroup.rotation.y = -0.72;

    // A-frame sloped canvas roof panels with realistic catenary cloth sag & guy-ropes
    for (const side of [-1, 1]) {
      const panelGeom = new THREE.BoxGeometry(0.025, 1.55, 2.15, 1, 10, 12);
      const pAttr = panelGeom.attributes.position as THREE.BufferAttribute;
      for (let vi = 0; vi < pAttr.count; vi++) {
        const lx = pAttr.getX(vi);
        const ly = pAttr.getY(vi); // -0.775 (eave) .. +0.775 (ridge)
        const lz = pAttr.getZ(vi); // -1.075 .. +1.075 along ridge
        const uSpan = (ly + 0.775) / 1.55;
        const vSpan = (lz + 1.075) / 2.15;
        // Natural catenary fabric belly sag between front/back poles and ridge/eave
        const bellySag = Math.sin(uSpan * Math.PI) * Math.sin(vSpan * Math.PI) * 0.065;
        const hemRipple = Math.sin(vSpan * Math.PI * 5.0) * 0.012 * Math.sin(uSpan * Math.PI);
        pAttr.setX(vi, lx - (bellySag + hemRipple) * side);
      }
      panelGeom.computeVertexNormals();

      const panel = new THREE.Mesh(panelGeom, tentCanvasMat);
      panel.position.set(side * 0.44, 0.62, 0);
      panel.rotation.z = side * 0.58;
      panel.castShadow = true;
      panel.receiveShadow = true;
      tentGroup.add(panel);

      // Tension guy-ropes & wooden ground stakes anchoring the tent eaves
      for (const gz of [-0.92, 0.0, 0.92]) {
        const ropeCurve = new THREE.LineCurve3(
          new THREE.Vector3(side * 0.86, 0.04, gz),
          new THREE.Vector3(side * 1.18, -0.02, gz * 1.04)
        );
        const guyRope = new THREE.Mesh(
          new THREE.TubeGeometry(ropeCurve, 4, 0.008, 5, false),
          timberMat
        );
        tentGroup.add(guyRope);

        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.006, 0.22, 6), timberMat);
        stake.position.set(side * 1.18, 0.02, gz * 1.04);
        stake.rotation.z = -side * 0.35;
        tentGroup.add(stake);
      }
    }

    // Recessed dark interior gable & groundsheet inside the A-frame tent
    const floorMat = new THREE.MeshStandardMaterial({
      map: tentCanvasTex,
      color: 0x3d3628,
      roughness: 0.94,
    });
    const groundSheet = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.04, 2.05), floorMat);
    groundSheet.position.set(0, 0.02, 0);
    groundSheet.receiveShadow = true;
    tentGroup.add(groundSheet);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-0.84, 0);
    gableShape.lineTo(0.84, 0);
    gableShape.lineTo(0, 1.24);
    gableShape.closePath();
    const gableGeom = new THREE.ShapeGeometry(gableShape);
    const backGable = new THREE.Mesh(gableGeom, tentDarkInteriorMat);
    backGable.position.set(0, 0.02, -0.95);
    tentGroup.add(backGable);
    const midShadowGable = new THREE.Mesh(gableGeom, tentDarkInteriorMat);
    midShadowGable.position.set(0, 0.02, 0.25);
    tentGroup.add(midShadowGable);

    const ridgePole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.35, 8), timberMat);
    ridgePole.rotation.x = Math.PI / 2;
    ridgePole.position.set(0, 1.24, 0);
    ridgePole.castShadow = true;
    tentGroup.add(ridgePole);

    // Front & rear vertical timber tent poles supporting the ridge pole
    for (const pz of [-1.08, 1.08]) {
      const uprightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 1.28, 8), timberMat);
      uprightPole.position.set(0, 0.62, pz);
      uprightPole.castShadow = true;
      tentGroup.add(uprightPole);
    }

    campGroup.add(tentGroup);

    // Stone seat, bedroll & warm brass expedition lantern
    const seatStone = new THREE.Mesh(createIncaBlock(0.85, 0.42, 0.58, 0.08, 1.4), stoneMat);
    seatStone.position.set(1.25, 0.18, 0.55);
    seatStone.rotation.y = -0.35;
    seatStone.castShadow = true;
    seatStone.receiveShadow = true;
    campGroup.add(seatStone);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb58938,
      metalness: 0.85,
      roughness: 0.32,
    });
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.06, 10), brassMat);
    lanternBase.position.set(1.22, 0.42, 0.55);
    campGroup.add(lanternBase);

    const lanternGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd27d })
    );
    lanternGlass.position.set(1.22, 0.51, 0.55);
    campGroup.add(lanternGlass);

    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 10), brassMat);
    lanternCap.position.set(1.22, 0.6, 0.55);
    campGroup.add(lanternCap);

    const fireLight = new THREE.PointLight(0xff8830, 2.6, 15, 1.4);
    fireLight.position.y = 0.85;
    this.fireLight = fireLight;
    campGroup.add(fireLight);

    this.group.add(campGroup);
  }

  private buildWaterfallChuteGeometry(
    topWidth: number,
    bottomWidth: number,
    height: number,
    depthArc: number,
    segX = 16,
    segY = 32
  ): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let iy = 0; iy <= segY; iy++) {
      const v = iy / segY;
      const y = (1.0 - v) * height;
      // Stepped cascade profile over rock ledges rather than a smooth uniform cylinder arc
      const rockStepBump =
        Math.sin(v * Math.PI * 3.0) * 0.22 + Math.sin(v * Math.PI * 7.0 + 0.8) * 0.09;
      const z = (1.0 - Math.cos(v * Math.PI * 0.5)) * depthArc + v * 0.35 + rockStepBump;
      const width =
        THREE.MathUtils.lerp(topWidth, bottomWidth, v) *
        (1.0 + Math.sin(v * Math.PI * 4.0) * 0.08);

      for (let ix = 0; ix <= segX; ix++) {
        const u = ix / segX;
        const xNorm = (u - 0.5) * 2.0;
        const edgeWave = Math.sin(v * 14.0 + u * 5.0) * 0.18 * Math.abs(xNorm);
        const x = (u - 0.5) * width + edgeWave;
        const curlZ =
          -(xNorm * xNorm) * 0.35 * (1.0 - v * 0.4) +
          Math.cos(u * Math.PI * 3.0 + v * 9.0) * 0.12;

        positions.push(x, y, z + curlZ);
        normals.push(0, 0, 1);
        uvs.push(u, v * 5.0);

        // Lateral edge feathering + aerated whitewater crest & stepped ledge foam gradient
        const edgeFade = Math.max(0.18, 1.0 - Math.pow(Math.abs(xNorm), 2.2) * 0.82);
        const stepFoam = Math.max(0, Math.cos(v * Math.PI * 3.0)) * 0.16;
        const plungeFoam = Math.sin(v * Math.PI) * 0.18 + v * 0.22 + stepFoam;
        const r = THREE.MathUtils.clamp((0.68 + plungeFoam) * edgeFade, 0.15, 1.0);
        const g = THREE.MathUtils.clamp((0.84 + plungeFoam * 0.7) * edgeFade, 0.20, 1.0);
        const b = THREE.MathUtils.clamp((0.90 + plungeFoam * 0.5) * edgeFade, 0.22, 1.0);
        colors.push(r, g, b);
      }
    }

    for (let iy = 0; iy < segY; iy++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iy * (segX + 1) + ix;
        const b = (iy + 1) * (segX + 1) + ix;
        const c = (iy + 1) * (segX + 1) + (ix + 1);
        const d = iy * (segX + 1) + (ix + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  public loadScannedAssets(): void {
    if (this.scansRequested || MOBILE) {
      this.isLoaded = true;
      return;
    }
    this.scansRequested = true;
    const fallsGroup = this.fallsGroup;

    let pendingScans = 5;
    const checkScansLoaded = () => {
      pendingScans--;
      if (pendingScans <= 0) {
        this.isLoaded = true;
      }
    };

    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // 1. Photorealistic Scanned Escarpment Cliff (namaqualand_cliff_01)
    gltfLoader.load(
      '/juzu/models/scans/namaqualand_cliff_01.glb',
      (gltf) => {
        let cliffGeom: THREE.BufferGeometry | null = null;
        let cliffMat: THREE.Material | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !cliffGeom) {
            const mesh = child as THREE.Mesh;
            cliffGeom = mesh.geometry.clone();
            cliffMat = mesh.material as THREE.Material;
            if (cliffMat instanceof THREE.MeshStandardMaterial) {
              cliffMat.roughness = 0.90;
              cliffMat.metalness = 0.02;
              if (cliffMat.map) {
                cliffMat.map.colorSpace = THREE.SRGBColorSpace;
                cliffMat.map.anisotropy = 8;
              }
              if (cliffMat.normalMap) {
                cliffMat.normalMap.anisotropy = 8;
                cliffMat.normalScale = new THREE.Vector2(1.3, 1.3);
              }
            }
          }
        });

        if (cliffGeom && cliffMat) {
          const cliffPlacements = [
            // Waterfall backwall rock face directly behind cascading chute
            { x: 0.0, y: 0.8, z: -3.6, sx: 1.35, sy: 2.3, sz: 1.1, ry: -1.0 },
            // North flank framing the left chute
            { x: -5.4, y: 0.6, z: -1.6, sx: 1.2, sy: 2.1, sz: 1.15, ry: 0.42 },
            // South flank framing the right chute
            { x: 5.6, y: 0.5, z: -1.8, sx: 1.25, sy: 2.1, sz: 1.1, ry: -0.38 },
            // Upper headwall crest above the waterfall lip
            { x: 0.4, y: 7.2, z: -4.8, sx: 1.45, sy: 1.7, sz: 1.2, ry: 3.14 },
            // South gorge canyon wall extending toward the suspension bridge
            { x: -12.5, y: 0.2, z: 12.0, sx: 1.5, sy: 2.0, sz: 1.3, ry: 1.18 },
            // North gorge canyon wall extending toward the cliff sanctuary
            { x: -12.0, y: 0.3, z: -14.0, sx: 1.5, sy: 2.0, sz: 1.3, ry: -1.12 },
            // Bluff wall underneath the suspension bridge
            { x: -22.5, y: 0.1, z: 0.0, sx: 1.6, sy: 2.1, sz: 1.4, ry: 0.78 },
            // Escarpment terraces along the right gorge slope
            { x: 4.8, y: 1.8, z: 10.5, sx: 2.2, sy: 2.4, sz: 1.9, ry: -0.72 },
            { x: -1.5, y: 3.2, z: 18.0, sx: 2.4, sy: 2.7, sz: 2.1, ry: -1.15 },
            { x: 6.2, y: 3.6, z: 19.5, sx: 2.0, sy: 2.5, sz: 1.8, ry: -0.58 },
            { x: -7.5, y: 2.0, z: 15.0, sx: 2.1, sy: 2.4, sz: 1.9, ry: 1.35 },
            { x: 8.8, y: 1.2, z: 3.5, sx: 1.8, sy: 2.2, sz: 1.7, ry: -0.42 },
          ];

          const cliffInstMesh = new THREE.InstancedMesh(cliffGeom, cliffMat, cliffPlacements.length);
          cliffInstMesh.castShadow = true;
          cliffInstMesh.receiveShadow = true;

          const dummy = new THREE.Object3D();
          for (let i = 0; i < cliffPlacements.length; i++) {
            const p = cliffPlacements[i];
            dummy.position.set(p.x, p.y, p.z);
            const scaleAvg = (p.sx + p.sz) * 0.5;
            dummy.scale.set(p.sx, scaleAvg, p.sz);
            dummy.rotation.set(0, p.ry, 0);
            dummy.updateMatrix();
            cliffInstMesh.setMatrixAt(i, dummy.matrix);
          }
          cliffInstMesh.instanceMatrix.needsUpdate = true;
          fallsGroup.add(cliffInstMesh);
        }
        checkScansLoaded();
      },
      undefined,
      (err) => {
        console.warn('[CloudForest] Could not load scanned cliff, using fallback:', err);
        checkScansLoaded();
      }
    );

    // 2. Photorealistic Scanned Riverbed Boulders (boulder_01)
    gltfLoader.load(
      '/juzu/models/scans/boulder_01.glb',
      (gltf) => {
        let bldGeom: THREE.BufferGeometry | null = null;
        let bldMat: THREE.Material | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !bldGeom) {
            const mesh = child as THREE.Mesh;
            bldGeom = mesh.geometry.clone();
            bldMat = mesh.material as THREE.Material;
            if (bldMat instanceof THREE.MeshStandardMaterial) {
              bldMat.roughness = 0.88;
              bldMat.metalness = 0.02;
              if (bldMat.map) {
                bldMat.map.colorSpace = THREE.SRGBColorSpace;
                bldMat.map.anisotropy = 8;
              }
              if (bldMat.normalMap) {
                bldMat.normalMap.anisotropy = 8;
                bldMat.normalScale = new THREE.Vector2(1.25, 1.25);
              }
            }
          }
        });

        if (bldGeom && bldMat) {
          const riverRocks = [
            { x: -14.5, z: -12.0, s: 2.8, ry: 0.4 },
            { x: -19.2, z: -10.5, s: 3.2, ry: 1.8 },
            { x: -16.8, z: -14.2, s: 2.4, ry: 2.5 },
            { x: -21.5, z: -13.0, s: 3.0, ry: 0.9 },
            { x: -12.0, z: -9.8, s: 2.6, ry: 3.1 },
            { x: -6.5, z: -11.5, s: 2.9, ry: 1.4 },
            { x: -3.8, z: -8.4, s: 2.2, ry: 0.6 },
            { x: 4.1, z: -12.1, s: 2.5, ry: 2.1 },
            { x: 0.5, z: -14.8, s: 3.4, ry: 1.1 },
            { x: -2.2, z: -16.2, s: 2.0, ry: 2.9 },
            { x: 3.2, z: -17.0, s: 2.3, ry: 0.3 },
          ];

          const boulderInstMesh = new THREE.InstancedMesh(bldGeom, bldMat, riverRocks.length);
          boulderInstMesh.castShadow = true;
          boulderInstMesh.receiveShadow = true;

          const dummy = new THREE.Object3D();
          for (let i = 0; i < riverRocks.length; i++) {
            const r = riverRocks[i];
            dummy.position.set(r.x, 0.16, r.z);
            dummy.scale.set(r.s, r.s, r.s);
            dummy.rotation.set(0, r.ry, 0);
            dummy.updateMatrix();
            boulderInstMesh.setMatrixAt(i, dummy.matrix);
          }
          boulderInstMesh.instanceMatrix.needsUpdate = true;
          fallsGroup.add(boulderInstMesh);
        }
        checkScansLoaded();
      },
      undefined,
      (err) => {
        console.warn('[CloudForest] Could not load scanned boulder, using fallback:', err);
        checkScansLoaded();
      }
    );

    // 3. Photorealistic Scanned Granite Cliff Ledges (namaqualand_cliff_02)
    gltfLoader.load(
      '/juzu/models/scans/namaqualand_cliff_02.glb',
      (gltf) => {
        let ledgeGeom: THREE.BufferGeometry | null = null;
        let ledgeMat: THREE.Material | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !ledgeGeom) {
            const mesh = child as THREE.Mesh;
            ledgeGeom = mesh.geometry.clone();
            ledgeMat = mesh.material as THREE.Material;
            if (ledgeMat instanceof THREE.MeshStandardMaterial) {
              ledgeMat.roughness = 0.90;
              ledgeMat.metalness = 0.02;
              if (ledgeMat.map) {
                ledgeMat.map.colorSpace = THREE.SRGBColorSpace;
                ledgeMat.map.anisotropy = 8;
              }
              if (ledgeMat.normalMap) {
                ledgeMat.normalMap.anisotropy = 8;
                ledgeMat.normalScale = new THREE.Vector2(1.35, 1.35);
              }
            }
          }
        });

        if (ledgeGeom && ledgeMat) {
          const ledgePlacements = [
            // Waterfall upper crest shelf
            { x: 3.5, y: 7.2, z: -6.5, sx: 0.85, sy: 0.9, sz: 0.85, ry: -1.25 },
            // North canyon rim overlook
            { x: -7.5, y: 6.8, z: -7.0, sx: 0.9, sy: 0.95, sz: 0.9, ry: 0.75 },
            // South gorge high bluff
            { x: -14.0, y: 4.5, z: 14.5, sx: 1.0, sy: 1.0, sz: 0.95, ry: 1.35 },
            // North gorge upper terrace
            { x: -16.5, y: 4.0, z: -16.0, sx: 1.0, sy: 1.05, sz: 1.0, ry: -1.1 },
            // Hanging bridge south abutment shelf
            { x: -24.5, y: 2.5, z: 8.5, sx: 0.95, sy: 0.9, sz: 0.9, ry: 0.82 },
            // Hanging bridge north abutment shelf
            { x: -25.0, y: 2.8, z: -9.5, sx: 0.95, sy: 0.95, sz: 0.9, ry: -0.92 },
          ];

          const ledgeInstMesh = new THREE.InstancedMesh(ledgeGeom, ledgeMat, ledgePlacements.length);
          ledgeInstMesh.castShadow = true;
          ledgeInstMesh.receiveShadow = true;

          const dummy = new THREE.Object3D();
          for (let i = 0; i < ledgePlacements.length; i++) {
            const p = ledgePlacements[i];
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.set(p.sx, p.sy, p.sz);
            dummy.rotation.set(0, p.ry, 0);
            dummy.updateMatrix();
            ledgeInstMesh.setMatrixAt(i, dummy.matrix);
          }
          ledgeInstMesh.instanceMatrix.needsUpdate = true;
          fallsGroup.add(ledgeInstMesh);
        }
        checkScansLoaded();
      },
      undefined,
      (err) => {
        console.warn('[CloudForest] Could not load scanned cliff ledge, using fallback:', err);
        checkScansLoaded();
      }
    );

    // 4. Photorealistic Scanned Water-Worn Riverbed Shelves (coast_land_rocks_02)
    gltfLoader.load(
      '/juzu/models/scans/coast_land_rocks_02.glb',
      (gltf) => {
        let shelfGeom: THREE.BufferGeometry | null = null;
        let shelfMat: THREE.Material | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !shelfGeom) {
            const mesh = child as THREE.Mesh;
            shelfGeom = mesh.geometry.clone();
            shelfMat = mesh.material as THREE.Material;
            if (shelfMat instanceof THREE.MeshStandardMaterial) {
              shelfMat.roughness = 0.82;
              shelfMat.metalness = 0.02;
              if (shelfMat.map) {
                shelfMat.map.colorSpace = THREE.SRGBColorSpace;
                shelfMat.map.anisotropy = 8;
              }
              if (shelfMat.normalMap) {
                shelfMat.normalMap.anisotropy = 8;
                shelfMat.normalScale = new THREE.Vector2(1.3, 1.3);
              }
            }
          }
        });

        if (shelfGeom && shelfMat) {
          const shelfPlacements = [
            // Plunge pool basin rim where cascade pours into the river
            { x: -2.0, y: -0.12, z: 2.5, sx: 1.1, sy: 0.75, sz: 1.1, ry: -0.7 },
            // Upper river rapid shelf
            { x: -8.5, y: -0.15, z: 7.2, sx: 1.25, sy: 0.7, sz: 1.3, ry: 0.35 },
            // Mid-river gorge bedrock shelf
            { x: -15.2, y: -0.18, z: 12.8, sx: 1.3, sy: 0.68, sz: 1.35, ry: 1.15 },
            // Rapids shelf underneath the suspension bridge
            { x: -21.8, y: -0.15, z: 2.0, sx: 1.4, sy: 0.72, sz: 1.4, ry: -0.45 },
            // Downstream western gorge channel shelf
            { x: -28.5, y: -0.20, z: -1.5, sx: 1.45, sy: 0.7, sz: 1.4, ry: 0.65 },
          ];

          const shelfInstMesh = new THREE.InstancedMesh(shelfGeom, shelfMat, shelfPlacements.length);
          shelfInstMesh.castShadow = true;
          shelfInstMesh.receiveShadow = true;

          const dummy = new THREE.Object3D();
          for (let i = 0; i < shelfPlacements.length; i++) {
            const p = shelfPlacements[i];
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.set(p.sx, p.sy, p.sz);
            dummy.rotation.set(0, p.ry, 0);
            dummy.updateMatrix();
            shelfInstMesh.setMatrixAt(i, dummy.matrix);
          }
          shelfInstMesh.instanceMatrix.needsUpdate = true;
          fallsGroup.add(shelfInstMesh);
        }
        checkScansLoaded();
      },
      undefined,
      (err) => {
        console.warn('[CloudForest] Could not load scanned riverbed shelf, using fallback:', err);
        checkScansLoaded();
      }
    );

    // 5. Photorealistic Scanned Incan Citadel & Bastion Architecture (modular_fort_01)
    gltfLoader.load(
      '/juzu/models/scans/modular_fort_01.glb',
      (gltf) => {
        const bastionGroup = new THREE.Group();
        bastionGroup.name = 'Inca_North_Sanctuary_Bastion';
        this.group.add(bastionGroup);

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material instanceof THREE.MeshStandardMaterial) {
              mesh.material.roughness = 0.86;
              mesh.material.metalness = 0.02;
              if (mesh.material.map) {
                mesh.material.map.colorSpace = THREE.SRGBColorSpace;
                mesh.material.map.anisotropy = 8;
              }
              if (mesh.material.normalMap) {
                mesh.material.normalMap.anisotropy = 8;
                mesh.material.normalScale = new THREE.Vector2(1.35, 1.35);
              }
            }
          }
        });

        let towerNode: THREE.Object3D | null = null;
        let wallStraightNode: THREE.Object3D | null = null;
        let wallCornerNode: THREE.Object3D | null = null;

        gltf.scene.traverse((child) => {
          if (child.name === 'modular_fort_01_tower_round' && !towerNode) {
            towerNode = child;
          } else if (child.name === 'modular_fort_01_wall_thick_straight_01' && !wallStraightNode) {
            wallStraightNode = child;
          } else if (child.name === 'modular_fort_01_wall_thick_corner_01' && !wallCornerNode) {
            wallCornerNode = child;
          }
        });

        if (towerNode && wallStraightNode) {
          // Twin flanking round bastion towers
          const towerL = (towerNode as THREE.Object3D).clone(true);
          const tyL = standAt(-11.5, -42.0);
          towerL.position.set(-11.5, tyL, -42.0);
          towerL.scale.set(0.65, 0.75, 0.65);
          bastionGroup.add(towerL);

          const towerR = (towerNode as THREE.Object3D).clone(true);
          const tyR = standAt(11.5, -42.0);
          towerR.position.set(11.5, tyR, -42.0);
          towerR.scale.set(0.65, 0.75, 0.65);
          bastionGroup.add(towerR);

          // Defensive curtain ramparts connecting the gateway to the flank towers
          const wallL = (wallStraightNode as THREE.Object3D).clone(true);
          const wyL = standAt(-6.2, -40.5);
          wallL.position.set(-6.2, wyL, -40.5);
          wallL.scale.set(0.75, 0.72, 0.75);
          bastionGroup.add(wallL);

          const wallR = (wallStraightNode as THREE.Object3D).clone(true);
          const wyR = standAt(6.2, -40.5);
          wallR.position.set(6.2, wyR, -40.5);
          wallR.scale.set(0.75, 0.72, 0.75);
          bastionGroup.add(wallR);

          // Rear megalithic sanctuary wall enclosing the sacred Chakana Stele
          const rearWall = (wallStraightNode as THREE.Object3D).clone(true);
          const ry = standAt(0, -48.5);
          rearWall.position.set(0, ry, -48.5);
          rearWall.scale.set(1.1, 0.85, 0.85);
          bastionGroup.add(rearWall);

          if (wallCornerNode) {
            const cornerL = (wallCornerNode as THREE.Object3D).clone(true);
            const cyL = standAt(-7.5, -47.5);
            cornerL.position.set(-7.5, cyL, -47.5);
            cornerL.scale.set(0.75, 0.80, 0.75);
            bastionGroup.add(cornerL);

            const cornerR = (wallCornerNode as THREE.Object3D).clone(true);
            const cyR = standAt(7.5, -47.5);
            cornerR.position.set(7.5, cyR, -47.5);
            cornerR.scale.set(0.75, 0.80, 0.75);
            cornerR.rotation.y = Math.PI / 2;
            bastionGroup.add(cornerR);
          }
        }

        checkScansLoaded();
      },
      undefined,
      (err) => {
        console.warn('[CloudForest] Could not load modular fort scans, using fallback:', err);
        checkScansLoaded();
      }
    );
  }

  private buildGorgeWaterfall(stoneMat: THREE.MeshStandardMaterial): void {
    // Cascading Andean mountain waterfall pouring down Horizontally Stratified Craggy Cliff Ledges
    // into the Urubamba River (-2.2m)
    const fallsGroup = this.fallsGroup;
    const wx = 17.5;
    const wz = -29.5;
    fallsGroup.position.set(wx, -2.2, wz);

    if (MOBILE) {
      this.isLoaded = true;
    }

    // Synchronous wet dark-slate bedrock cliff ledges behind & beside the waterfall cascade
    const wetBedrockMat = stoneMat.clone();
    wetBedrockMat.color = new THREE.Color(0x4a524e);
    wetBedrockMat.roughness = 0.48;

    // Physical Cascading Waterfall Chute & Whitewater Foam
    const waterNor = this.texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(3, 12);
    this.waterfallNormalMap = waterNor;

    const cascadeGroup = new THREE.Group();
    cascadeGroup.rotation.y = -1.05;
    fallsGroup.add(cascadeGroup);

    // Stepped wet granite cliff ledges backing the main and side cascades so water pours over solid rock
    const rockTiers = [
      { x: 0.0, y: 10.2, z: -2.55, w: 6.8, h: 3.4, d: 2.4, ry: 0.04 },
      { x: 0.2, y: 6.8, z: -1.65, w: 7.6, h: 3.8, d: 2.8, ry: -0.05 },
      { x: -0.2, y: 3.2, z: -0.75, w: 8.4, h: 4.0, d: 3.2, ry: 0.03 },
      { x: 3.6, y: 7.4, z: -1.95, w: 3.8, h: 3.5, d: 2.2, ry: 0.22 },
      { x: 3.8, y: 3.6, z: -0.95, w: 4.4, h: 4.0, d: 2.6, ry: 0.18 },
      { x: -4.2, y: 5.5, z: -1.60, w: 3.6, h: 7.5, d: 2.8, ry: -0.28 },
    ];
    for (const rt of rockTiers) {
      const rockBlock = new THREE.Mesh(
        createIncaBlock(rt.w, rt.h, rt.d, 0.22, 1.4),
        wetBedrockMat
      );
      rockBlock.position.set(rt.x, rt.y, rt.z);
      rockBlock.rotation.y = rt.ry;
      rockBlock.castShadow = true;
      rockBlock.receiveShadow = true;
      cascadeGroup.add(rockBlock);
    }

    const mainChuteGeom = this.buildWaterfallChuteGeometry(4.2, 6.8, 12.2, 2.2, 18, 36);
    const mainWaterMat = new THREE.MeshStandardMaterial({
      color: 0xc8e4ec,
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.04,
      transparent: true,
      opacity: 0.62,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(2.2, 2.2),
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mainCascade = new THREE.Mesh(mainChuteGeom, mainWaterMat);
    mainCascade.position.set(0, 0.1, -1.8);
    mainCascade.castShadow = false;
    mainCascade.receiveShadow = true;
    mainCascade.userData.baseY = 0.1;
    this.waterfallStrips.push(mainCascade);
    cascadeGroup.add(mainCascade);

    // Inner aerated whitewater cascade sheet
    const innerChuteGeom = this.buildWaterfallChuteGeometry(3.5, 5.8, 12.0, 2.0, 16, 32);
    const innerFoamMat = new THREE.MeshStandardMaterial({
      color: 0xf4fcff,
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.02,
      transparent: true,
      opacity: 0.46,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(1.5, 1.5),
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerCascade = new THREE.Mesh(innerChuteGeom, innerFoamMat);
    innerCascade.position.set(0, 0.2, -1.9);
    innerCascade.castShadow = false;
    innerCascade.receiveShadow = true;
    innerCascade.userData.baseY = 0.2;
    this.waterfallStrips.push(innerCascade);
    cascadeGroup.add(innerCascade);

    // Secondary braided side cascade chute
    const sideChuteGeom = this.buildWaterfallChuteGeometry(1.8, 3.2, 9.4, 1.6, 12, 24);
    const sideCascade = new THREE.Mesh(sideChuteGeom, mainWaterMat);
    sideCascade.position.set(3.4, 0.1, -1.2);
    sideCascade.rotation.y = 0.22;
    sideCascade.userData.baseY = 0.1;
    this.waterfallStrips.push(sideCascade);
    cascadeGroup.add(sideCascade);

    // 4. Soft Billowing Mountain Plunge Mist Plumes (Non-additive, subtle physical vapor)
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xdeeef3,
      transparent: true,
      opacity: 0.045,
      roughness: 0.95,
      depthWrite: false,
    });
    for (let m = 0; m < 7; m++) {
      const plume = new THREE.Mesh(new THREE.SphereGeometry(1.8 + (m % 2) * 0.6, 10, 8), mistMat);
      plume.position.set(
        (m - 3.0) * 1.0,
        m === 5 ? 5.2 : 0.6 + (m % 2) * 0.4,
        m === 5 ? -1.0 : 1.2 + (m % 2) * 0.5
      );
      this.mistPlumes.push(plume);
      cascadeGroup.add(plume);
    }

    // 5. Concentric plunge-pool surface foam rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4eaf2,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6 + r * 1.2, 2.0 + r * 1.25, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.06, 0.6);
      cascadeGroup.add(ring);
    }

    this.group.add(fallsGroup);
  }

  private buildAtmosphereMotes(): void {
    // Seeded 3D floating sunlit forest dust & pollen motes across South Camp, Gorge Bridge, and North Sanctuary
    const moteCount = MOBILE ? 45 : 120;
    const positions = new Float32Array(moteCount * 3);
    const colors = new Float32Array(moteCount * 3);

    for (let i = 0; i < moteCount; i++) {
      const h1 = Math.sin(i * 12.9898 + 1.23) * 43758.5453;
      const u1 = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 78.233 + 4.56) * 24634.6345;
      const u2 = h2 - Math.floor(h2);
      const h3 = Math.sin(i * 37.719 + 7.89) * 19283.7465;
      const u3 = h3 - Math.floor(h3);

      const x = (u1 - 0.5) * 32.0;
      const z = 14.0 - u2 * 64.0; // Spans z = +14 (South Camp) across gorge to z = -50 (North Sanctuary)
      const baseH = Math.max(3.5, standAt(x, z));
      const y = baseH + 0.65 + u3 * 4.5;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Warm golden-cream sunlit pollen & dust tint
      const warm = 0.85 + (i % 4) * 0.05;
      colors[i * 3] = 1.0 * warm;
      colors[i * 3 + 1] = 0.92 * warm;
      colors[i * 3 + 2] = 0.68 * warm;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geom, mat);
    this.pollenPoints = points;
    this.group.add(points);
  }

  private buildSkidDebrisSystem(): void {
    const count = 90;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));

    const mat = new THREE.PointsMaterial({
      size: MOBILE ? 2.5 : 3.5,
      sizeAttenuation: false,
      color: 0xc8b69b, // Warm dry Andean mineral soil
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    this.skidParticles = new THREE.Points(geom, mat);
    this.skidParticles.frustumCulled = false;
    this.group.add(this.skidParticles);

    for (let i = 0; i < count; i++) {
      this.skidLifetimes[i] = 0;
      this.skidPositions[i * 3 + 1] = -999;
    }
  }

  public emitSkidDebris(pos: THREE.Vector3): void {
    if (!this.skidParticles) return;
    const burst = 4;
    for (let b = 0; b < burst; b++) {
      const i = this.skidIdx;
      this.skidIdx = (this.skidIdx + 1) % 90;

      const spread = 0.22;
      this.skidPositions[i * 3] = pos.x + (Math.random() - 0.5) * spread;
      this.skidPositions[i * 3 + 1] = pos.y + 0.08 + Math.random() * 0.08;
      this.skidPositions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;

      this.skidVelocities[i * 3] = (Math.random() - 0.5) * 1.4;
      this.skidVelocities[i * 3 + 1] = 0.8 + Math.random() * 1.2;
      this.skidVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.4;

      this.skidLifetimes[i] = 0.38;
    }
  }
}
