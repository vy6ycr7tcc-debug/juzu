import * as THREE from 'three';
import { ashlarLight, gold, bronze, plazaWorn, type RenderCaps } from '../materials.js';
import { createWaterSurface } from '../river.js';
import {
  createTrapezoidalPortal,
  createChakanaPlazaPlatform,
  createIntihuatanaAltar,
  createPlazaColonnade,
  createTorreonSunTemple,
  createAshlarWall
} from '../architecture.js';
import type {
  RegionModule,
  RegionBuildAPI,
} from '../world/contracts.js';

export const paititi: RegionModule = {
  id: 'paititi',
  displayName: 'Paititi',
  bounds: {
    min: { x: 800, y: -50, z: -400 },
    max: { x: 1400, y: 250, z: 200 }
  },
  pois: [
    {
      id: 'pa_outer_terraces',
      name: 'The Outer Terraces',
      position: { x: 900, y: 0, z: -100 },
      radius: 30,
      summary: 'Massive agricultural terraces stepping down the valley sides, doubling as defensive walls.',
      discoverFlag: 'q_act4_paititi_entered'
    },
    {
      id: 'pa_plaza_of_sun',
      name: 'The Plaza of the Sun',
      position: { x: 1100, y: 0, z: -50 },
      radius: 30,
      summary: 'The central gathering space dominated by the Punchao.'
    },
    {
      id: 'pa_sanctuary',
      name: 'The Sanctuary',
      position: { x: 1300, y: 0, z: 50 },
      radius: 20,
      summary: 'The inner chamber containing the grand observatory mechanisms.'
    },
    {
      id: 'pa_aqueduct_line',
      name: 'The Aqueduct Line',
      position: { x: 1200, y: 0, z: 0 },
      radius: 20,
      summary: 'Functional aqueducts carrying water through the city.'
    }
  ],
  encounters: [
    {
      id: 'pa_sanctuary_confrontation',
      position: { x: 1300, y: 0, z: 50 },
      radius: 25,
      kind: 'ambush',
      flagsOnStart: [],
      flagsOnResolve: ['q_act4_sanctuary_confrontation'],
      notes: 'Timer-based explosive standoff.'
    },
    {
      id: 'pa_grand_observatory',
      position: { x: 1300, y: 0, z: 50 },
      radius: 10,
      kind: 'puzzle_guard',
      flagsOnStart: [],
      flagsOnResolve: ['q_act4_observatory_aligned'],
      notes: 'Solar/Lunar dials. Align Solar to PI/2, Lunar to 0.'
    }
  ],
  questStages: [
    { flag: 'q_act4_paititi_entered', trigger: 'pa_outer_terraces' },
    { flag: 'q_act4_sanctuary_confrontation', trigger: 'pa_sanctuary_confrontation' },
    { flag: 'q_act4_observatory_aligned', trigger: 'pa_grand_observatory' }
  ],
  shots: [
    // p11 defect ⑥: these camera/lookAt heights were authored as if the
    // paititi plateau were at y≈0–100; the actual terrain samples 253–688 m
    // (probe: scripts/p11_height_probe.cjs). Every pa_ shot rendered
    // underground — a pure fog frame — since the shot table landed. Heights
    // re-anchored to the measured terrain (camera = terrain + 25–45 m).
    { id: 'pa_overview', camera: { x: 1000, y: 440, z: -200 }, lookAt: { x: 1100, y: 490, z: -50 } },
    { id: 'pa_outer_terraces', camera: { x: 800, y: 278, z: -100 }, lookAt: { x: 900, y: 345, z: -100 } },
    { id: 'pa_plaza_of_sun', camera: { x: 1045, y: 498, z: -50 }, lookAt: { x: 1100, y: 491, z: -50 } },
    { id: 'pa_sanctuary', camera: { x: 1255, y: 698, z: 50 }, lookAt: { x: 1300, y: 694, z: 50 } },
    { id: 'pa_aqueduct_line', camera: { x: 1150, y: 578, z: 0 }, lookAt: { x: 1200, y: 572, z: 0 } }
  ],
  build(api: RegionBuildAPI) {
    const paititiGroup = new THREE.Group();
    paititiGroup.name = 'PaititiGroup';

    // Base materials
    const stoneMaterial = ashlarLight();
    const goldMaterial = gold();
    const bronzeMaterial = bronze();
    const pavingMaterial = plazaWorn(); // §2.5 Plaza stone #9A917E, worn
    const greenMaterial = ashlarLight();
    greenMaterial.color.setHex(0x2E5A2E); // §2.5 encroaching green (per-instance recolor)

    const caps: RenderCaps = {
      isWebGPU: typeof window !== 'undefined' && window.__rendererType === 'webgpu',
      tier: 'MEDIUM',
      maxAnisotropy: 4
    };

    // 1. The Outer Terraces
    const terracesCenter = { x: 900, z: -100 };
    this.pois[0].position.y = api.terrainHeight(terracesCenter.x, terracesCenter.z);
    const terracesGroup = new THREE.Group();
    const numTerraces = 5;
    for (let i = 0; i < numTerraces; i++) {
      const radius = 60 - i * 10;
      const tHeight = api.terrainHeight(terracesCenter.x, terracesCenter.z) + (i * 5);
      
      const terraceGeo = new THREE.CylinderGeometry(radius, radius + 5, 5, 32, 1, false, 0, Math.PI);
      const terraceMesh = new THREE.Mesh(terraceGeo, stoneMaterial);
      terraceMesh.position.set(terracesCenter.x, tHeight, terracesCenter.z);
      terraceMesh.rotation.y = Math.PI / 2;
      terraceMesh.castShadow = true;
      terraceMesh.receiveShadow = true;
      terracesGroup.add(terraceMesh);
    }
    paititiGroup.add(terracesGroup);

    // 2. The Plaza of the Sun (Imperial Inca Ceremonial Center)
    const plazaCenter = { x: 1100, z: -50 };
    const plazaHeight = Math.max(api.terrainHeight(plazaCenter.x, plazaCenter.z), 100);
    this.pois[1].position.y = plazaHeight;
    const plazaGroup = new THREE.Group();

    // 2a. 3-Tiered Monumental Chakana Platform
    const chakanaPlatform = createChakanaPlazaPlatform({
      radius: 44,
      stoneMat: stoneMaterial,
      pavingMat: pavingMaterial,
    });
    chakanaPlatform.position.set(plazaCenter.x, plazaHeight, plazaCenter.z);
    plazaGroup.add(chakanaPlatform);

    // 2b. Monumental Colonnade Gallery (Kallanka stone pillars & entablature beams)
    const colonnade = createPlazaColonnade({
      radius: 34,
      numPillars: 12,
      height: 7.2,
      stoneMat: stoneMaterial,
    });
    colonnade.position.set(plazaCenter.x, plazaHeight + 1.6, plazaCenter.z);
    plazaGroup.add(colonnade);

    // 2c. Central Intihuatana Solar Altar & Worked Gold Punchao Disc
    const intihuatana = createIntihuatanaAltar({
      stoneMat: stoneMaterial,
      goldMat: goldMaterial,
      bronzeMat: bronzeMaterial,
    });
    intihuatana.position.set(plazaCenter.x, plazaHeight + 3.7, plazaCenter.z);
    plazaGroup.add(intihuatana);

    // 2d. 4 Monumental Trapezoidal Portals at the Cardinal Entrances (N, S, E, W)
    for (let i = 0; i < 4; i++) {
      const angle = i * (Math.PI / 2);
      const portal = createTrapezoidalPortal({
        widthBottom: 3.6,
        height: 5.6,
        depth: 1.6,
        material: stoneMaterial,
      });
      portal.position.set(
        plazaCenter.x + Math.sin(angle) * 42,
        plazaHeight + 0.2,
        plazaCenter.z + Math.cos(angle) * 42
      );
      portal.rotation.y = angle + Math.PI;
      plazaGroup.add(portal);
    }

    // 2e. §2.5 encroaching green — vegetation at the city's EDGES only (the city
    // itself is maintained stone). Low mounds on the outer terrace rim.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3;
      const mound = new THREE.Mesh(new THREE.SphereGeometry(2.5 + (i % 3), 8, 6), greenMaterial);
      mound.position.set(plazaCenter.x + Math.cos(a) * 46, plazaHeight - 0.4, plazaCenter.z + Math.sin(a) * 50);
      mound.scale.y = 0.45;
      plazaGroup.add(mound);
    }

    paititiGroup.add(plazaGroup);

    // 3. The Sanctuary (Imperial Sun Temple / Torreón)
    const sanctuaryCenter = { x: 1300, z: 50 };
    const sanctuaryHeight = Math.max(api.terrainHeight(sanctuaryCenter.x, sanctuaryCenter.z), 150);
    this.pois[2].position.y = sanctuaryHeight;
    this.encounters[0].position.y = sanctuaryHeight;
    this.encounters[1].position.y = sanctuaryHeight;
    const sanctuaryGroup = new THREE.Group();

    // 3a. Parabolic Imperial Ashlar Torreón Temple with Trapezoidal Solar Windows & Entrance Portal
    const torreon = createTorreonSunTemple({
      radius: 25,
      height: 18,
      stoneMat: stoneMaterial,
      weatheredMat: pavingMaterial,
    });
    torreon.position.set(sanctuaryCenter.x, sanctuaryHeight, sanctuaryCenter.z);
    sanctuaryGroup.add(torreon);

    // 3b. Inner Colonnade & Sol Negro Explosive Charges
    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.4, 18, 12);
    const chargeMaterial = bronze();
    const charges: THREE.Mesh[] = [];

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const px = sanctuaryCenter.x + Math.cos(angle) * 16;
      const pz = sanctuaryCenter.z + Math.sin(angle) * 16;

      const pillar = new THREE.Mesh(pillarGeo, stoneMaterial);
      pillar.position.set(px, sanctuaryHeight + 9, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      sanctuaryGroup.add(pillar);

      const chargeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const charge = new THREE.Mesh(chargeGeo, chargeMaterial);
      charge.position.set(px - 1, sanctuaryHeight + 4, pz);
      charge.visible = false;
      charges.push(charge);
      sanctuaryGroup.add(charge);
    }

    // 3c. Central Stepped Solstice Mechanism
    const mechanismGroup = new THREE.Group();
    mechanismGroup.position.set(sanctuaryCenter.x, sanctuaryHeight + 2, sanctuaryCenter.z);

    const baseGeo = new THREE.CylinderGeometry(5, 6, 2, 16);
    const baseMesh = new THREE.Mesh(baseGeo, bronzeMaterial);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    mechanismGroup.add(baseMesh);

    const solarDialGeo = new THREE.RingGeometry(3, 4, 32);
    const solarDial = new THREE.Mesh(solarDialGeo, goldMaterial);
    solarDial.rotation.x = -Math.PI / 2;
    solarDial.position.y = 1.1;
    mechanismGroup.add(solarDial);

    const lunarDialGeo = new THREE.RingGeometry(4.5, 5.5, 32);
    const lunarDial = new THREE.Mesh(lunarDialGeo, stoneMaterial);
    lunarDial.rotation.x = -Math.PI / 2;
    lunarDial.position.y = 1.05;
    mechanismGroup.add(lunarDial);

    sanctuaryGroup.add(mechanismGroup);
    paititiGroup.add(sanctuaryGroup);

    // 4. The Aqueduct Line (Stone-lined gravity conduit)
    const aqueductGroup = new THREE.Group();
    const aquaductLength = 200;
    const channelX = 1200;
    const channelZ = 0;
    const channelY = api.terrainHeight(channelX, channelZ) + 5;
    this.pois[3].position.y = channelY;

    // Stone trough base and retaining walls
    const channelBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, aquaductLength), stoneMaterial);
    channelBase.position.set(channelX, channelY, channelZ);
    channelBase.rotation.y = Math.PI / 4;
    channelBase.castShadow = true;
    channelBase.receiveShadow = true;
    aqueductGroup.add(channelBase);

    // Stone support piers along the aqueduct run
    const pierGeo = new THREE.BoxGeometry(2.4, 12, 2.4);
    for (let p = -aquaductLength / 2 + 15; p <= aquaductLength / 2 - 15; p += 25) {
      const pier = new THREE.Mesh(pierGeo, stoneMaterial);
      const rad = Math.PI / 4;
      const px = channelX - Math.sin(rad) * p;
      const pz = channelZ + Math.cos(rad) * p;
      pier.position.set(px, channelY - 5, pz);
      pier.rotation.y = Math.PI / 4;
      pier.castShadow = true;
      pier.receiveShadow = true;
      aqueductGroup.add(pier);
    }

    const waterSurface = createWaterSurface(
      api.scene,
      { color: 0x2E5A6E, roughness: 0.15, opacity: 1.0, flowSpeed: 0.6, flowDir: [0, 1], foamAtEdges: false },
      2.6,
      aquaductLength,
      caps
    );
    const waterPlane = waterSurface.mesh;
    waterPlane.position.set(channelX, channelY + 0.8, channelZ);
    waterPlane.rotation.z = Math.PI / 4;
    aqueductGroup.add(waterPlane);

    paititiGroup.add(aqueductGroup);
    api.scene.add(paititiGroup);

    // Encounter and Quest Logic
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let timerCount = 60; // seconds
    let puzzleActive = false;
    let selectedDial: 'solar' | 'lunar' = 'solar';


    const checkPlayerProximity = () => {
    };


    const mockPlayerEnterSanctuary = () => {
      if (!api.flags?.has('q_act4_sanctuary_confrontation')) {
        api.flags?.set('q_act4_sanctuary_confrontation');
        charges.forEach(c => c.visible = true);
        puzzleActive = true;

        timerInterval = setInterval(() => {
          timerCount--;
          const blink = timerCount % 2 === 0;

          charges.forEach(c => {
            if (c.material instanceof THREE.MeshStandardMaterial) {
              c.material.color.setHex(blink ? 0xff0000 : 0x330000);
            }
          });

          if (timerCount <= 0) {
            resetPuzzle();
          }
        }, 1000);
      }
    };

    const resetPuzzle = () => {
      if (timerInterval) clearInterval(timerInterval);
      timerCount = 60;
      puzzleActive = false;
      charges.forEach(c => c.visible = false);
      solarDial.rotation.z = 0;
      lunarDial.rotation.z = 0;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!puzzleActive) return;

      const rotateStep = Math.PI / 8;
      if (e.key === '1') {
        selectedDial = 'solar';
      } else if (e.key === '2') {
        selectedDial = 'lunar';
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedDial === 'solar') {
          solarDial.rotation.z += rotateStep;
        } else {
          lunarDial.rotation.z += rotateStep;
        }
        checkAlignment();
      }
    };

    const checkAlignment = () => {
      const solarRot = Math.abs(solarDial.rotation.z % (Math.PI * 2));
      const lunarRot = Math.abs(lunarDial.rotation.z % (Math.PI * 2));

      const isSolarAligned = Math.abs(solarRot - Math.PI / 2) < 0.1;
      const isLunarAligned = lunarRot < 0.1 || Math.abs(lunarRot - Math.PI * 2) < 0.1;

      if (isSolarAligned && isLunarAligned) {
        if (timerInterval) clearInterval(timerInterval);
        charges.forEach(c => c.visible = false);
        puzzleActive = false;

        api.flags?.set('q_act4_observatory_aligned');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    api.onEnterRegion(() => {
      api.flags?.set('q_act4_paititi_entered');
    });

    api.onExitRegion(() => {
      if (timerInterval) clearInterval(timerInterval);
      window.removeEventListener('keydown', handleKeyDown);
    });
  }
};
