import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';

export class PaititiRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();
  private sunGoldMat?: THREE.MeshStandardMaterial;
  private canalWaterMesh?: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_Paititi';
    scene.add(this.group);

    const blockDiff = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_08_diff.jpg');
    blockDiff.wrapS = blockDiff.wrapT = THREE.RepeatWrapping;

    const blockNor = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_08_nor.jpg');
    blockNor.wrapS = blockNor.wrapT = THREE.RepeatWrapping;

    const blockArm = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_08_arm.jpg');
    blockArm.wrapS = blockArm.wrapT = THREE.RepeatWrapping;

    const precisionAshlarMat = solid(
      new THREE.MeshStandardMaterial({
        map: blockDiff,
        normalMap: blockNor,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughnessMap: blockArm,
        color: 0xc8bfaf,
        roughness: 0.72,
        metalness: 0.04,
      })
    );

    const paveDiff = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_diff.jpg');
    paveDiff.wrapS = paveDiff.wrapT = THREE.RepeatWrapping;
    paveDiff.repeat.set(6, 6);

    const paveNor = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_nor.jpg');
    paveNor.wrapS = paveNor.wrapT = THREE.RepeatWrapping;
    paveNor.repeat.set(6, 6);

    const redPlazaPavingMat = solid(
      new THREE.MeshStandardMaterial({
        map: paveDiff,
        normalMap: paveNor,
        normalScale: new THREE.Vector2(0.95, 0.95),
        color: 0x9b7b62,
        roughness: 0.78,
        metalness: 0.05,
      })
    );

    const waterNor = this.texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(2, 12);

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
  }

  public awakenSunPlaza(): void {
    if (this.sunGoldMat) {
      this.sunGoldMat.emissive.setHex(0xd4a017);
      this.sunGoldMat.emissiveIntensity = 0.55;
    }
    if (this.canalWaterMesh) {
      this.canalWaterMesh.position.y += 0.18;
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

    // Stepped Battered Inca Ashlar Dais Plinths
    const daisTier1 = new THREE.Mesh(createIncaBlock(10.6, 0.42, 10.6, 0.08, 2.0), plinthMat);
    daisTier1.position.y = 0.92;
    daisTier1.castShadow = true;
    daisTier1.receiveShadow = true;
    plazaGroup.add(daisTier1);

    const daisTier2 = new THREE.Mesh(createIncaBlock(8.2, 0.38, 8.2, 0.08, 1.8), plinthMat);
    daisTier2.position.y = 1.28;
    daisTier2.castShadow = true;
    daisTier2.receiveShadow = true;
    plazaGroup.add(daisTier2);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      metalness: 0.95,
      roughness: 0.28,
    });
    this.sunGoldMat = goldMat;

    const sunDais = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 0.26, 24), goldMat);
    sunDais.position.y = 1.56;
    sunDais.castShadow = true;
    sunDais.receiveShadow = true;
    plazaGroup.add(sunDais);
    this.interactables.push(sunDais);

    // Upright Golden Inti Sun Totem at the center of the Dais
    const totemPillar = new THREE.Mesh(createIncaBlock(1.3, 1.5, 0.72, 0.12, 1.5), plinthMat);
    totemPillar.position.set(0, 2.15, 0);
    totemPillar.castShadow = true;
    totemPillar.receiveShadow = true;
    plazaGroup.add(totemPillar);

    const sunTotem = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.24, 24), goldMat);
    sunTotem.rotation.x = Math.PI / 2;
    sunTotem.position.set(0, 3.15, 0);
    sunTotem.castShadow = true;
    plazaGroup.add(sunTotem);
    this.interactables.push(sunTotem);

    const sunHalo = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.08, 8, 24), goldMat);
    sunHalo.position.set(0, 3.15, 0);
    sunHalo.castShadow = true;
    plazaGroup.add(sunHalo);

    for (let r = 0; r < 4; r++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 7.2), goldMat);
      ray.rotation.y = (r * Math.PI) / 4;
      ray.position.y = 1.68;
      plazaGroup.add(ray);
    }

    // Flanking Ceremonial Fire Braziers on Stepped Stone Pedestals
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa28,
      transparent: true,
      opacity: 0.72,
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

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.95, 8, 1, true), flameMat);
      flame.position.set(sx, 3.05, -4.5);
      plazaGroup.add(flame);
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
}
