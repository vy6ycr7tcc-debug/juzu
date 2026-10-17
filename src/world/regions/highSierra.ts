import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class HighSierraRegion {
  public group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_HighSierra';
    scene.add(this.group);
    this.buildChakanaGate();
    this.buildIntihuatanaGnomon();
    this.buildTerracedWalls();
  }

  private buildChakanaGate(): void {
    // Massive Inca Chakana stepped cross gateway framing the mountain sky at (120, -180)
    const gateGroup = new THREE.Group();
    const gH = standAt(120, -180);

    const ashlarMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x9e9584, // High Sierra ashlar limestone
        roughness: 0.82,
        metalness: 0.05,
      })
    );

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

    // Lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.0, 2.4), ashlarMat);
    lintel.position.set(120, gH + 7.5, -180);
    lintel.castShadow = true;
    gateGroup.add(lintel);

    this.group.add(gateGroup);
  }

  private buildIntihuatanaGnomon(): void {
    // Intihuatana ('Hitching Post of the Sun') bedrock gnomon at (120, -165)
    const gnomonGroup = new THREE.Group();
    const gH = standAt(120, -165);

    const bedrockMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x7a746a,
        roughness: 0.75,
        metalness: 0.1,
      })
    );

    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.2, 1.2, 8), bedrockMat);
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

  private buildTerracedWalls(): void {
    // Concentric agricultural terrace stone walls stepped down the slope
    const terraceGroup = new THREE.Group();
    const terraceMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x8a8172,
        roughness: 0.88,
        metalness: 0.05,
      })
    );

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
