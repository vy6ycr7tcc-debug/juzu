import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsSystem } from '../physics.js';
import {
  ashlarWeathered,
  granite,
  bronze,
  copperWorn,
  woodWet,
  woodAged,
  poolStill,
} from '../materials.js';
import { createMistTexture } from '../textures.js';

export interface HydraulicCistern {
  group: THREE.Group;
  wheelGroup: THREE.Group;
  gateMesh: THREE.Mesh;
  update: (dt: number, playerPos: THREE.Vector3) => void;
  interact: () => boolean;
  canInteract: (playerPos: THREE.Vector3) => boolean;
  isActivated: boolean;
  waterLevel: number;
  wheelRotation: number;
  gateHeight: number;
  raftY: number;
}

export function createHydraulicCistern(
  scene: THREE.Scene,
  physicsSystem: PhysicsSystem,
  options: {
    origin?: THREE.Vector3;
  } = {}
): HydraulicCistern {
  const origin = options.origin ?? new THREE.Vector3(45, -2.0, -30);
  const puzzleGroup = new THREE.Group();
  puzzleGroup.position.copy(origin);

  // Materials
  const stoneMat = ashlarWeathered();
  const graniteMat = granite();
  const bronzeMat = bronze();
  const copperMat = copperWorn();
  const timberMat = woodWet();
  const woodMat = woodAged();
  const waterMat = poolStill();

  // Rope braided material
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x8a7250,
    roughness: 0.9,
    metalness: 0.05,
  });

  // ---------------------------------------------------------------------------
  // 1. Cistern Architecture (Sunken Masonry Chamber & Terraces)
  // ---------------------------------------------------------------------------
  const cisternWidth = 10.0;
  const cisternLength = 14.0;
  const cisternDepth = 5.5;
  const floorY = -cisternDepth;

  // Cistern Floor
  const floorGeo = new THREE.BoxGeometry(cisternWidth, 0.8, cisternLength);
  const floorMesh = new THREE.Mesh(floorGeo, graniteMat);
  floorMesh.position.set(0, floorY - 0.4, 0);
  floorMesh.receiveShadow = true;
  puzzleGroup.add(floorMesh);

  // Cistern Side Walls (Left: -X, Right: +X)
  const sideWallGeo = new THREE.BoxGeometry(1.2, cisternDepth + 1.5, cisternLength);
  const leftWall = new THREE.Mesh(sideWallGeo, stoneMat);
  leftWall.position.set(-cisternWidth / 2 - 0.6, floorY / 2 + 0.75, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  puzzleGroup.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, stoneMat);
  rightWall.position.set(cisternWidth / 2 + 0.6, floorY / 2 + 0.75, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  puzzleGroup.add(rightWall);

  // South Entrance Terrace (Player enters from here at Z = +cisternLength/2)
  const terraceGeo = new THREE.BoxGeometry(cisternWidth + 4.0, 1.2, 6.0);
  const southTerrace = new THREE.Mesh(terraceGeo, stoneMat);
  southTerrace.position.set(0, 0, cisternLength / 2 + 3.0);
  southTerrace.castShadow = true;
  southTerrace.receiveShadow = true;
  puzzleGroup.add(southTerrace);

  // North Destination Terrace (Inner temple sanctum entrance at Z = -cisternLength/2)
  const northTerrace = new THREE.Mesh(terraceGeo, stoneMat);
  northTerrace.position.set(0, 0, -cisternLength / 2 - 3.0);
  northTerrace.castShadow = true;
  northTerrace.receiveShadow = true;
  puzzleGroup.add(northTerrace);

  // Stepped Inca corbels framing the terraces
  const corbelGeo = new THREE.BoxGeometry(1.6, 2.8, 1.6);
  for (const x of [-cisternWidth / 2 + 0.5, cisternWidth / 2 - 0.5]) {
    for (const z of [cisternLength / 2, -cisternLength / 2]) {
      const corbel = new THREE.Mesh(corbelGeo, stoneMat);
      corbel.position.set(x, 1.4, z);
      corbel.castShadow = true;
      puzzleGroup.add(corbel);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Rotary Sluice Wheel Mechanism (Bronze wheel on carved stone pedestal)
  // ---------------------------------------------------------------------------
  const wheelPedestalPos = new THREE.Vector3(-3.2, 0.6, cisternLength / 2 + 1.8);
  const pedestalGeo = new THREE.BoxGeometry(1.0, 1.2, 1.0);
  const pedestal = new THREE.Mesh(pedestalGeo, stoneMat);
  pedestal.position.copy(wheelPedestalPos);
  pedestal.castShadow = true;
  puzzleGroup.add(pedestal);

  // Bronze axle mount
  const axleMountGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 12);
  axleMountGeo.rotateX(Math.PI / 2);
  const axleMount = new THREE.Mesh(axleMountGeo, bronzeMat);
  axleMount.position.set(wheelPedestalPos.x, wheelPedestalPos.y + 0.65, wheelPedestalPos.z + 0.25);
  puzzleGroup.add(axleMount);

  // Rotary Sluice Wheel Group
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(wheelPedestalPos.x, wheelPedestalPos.y + 0.65, wheelPedestalPos.z + 0.52);

  // Outer bronze rim
  const rimGeo = new THREE.TorusGeometry(0.75, 0.07, 12, 32);
  const rim = new THREE.Mesh(rimGeo, bronzeMat);
  rim.castShadow = true;
  wheelGroup.add(rim);

  // Central hub
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.22, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, copperMat);
  hub.castShadow = true;
  wheelGroup.add(hub);

  // 4 Turned Bronze/Wood Spokes with Handles
  const spokeGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.45, 8);
  const spoke1 = new THREE.Mesh(spokeGeo, bronzeMat);
  wheelGroup.add(spoke1);

  const spoke2 = new THREE.Mesh(spokeGeo, bronzeMat);
  spoke2.rotation.z = Math.PI / 2;
  wheelGroup.add(spoke2);

  // 4 Outer turning peg handles
  const handleGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8);
  handleGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0.12);
    handle.castShadow = true;
    wheelGroup.add(handle);
  }

  puzzleGroup.add(wheelGroup);

  // ---------------------------------------------------------------------------
  // 3. Sliding Stone Sluice Gate & Aqueduct Arch (North wall intake)
  // ---------------------------------------------------------------------------
  const gateArchGroup = new THREE.Group();
  gateArchGroup.position.set(0, 0, -cisternLength / 2);

  // Massive masonry lintel above gate
  const lintelGeo = new THREE.BoxGeometry(4.8, 1.4, 1.2);
  const lintel = new THREE.Mesh(lintelGeo, stoneMat);
  lintel.position.set(0, 2.2, 0);
  lintel.castShadow = true;
  gateArchGroup.add(lintel);

  // Vertical stone guide posts
  const postGeo = new THREE.BoxGeometry(0.8, 4.5, 1.2);
  const postL = new THREE.Mesh(postGeo, stoneMat);
  postL.position.set(-2.0, 0, 0);
  gateArchGroup.add(postL);

  const postR = new THREE.Mesh(postGeo, stoneMat);
  postR.position.set(2.0, 0, 0);
  gateArchGroup.add(postR);

  // Moving Sluice Gate Slab
  const gateWidth = 3.2;
  const gateHeight = 3.8;
  const gateThickness = 0.55;
  const gateGeo = new THREE.BoxGeometry(gateWidth, gateHeight, gateThickness);
  const gateMesh = new THREE.Mesh(gateGeo, graniteMat);
  gateMesh.castShadow = true;
  gateMesh.receiveShadow = true;
  // Closed baseline position
  gateMesh.position.set(0, floorY + gateHeight / 2 + 0.2, 0);
  gateArchGroup.add(gateMesh);

  // Aqueduct water channel behind the gate
  const aqueductGeo = new THREE.BoxGeometry(3.0, 0.4, 8.0);
  const aqueductWater = new THREE.Mesh(aqueductGeo, waterMat);
  aqueductWater.position.set(0, -0.6, -4.0);
  gateArchGroup.add(aqueductWater);

  puzzleGroup.add(gateArchGroup);

  // ---------------------------------------------------------------------------
  // 4. Dynamic Water Reservoir Volume & Torrent Cascades
  // ---------------------------------------------------------------------------
  const emptyWaterY = floorY + 0.35;
  const filledWaterY = -0.55; // Floats raft to align with terrace at Y=0
  let currentWaterY = emptyWaterY;

  const waterSurfaceGeo = new THREE.PlaneGeometry(cisternWidth - 0.2, cisternLength - 0.2, 16, 16);
  waterSurfaceGeo.rotateX(-Math.PI / 2);
  const reservoirWater = new THREE.Mesh(waterSurfaceGeo, waterMat);
  reservoirWater.position.set(0, currentWaterY, 0);
  reservoirWater.receiveShadow = true;
  puzzleGroup.add(reservoirWater);

  // Waterfall sheet pouring from lifted sluice gate
  const torrentGeo = new THREE.PlaneGeometry(gateWidth - 0.4, 4.0);
  const torrentMat = new THREE.MeshPhysicalMaterial({
    color: 0x5a8898,
    roughness: 0.15,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0, // hidden until gate opens
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const torrentSheet = new THREE.Mesh(torrentGeo, torrentMat);
  torrentSheet.position.set(0, -1.8, -cisternLength / 2 + 0.4);
  puzzleGroup.add(torrentSheet);

  // Water Spray / Splash Particles
  const splashParticles: THREE.Sprite[] = [];
  const splashMat = new THREE.SpriteMaterial({
    map: createMistTexture(),
    color: 0xddeeff,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  // ---------------------------------------------------------------------------
  // 5. Buoyant Cedar Raft Bridge Platform
  // ---------------------------------------------------------------------------
  const raftGroup = new THREE.Group();
  const raftLength = 5.2; // Spans across chasm
  const raftWidth = 3.6;
  const logCount = 6;
  const logRadius = 0.24;

  // 6 Longitudinal Cedar Logs
  for (let l = 0; l < logCount; l++) {
    const logX = (l - (logCount - 1) / 2) * (logRadius * 2.1);
    const logGeo = new THREE.CylinderGeometry(logRadius, logRadius * 0.95, raftLength, 10);
    logGeo.rotateX(Math.PI / 2);
    const logMesh = new THREE.Mesh(logGeo, timberMat);
    logMesh.position.set(logX, 0, 0);
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    raftGroup.add(logMesh);
  }

  // Cross tie braces
  const crossGeo = new THREE.BoxGeometry(raftWidth + 0.2, 0.16, 0.28);
  for (const crossZ of [-raftLength / 2 + 0.6, 0, raftLength / 2 - 0.6]) {
    const cross = new THREE.Mesh(crossGeo, woodMat);
    cross.position.set(0, logRadius + 0.08, crossZ);
    cross.castShadow = true;
    raftGroup.add(cross);

    // Hemp binding ropes
    const ropeWrapGeo = new THREE.TorusGeometry(logRadius * 1.35, 0.035, 6, 12);
    ropeWrapGeo.rotateY(Math.PI / 2);
    for (let l = 0; l < logCount; l++) {
      const logX = (l - (logCount - 1) / 2) * (logRadius * 2.1);
      const rope = new THREE.Mesh(ropeWrapGeo, ropeMat);
      rope.position.set(logX, 0, crossZ);
      raftGroup.add(rope);
    }
  }

  // Raft starts on cistern floor
  let currentRaftY = floorY + logRadius + 0.4;
  raftGroup.position.set(0, currentRaftY, 0);
  puzzleGroup.add(raftGroup);

  scene.add(puzzleGroup);

  // ---------------------------------------------------------------------------
  // 6. Rapier Physics RigidBodies & Colliders
  // ---------------------------------------------------------------------------
  let raftRigidBody: RAPIER.RigidBody | null = null;
  let gateRigidBody: RAPIER.RigidBody | null = null;

  if (physicsSystem.world) {
    const R = physicsSystem.getRapier();
    if (R) {
      // 1. South Terrace Platform Collider
      const sDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x,
        origin.y,
        origin.z + cisternLength / 2 + 3.0
      );
      const sBody = physicsSystem.world.createRigidBody(sDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid((cisternWidth + 4.0) / 2, 0.6, 3.0),
        sBody
      );

      // 2. North Terrace Platform Collider
      const nDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x,
        origin.y,
        origin.z - cisternLength / 2 - 3.0
      );
      const nBody = physicsSystem.world.createRigidBody(nDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid((cisternWidth + 4.0) / 2, 0.6, 3.0),
        nBody
      );

      // 3. Cistern Floor Collider
      const fDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x,
        origin.y + floorY - 0.4,
        origin.z
      );
      const fBody = physicsSystem.world.createRigidBody(fDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid(cisternWidth / 2, 0.4, cisternLength / 2),
        fBody
      );

      // 4. Side Wall Colliders
      const wLDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x - cisternWidth / 2 - 0.6,
        origin.y + floorY / 2 + 0.75,
        origin.z
      );
      const wLBody = physicsSystem.world.createRigidBody(wLDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid(0.6, (cisternDepth + 1.5) / 2, cisternLength / 2),
        wLBody
      );

      const wRDesc = R.RigidBodyDesc.fixed().setTranslation(
        origin.x + cisternWidth / 2 + 0.6,
        origin.y + floorY / 2 + 0.75,
        origin.z
      );
      const wRBody = physicsSystem.world.createRigidBody(wRDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid(0.6, (cisternDepth + 1.5) / 2, cisternLength / 2),
        wRBody
      );

      // 5. Kinematic Sluice Gate Collider
      const gateBodyDesc = R.RigidBodyDesc.kinematicPositionBased().setTranslation(
        origin.x,
        origin.y + gateMesh.position.y,
        origin.z - cisternLength / 2
      );
      gateRigidBody = physicsSystem.world.createRigidBody(gateBodyDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid(gateWidth / 2, gateHeight / 2, gateThickness / 2),
        gateRigidBody
      );

      // 6. Kinematic Buoyant Raft Platform Collider
      const raftBodyDesc = R.RigidBodyDesc.kinematicPositionBased().setTranslation(
        origin.x,
        origin.y + currentRaftY + 0.15,
        origin.z
      );
      raftRigidBody = physicsSystem.world.createRigidBody(raftBodyDesc);
      physicsSystem.world.createCollider(
        R.ColliderDesc.cuboid(raftWidth / 2, 0.25, raftLength / 2),
        raftRigidBody
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Interaction & Simulation State Machine
  // ---------------------------------------------------------------------------
  let isActivated = false;
  let activationProgress = 0.0; // 0.0 to 1.0
  const activationDuration = 4.2; // seconds to fully open and flood
  let wheelRotX = 0;
  let gateLift = 0;

  const worldWheelPos = new THREE.Vector3().copy(wheelPedestalPos).add(origin);

  const canInteract = (playerPos: THREE.Vector3): boolean => {
    return !isActivated && playerPos.distanceTo(worldWheelPos) < 2.5;
  };

  const interact = (): boolean => {
    if (isActivated) return false;
    isActivated = true;
    return true;
  };

  const update = (dt: number, _playerPos: THREE.Vector3) => {
    if (isActivated && activationProgress < 1.0) {
      activationProgress = Math.min(1.0, activationProgress + dt / activationDuration);
      const ease = Math.sin((activationProgress * Math.PI) / 2); // Smooth ease-out curve

      // 1. Rotate Sluice Wheel (2 full turns = 4*pi)
      wheelRotX = activationProgress * Math.PI * 4;
      wheelGroup.rotation.z = wheelRotX;

      // 2. Lift Sluice Gate by +3.0m
      gateLift = ease * 3.0;
      gateMesh.position.y = floorY + gateHeight / 2 + 0.2 + gateLift;

      if (gateRigidBody) {
        gateRigidBody.setNextKinematicTranslation({
          x: origin.x,
          y: origin.y + gateMesh.position.y,
          z: origin.z - cisternLength / 2,
        });
      }

      // 3. Water Torrent Visibility & Opacity
      torrentMat.opacity = Math.min(0.85, activationProgress * 2.2);

      // 4. Dynamic Water Level Rise
      currentWaterY = THREE.MathUtils.lerp(emptyWaterY, filledWaterY, ease);
      reservoirWater.position.y = currentWaterY;

      // 5. Buoyant Floating Raft Lift
      // Buoyancy tracks water surface + gentle floating oscillation
      const bob = Math.sin(activationProgress * 18.0) * 0.05 * (1.0 - ease);
      currentRaftY = currentWaterY + logRadius + 0.35 + bob;
      raftGroup.position.y = currentRaftY;

      if (raftRigidBody) {
        raftRigidBody.setNextKinematicTranslation({
          x: origin.x,
          y: origin.y + currentRaftY + 0.15,
          z: origin.z,
        });
      }

      // 6. Spawn Spray Particles near gate spillway
      if (Math.random() < 0.45) {
        const p = new THREE.Sprite(splashMat);
        p.scale.setScalar(0.25 + Math.random() * 0.35);
        p.position.set(
          origin.x + (Math.random() - 0.5) * 2.5,
          origin.y + currentWaterY + 0.2,
          origin.z - cisternLength / 2 + 0.8 + Math.random() * 1.2
        );
        puzzleGroup.parent?.add(p);
        splashParticles.push(p);
      }
    } else if (isActivated && activationProgress >= 1.0) {
      // Steady-state flooded reservoir with gentle water wave bobbing
      const time = performance.now() * 0.001;
      const gentleBob = Math.sin(time * 2.0) * 0.03;
      currentRaftY = filledWaterY + logRadius + 0.35 + gentleBob;
      raftGroup.position.y = currentRaftY;

      if (raftRigidBody) {
        raftRigidBody.setNextKinematicTranslation({
          x: origin.x,
          y: origin.y + currentRaftY + 0.15,
          z: origin.z,
        });
      }
    }

    // Update splash particles
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const p = splashParticles[i];
      p.position.y += dt * 0.6;
      p.material.opacity -= dt * 1.5;
      p.scale.addScalar(dt * 0.3);
      if (p.material.opacity <= 0) {
        p.parent?.remove(p);
        splashParticles.splice(i, 1);
      }
    }
  };

  return {
    group: puzzleGroup,
    wheelGroup,
    gateMesh,
    update,
    interact,
    canInteract,
    get isActivated() {
      return isActivated;
    },
    get waterLevel() {
      return currentWaterY;
    },
    get wheelRotation() {
      return wheelRotX;
    },
    get gateHeight() {
      return gateLift;
    },
    get raftY() {
      return currentRaftY;
    },
  };
}
