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

    const stoneDiff = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_diff.jpg');
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;

    const stoneNor = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_nor.jpg');
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;

    const stoneArm = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_arm.jpg');
    stoneArm.wrapS = stoneArm.wrapT = THREE.RepeatWrapping;

    const ashlarMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughnessMap: stoneArm,
        color: 0x9e9584,
        roughness: 0.82,
        metalness: 0.05,
      })
    );

    const rockDiff = this.texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;

    const rockNor = this.texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;

    const bedrockMat = solid(
      new THREE.MeshStandardMaterial({
        map: rockDiff,
        normalMap: rockNor,
        normalScale: new THREE.Vector2(1.0, 1.0),
        color: 0x7a746a,
        roughness: 0.78,
        metalness: 0.08,
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

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 0.9, 12), bedrockMat);
    base.position.set(120, gH + 0.95, -165);
    base.castShadow = true;
    base.receiveShadow = true;
    gnomonGroup.add(base);
    this.interactables.push(base);

    // Upright carved gnomon prism with bronze solstice ring
    const column = new THREE.Mesh(createIncaBlock(0.85, 2.4, 0.85, 0.14, 1.4), bedrockMat);
    column.position.set(120, gH + 2.35, -165);
    column.rotation.y = 0.68;
    column.castShadow = true;
    column.receiveShadow = true;
    gnomonGroup.add(column);
    this.gnomonColumn = column;
    this.interactables.push(column);

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
