import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class JungleLowlandsRegion {
  public group = new THREE.Group();
  private texLoader = new THREE.TextureLoader();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_JungleLowlands';
    scene.add(this.group);

    const crackDiff = this.texLoader.load('/juzu/textures/temple/sandstone_cracks_diff.jpg');
    crackDiff.wrapS = crackDiff.wrapT = THREE.RepeatWrapping;
    crackDiff.repeat.set(2, 3);

    const crackNor = this.texLoader.load('/juzu/textures/temple/sandstone_cracks_nor.jpg');
    crackNor.wrapS = crackNor.wrapT = THREE.RepeatWrapping;
    crackNor.repeat.set(2, 3);

    const crackArm = this.texLoader.load('/juzu/textures/temple/sandstone_cracks_arm.jpg');
    crackArm.wrapS = crackArm.wrapT = THREE.RepeatWrapping;
    crackArm.repeat.set(2, 3);

    const jungleStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: crackDiff,
        normalMap: crackNor,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: crackArm,
        color: 0x5a6850, // Heavy mossy limestone reclaimed by rainforest
        roughness: 0.92,
        metalness: 0.05,
      })
    );

    const rockDiff = this.texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;
    rockDiff.repeat.set(3, 1);

    const rockNor = this.texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;
    rockNor.repeat.set(3, 1);

    const wetStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: rockDiff,
        normalMap: rockNor,
        normalScale: new THREE.Vector2(1.0, 1.0),
        color: 0x363d35,
        roughness: 0.55,
        metalness: 0.12,
      })
    );

    const waterNor = this.texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(8, 8);

    const cenoteWaterMat = new THREE.MeshStandardMaterial({
      color: 0x163e38, // Emerald rainforest cenote water
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });

    this.buildExpeditionQuay(jungleStoneMat);
    this.buildSerpentArches(jungleStoneMat);
    this.buildSubmergedPassage(wetStoneMat, cenoteWaterMat);
  }

  private buildExpeditionQuay(quayMat: THREE.MeshStandardMaterial): void {
    // Ancient stone expedition landing quay at (-180, y, 126)
    const quayGroup = new THREE.Group();

    // Main landing platform rising above the river
    const platform = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 14), quayMat);
    platform.position.set(-180, 1.1, 126);
    platform.castShadow = true;
    platform.receiveShadow = true;
    quayGroup.add(platform);

    // Flanking carved serpent totem stelae
    for (const side of [-5.2, 5.2]) {
      const totem = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 1.2), quayMat);
      totem.position.set(-180 + side, 3.2, 122);
      totem.castShadow = true;
      totem.receiveShadow = true;
      quayGroup.add(totem);
    }

    this.group.add(quayGroup);
  }

  private buildSerpentArches(jungleStoneMat: THREE.MeshStandardMaterial): void {
    // Carved limestone serpent arches rising from deep jungle at (-180, 140)
    const archGroup = new THREE.Group();

    for (let i = 0; i < 3; i++) {
      const z = 130 + i * 16;
      const h = standAt(-180, z);

      const left = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6.8, 1.8), jungleStoneMat);
      left.position.set(-186, h + 3.4, z);
      left.castShadow = true;
      left.receiveShadow = true;
      archGroup.add(left);

      const right = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6.8, 1.8), jungleStoneMat);
      right.position.set(-174, h + 3.4, z);
      right.castShadow = true;
      right.receiveShadow = true;
      archGroup.add(right);

      const top = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.9, 2.0), jungleStoneMat);
      top.position.set(-180, h + 7.0, z);
      top.castShadow = true;
      top.receiveShadow = true;
      archGroup.add(top);
    }

    this.group.add(archGroup);
  }

  private buildSubmergedPassage(
    wetStoneMat: THREE.MeshStandardMaterial,
    cenoteWaterMat: THREE.MeshStandardMaterial
  ): void {
    // Cenote passage leading into submerged stone chamber
    const cenoteGroup = new THREE.Group();
    const gH = standAt(-180, 175);

    const basinRim = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 9.5, 2.2, 16, 1, true),
      wetStoneMat
    );
    basinRim.position.set(-180, gH + 1.1, 175);
    basinRim.castShadow = true;
    basinRim.receiveShadow = true;
    cenoteGroup.add(basinRim);

    // Deep pool water surface
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(8.3, 8.3, 0.1, 16), cenoteWaterMat);
    pool.position.set(-180, gH + 0.6, 175);
    pool.receiveShadow = true;
    cenoteGroup.add(pool);

    this.group.add(cenoteGroup);
  }
}
