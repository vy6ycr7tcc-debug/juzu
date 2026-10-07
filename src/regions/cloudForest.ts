import * as THREE from 'three';
import {
  woodWet, fabricWorn, ashlarWeathered, ashlarLight, ironDark, lampEmissive,
  humusEarth, mossPatch, broadleafCard, orchidAccent,
} from '../materials.js';
import { createTrapezoidalPortal, createAshlarWall } from '../architecture.js';
import type {
  RegionModule,
  RegionBuildAPI,
} from '../world/contracts.js';

// J7: all placement is seeded (Mulberry32, same pattern as volumetrics.ts).
// The pre-p10 file used Math.random() throughout — every page load re-rolled
// the mist, masonry scatter and floodlight positions, so §8 captures were not
// reproducible run-to-run (p10 audit defect ①).
const CF_SEED = 0xcf01;
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cloudForest: RegionModule = {
  id: 'cloud_forest',
  displayName: 'The Cloud Forest',
  bounds: {
    min: { x: -450, y: -50, z: -700 },
    max: { x: 450, y: 200, z: 100 }
  },
  pois: [
    {
      id: 'cf_lower_blockade',
      name: 'The Lower Blockade',
      position: { x: -100, y: 0, z: -500 },
      radius: 15,
      summary: 'A muddy barricade held by the local Quechua community.',
      discoverFlag: 'q_act1_met_tomas'
    },
    {
      id: 'cf_excavated_ruin',
      name: 'The Excavated Ruin',
      position: { x: 150, y: 0, z: -300 },
      radius: 25,
      summary: 'A raw-earth excavation pit crawling with Sol Negro equipment.'
    },
    {
      id: 'cf_quipu_archive',
      name: 'The Quipu Archive',
      position: { x: 150, y: 0, z: -350 },
      radius: 10,
      summary: 'A pristine underground chamber housing ancient knotted records.'
    },
    {
      id: 'cf_cliff_staircase',
      name: 'The Cliff Staircase',
      position: { x: 200, y: 0, z: 80 },
      radius: 20,
      summary: 'Ancient stairs climbing steeply into the dense cloud layer.'
    }
  ],
  encounters: [
    {
      id: 'cf_dig_infiltration',
      position: { x: 150, y: 0, z: -300 },
      radius: 30,
      kind: 'stealth',
      flagsOnStart: [],
      flagsOnResolve: ['q_act1_ruin_infiltrated'],
      notes: 'Entering inner perimeter (x:150, z:-300) without crossing abstract patrol cones resolves the stealth.'
    },
    {
      id: 'cf_forest_path',
      position: { x: 0, y: 0, z: -400 },
      radius: 50,
      kind: 'wildlife',
      flagsOnStart: [],
      flagsOnResolve: [],
      notes: 'Ambient wildlife (birds/flutters) using existing particle style on approach path.'
    }
  ],
  questStages: [
    { flag: 'q_act1_met_tomas', trigger: 'First discovery of the blockade POI' },
    { flag: 'q_act1_ruin_infiltrated', trigger: 'Entering the dig-site perimeter undetected' },
    { flag: 'q_act1_quipu_solved', trigger: 'Solving the quipu cipher' }
  ],
  shots: [
    { id: 'cf_lower_blockade', camera: { x: -92, y: 25.5, z: -488 }, lookAt: { x: -100, y: 24.8, z: -500 } },
    { id: 'cf_excavated_ruin', camera: { x: 180, y: 32, z: -260 }, lookAt: { x: 150, y: 21, z: -300 } },
    { id: 'cf_quipu_archive', camera: { x: 150, y: 2.2, z: -352.0 }, lookAt: { x: 150, y: 2.2, z: -355.5 } },
    { id: 'cf_cliff_staircase', camera: { x: 196, y: 14.5, z: 72 }, lookAt: { x: 200, y: 22.0, z: 105 } },
    { id: 'cf_overview', camera: { x: 0, y: 150, z: -100 }, lookAt: { x: 150, y: 20, z: -300 } }
  ],
  build(api: RegionBuildAPI): void {
    const rng = mulberry32(CF_SEED);
    const group = new THREE.Group();
    group.name = 'Region_CloudForest';
    api.scene.add(group);

    // Materials (§4.2 library only — the p10 audit replaced the ashlar-on-pit
    // recolor with the humusEarth() factory, §2.2 palette)
    const woodMat = woodWet();
    const fabricMat = fabricWorn(0x7A2E2E);
    const earthMat = humusEarth();
    const stoneMat = ashlarLight();
    const weatheredMat = ashlarWeathered();
    const metalMat = ironDark();
    const emissiveMat = lampEmissive();
    const mossMat = mossPatch();
    const leafLitMat = broadleafCard(0x303f24);
    const leafShadowMat = broadleafCard(0x2D4A22);
    const orchidMat = orchidAccent();

    // --- §2.2 dressing vocabulary helpers (all seeded, J7) -----------------

    // Hanging moss strands: thin vertical strips under structures
    const mossStrandGeo = new THREE.PlaneGeometry(0.4, 2.2);
    const hangMoss = (parent: THREE.Object3D, x: number, y: number, z: number, s: number) => {
      const strand = new THREE.Mesh(mossStrandGeo, mossMat);
      strand.position.set(x, y, z);
      strand.scale.setScalar(s);
      strand.rotation.y = rng() * Math.PI;
      parent.add(strand);
    };

    // Broadleaf cards: crossed plane pairs (V-FOLIAGE card read)
    const leafGeo = new THREE.PlaneGeometry(2.4, 1.6);
    const broadleaf = (parent: THREE.Object3D, x: number, y: number, z: number, s: number) => {
      const a = new THREE.Mesh(leafGeo, rng() > 0.5 ? leafLitMat : leafShadowMat);
      a.position.set(x, y, z);
      a.scale.setScalar(s);
      a.rotation.y = rng() * Math.PI;
      a.rotation.z = (rng() - 0.5) * 0.3;
      const b = a.clone();
      b.rotation.y += Math.PI / 2;
      parent.add(a, b);
    };

    // Orchid clusters on trunks (§2.2: sparse accents, ≤2% of frame)
    const orchidGeo = new THREE.PlaneGeometry(0.5, 0.35);
    const orchids = (parent: THREE.Object3D, x: number, y: number, z: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const f = new THREE.Mesh(orchidGeo, orchidMat);
        f.position.set(x + (rng() - 0.5) * 0.6, y + rng() * 0.5, z + (rng() - 0.5) * 0.6);
        f.rotation.y = rng() * Math.PI;
        parent.add(f);
      }
    };

    // Fallen log (rotting wood, §2.2 vocabulary)
    const logGeo = new THREE.CylinderGeometry(0.8, 0.9, 6, 8);
    logGeo.rotateZ(Math.PI / 2);
    const fallenLog = (parent: THREE.Object3D, x: number, y: number, z: number, ry: number) => {
      const log = new THREE.Mesh(logGeo, woodMat);
      log.position.set(x, y, z);
      log.rotation.y = ry;
      log.rotation.z = (rng() - 0.5) * 0.1;
      parent.add(log);
      // moss blanket on the shaded top
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 1.4), mossMat);
      blanket.position.set(x, y + 0.75, z);
      blanket.rotation.y = ry;
      parent.add(blanket);
    };

    // Milestone 2: Mist Layering (composites with sky fog)
    // fabricWorn(0xA8B8B0) transparent proxy (§2.2 mist blue-grey); placement
    // is seeded (J7) and the tint tracks the V-SKY fog color. The fog sample
    // is taken at build time too — in shot mode onEnterRegion may not fire,
    // and the pre-p10 file relied solely on the enter loop for the first tint.
    const mistGeo = new THREE.PlaneGeometry(20, 10);
    const mistMat = fabricWorn(0xA8B8B0);
    mistMat.transparent = true;
    mistMat.opacity = 0.15;
    mistMat.depthWrite = false;
    mistMat.side = THREE.DoubleSide;

    const syncMistToFog = () => {
      if (api.scene.fog && (api.scene.fog as THREE.Fog).color) {
        mistMat.color.copy((api.scene.fog as THREE.Fog).color);
      }
    };
    syncMistToFog();

    api.onEnterRegion(() => {
      mistMat.userData.active = true;
      const loop = () => {
        if (!mistMat.userData.active) return;
        syncMistToFog();
        requestAnimationFrame(loop);
      };
      loop();
    });
    api.onExitRegion(() => { mistMat.userData.active = false; });

    for (let i = 0; i < 8; i++) {
      const mist = new THREE.Mesh(mistGeo, mistMat);
      mist.position.set(100 + (rng() - 0.5) * 150, 5 + rng() * 5, -300 + (rng() - 0.5) * 200);
      mist.rotation.y = rng() * Math.PI;
      group.add(mist);
    }

    // 1. The Lower Blockade (Position: x: -100, z: -500)
    const blockadeGroup = new THREE.Group();
    blockadeGroup.position.set(-100, 0, -500);
    blockadeGroup.position.y = api.terrainHeight(-100, -500);

    // Defensive log palisade / abatis across the trail
    const stakeGeo = new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6);
    for (let i = -6; i <= 6; i += 1.2) {
      const stake = new THREE.Mesh(stakeGeo, woodMat);
      stake.position.set(i, 1.2, (i % 2 === 0 ? 0.3 : -0.3));
      stake.rotation.x = 0.25;
      stake.rotation.z = (i % 2 === 0 ? 0.12 : -0.12);
      stake.castShadow = true;
      stake.receiveShadow = true;
      blockadeGroup.add(stake);
    }
    // Horizontal cross-tie logs lashed across the stakes
    const crossLogGeo = new THREE.CylinderGeometry(0.14, 0.14, 14, 8);
    crossLogGeo.rotateZ(Math.PI / 2);
    const crossLog = new THREE.Mesh(crossLogGeo, woodMat);
    crossLog.position.set(0, 1.1, 0.1);
    crossLog.castShadow = true;
    blockadeGroup.add(crossLog);

    // Quechua A-frame canvas field shelters
    const shelterMat = fabricWorn(0x827055);
    const createShelter = (x: number, z: number, ry: number) => {
      const sGroup = new THREE.Group();
      sGroup.position.set(x, 0, z);
      sGroup.rotation.y = ry;

      // Ridge pole
      const ridgeGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6);
      ridgeGeo.rotateX(Math.PI / 2);
      const ridge = new THREE.Mesh(ridgeGeo, woodMat);
      ridge.position.set(0, 2.0, 0);
      sGroup.add(ridge);

      // Support uprights
      const upGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6);
      const upF = new THREE.Mesh(upGeo, woodMat);
      upF.position.set(0, 1.0, 1.9);
      const upB = new THREE.Mesh(upGeo, woodMat);
      upB.position.set(0, 1.0, -1.9);
      sGroup.add(upF, upB);

      // Sloped canvas roof panels
      const roofL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.3, 4.0), shelterMat);
      roofL.position.set(-0.8, 1.0, 0);
      roofL.rotation.z = 0.78;
      const roofR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.3, 4.0), shelterMat);
      roofR.position.set(0.8, 1.0, 0);
      roofR.rotation.z = -0.78;
      sGroup.add(roofL, roofR);

      return sGroup;
    };

    blockadeGroup.add(createShelter(-7, 4, 0.3));
    blockadeGroup.add(createShelter(-11, -2, -0.4));

    // Campfire ring with warm glowing embers
    const firePit = new THREE.Group();
    firePit.position.set(-3, 0.1, 3);
    const stoneRingGeo = new THREE.DodecahedronGeometry(0.25, 0);
    for (let i = 0; i < 8; i++) {
      const stone = new THREE.Mesh(stoneRingGeo, weatheredMat);
      const a = (i / 8) * Math.PI * 2;
      stone.position.set(Math.cos(a) * 0.9, 0.15, Math.sin(a) * 0.9);
      firePit.add(stone);
    }
    const emberMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.15, 8), emissiveMat);
    emberMesh.position.set(0, 0.1, 0);
    firePit.add(emberMesh);
    const fireLight = new THREE.PointLight(0xff6622, 1.8, 10, 1.5);
    fireLight.position.set(0, 0.6, 0);
    firePit.add(fireLight);
    blockadeGroup.add(firePit);

    // Weathered supply crates & packs
    const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const crate1 = new THREE.Mesh(crateGeo, woodMat);
    crate1.position.set(-5, 0.4, 2);
    const crate2 = new THREE.Mesh(crateGeo, woodMat);
    crate2.position.set(-5, 0.4, 3);
    crate2.rotation.y = 0.4;
    const crate3 = new THREE.Mesh(crateGeo, woodMat);
    crate3.position.set(-5, 1.2, 2.5);
    blockadeGroup.add(crate1, crate2, crate3);

    // §2.2 rope bridge (fiber, not chain): rope rails + deck slats across
    // the muddy approach, anchored on timber posts
    const ropeMat = fabricWorn(0x8A7355); // worn fiber
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(6, 0.2, -8);
    const postGeo = new THREE.CylinderGeometry(0.15, 0.18, 2.2, 6);
    const anchorA = new THREE.Mesh(postGeo, woodMat);
    anchorA.position.set(0, 1.1, 0);
    const anchorB = new THREE.Mesh(postGeo, woodMat);
    anchorB.position.set(0, 1.1, 9);
    bridgeGroup.add(anchorA, anchorB);
    const deckSlatGeo = new THREE.BoxGeometry(1.4, 0.1, 0.55);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const z = t * 9;
      const sag = Math.sin(t * Math.PI) * 0.55; // catenary-ish dip
      const slat = new THREE.Mesh(deckSlatGeo, woodMat);
      slat.position.set(0, 0.9 - sag, z);
      bridgeGroup.add(slat);
      if (i % 2 === 0) {
        const ropeL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 5), ropeMat);
        ropeL.position.set(-0.7, 1.45 - sag * 0.4, z);
        ropeL.rotation.x = 0.5;
        bridgeGroup.add(ropeL);
      }
    }
    blockadeGroup.add(bridgeGroup);

    group.add(blockadeGroup);

    // 2. The Excavated Ruin (Archaeological Dig Site - x: 150, z: -300)
    const ruinGroup = new THREE.Group();
    const ruinX = 150, ruinZ = -300;
    ruinGroup.position.set(ruinX, 0, ruinZ);
    ruinGroup.position.y = api.terrainHeight(ruinX, ruinZ);

    // Excavation trench (terraced earth floor and retaining shoring)
    const trenchFloor = new THREE.Mesh(new THREE.BoxGeometry(32, 1.4, 32), earthMat);
    trenchFloor.position.set(0, -0.7, 0);
    trenchFloor.receiveShadow = true;
    ruinGroup.add(trenchFloor);

    // Partially unearthed Inca building with authentic coursed ashlar walls
    const rearWall = createAshlarWall({
      width: 24,
      height: 7.2,
      depth: 2.2,
      courses: 8,
      material: stoneMat,
    });
    rearWall.position.set(0, 0, -10);
    ruinGroup.add(rearWall);

    const sideWallL = createAshlarWall({
      width: 16,
      height: 5.8,
      depth: 2.0,
      courses: 6,
      material: stoneMat,
    });
    sideWallL.position.set(-11, 0, -2);
    sideWallL.rotation.y = Math.PI / 2;
    ruinGroup.add(sideWallL);

    // Partially buried authentic trapezoidal doorway entering the unexcavated slope
    const portal = createTrapezoidalPortal({
      widthBottom: 3.4,
      height: 5.2,
      depth: 1.8,
      material: stoneMat,
    });
    portal.position.set(2, 0, -9.8);
    ruinGroup.add(portal);

    // Archaeological timber shoring beams (supporting the dirt banks)
    const plankGeo = new THREE.BoxGeometry(0.35, 3.2, 0.25);
    for (let i = -12; i <= 12; i += 4) {
      const brace = new THREE.Mesh(plankGeo, woodMat);
      brace.position.set(i, 1.5, 12);
      brace.rotation.x = -0.25;
      brace.castShadow = true;
      ruinGroup.add(brace);
    }

    // Weathered dressed ashlar blocks partially emerged from the humus soil
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng() * 0.4;
      const dist = 8 + rng() * 6;
      const bW = 1.6 + rng() * 0.8;
      const bH = 1.0 + rng() * 0.6;
      const block = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, 1.4), weatheredMat);
      block.position.set(Math.cos(a) * dist, bH * 0.35, Math.sin(a) * dist);
      block.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI, (rng() - 0.5) * 0.2);
      block.castShadow = true;
      block.receiveShadow = true;
      ruinGroup.add(block);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.9, 0.12, 1.3), mossMat);
      cap.position.set(block.position.x, block.position.y + bH / 2 + 0.05, block.position.z);
      cap.rotation.y = block.rotation.y;
      ruinGroup.add(cap);
    }

    // Heavy machinery silhouettes (excavator)
    const excavatorGeo = new THREE.BoxGeometry(4, 5, 8);
    const excavator = new THREE.Mesh(excavatorGeo, metalMat);
    excavator.position.set(-15, 2.5, 10);
    excavator.rotation.y = 0.5;
    ruinGroup.add(excavator);

    // Sol Negro floodlight rigs (seeded placement, J7)
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
    const lightHeadGeo = new THREE.BoxGeometry(0.5, 0.5, 0.2);
    for (let i = 0; i < 3; i++) {
      const pole = new THREE.Mesh(poleGeo, metalMat);
      pole.position.set(
        (rng() - 0.5) * 25,
        3,
        (rng() - 0.5) * 25
      );
      const head = new THREE.Mesh(lightHeadGeo, emissiveMat);
      head.position.set(0, 3, 0);
      head.rotation.x = -0.5;
      pole.add(head);
      ruinGroup.add(pole);
    }

    // §2.2 canopy dressing: broadleaf cards + hanging moss + orchids +
    // fallen logs around the dig site
    for (let i = 0; i < 10; i++) {
      broadleaf(ruinGroup, (rng() - 0.5) * 38, 2.5 + rng() * 3, (rng() - 0.5) * 38, 0.8 + rng() * 0.7);
    }
    for (let i = 0; i < 6; i++) {
      hangMoss(ruinGroup, (rng() - 0.5) * 24, 3.4 + rng() * 1.5, (rng() - 0.5) * 24, 0.7 + rng() * 0.8);
    }
    fallenLog(ruinGroup, 9, 0.6, 13, rng() * Math.PI);
    orchids(ruinGroup, 9, 1.1, 13, 3);

    group.add(ruinGroup);

    // 3. The Quipu Archive (Subterranean Sanctuary Chamber - x: 150, z: -350)
    const archiveGroup = new THREE.Group();
    const archiveX = 150, archiveZ = -350;
    // Positioned underground inside the hillside
    const archiveY = api.terrainHeight(archiveX, archiveZ) - 20;
    archiveGroup.position.set(archiveX, archiveY, archiveZ);

    // Stone chamber floor
    const floorGeo = new THREE.BoxGeometry(16, 0.4, 16);
    const floorMesh = new THREE.Mesh(floorGeo, stoneMat);
    floorMesh.position.set(0, -0.2, 0);
    floorMesh.receiveShadow = true;
    archiveGroup.add(floorMesh);

    // Ceiling stone transverse lintels
    for (let z = -6; z <= 6; z += 3) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 1.2), stoneMat);
      beam.position.set(0, 5.8, z);
      archiveGroup.add(beam);
    }

    // Left and Right coursed ashlar walls with authentic seismic batter
    const leftWall = createAshlarWall({
      width: 16,
      height: 6,
      depth: 1.6,
      courses: 8,
      material: stoneMat,
    });
    leftWall.position.set(-7.2, 0, 0);
    leftWall.rotation.y = Math.PI / 2;
    archiveGroup.add(leftWall);

    const rightWall = createAshlarWall({
      width: 16,
      height: 6,
      depth: 1.6,
      courses: 8,
      material: stoneMat,
    });
    rightWall.position.set(7.2, 0, 0);
    rightWall.rotation.y = -Math.PI / 2;
    archiveGroup.add(rightWall);

    // Back wall flanking ashlar sections
    const backWallL = createAshlarWall({
      width: 6,
      height: 6,
      depth: 1.6,
      courses: 8,
      material: stoneMat,
    });
    backWallL.position.set(-4.8, 0, -7.2);
    archiveGroup.add(backWallL);

    const backWallR = createAshlarWall({
      width: 6,
      height: 6,
      depth: 1.6,
      courses: 8,
      material: stoneMat,
    });
    backWallR.position.set(4.8, 0, -7.2);
    archiveGroup.add(backWallR);

    // Central authentic trapezoidal portal on the back wall
    const archivePortal = createTrapezoidalPortal({
      widthBottom: 2.8,
      height: 4.6,
      depth: 1.6,
      material: stoneMat,
    });
    archivePortal.position.set(0, 0, -7.2);
    archiveGroup.add(archivePortal);

    // Fitted sliding stone slab door (sealed until cipher is solved)
    const doorGeo = new THREE.BoxGeometry(2.4, 4.4, 0.5);
    const doorMesh = new THREE.Mesh(doorGeo, weatheredMat);
    doorMesh.position.set(0, 2.2, -7.2);
    archiveGroup.add(doorMesh);

    // Bronze relief reinforcement bands across the door
    for (let by = 0.8; by <= 3.8; by += 1.4) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.54), metalMat);
      band.position.set(0, by - 2.2, 0);
      doorMesh.add(band);
    }

    // Subterranean outer rock enclosure (prevents external daylight leaks)
    const enclosureMat = ashlarWeathered();
    const backEnclosure = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 1.5), enclosureMat);
    backEnclosure.position.set(0, 3, -8.6);
    archiveGroup.add(backEnclosure);

    const roofEnclosure = new THREE.Mesh(new THREE.BoxGeometry(18, 1.5, 18), enclosureMat);
    roofEnclosure.position.set(0, 6.6, 0);
    archiveGroup.add(roofEnclosure);

    // Atmospheric warm lighting (braziers flanking doorway)
    const brazierGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.8, 8);
    const brazierL = new THREE.Mesh(brazierGeo, metalMat);
    brazierL.position.set(-2.8, 1.2, -6.6);
    const lightL = new THREE.PointLight(0xffaa44, 2.4, 15, 1.2);
    lightL.position.set(0, 0.5, 0);
    brazierL.add(lightL);
    archiveGroup.add(brazierL);

    const brazierR = new THREE.Mesh(brazierGeo, metalMat);
    brazierR.position.set(2.8, 1.2, -6.6);
    const lightR = new THREE.PointLight(0xffaa44, 2.4, 15, 1.2);
    lightR.position.set(0, 0.5, 0);
    brazierR.add(lightR);
    archiveGroup.add(brazierR);

    // The Grand Quipu Installation
    const quipuGroup = new THREE.Group();
    quipuGroup.position.set(0, 0, -4.5);

    // Carved timber suspension beam
    const susBeamGeo = new THREE.CylinderGeometry(0.08, 0.08, 10, 8);
    susBeamGeo.rotateZ(Math.PI / 2);
    const susBeamMesh = new THREE.Mesh(susBeamGeo, woodMat);
    susBeamMesh.position.set(0, 3.8, 0);
    quipuGroup.add(susBeamMesh);

    // Thick primary cord (alpaca fiber)
    const primaryCordGeo = new THREE.CylinderGeometry(0.04, 0.04, 9.6, 8);
    primaryCordGeo.rotateZ(Math.PI / 2);
    const primaryCord = new THREE.Mesh(primaryCordGeo, fabricWorn(0x5a4332));
    primaryCord.position.set(0, 3.7, 0);
    quipuGroup.add(primaryCord);

    // Natural dye yarn palette (Peruvian archaeological dyes: cream, crimson, ochre, indigo, tawny, charcoal)
    const yarnMats = [
      fabricWorn(0xc9bba4), // Cream alpaca
      fabricWorn(0x8a2c26), // Cochineal crimson
      fabricWorn(0xb58038), // Yellow ochre
      fabricWorn(0x354b5e), // Indigo slate
      fabricWorn(0x7a5234), // Vicuña tawny
      fabricWorn(0x2d2f32), // Charcoal black
    ];

    // Pendant cords with authentic knot clusters
    const hangingCordGeo = new THREE.CylinderGeometry(0.02, 0.02, 3.2, 6);
    for (let i = 0; i < 11; i++) {
      const cx = -4 + i * 0.8;
      const mat = yarnMats[i % yarnMats.length];
      const hCord = new THREE.Mesh(hangingCordGeo, mat);
      hCord.position.set(cx, 2.1, 0);
      quipuGroup.add(hCord);

      // Knots on cords (figure-eight and long knots)
      const knotCount = 2 + (i % 3);
      for (let k = 0; k < knotCount; k++) {
        const knotMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.08, 6),
          mat
        );
        knotMesh.position.set(cx, 1.2 + k * 0.6 + (i * 0.1) % 0.3, 0);
        quipuGroup.add(knotMesh);
      }
    }

    // 3 Interactive Cipher Knots (carved bone/stone sliders)
    const knotMat = fabricWorn(0xf4ede2);
    const knotMeshes: THREE.Mesh[] = [];
    const knotStates = [0, 0, 0];
    const correctCombo = [1, 3, 2]; // The cipher definition

    for (let i = 0; i < 3; i++) {
      const knotSlider = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), knotMat);
      const cordX = -4 + (i * 3 + 2) * 0.8;
      knotSlider.position.set(cordX, 1.5, 0.05);
      quipuGroup.add(knotSlider);
      knotMeshes.push(knotSlider);
    }
    archiveGroup.add(quipuGroup);

    let puzzleSolved = false;

    // We use api.onEnterRegion to start a loop for logic
    let loopActive = false;

    api.onEnterRegion(() => {
      loopActive = true;
      const checkLogic = () => {
        if (!loopActive) return;

        // P-MOBILE: keep the poll alive but frozen under the pause menu —
        // the solve path (flags.set + door animation) must not be able to
        // start while the sim is halted.
        if (api.isSimPaused()) {
          requestAnimationFrame(checkLogic);
          return;
        }

        // Simulation of the puzzle check:
        if (!puzzleSolved &&
            knotStates[0] === correctCombo[0] &&
            knotStates[1] === correctCombo[1] &&
            knotStates[2] === correctCombo[2]) {

          puzzleSolved = true;
          api.flags.set('q_act1_quipu_solved');

          // Animate door (descend into floor threshold slot)
          const slideDoor = () => {
            if (doorMesh.position.y > -2.4) {
              doorMesh.position.y -= 0.05;
              requestAnimationFrame(slideDoor);
            }
          };
          slideDoor();
        }

        requestAnimationFrame(checkLogic);
      };
      checkLogic();
    });

    api.onExitRegion(() => {
      loopActive = false;
    });

    group.add(archiveGroup);

    // 4. The Cliff Staircase (Position: +z edge around x: 200, z: 80, going up)
    const stairsGroup = new THREE.Group();
    const stairX = 200, stairZ = 80;
    stairsGroup.position.set(stairX, 0, stairZ);
    stairsGroup.position.y = api.terrainHeight(stairX, stairZ);

    const stepGeo = new THREE.BoxGeometry(4.5, 0.5, 1.8);
    for (let i = 0; i < 30; i++) {
      const step = new THREE.Mesh(stepGeo, stoneMat);
      step.position.set(0, i * 0.5, i * 1.5);
      step.castShadow = true;
      step.receiveShadow = true;
      stairsGroup.add(step);
      // moss on every 3rd step (§2.2 moss patches)
      if (i % 3 === 0) {
        const mossCap = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.1, 1.4), mossMat);
        mossCap.position.set(0.2, i * 0.5 + 0.3, i * 1.5);
        stairsGroup.add(mossCap);
      }
    }

    // Stepped Inca retaining andenes flanking the staircase on both sides
    const segCount = 4;
    for (let k = 0; k < segCount; k++) {
      const segZ = k * 11 + 5.5;
      const segY = k * 3.75 + 1.2;
      const segHeight = 4.8;

      // Left retaining terrace wall (running along Z axis)
      const segWallL = createAshlarWall({
        width: 11.5,
        height: segHeight,
        depth: 1.8,
        courses: 5,
        material: weatheredMat,
      });
      segWallL.position.set(-3.6, segY, segZ);
      segWallL.rotation.y = Math.PI / 2;
      stairsGroup.add(segWallL);

      // Right retaining terrace wall (running along Z axis)
      const segWallR = createAshlarWall({
        width: 11.5,
        height: segHeight,
        depth: 1.8,
        courses: 5,
        material: weatheredMat,
      });
      segWallR.position.set(3.6, segY, segZ);
      segWallR.rotation.y = -Math.PI / 2;
      stairsGroup.add(segWallR);
    }

    // Monumental summit portal at the cloud line
    const summitPortal = createTrapezoidalPortal({
      widthBottom: 4.4,
      height: 6.8,
      depth: 2.2,
      material: stoneMat
    });
    summitPortal.position.set(0, 15, 45);
    stairsGroup.add(summitPortal);

    // Stone terrace platform behind the summit portal
    const summitPlatform = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 10), stoneMat);
    summitPlatform.position.set(0, 14.6, 50);
    summitPlatform.receiveShadow = true;
    stairsGroup.add(summitPlatform);

    for (let i = 0; i < 8; i++) {
      hangMoss(stairsGroup, (rng() > 0.5 ? -4.5 : 4.5) + (rng() - 0.5) * 1.5, 6 + rng() * 8, 10 + rng() * 24, 0.9 + rng() * 1.1);
    }
    for (let i = 0; i < 6; i++) {
      broadleaf(stairsGroup, (rng() - 0.5) * 8, 2 + rng() * 8, 6 + rng() * 26, 0.9 + rng() * 0.8);
    }
    fallenLog(stairsGroup, -3.5, 0.5, -6, 0.4 + rng() * 0.3);

    group.add(stairsGroup);
  }
};
