import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { standAt, vnoise } from './terrain';

function halton(index: number, base: number): number {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

export class Foliage {
  public group = new THREE.Group();
  private trunkInstances: THREE.InstancedMesh;
  private canopyInstances: THREE.InstancedMesh;
  private grassInstances: THREE.InstancedMesh;
  private rockInstances: THREE.InstancedMesh;
  private readonly TREE_COUNT = 420;
  private readonly GRASS_COUNT = 950;
  private readonly ROCK_COUNT = 260;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Andean_Foliage';
    scene.add(this.group);

    const texLoader = new THREE.TextureLoader();

    // Bark textures for gnarled Polylepis (Queñua) trunks
    const barkDiff = texLoader.load('/juzu/textures/bark_diff.jpg');
    barkDiff.wrapS = barkDiff.wrapT = THREE.RepeatWrapping;
    barkDiff.repeat.set(1, 3);

    const barkNor = texLoader.load('/juzu/textures/bark_nor.jpg');
    barkNor.wrapS = barkNor.wrapT = THREE.RepeatWrapping;
    barkNor.repeat.set(1, 3);

    // Alpha-tested botanical canopy & fern/grass textures
    const canopyTex = texLoader.load('/juzu/textures/foliage_canopy_alpha.png');
    canopyTex.colorSpace = THREE.SRGBColorSpace;

    const fernTex = texLoader.load('/juzu/textures/fern_grass_alpha.png');
    fernTex.colorSpace = THREE.SRGBColorSpace;

    // Rock textures for mossy Andean boulders
    const rockDiff = texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;
    rockDiff.repeat.set(2, 2);

    const rockNor = texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;
    rockNor.repeat.set(2, 2);

    // 1. Gnarled Multi-Limb Polylepis Trunk + Canopy Cards
    const trunkGeom = this.buildGnarledTrunkGeometry();
    const canopyGeom = this.buildCanopyClusterGeometry();

    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkDiff,
      normalMap: barkNor,
      normalScale: new THREE.Vector2(1.1, 1.1),
      color: 0x8c6e54, // Warm flaky Polylepis reddish-brown bark
      roughness: 0.88,
      metalness: 0.03,
    });

    const canopyMat = new THREE.MeshStandardMaterial({
      map: canopyTex,
      alphaTest: 0.32,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.02,
    });

    this.trunkInstances = new THREE.InstancedMesh(trunkGeom, trunkMat, this.TREE_COUNT);
    this.trunkInstances.castShadow = true;
    this.trunkInstances.receiveShadow = true;

    this.canopyInstances = new THREE.InstancedMesh(canopyGeom, canopyMat, this.TREE_COUNT);
    this.canopyInstances.castShadow = true;
    this.canopyInstances.receiveShadow = true;

    // 2. Understory Cyathea Ferns & Golden-Green Ichu Rosettes
    const grassGeom = this.buildFernRosetteGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      map: fernTex,
      alphaTest: 0.30,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.02,
    });

    this.grassInstances = new THREE.InstancedMesh(grassGeom, grassMat, this.GRASS_COUNT);
    this.grassInstances.receiveShadow = true;

    // 3. Displaced Mossy Crag Boulders
    const rockGeom = this.buildCragBoulderGeometry();
    const rockMat = new THREE.MeshStandardMaterial({
      map: rockDiff,
      normalMap: rockNor,
      normalScale: new THREE.Vector2(1.1, 1.1),
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05,
    });

    this.rockInstances = new THREE.InstancedMesh(rockGeom, rockMat, this.ROCK_COUNT);
    this.rockInstances.castShadow = true;
    this.rockInstances.receiveShadow = true;

    this.populateFoliage();

    this.group.add(this.trunkInstances);
    this.group.add(this.canopyInstances);
    this.group.add(this.grassInstances);
    this.group.add(this.rockInstances);
  }

  private buildGnarledTrunkGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    // Main twisted trunk
    const main = new THREE.CylinderGeometry(0.18, 0.44, 4.4, 7, 6);
    main.translate(0, 2.2, 0);
    const pos = main.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = y / 4.4;
      const bendX = Math.sin(t * Math.PI * 1.3) * 0.34;
      const bendZ = Math.cos(t * Math.PI * 1.1) * 0.22 - 0.22;
      pos.setX(i, pos.getX(i) + bendX);
      pos.setZ(i, pos.getZ(i) + bendZ);
    }
    main.computeVertexNormals();
    parts.push(main);

    // 3 spreading upper limbs
    const branches = [
      { rx: 0.48, rz: 0.42, ry: 0.2, y: 3.4, len: 2.3, rTop: 0.08, rBot: 0.18 },
      { rx: -0.44, rz: 0.36, ry: 2.3, y: 3.7, len: 2.1, rTop: 0.07, rBot: 0.16 },
      { rx: 0.38, rz: -0.52, ry: 4.2, y: 3.9, len: 2.0, rTop: 0.07, rBot: 0.15 },
    ];
    for (const b of branches) {
      const limb = new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 5, 2);
      limb.translate(0, b.len * 0.5, 0);
      limb.rotateX(b.rx);
      limb.rotateZ(b.rz);
      limb.rotateY(b.ry);
      limb.translate(0.12, b.y, 0);
      limb.computeVertexNormals();
      parts.push(limb);
    }

    return mergeGeometries(parts);
  }

  private buildCanopyClusterGeometry(): THREE.BufferGeometry {
    const cards: THREE.BufferGeometry[] = [];
    // Crown centers matching the 3 upper limbs + central crown
    const crowns = [
      { x: 0.0, y: 5.4, z: 0.0, r: 2.5 },
      { x: 1.15, y: 4.6, z: 0.85, r: 2.2 },
      { x: -1.1, y: 4.8, z: 0.75, r: 2.1 },
      { x: 0.25, y: 5.0, z: -1.15, r: 2.1 },
    ];

    let seed = 0;
    for (const c of crowns) {
      for (let k = 0; k < 4; k++) {
        seed++;
        const card = new THREE.PlaneGeometry(c.r, c.r, 2, 2);
        // Parabolic umbrella curve for volume
        const p = card.attributes.position;
        const colors = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
          const lx = p.getX(i);
          const ly = p.getY(i);
          const d2 = (lx * lx + ly * ly) / (c.r * c.r * 0.5);
          p.setZ(i, -d2 * 0.38);

          // Inner-crown AO vs sunlit outer tips
          const ao = THREE.MathUtils.clamp(0.58 + (ly / c.r + 0.5) * 0.45 + d2 * 0.12, 0.48, 1.12);
          colors[i * 3] = ao * 0.96;
          colors[i * 3 + 1] = ao * 1.02;
          colors[i * 3 + 2] = ao * 0.88;
        }
        card.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        card.rotateX(0.35 + (k % 2) * 0.55);
        card.rotateY((k * Math.PI) / 4 + seed * 0.6);
        card.rotateZ((seed % 3 - 1) * 0.25);
        card.translate(
          c.x + Math.cos(seed * 1.7) * 0.35,
          c.y + (k - 1.5) * 0.28,
          c.z + Math.sin(seed * 1.7) * 0.35
        );
        card.computeVertexNormals();
        cards.push(card);
      }
    }

    return mergeGeometries(cards);
  }

  private buildFernRosetteGeometry(): THREE.BufferGeometry {
    const fronds: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const plane = new THREE.PlaneGeometry(1.45, 1.25, 2, 2);
      plane.translate(0, 0.58, 0);
      const p = plane.attributes.position;
      const colors = new Float32Array(p.count * 3);
      for (let v = 0; v < p.count; v++) {
        const vy = p.getY(v);
        const t = THREE.MathUtils.clamp(vy / 1.2, 0, 1);
        // Arch outward at top
        p.setZ(v, p.getZ(v) + t * t * 0.24);
        const shade = 0.55 + t * 0.52;
        colors[v * 3] = shade;
        colors[v * 3 + 1] = shade * 1.04;
        colors[v * 3 + 2] = shade * 0.92;
      }
      plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      plane.rotateY((i * Math.PI) / 3);
      plane.computeVertexNormals();
      fronds.push(plane);
    }
    return mergeGeometries(fronds);
  }

  private buildCragBoulderGeometry(): THREE.BufferGeometry {
    const geom = new THREE.IcosahedronGeometry(1.3, 2);
    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Angular stratified displacement
      const n = vnoise(x * 1.4 + 5.2, z * 1.4 - 3.1);
      const scale = 0.78 + n * 0.48;
      x *= scale * 1.15;
      z *= scale * 1.05;
      // Flatten underside so boulder sits solidly in soil
      y = y < 0 ? y * 0.45 : y * (0.75 + n * 0.35);

      pos.setXYZ(i, x, y + 0.35, z);

      // Top-surface moss tint vs dark granite underside
      const moss = THREE.MathUtils.clamp((y + 0.2) / 1.2, 0, 1);
      colors[i * 3] = THREE.MathUtils.lerp(0.42, 0.46, moss);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.40, 0.58, moss);
      colors[i * 3 + 2] = THREE.MathUtils.lerp(0.37, 0.36, moss);
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  private isInClearZone(x: number, z: number): boolean {
    // Bridge & Gorge Sanctuary Spine (x in -7.5..7.5, z in -52..16)
    if (Math.abs(x) < 7.5 && z > -52 && z < 16) return true;
    // South Spawn Camp clearing
    if (Math.hypot(x, z - 10) < 9.5) return true;
    // High Sierra Intihuatana & Chakana Gate courtyard + approach
    if (Math.hypot(x - 120, z - (-172)) < 25) return true;
    // Jungle Lowlands Quay, Arches & Cenote spine
    if (Math.abs(x - (-180)) < 13 && z > 114 && z < 190) return true;
    // Paititi Plaza of the Sun
    if (Math.hypot(x - 200, z - 180) < 30) return true;
    return false;
  }

  private populateFoliage(): void {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. Distribute Polylepis & Rainforest Trees across the valley & four regional hubs using Halton sampling
    const hubs = [
      { cx: 0, cz: -15, span: 155, weight: 0.55 },     // Cloud Forest Canyon & Flanking Slopes
      { cx: 120, cz: -180, span: 95, weight: 0.15 },   // High Sierra Timberline
      { cx: -180, cz: 145, span: 105, weight: 0.18 },  // Antisuyu Rainforest
      { cx: 200, cz: 180, span: 95, weight: 0.12 },    // Paititi Outskirts
    ];

    let treeIdx = 0;
    for (let i = 1; i <= this.TREE_COUNT * 2 && treeIdx < this.TREE_COUNT; i++) {
      const u = halton(i, 2);
      const v = halton(i, 3);
      const w = halton(i, 5);

      let hub = hubs[0];
      let acc = 0;
      for (const h of hubs) {
        acc += h.weight;
        if (w <= acc) {
          hub = h;
          break;
        }
      }

      const x = hub.cx + (u * 2 - 1) * hub.span;
      const z = hub.cz + (v * 2 - 1) * hub.span;

      if (this.isInClearZone(x, z)) continue;

      const y = standAt(x, z);
      // Keep above water level and below snowy alpine timberline (46m)
      if (y < 1.2 || y > 46.0) continue;

      // Check local slope so trees don't float on steep canyon cliffs or inside the river gorge
      if (Math.abs(z + 17) < 15.5) continue;
      const dyX = Math.abs(standAt(x + 1.5, z) - y);
      const dyZ = Math.abs(standAt(x, z + 1.5) - y);
      if (dyX > 0.88 || dyZ > 0.88) continue;

      dummy.position.set(x, y - 0.15, z);
      dummy.rotation.set(
        ((i % 7) - 3) * 0.025,
        (i * 2.39996) % (Math.PI * 2),
        ((i % 5) - 2) * 0.025
      );
      const s = 0.82 + ((i * 37) % 45) * 0.016;
      dummy.scale.set(s, s * (0.88 + ((i * 13) % 25) * 0.012), s);
      dummy.updateMatrix();

      this.trunkInstances.setMatrixAt(treeIdx, dummy.matrix);
      this.canopyInstances.setMatrixAt(treeIdx, dummy.matrix);

      // Subtle per-tree foliage hue/value variation
      const tone = 0.82 + ((i * 19) % 30) * 0.012;
      color.setRGB(tone * 0.95, tone * 1.02, tone * 0.88);
      this.canopyInstances.setColorAt(treeIdx, color);

      treeIdx++;
    }
    this.trunkInstances.count = treeIdx;
    this.trunkInstances.instanceMatrix.needsUpdate = true;
    this.canopyInstances.count = treeIdx;
    this.canopyInstances.instanceMatrix.needsUpdate = true;
    if (this.canopyInstances.instanceColor) this.canopyInstances.instanceColor.needsUpdate = true;

    // 2. Distribute Cyathea Ferns & Ichu Grass Rosettes
    let grassIdx = 0;
    for (let j = 1; j <= this.GRASS_COUNT * 2 && grassIdx < this.GRASS_COUNT; j++) {
      const u = halton(j + 300, 2);
      const v = halton(j + 300, 3);
      const x = (u * 2 - 1) * 145;
      const z = -15 + (v * 2 - 1) * 145;

      if (Math.abs(x) < 3.2 && z > -46 && z < 14) continue;
      if (Math.abs(z + 17) < 15.5) continue;

      const y = standAt(x, z);
      if (y < 0.8 || y > 40.0) continue;

      const dy = Math.hypot(standAt(x + 1, z) - y, standAt(x, z + 1) - y);
      if (dy > 0.78) continue;

      dummy.position.set(x, y - 0.08, z);
      dummy.rotation.set(0, (j * 1.618) % (Math.PI * 2), 0);
      const s = 0.65 + ((j * 23) % 45) * 0.016;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      this.grassInstances.setMatrixAt(grassIdx++, dummy.matrix);
    }
    this.grassInstances.count = grassIdx;
    this.grassInstances.instanceMatrix.needsUpdate = true;

    // 3. Distribute Displaced Mossy Crag Boulders along gorge rims, plateaus, and ruins
    let rockIdx = 0;
    for (let k = 1; k <= this.ROCK_COUNT * 3 && rockIdx < this.ROCK_COUNT; k++) {
      const u = halton(k + 900, 2);
      const v = halton(k + 900, 3);
      const x = (u * 2 - 1) * 150;
      const z = -18 + (v * 2 - 1) * 150;

      if (this.isInClearZone(x, z)) continue;
      if (Math.abs(z + 17) < 15.0) continue;

      const y = standAt(x, z);
      if (y < 1.2 || y > 38.0) continue;

      const rDyX = Math.abs(standAt(x + 1.5, z) - y);
      const rDyZ = Math.abs(standAt(x, z + 1.5) - y);
      if (rDyX > 0.72 || rDyZ > 0.72) continue;

      dummy.position.set(x, y - 0.32, z);
      dummy.rotation.set(
        (k * 0.43) % 0.6,
        (k * 1.93) % (Math.PI * 2),
        (k * 0.31) % 0.6
      );
      const sx = 0.75 + ((k * 29) % 50) * 0.032;
      const sy = 0.65 + ((k * 17) % 40) * 0.025;
      const sz = 0.75 + ((k * 31) % 50) * 0.032;
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();

      this.rockInstances.setMatrixAt(rockIdx++, dummy.matrix);
    }
    this.rockInstances.count = rockIdx;
    this.rockInstances.instanceMatrix.needsUpdate = true;
  }

  public update(_time: number): void {
    // Keep instanced world transforms anchored to terrain
  }
}
