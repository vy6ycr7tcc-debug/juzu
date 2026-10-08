import * as THREE from 'three';

export function getGlobalTerrainHeight(x: number, z: number): number {
  const size = 1000;

  // Base valley shape
  let valleyShape = Math.pow(Math.abs(x / (size / 2)), 2) * 100;

  // Base natural Andean undulating terrain
  let noise = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5 +
              Math.sin(x * 0.01 + z * 0.02) * 15;

  const riverBed = -Math.exp(-Math.pow(x / 30, 2)) * 10;

  // Andean Craggy Multi-Fractal Modulation:
  // Adds razor-sharp mountain crests, cliff terraces, and rocky escarpments
  // away from the immediate river channel bed (|x| > 28m).
  const distFromRiver = Math.max(0, (Math.abs(x) - 28) / 36);
  const mountainWeight = Math.min(1.0, distFromRiver);

  if (mountainWeight > 0) {
    // Multi-octave ridged fractal noise for Andean crags
    const ridge1 = (1.0 - Math.abs(Math.sin(x * 0.018 + z * 0.014))) * 18.0;
    const ridge2 = (1.0 - Math.abs(Math.cos(x * 0.035 - z * 0.028))) * 8.5;
    const terrace = Math.sin((valleyShape + noise) * 0.35) * 2.2; // Natural geological rock terraces
    const detail = (Math.sin(x * 0.08 + z * 0.06) * Math.cos(z * 0.09)) * 3.5;
    noise += (ridge1 + ridge2 + terrace + detail) * mountainWeight;
  }

  // High-sierra modifier: as z increases past 500, terrain rises and becomes craggier
  if (z > 500) {
    const factor = Math.min(1.0, (z - 500) / 500); // 0 at 500, 1 at 1000+
    const highSierraRise = factor * 110;
    const highSierraNoise = ((1.0 - Math.abs(Math.sin(x * 0.08))) * Math.cos(z * 0.07) * 14 +
                             Math.sin(x * 0.04 + z * 0.04) * 22) * factor;
    valleyShape += highSierraRise;
    noise += highSierraNoise;
  }

  return valleyShape + noise + riverBed;
}

import { physics } from './physics.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNormalTexture, createTerrainDetailTexture, createTerrainRoughnessTexture, ASSET_PATHS, getImageTexture } from './textures.js';
import type { RenderCaps } from './renderer.js';

// Deterministic per-world-position hash (p3-2). Replaces the previous
// Math.random() vertex jitter, which re-rolled every chunk color on each
// LOD swap — terrain visibly shimmered when the LOD ring moved.
function hash2(x: number, z: number, salt = 0): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothstepf(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class TerrainManager {
  scene: THREE.Scene;
  chunkSize: number = 200;
  chunks: Map<string, THREE.Mesh> = new Map();
  chunkColliders: Map<string, { body: RAPIER.RigidBody, collider: RAPIER.Collider }> = new Map();
  material: THREE.Material;
  isWebGPU: boolean = false;
  maxAnisotropy: number = 4;
  lowTier: boolean = false;

  constructor(scene: THREE.Scene, caps?: RenderCaps) {
    this.scene = scene;
    this.isWebGPU = caps?.isWebGPU ?? false;
    this.maxAnisotropy = caps?.maxAnisotropy ?? 4;
    this.lowTier = caps?.tier === 'LOW';

    // 1. High-resolution photographic soil, pebbles, humus, and forest floor albedo
    const groundAlbedo = getImageTexture(ASSET_PATHS.environment.forestFloor, {
      isSRGB: true,
      repeatX: 24,
      repeatY: 24,
      anisotropy: this.maxAnisotropy,
    });

    // 2. High-resolution photographic granite and weathered rock normal & roughness maps
    const normalMap = createNormalTexture(512, 10, 4.2);
    normalMap.repeat.set(24, 24);
    normalMap.anisotropy = this.maxAnisotropy;

    // 3. Macro roughness texture
    const roughnessMap = createTerrainRoughnessTexture(512);
    roughnessMap.repeat.set(8, 8);
    roughnessMap.anisotropy = this.maxAnisotropy;

    // 4. Broad ambient occlusion blotches
    const aoMap = createTerrainRoughnessTexture(512);
    aoMap.repeat.set(3, 3);
    aoMap.channel = 0;
    aoMap.anisotropy = this.maxAnisotropy;

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: groundAlbedo,
      roughness: 0.90,
      roughnessMap: roughnessMap,
      metalness: 0.0, // Andean earth, soil, and rock are 100% dielectric
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65), // Crisp natural rock/soil relief
      aoMap: aoMap,
      aoMapIntensity: 0.85,
      envMapIntensity: 0.25 // Natural ground ambient
    });
  }

  getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  update(cameraPosition: THREE.Vector3) {
    const viewDistance = this.lowTier ? 4 : 6; // chunk radius (up to 1200m on high/med)
    const cx = Math.floor(cameraPosition.x / this.chunkSize);
    const cz = Math.floor(cameraPosition.z / this.chunkSize);

    const activeKeys = new Set<string>();

    for (let x = -viewDistance; x <= viewDistance; x++) {
      for (let z = -viewDistance; z <= viewDistance; z++) {
        const chunkX = cx + x;
        const chunkZ = cz + z;

        // Simple culling for far corners
        if (Math.sqrt(x*x + z*z) > viewDistance) continue;

        const key = this.getChunkKey(chunkX, chunkZ);
        activeKeys.add(key);

        const dist = Math.max(Math.abs(x), Math.abs(z));
        let segments = 64; // LOD 0 (near, dist <= 2)
        if (dist > 2) segments = this.lowTier ? 4 : 16; // LOD 1 (mid, dist 3)
        if (dist > 3) segments = 8; // LOD 2 (mid-far, dist 4)
        if (dist > 4) segments = 4; // LOD 3 (horizon backdrop, dist 5-6)

        const withCollider = dist <= 2; // Physics only within 400m of camera

        if (!this.chunks.has(key)) {
          this.loadChunk(chunkX, chunkZ, segments, withCollider);
        } else {
          const existingChunk = this.chunks.get(key);
          const currentSegments = (existingChunk?.geometry as THREE.PlaneGeometry).parameters?.widthSegments;
          if (existingChunk && currentSegments !== segments) {
             this.unloadChunk(key);
             this.loadChunk(chunkX, chunkZ, segments, withCollider);
          }
        }
      }
    }

    // Unload chunks out of range
    for (const key of this.chunks.keys()) {
      if (!activeKeys.has(key)) {
        this.unloadChunk(key);
      }
    }
  }

  loadChunk(cx: number, cz: number, segments: number, withCollider: boolean = true) {
    const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    // Calculate positions
    const position = geometry.attributes.position;
    const worldOffsetX = cx * this.chunkSize;
    const worldOffsetZ = cz * this.chunkSize;

    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i);
      const pz = position.getZ(i);

      const worldX = position.getX(i) + worldOffsetX;
      const worldZ = pz + worldOffsetZ;

      position.setY(i, getGlobalTerrainHeight(worldX, worldZ));
    }

    geometry.computeVertexNormals();

    // Calibrated Andean PBR biome albedos (Visual Bible §2.2-§2.5):
    // Real dielectric soil, vegetation, and rock reflectance without zero-diffuse specular artifacts.
    const CF = {
      rock: new THREE.Color(0xA0988A),   // wet stone — mountain granite
      soilA: new THREE.Color(0x9E8662),  // humus/earth — rich moist loam
      soilB: new THREE.Color(0x6E9450)   // lush moss/canopy green
    };
    const HS = {
      rock: new THREE.Color(0xB2ACA2),   // high granite
      lichen: new THREE.Color(0xB4C882), // lichen patches (§2.3 dressing vocab)
      soilA: new THREE.Color(0xD4C078),  // ichu grass lit
      soilB: new THREE.Color(0x9E9254),  // ichu shadowed
      snow: new THREE.Color(0xF0F4F8),   // snowfields (high mountain peaks only)
      snowShadow: new THREE.Color(0xB0C4D8) // soft shadowed snow
    };
    const JL = {
      rock: new THREE.Color(0x8A8478),   // swallowed limestone
      moss: new THREE.Color(0x628C42),   // heavy moss reclamation
      soil: new THREE.Color(0x886842)    // rich mud/loam
    };
    const PA = {
      rockA: new THREE.Color(0xC0B49E),  // plaza stone
      rockB: new THREE.Color(0x8E8472),  // ashlar shadow
      soil: new THREE.Color(0x6E9852)    // encroaching green
    };
    const WET = new THREE.Color(0x363028); // riverbank darkening target
    const color = new THREE.Color();
    const tmpA = new THREE.Color();
    const tmpB = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3();
    const colors: number[] = [];

    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i);
      const pz = position.getZ(i);
      const y = position.getY(i);

      const worldX = px + worldOffsetX;
      const worldZ = pz + worldOffsetZ;

      normal.fromBufferAttribute(geometry.attributes.normal as THREE.BufferAttribute, i);
      const slope = 1.0 - normal.dot(up);
      const r1 = hash2(worldX, worldZ);
      const r2 = hash2(worldX, worldZ, 1);

      // Biome weights — smooth 60 m transition bands at the §0 region
      // boundaries (z 300 cloud→sierra, z −400 cloud→jungle, x 600 →paititi;
      // paititi keeps precedence over sierra in the NE corner).
      const wPa = smoothstepf(570, 630, worldX);
      const wHs = smoothstepf(280, 340, worldZ) * (1 - wPa);
      const wJl = (1 - smoothstepf(-430, -370, worldZ)) * (1 - wPa) * (1 - wHs);
      const wCf = Math.max(0, 1 - wPa - wHs - wJl);

      // Soft soil→rock split (the old binary slope > 0.4 switch).
      const rockW = smoothstepf(0.26, 0.46, slope);
      // Geological horizontal sedimentary strata banding on steep rock faces
      const strata = Math.sin(y * 0.85 + Math.sin(worldX * 0.04 + worldZ * 0.04) * 2.2) * 0.5 + 0.5;

      // Per-biome soil/rock colors, then blend the four biomes.
      tmpA.copy(CF.soilA).lerp(CF.soilB, r1 * 0.5);
      tmpB.copy(CF.rock);
      if (rockW > 0.05) tmpB.multiplyScalar(0.88 + strata * 0.24);
      color.copy(tmpA).lerp(tmpB, rockW);

      if (wHs > 0) {
        tmpA.copy(HS.soilA).lerp(HS.soilB, r1 * 0.5);
        tmpB.copy(HS.rock);
        if (rockW > 0.05) tmpB.multiplyScalar(0.88 + strata * 0.24);
        if (r2 > 0.86) tmpB.lerp(HS.lichen, Math.min(1, (r2 - 0.86) / 0.14) * 0.7);
        tmpA.lerp(tmpB, rockW);
        color.lerp(tmpA, wHs);
      }
      if (wJl > 0) {
        tmpA.copy(JL.soil);
        tmpB.copy(JL.rock).lerp(JL.moss, r1 * 0.55); // heavy moss on ruins-adjacent rock
        if (rockW > 0.05) tmpB.multiplyScalar(0.88 + strata * 0.24);
        tmpA.lerp(tmpB, rockW);
        color.lerp(tmpA, wJl);
      }
      if (wPa > 0) {
        tmpA.copy(PA.soil).lerp(PA.rockA, r1 * 0.3);
        tmpB.copy(PA.rockA).lerp(PA.rockB, r1 * 0.5);
        if (rockW > 0.05) tmpB.multiplyScalar(0.88 + strata * 0.24);
        tmpA.lerp(tmpB, rockW);
        color.lerp(tmpA, wPa);
      }

      // Sierra snow line: elevation-driven with patchy hash edges, grass
      // and rock faces too steep hold-out (§2.3 snowfields). Strictly high alpine peaks.
      if (wHs > 0.25) {
        const snowW = smoothstepf(165, 205, y + r2 * 14) * (1 - smoothstepf(0.35, 0.55, slope));
        if (snowW > 0) {
          tmpA.copy(HS.snow).lerp(HS.snowShadow, r1 * 0.6);
          color.lerp(tmpA, snowW);
        }
      }

      // Riverbank wetness: darken + deepen toward the riverBed falloff
      // (river runs |x| < ~30 m; height fn dips −10·exp(−(x/30)²)). The
      // companion brief's wet-specular item is carried by the noise
      // roughnessMap; this is its albedo counterpart.
      const wet = Math.exp(-(worldX * worldX) / (34 * 34));
      if (wet > 0.02) color.lerp(WET, wet * 0.55);

      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // LOD T-junction skirts (p3/p4/p5/p8-flagged chunk-edge crack + sun-bleed
    // fix). Adjacent chunks load at different segment densities (64/16/4);
    // their shared edges sample the height function at different points, so
    // T-junction cracks open and the sky/bleed shows through. Each edge gets
    // a vertical strip of duplicated vertices lowered by SKIRT_DEPTH, carrying
    // the edge color/normal/uv so the band reads as terrain inside the gaps.
    // The trimesh collider picks the skirt up too (vertical walls at chunk
    // edges — harmless, closes the same holes for physics).
    const SKIRT_DEPTH = 60;
    {
      const gridN = segments + 1;
      const baseVerts = position.count;
      const grid = geometry.attributes.position as THREE.BufferAttribute;
      const nor0 = geometry.attributes.normal as THREE.BufferAttribute;
      const col0 = geometry.attributes.color as THREE.BufferAttribute;
      const uv0 = geometry.attributes.uv as THREE.BufferAttribute;

      // Edge vertex lists: north (r=0), south (r=gridN-1), west (c=0), east (c=gridN-1)
      const edgeIdx: number[] = [];
      for (let c = 0; c < gridN; c++) edgeIdx.push(c);
      for (let c = 0; c < gridN; c++) edgeIdx.push((gridN - 1) * gridN + c);
      for (let r = 0; r < gridN; r++) edgeIdx.push(r * gridN);
      for (let r = 0; r < gridN; r++) edgeIdx.push(r * gridN + gridN - 1);

      const skirtVerts = edgeIdx.length;
      const newPos = new Float32Array((baseVerts + skirtVerts) * 3);
      const newNor = new Float32Array((baseVerts + skirtVerts) * 3);
      const newCol = new Float32Array((baseVerts + skirtVerts) * 3);
      const newUv = new Float32Array((baseVerts + skirtVerts) * 2);
      newPos.set(grid.array as Float32Array);
      newNor.set(nor0.array as Float32Array);
      newCol.set(col0.array as Float32Array);
      newUv.set(uv0.array as Float32Array);
      for (let k = 0; k < skirtVerts; k++) {
        const src = edgeIdx[k];
        const dst = baseVerts + k;
        newPos[dst * 3 + 0] = grid.getX(src);
        newPos[dst * 3 + 1] = grid.getY(src) - SKIRT_DEPTH;
        newPos[dst * 3 + 2] = grid.getZ(src);
        newNor[dst * 3 + 0] = nor0.getX(src);
        newNor[dst * 3 + 1] = nor0.getY(src);
        newNor[dst * 3 + 2] = nor0.getZ(src);
        newCol[dst * 3 + 0] = col0.getX(src);
        newCol[dst * 3 + 1] = col0.getY(src);
        newCol[dst * 3 + 2] = col0.getZ(src);
        newUv[dst * 2 + 0] = uv0.getX(src);
        newUv[dst * 2 + 1] = uv0.getY(src);
      }

      const oldIndex = geometry.index!;
      const quads = 4 * (gridN - 1);
      const newIndex = new Uint32Array(oldIndex.count + quads * 6);
      newIndex.set(oldIndex.array as Uint32Array);
      let w = oldIndex.count;
      for (let e = 0; e < 4; e++) {
        for (let c = 0; c < gridN - 1; c++) {
          const t0 = edgeIdx[e * gridN + c];          // top edge vertex A
          const t1 = edgeIdx[e * gridN + c + 1];      // top edge vertex B
          const b0 = baseVerts + e * gridN + c;       // lowered A
          const b1 = baseVerts + e * gridN + c + 1;   // lowered B
          // Orientation: the outward horizontal direction for this edge,
          // computed from the quad midpoint to the chunk center (0,0).
          const mx = (grid.getX(t0) + grid.getX(t1)) / 2;
          const mz = (grid.getZ(t0) + grid.getZ(t1)) / 2;
          let len = Math.hypot(mx, mz) || 1;
          const ox = mx / len, oz = mz / len;
          // Triangle (t0, t1, b0): face normal via cross((t1-t0),(b0-t0)).
          const ax = grid.getX(t1) - grid.getX(t0);
          const ay = grid.getY(t1) - grid.getY(t0);
          const az = grid.getZ(t1) - grid.getZ(t0);
          const bx = grid.getX(b0) - grid.getX(t0);
          const by = grid.getY(b0) - grid.getY(t0);
          const bz = grid.getZ(b0) - grid.getZ(t0);
          const nx = ay * bz - az * by;
          const ny = az * bx - ax * bz;
          const nz = ax * by - ay * bx;
          const outward = nx * ox + ny * 0 + nz * oz;
          if (outward >= 0) {
            newIndex.set([t0, t1, b0, t1, b1, b0], w);
          } else {
            newIndex.set([t0, b0, t1, t1, b0, b1], w);
          }
          w += 6;
        }
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(newNor, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(newCol, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
      geometry.setIndex(new THREE.BufferAttribute(newIndex, 1));
      geometry.computeBoundingSphere();
    }

    const chunk = new THREE.Mesh(geometry, this.material);
    chunk.position.set(worldOffsetX, 0, worldOffsetZ);
    chunk.receiveShadow = true;
    chunk.castShadow = true;

    this.scene.add(chunk);
    const key = this.getChunkKey(cx, cz);
    this.chunks.set(key, chunk);

    if (withCollider) {
      const colliderData = physics.createTerrainCollider(chunk);
      if (colliderData) {
        this.chunkColliders.set(key, colliderData);
      }
    }
  }

  unloadChunk(key: string) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      this.scene.remove(chunk);
      chunk.geometry.dispose();
      this.chunks.delete(key);

      const colliderData = this.chunkColliders.get(key);
      if (colliderData) {
        physics.removeTerrainCollider(colliderData);
        this.chunkColliders.delete(key);
      }
    }
  }
}

export function createTerrain(scene: THREE.Scene, caps?: RenderCaps) {
  const terrainManager = new TerrainManager(scene, caps);
  // Initial load around center
  terrainManager.update(new THREE.Vector3(0,0,0));
  return terrainManager;
}
