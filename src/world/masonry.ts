import * as THREE from 'three/webgpu';

function pseudoNoise(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Builds an authentic Inca battered trapezoidal stone block with world-space UVs,
 * subtle polygonal megalithic undulation, and vertex-color moss/ambient-occlusion weathering.
 */
export function createIncaBlock(
  width: number,
  height: number,
  depth: number,
  batter = 0.08,
  tileSize = 2.0
): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(width, height, depth, 4, 5, 4);
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const uv = geom.attributes.uv;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Normalized height t in [0, 1] from bottom to top
    const t = (y + height * 0.5) / Math.max(0.001, height);
    const taper = 1.0 - batter * t;
    x *= taper;
    z *= taper;

    // Subtle hand-dressed polygonal stone undulation on interior vertices
    const nVal = pseudoNoise(x * 1.7, y * 2.1, z * 1.7) - 0.5;
    const edgeDistY = Math.min(t, 1.0 - t);
    if (edgeDistY > 0.05) {
      x += nVal * 0.045 * Math.min(1.0, width * 0.3);
      z += nVal * 0.045 * Math.min(1.0, depth * 0.3);
    }
    pos.setXYZ(i, x, y, z);

    // World-space box UV projection per face normal
    const nx = Math.abs(norm.getX(i));
    const ny = norm.getY(i);
    const absNy = Math.abs(ny);
    const nz = Math.abs(norm.getZ(i));

    if (absNy > nx && absNy > nz) {
      uv.setXY(i, (x + width * 0.5) / tileSize, (z + depth * 0.5) / tileSize);
    } else if (nx > nz) {
      uv.setXY(i, (z + depth * 0.5) / tileSize, (y + height * 0.5) / tileSize);
    } else {
      uv.setXY(i, (x + width * 0.5) / tileSize, (y + height * 0.5) / tileSize);
    }

    // Vertex-Color Weathering: damp dark-olive moss & soil AO at base (t < 0.32),
    // warm granite in middle courses, and mossy top-ledge growth (ny > 0.5)
    const baseMoss = Math.max(0, 1.0 - t / 0.34);
    const topMoss = ny > 0.55 ? 0.55 : Math.max(0, (t - 0.82) / 0.18) * 0.35;
    const grime = 0.88 + nVal * 0.16;

    let r = 0.96 * grime;
    let g = 0.94 * grime;
    let b = 0.88 * grime;

    // Blend damp forest-moss & ground AO at the bottom of the masonry
    if (baseMoss > 0) {
      const m = baseMoss * baseMoss;
      r = THREE.MathUtils.lerp(r, 0.28, m * 0.78);
      g = THREE.MathUtils.lerp(g, 0.38, m * 0.72);
      b = THREE.MathUtils.lerp(b, 0.20, m * 0.82);
    }
    // Blend lush green cloud-forest moss on horizontal top ledges & upper crevices
    if (topMoss > 0) {
      r = THREE.MathUtils.lerp(r, 0.36, topMoss);
      g = THREE.MathUtils.lerp(g, 0.48, topMoss);
      b = THREE.MathUtils.lerp(b, 0.24, topMoss);
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds an iconic Inca double-jamb trapezoidal gateway with battered pillars,
 * recessed trapezoidal wall niches, weathered megalithic crest blocks, and worn threshold slabs.
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

  const nicheDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1814,
    roughness: 0.95,
    metalness: 0.0,
  });

  const mossCushionMat = new THREE.MeshStandardMaterial({
    color: 0x354a21,
    roughness: 0.92,
    metalness: 0.0,
  });

  for (const side of [-1, 1]) {
    // 1. Stepped foundation plinth
    const plinth = new THREE.Mesh(
      createIncaBlock(pillarWidth * 1.28, 0.95, depth * 1.22, 0.06, 1.8),
      mat
    );
    plinth.position.set(side * offset, 0.45, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // 2. Main battered trapezoidal jamb pillar leaning slightly inward toward the portal
    const jambX = side * (offset - side * 0.12);
    const jamb = new THREE.Mesh(
      createIncaBlock(pillarWidth, height, depth, 0.14, 1.8),
      mat
    );
    jamb.position.set(jambX, height * 0.5 + 0.4, 0);
    jamb.rotation.z = -side * 0.042;
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    group.add(jamb);

    // 3. Inner double-jamb reveal framing the doorway
    const innerReveal = new THREE.Mesh(
      createIncaBlock(pillarWidth * 0.32, height * 0.94, depth * 0.86, 0.10, 1.6),
      mat
    );
    innerReveal.position.set(
      side * (openingWidth * 0.5 + pillarWidth * 0.06),
      height * 0.48 + 0.4,
      0
    );
    innerReveal.rotation.z = -side * 0.042;
    innerReveal.castShadow = true;
    group.add(innerReveal);

    // 4. Recessed Trapezoidal Inca Wall Niches on both front and back faces of each pillar
    const nicheW = pillarWidth * 0.42;
    const nicheH = height * 0.30;
    const nicheY = height * 0.52 + 0.4;
    for (const faceZ of [-1, 1]) {
      const recess = new THREE.Mesh(
        createIncaBlock(nicheW, nicheH, 0.14, 0.18, 1.0),
        nicheDarkMat
      );
      recess.position.set(jambX, nicheY, faceZ * (depth * 0.45));
      group.add(recess);

      const sill = new THREE.Mesh(
        createIncaBlock(nicheW * 1.25, 0.18, 0.24, 0.04, 1.2),
        mat
      );
      sill.position.set(jambX, nicheY - nicheH * 0.54, faceZ * (depth * 0.47));
      sill.castShadow = true;
      group.add(sill);
    }
  }

  // 5. Megalithic battered lintel + corbelled upper cornice
  const lintelW = openingWidth + pillarWidth * 2.22;
  const lintelH = height * 0.24;
  const lintel = new THREE.Mesh(
    createIncaBlock(lintelW, lintelH, depth * 1.12, 0.12, 1.8),
    mat
  );
  lintel.position.set(0, height + lintelH * 0.42, 0);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  group.add(lintel);

  const cornice = new THREE.Mesh(
    createIncaBlock(lintelW * 0.94, lintelH * 0.48, depth * 1.18, 0.08, 1.8),
    mat
  );
  cornice.position.set(0, height + lintelH * 1.04, 0);
  cornice.castShadow = true;
  cornice.receiveShadow = true;
  group.add(cornice);

  // 6. Irregular weathered top crest blocks & mossy cushions (breaks up straight box silhouette like ref_inca_masonry_foliage)
  const crestCount = 5;
  for (let c = 0; c < crestCount; c++) {
    const t = (c / (crestCount - 1)) - 0.5;
    const cw = (lintelW * 0.82) / crestCount;
    const ch = lintelH * (0.34 + ((c * 7) % 3) * 0.11);
    const crestBlock = new THREE.Mesh(
      createIncaBlock(cw * 0.94, ch, depth * 0.96, 0.12, 1.5),
      mat
    );
    crestBlock.position.set(
      t * lintelW * 0.72,
      height + lintelH * 1.28 + ch * 0.42,
      ((c % 2) - 0.5) * 0.06
    );
    crestBlock.castShadow = true;
    crestBlock.receiveShadow = true;
    group.add(crestBlock);

    // Overhanging moss cushion on top of lintel crevices
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(cw * 0.34, 1), mossCushionMat);
    moss.scale.set(1.3, 0.42, 0.95);
    moss.position.set(
      t * lintelW * 0.74,
      height + lintelH * 1.26,
      (c % 2 === 0 ? 1 : -1) * (depth * 0.52)
    );
    group.add(moss);
  }

  // 7. Worn stone threshold paving slabs in the portal opening
  for (let s = -1; s <= 1; s++) {
    const slab = new THREE.Mesh(
      createIncaBlock(openingWidth * 0.36, 0.18, depth * 1.35, 0.04, 1.6),
      mat
    );
    slab.position.set(s * openingWidth * 0.31, 0.07, 0);
    slab.receiveShadow = true;
    group.add(slab);
  }

  return group;
}
