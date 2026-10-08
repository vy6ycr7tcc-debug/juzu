import * as THREE from 'three';
import { ashlarWeathered } from '../materials.js';
import type { PhysicsSystem } from '../physics.js';

export interface IncaTrapOptions {
  origin?: THREE.Vector3;
  rotationY?: number;
}

export class IncaTrapCorridor {
  public group = new THREE.Group();
  public pressurePlate: THREE.Mesh;
  public portcullisSlab: THREE.Mesh;
  public spikeGroup = new THREE.Group();
  public ropesGroup = new THREE.Group();
  public pulleysGroup = new THREE.Group();

  public isTriggered: boolean = false;
  public isPlateDepressed: boolean = false;
  public plateDepression: number = 0; // 0 (rest) to 1 (fully down)
  public slabProgress: number = 0; // 0 (suspended high) to 1 (slammed shut)

  private plateRestY: number;
  private slabRestY: number;
  private slabFallY: number;
  private corridorHeight: number = 4.2;
  private ropeMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, physics: PhysicsSystem, options: IncaTrapOptions = {}) {
    const origin = options.origin ?? new THREE.Vector3(35, 12, -55);
    const rotationY = options.rotationY ?? 0;

    this.group.name = 'IncaTrapCorridor';
    this.group.position.copy(origin);
    this.group.rotation.y = rotationY;

    // --- 1. Ancient Crypt Corridor Architecture ---
    const corridorLength = 12.0;
    const corridorWidth = 3.6;
    const corridorHeight = 4.2;
    const wallThick = 0.8;

    const wallMat = ashlarWeathered();

    // Left Wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, corridorHeight, corridorLength),
      wallMat
    );
    leftWall.position.set(-corridorWidth * 0.5 - wallThick * 0.5, corridorHeight * 0.5, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.group.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, corridorHeight, corridorLength),
      wallMat
    );
    rightWall.position.set(corridorWidth * 0.5 + wallThick * 0.5, corridorHeight * 0.5, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.group.add(rightWall);

    // Carved Lintel Ceiling Arch
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(corridorWidth + wallThick * 2, wallThick, corridorLength),
      wallMat
    );
    ceiling.position.set(0, corridorHeight + wallThick * 0.5, 0);
    ceiling.castShadow = true;
    ceiling.receiveShadow = true;
    this.group.add(ceiling);

    // Stone Crypt Floor Flags
    const floorGeo = new THREE.BoxGeometry(corridorWidth, 0.4, corridorLength);
    const floor = new THREE.Mesh(floorGeo, wallMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Carved Entrance Stelae / Serpent Columns
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x5a554e,
      roughness: 0.92,
      metalness: 0.0, // Strictly dielectric
    });
    const pillarGeo = new THREE.CylinderGeometry(0.45, 0.55, corridorHeight, 8);
    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-corridorWidth * 0.5, corridorHeight * 0.5, corridorLength * 0.5);
    leftPillar.castShadow = true;
    this.group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(corridorWidth * 0.5, corridorHeight * 0.5, corridorLength * 0.5);
    rightPillar.castShadow = true;
    this.group.add(rightPillar);

    // --- 2. Stepped Stone Pressure Plate ---
    const plateWidth = 2.2;
    const plateLength = 1.8;
    const plateHeight = 0.16;
    this.plateRestY = 0.04;

    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x6e685f,
      roughness: 0.88,
      metalness: 0.0, // Strictly dielectric
    });
    this.pressurePlate = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth, plateHeight, plateLength),
      plateMat
    );
    this.pressurePlate.position.set(0, this.plateRestY, 1.5); // 1.5m into corridor
    this.pressurePlate.receiveShadow = true;
    this.pressurePlate.castShadow = true;
    this.group.add(this.pressurePlate);

    // Carved relief bezel frame around plate
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x48443d,
      roughness: 0.95,
      metalness: 0.0,
    });
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth + 0.2, 0.08, plateLength + 0.2),
      bezelMat
    );
    bezel.position.set(0, 0.02, 1.5);
    bezel.receiveShadow = true;
    this.group.add(bezel);

    // --- 3. Suspended Heavy Stone Portcullis Slab ---
    const slabW = corridorWidth - 0.1;
    const slabH = 2.6;
    const slabD = 0.45;
    this.slabRestY = corridorHeight - 0.2; // High overhead in rest position
    this.slabFallY = slabH * 0.5; // Slammed shut on ground

    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x58534c,
      roughness: 0.90,
      metalness: 0.0,
    });
    this.portcullisSlab = new THREE.Mesh(
      new THREE.BoxGeometry(slabW, slabH, slabD),
      slabMat
    );
    this.portcullisSlab.position.set(0, this.slabRestY, -1.2);
    this.portcullisSlab.castShadow = true;
    this.portcullisSlab.receiveShadow = true;
    this.group.add(this.portcullisSlab);

    // --- 4. Lethal Bronze-Tipped Spikes on Slab Bottom ---
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x6b5d42, // Weathered ancient bronze
      roughness: 0.65,
      metalness: 0.15, // Subtle patina
    });
    const spikeGeo = new THREE.ConeGeometry(0.09, 0.65, 6);
    spikeGeo.rotateX(Math.PI); // Point downward

    const spikeCount = 7;
    for (let i = 0; i < spikeCount; i++) {
      const sx = -slabW * 0.42 + (i / (spikeCount - 1)) * (slabW * 0.84);
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(sx, -slabH * 0.5 - 0.28, 0);
      spike.castShadow = true;
      this.portcullisSlab.add(spike);
    }

    // --- 5. Wooden Pulley Brackets & Braided Hemp Ropes ---
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x423321,
      roughness: 0.88,
      metalness: 0.0,
    });
    const pulleyGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 16);
    pulleyGeo.rotateZ(Math.PI / 2);

    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0x7c7059,
      roughness: 0.96,
      metalness: 0.0,
    });

    for (const side of [-1, 1]) {
      const px = side * (slabW * 0.38);
      // Pulley bracket on ceiling
      const pulley = new THREE.Mesh(pulleyGeo, woodMat);
      pulley.position.set(px, corridorHeight + 0.1, -1.2);
      pulley.castShadow = true;
      this.group.add(pulley);

      // Rope line connecting pulley to slab
      const ropeGeo = new THREE.CylinderGeometry(0.025, 0.025, corridorHeight, 8);
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.position.set(px, corridorHeight * 0.5, -1.2);
      this.ropeMeshes.push(rope);
      this.group.add(rope);
    }

    // --- 6. Rapier Physics Integration ---
    if (physics.world && physics.getRapier()) {
      const R = physics.getRapier()!;
      // Left Wall Collider
      const lwBodyDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x + (-corridorWidth * 0.5 - wallThick * 0.5),
        origin.y + corridorHeight * 0.5,
        origin.z
      );
      const lwBody = physics.world.createRigidBody(lwBodyDesc);
      physics.world.createCollider(R.ColliderDesc.cuboid(wallThick * 0.5, corridorHeight * 0.5, corridorLength * 0.5), lwBody);

      // Right Wall Collider
      const rwBodyDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x + (corridorWidth * 0.5 + wallThick * 0.5),
        origin.y + corridorHeight * 0.5,
        origin.z
      );
      const rwBody = physics.world.createRigidBody(rwBodyDesc);
      physics.world.createCollider(R.ColliderDesc.cuboid(wallThick * 0.5, corridorHeight * 0.5, corridorLength * 0.5), rwBody);
    }

    scene.add(this.group);
  }

  /**
   * Manually triggers the trap mechanism (or triggered via stepping on pressure plate).
   */
  public triggerTrap() {
    if (this.isTriggered) return;
    this.isTriggered = true;
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    // 1. Check player proximity to pressure plate
    const worldPlatePos = new THREE.Vector3();
    this.pressurePlate.getWorldPosition(worldPlatePos);

    const distXZ = Math.hypot(playerPos.x - worldPlatePos.x, playerPos.z - worldPlatePos.z);
    const isPlayerOnPlate = distXZ < 1.1 && Math.abs(playerPos.y - worldPlatePos.y) < 1.0;

    if (isPlayerOnPlate && !this.isPlateDepressed) {
      this.isPlateDepressed = true;
      this.triggerTrap();
    }

    // 2. Animate pressure plate depression
    const targetPlateDep = (this.isPlateDepressed || this.isTriggered) ? 1.0 : 0.0;
    this.plateDepression = THREE.MathUtils.lerp(this.plateDepression, targetPlateDep, 12.0 * dt);
    this.pressurePlate.position.y = this.plateRestY - this.plateDepression * 0.08;

    // 3. Animate heavy portcullis slam if triggered
    if (this.isTriggered && this.slabProgress < 1.0) {
      // Rapid gravity drop acceleration
      this.slabProgress = Math.min(1.0, this.slabProgress + 3.2 * dt);
      const curY = THREE.MathUtils.lerp(this.slabRestY, this.slabFallY, this.slabProgress);
      this.portcullisSlab.position.y = curY;

      // Adjust rope lengths and positions
      const ropeHeight = Math.max(0.2, (this.corridorHeight - curY));
      for (const rope of this.ropeMeshes) {
        rope.scale.y = Math.max(0.1, ropeHeight / this.corridorHeight);
        rope.position.y = this.corridorHeight - ropeHeight * 0.5;
      }
    }
  }
}

export function createIncaTrapCorridor(scene: THREE.Scene, physics: PhysicsSystem, options: IncaTrapOptions = {}): IncaTrapCorridor {
  return new IncaTrapCorridor(scene, physics, options);
}
