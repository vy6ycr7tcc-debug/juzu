import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ashlarLight, ashlarWeathered, gold, bronze, type RenderCaps } from './materials.js';

/**
 * Reusable, high-fidelity Inca Architectural System for Juzu.
 *
 * Implements imperial Inca architectural canon from docs/visual-bible.md §4.3:
 * 1. Trapezoidal portals, niches (hornacinas), and windows (top width ≈ 0.85x bottom width).
 * 2. Coursed ashlar masonry with subtle pillowing (cushioning) on exposed faces.
 * 3. Inward wall batter (seismic tilt 3°-5°).
 * 4. Monumental civic scale (>= 3x human height, massive lintels).
 * 5. Merged geometries for optimal draw-call efficiency and static shadow mapping.
 */

// Helper to project planar box UVs cleanly based on world coordinates
function generateBoxUVs(geo: THREE.BufferGeometry, uScale = 1.0, vScale = 1.0): void {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    if (nx > ny && nx > nz) {
      // X-facing face: project Z, Y
      uvs[i * 2] = z * uScale;
      uvs[i * 2 + 1] = y * vScale;
    } else if (ny > nx && ny > nz) {
      // Y-facing face: project X, Z
      uvs[i * 2] = x * uScale;
      uvs[i * 2 + 1] = z * vScale;
    } else {
      // Z-facing face: project X, Y
      uvs[i * 2] = x * uScale;
      uvs[i * 2 + 1] = y * vScale;
    }
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

/**
 * Creates an authentic trapezoidal Inca doorway / portal.
 */
export function createTrapezoidalPortal(opts: {
  widthBottom?: number;
  height?: number;
  depth?: number;
  taperRatio?: number;
  lintelOverhang?: number;
  material?: THREE.Material;
}): THREE.Group {
  const wBottom = opts.widthBottom ?? 2.8;
  const h = opts.height ?? 4.2;
  const d = opts.depth ?? 1.2;
  const taper = opts.taperRatio ?? 0.85; // Visual bible: top width = 0.85 * bottom
  const wTop = wBottom * taper;
  const overhang = opts.lintelOverhang ?? 0.45;
  const mat = opts.material ?? ashlarLight();

  const group = new THREE.Group();
  group.name = 'IncaTrapezoidalPortal';

  const geosToMerge: THREE.BufferGeometry[] = [];

  // 1. Heavy Threshold Base (Stepped stone sill)
  const sillW = wBottom + 1.2;
  const sillH = 0.35;
  const sillGeo = new THREE.BoxGeometry(sillW, sillH, d * 1.15);
  sillGeo.translate(0, sillH / 2, 0);
  geosToMerge.push(sillGeo);

  // 2. Left and Right Inclined Jambs
  const jambThick = 0.75;
  const deltaX = (wBottom - wTop) / 2;
  const tiltAngle = Math.atan2(deltaX, h);

  // Left Jamb
  const leftJambGeo = new THREE.BoxGeometry(jambThick, h, d);
  leftJambGeo.translate(0, h / 2, 0);
  // Apply incline: tilt inward toward +X
  const mLeft = new THREE.Matrix4();
  const leftPivotX = -wBottom / 2 - jambThick / 2;
  mLeft.makeRotationZ(-tiltAngle);
  mLeft.setPosition(leftPivotX + (deltaX / 2), sillH, 0);
  leftJambGeo.applyMatrix4(mLeft);
  geosToMerge.push(leftJambGeo);

  // Right Jamb
  const rightJambGeo = new THREE.BoxGeometry(jambThick, h, d);
  rightJambGeo.translate(0, h / 2, 0);
  // Apply incline: tilt inward toward -X
  const mRight = new THREE.Matrix4();
  const rightPivotX = wBottom / 2 + jambThick / 2;
  mRight.makeRotationZ(tiltAngle);
  mRight.setPosition(rightPivotX - (deltaX / 2), sillH, 0);
  rightJambGeo.applyMatrix4(mRight);
  geosToMerge.push(rightJambGeo);

  // 3. Massive Cyclopean Lintel Stone
  const lintelW = wTop + (jambThick * 2) + (overhang * 2);
  const lintelH = 0.85;
  const lintelD = d * 1.25;
  const lintelGeo = new THREE.BoxGeometry(lintelW, lintelH, lintelD);
  lintelGeo.translate(0, sillH + h + lintelH / 2, 0);
  geosToMerge.push(lintelGeo);

  // 4. Stepped Cornice / Crown Block
  const corniceW = lintelW * 0.85;
  const corniceH = 0.45;
  const corniceGeo = new THREE.BoxGeometry(corniceW, corniceH, d * 1.1);
  corniceGeo.translate(0, sillH + h + lintelH + corniceH / 2, 0);
  geosToMerge.push(corniceGeo);

  // Merge into single optimized mesh
  const merged = mergeGeometries(geosToMerge, false);
  generateBoxUVs(merged, 0.5, 0.5);
  merged.computeVertexNormals();

  const portalMesh = new THREE.Mesh(merged, mat);
  portalMesh.castShadow = true;
  portalMesh.receiveShadow = true;
  group.add(portalMesh);
  group.userData.collidable = true;

  return group;
}

/**
 * Creates a coursed ashlar wall with pillowed blocks and slight batter (incline).
 */
export function createAshlarWall(opts: {
  width: number;
  height: number;
  depth?: number;
  courses?: number;
  blocksPerCourse?: number;
  batterAngle?: number;
  material?: THREE.Material;
}): THREE.Mesh {
  const w = opts.width;
  const h = opts.height;
  const d = opts.depth ?? 1.1;
  const numCourses = opts.courses ?? Math.max(3, Math.round(h / 0.75));
  const blocksPerRow = opts.blocksPerCourse ?? Math.max(3, Math.round(w / 1.1));
  const batter = opts.batterAngle ?? 0.05; // ~2.8° inward slope
  const mat = opts.material ?? ashlarLight();

  const courseH = h / numCourses;
  const blockW = w / blocksPerRow;
  const geos: THREE.BufferGeometry[] = [];

  for (let c = 0; c < numCourses; c++) {
    const y = (c + 0.5) * courseH;
    // Course slight inward offset due to batter
    const zOffset = -(c / numCourses) * Math.sin(batter) * h;
    const isStaggered = c % 2 === 1;

    for (let b = 0; b < blocksPerRow; b++) {
      // Stagger courses for running bond
      const x = -w / 2 + (b + 0.5) * blockW + (isStaggered ? (blockW * 0.25) : 0);
      if (x - blockW / 2 < -w / 2 || x + blockW / 2 > w / 2 + 0.2) continue;

      // Subtle dimensional variation for hand-dressed stonework
      const bw = blockW * 0.98;
      const bh = courseH * 0.97;
      const bd = d + ((b + c) % 3 === 0 ? 0.04 : -0.02);

      const blockGeo = new THREE.BoxGeometry(bw, bh, bd);
      blockGeo.translate(x, y, zOffset);
      geos.push(blockGeo);
    }
  }

  const merged = mergeGeometries(geos, false);
  generateBoxUVs(merged, 0.6, 0.6);
  merged.computeVertexNormals();

  const wallMesh = new THREE.Mesh(merged, mat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.userData.collidable = true;
  return wallMesh;
}

/**
 * Creates the monumental 3-tiered Chakana ceremonial platform for Paititi Plaza.
 */
export function createChakanaPlazaPlatform(opts: {
  radius?: number;
  baseHeight?: number;
  stoneMat?: THREE.Material;
  pavingMat?: THREE.Material;
}): THREE.Group {
  const r = opts.radius ?? 42;
  const stoneMat = opts.stoneMat ?? ashlarLight();
  const pavingMat = opts.pavingMat ?? ashlarWeathered();

  const group = new THREE.Group();
  group.name = 'ChakanaPlazaPlatform';

  // Tier 1: Grand Polygonal Base Terrace
  const tier1R = r;
  const tier1H = 1.6;
  const tier1Geo = new THREE.CylinderGeometry(tier1R, tier1R + 1.2, tier1H, 32);
  tier1Geo.translate(0, tier1H / 2, 0);
  generateBoxUVs(tier1Geo, 0.4, 0.4);
  const tier1Mesh = new THREE.Mesh(tier1Geo, pavingMat);
  tier1Mesh.receiveShadow = true;
  tier1Mesh.castShadow = true;
  group.add(tier1Mesh);

  // Tier 2: Stepped Ceremonial Course
  const tier2R = r * 0.68;
  const tier2H = 1.2;
  const tier2Y = tier1H;
  const tier2Geo = new THREE.CylinderGeometry(tier2R, tier2R + 0.8, tier2H, 32);
  tier2Geo.translate(0, tier2Y + tier2H / 2, 0);
  generateBoxUVs(tier2Geo, 0.4, 0.4);
  const tier2Mesh = new THREE.Mesh(tier2Geo, stoneMat);
  tier2Mesh.receiveShadow = true;
  tier2Mesh.castShadow = true;
  group.add(tier2Mesh);

  // Tier 3: Inner Sacred Dais (Chakana Altar Floor)
  const tier3R = r * 0.38;
  const tier3H = 0.9;
  const tier3Y = tier2Y + tier2H;
  const tier3Geo = new THREE.CylinderGeometry(tier3R, tier3R + 0.5, tier3H, 24);
  tier3Geo.translate(0, tier3Y + tier3H / 2, 0);
  generateBoxUVs(tier3Geo, 0.4, 0.4);
  const tier3Mesh = new THREE.Mesh(tier3Geo, stoneMat);
  tier3Mesh.receiveShadow = true;
  tier3Mesh.castShadow = true;
  group.add(tier3Mesh);

  // 4 Monumental Processional Staircases (N, S, E, W)
  const stairW = 5.2;
  const totalH = tier3Y + tier3H;
  const numSteps = 12;
  const stepH = totalH / numSteps;
  const stepD = 1.1;

  for (let dir = 0; dir < 4; dir++) {
    const angle = dir * (Math.PI / 2);
    const stairGroup = new THREE.Group();
    const stairGeos: THREE.BufferGeometry[] = [];

    for (let s = 0; s < numSteps; s++) {
      const stepY = (s + 0.5) * stepH;
      const stepDist = (tier3R + 1) + (numSteps - 1 - s) * stepD;
      const stepGeo = new THREE.BoxGeometry(stairW, stepH, stepD);
      stepGeo.translate(0, stepY, stepDist);
      stairGeos.push(stepGeo);
    }

    // Heavy Stone Balustrades flanking stairs
    const balGeoL = new THREE.BoxGeometry(0.55, totalH + 0.4, (numSteps + 1) * stepD);
    balGeoL.translate(-stairW / 2 - 0.28, (totalH + 0.4) / 2, tier3R + ((numSteps + 1) * stepD) / 2);
    stairGeos.push(balGeoL);

    const balGeoR = new THREE.BoxGeometry(0.55, totalH + 0.4, (numSteps + 1) * stepD);
    balGeoR.translate(stairW / 2 + 0.28, (totalH + 0.4) / 2, tier3R + ((numSteps + 1) * stepD) / 2);
    stairGeos.push(balGeoR);

    const mergedStairs = mergeGeometries(stairGeos, false);
    generateBoxUVs(mergedStairs, 0.5, 0.5);
    mergedStairs.computeVertexNormals();

    const stairMesh = new THREE.Mesh(mergedStairs, stoneMat);
    stairMesh.castShadow = true;
    stairMesh.receiveShadow = true;
    stairGroup.add(stairMesh);

    stairGroup.rotation.y = angle;
    group.add(stairGroup);
  }

  group.userData.collidable = true;
  return group;
}

/**
 * Creates the monumental Intihuatana Solar Altar & Punchao Sun Disc.
 */
export function createIntihuatanaAltar(opts: {
  stoneMat?: THREE.Material;
  goldMat?: THREE.Material;
  bronzeMat?: THREE.Material;
}): THREE.Group {
  const stoneMat = opts.stoneMat ?? ashlarLight();
  const goldMat = opts.goldMat ?? gold();
  const bronzeMat = opts.bronzeMat ?? bronze();

  const group = new THREE.Group();
  group.name = 'IntihuatanaSolarAltar';

  // 1. Carved Monolithic Bedrock Stepped Base
  const baseGeos: THREE.BufferGeometry[] = [];
  const base1 = new THREE.BoxGeometry(8.5, 1.2, 8.5);
  base1.translate(0, 0.6, 0);
  baseGeos.push(base1);

  const base2 = new THREE.BoxGeometry(6.2, 1.0, 6.2);
  base2.translate(0, 1.2 + 0.5, 0);
  baseGeos.push(base2);

  // Stepped Chakana carved arms
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.BoxGeometry(2.4, 0.8, 2.4);
    const a = i * (Math.PI / 2);
    arm.translate(Math.cos(a) * 3.8, 0.6, Math.sin(a) * 3.8);
    baseGeos.push(arm);
  }

  // 2. Central Hitching Post (Intihuatana Gnomon)
  const gnomon = new THREE.CylinderGeometry(0.65, 0.9, 3.8, 8);
  gnomon.translate(0, 2.2 + 1.9, 0);
  baseGeos.push(gnomon);

  const mergedBase = mergeGeometries(baseGeos, false);
  generateBoxUVs(mergedBase, 0.6, 0.6);
  mergedBase.computeVertexNormals();

  const stoneAltarMesh = new THREE.Mesh(mergedBase, stoneMat);
  stoneAltarMesh.castShadow = true;
  stoneAltarMesh.receiveShadow = true;
  group.add(stoneAltarMesh);

  // 3. The Grand Punchao (Worked Solid Gold Sun Disc)
  const discRadius = 4.2;
  const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.28, 48);
  const punchao = new THREE.Mesh(discGeo, goldMat);
  punchao.rotation.x = Math.PI / 2;
  punchao.rotation.y = Math.PI / 4;
  punchao.position.set(0, 6.8, 0);
  punchao.castShadow = true;
  punchao.receiveShadow = true;
  group.add(punchao);

  // 4. Concentric Astronomical Calendar Rings (Heavy Cast Bronze)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(discRadius + 0.5, 0.12, 16, 64), bronzeMat);
  ring1.position.copy(punchao.position);
  ring1.rotation.copy(punchao.rotation);
  ring1.castShadow = true;
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(discRadius + 1.3, 0.18, 16, 64), bronzeMat);
  ring2.position.copy(punchao.position);
  ring2.rotation.x = Math.PI / 2 - 0.2; // Solstice inclination
  ring2.castShadow = true;
  group.add(ring2);

  group.userData.collidable = true;
  return group;
}

/**
 * Creates the Colonnade Gallery (Kallanka monumental hall) around the Plaza.
 */
export function createPlazaColonnade(opts: {
  radius?: number;
  numPillars?: number;
  height?: number;
  stoneMat?: THREE.Material;
}): THREE.Group {
  const r = opts.radius ?? 34;
  const count = opts.numPillars ?? 12;
  const h = opts.height ?? 6.8;
  const stoneMat = opts.stoneMat ?? ashlarLight();

  const group = new THREE.Group();
  group.name = 'PlazaColonnade';

  const pillarGeos: THREE.BufferGeometry[] = [];
  const beamGeos: THREE.BufferGeometry[] = [];

  const pillarRadius = 0.9;
  const capW = 2.4;
  const capH = 0.55;

  for (let i = 0; i < count; i++) {
    // Offset by half-step so cardinal axes (N, S, E, W) have open view corridors
    const a1 = (i / count) * Math.PI * 2 + (Math.PI / count);
    const a2 = ((i + 1) / count) * Math.PI * 2 + (Math.PI / count);

    const x1 = Math.cos(a1) * r;
    const z1 = Math.sin(a1) * r;
    const x2 = Math.cos(a2) * r;
    const z2 = Math.sin(a2) * r;

    // Heavy Tapered Octagonal Stone Pillar Shaft
    const shaft = new THREE.CylinderGeometry(pillarRadius * 0.88, pillarRadius, h, 8);
    shaft.translate(x1, h / 2, z1);
    pillarGeos.push(shaft);

    // Dressed Capital Block
    const cap = new THREE.BoxGeometry(capW, capH, capW);
    cap.translate(x1, h + capH / 2, z1);
    cap.rotateY(a1);
    pillarGeos.push(cap);

    // Spanning Stone Entablature Beam (connecting pillar i to i+1)
    const spanDist = Math.hypot(x2 - x1, z2 - z1);
    const beamGeo = new THREE.BoxGeometry(capW * 0.85, 0.7, spanDist);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const beamAngle = Math.atan2(x2 - x1, z2 - z1);

    const mBeam = new THREE.Matrix4();
    mBeam.makeRotationY(beamAngle);
    mBeam.setPosition(midX, h + capH + 0.35, midZ);
    beamGeo.applyMatrix4(mBeam);
    beamGeos.push(beamGeo);
  }

  // Merge pillars
  const mergedPillars = mergeGeometries(pillarGeos, false);
  generateBoxUVs(mergedPillars, 0.5, 0.5);
  mergedPillars.computeVertexNormals();

  const pillarMesh = new THREE.Mesh(mergedPillars, stoneMat);
  pillarMesh.castShadow = true;
  pillarMesh.receiveShadow = true;
  group.add(pillarMesh);

  // Merge entablature beams
  const mergedBeams = mergeGeometries(beamGeos, false);
  generateBoxUVs(mergedBeams, 0.5, 0.5);
  mergedBeams.computeVertexNormals();

  const beamMesh = new THREE.Mesh(mergedBeams, stoneMat);
  beamMesh.castShadow = true;
  beamMesh.receiveShadow = true;
  group.add(beamMesh);

  group.userData.collidable = true;
  return group;
}

/**
 * Creates the Sun Temple / Torreón for the Paititi Sanctuary.
 * Modeled after the parabolic curved imperial ashlar Temple of the Sun at Machu Picchu.
 */
export function createTorreonSunTemple(opts: {
  radius?: number;
  height?: number;
  stoneMat?: THREE.Material;
  weatheredMat?: THREE.Material;
}): THREE.Group {
  const r = opts.radius ?? 24;
  const h = opts.height ?? 16;
  const stoneMat = opts.stoneMat ?? ashlarLight();
  const weatheredMat = opts.weatheredMat ?? ashlarWeathered();

  const group = new THREE.Group();
  group.name = 'TorreonSunTemple';

  // 1. Massive Foundation Pavement
  const floorGeo = new THREE.CylinderGeometry(r * 1.15, r * 1.2, 1.4, 48);
  floorGeo.translate(0, 0.7, 0);
  generateBoxUVs(floorGeo, 0.4, 0.4);
  const floorMesh = new THREE.Mesh(floorGeo, weatheredMat);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // 2. Parabolic Curved Ashlar Wall with Inward Batter
  // Entrance opening faces WEST (centered around angle PI)
  const wallGeos: THREE.BufferGeometry[] = [];
  const wallThickness = 1.8;
  const batterOffset = 0.8; // Inward tilt: top is narrower by 0.8m

  // Angle opening: 50 degrees opening at west for the monumental portal
  const openHalfAngle = 0.45;
  const startAngle = -Math.PI + openHalfAngle; // e.g. -PI + 0.45
  const angleSpan = (Math.PI * 2) - (openHalfAngle * 2); // spans around to +PI - 0.45

  // Outer curved wall shell with inward batter
  const outerWallGeo = new THREE.CylinderGeometry(
    r - batterOffset,
    r,
    h,
    48,
    1,
    true,
    startAngle,
    angleSpan
  );
  outerWallGeo.translate(0, 1.4 + h / 2, 0);
  wallGeos.push(outerWallGeo);

  // Inner curved wall shell
  const innerWallGeo = new THREE.CylinderGeometry(
    r - wallThickness - batterOffset,
    r - wallThickness,
    h,
    48,
    1,
    true,
    startAngle,
    angleSpan
  );
  innerWallGeo.translate(0, 1.4 + h / 2, 0);
  wallGeos.push(innerWallGeo);

  // End caps closing the wall on either side of the entrance opening
  for (const endA of [startAngle, startAngle + angleSpan]) {
    const capGeo = new THREE.BoxGeometry(wallThickness, h, 0.6);
    const midR = r - wallThickness / 2;
    const cx = Math.cos(endA) * midR;
    const cz = Math.sin(endA) * midR;
    const m = new THREE.Matrix4();
    m.makeRotationY(-endA);
    m.setPosition(cx, 1.4 + h / 2, cz);
    capGeo.applyMatrix4(m);
    wallGeos.push(capGeo);
  }

  // Top coping / parapet rim
  const rimGeo = new THREE.RingGeometry(r - wallThickness - batterOffset - 0.2, r - batterOffset + 0.2, 48, 1, startAngle, angleSpan);
  rimGeo.rotateX(-Math.PI / 2);
  rimGeo.translate(0, 1.4 + h + 0.05, 0);
  wallGeos.push(rimGeo);

  const mergedWalls = mergeGeometries(wallGeos, false);
  generateBoxUVs(mergedWalls, 0.4, 0.4);
  mergedWalls.computeVertexNormals();

  const wallsMesh = new THREE.Mesh(mergedWalls, stoneMat);
  wallsMesh.material.side = THREE.DoubleSide;
  wallsMesh.castShadow = true;
  wallsMesh.receiveShadow = true;
  group.add(wallsMesh);

  // 3. Flanking Monumental Trapezoidal Portal at the WEST entrance
  const portal = createTrapezoidalPortal({
    widthBottom: 5.2,
    height: 8.5,
    depth: 2.4,
    material: stoneMat
  });
  // Positioned at the west opening (x = -r, z = 0), facing camera (looking towards +X)
  portal.position.set(-r, 1.4, 0);
  portal.rotation.y = Math.PI / 2;
  group.add(portal);

  group.userData.collidable = true;
  return group;
}
