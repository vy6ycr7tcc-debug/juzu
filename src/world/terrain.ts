import * as THREE from 'three/webgpu';
import { withFog } from '../gpu/tsl';

export const WATER_Y = 0;
export const WORLD_R = 3000;
export const SPAWN = new THREE.Vector3(0, 4.2, 10);

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number): number {
  return (
    vnoise(x * 0.012, z * 0.012) * 0.5 +
    vnoise(x * 0.028 + 17, z * 0.028 - 9) * 0.28 +
    vnoise(x * 0.065 - 5, z * 0.065 + 3) * 0.14 +
    vnoise(x * 0.14 + 11, z * 0.14 + 7) * 0.08
  );
}

/** Ridged multifractal noise for sharp Andean granite crags and arêtes */
export function ridgedFbm(x: number, z: number): number {
  const r1 = 1.0 - Math.abs(vnoise(x * 0.011, z * 0.011) * 2.0 - 1.0);
  const r2 = 1.0 - Math.abs(vnoise(x * 0.026 + 13.7, z * 0.026 - 7.3) * 2.0 - 1.0);
  const r3 = 1.0 - Math.abs(vnoise(x * 0.062 - 5.1, z * 0.062 + 19.4) * 2.0 - 1.0);
  const r4 = 1.0 - Math.abs(vnoise(x * 0.15 + 3.3, z * 0.15 - 11.2) * 2.0 - 1.0);
  const w1 = r1 * r1;
  const w2 = r2 * r2 * (0.35 + 0.65 * w1);
  return w1 * 0.50 + w2 * 0.28 + r3 * 0.14 + r4 * 0.08;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Dramatic Andean Huayna-Picchu monoliths & snow-capped cordillera massifs within visible horizon
const PEAKS = [
  // Cloud Forest Gorge Flanking Monoliths & North Cordillera
  { x: -68, z: -28, r: 46, h: 58, sharp: 1.4 },
  { x: 72, z: -24, r: 48, h: 64, sharp: 1.4 },
  { x: -85, z: -95, r: 68, h: 92, sharp: 1.3 },
  { x: 88, z: -105, r: 72, h: 98, sharp: 1.3 },
  { x: -5, z: -118, r: 62, h: 86, sharp: 1.35 },
  { x: -95, z: 45, r: 65, h: 68, sharp: 1.4 },
  { x: 98, z: 52, r: 65, h: 72, sharp: 1.4 },
  // High Sierra Cordillera (framing the Intihuatana Sanctuary at 120, -180)
  { x: 42, z: -248, r: 66, h: 112, sharp: 1.25 },
  { x: 198, z: -248, r: 68, h: 118, sharp: 1.25 },
  { x: 120, z: -278, r: 64, h: 108, sharp: 1.3 },
  // Jungle Lowlands Karst Cliffs (around -180, 148)
  { x: -255, z: 165, r: 62, h: 74, sharp: 1.35 },
  { x: -105, z: 168, r: 58, h: 68, sharp: 1.35 },
  { x: -180, z: 248, r: 66, h: 82, sharp: 1.3 },
  // Paititi Sacred Mountain Amphitheater (around 200, 180)
  { x: 128, z: 245, r: 64, h: 92, sharp: 1.3 },
  { x: 272, z: 245, r: 66, h: 96, sharp: 1.3 },
  { x: 200, z: 272, r: 70, h: 112, sharp: 1.25 },
  // Distant Horizon Massifs
  { x: 420, z: -380, r: 240, h: 210, sharp: 1.3 },
  { x: -420, z: -360, r: 240, h: 195, sharp: 1.3 },
  { x: 450, z: 380, r: 250, h: 205, sharp: 1.3 },
  { x: -440, z: 390, r: 250, h: 190, sharp: 1.3 },
];

export function rawHeight(x: number, z: number): number {
  // 1. Base high-altitude Andean landmass
  const n1 = fbm(x, z);
  const crag = ridgedFbm(x, z);
  let h = 6.5 + (n1 - 0.45) * 18.0 + Math.pow(crag, 1.5) * 16.0;

  // 2. Dramatic Huayna-Picchu Monoliths & Cordillera Peaks with Ridged Crags
  for (const p of PEAKS) {
    const d = Math.hypot(x - p.x, z - p.z) / p.r;
    if (d < 1) {
      const peakShape = Math.pow(1 - d * d, p.sharp);
      const ridgeDetail = 0.68 + 0.55 * ridgedFbm(x * 1.8 + p.x, z * 1.8 + p.z);
      h += peakShape * p.h * ridgeDetail;
    }
  }

  // 3. Natural Inca Geological Strata Steps on steep slopes (h > 6.5m)
  if (h > 6.5) {
    const strataMask = smooth(6.5, 18.0, h);
    const strataWave = Math.sin(h * 1.35 + vnoise(x * 0.08, z * 0.08) * 1.8);
    h += strataWave * 0.42 * strataMask;
  }

  // 4. Urubamba River Gorge (runs East-West centered around z = -17, spanned by the bridge at x = 0, z = 2..-36)
  const riverCurveZ = -17.0 + Math.sin(x * 0.018) * 6.5 * smooth(8, 35, Math.abs(x));
  const distToRiver = Math.abs(z - riverCurveZ);
  if (distToRiver < 22) {
    const gorgeT = smooth(19, 9, distToRiver);
    h = THREE.MathUtils.lerp(h, -4.8, gorgeT);
  }

  // 5. Cloud Forest South Camp Plateau (z = 2..24, x = -22..22) & North Sanctuary Plateau (z = -36..-56, x = -22..22)
  const southCampDist = Math.hypot((x - 0) * 0.85, z - 12);
  if (z > -1 && southCampDist < 26) {
    const flatT = smooth(24, 9, southCampDist);
    h = THREE.MathUtils.lerp(h, 4.2, flatT);
  }
  const northSanctuaryDist = Math.hypot((x - 0) * 0.85, z - (-46));
  if (z < -33 && northSanctuaryDist < 26) {
    const flatT = smooth(24, 9, northSanctuaryDist);
    h = THREE.MathUtils.lerp(h, 4.5, flatT);
  }

  // 6. High Sierra Intihuatana Sanctuary Plateau at (120, -180)
  const hsDist = Math.hypot(x - 120, z - (-178));
  if (hsDist < 95) {
    h = THREE.MathUtils.lerp(h, 28.0, smooth(82, 34, hsDist));
  }

  // 7. Antisuyu Jungle Lowlands Cenote & River Basin at (-180, 148)
  const jlDist = Math.hypot(x - (-180), z - 148);
  if (jlDist < 95) {
    h = THREE.MathUtils.lerp(h, 2.2, smooth(85, 32, jlDist));
    // River harbor in front of Expedition Quay (z = 98..120)
    const quayRiverDist = Math.hypot((x - (-180)) * 0.6, z - 108);
    if (quayRiverDist < 24) {
      h = THREE.MathUtils.lerp(h, -2.6, smooth(22, 8, quayRiverDist));
    }
  }

  // 8. Paititi Imperial Acropolis Plateau at (200, 185)
  const ptDist = Math.hypot(x - 200, z - 185);
  if (ptDist < 105) {
    h = THREE.MathUtils.lerp(h, 24.0, smooth(90, 38, ptDist));
  }

  return h;
}

export function heightAt(x: number, z: number): number {
  return rawHeight(x, z);
}

export function standAt(x: number, z: number): number {
  return rawHeight(x, z);
}

export class Terrain {
  public group = new THREE.Group();
  private chunks = new Map<string, THREE.Mesh>();
  private material: THREE.MeshStandardMaterial;
  private readonly CHUNK_SIZE = 64;
  private readonly CHUNK_RES = 48;
  private lastChunkX = NaN;
  private lastChunkZ = NaN;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Andean_Terrain';
    scene.add(this.group);

    // High-frequency PBR Terrain Material with 3D slope-compensated UVs
    const texLoader = new THREE.TextureLoader();
    const meadowTex = texLoader.load('/juzu/textures/meadow_diff.jpg');
    meadowTex.wrapS = meadowTex.wrapT = THREE.RepeatWrapping;

    const meadowNor = texLoader.load('/juzu/textures/meadow_nor.jpg');
    meadowNor.wrapS = meadowNor.wrapT = THREE.RepeatWrapping;

    const meadowArm = texLoader.load('/juzu/textures/meadow_arm.jpg');
    meadowArm.wrapS = meadowArm.wrapT = THREE.RepeatWrapping;

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      map: meadowTex,
      normalMap: meadowNor,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: meadowArm,
      aoMap: meadowArm,
      aoMapIntensity: 0.65,
      flatShading: false,
    });
  }

  public update(playerPos: THREE.Vector3): void {
    const cx = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const cz = Math.floor(playerPos.z / this.CHUNK_SIZE);

    if (cx === this.lastChunkX && cz === this.lastChunkZ) return;
    this.lastChunkX = cx;
    this.lastChunkZ = cz;

    const viewRadius = 5;
    const activeKeys = new Set<string>();

    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      for (let dz = -viewRadius; dz <= viewRadius; dz++) {
        const kx = cx + dx;
        const kz = cz + dz;
        const key = `${kx},${kz}`;
        activeKeys.add(key);

        if (!this.chunks.has(key)) {
          const chunkMesh = this.buildChunk(kx, kz);
          this.chunks.set(key, chunkMesh);
          this.group.add(chunkMesh);
        }
      }
    }

    // Unload distant chunks
    for (const [key, mesh] of this.chunks.entries()) {
      if (!activeKeys.has(key)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  private buildChunk(cx: number, cz: number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(
      this.CHUNK_SIZE,
      this.CHUNK_SIZE,
      this.CHUNK_RES,
      this.CHUNK_RES
    );
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const uvAttr = geom.attributes.uv;
    const originX = cx * this.CHUNK_SIZE;
    const originZ = cz * this.CHUNK_SIZE;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + originX;
      const vz = posAttr.getZ(i) + originZ;
      const vy = heightAt(vx, vz);
      posAttr.setY(i, vy);
    }

    geom.computeVertexNormals();

    // Natural Andean PBR Slope, Strata, Moss & Altitude Shading + 3D Triplanar-like UV compensation
    const normAttr = geom.attributes.normal;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + originX;
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i) + originZ;
      const nx = normAttr.getX(i);
      const ny = normAttr.getY(i);
      const nz = normAttr.getZ(i);

      // 3D arc-length UV projection so vertical cliff walls never stretch textures
      const tileFreq = 0.26;
      uvAttr.setXY(
        i,
        (vx + Math.sign(nx || 1) * vy * 0.75) * tileFreq,
        (vz + Math.sign(nz || 1) * vy * 0.75) * tileFreq
      );

      // Micro-noise & horizontal rock strata banding
      const detailNoise = vnoise(vx * 0.14, vz * 0.14);
      const strataBand = 0.82 + 0.18 * Math.sin(vy * 2.6 + detailNoise * 3.0);

      // Slope factor: 1 = flat Andean valley/terrace, 0 = sheer granite gorge wall
      const slope = THREE.MathUtils.clamp((ny - 0.58) / 0.28, 0, 1);

      // Moss crevices on mid-slope rock faces
      const mossCrevice = THREE.MathUtils.clamp((ny - 0.35) / 0.35, 0, 1) * (1 - slope) * detailNoise;

      // High altitude snow-capped cordillera factor (snow settles on upper alpine ledges & couloirs > 36m)
      const snow = THREE.MathUtils.clamp((vy - 36 + detailNoise * 6) / 22, 0, 1) * THREE.MathUtils.clamp((ny - 0.16) / 0.34, 0, 1);

      // Riverbank wet dark slate & cobbles near water line
      const riverbank = THREE.MathUtils.clamp((vy - 0.4) / 2.2, 0, 1);

      // Steep granite cliff color (stratified dark charcoal-warm andesite) vs lush cloud-forest moss/grass
      const rockR = 0.38 * strataBand;
      const rockG = 0.35 * strataBand + mossCrevice * 0.14;
      const rockB = 0.31 * strataBand;

      const grassR = 0.36 + detailNoise * 0.12;
      const grassG = 0.52 + detailNoise * 0.14;
      const grassB = 0.24 + detailNoise * 0.08;

      // Above 28m, transition vegetation into rugged high-alpine stone & scree before snowline
      const alpineRockMask = THREE.MathUtils.clamp((vy - 28) / 14, 0, 1);
      const effectiveSlope = slope * (1 - alpineRockMask * 0.78);

      let r = THREE.MathUtils.lerp(rockR, grassR, effectiveSlope);
      let g = THREE.MathUtils.lerp(rockG, grassG, effectiveSlope);
      let b = THREE.MathUtils.lerp(rockB, grassB, effectiveSlope);

      // Darken damp river canyon stone along the gorge waterline
      r = THREE.MathUtils.lerp(0.22, r, riverbank);
      g = THREE.MathUtils.lerp(0.24, g, riverbank);
      b = THREE.MathUtils.lerp(0.21, b, riverbank);

      // Glaciated alpine snow on high cordillera peaks
      r = THREE.MathUtils.lerp(r, 0.92, snow);
      g = THREE.MathUtils.lerp(g, 0.95, snow);
      b = THREE.MathUtils.lerp(b, 0.99, snow);

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    uvAttr.needsUpdate = true;
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('uv2', geom.attributes.uv);

    const mesh = new THREE.Mesh(geom, this.material);
    mesh.position.set(originX, 0, originZ);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }
}
