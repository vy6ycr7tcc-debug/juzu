import * as THREE from 'three/webgpu';

export interface RouteWaypoint {
  x: number;
  z: number;
  h: number;
  label?: string;
  isChasm?: boolean;
}

export interface RouteDefinition {
  id: string;
  name: string;
  quechua: string;
  waypoints: RouteWaypoint[];
  chasmIndex?: number; // Index of waypoint where a grapple chasm gap begins
}

export const REGIONAL_ROUTES: RouteDefinition[] = [
  // 1. Qhapaq Ñan High Sierra Pass (Cloud Forest -> High Sierra)
  {
    id: 'cf_to_hs',
    name: 'Royal High Sierra Terrace Pass',
    quechua: 'Hanan Saya Ñan · Upper Celestial Road',
    waypoints: [
      { x: 0, z: -44, h: 4.5, label: 'North Sanctuary Stele' },
      { x: 18, z: -58, h: 7.2 },
      { x: 34, z: -74, h: 10.8, label: 'Terrace Switchback' },
      { x: 48, z: -88, h: 14.5 },
      { x: 62, z: -102, h: 17.8, label: 'Huayna Gorge West Rim' },
      // Chasm between (62, -102) and (84, -122) spanned by grapple anchor at (73.5, 27, -114)
      { x: 84, z: -122, h: 19.5, label: 'Huayna Gorge East Landing' },
      { x: 96, z: -138, h: 23.2 },
      { x: 108, z: -152, h: 26.0, label: 'Intihuatana Ascent' },
      { x: 120, z: -165, h: 28.0, label: 'Intihuatana Sanctuary' },
    ],
    chasmIndex: 4,
  },

  // 2. Urubamba Canyon Gorge Trail (Cloud Forest -> Jungle Lowlands)
  {
    id: 'cf_to_jl',
    name: 'Urubamba Canyon River Trail',
    quechua: 'Urubamba Wayq’o · River Road to Antisuyu',
    waypoints: [
      { x: 0, z: -20, h: 4.2, label: 'Urubamba Gorge Falls' },
      { x: -32, z: -6, h: 3.8 },
      { x: -58, z: 12, h: 3.5, label: 'Bamboo River Flats' },
      { x: -80, z: 30, h: 3.4, label: 'Sunken Fissure East Rim' },
      // Chasm between (-80, 30) and (-104, 54) spanned by grapple anchor at (-92, 14.8, 43.5)
      { x: -104, z: 54, h: 3.0, label: 'Cenote Silt Terrace' },
      { x: -128, z: 76, h: 2.8 },
      { x: -154, z: 100, h: 2.5, label: 'Antisuyu Rainforest Gateway' },
      { x: -180, z: 126, h: 2.2, label: 'Expedition River Quay' },
    ],
    chasmIndex: 3,
  },

  // 3. High Cordillera Alpine Ridge (High Sierra -> Paititi)
  {
    id: 'hs_to_pt',
    name: 'High Cordillera Ridge Traverse',
    quechua: 'Willkanuta Apu · Sacred Crest to Paititi',
    waypoints: [
      { x: 120, z: -165, h: 28.0, label: 'Chakana Gate' },
      { x: 136, z: -120, h: 30.5 },
      { x: 152, z: -70, h: 29.2, label: 'Alpine Moraine Ridge' },
      { x: 164, z: -16, h: 27.6, label: 'Wind-Gap Abyss North Crag' },
      // Chasm between (164, -16) and (184, 10) spanned by grapple anchor at (174, 39.5, -2)
      { x: 184, z: 10, h: 27.0, label: 'Wind-Gap South Ledge' },
      { x: 190, z: 58, h: 26.2 },
      { x: 194, z: 108, h: 25.4, label: 'Paititi Sun Aqueduct Ridge' },
      { x: 200, z: 166, h: 24.0, label: 'Paititi Imperial Acropolis' },
    ],
    chasmIndex: 3,
  },

  // 4. Southern Rainforest Canyon Road (Paititi -> Jungle Lowlands)
  {
    id: 'pt_to_jl',
    name: 'Southern Jungle Cascades Route',
    quechua: 'Yunka Kancha · Southern Jungle Road',
    waypoints: [
      { x: 200, z: 166, h: 24.0, label: 'Paititi Water Gate' },
      { x: 148, z: 172, h: 18.5 },
      { x: 92, z: 174, h: 13.8, label: 'Cloud Forest Cascades' },
      { x: 32, z: 175, h: 8.5, label: 'Cascades Launch Rim' },
      // Chasm between (32, 175) and (8, 168) spanned by grapple anchor at (20, 24.5, 172)
      { x: 8, z: 168, h: 7.2, label: 'Cascades West Terrace' },
      { x: -50, z: 162, h: 5.0 },
      { x: -115, z: 156, h: 3.4, label: 'Rainforest Shallows' },
      { x: -180, z: 148, h: 2.2, label: 'Antisuyu Cenote Altar' },
    ],
    chasmIndex: 3,
  },
];

/**
 * Calculates nearest point and distance to any connecting route
 */
export function getRouteInfluence(
  x: number,
  z: number
): { dist: number; targetH: number; isChasm: boolean; trailFactor: number } {
  let minDist = Infinity;
  let bestH = 0;
  let isChasm = false;

  for (const r of REGIONAL_ROUTES) {
    const pts = r.waypoints;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const isChasmSpan = r.chasmIndex === i;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 0.001) continue;

      let t = ((x - a.x) * dx + (z - a.z) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = a.x + t * dx;
      const projZ = a.z + t * dz;
      const d = Math.hypot(x - projX, z - projZ);

      if (d < minDist) {
        minDist = d;
        if (isChasmSpan) {
          isChasm = true;
          // In the chasm center, drop height by 18 - 22m to form a sheer gorge
          const chasmDepth = Math.sin(t * Math.PI) * (r.id === 'cf_to_hs' ? 18.0 : 20.0);
          bestH = THREE.MathUtils.lerp(a.h, b.h, t) - chasmDepth;
        } else {
          isChasm = false;
          bestH = THREE.MathUtils.lerp(a.h, b.h, t);
        }
      }
    }
  }

  // Trail corridor: 7.2m flat road bed + 12m smooth mountain slope blending
  const flatRadius = 3.6;
  const shoulderRadius = 11.5;

  let factor = 0;
  if (minDist <= flatRadius) {
    factor = 1.0;
  } else if (minDist < shoulderRadius) {
    const u = (minDist - flatRadius) / (shoulderRadius - flatRadius);
    factor = 1.0 - u * u * (3.0 - 2.0 * u);
  }

  return { dist: minDist, targetH: bestH, isChasm, trailFactor: factor };
}
