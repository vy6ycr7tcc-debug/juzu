import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class PaititiRegion {
  public group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_Paititi';
    scene.add(this.group);
    this.buildPlazaOfTheSun();
    this.buildSunTempleRotunda();
    this.buildAqueductChannels();
  }

  private buildPlazaOfTheSun(): void {
    // Plaza of the Sun with fitted ashlar paving at (200, 180)
    const plazaGroup = new THREE.Group();
    const gH = standAt(200, 180);

    const ashlarPavingMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0xbdb39f, // Precision fitted Inca ashlar limestone
        roughness: 0.65,
        metalness: 0.08,
      })
    );

    const plazaFloor = new THREE.Mesh(new THREE.CylinderGeometry(24, 25, 0.8, 24), ashlarPavingMat);
    plazaFloor.position.set(200, gH + 0.4, 180);
    plazaFloor.receiveShadow = true;
    plazaGroup.add(plazaFloor);

    // Central Golden Sun Disk Dais per bible §2.5 (Gold #D4A017, metalness 1.0, roughness 0.35, NEVER emissive)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      metalness: 0.95,
      roughness: 0.35,
    });

    const sunDais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.45, 16), goldMat);
    sunDais.position.set(200, gH + 0.85, 180);
    sunDais.castShadow = true;
    sunDais.receiveShadow = true;
    plazaGroup.add(sunDais);

    this.group.add(plazaGroup);
  }

  private buildSunTempleRotunda(): void {
    // Semicircular Coricancha curved ashlar sanctuary wall
    const templeGroup = new THREE.Group();
    const gH = standAt(200, 204);

    const ashlarWallMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0xc4baaa, // Sunlit ashlar stone
        roughness: 0.72,
        metalness: 0.05,
      })
    );

    const numBlocks = 12;
    const radius = 14;
    for (let i = 0; i < numBlocks; i++) {
      const angle = (i / (numBlocks - 1)) * Math.PI;
      const x = 200 + Math.cos(angle) * radius;
      const z = 204 + Math.sin(angle) * radius;
      const blockH = standAt(x, z);

      const block = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7.5, 1.8), ashlarWallMat);
      block.position.set(x, blockH + 3.75, z);
      block.rotation.y = -angle + Math.PI / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      templeGroup.add(block);
    }

    this.group.add(templeGroup);
  }

  private buildAqueductChannels(): void {
    // Stone carved water channel running through Paititi plaza
    const canalGroup = new THREE.Group();
    const stoneMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x988f80,
        roughness: 0.75,
        metalness: 0.05,
      })
    );

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2e5a6e,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });

    const gH = standAt(200, 160);
    const canalStone = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 28), stoneMat);
    canalStone.position.set(200, gH + 0.2, 160);
    canalStone.receiveShadow = true;
    canalGroup.add(canalStone);

    const canalWater = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 28), waterMat);
    canalWater.position.set(200, gH + 0.45, 160);
    canalGroup.add(canalWater);

    this.group.add(canalGroup);
  }
}
