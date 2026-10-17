import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class HighSierraRegion {
  public group = new THREE.Group();
  private texLoader = new THREE.TextureLoader();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_HighSierra';
    scene.add(this.group);

    const stoneDiff = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_diff.jpg');
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;
    stoneDiff.repeat.set(2, 4);

    const stoneNor = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_nor.jpg');
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;
    stoneNor.repeat.set(2, 4);

    const stoneArm = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_arm.jpg');
    stoneArm.wrapS = stoneArm.wrapT = THREE.RepeatWrapping;
    stoneArm.repeat.set(2, 4);

    const ashlarMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: stoneArm,
        color: 0x9e9584, // High Sierra ashlar limestone
        roughness: 0.82,
        metalness: 0.05,
      })
    );

    const rockDiff = this.texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;
    rockDiff.repeat.set(2, 2);

    const rockNor = this.texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;
    rockNor.repeat.set(2, 2);

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
    this.buildIntihuatanaGnomon(bedrockMat);
    this.buildTerracedWalls(ashlarMat);
  }

  private buildChakanaGate(ashlarMat: THREE.MeshStandardMaterial): void {
    // Massive Inca Chakana stepped cross gateway framing the mountain sky at (120, -180)
    const gateGroup = new THREE.Group();
    const gH = standAt(120, -180);

    // Left and right megalithic pillars
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7.5, 2.2), ashlarMat);
    leftPillar.position.set(116, gH + 3.75, -180);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    gateGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7.5, 2.2), ashlarMat);
    rightPillar.position.set(124, gH + 3.75, -180);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    gateGroup.add(rightPillar);

    // Megalithic Lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.0, 2.4), ashlarMat);
    lintel.position.set(120, gH + 7.5, -180);
    lintel.castShadow = true;
    gateGroup.add(lintel);

    this.group.add(gateGroup);
  }

  private buildIntihuatanaGnomon(bedrockMat: THREE.MeshStandardMaterial): void {
    // Intihuatana ('Hitching Post of the Sun') bedrock gnomon at (120, -165)
    const gnomonGroup = new THREE.Group();
    const gH = standAt(120, -165);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.2, 1.2, 12), bedrockMat);
    base.position.set(120, gH + 0.6, -165);
    base.castShadow = true;
    base.receiveShadow = true;
    gnomonGroup.add(base);

    // Upright carved gnomon column
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.8, 0.85), bedrockMat);
    column.position.set(120, gH + 2.4, -165);
    column.rotation.y = 0.45;
    column.castShadow = true;
    column.receiveShadow = true;
    gnomonGroup.add(column);

    this.group.add(gnomonGroup);
  }

  private buildTerracedWalls(terraceMat: THREE.MeshStandardMaterial): void {
    // Concentric agricultural terrace stone walls stepped down the slope
    const terraceGroup = new THREE.Group();

    for (let r = 0; r < 4; r++) {
      const zOffset = -195 + r * 10;
      const wallH = standAt(120, zOffset);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(38, 2.2, 1.8), terraceMat);
      wall.position.set(120, wallH + 0.9, zOffset);
      wall.castShadow = true;
      wall.receiveShadow = true;
      terraceGroup.add(wall);
    }

    this.group.add(terraceGroup);
  }
}
