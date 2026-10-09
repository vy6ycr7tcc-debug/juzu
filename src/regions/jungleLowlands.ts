import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  limestoneSwallowed,
  ashlarWeathered,
  ashlarLight,
  woodAged,
  woodWet,
  ironDark,
  bronze,
  gold,
  humusEarth,
  mossPatch,
  broadleafCard,
  lampEmissive,
  type RenderCaps
} from '../materials.js';
import { createTrapezoidalPortal, createAshlarWall } from '../architecture.js';
import { createWaterSurface } from '../river.js';
import type { RegionModule, RegionBuildAPI, POIDef, EncounterDef, QuestStageDef, RegionShotDef } from '../world/contracts.js';

// Deterministic seeded PRNG (Mulberry32) per §8.3 & J7
const JL_SEED = 0x2a01;
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Planar UV projection helper for merged cyclopean masonry
function generateBoxUVs(geo: THREE.BufferGeometry, uScale = 0.5, vScale = 0.5): void {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    if (nx > ny && nx > nz) {
      uvs[i * 2] = z * uScale;
      uvs[i * 2 + 1] = y * vScale;
    } else if (ny > nx && ny > nz) {
      uvs[i * 2] = x * uScale;
      uvs[i * 2 + 1] = z * vScale;
    } else {
      uvs[i * 2] = x * uScale;
      uvs[i * 2 + 1] = y * vScale;
    }
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

export const jungleLowlands: RegionModule = {
  id: 'jungle_lowlands',
  displayName: 'The Jungle Lowlands',
  bounds: { min: { x: -450, y: -80, z: -1400 }, max: { x: 450, y: 120, z: -701 } },
  pois: [
    {
      id: 'jl_serpents_path',
      name: "The Serpent's Path",
      position: { x: 100, y: 0, z: -800 },
      radius: 25,
      summary: 'A monumental stepped Inca water terrace and canal complex crowned by the Amaru serpent portal.'
    },
    {
      id: 'jl_trembling_tunnels',
      name: 'The Trembling Tunnels',
      position: { x: -150, y: 0, z: -1000 },
      radius: 20,
      summary: 'A subterranean corbelled ashlar gallery rent by seismic fractures, guided by Cocha water spirals.'
    },
    {
      id: 'jl_vanguard_choke',
      name: 'The Vanguard Choke Point',
      position: { x: 250, y: 0, z: -1150 },
      radius: 15,
      summary: 'A heavily fortified canyon gorge held by a timber-and-stone abatis barricade.'
    },
    {
      id: 'jl_submerged_passage',
      name: 'The Submerged Passage',
      position: { x: 0, y: 0, z: -1350 },
      radius: 8,
      summary: 'A monumental sunken water temple portal plunging into the dark flooded canyon floor.'
    }
  ],
  encounters: [
    {
      id: 'jl_serpent_waters',
      position: { x: 100, y: 0, z: -800 },
      radius: 30,
      kind: 'puzzle_guard',
      flagsOnStart: [],
      flagsOnResolve: ['q_act3_amaru_navigated'],
      notes: '3 bronze sluice wheels in wall niches. High, Low, High lowers the water level.'
    },
    {
      id: 'jl_trembling_crossing',
      position: { x: -150, y: 0, z: -1000 },
      radius: 30,
      kind: 'stealth',
      flagsOnStart: [],
      flagsOnResolve: ['q_act3_tunnels_survived'],
      notes: 'Navigate the corbelled gallery stepping strictly upon safe-ground Cocha spiral pavers.'
    },
    {
      id: 'jl_vanguard_holdout',
      position: { x: 250, y: 0, z: -1150 },
      radius: 25,
      kind: 'ambush',
      flagsOnStart: [],
      flagsOnResolve: ['q_act3_vanguard_secured'],
      notes: 'Waves of hostile lantern scouts advance upon the abatis palisade.'
    }
  ],
  questStages: [
    { flag: 'q_act3_amaru_navigated', trigger: 'Completing the serpent\'s path water puzzle' },
    { flag: 'q_act3_tunnels_survived', trigger: 'Crossing the trembling tunnels stepping only on safe-ground spirals' },
    { flag: 'q_act3_vanguard_secured', trigger: 'Reaching the choke-point barricade and triggering the holdout' }
  ],
  shots: [
    // Dramatically calibrated view framing the stepped terraces looking up at the Amaru Portal
    { id: 'jl_serpents_path', camera: { x: 103, y: 1.8, z: -794 }, lookAt: { x: 100, y: 1.4, z: -806 } },
    { id: 'jl_trembling_tunnels', camera: { x: -150, y: 0.8, z: -980 }, lookAt: { x: -150, y: 1.8, z: -1005 } },
    { id: 'jl_vanguard_choke', camera: { x: 247, y: 13.5, z: -1134 }, lookAt: { x: 250, y: 12.0, z: -1150 } },
    { id: 'jl_submerged_passage', camera: { x: 0, y: -20.8, z: -1343 }, lookAt: { x: 0, y: -21.8, z: -1362 } },
    { id: 'jl_overview', camera: { x: 90, y: 48, z: -830 }, lookAt: { x: 100, y: 0, z: -980 } }
  ],
  build(api: RegionBuildAPI): void {
    const rng = mulberry32(JL_SEED);
    const group = new THREE.Group();
    group.name = 'Region_JungleLowlands';
    api.scene.add(group);

    // Visual Bible §2.4 Canonical PBR Materials
    const swallowedStoneMat = limestoneSwallowed(); // Ruin stone reclaimed by jungle (#758062, roughness 0.9)
    const weatheredStoneMat = ashlarWeathered();     // Dressed Inca coursed masonry
    const fineAshlarMat = ashlarLight();
    const woodAgedMat = woodAged();
    const woodWetMat = woodWet();
    const metalDarkMat = ironDark();
    const bronzeMat = bronze();
    const goldSpiralMat = gold();
    const earthMat = humusEarth();
    const mossMat = mossPatch();                     // Heavy velvety moss caps
    const broadleafLitMat = broadleafCard(0x2F5230); // Understory green
    const broadleafDarkMat = broadleafCard(0x1E3A1E);// Canopy dark

    // Restrained bioluminescent fungus (#7FB069, intensity 0.35, zero bloom abuse, §4.4)
    const emissiveFungusMat = lampEmissive();
    emissiveFungusMat.color.setHex(0x7FB069);
    emissiveFungusMat.emissive.setHex(0x7FB069);
    emissiveFungusMat.emissiveIntensity = 0.35;

    // Torch / Brazier Ember Material
    const emberMat = lampEmissive();
    emberMat.color.setHex(0xFF7722);
    emberMat.emissive.setHex(0xFF5500);
    emberMat.emissiveIntensity = 0.85;

    const caps: RenderCaps = {
      isWebGPU: typeof window !== 'undefined' && window.__rendererType === 'webgpu',
      tier: 'MEDIUM',
      maxAnisotropy: 4
    };

    // =========================================================================
    // §2.4 Procedural Dressing Helpers (Seeded, J7)
    // =========================================================================

    // Multi-segment creeping banyan buttress root clutching masonry bases
    const createBanyanRoot = (parent: THREE.Object3D, x: number, y: number, z: number, ry: number, s: number) => {
      const rootGroup = new THREE.Group();
      rootGroup.position.set(x, y, z);
      rootGroup.rotation.y = ry;
      rootGroup.scale.setScalar(s);

      const segments = 4;
      let currX = 0, currY = 0, currZ = 0;
      let rRadius = 0.36;

      for (let i = 0; i < segments; i++) {
        const nextRadius = rRadius * 0.78;
        const len = 1.5 + rng() * 0.5;
        const segGeo = new THREE.CylinderGeometry(nextRadius, rRadius, len, 6);
        segGeo.translate(0, len / 2, 0);

        const segMesh = new THREE.Mesh(segGeo, woodWetMat);
        segMesh.position.set(currX, currY, currZ);
        segMesh.rotation.x = 0.38 + (rng() - 0.5) * 0.12;
        segMesh.rotation.z = (rng() - 0.5) * 0.22;
        segMesh.castShadow = true;
        segMesh.receiveShadow = true;
        rootGroup.add(segMesh);

        currZ += len * 0.75;
        currY -= len * 0.32;
        currX += (rng() - 0.5) * 0.3;
        rRadius = nextRadius;
      }
      parent.add(rootGroup);
    };

    // Hanging lianas / tropical vines with natural organic twist
    const lianaGeo = new THREE.CylinderGeometry(0.04, 0.025, 6, 5);
    lianaGeo.translate(0, -3, 0);
    const createLiana = (parent: THREE.Object3D, x: number, y: number, z: number, s: number) => {
      const strand = new THREE.Mesh(lianaGeo, woodAgedMat);
      strand.position.set(x, y, z);
      strand.scale.set(1, s, 1);
      strand.rotation.z = (rng() - 0.5) * 0.28;
      strand.rotation.x = (rng() - 0.5) * 0.28;
      strand.castShadow = true;
      parent.add(strand);
    };

    // Velvety moss cap along horizontal masonry edges
    const createMossCap = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, d: number) => {
      const mossGeo = new THREE.BoxGeometry(w, 0.14, d);
      const mossMesh = new THREE.Mesh(mossGeo, mossMat);
      mossMesh.position.set(x, y + 0.07, z);
      mossMesh.receiveShadow = true;
      parent.add(mossMesh);
    };

    // Broadleaf foliage cards sprouting from masonry joints
    const leafGeo = new THREE.PlaneGeometry(1.6, 1.2);
    const createFoliageCard = (parent: THREE.Object3D, x: number, y: number, z: number, s: number) => {
      const cardA = new THREE.Mesh(leafGeo, rng() > 0.5 ? broadleafLitMat : broadleafDarkMat);
      cardA.position.set(x, y, z);
      cardA.scale.setScalar(s);
      cardA.rotation.y = rng() * Math.PI;
      cardA.rotation.z = 0.2 + (rng() - 0.5) * 0.4;
      const cardB = cardA.clone();
      cardB.rotation.y += Math.PI / 2;
      parent.add(cardA, cardB);
    };

    // =========================================================================
    // 1. THE SERPENT'S PATH (Stepped Inca Water Terraces & Amaru Portal Crest)
    // =========================================================================
    const serpentsPathGroup = new THREE.Group();
    const spX = 100, spZ = -800;
    serpentsPathGroup.position.set(spX, 0, spZ);
    serpentsPathGroup.position.y = api.terrainHeight(spX, spZ); // Elevation ~ -2.56

    const terraceW = 22;

    // A. UPPER TERRACE (z = -6 relative to group, Elevation = 0.0)
    // Monumental Amaru Trapezoidal Portal crowning the crest
    const amaruPortal = createTrapezoidalPortal({
      widthBottom: 5.6,
      height: 7.2,
      depth: 2.6,
      taperRatio: 0.84,
      lintelOverhang: 0.8,
      material: weatheredStoneMat
    });
    amaruPortal.position.set(0, 0, -6);
    serpentsPathGroup.add(amaruPortal);

    // Amaru Serpentine Relief Frieze on the Portal Lintel
    const friezeGroup = new THREE.Group();
    friezeGroup.position.set(0, 7.2 + 0.45, -6);
    const friezeGeos: THREE.BufferGeometry[] = [];
    for (let i = -4; i <= 4; i++) {
      const step1 = new THREE.BoxGeometry(0.65, 0.35, 2.9);
      step1.translate(i * 0.95, 0, 0);
      friezeGeos.push(step1);
      const step2 = new THREE.BoxGeometry(0.32, 0.6, 2.92);
      step2.translate(i * 0.95 + 0.15, 0.3, 0);
      friezeGeos.push(step2);
    }
    const mergedFrieze = mergeGeometries(friezeGeos, false);
    generateBoxUVs(mergedFrieze, 0.5, 0.5);
    mergedFrieze.computeVertexNormals();
    const friezeMesh = new THREE.Mesh(mergedFrieze, goldSpiralMat);
    friezeMesh.castShadow = true;
    friezeGroup.add(friezeMesh);
    serpentsPathGroup.add(friezeGroup);

    // Upper Terrace Paved Platform
    const upperPlat = new THREE.Mesh(
      new THREE.BoxGeometry(terraceW, 1.2, 8),
      weatheredStoneMat
    );
    upperPlat.position.set(0, -0.6, -7);
    upperPlat.receiveShadow = true;
    serpentsPathGroup.add(upperPlat);

    // Upper Rear Retaining Wall into mountain
    const upperRearWall = createAshlarWall({
      width: terraceW,
      height: 6.0,
      depth: 2.2,
      courses: 8,
      material: swallowedStoneMat
    });
    upperRearWall.position.set(0, 0, -11);
    serpentsPathGroup.add(upperRearWall);
    createMossCap(serpentsPathGroup, 0, 6.0, -11, terraceW, 2.4);

    // Sluice Gate Slab (slides up when solved)
    const sluiceGateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 4.8, 0.5),
      weatheredStoneMat
    );
    sluiceGateMesh.position.set(0, 2.0, -6);
    sluiceGateMesh.castShadow = true;
    serpentsPathGroup.add(sluiceGateMesh);

    // B. MID TERRACE (z = +4 relative to group, Elevation = -4.2)
    // Upper-to-Mid Transverse Retaining Wall (height 4.2m)
    const midRetainingWall = createAshlarWall({
      width: terraceW,
      height: 4.5,
      depth: 2.0,
      courses: 6,
      batterAngle: 0.05,
      material: swallowedStoneMat
    });
    midRetainingWall.position.set(0, -4.5, -2);
    serpentsPathGroup.add(midRetainingWall);
    createMossCap(serpentsPathGroup, 0, 0.0, -2, terraceW, 2.2);

    // Mid Terrace Paved Basin Floor
    const midPlat = new THREE.Mesh(
      new THREE.BoxGeometry(terraceW, 1.2, 10),
      weatheredStoneMat
    );
    midPlat.position.set(0, -4.8, 4);
    midPlat.receiveShadow = true;
    serpentsPathGroup.add(midPlat);

    // Grand Monumental Stone Staircase connecting Mid to Upper Terrace
    const stairW = 4.8;
    const numStairs = 9;
    const stepH = 4.2 / numStairs;
    const stepD = 0.55;
    for (let s = 0; s < numStairs; s++) {
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stairW, stepH, stepD),
        weatheredStoneMat
      );
      stepMesh.position.set(0, -4.2 + (s + 0.5) * stepH, -2 - (numStairs - 1 - s) * stepD);
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      serpentsPathGroup.add(stepMesh);
    }

    // Flanking Dock Piers and Balustrades
    const pierGeo = new THREE.BoxGeometry(0.8, 4.8, numStairs * stepD + 0.5);
    const pierL = new THREE.Mesh(pierGeo, weatheredStoneMat);
    pierL.position.set(-stairW / 2 - 0.4, -2.1, -2 - (numStairs * stepD) / 2);
    const pierR = new THREE.Mesh(pierGeo, weatheredStoneMat);
    pierR.position.set(stairW / 2 + 0.4, -2.1, -2 - (numStairs * stepD) / 2);
    serpentsPathGroup.add(pierL, pierR);

    // Black-Water Standing Pool on Mid Terrace (§2.4 Dark Water #14261E)
    const spWaterSurface = createWaterSurface(
      api.scene,
      {
        color: 0x14261E,
        roughness: 0.1,
        opacity: 1.0,
        flowSpeed: 0.08,
        flowDir: [0, 1],
        foamAtEdges: true
      },
      terraceW * 0.95,
      9,
      caps
    );
    const spWater = spWaterSurface.mesh;
    spWater.position.set(0, -4.0, 4);
    serpentsPathGroup.add(spWater);

    // C. LOWER TERRACE (z = +14 relative to group, Elevation = -8.5)
    // Mid-to-Lower Transverse Retaining Wall (height 4.3m)
    const lowerRetainingWall = createAshlarWall({
      width: terraceW,
      height: 4.5,
      depth: 2.0,
      courses: 6,
      batterAngle: 0.05,
      material: swallowedStoneMat
    });
    lowerRetainingWall.position.set(0, -8.8, 9);
    serpentsPathGroup.add(lowerRetainingWall);
    createMossCap(serpentsPathGroup, 0, -4.3, 9, terraceW, 2.2);

    // Lower Platform Pavement
    const lowerPlat = new THREE.Mesh(
      new THREE.BoxGeometry(terraceW, 1.2, 10),
      weatheredStoneMat
    );
    lowerPlat.position.set(0, -9.1, 14);
    lowerPlat.receiveShadow = true;
    serpentsPathGroup.add(lowerPlat);

    // Lower Staircase connecting Lower to Mid Terrace
    for (let s = 0; s < numStairs; s++) {
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stairW, stepH, stepD),
        weatheredStoneMat
      );
      stepMesh.position.set(0, -8.5 + (s + 0.5) * stepH, 9 - (numStairs - 1 - s) * stepD);
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      serpentsPathGroup.add(stepMesh);
    }

    // Heavy Cyclopean Bastion Pilasters flanking the lower approach
    for (const bSide of [-stairW / 2 - 2.5, stairW / 2 + 2.5]) {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.0, 2.4), weatheredStoneMat);
      pilaster.position.set(bSide, -6.5, 9);
      pilaster.castShadow = true;
      pilaster.receiveShadow = true;
      serpentsPathGroup.add(pilaster);
      createMossCap(serpentsPathGroup, bSide, -4.0, 9, 2.5, 2.5);
    }

    // Banyan Buttress Roots clutching the retaining wall terraces
    createBanyanRoot(serpentsPathGroup, -terraceW / 2 + 2, -4.2, -1, Math.PI / 2, 1.3);
    createBanyanRoot(serpentsPathGroup, terraceW / 2 - 2, -4.2, -1, -Math.PI / 2, 1.3);
    createBanyanRoot(serpentsPathGroup, -terraceW / 2 + 2, -8.5, 9, Math.PI / 2, 1.4);
    createBanyanRoot(serpentsPathGroup, terraceW / 2 - 2, -8.5, 9, -Math.PI / 2, 1.4);

    // Hanging Lianas cascading from Portal and Retaining Walls
    for (let l = 0; l < 8; l++) {
      createLiana(serpentsPathGroup, (rng() - 0.5) * 5.2, 7.2, -6, 0.9 + rng() * 0.5);
      createLiana(serpentsPathGroup, (rng() - 0.5) * 16, 0.0, -2, 0.7 + rng() * 0.6);
      createLiana(serpentsPathGroup, (rng() - 0.5) * 16, -4.3, 9, 0.7 + rng() * 0.6);
    }

    // Foliage Cards sprouting from terrace wall joints
    for (let f = 0; f < 8; f++) {
      createFoliageCard(serpentsPathGroup, (rng() - 0.5) * 18, -2.5 + rng() * 1.5, -2, 0.8 + rng() * 0.4);
      createFoliageCard(serpentsPathGroup, (rng() - 0.5) * 18, -6.8 + rng() * 1.5, 9, 0.8 + rng() * 0.4);
    }

    // Restrained Bioluminescent Fungus (#7FB069, intensity 0.35)
    const fungusGeo = new THREE.DodecahedronGeometry(0.3, 0);
    for (let i = 0; i < 6; i++) {
      const fungus = new THREE.Mesh(fungusGeo, emissiveFungusMat);
      fungus.position.set((rng() - 0.5) * 14, -3.8 + rng() * 1.5, 2 + rng() * 4);
      serpentsPathGroup.add(fungus);
    }

    // 3 Bronze Sluice Wheels on carved stone stelae along the mid-terrace dock pier
    const wheelGroup = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    for (let i = 0; i < 3; i++) {
      const stelaX = -stairW / 2 - 1.8 - i * 1.8;
      const stelaZ = 2.0;

      const plinthGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
      const plinth = new THREE.Mesh(plinthGeo, weatheredStoneMat);
      plinth.position.set(stelaX, -3.6, stelaZ);
      plinth.castShadow = true;
      wheelGroup.add(plinth);

      const axleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8);
      axleGeo.rotateZ(Math.PI / 2);
      const axle = new THREE.Mesh(axleGeo, bronzeMat);
      axle.position.set(stelaX + 0.3, -3.0, stelaZ);
      wheelGroup.add(axle);

      const wheelRimGeo = new THREE.TorusGeometry(0.42, 0.045, 8, 24);
      const wheelSpoke1 = new THREE.CylinderGeometry(0.03, 0.03, 0.84, 6);
      const wheelSpoke2 = new THREE.CylinderGeometry(0.03, 0.03, 0.84, 6);
      wheelSpoke2.rotateZ(Math.PI / 2);
      const mergedWheel = mergeGeometries([wheelRimGeo, wheelSpoke1, wheelSpoke2], false);
      mergedWheel.computeVertexNormals();

      const wheelMesh = new THREE.Mesh(mergedWheel, bronzeMat);
      wheelMesh.position.set(stelaX + 0.52, -3.0, stelaZ);
      wheelMesh.rotation.y = Math.PI / 2;
      wheelMesh.castShadow = true;
      wheels.push(wheelMesh);
      wheelGroup.add(wheelMesh);
    }
    serpentsPathGroup.add(wheelGroup);
    group.add(serpentsPathGroup);

    // =========================================================================
    // 2. THE TREMBLING TUNNELS (Corbelled Ashlar Gallery & Seismic Vault)
    // =========================================================================
    const tremblingTunnelsGroup = new THREE.Group();
    const ttX = -150, ttZ = -1000;
    tremblingTunnelsGroup.position.set(ttX, 0, ttZ);
    tremblingTunnelsGroup.position.y = api.terrainHeight(ttX, ttZ);

    const tunnelLen = 50;
    const tunnelHalfW = 5.2;
    const corbelCourses = 6;
    const corbelH = 1.1;

    // Solid Elevated Pavement Floor
    const floorPaveGeo = new THREE.BoxGeometry(tunnelHalfW * 2 - 0.2, 1.2, tunnelLen);
    floorPaveGeo.translate(0, 0.6, 0);
    generateBoxUVs(floorPaveGeo, 0.5, 0.5);
    const floorPave = new THREE.Mesh(floorPaveGeo, weatheredStoneMat);
    floorPave.receiveShadow = true;
    tremblingTunnelsGroup.add(floorPave);

    // Corbelled Stone Vault Walls
    const leftCorbelGeos: THREE.BufferGeometry[] = [];
    const rightCorbelGeos: THREE.BufferGeometry[] = [];

    for (let c = 0; c < corbelCourses; c++) {
      const y = 1.2 + (c + 0.5) * corbelH;
      const inwardOverhang = Math.pow(c / corbelCourses, 1.3) * 1.8;
      const courseDepth = 1.8;
      const numBlocks = Math.round(tunnelLen / 2.2);
      const blockW = tunnelLen / numBlocks;

      for (let b = 0; b < numBlocks; b++) {
        const bz = -tunnelLen / 2 + (b + 0.5) * blockW;
        if (bz > -8 && bz < 6 && c >= 3 && (b % 2 === 0)) continue;

        const bGeoL = new THREE.BoxGeometry(courseDepth, corbelH * 0.98, blockW * 0.97);
        bGeoL.translate(-tunnelHalfW + inwardOverhang, y, bz);
        leftCorbelGeos.push(bGeoL);

        const bGeoR = new THREE.BoxGeometry(courseDepth, corbelH * 0.98, blockW * 0.97);
        bGeoR.translate(tunnelHalfW - inwardOverhang, y, bz);
        rightCorbelGeos.push(bGeoR);
      }
    }

    const mergedCorbelL = mergeGeometries(leftCorbelGeos, false);
    generateBoxUVs(mergedCorbelL, 0.45, 0.45);
    mergedCorbelL.computeVertexNormals();
    const corbelMeshL = new THREE.Mesh(mergedCorbelL, swallowedStoneMat);
    corbelMeshL.castShadow = true;
    corbelMeshL.receiveShadow = true;
    tremblingTunnelsGroup.add(corbelMeshL);

    const mergedCorbelR = mergeGeometries(rightCorbelGeos, false);
    generateBoxUVs(mergedCorbelR, 0.45, 0.45);
    mergedCorbelR.computeVertexNormals();
    const corbelMeshR = new THREE.Mesh(mergedCorbelR, swallowedStoneMat);
    corbelMeshR.castShadow = true;
    corbelMeshR.receiveShadow = true;
    tremblingTunnelsGroup.add(corbelMeshR);

    // Ceiling Capstone Slabs
    const ceilingGeos: THREE.BufferGeometry[] = [];
    const numCaps = Math.round(tunnelLen / 3.0);
    for (let i = 0; i < numCaps; i++) {
      const zPos = -tunnelLen / 2 + (i + 0.5) * 3.0;
      if (zPos > -6 && zPos < 4) continue;
      const capGeo = new THREE.BoxGeometry(4.2, 0.65, 2.9);
      capGeo.translate(0, 1.2 + corbelCourses * corbelH + 0.32, zPos);
      ceilingGeos.push(capGeo);
    }
    const mergedCeiling = mergeGeometries(ceilingGeos, false);
    generateBoxUVs(mergedCeiling, 0.5, 0.5);
    mergedCeiling.computeVertexNormals();
    const ceilingMesh = new THREE.Mesh(mergedCeiling, weatheredStoneMat);
    ceilingMesh.castShadow = true;
    ceilingMesh.receiveShadow = true;
    tremblingTunnelsGroup.add(ceilingMesh);

    // Splintered Timber Shoring Braces holding the cracked vault
    for (const shZ of [-10, 8, 16]) {
      const timberPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 6), woodAgedMat);
      timberPostL.position.set(-2.8, 4.1, shZ);
      timberPostL.rotation.z = -0.08;
      timberPostL.castShadow = true;
      const timberPostR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 6), woodAgedMat);
      timberPostR.position.set(2.8, 4.1, shZ);
      timberPostR.rotation.z = 0.08;
      timberPostR.castShadow = true;
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.32, 0.38), woodAgedMat);
      crossBeam.position.set(0, 7.1, shZ);
      crossBeam.castShadow = true;
      tremblingTunnelsGroup.add(timberPostL, timberPostR, crossBeam);
    }

    // Seismic Tumbled Debris Field
    const debrisStoneGeo = new THREE.BoxGeometry(1.6, 1.1, 1.4);
    for (let i = 0; i < 16; i++) {
      const dStone = new THREE.Mesh(debrisStoneGeo, swallowedStoneMat);
      dStone.position.set(
        (rng() - 0.5) * 5.2,
        1.6 + rng() * 0.3,
        -7 + (rng() - 0.5) * 16
      );
      dStone.rotation.set((rng() - 0.5) * 0.6, rng() * Math.PI, (rng() - 0.5) * 0.6);
      dStone.castShadow = true;
      dStone.receiveShadow = true;
      tremblingTunnelsGroup.add(dStone);
    }

    // Authentic Safe-Ground Spirals (Carved stepped Cocha water medallions)
    for (let i = 0; i < 5; i++) {
      const spiralGroup = new THREE.Group();
      const sX = Math.sin(i * 1.8) * 1.4;
      const sZ = -18 + i * 9;
      spiralGroup.position.set(sX, 1.22, sZ);

      const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.35, 16), weatheredStoneMat);
      ring1.rotateX(-Math.PI / 2);
      ring1.receiveShadow = true;
      spiralGroup.add(ring1);

      const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.85, 16), goldSpiralMat);
      ring2.rotateX(-Math.PI / 2);
      ring2.receiveShadow = true;
      spiralGroup.add(ring2);

      const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), fineAshlarMat);
      centerDot.rotateX(-Math.PI / 2);
      centerDot.receiveShadow = true;
      spiralGroup.add(centerDot);

      tremblingTunnelsGroup.add(spiralGroup);
    }

    // Wall-mounted Bronze Oil Sconces with warm glowing embers
    for (const lampZ of [-18, 0, 18]) {
      const sconce = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.28, 8), bronzeMat);
      sconce.position.set(-tunnelHalfW + 1.2, 3.8, lampZ);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), emberMat);
      ember.position.set(-tunnelHalfW + 1.2, 3.95, lampZ);
      const lampLight = new THREE.PointLight(0xFF8833, 1.2, 14, 1.4);
      lampLight.position.set(-tunnelHalfW + 1.5, 4.1, lampZ);
      tremblingTunnelsGroup.add(sconce, ember, lampLight);
    }

    group.add(tremblingTunnelsGroup);

    // =========================================================================
    // 3. THE VANGUARD CHOKE POINT (Fortified Mountain Pass & Quechua Abatis)
    // =========================================================================
    const vanguardGroup = new THREE.Group();
    const vcX = 250, vcZ = -1150;
    vanguardGroup.position.set(vcX, 0, vcZ);
    vanguardGroup.position.y = api.terrainHeight(vcX, vcZ);

    const passSpan = 14;
    const bastionH = 8.5;
    const bastionD = 6.0;

    // Helper for fully enclosed 4-sided stone bastion towers
    const createBastionTower = (posX: number) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(posX, 0, 0);

      const bGeo = new THREE.BoxGeometry(6.5, bastionH, bastionD);
      bGeo.translate(0, bastionH / 2, 0);
      generateBoxUVs(bGeo, 0.45, 0.45);
      const bMesh = new THREE.Mesh(bGeo, weatheredStoneMat);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      towerGroup.add(bMesh);

      // Parapet crenellations on top
      const crenGeo = new THREE.BoxGeometry(1.2, 0.9, 1.2);
      for (const cx of [-2.4, 0, 2.4]) {
        for (const cz of [-2.2, 2.2]) {
          const cren = new THREE.Mesh(crenGeo, weatheredStoneMat);
          cren.position.set(cx, bastionH + 0.45, cz);
          cren.castShadow = true;
          towerGroup.add(cren);
        }
      }
      return towerGroup;
    };

    vanguardGroup.add(createBastionTower(-passSpan / 2 - 3.25));
    vanguardGroup.add(createBastionTower(passSpan / 2 + 3.25));

    // Defensive Barricade: Stone Breastwork Base + Interlocking Timber Palisade
    const barricadeGroup = new THREE.Group();

    // Heavy Cyclopean Stone Breastwork
    const stoneBreastwork = createAshlarWall({
      width: passSpan + 1.5,
      height: 1.8,
      depth: 1.8,
      courses: 3,
      batterAngle: 0.05,
      material: weatheredStoneMat
    });
    stoneBreastwork.position.set(0, 0, 0);
    barricadeGroup.add(stoneBreastwork);

    // Vertical Driven Timber Palisade Logs
    const palisadeCount = 18;
    const palisadeStakeGeo = new THREE.CylinderGeometry(0.14, 0.18, 3.6, 6);
    const stakeSpacing = passSpan / (palisadeCount - 1);

    for (let p = 0; p < palisadeCount; p++) {
      const stakeX = -passSpan / 2 + p * stakeSpacing;
      const stakeMesh = new THREE.Mesh(palisadeStakeGeo, woodAgedMat);
      stakeMesh.position.set(
        stakeX,
        1.8 + 1.6,
        (p % 2 === 0 ? 0.2 : -0.2)
      );
      stakeMesh.rotation.z = (rng() - 0.5) * 0.12;
      stakeMesh.rotation.x = 0.06;
      stakeMesh.castShadow = true;
      stakeMesh.receiveShadow = true;
      barricadeGroup.add(stakeMesh);
    }

    // Heavy Horizontal Cross-Tie Lashing Logs
    const tieGeo = new THREE.CylinderGeometry(0.16, 0.16, passSpan + 1.0, 8);
    tieGeo.rotateZ(Math.PI / 2);
    const crossTieLower = new THREE.Mesh(tieGeo, woodAgedMat);
    crossTieLower.position.set(0, 2.5, -0.3);
    crossTieLower.castShadow = true;
    const crossTieUpper = new THREE.Mesh(tieGeo, woodAgedMat);
    crossTieUpper.position.set(0, 4.2, -0.3);
    crossTieUpper.castShadow = true;
    barricadeGroup.add(crossTieLower, crossTieUpper);

    // Diagonal Bracing Struts on the defilade side
    for (let b = -3; b <= 3; b += 2) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.8, 6), woodAgedMat);
      brace.position.set(b * 1.8, 2.4, -1.4);
      brace.rotation.x = -0.68;
      brace.castShadow = true;
      barricadeGroup.add(brace);
    }

    // Abatis: Sharpened Stakes Angled Outward Toward the Approach (+Z)
    const abatisGeo = new THREE.CylinderGeometry(0.1, 0.14, 3.2, 5);
    for (let a = 0; a < 14; a++) {
      const abatisMesh = new THREE.Mesh(abatisGeo, woodWetMat);
      const ax = -passSpan / 2 + 0.8 + a * 0.95;
      abatisMesh.position.set(ax, 0.8, 1.8);
      abatisMesh.rotation.x = 0.75;
      abatisMesh.rotation.z = (rng() - 0.5) * 0.2;
      abatisMesh.castShadow = true;
      barricadeGroup.add(abatisMesh);
    }
    vanguardGroup.add(barricadeGroup);

    // Expedition Encampment behind Barricade
    const crateGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    for (let c = 0; c < 5; c++) {
      const crate = new THREE.Mesh(crateGeo, woodAgedMat);
      crate.position.set(-3.5 + (c % 3) * 0.95, 0.45 + (c > 2 ? 0.85 : 0), -3.2 - Math.floor(c / 3) * 0.9);
      crate.rotation.y = (c * 0.3);
      crate.castShadow = true;
      crate.receiveShadow = true;
      vanguardGroup.add(crate);
    }

    // Heavy Cast-Iron Fire Braziers on Stone Plinths
    for (const bSide of [-passSpan / 2 + 1.2, passSpan / 2 - 1.2]) {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), weatheredStoneMat);
      plinth.position.set(bSide, 0.6, 1.2);
      plinth.castShadow = true;
      plinth.receiveShadow = true;

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.42, 0.5, 10), metalDarkMat);
      bowl.position.set(bSide, 1.45, 1.2);
      bowl.castShadow = true;

      const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.16, 8), emberMat);
      coals.position.set(bSide, 1.6, 1.2);

      const fireLight = new THREE.PointLight(0xFF7722, 2.0, 18, 1.3);
      fireLight.position.set(bSide, 2.2, 1.2);

      vanguardGroup.add(plinth, bowl, coals, fireLight);
    }

    group.add(vanguardGroup);

    // =========================================================================
    // 4. THE SUBMERGED PASSAGE (Sunken Water Temple & Flooded Hypostyle)
    // =========================================================================
    const submergedGroup = new THREE.Group();
    const subX = 0, subZ = -1350;
    submergedGroup.position.set(subX, 0, subZ);
    submergedGroup.position.y = api.terrainHeight(subX, subZ);

    // Sunken Temple Basin Floor
    const subFloorGeo = new THREE.BoxGeometry(22, 2.4, 32);
    subFloorGeo.translate(0, 1.2, -8);
    generateBoxUVs(subFloorGeo, 0.5, 0.5);
    const subFloor = new THREE.Mesh(subFloorGeo, weatheredStoneMat);
    subFloor.receiveShadow = true;
    submergedGroup.add(subFloor);

    // Submerged Grand Inca Portal
    const submergedPortal = createTrapezoidalPortal({
      widthBottom: 5.6,
      height: 7.2,
      depth: 2.6,
      taperRatio: 0.82,
      lintelOverhang: 0.75,
      material: swallowedStoneMat
    });
    submergedPortal.position.set(0, 1.2, -14);
    submergedGroup.add(submergedPortal);

    // Moss blanket across the portal lintel
    createMossCap(submergedGroup, 0, 7.2 + 1.2 + 0.4, -14, 7.2, 3.2);

    // Flanking Submerged Ashlar Retaining Terraces
    const leftSubWall = createAshlarWall({
      width: 28,
      height: 8.5,
      depth: 2.2,
      courses: 9,
      batterAngle: 0.06,
      material: swallowedStoneMat
    });
    leftSubWall.position.set(-11, 1.2, -8);
    leftSubWall.rotation.y = Math.PI / 2;
    submergedGroup.add(leftSubWall);

    const rightSubWall = createAshlarWall({
      width: 28,
      height: 8.5,
      depth: 2.2,
      courses: 9,
      batterAngle: 0.06,
      material: swallowedStoneMat
    });
    rightSubWall.position.set(11, 1.2, -8);
    rightSubWall.rotation.y = -Math.PI / 2;
    submergedGroup.add(rightSubWall);

    // Sunken Ashlar Pillars flanking the pool corridor
    const pillarGeo = new THREE.CylinderGeometry(0.7, 0.85, 9, 8);
    for (const pz of [-4, -8, -14]) {
      const pL = new THREE.Mesh(pillarGeo, swallowedStoneMat);
      pL.position.set(-5.5, 4.5, pz);
      pL.castShadow = true;
      pL.receiveShadow = true;
      const pR = new THREE.Mesh(pillarGeo, swallowedStoneMat);
      pR.position.set(5.5, 4.5, pz);
      pR.castShadow = true;
      pR.receiveShadow = true;
      submergedGroup.add(pL, pR);
    }

    // Trailing Lianas and Weeping Vines
    for (let l = 0; l < 6; l++) {
      createLiana(
        submergedGroup,
        (rng() - 0.5) * 5,
        7.8,
        -14 + (rng() - 0.5) * 1.5,
        1.1 + rng() * 0.5
      );
    }

    // Mirror-like Dark Jade Standing Pool (§2.4 Dark Water #14261E)
    const dWaterSurface = createWaterSurface(
      api.scene,
      {
        color: 0x14261E,
        roughness: 0.08,
        opacity: 1.0,
        flowSpeed: 0,
        flowDir: [0, 1],
        foamAtEdges: true
      },
      20,
      30,
      caps
    );
    const dWater = dWaterSurface.mesh;
    dWater.position.set(0, 2.2, -8);
    submergedGroup.add(dWater);

    group.add(submergedGroup);

    // =========================================================================
    // ENCOUNTER LOGIC & QUEST TRIGGERS
    // =========================================================================
    let loopActive = false;

    // 1. jl_serpent_waters state
    let serpentWheels: string[] = ['low', 'low', 'low'];
    let serpentPuzzleSolved = false;

    // 2. jl_trembling_crossing state
    let tremblingCrossed = false;
    let rockfallActive = false;
    let rockfallTimer = 0;
    const fallingRocks: THREE.Mesh[] = [];
    const fallingRockGeo = new THREE.DodecahedronGeometry(0.85, 0);
    for (let i = 0; i < 6; i++) {
      const rock = new THREE.Mesh(fallingRockGeo, swallowedStoneMat);
      rock.visible = false;
      fallingRocks.push(rock);
      tremblingTunnelsGroup.add(rock);
    }

    // 3. jl_vanguard_holdout state
    let vanguardWavesPassed = 0;
    let vanguardHoldoutComplete = false;
    let vanguardTimer = 0;
    const vanguardLanterns: THREE.PointLight[] = [];
    for (let i = 0; i < 3; i++) {
      const lantern = new THREE.PointLight(0xFF4400, 0, 15);
      vanguardGroup.add(lantern);
      vanguardLanterns.push(lantern);
    }

    api.onEnterRegion(() => {
      loopActive = true;
      const loop = () => {
        if (!loopActive) return;

        if (api.isSimPaused()) {
          requestAnimationFrame(loop);
          return;
        }

        const time = Date.now() * 0.001;

        // 1. jl_serpent_waters simulation & feedback
        if (!serpentPuzzleSolved) {
          const w0: 'high' | 'low' = Math.sin(time) > 0 ? 'high' : 'low';
          const w1: 'high' | 'low' = 'low';
          const w2: 'high' | 'low' = Math.cos(time) > 0 ? 'high' : 'low';

          serpentWheels[0] = w0;
          serpentWheels[1] = w1;
          serpentWheels[2] = w2;

          if (wheels[0]) wheels[0].rotation.x = (w0 as string) === 'high' ? Math.PI / 4 : 0;
          if (wheels[1]) wheels[1].rotation.x = (w1 as string) === 'high' ? Math.PI / 4 : 0;
          if (wheels[2]) wheels[2].rotation.x = (w2 as string) === 'high' ? Math.PI / 4 : 0;

          if (serpentWheels[0] === 'high' && serpentWheels[1] === 'low' && serpentWheels[2] === 'high') {
            serpentPuzzleSolved = true;
            api.flags.set('q_act3_amaru_navigated');
          }
        } else {
          // Lower canal water level and raise the cyclopean sluice gate
          if (spWater.position.y > -5.2) {
            spWater.position.y -= 0.02;
          }
          if (sluiceGateMesh.position.y < 5.8) {
            sluiceGateMesh.position.y += 0.03;
          }
        }

        // 2. jl_trembling_crossing rockfall simulation
        if (!tremblingCrossed) {
          if (!rockfallActive && rng() < 0.012) {
            rockfallActive = true;
            rockfallTimer = 1.2;
            fallingRocks.forEach((rock) => {
              rock.position.set((rng() - 0.5) * 4.5, 7.5, -12 + (rng() - 0.5) * 16);
              rock.visible = true;
            });
          }

          if (rockfallActive) {
            rockfallTimer -= 0.016;
            fallingRocks.forEach((rock) => {
              rock.position.y -= 0.42;
            });
            if (rockfallTimer <= 0) {
              rockfallActive = false;
              fallingRocks.forEach((rock) => (rock.visible = false));
            }
          }

          if (time > 15) {
            tremblingCrossed = true;
            api.flags.set('q_act3_tunnels_survived');
          }
        }

        // 3. jl_vanguard_holdout scout wave lights
        if (!vanguardHoldoutComplete) {
          vanguardTimer += 0.016;

          // Wave 1
          if (vanguardTimer > 5 && vanguardTimer < 10) {
            vanguardLanterns.forEach((l, i) => {
              l.intensity = 1.6 + Math.sin(time * 5 + i) * 0.5;
              l.position.set((i - 1) * 3.5, 1.8, 35 - (vanguardTimer - 5) * 6);
            });
          } else if (vanguardTimer >= 10 && vanguardWavesPassed === 0) {
            vanguardWavesPassed = 1;
            vanguardLanterns.forEach((l) => (l.intensity = 0));
          }

          // Wave 2
          if (vanguardTimer > 12 && vanguardTimer < 17) {
            vanguardLanterns.forEach((l, i) => {
              l.intensity = 2.2 + Math.sin(time * 8 + i) * 0.5;
              l.position.set((i - 1) * 4.5, 1.8, 45 - (vanguardTimer - 12) * 8.5);
            });
          } else if (vanguardTimer >= 17 && vanguardWavesPassed === 1) {
            vanguardWavesPassed = 2;
            vanguardHoldoutComplete = true;
            vanguardLanterns.forEach((l) => (l.intensity = 0));
            api.flags.set('q_act3_vanguard_secured');
          }
        }

        requestAnimationFrame(loop);
      };
      loop();
    });

    api.onExitRegion(() => {
      loopActive = false;
    });
  }
};
