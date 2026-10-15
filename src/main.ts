/**
 * Module: src/main.ts
 * Responsibility: Entry point orchestrating the JUZU Phase 1–5 clean-room build:
 * - Dual-path renderer (`WebGPURenderer` primary + `WebGLRenderer` WebGL2 fallback via `tsl.ts`)
 * - 4-Component Lighting Rig, ACES Filmic Post-Processing, and 13-Material PBR Library
 * - All 4 Playable Andean Regions (Cloud Forest Valleys, High Sierra, Jungle Lowlands, Paititi)
 * - Naira Quispe Rigged GLB Controller (`michelle.glb`), Tailored Field Kit, Physics Braid,
 *   and Over-the-Shoulder Camera
 * - Full Traversal (Climb, Zipline, Sprint, Crouch, Dodge, Fall Damage), Stealth & Bow Combat
 *   with Sol Negro operatives (`soldier.glb`), Inca Stonework Puzzles, Crafting, Quests,
 *   Journal (`[J]`), Menus (`[Esc]`), Photo Studio (`[P]`), and deterministic verification shots.
 * Depends on: three, src/core/*, src/gpu/*, src/world/*, src/character/*, src/gameplay/*, src/ui/*.
 * Exports: JuzuEngine, bootJuzu.
 */

import * as THREE from 'three';
import { QualityManager } from './core/quality';
import { PhysicsSystem } from './core/physics';
import { InputManager } from './core/input';
import { AudioManager } from './core/audio';
import { SaveData, SaveManager } from './core/save';
import { createRendererWithFallback, GpuContext } from './gpu/tsl';
import { LightRig } from './gpu/lightRig';
import { PostProcessor } from './gpu/post';
import { PbrMaterialLibrary } from './world/materials';
import { TerrainSystem } from './world/terrain';
import { SkySystem } from './world/sky';
import { WaterSystem } from './world/water';
import { FoliageSystem } from './world/foliage';
import { CloudForestRegion, InteractableTarget } from './world/regions/cloudForest';
import { HighSierraRegion } from './world/regions/highSierra';
import { JungleLowlandsRegion } from './world/regions/jungleLowlands';
import { PaititiRegion } from './world/regions/paititi';
import { LocomotionMode, NairaController } from './character/naira';
import { OverTheShoulderCamera } from './character/camera';
import { EnemyManager } from './character/enemies';
import { TraversalSystem } from './gameplay/traversal';
import { CombatSystem } from './gameplay/combat';
import { PuzzleSystem } from './gameplay/puzzles';
import { CraftingSystem } from './gameplay/crafting';
import { QuestManager } from './gameplay/quests';
import { ExpansionSystem } from './gameplay/expansion';
import { WeatherSystem } from './world/weather';
import { HudOverlay } from './ui/hud';
import { JournalOverlay } from './ui/journal';
import { MenusOverlay } from './ui/menus';
import { QuipuInspectOverlay } from './ui/quipuInspect';
import { TouchControlsOverlay } from './ui/touchControls';

declare global {
  interface Window {
    __juzuReady?: boolean;
    __juzuEngine?: JuzuEngine;
  }
}

const _aimDir = new THREE.Vector3();
const _arrowOrigin = new THREE.Vector3();

export class JuzuEngine {
  public readonly scene: THREE.Scene = new THREE.Scene();
  public readonly quality: QualityManager = new QualityManager();
  public readonly physics: PhysicsSystem = new PhysicsSystem();
  public readonly lightRig: LightRig = new LightRig(2048);
  public readonly materials: PbrMaterialLibrary = new PbrMaterialLibrary();
  public readonly sky: SkySystem = new SkySystem();
  public readonly terrain: TerrainSystem = new TerrainSystem();
  public readonly foliage: FoliageSystem = new FoliageSystem();
  public readonly water: WaterSystem = new WaterSystem();
  public readonly cloudForest: CloudForestRegion = new CloudForestRegion();
  public readonly highSierra: HighSierraRegion = new HighSierraRegion();
  public readonly jungleLowlands: JungleLowlandsRegion = new JungleLowlandsRegion();
  public readonly paititi: PaititiRegion = new PaititiRegion();
  public readonly naira: NairaController = new NairaController();
  public readonly cameraRig: OverTheShoulderCamera;
  public readonly enemies: EnemyManager = new EnemyManager();
  public readonly traversal: TraversalSystem = new TraversalSystem();
  public readonly combat: CombatSystem = new CombatSystem();
  public readonly puzzles: PuzzleSystem = new PuzzleSystem();
  public readonly crafting: CraftingSystem = new CraftingSystem();
  public readonly quests: QuestManager = new QuestManager();
  public readonly expansion: ExpansionSystem = new ExpansionSystem();
  public readonly input: InputManager = new InputManager();
  public readonly audio: AudioManager = new AudioManager();
  public readonly save: SaveManager = new SaveManager();
  public readonly hud: HudOverlay = new HudOverlay();
  public readonly journal: JournalOverlay = new JournalOverlay();
  public readonly menus: MenusOverlay = new MenusOverlay();
  public readonly weather: WeatherSystem = new WeatherSystem();
  public readonly quipuInspect: QuipuInspectOverlay = new QuipuInspectOverlay();
  public readonly touchControls: TouchControlsOverlay = new TouchControlsOverlay();

  public gpu: GpuContext | null = null;
  public post: PostProcessor | null = null;
  public activeRegion: SaveData['regionId'] = 'cloudForest';
  public activeShotPreset: string | null = null;

  private lastFrameTimeMs: number = 0;
  private rafId: number = 0;
  private activeInteractable: InteractableTarget | null = null;

  constructor() {
    const aspect =
      typeof window !== 'undefined'
        ? window.innerWidth / Math.max(1, window.innerHeight)
        : 16 / 9;
    this.cameraRig = new OverTheShoulderCamera(aspect);
  }

  public async build(container: HTMLElement): Promise<void> {
    this.quality.build();
    const qSettings = this.quality.getSettings();

    // 1. Dual-path renderer, 4-component lighting rig, and ACES post-processing
    this.gpu = await createRendererWithFallback(container, qSettings.dpr);
    this.lightRig.build(this.scene, this.gpu.renderer);
    this.post = new PostProcessor(this.gpu.renderer, this.gpu.backend);
    this.post.build(container);
    await this.post.setupWebGpuPipeline(this.scene, this.cameraRig.camera);

    // 2. Complete PBR material library (§2.2)
    this.materials.build();

    // 3. World regions, terrain, masonry, hanging bridge, foliage, and water
    this.sky.build(this.scene);
    this.terrain.build(this.scene, this.materials);
    this.foliage.build(this.scene, this.materials, this.terrain, qSettings.foliageDensityMultiplier);
    this.water.build(this.scene, this.materials);
    this.weather.build(this.scene);

    this.cloudForest.build(this.scene, this.materials, this.terrain);
    this.highSierra.build(this.scene, this.materials, this.terrain);
    this.jungleLowlands.build(this.scene, this.materials, this.terrain);
    this.paititi.build(this.scene, this.materials, this.terrain);

    // Place sanctuary brazier flickering torch light (index 0)
    const cpY = this.terrain.getTerrainHeightAt(-2.2, 8.4);
    this.lightRig.placeTorchLight(0, -2.2, cpY + 1.65, 8.4, 3.2);

    // 4. Naira Quispe rigged GLB character + Sol Negro operatives + camera
    await this.physics.build();
    this.input.build();
    this.input.onRegionSelect = regionId => {
      this.applyShotPreset(regionId === 'cloudForest' ? 'valley' : regionId);
    };
    this.input.onShotSelect = shotId => {
      this.applyShotPreset(shotId);
    };
    this.audio.build();
    this.save.build();

    await this.naira.build(this.scene, this.materials, this.terrain);
    await this.enemies.build(this.scene, this.materials, this.terrain);
    this.cameraRig.build(this.naira.position, this.naira.yaw);

    // 5. Traversal course, combat projectiles, Inca stonework puzzles, crafting, quests, UI
    this.traversal.build(this.scene, this.materials, this.terrain);
    this.combat.build(this.scene, this.materials);
    this.puzzles.build(this.scene, this.materials, this.terrain);
    this.crafting.build();
    this.quests.build(this.save);
    this.expansion.build();

    this.hud.build(container);
    this.journal.build(container);
    this.quipuInspect.build(container);
    this.touchControls.build(container, this.input);
    this.touchControls.onRecenterCamera = () => {
      this.cameraRig.recenter(this.naira.yaw);
    };
    this.menus.build(
      container,
      this.quality,
      this.audio,
      this.save,
      this.lightRig,
      this.post,
      () => this.downloadScreenshotPng(),
      () => {
        this.audio.resumeAudioContext();
        this.hud.showChapterBanner(
          'Chapter I: The Quipu Fragment',
          'Cloud Forest Valleys · Vilcabamba Ridge'
        );
      },
      regionId => {
        this.setActiveRegion(regionId as SaveData['regionId']);
        this.placeNairaAt(0.0, 8.2, Math.PI, 'idle');
      }
    );

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (!this.gpu) return;
        this.gpu.renderer.setSize(window.innerWidth, window.innerHeight);
        this.cameraRig.setAspect(window.innerWidth, window.innerHeight);
      });

      this.applyUrlShotPresetIfPresent();
      window.__juzuEngine = this;
      window.__juzuReady = true;
      (window as any).__shotReady = true;

      // Resume Web Audio on first user gesture across mobile & desktop
      const resumeAudio = () => {
        this.audio.resumeAudioContext();
        window.removeEventListener('pointerdown', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
        window.removeEventListener('touchstart', resumeAudio);
      };
      window.addEventListener('pointerdown', resumeAudio, { once: true });
      window.addEventListener('keydown', resumeAudio, { once: true });
      window.addEventListener('touchstart', resumeAudio, { once: true });

      // Handle WebGL context recovery on device sleep/wake or mobile task switch
      if (this.gpu) {
        const canvas = this.gpu.renderer.domElement;
        canvas.addEventListener('webglcontextlost', (e: Event) => {
          e.preventDefault();
          console.warn('[Juzu Engine] WebGL context lost. Pausing loop.');
          if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
          }
        });
        canvas.addEventListener('webglcontextrestored', () => {
          console.log('[Juzu Engine] WebGL context restored. Resuming loop.');
          this.startLoop();
        });
      }
    }

    // Pre-warm shaders and pipelines per Standing Performance Directive #7 (no first-frame hitching)
    if (this.gpu) {
      try {
        if ('compileAsync' in this.gpu.renderer && typeof (this.gpu.renderer as any).compileAsync === 'function') {
          await (this.gpu.renderer as any).compileAsync(this.scene, this.cameraRig.camera);
        } else if (typeof this.gpu.renderer.compile === 'function') {
          this.gpu.renderer.compile(this.scene, this.cameraRig.camera);
        }
      } catch (err) {
        console.warn('[Juzu Engine] Shader pre-warm warning (continuing to loop):', err);
      }
    }

    this.lastFrameTimeMs = typeof performance !== 'undefined' ? performance.now() : 0;
    this.startLoop();
  }

  public setActiveRegion(regionId: SaveData['regionId']): void {
    this.activeRegion = regionId;
    this.save.getState().regionId = regionId;

    const isCF = regionId === 'cloudForest';
    const isHS = regionId === 'highSierra';
    const isJL = regionId === 'jungleLowlands';
    const isPT = regionId === 'paititi';

    this.terrain.setBiomeMode(regionId, this.materials);
    this.sky.setBiomeMode(regionId);
    this.weather.setBiome(regionId);
    this.cloudForest.group.visible = isCF;
    this.traversal.group.visible = isCF;
    this.puzzles.group.visible = isCF;
    this.enemies.group.visible = isCF;
    this.water.group.visible = !isHS;
    this.foliage.group.visible = !isHS;
    this.highSierra.group.visible = isHS;
    this.jungleLowlands.group.visible = isJL;
    this.paititi.group.visible = isPT;

    if (isHS) {
      this.lightRig.applyGrade('noon', this.gpu?.renderer);
      this.post?.applyPreset('sierraGold');
      this.save.getState().chapter = 4;
    } else if (isJL) {
      this.lightRig.applyGrade('noon', this.gpu?.renderer);
      this.post?.applyPreset('jungleGreen');
      this.save.getState().chapter = 7;
    } else if (isPT) {
      this.lightRig.applyGrade('noon', this.gpu?.renderer);
      this.post?.applyPreset('paititiDawn');
      this.save.getState().chapter = 10;
    } else {
      this.lightRig.applyGrade('afternoon', this.gpu?.renderer);
      this.post?.applyPreset('cloudForestMist');
      this.save.getState().chapter = 1;
    }
    this.quests.refreshObjectiveFromFlags(this.save, regionId);
  }

  public applyUrlShotPresetIfPresent(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const region = params.get('region') as SaveData['regionId'] | null;
    if (region) {
      this.setActiveRegion(region);
    }
    const shot = params.get('shot');
    if (shot) {
      this.applyShotPreset(shot);
    }
    const touch = params.get('touch');
    if (touch === '1' || touch === 'true') {
      this.touchControls.setVisible(true);
    }
  }

  public applyShotPreset(shot: string): void {
    this.activeShotPreset = shot;
    if (shot === 'touch' || shot === 'mobile') {
      this.setActiveRegion('cloudForest');
      this.touchControls.setVisible(true);
      this.placeNairaAt(0.0, 9.2, Math.PI, 'idle');
      this.cameraRig.mode = 'overShoulder';
      this.cameraRig.build(this.naira.position, this.naira.yaw);
    } else if (shot === 'valley') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(0.0, 9.2, Math.PI, 'idle');
      this.cameraRig.mode = 'overShoulder';
      this.cameraRig.build(this.naira.position, this.naira.yaw);
    } else if (shot === 'bridge') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(0.0, 2.2, Math.PI, 'walk');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.85,
        ny + 1.42,
        5.35,
        -0.45,
        ny + 1.05,
        -4.5,
        58
      );
    } else if (shot === 'river') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(3.5, -2.2, -Math.PI * 0.45, 'idle');
      this.cameraRig.snapToShot(
        10.5,
        1.8,
        -1.5,
        -12.0,
        -2.55,
        -6.5,
        56
      );
    } else if (shot === 'character') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(-0.1, -6.8, Math.PI - 0.08, 'walk');
      this.cameraRig.mode = 'overShoulder';
      this.cameraRig.build(this.naira.position, this.naira.yaw);
    } else if (shot === 'closeup') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(0.0, 7.8, 0.55, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.15,
        ny + 1.12,
        9.35,
        -0.08,
        ny + 0.92,
        7.65,
        46
      );
    } else if (shot === 'climb') {
      this.setActiveRegion('cloudForest');
      const crag = this.traversal.crags[0];
      const cx = crag ? crag.centerX : -4.2;
      const cz = crag ? crag.centerZ + 0.12 : -14.68;
      const baseY = this.terrain.sampleGroundY(cx, cz, 3.0);
      const cy = baseY + 2.15;
      this.naira.position.set(cx, cy, cz);
      this.naira.yaw = Math.PI;
      this.naira.root.position.set(cx, cy, cz);
      this.naira.root.rotation.set(0, Math.PI, 0);
      this.naira.mode = 'climb';
      this.naira.isGrounded = false;
      this.input.state.climbHeld = true;
      this.naira.transitionToMode('climb', true);
      this.cameraRig.snapToShot(
        cx + 1.45,
        cy + 0.55,
        cz + 2.35,
        cx,
        cy + 0.65,
        cz,
        54
      );
    } else if (shot === 'combat') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(-0.35, 7.2, Math.PI, 'aim');
      this.input.state.aimHeld = true;
      const ny = this.naira.position.y;
      if (this.enemies.operatives[0]) {
        const op = this.enemies.operatives[0];
        const oy = this.terrain.sampleGroundY(0.0, 1.2, 2.5);
        op.patrolStart.set(0.0, oy, 1.2);
        op.patrolEnd.set(0.0, oy, 1.2);
        op.position.set(0.0, oy, 1.2);
        op.yaw = 0.0;
        op.root.position.copy(op.position);
        op.root.rotation.set(0, op.yaw, 0);
        op.state = 'combat';
        op.awareness = 1.0;
        this.enemies.setOperativeAction(op, 'idle', 1.0);
      }
      this.cameraRig.snapToShot(
        -0.85,
        ny + 1.42,
        9.1,
        0.0,
        ny + 1.25,
        1.2,
        50
      );
    } else if (shot === 'highSierra') {
      this.setActiveRegion('highSierra');
      this.placeNairaAt(-0.2, 8.2, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.15,
        ny + 1.62,
        11.5,
        -0.2,
        ny + 1.85,
        -12.0,
        56
      );
    } else if (shot === 'jungleLowlands') {
      this.setActiveRegion('jungleLowlands');
      this.placeNairaAt(-0.2, 8.8, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.1,
        ny + 1.55,
        12.0,
        -0.2,
        ny + 1.15,
        -12.0,
        56
      );
    } else if (shot === 'paititi') {
      this.setActiveRegion('paititi');
      this.placeNairaAt(0.0, 1.2, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.15,
        ny + 1.65,
        5.2,
        0.0,
        ny + 4.2,
        -14.3,
        56
      );
    } else if (shot === 'stealth') {
      this.setActiveRegion('cloudForest');
      // Place Sol Negro operative facing away (North towards negative Z)
      if (this.enemies.operatives[0]) {
        const op = this.enemies.operatives[0];
        const oy = this.terrain.sampleGroundY(-0.4, 1.8, 2.5);
        op.patrolStart.set(-0.4, oy, 1.8);
        op.patrolEnd.set(-0.4, oy, 1.8);
        op.position.set(-0.4, oy, 1.8);
        op.yaw = 0.0;
        op.root.position.copy(op.position);
        op.root.rotation.set(0, op.yaw, 0);
        op.state = 'unaware';
        op.awareness = 0.0;
        this.enemies.setOperativeAction(op, 'patrol', 0.6);
      }
      // Place Naira directly behind in sneak distance (facing North towards operative's back)
      this.placeNairaAt(-0.4, 3.2, 0.0, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        0.35,
        ny + 1.35,
        5.2,
        -0.4,
        ny + 1.1,
        1.8,
        50
      );
    } else if (shot === 'puzzle') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(-1.1, -13.6, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        -0.1,
        ny + 1.25,
        -11.5,
        -0.95,
        ny + 1.05,
        -15.8,
        54
      );
    } else if (shot === 'quipu') {
      this.setActiveRegion('cloudForest');
      this.quipuInspect.open(this.save);
    } else if (shot === 'sierra_weather') {
      this.setActiveRegion('highSierra');
      this.placeNairaAt(-0.2, 8.2, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.25,
        ny + 1.55,
        12.0,
        -0.2,
        ny + 1.85,
        -12.0,
        55
      );
    } else if (shot === 'cavern_torch') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(0.15, -17.6, 0.55, 'idle');
      this.weather.setTorchManual(true, 3.2);
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        0.95,
        ny + 1.25,
        -19.4,
        0.15,
        ny + 1.05,
        -17.2,
        50
      );
    }
  }

  private placeNairaAt(
    x: number,
    z: number,
    yaw: number,
    poseMode: LocomotionMode
  ): void {
    const y = this.terrain.sampleGroundY(x, z, 3.0);
    this.naira.position.set(x, y, z);
    this.naira.yaw = yaw;
    this.naira.root.position.set(x, y, z);
    this.naira.root.rotation.set(0, yaw, 0);
    if (poseMode === 'walk') {
      this.input.state.moveZ = -0.45;
      this.naira.update(0.28, this.input.state, yaw, this.terrain, this.audio);
      this.input.state.moveZ = 0;
    } else if (poseMode === 'aim') {
      this.input.state.aimHeld = true;
      this.naira.update(0.2, this.input.state, yaw, this.terrain, this.audio);
      this.input.state.aimHeld = false;
    } else {
      this.naira.update(0.05, this.input.state, yaw, this.terrain, this.audio);
    }
  }

  private startLoop(): void {
    const tick = (nowMs: number): void => {
      this.rafId = requestAnimationFrame(tick);
      const rawDt = (nowMs - this.lastFrameTimeMs) * 0.001;
      this.lastFrameTimeMs = nowMs;
      const dt = Math.max(0.001, Math.min(0.05, rawDt));
      this.update(dt);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public update(dt: number): void {
    this.quality.update(dt);
    this.input.update(dt);

    if (this.input.state.journalPressed) {
      this.journal.toggle(this.save, this.quests);
      this.audio.playSfx('journal_turn', 0);
    }
    if (this.input.state.pausePressed) {
      if (this.quipuInspect.isOpen) {
        this.quipuInspect.close();
      } else if (this.journal.isOpen) {
        this.journal.toggle(this.save, this.quests);
      } else {
        this.menus.setPaused(!this.menus.isPaused);
      }
    }
    if (this.input.state.photoModePressed) {
      const inPhoto = this.menus.togglePhotoMode();
      this.cameraRig.mode = inPhoto ? 'photo' : 'overShoulder';
      this.hud.setVisible(!inPhoto);
    }
    if (this.input.state.regionSelect) {
      const targetRegion = this.input.state.regionSelect;
      this.input.state.regionSelect = null;
      this.applyShotPreset(targetRegion === 'cloudForest' ? 'valley' : targetRegion);
    }
    if (this.input.state.shotSelect) {
      const targetShot = this.input.state.shotSelect;
      this.input.state.shotSelect = null;
      this.applyShotPreset(targetShot);
    }
    if (this.input.state.orbitTogglePressed) {
      this.cameraRig.mode =
        this.cameraRig.mode === 'overShoulder' ? 'orbit' : 'overShoulder';
    }
    if (
      (this.cameraRig.mode === 'shot' || this.cameraRig.mode === 'vista') &&
      Math.hypot(this.input.state.moveX, this.input.state.moveZ) > 0.08
    ) {
      this.cameraRig.mode = 'overShoulder';
    }

    if (!this.menus.isPaused && !this.journal.isOpen && !this.menus.isTitleScreenOpen) {
      if (this.input.state.craftPressed) {
        if (!this.crafting.craftSelectedArrow()) {
          this.crafting.cycleArrowType();
        }
      }
      if (this.input.state.poulticePressed && this.crafting.poulticeCount > 0) {
        this.crafting.poulticeCount--;
        this.combat.startPoulticeHeal();
      }
      if (this.input.state.dodgePressed) {
        this.combat.triggerDodgeRoll();
      }
      if (this.input.state.shootPressed && this.input.state.aimHeld) {
        const count = this.crafting.getAmmoCount();
        if (count > 0) {
          this.crafting.arrowCounts[this.crafting.selectedArrow]--;
          _arrowOrigin.set(
            this.naira.position.x,
            this.naira.position.y + 1.38,
            this.naira.position.z
          );
          _aimDir.set(
            Math.sin(this.naira.yaw),
            0.06,
            Math.cos(this.naira.yaw)
          );
          this.combat.fireArrow(_arrowOrigin, _aimDir, this.crafting.selectedArrow);
        }
      }

      if (this.activeShotPreset === 'climb') {
        this.input.state.climbHeld = true;
        this.naira.mode = 'climb';
        this.naira.isGrounded = false;
      } else if (this.activeShotPreset === 'combat') {
        this.input.state.aimHeld = true;
      }

      this.naira.update(
        dt,
        this.input.state,
        this.cameraRig.yaw,
        this.terrain,
        this.audio,
        this.traversal,
        damage => {
          if (this.combat.health <= 0) return;
          const dead = this.combat.applyDamage(damage);
          this.hud.flashDamage(0.85);
          if (dead) this.handlePlayerDeath();
        }
      );
      this.physics.update(dt, this.naira.position);
      this.cameraRig.update(
        dt,
        this.input.state,
        this.naira.position,
        this.naira.speed,
        this.terrain
      );
      this.enemies.update(
        dt,
        this.naira.position,
        this.input.state.crouch,
        this.terrain,
        damage => {
          if (this.combat.health <= 0) return;
          const dead = this.combat.applyDamage(damage);
          this.hud.flashDamage(0.85);
          this.audio.playSfx('breath_exert', 0);
          if (dead) this.handlePlayerDeath();
        }
      );
      this.combat.update(dt, this.input.state.aimHeld, this.enemies);
      this.puzzles.update(dt);
      this.quests.update(dt);
      this.sky.update(dt);
      this.water.update(dt);
      this.foliage.update(dt, this.naira.position);
      this.cloudForest.update(dt, this.naira.position);
      this.highSierra.update(dt);
      this.jungleLowlands.update(dt);
      this.paititi.update(dt);
      this.lightRig.update(dt, this.naira.position);
      this.weather.updateTorch(this.naira.position);
      this.weather.update(dt, this.cameraRig.camera.position);
      this.audio.update(dt);

      this.updateInteractables();
      this.checkRegionGateways();
      this.touchControls.updateContextualAction(
        this.activeInteractable ? this.activeInteractable.promptText : ''
      );
    }

    const isGameplayActive =
      !this.menus.isTitleScreenOpen &&
      !this.menus.isPhotoMode &&
      !this.menus.isPaused &&
      !this.journal.isOpen &&
      !this.quipuInspect.isOpen;
    this.hud.setVisible(!this.menus.isTitleScreenOpen && !this.menus.isPhotoMode);
    this.touchControls.setGameplayActive(isGameplayActive);
    this.hud.update(
      dt,
      this.quests.getActiveObjective(),
      this.quests.isObjectiveBannerVisible(),
      this.activeInteractable ? this.activeInteractable.promptText : '',
      this.naira.stamina,
      this.input.state.aimHeld,
      this.crafting.selectedArrow,
      this.crafting.getAmmoCount(),
      this.combat.health
    );

    this.input.consumeOneShotFlags();
    if (this.post) {
      this.post.render(this.scene, this.cameraRig.camera);
    } else if (this.gpu) {
      this.gpu.renderer.render(this.scene, this.cameraRig.camera);
    }
  }

  private updateInteractables(): void {
    this.activeInteractable = null;

    // Check for stealth takedown opportunity on nearby Sol Negro guards
    const takedownTarget = this.enemies.getStealthTakedownTarget(this.naira.position, 2.4);
    if (takedownTarget) {
      this.activeInteractable = {
        id: 'stealth_takedown',
        label: 'Takedown',
        promptText: '[F] Silent Takedown',
        position: takedownTarget.position,
        radius: 2.4,
      };
      if (this.input.state.takedownPressed || this.input.state.interactPressed) {
        this.enemies.executeStealthTakedown(takedownTarget);
        this.combat.triggerAxeSwing(this.naira.position);
        this.audio.playSfx('cloth_rustle', 0);
        this.audio.playSfx('breath_exert', 0);
        this.activeInteractable = null;
        return;
      }
      return;
    }

    const regionInteractables =
      this.activeRegion === 'highSierra'
        ? this.highSierra.interactables
        : this.activeRegion === 'jungleLowlands'
        ? this.jungleLowlands.interactables
        : this.activeRegion === 'paititi'
        ? this.paititi.interactables
        : this.cloudForest.interactables;

    for (let i = 0; i < regionInteractables.length; i++) {
      const item = regionInteractables[i];
      const dx = this.naira.position.x - item.position.x;
      const dz = this.naira.position.z - item.position.z;
      if (dx * dx + dz * dz <= item.radius * item.radius) {
        this.activeInteractable = item;
        break;
      }
    }

    if (!this.activeInteractable) return;

    if (this.input.state.interactPressed || this.input.state.condorPressed) {
      const id = this.activeInteractable.id;
      if (id === 'stele_cloud_forest') {
        if (!this.puzzles.isSolved('cf_water_stele_channel')) {
          const res = this.puzzles.turnWheel('cf_water_stele_channel', 0.45);
          this.audio.playSfx('stone_grind', 0);
          if (res.newlySolved) {
            this.save.setQuestFlag('q_cf_stele_read', true);
            this.save.addJournalEntry(
              'Inca Water-Reckoning Stele: Turning the bronze sluice wheel divides mountain runoff into the counterweight basin, raising the sanctuary portal.'
            );
            this.quests.refreshObjectiveFromFlags(this.save);
            this.audio.playSfx('puzzle_solved', 0);
          }
        }
      } else if (id === 'quipu_cloud_forest_archive') {
        this.quipuInspect.open(this.save);
        this.audio.playSfx('collectible_chime', 0);
      } else if (id === 'viewpoint_cloud_forest') {
        this.expansion.synchronizeViewpoint(id, this.save);
        this.quests.refreshObjectiveFromFlags(this.save);
        this.audio.playSfx('condor_cry', 0);
      } else if (id === 'checkpoint_south_trail') {
        const grades: Array<'dawn' | 'noon' | 'afternoon' | 'dusk' | 'night'> = [
          'dawn',
          'noon',
          'afternoon',
          'dusk',
          'night',
        ];
        const currentGrade = this.lightRig.getGrade();
        const nextIdx = (grades.indexOf(currentGrade) + 1) % grades.length;
        const nextGrade = grades[nextIdx];
        this.lightRig.applyGrade(nextGrade, this.gpu?.renderer);
        this.save.saveCheckpoint(
          this.naira.position.x,
          this.naira.position.y,
          this.naira.position.z,
          this.naira.yaw,
          nextGrade
        );
        this.audio.playSfx('checkpoint_chime', 0);
        this.hud.showChapterBanner(
          `Sanctuary Rest · ${nextGrade.charAt(0).toUpperCase() + nextGrade.slice(1)}`,
          'Progress recorded · Sun position shifted'
        );
      } else if (id === 'sierra_solar_mirror') {
        this.puzzles.markSolved('hs_solar_alignment');
        this.save.setQuestFlag('q_hs_solar_aligned', true);
        this.save.getState().chapter = 5;
        this.save.addJournalEntry(
          'Intihuatana Solar Observatory: Reflecting the high-altitude sun across the gnomon pillar reveals the eastern descent into Antisuyu.'
        );
        this.quests.refreshObjectiveFromFlags(this.save, this.activeRegion);
        this.audio.playSfx('collectible_chime', 0);
      } else if (id === 'jungle_hydraulic_sluice') {
        this.jungleLowlands.setSluiceOpen(true);
        this.puzzles.markSolved('jl_hydraulic_sluice');
        this.save.setQuestFlag('q_jl_sluice_opened', true);
        this.save.getState().chapter = 8;
        this.save.addJournalEntry(
          'Antisuyu Cenote Sluice: Opening the bronze sluice drains the upper terrace channel and unseals the River Road to Paititi.'
        );
        this.quests.refreshObjectiveFromFlags(this.save, this.activeRegion);
        this.audio.playSfx('collectible_chime', 0);
      } else if (id === 'paititi_quipu_archive') {
        this.save.setQuestFlag('q_exp_sanctum_claimed', true);
        this.save.getState().chapter = 12;
        this.save.addJournalEntry(
          'Paititi Living Archive (Chapter 12 — Home): The master quipus record four centuries of living stewardship. Some knowledge belongs to the valley, not the museum case.'
        );
        this.quests.refreshObjectiveFromFlags(this.save, this.activeRegion);
        this.audio.playSfx('collectible_chime', 0);
      }
    }
  }

  private isRespawning: boolean = false;

  private handlePlayerDeath(): void {
    if (this.isRespawning) return;
    this.isRespawning = true;
    this.hud.showDeathScreen(true);
    this.audio.playSfx('breath_exert', 0);

    window.setTimeout(() => {
      const state = this.save.getState();
      this.placeNairaAt(state.position[0], state.position[2], state.yaw, 'idle');
      this.combat.health = 100;
      this.enemies.resetAllOperatives();
      this.hud.showDeathScreen(false);
      this.isRespawning = false;
    }, 2200);
  }

  private checkRegionGateways(): void {
    const p = this.naira.position;
    if (this.activeRegion === 'cloudForest') {
      if (Math.abs(p.x) <= 4.0 && p.z <= -25.2) {
        this.setActiveRegion('highSierra');
        this.placeNairaAt(0.0, 8.8, Math.PI, 'idle');
        this.hud.showChapterBanner('Chapter IV: The High Sierra', 'Intihuatana Solar Pass · 3,800m');
        this.audio.playSfx('condor_cry', 0);
      }
    } else if (this.activeRegion === 'highSierra') {
      if (Math.abs(p.x) <= 4.5 && p.z <= -25.5) {
        this.setActiveRegion('jungleLowlands');
        this.placeNairaAt(0.0, 9.2, Math.PI, 'idle');
        this.hud.showChapterBanner('Chapter VII: Antisuyu Rainforest', 'The Drained Cenote · Lowland Choke');
        this.audio.playSfx('checkpoint_chime', 0);
      } else if (p.z >= 10.8) {
        this.setActiveRegion('cloudForest');
        this.placeNairaAt(0.0, -24.0, 0.0, 'idle');
        this.hud.showChapterBanner('Chapter I: Cloud Forest Valleys', 'The Ravine · South Sanctuary Trail');
      }
    } else if (this.activeRegion === 'jungleLowlands') {
      if (Math.abs(p.x) <= 4.5 && p.z <= -24.5) {
        this.setActiveRegion('paititi');
        this.placeNairaAt(0.0, 2.5, Math.PI, 'idle');
        this.hud.showChapterBanner('Chapter X: Paititi — The Golden Cradle', 'Plaza of the Sun · Living Quipu Archive');
        this.audio.playSfx('collectible_chime', 0);
      } else if (p.z >= 11.2) {
        this.setActiveRegion('highSierra');
        this.placeNairaAt(0.0, -24.5, 0.0, 'idle');
        this.hud.showChapterBanner('Chapter IV: The High Sierra', 'Intihuatana Solar Pass · 3,800m');
      }
    } else if (this.activeRegion === 'paititi') {
      if (p.z >= 8.5) {
        this.setActiveRegion('jungleLowlands');
        this.placeNairaAt(0.0, -23.5, 0.0, 'idle');
        this.hud.showChapterBanner('Chapter VII: Antisuyu Rainforest', 'The Drained Cenote · Lowland Choke');
      }
    }
  }

  private downloadScreenshotPng(): void {
    if (!this.gpu || typeof document === 'undefined') return;
    this.gpu.renderer.render(this.scene, this.cameraRig.camera);
    const dataUrl = this.gpu.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `juzu-photo-${Date.now()}.png`;
    a.click();
  }

  public dispose(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.menus.dispose();
    this.journal.dispose();
    this.hud.dispose();
    this.expansion.dispose();
    this.quests.dispose();
    this.crafting.dispose();
    this.puzzles.dispose();
    this.combat.dispose();
    this.traversal.dispose();
    this.enemies.dispose();
    this.cameraRig.dispose();
    this.naira.dispose();
    this.paititi.dispose();
    this.jungleLowlands.dispose();
    this.highSierra.dispose();
    this.cloudForest.dispose();
    this.water.dispose();
    this.foliage.dispose();
    this.terrain.dispose();
    this.sky.dispose();
    this.materials.dispose();
    if (this.post) this.post.dispose();
    this.lightRig.dispose();
    if (this.gpu) this.gpu.dispose();
    this.save.dispose();
    this.audio.dispose();
    this.input.dispose();
    this.physics.dispose();
    this.quality.dispose();
  }
}

export async function bootJuzu(): Promise<JuzuEngine | null> {
  if (typeof document === 'undefined') return null;
  const appEl = document.getElementById('app') || document.body;
  const engine = new JuzuEngine();
  await engine.build(appEl);
  return engine;
}

void bootJuzu();
