import * as THREE from 'three/webgpu';
import { withFog } from '../gpu/tsl';

export const WATER_Y = 0;
export const WORLD_R = 3000;
export const SPAWN = new THREE.Vector3(0, 2.2, 8);

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
    vnoise(x * 0.004, z * 0.004) * 0.5 +
    vnoise(x * 0.012 + 17, z * 0.012 - 9) * 0.28 +
    vnoise(x * 0.035 - 5, z * 0.035 + 3) * 0.14 +
    vnoise(x * 0.08 + 11, z * 0.08 + 7) * 0.08
  );
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Distant Andean snow-capped massifs
const PEAKS = [
  { x: 1200, z: -1100, r: 550, h: 280 },
  { x: -850, z: 1250, r: 500, h: 240 },
  { x: 1850, z: 650, r: 600, h: 320 },
  { x: -1650, z: -1200, r: 650, h: 340 },
];

export function rawHeight(x: number, z: number): number {
  // Base Andean mountain valley undulation
  const n1 = fbm(x * 0.004, z * 0.004);
  const n2 = fbm(x * 0.015 + 23, z * 0.015 - 11);
  let h = (n1 - 0.45) * 36 + (n2 - 0.5) * 8;

  // River gorge through the center (running along z axis)
  const riverDist = Math.abs(x - Math.sin(z * 0.02) * 8);
  if (riverDist < 16) {
    const depth = smooth(16, 2, riverDist) * 3.8;
    h -= depth;
  }

  // Cloud Forest sanctuary platform near spawn (0, 8)
  const spawnDist = Math.hypot(x - SPAWN.x, z - SPAWN.z);
  h = THREE.MathUtils.lerp(h, 2.2, smooth(45, 6, spawnDist));

  // High Sierra ridge at (120, -180)
  const hsDist = Math.hypot(x - 120, z - (-180));
  h += smooth(180, 20, hsDist) * 42;

  // Jungle Lowlands basin at (-180, 140)
  const jlDist = Math.hypot(x - (-180), z - 140);
  h -= smooth(140, 20, jlDist) * 12;

  // Paititi plateau at (200, 180)
  const ptDist = Math.hypot(x - 200, z - 180);
  h += smooth(160, 20, ptDist) * 30;

  // Distant massifs
  for (const p of PEAKS) {
    const d = Math.hypot(x - p.x, z - p.z) / p.r;
    if (d < 1) {
      h += Math.pow(1 - d, 1.6) * p.h;
    }
  }

  // World edge mountains
  const rWorld = Math.hypot(x, z);
  h += smooth(WORLD_R - 500, WORLD_R + 300, rWorld) * 120;

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
  private readonly CHUNK_RES = 32;
  private lastChunkX = NaN;
  private lastChunkZ = NaN;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Andean_Terrain';
    scene.add(this.group);

    // PBR Terrain Material using loaded textures
    const texLoader = new THREE.TextureLoader();
    const meadowTex = texLoader.load('/juzu/textures/meadow_diff.jpg');
    meadowTex.wrapS = meadowTex.wrapT = THREE.RepeatWrapping;
    meadowTex.repeat.set(16, 16);

    const meadowNor = texLoader.load('/juzu/textures/meadow_nor.jpg');
    meadowNor.wrapS = meadowNor.wrapT = THREE.RepeatWrapping;
    meadowNor.repeat.set(16, 16);

    this.material = new THREE.MeshStandardMaterial({
      color: 0x5a6a42, // Rich Andean valley green-earth
      roughness: 0.88,
      metalness: 0.05,
      map: meadowTex,
      normalMap: meadowNor,
      normalScale: new THREE.Vector2(0.85, 0.85),
      flatShading: false,
    });
  }

  public update(playerPos: THREE.Vector3): void {
    const cx = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const cz = Math.floor(playerPos.z / this.CHUNK_SIZE);

    if (cx === this.lastChunkX && cz === this.lastChunkZ) return;
    this.lastChunkX = cx;
    this.lastChunkZ = cz;

    const viewRadius = 4;
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
    const originX = cx * this.CHUNK_SIZE;
    const originZ = cz * this.CHUNK_SIZE;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + originX;
      const vz = posAttr.getZ(i) + originZ;
      const vy = heightAt(vx, vz);
      posAttr.setY(i, vy);
    }

    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, this.material);
    mesh.position.set(originX, 0, originZ);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }
}
