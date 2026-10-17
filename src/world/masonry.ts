import * as THREE from 'three/webgpu';

/**
 * Builds an authentic Inca battered trapezoidal stone block with world-space UVs
 * on every face so masonry courses never stretch regardless of wall dimensions.
 */
export function createIncaBlock(
  width: number,
  height: number,
  depth: number,
  batter = 0.08,
  tileSize = 2.2
): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(width, height, depth, 2, 2, 2);
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const uv = geom.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    // Normalized height t in [0, 1] from bottom to top
    const t = (y + height * 0.5) / Math.max(0.001, height);
    const taper = 1.0 - batter * t;
    x *= taper;
    z *= taper;
    pos.setXYZ(i, x, y, z);

    // World-space box UV projection per face normal
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));

    if (ny > nx && ny > nz) {
      // Top / bottom face
      uv.setXY(i, (x + width * 0.5) / tileSize, (z + depth * 0.5) / tileSize);
    } else if (nx > nz) {
      // Left / right face
      uv.setXY(i, (z + depth * 0.5) / tileSize, (y + height * 0.5) / tileSize);
    } else {
      // Front / back face
      uv.setXY(i, (x + width * 0.5) / tileSize, (y + height * 0.5) / tileSize);
    }
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds an iconic Inca double-jamb trapezoidal gateway with battered pillars and monolithic lintel.
 */
export function buildTrapezoidalGateway(
  openingWidth: number,
  pillarWidth: number,
  height: number,
  depth: number,
  mat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const offset = openingWidth * 0.5 + pillarWidth * 0.5;

  for (const side of [-1, 1]) {
    // Stepped foundation plinth
    const plinth = new THREE.Mesh(
      createIncaBlock(pillarWidth * 1.22, 0.9, depth * 1.18, 0.06, 2.0),
      mat
    );
    plinth.position.set(side * offset, 0.45, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // Battered trapezoidal jamb pillar leaning slightly inward toward the portal
    const jamb = new THREE.Mesh(
      createIncaBlock(pillarWidth, height, depth, 0.14, 2.0),
      mat
    );
    jamb.position.set(side * (offset - side * 0.12), height * 0.5 + 0.4, 0);
    jamb.rotation.z = -side * 0.045;
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    group.add(jamb);
  }

  // Megalithic battered lintel
  const lintelW = openingWidth + pillarWidth * 2.15;
  const lintelH = height * 0.24;
  const lintel = new THREE.Mesh(
    createIncaBlock(lintelW, lintelH, depth * 1.1, 0.12, 2.0),
    mat
  );
  lintel.position.set(0, height + lintelH * 0.42, 0);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  group.add(lintel);

  // Upper cornice cap
  const cornice = new THREE.Mesh(
    createIncaBlock(lintelW * 0.92, lintelH * 0.45, depth * 1.16, 0.08, 2.0),
    mat
  );
  cornice.position.set(0, height + lintelH * 1.02, 0);
  cornice.castShadow = true;
  cornice.receiveShadow = true;
  group.add(cornice);

  return group;
}
