import './gpu/compat';
import * as THREE from 'three/webgpu';
import { LightRig } from './gpu/lightRig';
import { Post } from './gpu/post';
import { juzuFogNode, gpuUniforms, gradeUniforms } from './gpu/tsl';
import { AdaptiveQuality, loadQualityConfig, MOBILE } from './core/quality';
import { Input } from './core/input';
import { AudioEngine } from './core/audio';
import { FollowCamera } from './player/camera';
import { Controller } from './player/controller';
import { Naira } from './player/naira';
import { Terrain, SPAWN, standAt } from './world/terrain';
import { Water } from './world/water';
import { Sky } from './world/sky';
import { Foliage } from './world/foliage';
import { CloudForestRegion } from './world/regions/cloudForest';
import { HighSierraRegion } from './world/regions/highSierra';
import { JungleLowlandsRegion } from './world/regions/jungleLowlands';
import { PaititiRegion } from './world/regions/paititi';
import { GrappleManager } from './player/grapple';
import { RoutesManager } from './world/routes';
import { HUD } from './ui/hud';
import { activeToD, setTimeOfDay, type TimeOfDay } from './world/fog';
import { offlineManager } from './pwa/offline';
import { solidity } from './world/solidity';
import { WeaponManager } from './player/weapon';
import { Minimap } from './ui/minimap';
import { ExpeditionMenu } from './ui/expeditionMenu';
import { TouchControls } from './ui/touchControls';

declare global {
  interface Window {
    __juzuReady?: boolean;
    __juzuSceneReady?: boolean;
    __shotReady?: boolean;
    __juzuEngine?: any;
    __juzuOffline?: any;
    __juzuDismissLoading?: () => void;
  }
}

async function bootJuzu() {
  // 1. URL Parameter Parsing
  const urlParams = new URLSearchParams(location.search);
  const shotParam = urlParams.get('shot');
  const todParam = (urlParams.get('tod') || 'day') as TimeOfDay;
  const regionParam = urlParams.get('region') || 'cloudForest';
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const forceWebGL = urlParams.has('webgl') || isIOS || isSafari || !navigator.gpu;

  if (todParam) {
    setTimeOfDay(todParam);
  }

  // 2. Canvas & WebGPURenderer Bootstrap with WebGL2 Fallback Guard
  let canvas = document.getElementById('gl') as HTMLCanvasElement;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gl';
    document.body.appendChild(canvas);
  }

  let renderer: THREE.WebGPURenderer;
  try {
    renderer = new THREE.WebGPURenderer({
      canvas,
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      forceWebGL,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.info.autoReset = false;
    await renderer.init();
  } catch (err) {
    console.warn('[Juzu] Primary WebGPU init failed, engaging WebGL2 fallback:', err);
    renderer = new THREE.WebGPURenderer({
      canvas,
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      forceWebGL: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.info.autoReset = false;
    await renderer.init();
  }

  // 3. Scene, Camera, and Fog
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.15, 5000);
  scene.fogNode = juzuFogNode();

  // 4. Quality & Post Processing
  await loadQualityConfig();
  const post = new Post(renderer, scene, camera);
  const quality = new AdaptiveQuality((tier) => {
    post.rebuild({
      ao: tier.ao,
      bloom: tier.bloom,
      aa: MOBILE ? 'none' : 'smaa',
    });
  });
  const currentTier = quality.current;

  post.rebuild({
    ao: currentTier.ao,
    bloom: currentTier.bloom,
    aa: MOBILE ? 'none' : 'smaa',
  });

  // 5. Light Rig & Sky
  const lightRig = new LightRig(scene);
  lightRig.setShadowSize(MOBILE ? Math.min(currentTier.shadow, 1024) : currentTier.shadow);
  const sky = new Sky(scene);

  // 6. World Systems: Terrain, Water, Foliage
  const terrain = new Terrain(scene);
  const water = new Water(scene);
  const foliage = new Foliage(scene);

  // 7. World Regions
  const cloudForest = new CloudForestRegion(scene);
  const highSierra = new HighSierraRegion(scene);
  const jungleLowlands = new JungleLowlandsRegion(scene);
  const paititi = new PaititiRegion(scene);
  if (!MOBILE && regionParam === 'highSierra') {
    highSierra.loadScannedAssets();
  }
  const grapple = new GrappleManager(scene);
  const routes = new RoutesManager(scene, grapple);

  const grappleRings = grapple.points
    .map((p) => p.ringMesh)
    .filter((m): m is THREE.Mesh => !!m);

  const allInteractables: THREE.Mesh[] = [
    ...cloudForest.interactables,
    ...highSierra.interactables,
    ...jungleLowlands.interactables,
    ...paititi.interactables,
    ...grappleRings,
  ];

  // Survival Instinct Objective Beacon Column (Additive volumetric light shaft)
  const beaconGeom = new THREE.CylinderGeometry(0.12, 0.55, 38, 16, 1, true);
  beaconGeom.translate(0, 19, 0);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd25a,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const instinctBeacon = new THREE.Mesh(beaconGeom, beaconMat);
  instinctBeacon.visible = false;
  scene.add(instinctBeacon);

  // 8. Player: Controller, Naira Model, FollowCamera
  let startPos = SPAWN.clone();
  let startHeading = Math.PI;
  let startCamYaw = 0;
  if (regionParam === 'highSierra') {
    startPos.set(120, standAt(120, -154), -154);
    startHeading = Math.PI;
    startCamYaw = 0;
  } else if (regionParam === 'jungleLowlands') {
    startPos.set(-180, standAt(-180, 126.5) + 0.5, 126.5);
    startHeading = 0;
    startCamYaw = Math.PI;
  } else if (regionParam === 'paititi') {
    startPos.set(200, standAt(200, 166) + 0.8, 166);
    startHeading = 0;
    startCamYaw = Math.PI;
  }

  const controller = new Controller(startPos);
  controller.heading = startHeading;
  const naira = new Naira(scene);
  const followCamera = new FollowCamera(camera);
  followCamera.yaw = startCamYaw;
  followCamera.teleport(startPos);

  // 9. Input & Audio
  let surface = document.getElementById('surface') as HTMLElement;
  if (!surface) {
    surface = document.createElement('div');
    surface.id = 'surface';
    document.body.appendChild(surface);
  }

  const joyEl = document.getElementById('joy') || undefined;
  const knobEl = document.getElementById('knob') || undefined;
  const actBtn = document.getElementById('act') || undefined;

  const input = new Input(surface, joyEl, knobEl, actBtn);
  const audio = new AudioEngine();

  // 10. UI & HUD
  const hud = new HUD(audio, followCamera, {
    onSelectRegion: (r) => {
      let target = SPAWN.clone();
      if (r === 'highSierra') {
        highSierra.loadScannedAssets();
        target.set(120, standAt(120, -154), -154);
        controller.heading = Math.PI;
        followCamera.yaw = 0;
        hud.setObjective('Align the Intihuatana Gnomon Dial [E] with the Chakana Gate.');
      } else if (r === 'jungleLowlands') {
        target.set(-180, standAt(-180, 126.5) + 0.5, 126.5);
        controller.heading = 0;
        followCamera.yaw = Math.PI;
        hud.setObjective('Turn the Ancient Bronze Sluice Wheel on the Quay [E] to lower the Cenote.');
      } else if (r === 'paititi') {
        target.set(200, standAt(200, 166) + 0.8, 166);
        controller.heading = 0;
        followCamera.yaw = Math.PI;
        hud.setObjective('Approach the Golden Sun Disk Dais [E] to awaken the Plaza of the Sun.');
      } else {
        controller.heading = Math.PI;
        followCamera.yaw = 0;
        hud.setObjective('Align the bronze Inti sun-mirror on the south cliff [E] or cross the hanging bridge to the North Sanctuary.');
      }

      controller.teleport(target);
      followCamera.teleport(target);
    },
    onBeginExpedition: () => {
      hud.closeTitle();
      if (typeof (window as any).__juzuDismissLoading === 'function') {
        (window as any).__juzuDismissLoading();
      }
      surface.addEventListener('click', () => {
        if (!MOBILE && !document.pointerLockElement && !hud.isJournalOpen) {
          try {
            surface.requestPointerLock?.();
          } catch {}
        }
      });
    },
    onToggleTimeOfDay: (tod) => {
      setTimeOfDay(tod);
      lightRig.applyToD(tod);
    },
  });

  if (regionParam === 'highSierra') {
    hud.setObjective('Align the Intihuatana Gnomon Dial [E] with the Chakana Gate.');
  } else if (regionParam === 'jungleLowlands') {
    hud.setObjective('Turn the Ancient Bronze Sluice Wheel on the Quay [E] to lower the Cenote.');
  } else if (regionParam === 'paititi') {
    hud.setObjective('Approach the Golden Sun Disk Dais [E] to awaken the Plaza of the Sun.');
  }

  // 10.1 Expedition Weapon, World Map, Inventory, and Mobile Touch Controls
  const weapon = new WeaponManager(scene, naira, audio, camera);

  const expeditionMenu = new ExpeditionMenu({
    audio,
    weapon,
    onFastTravel: (target) => {
      controller.teleport(target);
      followCamera.teleport(target);
    },
  });

  const minimap = new Minimap({
    onOpenWorldMap: () => expeditionMenu.open('map'),
  });

  const collidables: THREE.Object3D[] = [
    terrain.group,
    cloudForest.group,
    highSierra.group,
    jungleLowlands.group,
    paititi.group,
  ];

  const touchControls = new TouchControls({
    input,
    weapon,
    expeditionMenu,
    onFire: () => weapon.fire(collidables),
    onGrapple: () => {
      const reachableAnchor = grapple.findReachableAnchor(
        controller.pos,
        followCamera.yaw,
        !controller.grounded
      );
      if (reachableAnchor) {
        grapple.attach(reachableAnchor.point, controller.pos, controller.vel, followCamera.yaw);
        controller.startGrapple(reachableAnchor.point.pos);
        audio.playGrappleThrow();
        audio.playGrappleLatch();
      }
    },
    onInteract: () => input.triggerVirtualInteract(),
  });

  // Dismiss legacy HTML boot splash so only the interactive HUD title screen is shown
  const bootSplash = document.getElementById('title');
  if (bootSplash) {
    bootSplash.classList.add('hide');
    setTimeout(() => {
      bootSplash.style.display = 'none';
    }, 600);
  }

  // Handle Deep-Linked Region or Shot Mode
  if (urlParams.has('region') || urlParams.has('play') || shotParam) {
    hud.closeTitle();
  }
  if (shotParam) {
    if (shotParam === 'close') {
      controller.heading = 0.24;
      followCamera.dist = 1.95;
      followCamera.pitch = 0.08;
      followCamera.shoulderOffset = 0.0;
    } else if (shotParam === 'vista') {
      followCamera.dist = 11.5;
      followCamera.pitch = 0.34;
    } else if (shotParam === 'waterfall') {
      const px = 6.0;
      const pz = -16.0;
      controller.pos.set(px, standAt(px, pz) + 0.1, pz);
      controller.heading = Math.PI - 0.70;
      followCamera.yaw = -0.70;
      followCamera.pitch = -0.10;
      followCamera.dist = 5.2;
      followCamera.shoulderOffset = 0.38;
      followCamera.teleport(controller.pos);
    } else if (shotParam === 'gorge') {
      const px = 0.0;
      const pz = 1.0;
      controller.pos.set(px, standAt(px, pz) + 0.1, pz);
      controller.heading = Math.PI;
      followCamera.yaw = 0.0;
      followCamera.pitch = -0.14;
      followCamera.dist = 5.2;
      followCamera.shoulderOffset = 0.28;
      followCamera.teleport(controller.pos);
    } else if (shotParam === 'sanctuary') {
      const px = 0.0;
      const pz = -36.5;
      controller.pos.set(px, standAt(px, pz) + 0.1, pz);
      controller.heading = Math.PI;
      followCamera.yaw = 0.0;
      followCamera.pitch = 0.04;
      followCamera.dist = 5.2;
      followCamera.shoulderOffset = 0.46;
      followCamera.teleport(controller.pos);
    } else if (shotParam === 'botanical') {
      const px = 2.5;
      const pz = 5.0;
      controller.pos.set(px, standAt(px, pz) + 0.1, pz);
      controller.heading = Math.PI;
      followCamera.yaw = 0.0;
      followCamera.pitch = -0.06;
      followCamera.dist = 5.4;
      followCamera.shoulderOffset = 0.35;
      followCamera.teleport(controller.pos);
    }
  }

  // Time-of-Day quick hotkeys (1 = Dawn, 2 = Day, 3 = Dusk, 4 = Night)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') {
      setTimeOfDay('dawn');
      lightRig.applyToD('dawn');
    } else if (e.code === 'Digit2') {
      setTimeOfDay('day');
      lightRig.applyToD('day');
    } else if (e.code === 'Digit3') {
      setTimeOfDay('dusk');
      lightRig.applyToD('dusk');
    } else if (e.code === 'Digit4') {
      setTimeOfDay('night');
      lightRig.applyToD('night');
    }
  });

  // 11. Resize Handler
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxDpr = MOBILE ? 1.75 : 2.5;
    const dpr = Math.min(window.devicePixelRatio, Math.min(currentTier.dpr, maxDpr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
    post.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  onResize();

  // 12. Gameplay Puzzle & Survival Instinct State
  let instinctTimer = 0;
  let lastInstinctKey = false;
  let lastJournalKey = false;
  let lastInteractKey = false;
  let stepAccumulator = 0;

  let mirrorSolved = false;
  let steleSolved = false;
  let gnomonSolved = false;
  let sluiceSolved = false;
  let paititiSolved = false;

  const activeBeaconPos = new THREE.Vector3(0, 4.5, -44);

  // 13. Main Animation Loop
  let lastTime = performance.now();
  let totalTime = 0;
  let frameCount = 0;

  function animate(now: number) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    totalTime += dt;
    frameCount++;

    try {
      // Toggle Field Journal [Tab / J]
    const jKey = input.journal;
    if (jKey && !lastJournalKey && !hud.isTitleOpen) {
      hud.toggleJournal();
    }
    lastJournalKey = jKey;

    // Trigger Tomb Raider Survival Instinct [Q]
    const qKey = input.instinct;
    if (qKey && !lastInstinctKey && !hud.isTitleOpen) {
      instinctTimer = 4.0;
      audio.playQuenaNote(587.33, 1.5);
      audio.playCajon(0.35);
    }
    lastInstinctKey = qKey;

    if (instinctTimer > 0) {
      instinctTimer = Math.max(0, instinctTimer - dt);
      const pulse = Math.sin(totalTime * 6.0) * 0.25 + 0.55;
      const fade = Math.min(1, instinctTimer * 1.5);
      hud.setInstinctActive(true);
      gradeUniforms.sat.value = THREE.MathUtils.lerp(1.0, 0.72, fade);

      instinctBeacon.visible = true;
      instinctBeacon.position.copy(activeBeaconPos);
      beaconMat.opacity = 0.28 * pulse * fade;

      for (const mesh of allInteractables) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.setHex(0xd4a017);
          mat.emissiveIntensity = 0.65 * pulse * fade;
        }
      }
    } else {
      hud.setInstinctActive(false);
      gradeUniforms.sat.value = 1.0;
      instinctBeacon.visible = false;
      for (const mesh of allInteractables) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive && mat.emissiveIntensity < 0.5) {
          mat.emissiveIntensity = 0;
        }
      }
    }

    // Solidity BVH update for nearby solid stone geometry
    solidity.update(scene, controller.pos, dt);

    // Grappling Hook Anchor Detection & Controls
    const reachableAnchor = grapple.findReachableAnchor(
      controller.pos,
      followCamera.yaw,
      !controller.grounded
    );

    const grappleInputTriggered = input.grapple;
    const midAirJumpGrapple = !controller.grounded && input.jump && controller.vy < 2.5;

    if (!controller.grappling) {
      if (reachableAnchor) {
        hud.setGrapplePrompt(true, `[F / Space] Swing · ${reachableAnchor.point.name}`);
        if (grappleInputTriggered || midAirJumpGrapple) {
          grapple.attach(reachableAnchor.point, controller.pos, controller.vel, followCamera.yaw);
          controller.startGrapple(reachableAnchor.point.pos);
          audio.playGrappleThrow();
          audio.playGrappleLatch();
        }
      } else {
        hud.setGrapplePrompt(false);
      }
    } else {
      hud.setGrapplePrompt(true, '[Space / F] Release & Leap');
      // Update pendulum kinematics
      const gResult = grapple.update(dt, controller.pos, input.move, followCamera.yaw);
      controller.pos.copy(gResult.pos);
      controller.vel.copy(gResult.vel);

      // Dynamic braided rope update from Naira's hand to the anchor ring
      const handPos = naira.getRightHandWorldPosition(new THREE.Vector3());
      grapple.updateRopeVisual(handPos);

      // Detach check (Space or F releases with tangential launch impulse)
      if (input.jump || grappleInputTriggered) {
        const launchVel = grapple.detach();
        controller.endGrapple(launchVel);
        audio.playGrappleRelease();
        audio.playQuenaNote(659.25, 0.45);
      }
    }

    if (!controller.grappling && grapple.attached) {
      grapple.detach();
    }

    // Controller & Character
    controller.update(
      input.move,
      input.boost,
      input.jump,
      followCamera.yaw,
      dt,
      input.crouch
    );
    if (controller.justLanded) {
      followCamera.triggerLandingDip(controller.landingImpact);
      audio.playFootstep(controller.getSurfaceType());
    }
    naira.update(controller, dt, followCamera.yaw);

    // Input & Over-the-Shoulder Camera
    const wheel = input.getAndResetWheel();
    if (wheel !== 0) {
      followCamera.adjustDistance(wheel * 0.0035);
    }
    // Weapon Aim & Fire inputs
    if (input.aim) {
      weapon.toggleAim();
    }
    if (input.shoot) {
      weapon.fire(collidables);
    }
    weapon.update(dt);
    minimap.update(controller.pos, controller.heading);
    expeditionMenu.update(controller.pos, controller.heading);

    // Lazy-load High Sierra heavy scanned assets (trees & rocks) if approaching region on desktop
    if (!MOBILE && Math.hypot(controller.pos.x - 120, controller.pos.z - (-165)) < 160) {
      highSierra.loadScannedAssets();
    }

    const look = input.resetLook();
    followCamera.update(
      controller.pos,
      look,
      dt,
      controller.pose === 'run',
      controller.crouching,
      instinctTimer > 0,
      controller.vel,
      controller.grounded,
      weapon.isAiming
    );
    hud.updateCompass(followCamera.yaw, controller.pos, activeBeaconPos);

    // Surface-aware Footstep Audio
    if (controller.grounded && controller.speed > 0.4) {
      stepAccumulator += controller.speed * dt * 0.52;
      if (stepAccumulator >= 1.0) {
        stepAccumulator %= 1.0;
        audio.playFootstep(controller.getSurfaceType());
      }
    } else {
      stepAccumulator = 0;
    }

    // World updates
    terrain.update(controller.pos);
    water.update(dt, totalTime);
    sky.update(controller.pos, activeToD);
    foliage.update(totalTime);
    cloudForest.update(totalTime);
    jungleLowlands.update(totalTime);
    paititi.update(totalTime);
    lightRig.update(controller.pos, camera.position);

    // Interactive Archaeological Mechanisms & Stelae across the 4 Regions
    const isInteract = input.interact;
    const eTriggered = isInteract && !lastInteractKey;
    lastInteractKey = isInteract;

    const distMirror = Math.hypot(controller.pos.x - (-4.2), controller.pos.z - 3.8);
    const distStele = Math.hypot(controller.pos.x - 0, controller.pos.z - (-44));
    const distGnomon = Math.hypot(controller.pos.x - 120, controller.pos.z - (-165));
    const distSluice = Math.hypot(controller.pos.x - (-180), controller.pos.z - 124.6);
    const distPaititi = Math.hypot(controller.pos.x - 200, controller.pos.z - 180);

    if (distMirror < 3.4 && !mirrorSolved) {
      activeBeaconPos.set(-4.2, standAt(-4.2, 3.8), 3.8);
      hud.setInteractHint('[E] Align Bronze Inti Sun-Mirror');
      if (eTriggered) {
        mirrorSolved = true;
        controller.triggerInteract(new THREE.Vector3(-4.2, controller.pos.y, 3.8));
        cloudForest.alignSunMirror();
        audio.playCajon(0.5);
        audio.playQuenaNote(523.25, 1.6);
        activeBeaconPos.set(0, standAt(0, -44), -44);
        hud.setObjective('The solar beam strikes the North Sanctuary across the gorge! Cross the hanging bridge and read the Inca Stele [E].');
        hud.addJournalEntry({
          id: 'mirror',
          title: 'Inti Solar Reflector',
          quechua: 'Intipawan · Path of the Sun',
          body: 'Rotating the polished bronze disc directed a concentrated beam of Andean sunlight across the Urubamba chasm, illuminating the gold Chakana seal on the far sanctuary stele.',
        });
      }
    } else if (distStele < 3.8) {
      hud.setInteractHint('[E] Decipher Carved Inca Stele');
      if (eTriggered) {
        steleSolved = true;
        controller.triggerInteract(new THREE.Vector3(0, controller.pos.y, -44));
        audio.playQuenaNote(659.25, 1.8);
        hud.setObjective('Stele deciphered! Open [Tab] Journal to review notes or ascend to the High Sierra Intihuatana.');
        hud.addJournalEntry({
          id: 'stele',
          title: 'Sanctuary Stele of the Cloud Forest',
          quechua: 'Chakana Unanchaq · The Southern Cross Marker',
          body: 'The relief carvings record the royal pilgrimage route from the Cloud Forest suspension bridge up to the High Sierra Intihuatana gnomon, through the Antisuyu cenote, to Golden Paititi.',
        });
      }
    } else if (distGnomon < 4.2 && !gnomonSolved) {
      activeBeaconPos.set(120, standAt(120, -165), -165);
      hud.setInteractHint('[E] Align Intihuatana Solstice Gnomon');
      if (eTriggered) {
        gnomonSolved = true;
        controller.triggerInteract(new THREE.Vector3(120, controller.pos.y, -165));
        highSierra.alignIntihuatanaDial();
        audio.playCajon(0.55);
        audio.playQuenaNote(587.33, 1.8);
        hud.setObjective('Solstice shadow aligned! The Chakana Gate keystone resonates with the high pass.');
        hud.addJournalEntry({
          id: 'intihuatana',
          title: 'Intihuatana — Hitching Post of the Sun',
          quechua: 'Inti Watana · Solar Observatory',
          body: 'At 4,100 meters elevation, the carved granite prism casts an exact equinox shadow toward the double-jamb Chakana Gate, marking the astronomical bearing toward Antisuyu.',
        });
      }
    } else if (distSluice < 3.8 && !sluiceSolved) {
      activeBeaconPos.set(-180, standAt(-180, 124), 124.6);
      hud.setInteractHint('[E] Turn Ancient Bronze Sluice Wheel');
      if (eTriggered) {
        sluiceSolved = true;
        controller.triggerInteract(new THREE.Vector3(-180, controller.pos.y, 124.6));
        jungleLowlands.openCenoteSluice();
        audio.playCajon(0.6);
        audio.playQuenaNote(493.88, 1.8);
        hud.setObjective('Subterranean sluice opened! The emerald cenote drains to reveal the Serpent Altar.');
        hud.addJournalEntry({
          id: 'cenote',
          title: 'Hydraulic Sluice of Antisuyu',
          quechua: 'Yaku Kamayuq · Master of Waters',
          body: 'Turning the bronze capstan on the river quay opened an underground stone culvert, lowering the cenote water table and exposing the submerged Serpent Sanctuary.',
        });
      }
    } else if (distPaititi < 6.0 && !paititiSolved) {
      activeBeaconPos.set(200, standAt(200, 180), 180);
      hud.setInteractHint('[E] Awaken Golden Sun Disk of Paititi');
      if (eTriggered) {
        paititiSolved = true;
        controller.triggerInteract(new THREE.Vector3(200, controller.pos.y, 180));
        paititi.awakenSunPlaza();
        audio.playCajon(0.65);
        audio.playQuenaNote(783.99, 2.2);
        hud.setObjective('Paititi Awakened! The aqueduct channels fill the Plaza of the Sun. Review your complete Field Journal [Tab].');
        hud.addJournalEntry({
          id: 'paititi',
          title: 'Paititi — The Plaza of the Sun',
          quechua: 'Quri Kancha · Enclosure of Gold',
          body: 'Mountain spring water now courses through the stone aqueduct into the Golden Sun Disk dais. We have found Paititi intact beneath the eastern cordillera.',
        });
      }
    } else {
      hud.setInteractHint(null);
      if (!steleSolved) {
        activeBeaconPos.set(
          mirrorSolved ? 0 : -4.2,
          standAt(mirrorSolved ? 0 : -4.2, mirrorSolved ? -44 : 3.8),
          mirrorSolved ? -44 : 3.8
        );
      }
    }

    // Render via TSL Post Pipeline
    gpuUniforms.player.value.copy(controller.pos);
    gpuUniforms.time.value = totalTime;
    post.render();

    // Signal ready and dismiss pre-bootstrap loading screen once 3D world is ready
    if (
      frameCount > 2 &&
      naira.isLoaded
    ) {
      window.__juzuSceneReady = true;
      if (typeof (window as any).__juzuDismissLoading === 'function') {
        (window as any).__juzuDismissLoading();
      }
      const loadingScreen = document.getElementById('juzu-loading-screen');
      const loadingDismissed =
        !loadingScreen ||
        loadingScreen.style.display === 'none' ||
        loadingScreen.style.opacity === '0';
      if (loadingDismissed && !window.__shotReady) {
        window.__shotReady = true;
      }
    }
  } catch (loopErr) {
    console.error('[Render Loop Notice]:', loopErr);
  }
}

  requestAnimationFrame(animate);

  // Global debug hooks
  window.__juzuReady = true;
  window.__juzuEngine = {
    renderer,
    scene,
    camera,
    controller,
    naira,
    followCamera,
    lightRig,
    terrain,
    water,
    sky,
    foliage,
    cloudForest,
    highSierra,
    jungleLowlands,
    paititi,
    grapple,
    routes,
    hud,
    input,
    weapon,
    minimap,
    expeditionMenu,
    touchControls,
    get puzzleState() {
      return { mirrorSolved, steleSolved, gnomonSolved, sluiceSolved, paititiSolved };
    },
  };
  window.__juzuOffline = offlineManager;
  offlineManager.register();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootJuzu);
} else {
  bootJuzu();
}
