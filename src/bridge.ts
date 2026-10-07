import * as THREE from 'three';
import { getImageTexture, ASSET_PATHS } from './textures.js';
import { ashlarWeathered, woodAged } from './materials.js';
import { createTrapezoidalPortal } from './architecture.js';
import { physics, PhysicsSystem } from './physics.js';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Creates a procedural braided rope texture for authentic Andean ichu grass cables (Q'eswachaka).
 */
function createBraidedRopeTextures(): { albedo: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base earthen golden-ochre dried ichu grass color
  ctx.fillStyle = '#b68e52';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Normal map canvas
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d')!;
  const nImgData = nCtx.createImageData(size, size);
  const nData = nImgData.data;

  // Helical twisted cord bands (diagonal ridges at 35 degrees)
  const strandPitch = 24;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Coordinate along helical twist
      const u = (x * 0.707 + y * 0.707) / strandPitch;
      const v = (x * -0.707 + y * 0.707) / strandPitch;

      const strand = Math.sin(u * Math.PI * 2);
      const subStrand = Math.sin(v * Math.PI * 6) * 0.2;
      const noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.12;

      const lum = 0.85 + strand * 0.25 + subStrand + noise;
      // Weathered golden-ochre / tawny earth fiber (authentic ichu grass)
      const r = Math.min(255, Math.max(0, 135 * lum));
      const g = Math.min(255, Math.max(0, 98 * lum));
      const b = Math.min(255, Math.max(0, 56 * lum));

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;

      // Tangent space normal for helical cord
      const slope = Math.cos(u * Math.PI * 2) * 1.8;
      const nx = -slope * 0.707;
      const ny = -slope * 0.707;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);

      nData[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      nData[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      nData[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      nData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  nCtx.putImageData(nImgData, 0, 0);

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(2, 80);
  albedo.colorSpace = THREE.SRGBColorSpace;

  const normal = new THREE.CanvasTexture(nCanvas);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(2, 80);

  return { albedo, normal };
}

let cachedRopeMaterial: THREE.MeshStandardMaterial | null = null;
function getRopeMaterial(): THREE.MeshStandardMaterial {
  if (!cachedRopeMaterial) {
    const { albedo, normal } = createBraidedRopeTextures();
    cachedRopeMaterial = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.94,
      metalness: 0.02,
    });
  }
  return cachedRopeMaterial;
}

export interface IncaRopeBridgeOptions {
  start?: THREE.Vector3;
  end?: THREE.Vector3;
  width?: number;
  sag?: number;
  plankCount?: number;
}

/**
 * Creates an authentic Inca Suspension Rope Bridge (Q'eswachaka).
 * Featuring:
 * - Coursed ashlar stone anchor abutment bastions on both canyon walls
 * - Massive cylindrical stone mooring bollards
 * - 4 main catenary braided grass cables (2 bottom support, 2 handrail)
 * - Intermediate stabilization cables and vertical dropper lashings
 * - Weathered timber deck slats with authentic PBR wood textures
 * - Walkable Rapier physics colliders along the catenary deck
 */
export function createIncaRopeBridge(
  scene: THREE.Scene,
  physicsSystem: PhysicsSystem,
  options: IncaRopeBridgeOptions = {}
): THREE.Group {
  const start = options.start ?? new THREE.Vector3(0, 20, -50);
  const end = options.end ?? new THREE.Vector3(0, 20, 50);
  const deckWidth = options.width ?? 1.8;
  const maxSag = options.sag ?? 2.8;
  const numPlanks = options.plankCount ?? 78;

  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'IncaRopeBridge_Qeswachaka';

  const ropeMat = getRopeMaterial();
  const plankMat = woodAged();
  const stoneMat = ashlarWeathered();

  const span = new THREE.Vector3().subVectors(end, start);
  const spanLength = span.length();

  // Helper for catenary sag at fraction t (0 at ends, max at t = 0.5)
  const getSagAt = (t: number) => {
    // Parabolic approximation of catenary curve
    return 4 * maxSag * t * (1 - t);
  };

  // -------------------------------------------------------------------------
  // 1. Stone Abutments on North & South Canyon Precipices
  // -------------------------------------------------------------------------
  const createAbutment = (anchorPos: THREE.Vector3, isNorth: boolean) => {
    const abutmentGroup = new THREE.Group();
    abutmentGroup.name = isNorth ? 'BridgeAbutment_North' : 'BridgeAbutment_South';
    abutmentGroup.position.copy(anchorPos);
    abutmentGroup.rotation.y = isNorth ? 0 : Math.PI;

    // Monumental stone tower base (rising from bedrock up to bridge deck)
    const baseGeo = new THREE.BoxGeometry(6.4, 24, 6.0);
    const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
    baseMesh.position.set(0, -11.5, -2.5);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    abutmentGroup.add(baseMesh);

    // Trapezoidal portal crowning the abutment tower
    const portal = createTrapezoidalPortal({
      widthBottom: 3.2,
      height: 4.8,
      depth: 1.8,
      material: stoneMat,
    });
    portal.position.set(0, 0, 0);
    abutmentGroup.add(portal);

    // Stone Mooring Bollards (cylindrical monoliths where the 5-inch cables wrap)
    const bollardGeo = new THREE.CylinderGeometry(0.38, 0.45, 2.4, 16);
    const bollardL = new THREE.Mesh(bollardGeo, stoneMat);
    bollardL.position.set(-1.6, 1.2, -1.8);
    bollardL.castShadow = true;
    abutmentGroup.add(bollardL);

    const bollardR = new THREE.Mesh(bollardGeo, stoneMat);
    bollardR.position.set(1.6, 1.2, -1.8);
    bollardR.castShadow = true;
    abutmentGroup.add(bollardR);

    // Approach stone stairs / landing
    const stepCount = 5;
    for (let s = 0; s < stepCount; s++) {
      const stepGeo = new THREE.BoxGeometry(3.6, 0.35, 1.0);
      const stepMesh = new THREE.Mesh(stepGeo, stoneMat);
      stepMesh.position.set(0, -s * 0.35 - 0.18, -2.2 - s * 0.9);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      abutmentGroup.add(stepMesh);
    }

    // Heavy wooden lintel beams anchoring cable pulleys
    const beamGeo = new THREE.BoxGeometry(4.2, 0.4, 0.4);
    const beam = new THREE.Mesh(beamGeo, plankMat);
    beam.position.set(0, 0.2, -1.8);
    beam.castShadow = true;
    abutmentGroup.add(beam);

    // Flanking Inca stepped retaining terrace wings (authentic masonry cliff anchors)
    const wingGeo = new THREE.BoxGeometry(3.4, 16, 4.5);
    const wingL = new THREE.Mesh(wingGeo, stoneMat);
    wingL.position.set(-4.4, -7.5, -1.2);
    wingL.castShadow = true;
    wingL.receiveShadow = true;
    abutmentGroup.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, stoneMat);
    wingR.position.set(4.4, -7.5, -1.2);
    wingR.castShadow = true;
    wingR.receiveShadow = true;
    abutmentGroup.add(wingR);

    // Physics collider for stone landing & steps
    if (physicsSystem.world) {
      const platformDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
        anchorPos.x,
        anchorPos.y - 0.2,
        anchorPos.z + (isNorth ? -2.5 : 2.5)
      );
      const body = physicsSystem.world.createRigidBody(platformDesc);
      const colDesc = RAPIER.ColliderDesc.cuboid(2.5, 1.0, 3.5);
      physicsSystem.world.createCollider(colDesc, body);
    }

    bridgeGroup.add(abutmentGroup);
  };

  createAbutment(start, true);
  createAbutment(end, false);

  // -------------------------------------------------------------------------
  // 2. Main Catenary Suspension Ropes
  // -------------------------------------------------------------------------
  const curvePoints = 32;
  const bottomCableL: THREE.Vector3[] = [];
  const bottomCableR: THREE.Vector3[] = [];
  const handrailL: THREE.Vector3[] = [];
  const handrailR: THREE.Vector3[] = [];
  const midCableL: THREE.Vector3[] = [];
  const midCableR: THREE.Vector3[] = [];

  const halfW = deckWidth / 2;
  const railH = 1.15;
  const midH = 0.55;

  for (let i = 0; i <= curvePoints; i++) {
    const t = i / curvePoints;
    const baseP = start.clone().lerp(end, t);
    const sag = getSagAt(t);

    bottomCableL.push(new THREE.Vector3(baseP.x - halfW, baseP.y - sag, baseP.z));
    bottomCableR.push(new THREE.Vector3(baseP.x + halfW, baseP.y - sag, baseP.z));

    handrailL.push(new THREE.Vector3(baseP.x - halfW - 0.12, baseP.y - sag + railH, baseP.z));
    handrailR.push(new THREE.Vector3(baseP.x + halfW + 0.12, baseP.y - sag + railH, baseP.z));

    midCableL.push(new THREE.Vector3(baseP.x - halfW - 0.08, baseP.y - sag + midH, baseP.z));
    midCableR.push(new THREE.Vector3(baseP.x + halfW + 0.08, baseP.y - sag + midH, baseP.z));
  }

  const createRopeTube = (points: THREE.Vector3[], radius: number) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 64, radius, 8, false);
    const mesh = new THREE.Mesh(geo, ropeMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Heavy bottom support cables (radius ~0.08m)
  bridgeGroup.add(createRopeTube(bottomCableL, 0.085));
  bridgeGroup.add(createRopeTube(bottomCableR, 0.085));

  // Upper handrail ropes (radius ~0.055m)
  bridgeGroup.add(createRopeTube(handrailL, 0.055));
  bridgeGroup.add(createRopeTube(handrailR, 0.055));

  // Middle lateral cables (radius ~0.035m)
  bridgeGroup.add(createRopeTube(midCableL, 0.035));
  bridgeGroup.add(createRopeTube(midCableR, 0.035));

  // -------------------------------------------------------------------------
  // 3. Timber Deck Planks & Vertical Dropper Lashings
  // -------------------------------------------------------------------------
  const plankGeo = new THREE.BoxGeometry(deckWidth + 0.35, 0.14, 0.42);
  const dropperGeo = new THREE.CylinderGeometry(0.018, 0.018, railH, 5);

  const plankPositions: THREE.Vector3[] = [];

  for (let i = 0; i < numPlanks; i++) {
    const t = (i + 0.5) / numPlanks;
    const baseP = start.clone().lerp(end, t);
    const sag = getSagAt(t);

    const pY = baseP.y - sag;
    const pos = new THREE.Vector3(baseP.x, pY, baseP.z);
    plankPositions.push(pos);

    // Slope angle tangent to the catenary curve
    const dt = 0.005;
    const sagA = getSagAt(Math.max(0, t - dt));
    const sagB = getSagAt(Math.min(1, t + dt));
    const slope = (sagB - sagA) / (dt * 2 * spanLength);
    const pitch = -Math.atan(slope);

    // Subtle hand-lashed organic irregularity
    const seed = i * 17.31;
    const jitterYaw = (Math.sin(seed) * 0.035);
    const jitterRoll = (Math.cos(seed * 1.5) * 0.025);

    const plankMesh = new THREE.Mesh(plankGeo, plankMat);
    plankMesh.position.copy(pos);
    plankMesh.rotation.set(pitch + jitterRoll, jitterYaw, 0);
    plankMesh.castShadow = true;
    plankMesh.receiveShadow = true;
    bridgeGroup.add(plankMesh);

    // Vertical dropper cords (connecting handrail to bottom cables) on both sides
    const dropMeshL = new THREE.Mesh(dropperGeo, ropeMat);
    dropMeshL.position.set(pos.x - halfW - 0.06, pY + railH / 2, pos.z);
    bridgeGroup.add(dropMeshL);

    const dropMeshR = new THREE.Mesh(dropperGeo, ropeMat);
    dropMeshR.position.set(pos.x + halfW + 0.06, pY + railH / 2, pos.z);
    bridgeGroup.add(dropMeshR);

    // Diagonal stabilizer cross-lashings every 4th plank
    if (i % 4 === 0) {
      const diagGeo = new THREE.CylinderGeometry(0.014, 0.014, railH * 1.35, 4);
      const diagL = new THREE.Mesh(diagGeo, ropeMat);
      diagL.position.set(pos.x - halfW - 0.06, pY + railH / 2, pos.z);
      diagL.rotation.z = 0.45;
      bridgeGroup.add(diagL);

      const diagR = new THREE.Mesh(diagGeo, ropeMat);
      diagR.position.set(pos.x + halfW + 0.06, pY + railH / 2, pos.z);
      diagR.rotation.z = -0.45;
      bridgeGroup.add(diagR);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Smooth Walkable Physics Colliders for Bridge Traversal
  // -------------------------------------------------------------------------
  // Segment the catenary into smooth walkable inclined collider boxes
  if (physicsSystem.world) {
    const colliderSegments = 16;
    for (let c = 0; c < colliderSegments; c++) {
      const tA = c / colliderSegments;
      const tB = (c + 1) / colliderSegments;
      const tMid = (tA + tB) / 2;

      const pA = start.clone().lerp(end, tA);
      pA.y -= getSagAt(tA);
      const pB = start.clone().lerp(end, tB);
      pB.y -= getSagAt(tB);

      const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      const segVec = new THREE.Vector3().subVectors(pB, pA);
      const segLen = segVec.length();

      const pitch = Math.atan2(pB.y - pA.y, Math.hypot(pB.x - pA.x, pB.z - pA.z));
      const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);

      const segBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(mid.x, mid.y - 0.08, mid.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

      const segBody = physicsSystem.world.createRigidBody(segBodyDesc);
      const segCollider = RAPIER.ColliderDesc.cuboid(deckWidth / 2, 0.12, segLen / 2);
      physicsSystem.world.createCollider(segCollider, segBody);
    }
  }

  scene.add(bridgeGroup);
  return bridgeGroup;
}
