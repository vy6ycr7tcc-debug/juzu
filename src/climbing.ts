import * as THREE from 'three';
import { physics } from './physics.js';

export interface ClimbableWall {
  id: string;
  center: THREE.Vector3;
  normal: THREE.Vector3;   // Outward facing normal
  tangent: THREE.Vector3;  // Lateral axis along the wall face
  width: number;
  height: number;
  topY: number;
  bottomY: number;
  mantlePosition: THREE.Vector3; // Safe landing spot on the shelf above
  group: THREE.Group;
}

interface RockChip {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface DustPuff {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ClimbingSystem {
  public walls: ClimbableWall[] = [];
  public particlesGroup = new THREE.Group();

  private chipsPool: RockChip[] = [];
  private dustPool: DustPuff[] = [];

  constructor() {
    this.particlesGroup.name = 'ClimbingParticles';
    this.initParticlePools();
  }

  private initParticlePools() {
    // 1. Rock Chips (small angular shards)
    const chipGeo = new THREE.TetrahedronGeometry(0.025, 0);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x4a433a,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });

    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(chipGeo, chipMat);
      mesh.visible = false;
      this.particlesGroup.add(mesh);
      this.chipsPool.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotationSpeed: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        active: false,
      });
    }

    // 2. Stone Dust Puffs (soft fading dust)
    const dustGeo = new THREE.DodecahedronGeometry(0.04, 1);
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0x8a7f72,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat.clone());
      mesh.visible = false;
      this.particlesGroup.add(mesh);
      this.dustPool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.8,
        active: false,
      });
    }
  }

  public registerWall(wall: ClimbableWall) {
    this.walls.push(wall);
  }

  /**
   * Spawns rock chips and dust puffs at an axe strike location.
   */
  public emitRockStrike(contactPoint: THREE.Vector3, wallNormal: THREE.Vector3) {
    // Spawn 4-7 rock chips
    const numChips = 4 + Math.floor(Math.random() * 4);
    let spawnedChips = 0;
    for (const chip of this.chipsPool) {
      if (!chip.active) {
        chip.active = true;
        chip.life = 0;
        chip.maxLife = 0.5 + Math.random() * 0.5;
        chip.mesh.position.copy(contactPoint);
        chip.mesh.position.addScaledVector(wallNormal, 0.05);
        chip.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
        chip.mesh.visible = true;

        // Eject outward and slightly upward with scatter
        chip.velocity.set(
          wallNormal.x * (1.2 + Math.random() * 1.5) + (Math.random() - 0.5) * 1.2,
          0.8 + Math.random() * 1.6,
          wallNormal.z * (1.2 + Math.random() * 1.5) + (Math.random() - 0.5) * 1.2
        );

        chip.rotationSpeed.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );

        spawnedChips++;
        if (spawnedChips >= numChips) break;
      }
    }

    // Spawn 2-3 dust puffs
    const numDust = 2 + Math.floor(Math.random() * 2);
    let spawnedDust = 0;
    for (const dust of this.dustPool) {
      if (!dust.active) {
        dust.active = true;
        dust.life = 0;
        dust.maxLife = 0.6 + Math.random() * 0.4;
        dust.mesh.position.copy(contactPoint);
        dust.mesh.position.addScaledVector(wallNormal, 0.08);
        dust.mesh.scale.setScalar(0.8 + Math.random() * 0.5);
        dust.mesh.visible = true;
        (dust.mesh.material as THREE.MeshStandardMaterial).opacity = 0.55;

        dust.velocity.set(
          wallNormal.x * 0.4 + (Math.random() - 0.5) * 0.4,
          0.2 + Math.random() * 0.3,
          wallNormal.z * 0.4 + (Math.random() - 0.5) * 0.4
        );

        spawnedDust++;
        if (spawnedDust >= numDust) break;
      }
    }
  }

  /**
   * Checks if character is in range of any registered climbable craggy cliff wall.
   */
  public checkClimbableWall(
    charPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    reachDist: number = 1.15
  ): {
    wall: ClimbableWall;
    contactPoint: THREE.Vector3;
    wallNormal: THREE.Vector3;
    lateralOffset: number;
  } | null {
    for (const wall of this.walls) {
      // Check vertical bounds (allow grabbing slightly below top lip down to base)
      if (charPos.y < wall.bottomY - 0.3 || charPos.y > wall.topY + 0.5) {
        continue;
      }

      // Check character direction vs wall normal (must face mostly towards the wall)
      const dot = forwardDir.dot(wall.normal);
      if (dot > -0.2) {
        // Not facing the wall
        continue;
      }

      // Vector from wall center to character
      const toChar = charPos.clone().sub(wall.center);
      const distFromPlane = toChar.dot(wall.normal);

      // Must be close to the wall plane
      if (distFromPlane < 0.1 || distFromPlane > reachDist) {
        continue;
      }

      // Lateral distance along wall tangent
      const lateralOffset = toChar.dot(wall.tangent);
      const halfWidth = wall.width * 0.5;

      if (Math.abs(lateralOffset) <= halfWidth + 0.2) {
        // Calculate contact point on wall surface
        const contactPoint = charPos.clone().sub(wall.normal.clone().multiplyScalar(distFromPlane));
        return {
          wall,
          contactPoint,
          wallNormal: wall.normal.clone(),
          lateralOffset,
        };
      }
    }

    return null;
  }

  public update(dt: number) {
    // Update rock chips
    for (const chip of this.chipsPool) {
      if (chip.active) {
        chip.life += dt;
        if (chip.life >= chip.maxLife) {
          chip.active = false;
          chip.mesh.visible = false;
          continue;
        }

        chip.velocity.y -= 9.81 * dt; // gravity
        chip.mesh.position.addScaledVector(chip.velocity, dt);
        chip.mesh.rotation.x += chip.rotationSpeed.x * dt;
        chip.mesh.rotation.y += chip.rotationSpeed.y * dt;
        chip.mesh.rotation.z += chip.rotationSpeed.z * dt;
      }
    }

    // Update dust puffs
    for (const dust of this.dustPool) {
      if (dust.active) {
        dust.life += dt;
        const progress = dust.life / dust.maxLife;
        if (progress >= 1.0) {
          dust.active = false;
          dust.mesh.visible = false;
          continue;
        }

        dust.velocity.y -= 0.5 * dt; // light settling
        dust.mesh.position.addScaledVector(dust.velocity, dt);
        dust.mesh.scale.addScalar(dt * 0.4); // expand
        (dust.mesh.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1.0 - progress);
      }
    }
  }
}

export const climbingSystem = new ClimbingSystem();

/**
 * Procedural Craggy Porous Cliff Face (Shadow of the Tomb Raider North Star).
 * Generates an authentic Andean cliff face with stratified sedimentary rock layers,
 * craggy fissure notches, chisel holds, and moss/lichen streaks.
 */
export function createCraggyCliffWall(options: {
  id: string;
  width: number;
  height: number;
  depth?: number;
  position: THREE.Vector3;
  rotationY?: number;
}): { wall: ClimbableWall; group: THREE.Group } {
  const { id, width, height, depth = 2.5, position, rotationY = 0 } = options;

  const group = new THREE.Group();
  group.name = `CraggyCliff_${id}`;
  group.position.copy(position);
  group.rotation.y = rotationY;

  // Compute normal and tangent in world space
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).normalize();
  const tangent = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).normalize();

  // Create high-relief craggy rock geometry with sedimentary strata
  const segmentsW = Math.max(16, Math.round(width * 3.5));
  const segmentsH = Math.max(24, Math.round(height * 3.5));
  const rockGeo = new THREE.BoxGeometry(width, height, depth, segmentsW, segmentsH, 2);

  // Deform vertices on the front face (Z > depth * 0.4) to create craggy, porous, fractured relief
  const posAttr = rockGeo.attributes.position;
  const colors: number[] = [];
  const vertex = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);

    if (vertex.z > depth * 0.35) {
      // 1. Horizontal sedimentary strata
      const strataNoise = Math.sin(vertex.y * 3.5) * 0.18 + Math.cos(vertex.y * 9.2) * 0.08;
      // 2. Vertical craggy fractures and pick grooves
      const fissureNoise = Math.sin(vertex.x * 2.8 + vertex.y * 1.8) * 0.20 + Math.sin(vertex.x * 6.5) * 0.09;
      // 3. High frequency porous roughness
      const microRoughness = (Math.sin(vertex.x * 24.0) * Math.cos(vertex.y * 21.0)) * 0.045;

      const totalDisplacement = strataNoise + fissureNoise + microRoughness;
      vertex.z += totalDisplacement;
      // Slight x/y jitter for broken crags
      vertex.x += Math.sin(vertex.y * 6.0) * 0.06;
      vertex.y += Math.cos(vertex.x * 5.0) * 0.05;

      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);

      // Vertex color styling based on geological depth & exposure
      const shade = THREE.MathUtils.clamp(0.45 + totalDisplacement * 1.4, 0.22, 0.90);
      // Lichen tint in horizontal shelves
      const isShelf = Math.sin(vertex.y * 7.0) > 0.45;
      if (isShelf) {
        colors.push(0.14 * shade, 0.18 * shade, 0.10 * shade); // Lichen moss green
      } else {
        colors.push(0.19 * shade, 0.16 * shade, 0.13 * shade); // Dark weathered Andean granite
      }
    } else {
      // Back & sides: deep slate rock tone
      colors.push(0.12, 0.11, 0.10);
    }
  }

  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  rockGeo.computeVertexNormals();

  // Dielectric PBR rock material: rough, natural, zero metalness
  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    flatShading: true,
  });

  const rockMesh = new THREE.Mesh(rockGeo, rockMat);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  // Register physical Rapier static box collider
  if (physics.world && physics.getRapier()) {
    const R = physics.getRapier()!;
    const qy = Math.sin(rotationY * 0.5);
    const qw = Math.cos(rotationY * 0.5);
    const bodyDesc = R.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: 0, y: qy, z: 0, w: qw });
    const body = physics.world.createRigidBody(bodyDesc);
    const colDesc = R.ColliderDesc.cuboid(width * 0.5, height * 0.5, depth * 0.5);
    physics.world.createCollider(colDesc, body);
  }

  const topY = position.y + height * 0.5;
  const bottomY = position.y - height * 0.5;

  // Safe mantle target: landing on the plateau directly above and behind the cliff top
  const mantlePosition = position.clone()
    .addScaledVector(new THREE.Vector3(0, 1, 0), height * 0.5 + 0.1)
    .addScaledVector(normal, -depth * 0.55);

  const wall: ClimbableWall = {
    id,
    center: position.clone().addScaledVector(normal, depth * 0.5), // Center of the front climbing surface
    normal,
    tangent,
    width,
    height,
    topY,
    bottomY,
    mantlePosition,
    group,
  };

  climbingSystem.registerWall(wall);

  return { wall, group };
}
