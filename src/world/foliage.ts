import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { standAt, vnoise } from './terrain';
import { MOBILE } from '../core/quality';

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
  private rootInstances: THREE.InstancedMesh;
  private readonly TREE_COUNT = MOBILE ? 280 : 620;
  private readonly GRASS_COUNT = MOBILE ? 1200 : 3200;
  private readonly ROCK_COUNT = MOBILE ? 200 : 420;
  public isLoaded = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Andean_Foliage';
    scene.add(this.group);

    const texLoader = new THREE.TextureLoader();

    // Mossy Andean bark textures for gnarled Polylepis (Queñua) trunks
    const barkDiff = texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-bark_1k.webp'
        : '/juzu/assets/environment-textures/environment-bark.jpeg'
    );
    barkDiff.colorSpace = THREE.SRGBColorSpace;
    barkDiff.anisotropy = MOBILE ? 2 : 8;
    barkDiff.wrapS = barkDiff.wrapT = THREE.RepeatWrapping;
    barkDiff.repeat.set(1, 2.5);

    const barkNor = texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-bark-normal_1k.webp'
        : '/juzu/assets/environment-textures/environment-bark-normal.jpg'
    );
    barkNor.anisotropy = MOBILE ? 2 : 8;
    barkNor.wrapS = barkNor.wrapT = THREE.RepeatWrapping;
    barkNor.repeat.set(1, 2.5);

    const barkRough = texLoader.load(
      MOBILE
        ? '/juzu/assets/environment-textures/environment-bark-roughness_1k.webp'
        : '/juzu/assets/environment-textures/environment-bark-roughness.jpg'
    );
    barkRough.anisotropy = MOBILE ? 2 : 8;
    barkRough.wrapS = barkRough.wrapT = THREE.RepeatWrapping;
    barkRough.repeat.set(1, 2.5);

    // Alpha-tested botanical canopy & fern/grass textures + leaf normal & roughness
    const canopyTex = texLoader.load(
      MOBILE
        ? '/juzu/textures/foliage_canopy_alpha_1k.webp'
        : '/juzu/textures/foliage_canopy_alpha.png'
    );
    canopyTex.colorSpace = THREE.SRGBColorSpace;
    canopyTex.anisotropy = MOBILE ? 2 : 8;

    const fernTex = texLoader.load(
      MOBILE
        ? '/juzu/textures/fern_grass_alpha_1k.webp'
        : '/juzu/textures/fern_grass_alpha.png'
    );
    fernTex.colorSpace = THREE.SRGBColorSpace;
    fernTex.anisotropy = MOBILE ? 2 : 8;

    const foliageNor = texLoader.load('/juzu/assets/environment-textures/environment-foliage-normal.jpg');
    foliageNor.anisotropy = 8;

    const foliageRough = texLoader.load('/juzu/assets/environment-textures/environment-foliage-roughness.jpg');
    foliageRough.anisotropy = 8;

    // Photogrammetry scanned mossy Andean granite textures (Poly Haven CC0)
    const rockDiff = texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/mossy_rock_diffuse_1k.webp'
        : '/juzu/textures/scans/mossy_rock_diffuse_2k.webp'
    );
    rockDiff.colorSpace = THREE.SRGBColorSpace;
    rockDiff.anisotropy = MOBILE ? 2 : 8;
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;

    const rockNor = texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/mossy_rock_nor_gl_1k.webp'
        : '/juzu/textures/scans/mossy_rock_nor_gl_2k.webp'
    );
    rockNor.anisotropy = MOBILE ? 2 : 8;
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;

    const rockRough = texLoader.load(
      MOBILE
        ? '/juzu/textures/scans/mossy_rock_rough_1k.webp'
        : '/juzu/textures/scans/mossy_rock_rough_2k.webp'
    );
    rockRough.anisotropy = MOBILE ? 2 : 8;
    rockRough.wrapS = rockRough.wrapT = THREE.RepeatWrapping;

    // 1. Gnarled Multi-Limb Polylepis Trunk + Volumetric Canopy Crowns
    const trunkGeom = this.buildGnarledTrunkGeometry();
    const canopyGeom = this.buildCanopyClusterGeometry();

    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkDiff,
      normalMap: barkNor,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: barkRough,
      color: 0xd8cab8, // Preserves mossy green & warm flaking bark from 2K texture
      roughness: 0.88,
      metalness: 0.02,
    });

    const canopyMat = new THREE.MeshStandardMaterial({
      map: canopyTex,
      normalMap: foliageNor,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: foliageRough,
      alphaTest: 0.28,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.01,
      emissive: new THREE.Color(0x18260e),
      emissiveIntensity: 0.18,
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
      normalMap: foliageNor,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: foliageRough,
      alphaTest: 0.28,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.70,
      metalness: 0.01,
      emissive: new THREE.Color(0x16240c),
      emissiveIntensity: 0.14,
    });

    this.grassInstances = new THREE.InstancedMesh(grassGeom, grassMat, this.GRASS_COUNT);
    this.grassInstances.receiveShadow = true;

    // 3. Displaced Mossy Crag Boulders & Bark-Textured Gnarled Root Buttresses
    const rockGeom = this.buildCragBoulderGeometry();
    const rockMat = new THREE.MeshStandardMaterial({
      map: rockDiff,
      normalMap: rockNor,
      normalScale: new THREE.Vector2(1.35, 1.35),
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.04,
    });

    const rootGeom = this.buildGnarledRootButtressGeometry();
    this.rootInstances = new THREE.InstancedMesh(rootGeom, trunkMat, this.TREE_COUNT);
    this.rootInstances.castShadow = true;
    this.rootInstances.receiveShadow = true;

    this.rockInstances = new THREE.InstancedMesh(rockGeom, rockMat, this.ROCK_COUNT);
    this.rockInstances.castShadow = true;
    this.rockInstances.receiveShadow = true;

    this.populateFoliage();

    this.group.add(this.trunkInstances);
    this.group.add(this.canopyInstances);
    this.group.add(this.grassInstances);
    this.group.add(this.rockInstances);
    this.group.add(this.rootInstances);

    this.isLoaded = true;
  }

  private buildGnarledRootButtressGeometry(): THREE.BufferGeometry {
    const roots: THREE.BufferGeometry[] = [];
    for (let r = 0; r < 5; r++) {
      const ang = (r * Math.PI * 2) / 5 + (r % 2) * 0.22;
      const tendril = new THREE.CylinderGeometry(0.09, 0.24, 1.35, 7, 4);
      const pos = tendril.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y + 0.675) / 1.35; // 0 = tip in soil, 1 = trunk join
        pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI) * 0.12);
        pos.setZ(i, pos.getZ(i) * (1.25 - t * 0.35));
      }
      tendril.translate(0, 0.45, 0);
      tendril.rotateZ(0.92);
      tendril.rotateY(ang);
      tendril.translate(0, 0.08, 0);
      tendril.computeVertexNormals();
      roots.push(tendril);
    }
    return mergeGeometries(roots);
  }

  private buildGnarledTrunkGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    // Main twisted trunk with flared buttress root base (12 radial segments for organic roundness)
    const main = new THREE.CylinderGeometry(0.22, 0.58, 5.1, 12, 9);
    main.translate(0, 2.35, 0);
    const pos = main.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = THREE.MathUtils.clamp((y + 0.2) / 5.1, 0, 1);
      const theta = Math.atan2(z, x);
      // Organic 5-fluted root flare & bark ridges near base (t < 0.28)
      const flute = 1.0 + 0.14 * Math.sin(theta * 5 + t * 4.0);
      const rootFlare =
        t < 0.28
          ? 1.0 + Math.pow(1.0 - t / 0.28, 2) * 0.55 * (0.65 + 0.35 * Math.sin(theta * 5))
          : 1.0;
      const bendX = Math.sin(t * Math.PI * 1.35) * 0.36;
      const bendZ = Math.cos(t * Math.PI * 1.15) * 0.24 - 0.24;
      pos.setX(i, x * rootFlare * flute + bendX);
      pos.setZ(i, z * rootFlare * flute + bendZ);
    }
    main.computeVertexNormals();
    parts.push(main);

    // 6 spreading primary and secondary boughs
    const branches = [
      { rx: 0.52, rz: 0.46, ry: 0.2, y: 3.2, len: 2.7, rTop: 0.08, rBot: 0.22 },
      { rx: -0.48, rz: 0.40, ry: 1.9, y: 3.5, len: 2.5, rTop: 0.08, rBot: 0.20 },
      { rx: 0.42, rz: -0.54, ry: 3.5, y: 3.8, len: 2.4, rTop: 0.07, rBot: 0.19 },
      { rx: -0.38, rz: -0.44, ry: 4.9, y: 4.1, len: 2.2, rTop: 0.07, rBot: 0.17 },
      { rx: 0.24, rz: 0.30, ry: 1.1, y: 4.3, len: 2.0, rTop: 0.06, rBot: 0.15 },
      { rx: -0.26, rz: 0.32, ry: 2.7, y: 4.4, len: 1.9, rTop: 0.06, rBot: 0.14 },
    ];
    for (const b of branches) {
      const limb = new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 8, 4);
      limb.translate(0, b.len * 0.5, 0);
      limb.rotateX(b.rx);
      limb.rotateZ(b.rz);
      limb.rotateY(b.ry);
      limb.translate(0.14, b.y, 0);
      limb.computeVertexNormals();
      parts.push(limb);
    }

    return mergeGeometries(parts);
  }

  private buildCanopyClusterGeometry(): THREE.BufferGeometry {
    const cards: THREE.BufferGeometry[] = [];
    // 7 overlapping multi-tier bough crowns for a lush, rounded cloud-forest silhouette
    const crowns = [
      { x: 0.0, y: 6.15, z: 0.0, r: 2.85 },
      { x: 1.55, y: 5.15, z: 1.05, r: 2.45 },
      { x: -1.45, y: 5.3, z: 0.95, r: 2.40 },
      { x: 0.35, y: 5.5, z: -1.55, r: 2.40 },
      { x: -1.25, y: 5.6, z: -1.15, r: 2.25 },
      { x: 1.20, y: 4.65, z: -0.75, r: 2.15 },
      { x: -0.45, y: 4.75, z: 1.35, r: 2.10 },
    ];

    let seed = 0;
    const cardPerCrown = MOBILE ? 9 : 13;
    for (const c of crowns) {
      // Multi-layered domed botanical leaf clusters with Spherical Bent Normals
      for (let k = 0; k < cardPerCrown; k++) {
        seed++;
        const isCore = k < 4;
        const cardScale = isCore ? c.r * 0.98 : c.r * 1.18;
        const card = new THREE.PlaneGeometry(cardScale, cardScale, 3, 3);
        const p = card.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const lx = p.getX(i);
          const ly = p.getY(i);
          const d2 = (lx * lx + ly * ly) / (cardScale * cardScale * 0.5);
          // Dome each leaf cluster smoothly into an umbrella cap so flat planes never show
          p.setZ(i, -d2 * 0.48);
        }

        // Golden-angle phyllotaxis distribution so no two cards align into flat planes
        const goldenAngle = k * 2.3999632 + seed * 0.37;
        const tilt = isCore ? 0.58 + (k % 2) * 0.52 : 0.32 + ((k * 0.618) % 1) * 0.68;
        card.rotateX(tilt);
        card.rotateY(goldenAngle);
        card.rotateZ(((seed % 5) - 2) * 0.16);

        const radialDist = isCore ? c.r * 0.14 : c.r * (0.26 + ((k % 3) * 0.09));
        const verticalOff = ((k / Math.max(1, cardPerCrown - 1)) - 0.46) * c.r * 0.56;
        card.translate(
          c.x + Math.cos(goldenAngle) * radialDist,
          c.y + verticalOff,
          c.z + Math.sin(goldenAngle) * radialDist
        );

        // AAA Spherical Bent Normals + Internal Canopy Occlusion (SpeedTree / Horizon technique)
        const nAttr = card.attributes.normal;
        const colors = new Float32Array(p.count * 3);
        const centerY = c.y - c.r * 0.28;
        for (let i = 0; i < p.count; i++) {
          const vx = p.getX(i);
          const vy = p.getY(i);
          const vz = p.getZ(i);

          // Bent normal points radially outward & upward from sub-crown center
          let nx = vx - c.x;
          let ny = (vy - centerY) * 1.35 + c.r * 0.35;
          let nz = vz - c.z;
          const len = Math.hypot(nx, ny, nz) || 1;
          nx /= len;
          ny /= len;
          nz /= len;
          nAttr.setXYZ(i, nx, ny, nz);

          // Internal canopy ambient occlusion: shadowed interior vs sunlit outer tips
          const distFromCore = Math.hypot(vx - c.x, vy - c.y, vz - c.z) / c.r;
          const heightFactor = THREE.MathUtils.clamp((vy - (c.y - c.r * 0.6)) / (c.r * 1.25), 0, 1);
          const coreAO = isCore ? 0.52 : THREE.MathUtils.clamp(0.46 + distFromCore * 0.48, 0.42, 1.0);
          const sunT = THREE.MathUtils.clamp(heightFactor * 0.65 + coreAO * 0.35, 0.22, 1.0);

          colors[i * 3] = THREE.MathUtils.lerp(0.28, 0.86, sunT);
          colors[i * 3 + 1] = THREE.MathUtils.lerp(0.36, 0.94, sunT);
          colors[i * 3 + 2] = THREE.MathUtils.lerp(0.22, 0.68, sunT);
        }
        nAttr.needsUpdate = true;
        card.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        cards.push(card);
      }
    }

    return mergeGeometries(cards);
  }

  private buildFernRosetteGeometry(): THREE.BufferGeometry {
    const fronds: THREE.BufferGeometry[] = [];
    const frondCount = 7;
    for (let i = 0; i < frondCount; i++) {
      const plane = new THREE.PlaneGeometry(1.55, 1.35, 2, 3);
      plane.translate(0, 0.62, 0);
      const p = plane.attributes.position;
      const colors = new Float32Array(p.count * 3);
      for (let v = 0; v < p.count; v++) {
        const vy = p.getY(v);
        const t = THREE.MathUtils.clamp(vy / 1.35, 0, 1);
        // Arch gracefully outward like real Cyathea tree-fern fronds
        p.setZ(v, t * t * 0.52);
        p.setY(v, vy * (1.0 - t * 0.16));

        const shade = 0.42 + t * 0.58;
        colors[v * 3] = shade * 0.86;
        colors[v * 3 + 1] = shade * 0.98;
        colors[v * 3 + 2] = shade * 0.72;
      }
      plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      plane.rotateX(0.28 + (i % 2) * 0.18);
      plane.rotateY((i * Math.PI * 2) / frondCount + (i % 2) * 0.16);

      // Hemispherical bent normals so understory ferns catch soft sky light instead of harsh flat-plane shading
      const nAttr = plane.attributes.normal;
      for (let v = 0; v < p.count; v++) {
        let nx = p.getX(v);
        let ny = p.getY(v) + 0.85;
        let nz = p.getZ(v);
        const len = Math.hypot(nx, ny, nz) || 1;
        nAttr.setXYZ(v, nx / len, ny / len, nz / len);
      }
      nAttr.needsUpdate = true;
      fronds.push(plane);
    }
    return mergeGeometries(fronds);
  }

  private buildCragBoulderGeometry(): THREE.BufferGeometry {
    const geom = new THREE.IcosahedronGeometry(1.25, 3);
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Angular stratified Andean granite fracture planes
      const n1 = vnoise(x * 1.4 + 5.2, z * 1.4 - 3.1);
      const n2 = vnoise(y * 2.2 - 1.7, x * 1.8 + z * 1.8);
      const strata = 0.90 + 0.14 * Math.sin(y * 5.5 + n1 * 2.4);
      const scale = (0.76 + n1 * 0.36 + (n2 - 0.5) * 0.18) * strata;
      x *= scale * 1.16;
      z *= scale * 1.06;
      // Flatten underside so boulder sits solidly embedded in soil
      y = y < 0 ? y * 0.42 : y * (0.72 + n1 * 0.32);

      const finalY = y + 0.32;
      pos.setXYZ(i, x, finalY, z);

      // Box/planar UV projection (eliminates spherical polar UV pinching at top of boulder)
      uv.setXY(i, (x + finalY * 0.45) * 0.65, (z + finalY * 0.45) * 0.65);

      // Top-surface moss tint vs dark granite underside
      const moss = THREE.MathUtils.clamp((y + 0.25) / 1.15, 0, 1);
      colors[i * 3] = THREE.MathUtils.lerp(0.46, 0.76, moss);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.46, 0.84, moss);
      colors[i * 3 + 2] = THREE.MathUtils.lerp(0.44, 0.66, moss);
    }

    uv.needsUpdate = true;
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  private isInClearZone(x: number, z: number): boolean {
    // Central walkway spine, bridge corridor & camera frustum back-up zone
    if (Math.abs(x) < 4.2 && z > -48 && z < 22) return true;
    // Immediate South Spawn & Campfire clearing (covers camera pull-back)
    if (Math.hypot(x - 0.5, z - 11.5) < 8.5) return true;
    // Immediate Inti Sun-Mirror plinth
    if (Math.hypot(x - (-4.2), z - 3.8) < 3.2) return true;
    // High Sierra central aisle between spawn and Intihuatana/Chakana Gate
    if (Math.abs(x - 120) < 6.5 && z > -186 && z < -150) return true;
    // Jungle Lowlands central causeway & Cenote pool
    if (Math.abs(x - (-180)) < 6.2 && z > 120 && z < 185) return true;
    // Paititi central red-sandstone Plaza floor
    if (Math.hypot(x - 200, z - 180) < 23.5) return true;
    if (Math.abs(x - 200) < 5.5 && z > 152 && z < 185) return true;
    return false;
  }

  private populateFoliage(): void {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // Regional hubs: tighter framing rings around each sanctuary + broader valley coverage
    const hubs = [
      { cx: 0, cz: -38, span: 36, weight: 0.18 },       // Cloud Forest North Sanctuary Framing Grove
      { cx: 0, cz: 10, span: 38, weight: 0.18 },        // Cloud Forest South Camp & Gorge Rim Grove
      { cx: 0, cz: -15, span: 135, weight: 0.22 },      // Cloud Forest Valley Slopes
      { cx: 120, cz: -172, span: 48, weight: 0.14 },    // High Sierra Intihuatana Sanctuary Grove
      { cx: -180, cz: 152, span: 46, weight: 0.16 },    // Antisuyu Jungle Lowlands Rainforest
      { cx: 200, cz: 185, span: 54, weight: 0.12 },     // Paititi Sacred Amphitheater Rim
    ];

    const pickHub = (w: number) => {
      let acc = 0;
      for (const h of hubs) {
        acc += h.weight;
        if (w <= acc) return h;
      }
      return hubs[0];
    };

    // 1. Distribute Polylepis & Rainforest Trees
    let treeIdx = 0;
    for (let i = 1; i <= this.TREE_COUNT * 3 && treeIdx < this.TREE_COUNT; i++) {
      const u = halton(i, 2);
      const v = halton(i, 3);
      const w = halton(i, 5);
      const hub = pickHub(w);

      const x = hub.cx + (u * 2 - 1) * hub.span;
      const z = hub.cz + (v * 2 - 1) * hub.span;

      if (this.isInClearZone(x, z)) continue;
      if (Math.abs(z + 17) < 13.5 && Math.abs(x) < 60) continue;

      const y = standAt(x, z);
      if (y < 0.8 || y > 48.0) continue;

      const dyX = Math.abs(standAt(x + 1.5, z) - y);
      const dyZ = Math.abs(standAt(x, z + 1.5) - y);
      if (dyX > 1.15 || dyZ > 1.15) continue;

      dummy.position.set(x, y - 0.18, z);
      dummy.rotation.set(
        ((i % 7) - 3) * 0.025,
        (i * 2.39996) % (Math.PI * 2),
        ((i % 5) - 2) * 0.025
      );
      const s = 0.85 + ((i * 37) % 45) * 0.018;
      dummy.scale.set(s, s * (0.9 + ((i * 13) % 25) * 0.012), s);
      dummy.updateMatrix();

      this.trunkInstances.setMatrixAt(treeIdx, dummy.matrix);
      this.canopyInstances.setMatrixAt(treeIdx, dummy.matrix);

      const rootDummy = new THREE.Object3D();
      rootDummy.position.set(x, y - 0.06, z);
      rootDummy.rotation.set(0, (i * 1.83) % (Math.PI * 2), 0);
      const rs = s * 0.95;
      rootDummy.scale.set(rs, rs * 0.82, rs);
      rootDummy.updateMatrix();
      this.rootInstances.setMatrixAt(treeIdx, rootDummy.matrix);

      const tone = 0.82 + ((i * 19) % 30) * 0.012;
      color.setRGB(tone * 0.94, tone * 1.04, tone * 0.86);
      this.canopyInstances.setColorAt(treeIdx, color);

      treeIdx++;
    }
    this.trunkInstances.count = treeIdx;
    this.trunkInstances.instanceMatrix.needsUpdate = true;
    this.canopyInstances.count = treeIdx;
    this.canopyInstances.instanceMatrix.needsUpdate = true;
    this.rootInstances.count = treeIdx;
    this.rootInstances.instanceMatrix.needsUpdate = true;
    if (this.canopyInstances.instanceColor) this.canopyInstances.instanceColor.needsUpdate = true;

    // 2. Distribute Cyathea Ferns & Ichu Grass Rosettes across ALL 4 regions & trail edges
    let grassIdx = 0;
    for (let j = 1; j <= this.GRASS_COUNT * 2 && grassIdx < this.GRASS_COUNT; j++) {
      const u = halton(j + 300, 2);
      const v = halton(j + 300, 3);
      const w = halton(j + 300, 5);
      const hub = pickHub(w);

      const x = hub.cx + (u * 2 - 1) * (hub.span * 0.88);
      const z = hub.cz + (v * 2 - 1) * (hub.span * 0.88);

      // Keep the trail corridor, camera frustum and spawn clear while lining trail edges & ruins with ferns!
      if (Math.abs(x) < 3.8 && z > -48 && z < 22) continue;
      if (Math.hypot(x - 0.5, z - 11.5) < 8.5) continue;
      if (Math.hypot(x - 3.2, z - 8.8) < 2.4) continue;
      if (Math.abs(z + 17) < 13.5 && Math.abs(x) < 55) continue;
      if (Math.hypot(x - 200, z - 180) < 22.5) continue;
      if (Math.abs(x - (-180)) < 2.6 && z > 122 && z < 182) continue;

      const y = standAt(x, z);
      if (y < 0.5 || y > 44.0) continue;

      const dy = Math.hypot(standAt(x + 1, z) - y, standAt(x, z + 1) - y);
      if (dy > 1.05) continue;

      dummy.position.set(x, y - 0.03, z);
      dummy.rotation.set(
        Math.sin(j * 0.7) * 0.08,
        (j * 1.618) % (Math.PI * 2),
        Math.cos(j * 0.9) * 0.08
      );
      const s = 1.35 + ((j * 23) % 45) * 0.024;
      dummy.scale.set(s, s * (0.95 + ((j * 17) % 20) * 0.01), s);
      dummy.updateMatrix();

      this.grassInstances.setMatrixAt(grassIdx++, dummy.matrix);
    }
    this.grassInstances.count = grassIdx;
    this.grassInstances.instanceMatrix.needsUpdate = true;

    // 3. Distribute Displaced Mossy Crag Boulders along gorge rims, trail edges, and all 4 regions
    let rockIdx = 0;
    for (let k = 1; k <= this.ROCK_COUNT * 3 && rockIdx < this.ROCK_COUNT; k++) {
      const u = halton(k + 900, 2);
      const v = halton(k + 900, 3);
      const w = halton(k + 900, 5);
      const hub = pickHub(w);

      const x = hub.cx + (u * 2 - 1) * hub.span;
      const z = hub.cz + (v * 2 - 1) * hub.span;

      if (this.isInClearZone(x, z)) continue;
      if (Math.abs(z + 17) < 12.5 && Math.abs(x) < 55) continue;

      const y = standAt(x, z);
      if (y < 0.5 || y > 44.0) continue;

      const rDyX = Math.abs(standAt(x + 1.5, z) - y);
      const rDyZ = Math.abs(standAt(x, z + 1.5) - y);
      if (rDyX > 0.95 || rDyZ > 0.95) continue;

      // Ground the photogrammetry boulder firmly: flat base (Y ~ -0.07m) embeds 0.16m into terrain
      dummy.position.set(x, y - 0.16, z);
      dummy.rotation.set(
        Math.sin(k * 1.3) * 0.12,
        (k * 1.93) % (Math.PI * 2),
        Math.cos(k * 1.7) * 0.12
      );
      const s = 1.0 + ((k * 29) % 45) * 0.024;
      dummy.scale.set(
        s * (0.92 + ((k * 11) % 17) * 0.01),
        s * (0.88 + ((k * 13) % 15) * 0.015),
        s * (0.92 + ((k * 19) % 17) * 0.01)
      );
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
