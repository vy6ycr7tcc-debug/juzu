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

    // Authentic 2048x2048 Andean PBR Polygonal Stone & Timber Materials (world-space UV ready)
    const stoneDiff = this.texLoader.load('/juzu/assets/environment-textures/environment-stonework.jpeg');
    stoneDiff.colorSpace = THREE.SRGBColorSpace;
    stoneDiff.anisotropy = 8;
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;

    const stoneNor = this.texLoader.load('/juzu/assets/environment-textures/environment-stonework-normal.jpg');
    stoneNor.anisotropy = 8;
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;

    const stoneRough = this.texLoader.load('/juzu/assets/environment-textures/environment-stonework-roughness.jpg');
    stoneRough.anisotropy = 8;
    stoneRough.wrapS = stoneRough.wrapT = THREE.RepeatWrapping;

    const ashlarStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughnessMap: stoneRough,
        metalness: 0.03,
        roughness: 0.82,
        color: 0xffffff,
        vertexColors: true,
      })
    );

    const plankDiff = this.texLoader.load('/juzu/assets/environment-textures/environment-planks.jpeg');
    plankDiff.colorSpace = THREE.SRGBColorSpace;
    plankDiff.anisotropy = 8;
    plankDiff.wrapS = plankDiff.wrapT = THREE.RepeatWrapping;
    plankDiff.repeat.set(1.0, 0.35);

    const plankNor = this.texLoader.load('/juzu/assets/environment-textures/environment-planks-normal.jpg');
    plankNor.anisotropy = 8;
    plankNor.wrapS = plankNor.wrapT = THREE.RepeatWrapping;
    plankNor.repeat.set(1.0, 0.35);

    const plankRough = this.texLoader.load('/juzu/assets/environment-textures/environment-planks-roughness.jpg');
    plankRough.anisotropy = 8;
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

    const paveDiff = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_diff.jpg');
    paveDiff.colorSpace = THREE.SRGBColorSpace;
    paveDiff.anisotropy = 8;
    paveDiff.wrapS = paveDiff.wrapT = THREE.RepeatWrapping;

    const paveNor = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_nor.jpg');
    paveNor.anisotropy = 8;
    paveNor.wrapS = paveNor.wrapT = THREE.RepeatWrapping;

    const redPavementMat = solid(
      new THREE.MeshStandardMaterial({
        map: paveDiff,
        normalMap: paveNor,
        normalScale: new THREE.Vector2(1.2, 1.2),
        color: 0xd4b89c,
        vertexColors: true,
        roughness: 0.80,
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
      w.scale.x = 0.92 + Math.sin(time * 6.5 + i * 1.7) * 0.12;
      w.position.y = (w.userData.baseY as number) + Math.sin(time * 8.0 + i * 2.3) * 0.14;
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
      color: 0x9c8256,
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
      const tx = Math.sin(s * 1.7) * 0.22;
      const ty = standAt(tx, tz);
      const slab = new THREE.Mesh(
        createIncaBlock(1.85 + (s % 2) * 0.35, 0.16, 1.35, 0.06, 1.5),
        abutmentMat
      );
      slab.position.set(tx, ty - 0.02, tz);
      slab.rotation.y = ((s % 3) - 1) * 0.08;
      slab.receiveShadow = true;
      bridgeGroup.add(slab);
    }

    // Handrail, Mid-Rail & Lower Catenary Suspension Cables
    const zMid = (zSouth + zNorth) * 0.5;
    const yMid = (ySouth + yNorth) * 0.5;
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

      // Battered Trapezoidal Inca Anchor Towers with Recessed Niches on BOTH South and North Canyon Rims
      const nicheDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 0.95 });
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

        // Recessed trapezoidal niche on the south & north faces of each bridge tower
        for (const fz of [-0.92, 0.92]) {
          const niche = new THREE.Mesh(createIncaBlock(0.68, 1.15, 0.14, 0.18, 1.0), nicheDarkMat);
          niche.position.set(0, 2.65, fz);
          towerGroup.add(niche);
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

    const bronzeRimMat = new THREE.MeshStandardMaterial({
      color: 0x9e7430,
      metalness: 0.86,
      roughness: 0.36,
    });
    const goldReliefMat = new THREE.MeshStandardMaterial({
      color: 0xdca83a,
      metalness: 0.92,
      roughness: 0.24,
      emissive: 0x3a2405,
      emissiveIntensity: 0.22,
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

      // 16 radiating triangular Inti solar rays around the ring
      for (let r = 0; r < 16; r++) {
        const ang = (r / 16) * Math.PI * 2;
        const rayLen = r % 2 === 0 ? 0.24 : 0.18;
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.048, rayLen, 4), goldReliefMat);
        const rad = 0.34 + rayLen * 0.45;
        ray.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, fz);
        ray.rotation.z = ang - Math.PI / 2;
        head.add(ray);
      }

      // Central embossed Inti Sun-God face medallion
      const sunFace = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), goldReliefMat);
      sunFace.scale.set(1.0, 1.0, 0.28);
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

    // Ring of 14 irregular river cobbles around the fire pit
    const cobbleMat = new THREE.MeshStandardMaterial({
      color: 0x524c43,
      roughness: 0.86,
      metalness: 0.02,
    });
    for (let c = 0; c < 14; c++) {
      const ang = (c / 14) * Math.PI * 2;
      const rad = 0.64 + (c % 2) * 0.04;
      const cobble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), cobbleMat);
      cobble.scale.set(1.18, 0.66 + (c % 3) * 0.1, 0.96);
      cobble.position.set(Math.cos(ang) * rad, 0.075, Math.sin(ang) * rad);
      cobble.rotation.set(c * 0.4, ang, c * 0.25);
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
    const tentCanvasTex = this.texLoader.load('/juzu/assets/character-textures/character-canvas.jpeg');
    tentCanvasTex.colorSpace = THREE.SRGBColorSpace;
    tentCanvasTex.anisotropy = 8;
    tentCanvasTex.wrapS = tentCanvasTex.wrapT = THREE.RepeatWrapping;
    tentCanvasTex.repeat.set(2, 2);

    const tentCanvasMat = new THREE.MeshStandardMaterial({
      map: tentCanvasTex,
      bumpMap: tentCanvasTex,
      bumpScale: 0.015,
      color: 0x8f866a,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const tentDarkInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x161410,
      roughness: 0.96,
    });
    const tentGroup = new THREE.Group();
    tentGroup.position.set(1.55, 0.0, -1.05);
    tentGroup.rotation.y = -0.72;

    // A-frame sloped canvas roof panels
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.55, 2.1), tentCanvasMat);
      panel.position.set(side * 0.52, 0.62, 0);
      panel.rotation.z = side * 0.58;
      panel.castShadow = true;
      panel.receiveShadow = true;
      tentGroup.add(panel);
    }
    const tentBack = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.25, 3), tentDarkInteriorMat);
    tentBack.rotation.y = Math.PI / 2;
    tentBack.position.set(0, 0.58, 0.0);
    tentGroup.add(tentBack);

    const ridgePole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 8), timberMat);
    ridgePole.rotation.x = Math.PI / 2;
    ridgePole.position.set(0, 1.24, 0);
    tentGroup.add(ridgePole);

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

  private buildGorgeWaterfall(_stoneMat: THREE.MeshStandardMaterial): void {
    // Cascading Andean mountain waterfall pouring down Horizontally Stratified Craggy Cliff Ledges
    // into the Urubamba River (-2.2m) — modeled 1:1 after ref_gorge_waterfall_bridge!
    const fallsGroup = new THREE.Group();
    const wx = 17.5;
    const wz = -29.5;
    fallsGroup.position.set(wx, -2.2, wz);

    const cliffDiff = this.texLoader.load('/juzu/textures/cliff_diff.jpg');
    cliffDiff.colorSpace = THREE.SRGBColorSpace;
    cliffDiff.anisotropy = 8;
    cliffDiff.wrapS = cliffDiff.wrapT = THREE.RepeatWrapping;

    const cliffNor = this.texLoader.load('/juzu/textures/cliff_nor.jpg');
    cliffNor.anisotropy = 8;
    cliffNor.wrapS = cliffNor.wrapT = THREE.RepeatWrapping;

    const cliffArm = this.texLoader.load('/juzu/textures/cliff_arm.jpg');
    cliffArm.anisotropy = 8;
    cliffArm.wrapS = cliffArm.wrapT = THREE.RepeatWrapping;

    const wetSlateMat = solid(
      new THREE.MeshStandardMaterial({
        map: cliffDiff,
        normalMap: cliffNor,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughnessMap: cliffArm,
        color: 0x868a80,
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.06,
      })
    );

    // Horizontally Stratified Canyon Cliff Ledges (replaces round spheres with authentic geological rock shelves!)
    const strataLedges = [
      // Left & Right stepped cliff shelves framing the waterfall chute
      { x: -3.2, y: 1.4, z: -0.4, w: 4.6, h: 2.8, d: 3.4, ry: 0.14 },
      { x: 3.3, y: 1.5, z: -0.4, w: 4.8, h: 3.0, d: 3.4, ry: -0.16 },
      { x: -3.0, y: 4.2, z: -1.1, w: 4.4, h: 2.6, d: 3.2, ry: 0.08 },
      { x: 3.1, y: 4.4, z: -1.1, w: 4.5, h: 2.8, d: 3.2, ry: -0.12 },
      { x: -2.8, y: 7.0, z: -1.8, w: 4.2, h: 2.6, d: 3.0, ry: 0.18 },
      { x: 2.9, y: 7.2, z: -1.8, w: 4.2, h: 2.6, d: 3.0, ry: -0.10 },
      { x: -2.5, y: 9.8, z: -2.4, w: 3.8, h: 2.4, d: 2.8, ry: 0.12 },
      { x: 2.6, y: 9.9, z: -2.4, w: 3.8, h: 2.4, d: 2.8, ry: -0.14 },
      // Stepped backwall rock shelves behind the cascading water
      { x: 0.0, y: 2.4, z: -1.1, w: 3.8, h: 4.2, d: 2.2, ry: 0.0 },
      { x: 0.0, y: 6.4, z: -1.9, w: 3.4, h: 4.2, d: 2.2, ry: 0.0 },
      { x: 0.0, y: 10.2, z: -2.6, w: 3.0, h: 3.6, d: 2.0, ry: 0.0 },
    ];
    for (const st of strataLedges) {
      const shelf = new THREE.Mesh(
        createIncaBlock(st.w, st.h, st.d, 0.14, 1.8),
        wetSlateMat
      );
      shelf.position.set(st.x, st.y, st.z);
      shelf.rotation.y = st.ry;
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      fallsGroup.add(shelf);
    }

    // Additional stratified rock outcrops along the Urubamba Gorge walls near the rope bridge (x = -12..12)
    const gorgeWallLedges = [
      { x: -25.5, y: 2.2, z: 0.5, w: 7.5, h: 4.2, d: 3.2, ry: 0.12 },
      { x: -24.0, y: 5.2, z: -1.2, w: 6.8, h: 3.2, d: 2.8, ry: 0.08 },
      { x: -11.5, y: 2.4, z: 0.8, w: 6.4, h: 4.4, d: 3.0, ry: -0.10 },
      { x: -11.0, y: 5.4, z: -0.8, w: 5.8, h: 3.0, d: 2.6, ry: -0.06 },
      { x: -23.0, y: 2.4, z: 27.5, w: 7.2, h: 4.2, d: 3.2, ry: -0.14 },
      { x: -11.0, y: 2.5, z: 28.0, w: 6.2, h: 4.4, d: 3.0, ry: 0.12 },
    ];
    for (const gw of gorgeWallLedges) {
      const cliffBlock = new THREE.Mesh(
        createIncaBlock(gw.w, gw.h, gw.d, 0.16, 2.0),
        wetSlateMat
      );
      cliffBlock.position.set(gw.x, gw.y, gw.z);
      cliffBlock.rotation.y = gw.ry;
      cliffBlock.castShadow = true;
      cliffBlock.receiveShadow = true;
      fallsGroup.add(cliffBlock);
    }

    // Riverbed Boulders emerging from the Urubamba River beneath the Rope Bridge (matching ref_gorge_waterfall_bridge!)
    const riverRocks = [
      { x: -14.5, z: 12.0, s: 1.35 },
      { x: -19.2, z: 10.5, s: 1.65 },
      { x: -16.8, z: 14.2, s: 1.15 },
      { x: -21.5, z: 13.0, s: 1.45 },
      { x: -12.0, z: 9.8, s: 1.25 },
      { x: -6.5, z: 11.5, s: 1.40 },
    ];
    for (let rr = 0; rr < riverRocks.length; rr++) {
      const rSpec = riverRocks[rr];
      const rBoulder = new THREE.Mesh(
        createIncaBlock(rSpec.s * 1.6, rSpec.s * 0.95, rSpec.s * 1.4, 0.22, 1.4),
        wetSlateMat
      );
      rBoulder.position.set(rSpec.x, 0.18, rSpec.z);
      rBoulder.rotation.y = rr * 0.85;
      rBoulder.castShadow = true;
      rBoulder.receiveShadow = true;
      fallsGroup.add(rBoulder);
    }

    // Multi-tier cascading whitewater sheets pouring over the 3 stepped rock shelves
    for (let i = 0; i < 4; i++) {
      const stripMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xc8e6f0 : 0xeaf6fa,
        transparent: true,
        opacity: 0.15 - i * 0.02,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const stripH = 11.6;
      const strip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75 + i * 0.16, 1.45 + i * 0.22, stripH, 12, 1, true),
        stripMat
      );
      const baseY = 5.7;
      strip.position.set((i - 1.5) * 0.15, baseY, -0.55 + i * 0.14);
      strip.rotation.x = 0.20;
      strip.userData.baseY = baseY;
      this.waterfallStrips.push(strip);
      fallsGroup.add(strip);
    }

    // Soft rising misty spray plumes at the mid-ledge & plunge pool base
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xd0e6ee,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let m = 0; m < 5; m++) {
      const plume = new THREE.Mesh(new THREE.SphereGeometry(1.4 + (m % 2) * 0.45, 10, 8), mistMat);
      plume.position.set(
        (m - 2.0) * 0.75,
        m === 4 ? 4.4 : 0.45 + (m % 2) * 0.35,
        m === 4 ? -0.6 : 0.7 + (m % 2) * 0.4
      );
      this.mistPlumes.push(plume);
      fallsGroup.add(plume);
    }

    // Concentric plunge-pool & river-boulder surface foam rings
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
    for (const rSpec of riverRocks) {
      const eddy = new THREE.Mesh(
        new THREE.RingGeometry(rSpec.s * 0.85, rSpec.s * 1.25, 18),
        ringMat
      );
      eddy.rotation.x = -Math.PI / 2;
      eddy.position.set(rSpec.x, 0.05, rSpec.z);
      fallsGroup.add(eddy);
    }

    this.group.add(fallsGroup);
  }
}
