import * as THREE from 'three';

/**
 * Procedural PBR Survival Equipment for Juzu (Shadow of the Tomb Raider North Star)
 * Modular gear models designed to attach directly to character skeletal rig bones:
 * - Climbing Pickaxe on hip
 * - Recurve Survival Bow across torso
 * - Feathered Arrow Quiver on spine
 */

/**
 * Creates the forged steel climbing pickaxe (Lara's signature tool).
 */
export function createClimbingAxe(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ClimbingAxe';

  // Materials
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x99a3a8,
    metalness: 0.92,
    roughness: 0.28,
  });

  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x24201c,
    metalness: 0.1,
    roughness: 0.65,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x5a3d28,
    metalness: 0.05,
    roughness: 0.85,
  });

  // 1. Shaft (0.46m ergonomic shaft)
  const shaftGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.46, 12);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = -0.23;
  shaft.castShadow = true;
  group.add(shaft);

  // 2. Leather grip wrap on lower section
  const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.y = -0.28;
  grip.castShadow = true;
  group.add(grip);

  // 3. Forged steel pick head
  const headGroup = new THREE.Group();
  headGroup.position.y = 0;

  // Center head socket block
  const socketBlockGeo = new THREE.BoxGeometry(0.038, 0.042, 0.034);
  const socketBlock = new THREE.Mesh(socketBlockGeo, steelMat);
  socketBlock.castShadow = true;
  headGroup.add(socketBlock);

  // Curved forward pick blade (sharp beak)
  const pickShape = new THREE.Shape();
  pickShape.moveTo(0, 0.018);
  pickShape.lineTo(0.14, 0.005);
  pickShape.lineTo(0.16, -0.045); // down-curved pick point
  pickShape.lineTo(0.13, -0.018);
  pickShape.lineTo(0, -0.018);
  pickShape.closePath();

  const extrudeSettings = { depth: 0.008, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.002, bevelThickness: 0.002 };
  const pickGeo = new THREE.ExtrudeGeometry(pickShape, extrudeSettings);
  const pickMesh = new THREE.Mesh(pickGeo, steelMat);
  pickMesh.position.set(0.015, 0, -0.004);
  pickMesh.castShadow = true;
  headGroup.add(pickMesh);

  // Rear adze shovel blade
  const adzeShape = new THREE.Shape();
  adzeShape.moveTo(0, 0.015);
  adzeShape.lineTo(-0.065, 0.022);
  adzeShape.lineTo(-0.075, -0.012);
  adzeShape.lineTo(0, -0.012);
  adzeShape.closePath();

  const adzeGeo = new THREE.ExtrudeGeometry(adzeShape, extrudeSettings);
  const adzeMesh = new THREE.Mesh(adzeGeo, steelMat);
  adzeMesh.position.set(-0.015, 0, -0.004);
  adzeMesh.castShadow = true;
  headGroup.add(adzeMesh);

  group.add(headGroup);

  // 4. Bottom steel spike pommel
  const spikeGeo = new THREE.ConeGeometry(0.012, 0.045, 8);
  const spike = new THREE.Mesh(spikeGeo, steelMat);
  spike.position.y = -0.48;
  spike.rotation.x = Math.PI;
  spike.castShadow = true;
  group.add(spike);

  return group;
}

/**
 * Creates the survival recurve composite bow slung across torso.
 */
export function createRecurveBow(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RecurveBow';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x3d2b1f,
    roughness: 0.72,
    metalness: 0.05,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x1f1b18,
    roughness: 0.9,
    metalness: 0.02,
  });

  const stringMat = new THREE.MeshStandardMaterial({
    color: 0xd8d4cb,
    roughness: 0.5,
    metalness: 0.1,
  });

  // Curve definition for recurve bow stave
  const curvePoints: THREE.Vector3[] = [];
  const totalLength = 1.05;
  const segments = 24;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 - 1; // -1 to +1
    // Classic recurve curve: arc forward at belly, flick recurved back at tips
    const y = t * (totalLength / 2);
    const z = -Math.cos(t * Math.PI * 0.5) * 0.14 + Math.pow(Math.abs(t), 3.0) * 0.06;
    curvePoints.push(new THREE.Vector3(0, y, z));
  }

  const bowCurve = new THREE.CatmullRomCurve3(curvePoints);
  const bowGeo = new THREE.TubeGeometry(bowCurve, 32, 0.012, 8, false);
  const bowMesh = new THREE.Mesh(bowGeo, woodMat);
  bowMesh.castShadow = true;
  group.add(bowMesh);

  // Central leather grip wrap
  const gripGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.15, 8);
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.position.set(0, 0, -0.14);
  gripMesh.castShadow = true;
  group.add(gripMesh);

  // Bowstring connecting tips
  const stringGeo = new THREE.CylinderGeometry(0.002, 0.002, totalLength * 0.96, 6);
  const stringMesh = new THREE.Mesh(stringGeo, stringMat);
  stringMesh.name = 'BowString'; // hidden while drawn — replaced by the V-string in the aim pose
  stringMesh.position.set(0, 0, -0.01);
  group.add(stringMesh);

  return group;
}

/**
 * Creates the leather quiver with feathered arrows.
 */
export function createQuiver(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ArrowQuiver';

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x483221,
    roughness: 0.85,
    metalness: 0.05,
  });

  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x6e5239,
    roughness: 0.7,
    metalness: 0.02,
  });

  const fletchMat1 = new THREE.MeshStandardMaterial({
    color: 0x8a2b20, // Andean crimson fletching
    roughness: 0.6,
  });

  const fletchMat2 = new THREE.MeshStandardMaterial({
    color: 0xd4a34b, // Inca gold fletching
    roughness: 0.6,
  });

  // Quiver leather tube
  const quiverGeo = new THREE.CylinderGeometry(0.045, 0.038, 0.52, 10, 1, true);
  const quiverMesh = new THREE.Mesh(quiverGeo, leatherMat);
  quiverMesh.position.y = -0.12;
  quiverMesh.castShadow = true;
  group.add(quiverMesh);

  // Bottom cap
  const capGeo = new THREE.CylinderGeometry(0.039, 0.039, 0.02, 10);
  const capMesh = new THREE.Mesh(capGeo, leatherMat);
  capMesh.position.y = -0.38;
  group.add(capMesh);

  // Protruding arrows
  const arrowCount = 5;
  for (let i = 0; i < arrowCount; i++) {
    const angle = (i / arrowCount) * Math.PI * 2;
    const rad = 0.022;
    const ax = Math.cos(angle) * rad;
    const az = Math.sin(angle) * rad;

    const arrowGroup = new THREE.Group();
    arrowGroup.position.set(ax, 0, az);
    arrowGroup.rotation.z = (Math.random() - 0.5) * 0.12;
    arrowGroup.rotation.x = (Math.random() - 0.5) * 0.12;

    // Arrow shaft
    const shaftGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.65, 6);
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 0.05;
    arrowGroup.add(shaft);

    // Feathers (3 fletchings per arrow)
    const fMat = i % 2 === 0 ? fletchMat1 : fletchMat2;
    for (let f = 0; f < 3; f++) {
      const fGeo = new THREE.PlaneGeometry(0.022, 0.08);
      const feather = new THREE.Mesh(fGeo, fMat);
      feather.position.y = 0.32;
      feather.rotation.y = (f * Math.PI * 2) / 3;
      feather.position.x = Math.sin((f * Math.PI * 2) / 3) * 0.012;
      feather.position.z = Math.cos((f * Math.PI * 2) / 3) * 0.012;
      arrowGroup.add(feather);
    }

    group.add(arrowGroup);
  }

  return group;
}

/**
 * Creates the survival pine torch with weathered shaft, fibrous twine wrapping,
 * glowing ember core, teardrop flame, and warm amber point light source.
 */
export function createPineTorch(): {
  group: THREE.Group;
  light: THREE.PointLight;
  flameMesh: THREE.Mesh;
  tipPosition: THREE.Vector3;
} {
  const group = new THREE.Group();
  group.name = 'PineTorch';

  // Materials
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x3d2b1f,
    roughness: 0.88,
    metalness: 0.05,
  });

  const twineMat = new THREE.MeshStandardMaterial({
    color: 0x5a4835,
    roughness: 0.95,
    metalness: 0.0,
  });

  const emberMat = new THREE.MeshStandardMaterial({
    color: 0x221105,
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 1.8,
    roughness: 0.9,
  });

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.85,
  });

  // 1. Weathered Pine Branch Shaft (0.55m long)
  const shaftGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.55, 10);
  const shaft = new THREE.Mesh(shaftGeo, woodMat);
  shaft.position.y = -0.2;
  shaft.castShadow = true;
  group.add(shaft);

  // 2. Bound Twine & Resin Head (top 0.14m)
  const headGeo = new THREE.CylinderGeometry(0.038, 0.028, 0.14, 10);
  const head = new THREE.Mesh(headGeo, twineMat);
  head.position.y = 0.08;
  head.castShadow = true;
  group.add(head);

  // Cross-wound rope ties around the resin head
  const ringGeo = new THREE.TorusGeometry(0.036, 0.006, 6, 12);
  for (let r = 0; r < 4; r++) {
    const ring = new THREE.Mesh(ringGeo, woodMat);
    ring.position.y = 0.04 + r * 0.03;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  // 3. Glowing Embers Core
  const emberGeo = new THREE.SphereGeometry(0.032, 8, 8);
  const ember = new THREE.Mesh(emberGeo, emberMat);
  ember.position.y = 0.15;
  group.add(ember);

  // 4. Teardrop Flame Core Mesh
  const flameGeo = new THREE.ConeGeometry(0.042, 0.12, 8);
  const flameMesh = new THREE.Mesh(flameGeo, flameMat);
  flameMesh.position.y = 0.22;
  group.add(flameMesh);

  // 5. Point Light (Warm Amber 2200K firelight with soft falloff)
  const light = new THREE.PointLight(0xff8833, 2.6, 14.0, 1.8);
  light.position.y = 0.24;
  light.castShadow = true;
  light.shadow.bias = -0.002;
  group.add(light);

  const tipPosition = new THREE.Vector3(0, 0.24, 0);

  return {
    group,
    light,
    flameMesh,
    tipPosition,
  };
}

