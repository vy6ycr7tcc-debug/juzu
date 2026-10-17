import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class PaititiRegion {
  public group = new THREE.Group();
  private texLoader = new THREE.TextureLoader();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_Paititi';
    scene.add(this.group);

    const blockDiff = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_08_diff.jpg');
    blockDiff.wrapS = blockDiff.wrapT = THREE.RepeatWrapping;
    blockDiff.repeat.set(3, 3);

    const blockNor = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_08_nor.jpg');
    blockNor.wrapS = blockNor.wrapT = THREE.RepeatWrapping;
    blockNor.repeat.set(3, 3);

    const blockArm = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_08_arm.jpg');
    blockArm.wrapS = blockArm.wrapT = THREE.RepeatWrapping;
    blockArm.repeat.set(3, 3);

    const precisionAshlarMat = solid(
      new THREE.MeshStandardMaterial({
        map: blockDiff,
        normalMap: blockNor,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: blockArm,
        color: 0xc8bfaf, // Sunlit imperial ashlar stone
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
        normalScale: new THREE.Vector2(0.9, 0.9),
        color: 0x9b7b62,
        roughness: 0.78,
        metalness: 0.05,
      })
    );

    const waterNor = this.texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(2, 12);

    const canalWaterMat = new THREE.MeshStandardMaterial({
      color: 0x245468,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });

    this.buildPlazaOfTheSun(redPlazaPavingMat, precisionAshlarMat);
    this.buildSunTempleRotunda(precisionAshlarMat);
    this.buildAqueductChannels(precisionAshlarMat, canalWaterMat);
  }

  private buildPlazaOfTheSun(
    pavingMat: THREE.MeshStandardMaterial,
    plinthMat: THREE.MeshStandardMaterial
  ): void {
    // Plaza of the Sun with fitted ashlar paving at (200, 180)
    const plazaGroup = new THREE.Group();
    const gH = standAt(200, 180);
    plazaGroup.position.set(200, gH, 180);

    const plazaFloor = new THREE.Mesh(new THREE.CylinderGeometry(24, 25, 0.8, 32), pavingMat);
    plazaFloor.position.y = 0.4;
    plazaFloor.receiveShadow = true;
    plazaGroup.add(plazaFloor);

    // Carved stone plinth for sun dais
    const daisPlinth = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.35, 24), plinthMat);
    daisPlinth.position.y = 0.8;
    daisPlinth.castShadow = true;
    daisPlinth.receiveShadow = true;
    plazaGroup.add(daisPlinth);

    // Central Golden Sun Disk Dais per bible §2.5 (Gold #D4A017, metalness 0.95, roughness 0.35, NEVER emissive)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      metalness: 0.95,
      roughness: 0.35,
    });

    const sunDais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.25, 24), goldMat);
    sunDais.position.y = 1.0;
    sunDais.castShadow = true;
    sunDais.receiveShadow = true;
    plazaGroup.add(sunDais);

    // Inlaid Chakana rays on the golden disk
    for (let r = 0; r < 4; r++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.8), goldMat);
      ray.rotation.y = (r * Math.PI) / 4;
      ray.position.y = 1.14;
      plazaGroup.add(ray);
    }

    this.group.add(plazaGroup);
  }

  private buildSunTempleRotunda(ashlarWallMat: THREE.MeshStandardMaterial): void {
    // Semicircular Coricancha curved ashlar sanctuary wall
    const templeGroup = new THREE.Group();
    const numBlocks = 14;
    const radius = 15;

    for (let i = 0; i < numBlocks; i++) {
      const angle = (i / (numBlocks - 1)) * Math.PI;
      const x = 200 + Math.cos(angle) * radius;
      const z = 204 + Math.sin(angle) * radius;
      const blockH = standAt(x, z);

      const block = new THREE.Mesh(new THREE.BoxGeometry(3.4, 7.8, 2.0), ashlarWallMat);
      block.position.set(x, blockH + 3.9, z);
      block.rotation.y = -angle + Math.PI / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      templeGroup.add(block);
    }

    this.group.add(templeGroup);
  }

  private buildAqueductChannels(
    stoneMat: THREE.MeshStandardMaterial,
    waterMat: THREE.MeshStandardMaterial
  ): void {
    // Stone carved water channel running through Paititi plaza
    const canalGroup = new THREE.Group();
    const gH = standAt(200, 160);

    const canalStone = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 28), stoneMat);
    canalStone.position.set(200, gH + 0.2, 160);
    canalStone.receiveShadow = true;
    canalStone.castShadow = true;
    canalGroup.add(canalStone);

    const canalWater = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 28), waterMat);
    canalWater.position.set(200, gH + 0.45, 160);
    canalWater.receiveShadow = true;
    canalGroup.add(canalWater);

    this.group.add(canalGroup);
  }
}
