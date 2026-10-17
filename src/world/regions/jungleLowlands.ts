import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';

export class JungleLowlandsRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();
  private sluiceWheel?: THREE.Mesh;
  private cenotePool?: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_JungleLowlands';
    scene.add(this.group);

    const crackDiff = this.texLoader.load('/juzu/textures/temple/sandstone_cracks_diff.jpg');
    crackDiff.wrapS = crackDiff.wrapT = THREE.RepeatWrapping;

    const crackNor = this.texLoader.load('/juzu/textures/temple/sandstone_cracks_nor.jpg');
    crackNor.wrapS = crackNor.wrapT = THREE.RepeatWrapping;

    const crackArm = this.texLoader.load('/juzu/textures/temple/sandstone_cracks_arm.jpg');
    crackArm.wrapS = crackArm.wrapT = THREE.RepeatWrapping;

    const jungleStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: crackDiff,
        normalMap: crackNor,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughnessMap: crackArm,
        color: 0x627057,
        roughness: 0.9,
        metalness: 0.05,
      })
    );

    const rockDiff = this.texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;

    const rockNor = this.texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;

    const wetStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: rockDiff,
        normalMap: rockNor,
        normalScale: new THREE.Vector2(1.0, 1.0),
        color: 0x3b443a,
        roughness: 0.52,
        metalness: 0.12,
      })
    );

    const waterNor = this.texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(8, 8);

    const cenoteWaterMat = new THREE.MeshStandardMaterial({
      color: 0x16423b,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(0.45, 0.45),
    });

    this.buildExpeditionQuay(jungleStoneMat);
    this.buildSerpentArches(jungleStoneMat);
    this.buildSubmergedPassage(wetStoneMat, cenoteWaterMat, jungleStoneMat);
  }

  public openCenoteSluice(): void {
    if (this.sluiceWheel) {
      this.sluiceWheel.rotation.z += Math.PI * 0.75;
    }
    if (this.cenotePool) {
      this.cenotePool.position.y -= 0.85;
    }
  }

  private buildExpeditionQuay(quayMat: THREE.MeshStandardMaterial): void {
    const quayGroup = new THREE.Group();
    const qH = standAt(-180, 124);

    // Battered stone landing quay platform
    const platform = new THREE.Mesh(createIncaBlock(12, 2.2, 12, 0.08, 2.2), quayMat);
    platform.position.set(-180, qH + 0.35, 124);
    platform.castShadow = true;
    platform.receiveShadow = true;
    quayGroup.add(platform);

    // Flanking carved serpent totem stelae
    for (const side of [-5.0, 5.0]) {
      const totem = new THREE.Mesh(createIncaBlock(1.3, 4.0, 1.3, 0.12, 1.8), quayMat);
      totem.position.set(-180 + side, qH + 3.1, 120);
      totem.castShadow = true;
      totem.receiveShadow = true;
      quayGroup.add(totem);
      this.interactables.push(totem);
    }

    // Ancient Bronze & Stone Sluice Capstan Wheel on the Quay
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x9c7238,
      metalness: 0.88,
      roughness: 0.32,
    });
    const capstanPedestal = new THREE.Mesh(createIncaBlock(1.1, 1.2, 1.1, 0.1, 1.5), quayMat);
    capstanPedestal.position.set(-180, qH + 1.85, 124);
    quayGroup.add(capstanPedestal);

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 16), bronzeMat);
    wheel.position.set(-180, qH + 2.55, 124.6);
    wheel.castShadow = true;
    quayGroup.add(wheel);
    this.sluiceWheel = wheel;
    this.interactables.push(wheel);

    this.group.add(quayGroup);
  }

  private buildSerpentArches(jungleStoneMat: THREE.MeshStandardMaterial): void {
    const archGroup = new THREE.Group();

    for (let i = 0; i < 3; i++) {
      const z = 134 + i * 14;
      const h = standAt(-180, z);
      const gate = buildTrapezoidalGateway(6.5, 1.7, 5.8, 1.8, jungleStoneMat);
      gate.position.set(-180, h - 0.1, z);
      archGroup.add(gate);
    }

    this.group.add(archGroup);
  }

  private buildSubmergedPassage(
    wetStoneMat: THREE.MeshStandardMaterial,
    cenoteWaterMat: THREE.MeshStandardMaterial,
    jungleStoneMat: THREE.MeshStandardMaterial
  ): void {
    const cenoteGroup = new THREE.Group();
    const gH = standAt(-180, 175);

    const basinRim = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 9.5, 2.4, 20, 1, true),
      wetStoneMat
    );
    basinRim.position.set(-180, gH + 1.1, 175);
    basinRim.castShadow = true;
    basinRim.receiveShadow = true;
    cenoteGroup.add(basinRim);

    // Central Serpent Altar rising inside the cenote
    const altar = new THREE.Mesh(createIncaBlock(2.4, 2.8, 2.4, 0.14, 1.8), jungleStoneMat);
    altar.position.set(-180, gH + 1.1, 175);
    altar.castShadow = true;
    altar.receiveShadow = true;
    cenoteGroup.add(altar);
    this.interactables.push(altar);

    const pool = new THREE.Mesh(new THREE.CylinderGeometry(8.3, 8.3, 0.1, 20), cenoteWaterMat);
    pool.position.set(-180, gH + 1.15, 175);
    pool.receiveShadow = true;
    this.cenotePool = pool;
    cenoteGroup.add(pool);

    this.group.add(cenoteGroup);
  }
}
