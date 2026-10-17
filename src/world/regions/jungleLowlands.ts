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

    // Authentic Jungle Rainforest Scanned PBR Mossy Rock & Damp Cliff (Poly Haven CC0)
    const mossDiff = this.texLoader.load('/juzu/textures/scans/mossy_rock_diffuse_2k.webp');
    mossDiff.colorSpace = THREE.SRGBColorSpace;
    mossDiff.anisotropy = 8;
    mossDiff.wrapS = mossDiff.wrapT = THREE.RepeatWrapping;

    const mossNor = this.texLoader.load('/juzu/textures/scans/mossy_rock_nor_gl_2k.webp');
    mossNor.anisotropy = 8;
    mossNor.wrapS = mossNor.wrapT = THREE.RepeatWrapping;

    const mossRough = this.texLoader.load('/juzu/textures/scans/mossy_rock_rough_2k.webp');
    mossRough.anisotropy = 8;
    mossRough.wrapS = mossRough.wrapT = THREE.RepeatWrapping;

    const mossAO = this.texLoader.load('/juzu/textures/scans/mossy_rock_ao_2k.webp');
    mossAO.wrapS = mossAO.wrapT = THREE.RepeatWrapping;

    const jungleStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: mossDiff,
        normalMap: mossNor,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: mossRough,
        aoMap: mossAO,
        aoMapIntensity: 0.85,
        color: 0xc8d4b8,
        vertexColors: true,
        roughness: 0.86,
        metalness: 0.02,
      })
    );

    const cliffDiff = this.texLoader.load('/juzu/textures/scans/cliff_side_diffuse_2k.webp');
    cliffDiff.colorSpace = THREE.SRGBColorSpace;
    cliffDiff.anisotropy = 8;
    cliffDiff.wrapS = cliffDiff.wrapT = THREE.RepeatWrapping;

    const cliffNor = this.texLoader.load('/juzu/textures/scans/cliff_side_nor_gl_2k.webp');
    cliffNor.anisotropy = 8;
    cliffNor.wrapS = cliffNor.wrapT = THREE.RepeatWrapping;

    const cliffRough = this.texLoader.load('/juzu/textures/scans/cliff_side_rough_2k.webp');
    cliffRough.anisotropy = 8;
    cliffRough.wrapS = cliffRough.wrapT = THREE.RepeatWrapping;

    const cliffAO = this.texLoader.load('/juzu/textures/scans/cliff_side_ao_2k.webp');
    cliffAO.wrapS = cliffAO.wrapT = THREE.RepeatWrapping;

    const wetStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: cliffDiff,
        normalMap: cliffNor,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: cliffRough,
        aoMap: cliffAO,
        aoMapIntensity: 0.85,
        color: 0x6e786c,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.04,
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
    const qH = standAt(-180, 126);

    // Broad flush stone landing quay terrace
    const platform = new THREE.Mesh(createIncaBlock(14, 0.55, 12, 0.08, 2.2), quayMat);
    platform.position.set(-180, qH + 0.18, 126);
    platform.castShadow = true;
    platform.receiveShadow = true;
    quayGroup.add(platform);

    // Flanking carved serpent totem stelae framing the avenue
    for (const side of [-5.2, 5.2]) {
      const totem = new THREE.Mesh(createIncaBlock(1.3, 4.2, 1.3, 0.12, 1.8), quayMat);
      totem.position.set(-180 + side, qH + 2.1, 128);
      totem.castShadow = true;
      totem.receiveShadow = true;
      quayGroup.add(totem);
      this.interactables.push(totem);
    }

    // Ancient Bronze & Stone Sluice Capstan Wheel offset to the right of the central avenue so the Serpent Arches vista is wide open
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xb88636,
      metalness: 0.88,
      roughness: 0.3,
    });
    const capstanPedestal = new THREE.Mesh(createIncaBlock(1.15, 1.25, 1.15, 0.1, 1.5), quayMat);
    capstanPedestal.position.set(-182.6, qH + 0.95, 129.2);
    capstanPedestal.castShadow = true;
    capstanPedestal.receiveShadow = true;
    quayGroup.add(capstanPedestal);

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.065, 8, 20), bronzeMat);
    wheel.position.set(-182.6, qH + 1.55, 128.55);
    wheel.castShadow = true;

    // Crossed bronze capstan spokes & central hub so the wheel is mounted to the pedestal
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.15, 8), bronzeMat);
      spoke.rotation.z = (s * Math.PI) / 4;
      wheel.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.36, 12), bronzeMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.12;
    wheel.add(hub);

    quayGroup.add(wheel);
    this.sluiceWheel = wheel;
    this.interactables.push(wheel);

    this.group.add(quayGroup);
  }

  private buildSerpentArches(jungleStoneMat: THREE.MeshStandardMaterial): void {
    const archGroup = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xc89628,
      metalness: 0.9,
      roughness: 0.32,
    });

    for (let i = 0; i < 3; i++) {
      const z = 135 + i * 13;
      const h = standAt(-180, z);
      const gate = buildTrapezoidalGateway(6.2, 1.7, 5.8, 1.8, jungleStoneMat);
      gate.position.set(-180, h - 0.1, z);

      // Carved golden serpent lintel crest on each arch
      const crest = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 1.92), goldMat);
      crest.position.set(0, 6.2, 0);
      gate.add(crest);

      archGroup.add(gate);
    }

    // Mossy stone processional causeway slabs leading through the Serpent Arches to the Cenote
    for (let s = 0; s < 7; s++) {
      const sz = 133 + s * 5.5;
      const sh = standAt(-180, sz);
      const slab = new THREE.Mesh(createIncaBlock(4.8, 0.28, 4.2, 0.05, 2.0), jungleStoneMat);
      slab.position.set(-180, sh + 0.06, sz);
      slab.receiveShadow = true;
      archGroup.add(slab);
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

    // Octagonal ring of 8 battered Inca stone retaining walls framing the Emerald Cenote
    const numSides = 8;
    const radius = 8.8;
    for (let i = 0; i < numSides; i++) {
      const ang = (i / numSides) * Math.PI * 2 + Math.PI / 8;
      // Leave an entrance gap on the North (-Z) side facing the Serpent Arches
      if (Math.sin(ang) < -0.85) continue;
      const wx = -180 + Math.cos(ang) * radius;
      const wz = 175 + Math.sin(ang) * radius;
      const wall = new THREE.Mesh(createIncaBlock(6.6, 1.65, 1.35, 0.12, 1.8), wetStoneMat);
      wall.position.set(wx, gH + 0.72, wz);
      wall.rotation.y = -ang + Math.PI / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      cenoteGroup.add(wall);
    }

    // Central Serpent Altar rising inside the cenote
    const altarBase = new THREE.Mesh(createIncaBlock(3.8, 1.2, 3.8, 0.12, 1.8), wetStoneMat);
    altarBase.position.set(-180, gH + 0.55, 175);
    altarBase.castShadow = true;
    altarBase.receiveShadow = true;
    cenoteGroup.add(altarBase);

    const altar = new THREE.Mesh(createIncaBlock(2.2, 3.4, 2.2, 0.14, 1.8), jungleStoneMat);
    altar.position.set(-180, gH + 2.1, 175);
    altar.castShadow = true;
    altar.receiveShadow = true;
    cenoteGroup.add(altar);
    this.interactables.push(altar);

    const pool = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.4, 0.14, 24), cenoteWaterMat);
    pool.position.set(-180, gH + 0.65, 175);
    pool.receiveShadow = true;
    this.cenotePool = pool;
    cenoteGroup.add(pool);

    this.group.add(cenoteGroup);
  }
}
