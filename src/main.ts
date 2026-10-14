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
import { HudOverlay } from './ui/hud';
import { JournalOverlay } from './ui/journal';
import { MenusOverlay } from './ui/menus';

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

  public gpu: GpuContext | null = null;
  public post: PostProcessor | null = null;
  public activeRegion: SaveData['regionId'] = 'cloudForest';

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
    this.post = new PostProcessor(this.gpu.renderer);
    this.post.build(container);

    // 2. Complete PBR material library (§2.2)
    this.materials.build();

    // 3. World regions, terrain, masonry, hanging bridge, foliage, and water
    this.sky.build(this.scene);
    this.terrain.build(this.scene, this.materials);
    this.foliage.build(this.scene, this.materials, this.terrain, qSettings.foliageDensityMultiplier);
    this.water.build(this.scene, this.materials);

    this.cloudForest.build(this.scene, this.materials, this.terrain);
    this.highSierra.build(this.scene, this.materials, this.terrain);
    this.jungleLowlands.build(this.scene, this.materials, this.terrain);
    this.paititi.build(this.scene, this.materials, this.terrain);

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
    this.menus.build(
      container,
      this.quality,
      this.audio,
      this.save,
      this.lightRig,
      this.post,
      () => this.downloadScreenshotPng()
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
      this.lightRig.applyGrade('afternoon', this.gpu?.renderer);
      this.post?.applyPreset('jungleGreen');
      this.save.getState().chapter = 7;
    } else if (isPT) {
      this.lightRig.applyGrade('dawn', this.gpu?.renderer);
      this.post?.applyPreset('paititiDawn');
      this.save.getState().chapter = 10;
    } else {
      this.lightRig.applyGrade('afternoon', this.gpu?.renderer);
      this.post?.applyPreset('cloudForestMist');
      this.save.getState().chapter = 1;
    }
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
  }

  public applyShotPreset(shot: string): void {
    if (shot === 'valley') {
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
      const cz = crag ? crag.centerZ + 0.28 : -14.52;
      const cy = (crag ? crag.bottomY : 1.8) + 0.85;
      this.naira.position.set(cx, cy, cz);
      this.naira.yaw = Math.PI;
      this.naira.root.position.set(cx, cy, cz);
      this.naira.root.rotation.set(0, Math.PI, 0);
      this.naira.mode = 'idle';
      this.input.state.climbHeld = true;
      this.naira.update(0.25, this.input.state, Math.PI, this.terrain, this.audio);
      this.input.state.climbHeld = false;
      this.cameraRig.snapToShot(
        cx + 1.45,
        cy + 0.92,
        cz + 1.85,
        cx - 0.05,
        cy + 0.95,
        cz - 0.25,
        58
      );
    } else if (shot === 'combat') {
      this.setActiveRegion('cloudForest');
      this.placeNairaAt(-0.55, 8.2, Math.PI - 0.18, 'aim');
      const ny = this.naira.position.y;
      if (this.enemies.operatives[0]) {
        const op = this.enemies.operatives[0];
        const oy = this.terrain.sampleGroundY(0.35, 3.8, 2.5);
        op.position.set(0.35, oy, 3.8);
        op.root.position.copy(op.position);
        op.root.rotation.set(0, -0.15, 0);
        if (op.mixer) op.mixer.update(0.05);
      }
      this.cameraRig.snapToShot(
        -1.35,
        ny + 1.38,
        10.1,
        0.2,
        ny + 1.15,
        3.8,
        52
      );
    } else if (shot === 'highSierra') {
      this.setActiveRegion('highSierra');
      this.placeNairaAt(-0.2, 8.2, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.05,
        ny + 1.62,
        11.6,
        -0.2,
        ny + 1.85,
        -12.0,
        58
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
      this.placeNairaAt(-0.1, 8.8, Math.PI, 'idle');
      const ny = this.naira.position.y;
      this.cameraRig.snapToShot(
        1.05,
        ny + 1.55,
        12.1,
        -0.2,
        ny + 1.65,
        -12.5,
        56
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
      if (this.journal.isOpen) {
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
      this.cameraRig.mode === 'shot' &&
      Math.hypot(this.input.state.moveX, this.input.state.moveZ) > 0.08
    ) {
      this.cameraRig.mode = 'overShoulder';
    }

    if (!this.menus.isPaused && !this.journal.isOpen) {
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

      this.naira.update(dt, this.input.state, this.cameraRig.yaw, this.terrain, this.audio);
      this.physics.update(dt, this.naira.position);
      this.cameraRig.update(
        dt,
        this.input.state,
        this.naira.position,
        this.naira.speed,
        this.terrain
      );
      this.enemies.update(dt, this.naira.position, this.input.state.crouch, this.terrain);
      this.combat.update(dt, this.input.state.aimHeld, this.enemies);
      this.puzzles.update(dt);
      this.quests.update(dt);
      this.sky.update(dt);
      this.water.update(dt);
      this.foliage.update(dt);
      this.cloudForest.update(dt, this.naira.position);
      this.highSierra.update(dt);
      this.jungleLowlands.update(dt);
      this.paititi.update(dt);
      this.lightRig.update(dt, this.naira.position);
      this.audio.update(dt);

      this.updateInteractables();
    }

    this.hud.update(
      dt,
      this.quests.getActiveObjective(),
      this.quests.isObjectiveBannerVisible(),
      this.activeInteractable ? this.activeInteractable.promptText : '',
      this.naira.stamina,
      this.input.state.aimHeld,
      this.crafting.selectedArrow,
      this.crafting.getAmmoCount()
    );

    this.input.consumeOneShotFlags();
    if (this.gpu) {
      this.gpu.renderer.render(this.scene, this.cameraRig.camera);
    }
  }

  private updateInteractables(): void {
    this.activeInteractable = null;
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
        this.puzzles.markSolved('cf_water_stele_channel');
        this.save.setQuestFlag('q_cf_stele_read', true);
        this.save.addJournalEntry(
          'Inca Water-Reckoning Stele: Turning the bronze sluice wheel divides mountain runoff into the counterweight basin, raising the sanctuary portal.'
        );
        this.quests.refreshObjectiveFromFlags(this.save);
        this.audio.playSfx('collectible_chime', 0);
      } else if (id === 'viewpoint_cloud_forest') {
        this.expansion.synchronizeViewpoint(id, this.save);
        this.quests.refreshObjectiveFromFlags(this.save);
        this.audio.playSfx('condor_cry', 0);
      } else if (id === 'checkpoint_south_trail') {
        this.save.saveCheckpoint(
          this.naira.position.x,
          this.naira.position.y,
          this.naira.position.z,
          this.naira.yaw,
          this.lightRig.getGrade()
        );
        this.audio.playSfx('checkpoint_chime', 0);
      } else if (id === 'sierra_solar_mirror') {
        this.puzzles.markSolved('hs_solar_alignment');
        this.save.addJournalEntry(
          'Intihuatana Solar Observatory: Reflecting the high-altitude sun across the gnomon pillar reveals the eastern descent into Antisuyu.'
        );
        this.audio.playSfx('collectible_chime', 0);
      } else if (id === 'jungle_hydraulic_sluice') {
        this.puzzles.markSolved('jl_hydraulic_sluice');
        this.save.addJournalEntry(
          'Antisuyu Cenote Sluice: Opening the bronze sluice drains the upper terrace channel and unseals the River Road to Paititi.'
        );
        this.audio.playSfx('collectible_chime', 0);
      } else if (id === 'paititi_quipu_archive') {
        this.save.setQuestFlag('q_exp_sanctum_claimed', true);
        this.save.getState().chapter = 12;
        this.save.addJournalEntry(
          'Paititi Living Archive (Chapter 12 — Home): The master quipus record four centuries of living stewardship. Some knowledge belongs to the valley, not the museum case.'
        );
        this.audio.playSfx('collectible_chime', 0);
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
