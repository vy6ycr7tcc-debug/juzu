import './gpu/compat';
import * as THREE from 'three/webgpu';
import { LightRig } from './gpu/lightRig';
import { Post } from './gpu/post';
import { juzuFogNode, gpuUniforms } from './gpu/tsl';
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
import { HUD } from './ui/hud';
import { activeToD, setTimeOfDay, type TimeOfDay } from './world/fog';
import { offlineManager } from './pwa/offline';
import { solidity } from './world/solidity';

declare global {
  interface Window {
    __juzuReady?: boolean;
    __shotReady?: boolean;
    __juzuEngine?: any;
    __juzuOffline?: any;
  }
}

async function bootJuzu() {
  // 1. URL Parameter Parsing
  const urlParams = new URLSearchParams(location.search);
  const shotParam = urlParams.get('shot');
  const todParam = (urlParams.get('tod') || 'day') as TimeOfDay;
  const regionParam = urlParams.get('region') || 'cloudForest';
  const forceWebGL = urlParams.has('webgl');

  if (todParam) {
    setTimeOfDay(todParam);
  }

  // 2. Canvas & WebGPURenderer Bootstrap
  let canvas = document.getElementById('gl') as HTMLCanvasElement;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gl';
    document.body.appendChild(canvas);
  }

  const renderer = new THREE.WebGPURenderer({
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

  // 3. Scene, Camera, and Fog
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.15, 5000);
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
  lightRig.setShadowSize(currentTier.shadow);
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

  // 8. Player: Controller, Naira Model, FollowCamera
  let startPos = SPAWN.clone();
  if (regionParam === 'highSierra') startPos.set(120, standAt(120, -170), -170);
  else if (regionParam === 'jungleLowlands') startPos.set(-180, 2.3, 126);
  else if (regionParam === 'paititi') startPos.set(200, standAt(200, 168) + 0.9, 168);

  const controller = new Controller(startPos);
  const naira = new Naira(scene);
  const followCamera = new FollowCamera(camera);
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
      if (r === 'highSierra') target.set(120, standAt(120, -170), -170);
      else if (r === 'jungleLowlands') target.set(-180, 2.3, 126);
      else if (r === 'paititi') target.set(200, standAt(200, 168) + 0.9, 168);

      controller.teleport(target);
      followCamera.teleport(target);
    },
    onBeginExpedition: () => {
      // Pointer lock on canvas click during gameplay
      surface.addEventListener('click', () => {
        if (!document.pointerLockElement) {
          surface.requestPointerLock?.();
        }
      });
    },
    onToggleTimeOfDay: (tod) => {
      setTimeOfDay(tod);
      lightRig.applyToD(tod);
    },
  });

  // Handle Shot Mode
  if (shotParam) {
    hud.closeTitle();
    if (shotParam === 'close') {
      followCamera.dist = 2.4;
      followCamera.pitch = 0.08;
    } else if (shotParam === 'vista') {
      followCamera.dist = 14.0;
      followCamera.pitch = 0.38;
    }
  }

  // 11. Resize Handler
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, currentTier.dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
    post.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  onResize();

  // 12. Main Animation Loop
  let lastTime = performance.now();
  let totalTime = 0;
  let frameCount = 0;

  function animate(now: number) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    totalTime += dt;
    frameCount++;

    // Input & Camera
    const look = input.resetLook();
    followCamera.update(controller.pos, look, dt);
    hud.updateCompass(followCamera.yaw);

    // Solidity BVH update for nearby solid stone geometry
    solidity.update(scene, controller.pos, dt);

    // Controller & Character
    controller.update(input.move, input.boost, input.jump, followCamera.yaw, dt);
    naira.update(controller, dt);

    // Footstep audio
    if (controller.grounded && controller.speed > 0.5) {
      if (Math.sin(totalTime * controller.speed * 2.8) > 0.95) {
        audio.playFootstep(controller.pos.y < 0.2 ? 'water' : 'grass');
      }
    }

    // World updates
    terrain.update(controller.pos);
    water.update(dt, totalTime);
    sky.update(controller.pos, activeToD);
    foliage.update(totalTime);
    lightRig.update(controller.pos, camera.position);

    // Context hint check near Stele at (3.5, 14)
    const distToStele = Math.hypot(controller.pos.x - 3.5, controller.pos.z - 14);
    if (distToStele < 3.2) {
      hud.setInteractHint('[E] Read Carved Inca Stele');
      if (input.interact) {
        audio.playQuenaNote(440, 1.2);
        hud.setObjective('The stele reveals: "Follow the mountain river to the High Sierra Intihuatana."');
      }
    } else {
      hud.setInteractHint(null);
    }

    // Render via TSL Post Pipeline
    gpuUniforms.player.value.copy(controller.pos);
    gpuUniforms.time.value = totalTime;
    post.render();

    // Signal ready for Playwright shots
    const loadingScreen = document.getElementById('juzu-loading-screen');
    const loadingDismissed = !loadingScreen || loadingScreen.style.display === 'none';
    if (frameCount > 30 && naira.modelRoot && loadingDismissed && !window.__shotReady) {
      window.__shotReady = true;
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
    lightRig,
    terrain,
    water,
    sky,
    foliage,
    hud,
  };
  window.__juzuOffline = offlineManager;
  offlineManager.register();
}

window.addEventListener('DOMContentLoaded', bootJuzu);
