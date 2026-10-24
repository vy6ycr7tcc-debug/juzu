import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { standAt } from '../terrain';
import { passable, solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';
import { MOBILE } from '../../core/quality';

export class PaititiRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();
  private sunGoldMat?: THREE.MeshStandardMaterial;
  private canalWaterMesh?: THREE.Mesh;
  private sunLight?: THREE.PointLight;
  private waterNor?: THREE.Texture;
  private awakened = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_Paititi';
    scene.add(this.group);

    // Authentic Paititi Imperial Golden Ashlar Masonry & Sacred Plaza Cobblestones (Poly Haven CC0)
    const blockDiff = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_diffuse_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_diffuse_2k.webp'
    );
    blockDiff.colorSpace = THREE.SRGBColorSpace;
    blockDiff.anisotropy = MOBILE ? 2 : 8;
    blockDiff.wrapS = blockDiff.wrapT = THREE.RepeatWrapping;

    const blockNor = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_nor_gl_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_nor_gl_2k.webp'
    );
    blockNor.anisotropy = MOBILE ? 2 : 8;
    blockNor.wrapS = blockNor.wrapT = THREE.RepeatWrapping;

    const blockRough = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_rough_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_rough_2k.webp'
    );
    blockRough.anisotropy = MOBILE ? 2 : 8;
    blockRough.wrapS = blockRough.wrapT = THREE.RepeatWrapping;

    const blockAO = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/castle_wall_slates_ao_1k.webp'
        : '/juzu/textures/scans/castle_wall_slates_ao_2k.webp'
    );
    blockAO.wrapS = blockAO.wrapT = THREE.RepeatWrapping;

    const precisionAshlarMat = solid(
      new THREE.MeshStandardMaterial({
        map: blockDiff,
        normalMap: blockNor,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: blockRough,
        aoMap: blockAO,
        aoMapIntensity: 0.85,
        color: 0xf4ebe0,
        vertexColors: true,
        roughness: 0.78,
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
    paveDiff.repeat.set(12, 12);

    const paveNor = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_nor_gl_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_nor_gl_2k.webp'
    );
    paveNor.anisotropy = MOBILE ? 2 : 8;
    paveNor.wrapS = paveNor.wrapT = THREE.RepeatWrapping;
    paveNor.repeat.set(12, 12);

    const paveRough = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_rough_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_rough_2k.webp'
    );
    paveRough.anisotropy = MOBILE ? 2 : 8;
    paveRough.wrapS = paveRough.wrapT = THREE.RepeatWrapping;
    paveRough.repeat.set(12, 12);

    const paveARM = this.texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/cobblestone_01_arm_1k.webp'
        : '/juzu/textures/scans/cobblestone_01_arm_2k.webp'
    );
    paveARM.wrapS = paveARM.wrapT = THREE.RepeatWrapping;
    paveARM.repeat.set(12, 12);

    const redPlazaPavingMat = solid(
      new THREE.MeshStandardMaterial({
        map: paveDiff,
        normalMap: paveNor,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: paveRough,
        aoMap: paveARM,
        aoMapIntensity: 0.80,
        color: 0xe6cead,
        roughness: 0.76,
        metalness: 0.03,
      })
    );

    const waterNor = this.texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(2, 12);
    this.waterNor = waterNor;

    const canalWaterMat = new THREE.MeshStandardMaterial({
      color: 0x245e74,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(0.45, 0.45),
    });

    this.buildPlazaOfTheSun(redPlazaPavingMat, precisionAshlarMat);
    this.buildSunTempleRotunda(precisionAshlarMat);
    this.buildAqueductChannels(precisionAshlarMat, canalWaterMat);
    this.loadPhotogrammetricScans();
  }

  public awakenSunPlaza(): void {
    this.awakened = true;
    if (this.sunGoldMat) {
      this.sunGoldMat.emissive.setHex(0xeaa81c);
      this.sunGoldMat.emissiveIntensity = 0.88;
    }
    if (this.canalWaterMesh) {
      this.canalWaterMesh.position.y += 0.22;
    }
    if (this.sunLight) {
      this.sunLight.intensity = 4.8;
    }
  }

  public update(time: number): void {
    if (this.awakened && this.sunLight) {
      this.sunLight.intensity = 4.8 + Math.sin(time * 6.5) * 0.55;
    }
    if (this.waterNor) {
      this.waterNor.offset.y = -(time * 0.085) % 1.0;
      this.waterNor.offset.x = Math.sin(time * 0.6) * 0.015;
    }
  }

  private buildPlazaOfTheSun(
    pavingMat: THREE.MeshStandardMaterial,
    plinthMat: THREE.MeshStandardMaterial
  ): void {
    const plazaGroup = new THREE.Group();
    const gH = standAt(200, 180);
    plazaGroup.position.set(200, gH, 180);

    const plazaFloor = new THREE.Mesh(new THREE.CylinderGeometry(24, 25, 0.8, 32), pavingMat);
    plazaFloor.position.y = 0.4;
    plazaFloor.receiveShadow = true;
    plazaGroup.add(plazaFloor);

    // Stepped Battered Inca Ashlar Dais Plinths (risers <= 0.36m for seamless step climbing)
    const daisTier1 = new THREE.Mesh(createIncaBlock(10.6, 0.36, 10.6, 0.08, 2.0), plinthMat);
    daisTier1.position.y = 0.98;
    daisTier1.castShadow = true;
    daisTier1.receiveShadow = true;
    plazaGroup.add(daisTier1);

    const daisTier2 = new THREE.Mesh(createIncaBlock(8.2, 0.36, 8.2, 0.08, 1.8), plinthMat);
    daisTier2.position.y = 1.34;
    daisTier2.castShadow = true;
    daisTier2.receiveShadow = true;
    plazaGroup.add(daisTier2);

    // Hand-hammered Imperial Inca Gold with micro-facet normal/roughness relief
    const goldMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0xc89624,
        normalMap: plinthMat.normalMap,
        normalScale: new THREE.Vector2(0.28, 0.28),
        roughnessMap: plinthMat.roughnessMap,
        metalness: 0.90,
        roughness: 0.34,
      })
    );
    this.sunGoldMat = goldMat;

    const sunDais = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 0.22, 24), goldMat);
    sunDais.position.y = 1.63;
    sunDais.castShadow = true;
    sunDais.receiveShadow = true;
    plazaGroup.add(sunDais);
    this.interactables.push(sunDais);

    // Radiant Sun Light
    const sunLight = new THREE.PointLight(0xffc542, 0.0, 36, 1.3);
    sunLight.position.set(0, 3.4, 0);
    plazaGroup.add(sunLight);
    this.sunLight = sunLight;

    // Upright Imperial Sun Totem Column
    const totemPillar = new THREE.Mesh(createIncaBlock(1.2, 2.4, 0.85, 0.1, 1.6), plinthMat);
    totemPillar.position.set(0, 2.65, 0);
    totemPillar.castShadow = true;
    totemPillar.receiveShadow = true;
    plazaGroup.add(totemPillar);

    const sunTotem = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.24, 28), goldMat);
    sunTotem.rotation.x = Math.PI / 2;
    sunTotem.position.set(0, 3.15, 0);
    sunTotem.castShadow = true;
    plazaGroup.add(sunTotem);
    this.interactables.push(sunTotem);

    // 16-ray engraved Inti solar relief + central embossed Sun-God face medallion on both faces
    for (const fz of [-0.125, 0.125]) {
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 24), goldMat);
      innerRing.position.set(0, 3.15, fz);
      plazaGroup.add(innerRing);

      for (let r = 0; r < 16; r++) {
        const ang = (r / 16) * Math.PI * 2;
        const rayLen = r % 2 === 0 ? 0.38 : 0.28;
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.075, rayLen, 4), goldMat);
        const rad = 0.58 + rayLen * 0.45;
        ray.position.set(Math.cos(ang) * rad, 3.15 + Math.sin(ang) * rad, fz);
        ray.rotation.z = ang - Math.PI / 2;
        plazaGroup.add(ray);
      }

      const sunFace = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), goldMat);
      sunFace.scale.set(1.0, 1.0, 0.28);
      sunFace.position.set(0, 3.15, fz);
      plazaGroup.add(sunFace);
    }

    const sunHalo = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.08, 8, 24), goldMat);
    sunHalo.position.set(0, 3.15, 0);
    sunHalo.castShadow = true;
    plazaGroup.add(sunHalo);

    for (let r = 0; r < 4; r++) {
      const ray = passable(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 7.2), goldMat));
      ray.rotation.y = (r * Math.PI) / 4;
      ray.position.y = 1.74;
      plazaGroup.add(ray);
    }

    // Flanking Ceremonial Fire Braziers on Stepped Stone Pedestals
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5214 });
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff7a18,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffd255,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const sx of [-7.5, 7.5]) {
      const ped = new THREE.Mesh(createIncaBlock(1.4, 1.8, 1.4, 0.14, 1.6), plinthMat);
      ped.position.set(sx, 1.55, -4.5);
      ped.castShadow = true;
      ped.receiveShadow = true;
      plazaGroup.add(ped);

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.35, 0.32, 14), goldMat);
      bowl.position.set(sx, 2.55, -4.5);
      bowl.castShadow = true;
      plazaGroup.add(bowl);

      const coalBed = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), emberMat);
      coalBed.scale.set(1.0, 0.25, 1.0);
      coalBed.position.set(sx, 2.70, -4.5);
      plazaGroup.add(coalBed);

      for (const lobe of [
        { dx: 0.0, dz: 0.0, r: 0.26, sy: 1.55, mat: outerFlameMat },
        { dx: 0.09, dz: -0.06, r: 0.20, sy: 1.45, mat: outerFlameMat },
        { dx: -0.09, dz: 0.06, r: 0.20, sy: 1.40, mat: outerFlameMat },
        { dx: 0.0, dz: 0.0, r: 0.16, sy: 1.35, mat: innerFlameMat },
      ]) {
        const flame = new THREE.Mesh(new THREE.SphereGeometry(lobe.r, 10, 8), lobe.mat);
        flame.scale.set(0.85, lobe.sy, 0.85);
        flame.position.set(sx + lobe.dx, 2.86, -4.5 + lobe.dz);
        plazaGroup.add(flame);
      }
    }

    // Flanking Stepped Ushnu Pyramid Wings on East and West edges of the Plaza
    for (const side of [-1, 1]) {
      const wingX = side * 18.5;
      const tierA = new THREE.Mesh(createIncaBlock(7.5, 2.4, 14.0, 0.14, 2.0), plinthMat);
      tierA.position.set(wingX, 1.8, 3.0);
      tierA.castShadow = true;
      tierA.receiveShadow = true;
      plazaGroup.add(tierA);

      const tierB = new THREE.Mesh(createIncaBlock(5.2, 2.2, 10.5, 0.14, 1.8), plinthMat);
      tierB.position.set(wingX + side * 0.6, 3.9, 3.0);
      tierB.castShadow = true;
      tierB.receiveShadow = true;
      plazaGroup.add(tierB);

      const goldFrieze = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.38, 10.65), goldMat);
      goldFrieze.position.set(wingX + side * 0.6, 4.65, 3.0);
      plazaGroup.add(goldFrieze);
    }

    this.group.add(plazaGroup);
  }

  private buildSunTempleRotunda(ashlarWallMat: THREE.MeshStandardMaterial): void {
    const templeGroup = new THREE.Group();
    const numBlocks = 14;
    const radius = 15;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      metalness: 0.92,
      roughness: 0.28,
    });

    for (let i = 0; i < numBlocks; i++) {
      const angle = (i / (numBlocks - 1)) * Math.PI;
      const x = 200 + Math.cos(angle) * radius;
      const z = 198 + Math.sin(angle) * radius;
      const blockH = standAt(x, z);

      const block = new THREE.Mesh(createIncaBlock(3.4, 7.6, 2.0, 0.12, 2.0), ashlarWallMat);
      block.position.set(x, blockH + 3.8, z);
      block.rotation.y = -angle + Math.PI / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      templeGroup.add(block);

      // Imperial Coricancha Gold Band inlaid across each monolith
      const goldBand = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.55, 2.08), goldMat);
      goldBand.position.set(x, blockH + 5.8, z);
      goldBand.rotation.y = -angle + Math.PI / 2;
      templeGroup.add(goldBand);

      // Upper Stone Architrave Cap
      const cap = new THREE.Mesh(createIncaBlock(3.8, 0.85, 2.4, 0.06, 1.8), ashlarWallMat);
      cap.position.set(x, blockH + 7.9, z);
      cap.rotation.y = -angle + Math.PI / 2;
      cap.castShadow = true;
      templeGroup.add(cap);
    }

    // Imperial Trapezoidal Entrance Gateway into the Plaza at (200, y, 158)
    const gateY = standAt(200, 158);
    const gate = buildTrapezoidalGateway(4.8, 1.8, 5.8, 1.8, ashlarWallMat);
    gate.position.set(200, gateY - 0.1, 158);
    gate.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && c.position.y < 0.25) passable(c as THREE.Mesh);
    });
    templeGroup.add(gate);

    this.group.add(templeGroup);
  }

  private buildAqueductChannels(
    stoneMat: THREE.MeshStandardMaterial,
    waterMat: THREE.MeshStandardMaterial
  ): void {
    const canalGroup = new THREE.Group();
    const gH = standAt(200, 165);

    const canalStone = new THREE.Mesh(createIncaBlock(2.6, 0.7, 26, 0.06, 2.0), stoneMat);
    canalStone.position.set(200, gH + 0.25, 165);
    canalStone.receiveShadow = true;
    canalStone.castShadow = true;
    canalGroup.add(canalStone);

    const canalWater = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 25.6), waterMat);
    canalWater.position.set(200, gH + 0.48, 165);
    canalWater.receiveShadow = true;
    this.canalWaterMesh = canalWater;
    canalGroup.add(canalWater);

    this.group.add(canalGroup);
  }

  private loadPhotogrammetricScans(): void {
    if (MOBILE) {
      return;
    }
    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // 1. Towering Sacred Mountain Cirque enclosing Paititi (namaqualand_cliff_01)
    gltfLoader.load('/juzu/models/scans/namaqualand_cliff_01.glb', (gltf) => {
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
          // Rear mountain caldera massifs behind the curved Sun Temple Rotunda
          { x: 175, y: standAt(175, 218) - 1.5, z: 218, sx: 2.6, sy: 3.2, sz: 2.2, ry: 0.35 },
          { x: 200, y: standAt(200, 224) - 2.0, z: 224, sx: 3.0, sy: 3.5, sz: 2.4, ry: 3.14 },
          { x: 225, y: standAt(225, 218) - 1.5, z: 218, sx: 2.6, sy: 3.2, sz: 2.2, ry: -0.35 },
          // West flank mountain ridge enclosing the plaza
          { x: 165, y: standAt(165, 185) - 1.0, z: 185, sx: 2.4, sy: 2.8, sz: 2.0, ry: 1.57 },
          { x: 170, y: standAt(170, 160) - 1.0, z: 160, sx: 2.2, sy: 2.6, sz: 1.9, ry: 1.25 },
          // East flank mountain ridge enclosing the plaza
          { x: 235, y: standAt(235, 185) - 1.0, z: 185, sx: 2.4, sy: 2.8, sz: 2.0, ry: -1.57 },
          { x: 230, y: standAt(230, 160) - 1.0, z: 160, sx: 2.2, sy: 2.6, sz: 1.9, ry: -1.25 },
        ];

        const cliffInstMesh = new THREE.InstancedMesh(cliffGeom, cliffMat, cliffPlacements.length);
        cliffInstMesh.name = 'Paititi_Mountain_Cirque';
        cliffInstMesh.castShadow = true;
        cliffInstMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        cliffPlacements.forEach((p, idx) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.set(p.sx, p.sy, p.sz);
          dummy.rotation.set(0, p.ry, 0);
          dummy.updateMatrix();
          cliffInstMesh.setMatrixAt(idx, dummy.matrix);
        });
        cliffInstMesh.instanceMatrix.needsUpdate = true;
        this.group.add(cliffInstMesh);
      }
    });

    // 2. Granite Bedrock Ledges flanking the Ushnu Wings and Gateway (namaqualand_cliff_02)
    gltfLoader.load('/juzu/models/scans/namaqualand_cliff_02.glb', (gltf) => {
      let ledgeGeom: THREE.BufferGeometry | null = null;
      let ledgeMat: THREE.Material | null = null;

      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !ledgeGeom) {
          const mesh = child as THREE.Mesh;
          ledgeGeom = mesh.geometry.clone();
          ledgeMat = mesh.material as THREE.Material;
          if (ledgeMat instanceof THREE.MeshStandardMaterial) {
            ledgeMat.roughness = 0.88;
            ledgeMat.metalness = 0.02;
            if (ledgeMat.map) {
              ledgeMat.map.colorSpace = THREE.SRGBColorSpace;
              ledgeMat.map.anisotropy = 8;
            }
            if (ledgeMat.normalMap) {
              ledgeMat.normalMap.anisotropy = 8;
              ledgeMat.normalScale = new THREE.Vector2(1.3, 1.3);
            }
          }
        }
      });

      if (ledgeGeom && ledgeMat) {
        const ledgePlacements = [
          // Flanking the entrance gateway
          { x: 186, y: standAt(186, 156) - 0.25, z: 156, sx: 1.25, sy: 1.3, sz: 1.2, ry: 0.8 },
          { x: 214, y: standAt(214, 156) - 0.25, z: 156, sx: 1.25, sy: 1.3, sz: 1.2, ry: -0.8 },
          // Flanking the outer ushnu pyramid wings
          { x: 174, y: standAt(174, 182) - 0.3, z: 182, sx: 1.35, sy: 1.4, sz: 1.25, ry: 1.1 },
          { x: 226, y: standAt(226, 182) - 0.3, z: 182, sx: 1.35, sy: 1.4, sz: 1.25, ry: -1.1 },
        ];

        const ledgeInst = new THREE.InstancedMesh(ledgeGeom, ledgeMat, ledgePlacements.length);
        ledgeInst.name = 'Paititi_Granite_Ledges';
        ledgeInst.castShadow = true;
        ledgeInst.receiveShadow = true;

        const dummy = new THREE.Object3D();
        ledgePlacements.forEach((p, idx) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.set(p.sx, p.sy, p.sz);
          dummy.rotation.set(0, p.ry, 0);
          dummy.updateMatrix();
          ledgeInst.setMatrixAt(idx, dummy.matrix);
        });
        ledgeInst.instanceMatrix.needsUpdate = true;
        this.group.add(ledgeInst);
      }
    });

    // 3. Imperial Citadel Kit: Watchtowers and Bastion Curtain Walls (modular_fort_01)
    gltfLoader.load('/juzu/models/scans/modular_fort_01.glb', (gltf) => {
      const fortGroup = new THREE.Group();
      fortGroup.name = 'Paititi_Imperial_Citadel_Kit';
      this.group.add(fortGroup);

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

      gltf.scene.traverse((child) => {
        if (child.name === 'modular_fort_01_tower_round' && !towerNode) {
          towerNode = child;
        } else if (child.name === 'modular_fort_01_wall_thick_straight_01' && !wallStraightNode) {
          wallStraightNode = child;
        }
      });

      if (towerNode && wallStraightNode) {
        // Twin imperial bastion towers flanking Paititi entrance portal
        const towerL = (towerNode as THREE.Object3D).clone(true);
        const tyL = standAt(192.5, 158);
        towerL.position.set(192.5, tyL, 158);
        towerL.scale.set(0.65, 0.75, 0.65);
        fortGroup.add(towerL);

        const towerR = (towerNode as THREE.Object3D).clone(true);
        const tyR = standAt(207.5, 158);
        towerR.position.set(207.5, tyR, 158);
        towerR.scale.set(0.65, 0.75, 0.65);
        fortGroup.add(towerR);

        // Flanking curtain walls connecting to the mountain amphitheater
        const wallL = (wallStraightNode as THREE.Object3D).clone(true);
        const wyL = standAt(185.5, 158);
        wallL.position.set(185.5, wyL, 158);
        wallL.scale.set(0.75, 0.72, 0.75);
        fortGroup.add(wallL);

        const wallR = (wallStraightNode as THREE.Object3D).clone(true);
        const wyR = standAt(214.5, 158);
        wallR.position.set(214.5, wyR, 158);
        wallR.scale.set(0.75, 0.72, 0.75);
        fortGroup.add(wallR);
      }
    });
  }
}
