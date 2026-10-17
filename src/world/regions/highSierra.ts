import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway } from '../masonry';

export class HighSierraRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();
  private gnomonColumn?: THREE.Mesh;
  private gateSealMat?: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_HighSierra';
    scene.add(this.group);

    // Authentic High Sierra Scanned PBR Ashlar Masonry & Alpine Bedrock (Poly Haven CC0)
    const stoneDiff = this.texLoader.load('/juzu/textures/scans/castle_wall_slates_diffuse_2k.webp');
    stoneDiff.colorSpace = THREE.SRGBColorSpace;
    stoneDiff.anisotropy = 8;
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;

    const stoneNor = this.texLoader.load('/juzu/textures/scans/castle_wall_slates_nor_gl_2k.webp');
    stoneNor.anisotropy = 8;
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;

    const stoneRough = this.texLoader.load('/juzu/textures/scans/castle_wall_slates_rough_2k.webp');
    stoneRough.anisotropy = 8;
    stoneRough.wrapS = stoneRough.wrapT = THREE.RepeatWrapping;

    const stoneAO = this.texLoader.load('/juzu/textures/scans/castle_wall_slates_ao_2k.webp');
    stoneAO.wrapS = stoneAO.wrapT = THREE.RepeatWrapping;

    const ashlarMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: stoneRough,
        aoMap: stoneAO,
        aoMapIntensity: 0.85,
        color: 0xf5eedc,
        vertexColors: true,
        roughness: 0.84,
        metalness: 0.02,
      })
    );

    const rockDiff = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_diffuse_2k.webp');
    rockDiff.colorSpace = THREE.SRGBColorSpace;
    rockDiff.anisotropy = 8;
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;

    const rockNor = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_nor_gl_2k.webp');
    rockNor.anisotropy = 8;
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;

    const rockRough = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_rough_2k.webp');
    rockRough.anisotropy = 8;
    rockRough.wrapS = rockRough.wrapT = THREE.RepeatWrapping;

    const rockAO = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_ao_2k.webp');
    rockAO.wrapS = rockAO.wrapT = THREE.RepeatWrapping;

    const bedrockMat = solid(
      new THREE.MeshStandardMaterial({
        map: rockDiff,
        normalMap: rockNor,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: rockRough,
        aoMap: rockAO,
        aoMapIntensity: 0.80,
        color: 0xcdc6b8,
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.03,
      })
    );

    this.buildChakanaGate(ashlarMat);
    this.buildIntihuatanaGnomon(bedrockMat, ashlarMat);
    this.buildTerracedWalls(ashlarMat);
  }

  public alignIntihuatanaDial(): void {
    if (this.gnomonColumn) {
      this.gnomonColumn.rotation.y = 0.0;
    }
    if (this.gateSealMat) {
      this.gateSealMat.emissive.setHex(0xd4a028);
      this.gateSealMat.emissiveIntensity = 0.75;
    }
  }

  private buildChakanaGate(ashlarMat: THREE.MeshStandardMaterial): void {
    const gH = standAt(120, -180);
    const gateGroup = buildTrapezoidalGateway(5.4, 2.2, 6.8, 2.2, ashlarMat);
    gateGroup.position.set(120, gH - 0.15, -180);

    // Golden Chakana keystone above the lintel
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a028,
      metalness: 0.9,
      roughness: 0.3,
    });
    this.gateSealMat = goldMat;
    const keystone = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.35), goldMat);
    keystone.position.set(0, 7.6, 1.15);
    gateGroup.add(keystone);
    this.interactables.push(keystone);

    this.group.add(gateGroup);
  }

  private buildIntihuatanaGnomon(
    bedrockMat: THREE.MeshStandardMaterial,
    ashlarMat: THREE.MeshStandardMaterial
  ): void {
    // Intihuatana ('Hitching Post of the Sun') bedrock gnomon at (120, -165)
    const gnomonGroup = new THREE.Group();
    const gH = standAt(120, -165);

    const tier1 = new THREE.Mesh(createIncaBlock(6.4, 0.55, 6.4, 0.08, 2.0), ashlarMat);
    tier1.position.set(120, gH + 0.25, -165);
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    gnomonGroup.add(tier1);

    const tier2 = new THREE.Mesh(createIncaBlock(4.4, 0.65, 4.4, 0.12, 1.8), ashlarMat);
    tier2.position.set(120, gH + 0.82, -165);
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    gnomonGroup.add(tier2);
    this.interactables.push(tier2);

    const tier3 = new THREE.Mesh(createIncaBlock(2.6, 0.55, 2.6, 0.14, 1.6), bedrockMat);
    tier3.position.set(120, gH + 1.38, -165);
    tier3.castShadow = true;
    tier3.receiveShadow = true;
    gnomonGroup.add(tier3);

    // Upright carved gnomon prism with bronze solstice ring
    const column = new THREE.Mesh(createIncaBlock(0.92, 2.2, 0.92, 0.14, 1.4), bedrockMat);
    column.position.set(120, gH + 2.55, -165);
    column.rotation.y = 0.68;
    column.castShadow = true;
    column.receiveShadow = true;
    gnomonGroup.add(column);
    this.gnomonColumn = column;
    this.interactables.push(column);

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xc8963e,
      metalness: 0.9,
      roughness: 0.28,
    });
    const solsticeRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 8, 20), bronzeMat);
    solsticeRing.position.set(120, gH + 3.15, -165);
    solsticeRing.castShadow = true;
    gnomonGroup.add(solsticeRing);

    this.group.add(gnomonGroup);
  }

  private buildTerracedWalls(terraceMat: THREE.MeshStandardMaterial): void {
    // Concentric agricultural terrace walls with a central processional stair gap
    const terraceGroup = new THREE.Group();

    for (let r = 0; r < 4; r++) {
      const zOffset = -195 + r * 10;
      for (const side of [-1, 1]) {
        const xCenter = 120 + side * 12.5;
        const wallH = standAt(xCenter, zOffset);
        const wall = new THREE.Mesh(createIncaBlock(16, 2.1, 1.9, 0.12, 2.0), terraceMat);
        wall.position.set(xCenter, wallH + 0.85, zOffset);
        wall.castShadow = true;
        wall.receiveShadow = true;
        terraceGroup.add(wall);
      }
    }

    this.group.add(terraceGroup);
  }
}
