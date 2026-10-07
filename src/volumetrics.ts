import * as THREE from 'three';
import { TOD_GRADES } from './environment.js';
import { getGlobalTerrainHeight } from './terrain.js';
import type { RenderCaps } from './renderer.js';

// V-ATMOS — volumetric light shafts (visual bible §5.2 T9, §3.3.3, §6.3, J7).
//
// §5.2 T9: "additive gradient billboards, seeded placement, 5 clusters" —
// same THREE code path on both renderers (no TSL), 3 clusters on LOW tier
// (§6.3 volumetrics row).
//
// §3.3.3: "Volumetric shaft intensity peaks here [golden hour] ... 0.15".
// The old implementation had TWO contradictory intensity tables (constructor
// baked dawn 0.15 into the texture alpha while update() set dawn opacity
// 0.02 — multiplied together, the on-screen dawn shafts contributed ~0.003
// and the §3.3 peak never rendered). This rewrite bakes the gradient SHAPE
// at alpha 1 and drives ALL intensity through material.opacity from ONE
// table: day 0.05, noon 0.02, dawn/dusk 0.15 (peak), night 0.
//
// Region reads (§3.3 context): cloud forest / jungle interiors get the
// strongest shafts (canopy gaps, ×1.5 capped 0.25); high sierra gets thin
// high-altitude shafts (thickness scale 0.5, intensity ×0.6).
//
// J7: placement is seeded (Mulberry32) and re-anchors deterministically on a
// coarse grid around the CAMERA — the old clusters were scattered ±100 m
// around the world origin once at construction, which is why they were
// invisible in most §8 captures and read as "white hard-edged strangers" in
// the paititi dawn capture (p4 deferred defect).
//
// The old shaft card also had NO horizontal falloff (a pure vertical
// gradient on a plane) — that is the hard-edge defect itself. The card below
// multiplies a vertical falloff with a horizontal radial falloff in the
// canvas, so every shaft fades on all four sides.

const CLUSTER_SEED = 20477;
const OFFSET_SEED = 0x9e37; // second stream for per-cluster offsets
const GRID_M = 120;         // re-anchor grid size around the camera
const SHAFT_LENGTH = 100;   // m, matches the old card
const SHAFT_WIDTH = 20;     // m

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function createShaftTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Vertical falloff: transparent at top pivot and bottom tip, peaking in the upper third.
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255, 245, 230, 0)');
  v.addColorStop(0.12, 'rgba(255, 245, 230, 0.65)');
  v.addColorStop(0.30, 'rgba(255, 245, 230, 1.0)');
  v.addColorStop(0.65, 'rgba(255, 245, 230, 0.45)');
  v.addColorStop(0.90, 'rgba(255, 245, 230, 0.1)');
  v.addColorStop(1, 'rgba(255, 245, 230, 0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 256);

  // Horizontal falloff across width: smooth Gaussian-like curve so beam edges
  // fade continuously to zero without vertical streak lines or circular pinching.
  ctx.globalCompositeOperation = 'destination-in';
  const h = ctx.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, 'rgba(255, 255, 255, 0)');
  h.addColorStop(0.20, 'rgba(255, 255, 255, 0.5)');
  h.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
  h.addColorStop(0.80, 'rgba(255, 255, 255, 0.5)');
  h.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 128, 256);
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class VolumetricLightShafts {
  // Public for the shot harness's &nv=1 A/B suspension toggle only.
  group = new THREE.Group();
  private material: THREE.MeshBasicMaterial;
  private clusters: THREE.Group[] = [];
  private anchorX = Number.NaN;
  private anchorZ = Number.NaN;

  constructor(scene: THREE.Scene, _todParam: string | null, caps?: RenderCaps) {
    // §6.3: 5 clusters HIGH/MEDIUM, 3 on LOW.
    const clusterCount = caps?.tier === 'LOW' ? 3 : 5;

    this.material = new THREE.MeshBasicMaterial({
      map: createShaftTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false, // Prevent distant additive bloom over fogColor
      opacity: 0, // update() owns intensity from the §3.3 table
    });

    // Pivot at the TOP of each shaft. Translate ONCE — the old code called
    // geometry.translate() once per plane per cluster on the SHARED geometry
    // (15 cumulative translates: the pivot ended up 750 m above the cluster
    // origin and every cluster shared the same mangled card).
    const geometry = new THREE.PlaneGeometry(SHAFT_WIDTH, SHAFT_LENGTH);
    geometry.translate(0, -SHAFT_LENGTH / 2, 0);

    for (let i = 0; i < clusterCount; i++) {
      const cluster = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.rotation.y = (j / 3) * Math.PI;
        cluster.add(mesh);
      }
      this.group.add(cluster);
      this.clusters.push(cluster);
    }

    scene.add(this.group);
  }

  update(cameraPosition: THREE.Vector3, regionId?: string | null, todParam?: string | null) {
    const gradeKey = (todParam || 'day') as keyof typeof TOD_GRADES;
    const grade = TOD_GRADES[gradeKey] || TOD_GRADES['day'];

    // §3.3.3 intensity table — the single source of truth.
    let intensity: number;
    switch (gradeKey) {
      case 'dawn':
      case 'dusk':
        intensity = 0.15; // golden-hour peak (bible-verbatim)
        break;
      case 'noon':
        intensity = 0.02; // near-vertical sun, shafts nearly gone
        break;
      case 'night':
        intensity = 0.0;  // no moonbeams (§4.4 anti-glow)
        break;
      default:
        intensity = 0.05; // day
        break;
    }

    // Region reads. The old update() MULTIPLIED by (1 − canopyDensity) for
    // cf/jl — the "strongest shafts" regions got 0.2×, inverting the intent.
    let thickness = 1;
    if (regionId === 'cloud_forest' || regionId === 'jungle_lowlands') {
      intensity = Math.min(intensity * 1.5, 0.25);
    } else if (regionId === 'high_sierra') {
      intensity *= 0.6;
      thickness = 0.5; // thin high-altitude shafts
    }
    if (gradeKey === 'dawn' || gradeKey === 'dusk') {
      this.material.color.setHex(0xFFD4A4); // Warm golden-hour alpenglow
    } else {
      this.material.color.setHex(0xFFF2E6); // Clean daylight
    }
    this.material.opacity = intensity;
    for (const cluster of this.clusters) cluster.scale.set(thickness, 1, thickness);

    // Shafts run ALONG the sun rays: the card hangs down from the cluster
    // origin (geometry translated −Y), so rotating +Y into the sun direction
    // points the card tail away from the sun, toward the ground.
    // Card-tilt clamp: at the 6° golden-hour sun the true anti-sun beam is
    // near-HORIZONTAL, and a 100 m horizontal additive plane reads as a hard
    // pale slab over the ridgeline — the true root of p4's deferred
    // "hard-edged quads at paititi dawn" (geometry, not just edge falloff).
    // Clamp the card's elevation to ≥20°; azimuth still follows the sun
    // exactly, so golden-hour beams keep their strong directional tilt.
    const cardElevDeg = Math.max(grade.sunElevationDeg, 20);
    const phi = THREE.MathUtils.degToRad(90 - cardElevDeg);
    const theta = THREE.MathUtils.degToRad(grade.sunAzimuthDeg);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, sunDir);

    // Deterministic camera-grid re-anchor (J7): clusters keep seeded offsets
    // from the nearest GRID_M grid node of the camera. First call anchors;
    // afterwards only a grid-node change (camera crossed ~120 m) re-places
    // them, so play-mode shafts never jitter per frame.
    const gx = Math.round(cameraPosition.x / GRID_M) * GRID_M;
    const gz = Math.round(cameraPosition.z / GRID_M) * GRID_M;
    if (gx !== this.anchorX || gz !== this.anchorZ) {
      this.anchorX = gx;
      this.anchorZ = gz;
      const random = mulberry32(CLUSTER_SEED ^ OFFSET_SEED);
      for (const cluster of this.clusters) {
        const cx = gx + (random() - 0.5) * GRID_M;
        const cz = gz + (random() - 0.5) * GRID_M;
        // Hang the shafts from above local terrain so they never start
        // buried on the sierra plateau (old fixed y 50–70 was underground at
        // snowline elevations 78–100).
        const topY = getGlobalTerrainHeight(cx, cz) + 45 + random() * 15;
        cluster.position.set(cx, topY, cz);
      }
    }
    for (const cluster of this.clusters) cluster.quaternion.copy(quat);
  }
}
