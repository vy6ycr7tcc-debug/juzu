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

    const daisPlinth = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.38, 24), plinthMat);
    daisPlinth.position.y = 0.8;
    daisPlinth.castShadow = true;
    daisPlinth.receiveShadow = true;
    plazaGroup.add(daisPlinth);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      metalness: 0.95,
      roughness: 0.32,
    });
    this.sunGoldMat = goldMat;

    const sunDais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.28, 24), goldMat);
    sunDais.position.y = 1.02;
    sunDais.castShadow = true;
    sunDais.receiveShadow = true;
    plazaGroup.add(sunDais);
    this.interactables.push(sunDais);

    // Upright Golden Inti Sun Totem at the center of the Dais
    const sunTotem = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 24), goldMat);
    sunTotem.rotation.x = Math.PI / 2;
    sunTotem.position.set(0, 2.35, 0);
    sunTotem.castShadow = true;
    plazaGroup.add(sunTotem);
    this.interactables.push(sunTotem);

    const totemPillar = new THREE.Mesh(createIncaBlock(1.1, 1.3, 0.6, 0.12, 1.5), plinthMat);
    totemPillar.position.set(0, 1.55, 0);
    totemPillar.castShadow = true;
    plazaGroup.add(totemPillar);

    for (let r = 0; r < 4; r++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.8), goldMat);
      ray.rotation.y = (r * Math.PI) / 4;
      ray.position.y = 1.16;
      plazaGroup.add(ray);
    }

    this.group.add(plazaGroup);
  }

  private buildSunTempleRotunda(ashlarWallMat: THREE.MeshStandardMaterial): void {
    const templeGroup = new THREE.Group();
    const numBlocks = 14;
    const radius = 15;

    for (let i = 0; i < numBlocks; i++) {
      const angle = (i / (numBlocks - 1)) * Math.PI;
      const x = 200 + Math.cos(angle) * radius;
      const z = 204 + Math.sin(angle) * radius;
      const blockH = standAt(x, z);

      const block = new THREE.Mesh(createIncaBlock(3.4, 7.6, 2.0, 0.12, 2.0), ashlarWallMat);
      block.position.set(x, blockH + 3.8, z);
      block.rotation.y = -angle + Math.PI / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      templeGroup.add(block);
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
