import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
  private readonly TREE_COUNT = 620;
  private readonly GRASS_COUNT = 3200;
  private readonly ROCK_COUNT = 420;
  public isLoaded = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Andean_Foliage';
    scene.add(this.group);

    const texLoader = new THREE.TextureLoader();

    // 2K photorealistic mossy Andean bark textures for gnarled Polylepis (Queñua) trunks
    const barkDiff = texLoader.load('/juzu/assets/environment-textures/environment-bark.jpeg');
    barkDiff.colorSpace = THREE.SRGBColorSpace;
    barkDiff.anisotropy = 8;
    barkDiff.wrapS = barkDiff.wrapT = THREE.RepeatWrapping;
    barkDiff.repeat.set(1, 2.5);

    const barkNor = texLoader.load('/juzu/assets/environment-textures/environment-bark-normal.jpg');
    barkNor.anisotropy = 8;
    barkNor.wrapS = barkNor.wrapT = THREE.RepeatWrapping;
    barkNor.repeat.set(1, 2.5);

    const barkRough = texLoader.load('/juzu/assets/environment-textures/environment-bark-roughness.jpg');
    barkRough.anisotropy = 8;
    barkRough.wrapS = barkRough.wrapT = THREE.RepeatWrapping;
    barkRough.repeat.set(1, 2.5);

    // 1024x1024 alpha-tested botanical canopy & fern/grass textures + 2K leaf normal & roughness
    const canopyTex = texLoader.load('/juzu/textures/foliage_canopy_alpha.png');
    canopyTex.colorSpace = THREE.SRGBColorSpace;
    canopyTex.anisotropy = 8;

    const fernTex = texLoader.load('/juzu/textures/fern_grass_alpha.png');
    fernTex.colorSpace = THREE.SRGBColorSpace;
    fernTex.anisotropy = 8;

    const foliageNor = texLoader.load('/juzu/assets/environment-textures/environment-foliage-normal.jpg');
    foliageNor.anisotropy = 8;

    const foliageRough = texLoader.load('/juzu/assets/environment-textures/environment-foliage-roughness.jpg');
    foliageRough.anisotropy = 8;

    // Rock textures for mossy Andean boulders
    const rockDiff = texLoader.load('/juzu/textures/rock_diff.jpg');
    rockDiff.colorSpace = THREE.SRGBColorSpace;
    rockDiff.anisotropy = 8;
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;
    rockDiff.repeat.set(2, 2);

    const rockNor = texLoader.load('/juzu/textures/rock_nor.jpg');
    rockNor.anisotropy = 8;
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;
    rockNor.repeat.set(2, 2);

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
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: foliageRough,
      alphaTest: 0.24,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.72,
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
      normalMap: foliageNor,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: foliageRough,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.74,
      metalness: 0.02,
    });

    this.grassInstances = new THREE.InstancedMesh(grassGeom, grassMat, this.GRASS_COUNT);
    this.grassInstances.receiveShadow = true;

    // 3. Displaced Mossy Crag Boulders
    const rockGeom = this.buildCragBoulderGeometry();
    const rockMat = new THREE.MeshStandardMaterial({
      map: rockDiff,
      normalMap: rockNor,
      normalScale: new THREE.Vector2(1.35, 1.35),
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.04,
    });

    this.rockInstances = new THREE.InstancedMesh(rockGeom, rockMat, this.ROCK_COUNT);
    this.rockInstances.castShadow = true;
    this.rockInstances.receiveShadow = true;

    this.populateFoliage();

    // Ingest photorealistic scanned assets (Poly Haven CC0 photogrammetry)
    let pendingAssets = 2;
    const onAssetLoaded = () => {
      pendingAssets--;
      if (pendingAssets <= 0) {
        this.isLoaded = true;
      }
    };

    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // 1. Photorealistic Scanned Granite Boulder (boulder_01)
    gltfLoader.load(
      '/juzu/models/scans/boulder_01.glb',
      (gltf) => {
        let scannedGeom: THREE.BufferGeometry | null = null;
        let scannedMat: THREE.Material | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !scannedGeom) {
            const mesh = child as THREE.Mesh;
            scannedGeom = mesh.geometry.clone();
            scannedMat = mesh.material as THREE.Material;
            if (scannedMat instanceof THREE.MeshStandardMaterial) {
              scannedMat.roughness = 0.88;
              scannedMat.metalness = 0.02;
              if (scannedMat.map) {
                scannedMat.map.colorSpace = THREE.SRGBColorSpace;
                scannedMat.map.anisotropy = 8;
              }
              if (scannedMat.normalMap) {
                scannedMat.normalMap.anisotropy = 8;
                scannedMat.normalScale = new THREE.Vector2(1.25, 1.25);
              }
            }
          }
        });

        if (scannedGeom && scannedMat) {
          this.rockInstances.geometry.dispose();
          this.rockInstances.geometry = scannedGeom;
          this.rockInstances.material = scannedMat;
          this.rockInstances.instanceMatrix.needsUpdate = true;
        }
        onAssetLoaded();
      },
      undefined,
      (err) => {
        console.warn('[Foliage] Could not load scanned boulder, using fallback:', err);
        onAssetLoaded();
      }
    );

    // 2. Photorealistic Scanned Cloud-Forest Broad-Leaf Foliage (calathea_orbifolia_01)
    gltfLoader.load(
      '/juzu/models/scans/calathea_orbifolia_01.glb',
      (gltf) => {
        let scannedGeom: THREE.BufferGeometry | null = null;
        let scannedMat: THREE.Material | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !scannedGeom) {
            const mesh = child as THREE.Mesh;
            scannedGeom = mesh.geometry.clone();
            scannedMat = mesh.material as THREE.Material;
            if (scannedMat instanceof THREE.MeshStandardMaterial) {
              scannedMat.roughness = 0.68;
              scannedMat.metalness = 0.02;
              scannedMat.alphaTest = 0.35;
              scannedMat.side = THREE.DoubleSide;
              if (scannedMat.map) {
                scannedMat.map.colorSpace = THREE.SRGBColorSpace;
                scannedMat.map.anisotropy = 8;
              }
              if (scannedMat.normalMap) {
                scannedMat.normalMap.anisotropy = 8;
                scannedMat.normalScale = new THREE.Vector2(1.15, 1.15);
              }
            }
          }
        });

        if (scannedGeom && scannedMat) {
          this.grassInstances.geometry.dispose();
          this.grassInstances.geometry = scannedGeom;
          this.grassInstances.material = scannedMat;
          this.grassInstances.instanceMatrix.needsUpdate = true;
        }
        onAssetLoaded();
      },
      undefined,
      (err) => {
        console.warn('[Foliage] Could not load scanned calathea foliage, using fallback:', err);
        onAssetLoaded();
      }
    );

    this.group.add(this.trunkInstances);
    this.group.add(this.canopyInstances);
    this.group.add(this.grassInstances);
    this.group.add(this.rockInstances);
  }

  private buildGnarledTrunkGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    // Main twisted trunk with flared buttress root base
    const main = new THREE.CylinderGeometry(0.22, 0.56, 4.8, 8, 7);
    main.translate(0, 2.4, 0);
    const pos = main.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = y / 4.8;
      // Flared root buttresses near base (t < 0.22)
      const rootFlare = t < 0.22 ? 1.0 + Math.pow(1.0 - t / 0.22, 2) * 0.45 * Math.abs(Math.sin(Math.atan2(z, x) * 3)) : 1.0;
      const bendX = Math.sin(t * Math.PI * 1.35) * 0.38;
      const bendZ = Math.cos(t * Math.PI * 1.15) * 0.26 - 0.26;
      pos.setX(i, x * rootFlare + bendX);
      pos.setZ(i, z * rootFlare + bendZ);
    }
    main.computeVertexNormals();
    parts.push(main);

    // 5 spreading primary and secondary boughs
    const branches = [
      { rx: 0.52, rz: 0.46, ry: 0.2, y: 3.3, len: 2.6, rTop: 0.09, rBot: 0.21 },
      { rx: -0.48, rz: 0.40, ry: 1.9, y: 3.6, len: 2.4, rTop: 0.08, rBot: 0.19 },
      { rx: 0.42, rz: -0.54, ry: 3.5, y: 3.8, len: 2.3, rTop: 0.08, rBot: 0.18 },
      { rx: -0.38, rz: -0.44, ry: 4.9, y: 4.1, len: 2.1, rTop: 0.07, rBot: 0.16 },
      { rx: 0.22, rz: 0.28, ry: 1.1, y: 4.3, len: 1.9, rTop: 0.07, rBot: 0.15 },
    ];
    for (const b of branches) {
      const limb = new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 6, 3);
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
    // 6 overlapping multi-tier bough crowns for a lush, full cloud-forest silhouette
    const crowns = [
      { x: 0.0, y: 6.1, z: 0.0, r: 3.1 },
      { x: 1.55, y: 5.1, z: 1.05, r: 2.7 },
      { x: -1.45, y: 5.3, z: 0.95, r: 2.6 },
      { x: 0.35, y: 5.5, z: -1.55, r: 2.6 },
      { x: -1.25, y: 5.6, z: -1.15, r: 2.4 },
      { x: 1.15, y: 4.5, z: -0.65, r: 2.3 },
    ];

    let seed = 0;
    for (const c of crowns) {
      // 1. Inner 3D Leaf-Cluster Volume Dome (indexed SphereGeometry matching PlaneGeometry) so the tree crown is never see-through edge-on
      const dome = new THREE.SphereGeometry(c.r * 0.58, 9, 7);
      const dPos = dome.attributes.position;
      const dUv = dome.attributes.uv;
      const dColors = new Float32Array(dPos.count * 3);
      for (let i = 0; i < dPos.count; i++) {
        let dx = dPos.getX(i);
        let dy = dPos.getY(i);
        let dz = dPos.getZ(i);
        const n = 0.84 + 0.32 * vnoise(dx * 1.8 + c.x, dz * 1.8 + c.z);
        dx *= n * 1.18;
        dy *= n * 0.68;
        dz *= n * 1.18;
        dPos.setXYZ(i, dx, dy, dz);
        dUv.setXY(i, (dx / c.r) + 0.5, (dz / c.r) + 0.5);

        // Warm sunlit olive-emerald crown top vs deep mossy forest-shadow underside
        const sunT = THREE.MathUtils.clamp((dy / (c.r * 0.5)) * 0.5 + 0.55, 0.0, 1.0);
        dColors[i * 3] = THREE.MathUtils.lerp(0.42, 0.92, sunT);
        dColors[i * 3 + 1] = THREE.MathUtils.lerp(0.48, 0.98, sunT);
        dColors[i * 3 + 2] = THREE.MathUtils.lerp(0.38, 0.82, sunT);
      }
      dome.setAttribute('color', new THREE.BufferAttribute(dColors, 3));
      dome.translate(c.x, c.y, c.z);
      dome.computeVertexNormals();
      cards.push(dome);

      // 2. Outer Feathered Botanical Leaf Cards around the dome for crisp alpha-tested leaf silhouettes
      for (let k = 0; k < 5; k++) {
        seed++;
        const card = new THREE.PlaneGeometry(c.r * 1.25, c.r * 1.25, 2, 2);
        const p = card.attributes.position;
        const colors = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
          const lx = p.getX(i);
          const ly = p.getY(i);
          const d2 = (lx * lx + ly * ly) / (c.r * c.r * 0.65);
          p.setZ(i, -d2 * 0.42);

          const sunT = THREE.MathUtils.clamp(0.45 + (ly / c.r) * 0.55, 0.15, 1.0);
          colors[i * 3] = THREE.MathUtils.lerp(0.48, 0.98, sunT);
          colors[i * 3 + 1] = THREE.MathUtils.lerp(0.55, 1.05, sunT);
          colors[i * 3 + 2] = THREE.MathUtils.lerp(0.44, 0.88, sunT);
        }
        card.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        card.rotateX(0.32 + (k % 2) * 0.58);
        card.rotateY((k * Math.PI * 2) / 5 + seed * 0.5);
        card.rotateZ(((seed % 3) - 1) * 0.22);
        card.translate(
          c.x + Math.cos(seed * 1.7) * (c.r * 0.22),
          c.y + (k - 2.0) * 0.24,
          c.z + Math.sin(seed * 1.7) * (c.r * 0.22)
        );
        card.computeVertexNormals();
        cards.push(card);
      }
    }

    return mergeGeometries(cards);
  }

  private buildFernRosetteGeometry(): THREE.BufferGeometry {
    const fronds: THREE.BufferGeometry[] = [];
    const frondCount = 6;
    for (let i = 0; i < frondCount; i++) {
      const plane = new THREE.PlaneGeometry(1.55, 1.35, 2, 3);
      plane.translate(0, 0.62, 0);
      const p = plane.attributes.position;
      const colors = new Float32Array(p.count * 3);
      for (let v = 0; v < p.count; v++) {
        const vy = p.getY(v);
        const t = THREE.MathUtils.clamp(vy / 1.35, 0, 1);
        // Arch gracefully outward like real Cyathea tree-fern fronds
        p.setZ(v, t * t * 0.48);
        p.setY(v, vy * (1.0 - t * 0.16));

        const shade = 0.58 + t * 0.48;
        colors[v * 3] = shade * 0.92;
        colors[v * 3 + 1] = shade * 1.04;
        colors[v * 3 + 2] = shade * 0.84;
      }
      plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      plane.rotateX(0.26 + (i % 2) * 0.18);
      plane.rotateY((i * Math.PI * 2) / frondCount + (i % 2) * 0.2);
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
      colors[i * 3] = THREE.MathUtils.lerp(0.54, 0.68, moss);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.54, 0.82, moss);
      colors[i * 3 + 2] = THREE.MathUtils.lerp(0.50, 0.56, moss);
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  private isInClearZone(x: number, z: number): boolean {
    // Narrow central walkway spine on Bridge & Gateways (x in -4.2..4.2, z in -48..14)
    if (Math.abs(x) < 4.2 && z > -48 && z < 14) return true;
    // Immediate South Spawn & Campfire circle
    if (Math.hypot(x - 1.2, z - 10.5) < 5.8) return true;
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

      const tone = 0.82 + ((i * 19) % 30) * 0.012;
      color.setRGB(tone * 0.94, tone * 1.04, tone * 0.86);
      this.canopyInstances.setColorAt(treeIdx, color);

      treeIdx++;
    }
    this.trunkInstances.count = treeIdx;
    this.trunkInstances.instanceMatrix.needsUpdate = true;
    this.canopyInstances.count = treeIdx;
    this.canopyInstances.instanceMatrix.needsUpdate = true;
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

      // Keep the immediate 2.2m center of footpaths clear while lining the trail edges & ruins with ferns!
      if (Math.abs(x) < 2.2 && z > -45 && z < 14) continue;
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
