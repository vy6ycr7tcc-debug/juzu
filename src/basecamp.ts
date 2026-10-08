import * as THREE from 'three';
import { getGlobalTerrainHeight } from './terrain.js';
import type { CharacterController } from './character.js';
import type { AudioDirector } from './audio/engine.js';
import type { SaveAPI } from './save/index.js';
import type { SottrHUD } from './hud.js';

// ============================================================================
// Andean Basecamp System (Shadow of the Tomb Raider North Star)
//
// 1. Physical stone firepit with charred logs, glowing embers, and dynamic flicker light.
// 2. Rising thermal ember spark particle system.
// 3. Contemplative fireside rest posture & automatic game checkpoint saving.
// 4. SOTTR-style Basecamp UI: Inca Skill Tree (Brawn/Scavenger/Seeker) & Quipu Crafting.
// ============================================================================

export interface BasecampSkill {
  id: string;
  name: string;
  discipline: 'Brawn' | 'Scavenger' | 'Seeker';
  icon: string;
  description: string;
  cost: number;
  unlocked: boolean;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  requirements: { item: string; count: number }[];
  crafted: boolean;
}

export class BasecampManager {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public campfirePos: THREE.Vector3;
  public isResting: boolean = false;

  // Campfire lighting & embers
  private fireLight: THREE.PointLight;
  private emberParticles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];
  private emberGroup: THREE.Group;
  private flickerTime: number = 0;

  // Skills & Crafting Progression State
  public skillPoints: number = 2;
  public resources: Record<string, number> = {
    quipu: 3,
    leather: 5,
    obsidian: 4,
    hardwood: 8,
  };

  public skills: BasecampSkill[] = [
    {
      id: 'puma_prowess',
      name: "Puma's Prowess",
      discipline: 'Brawn',
      icon: '🐆',
      description: 'Increases takedown execution speed and imparts heavy staggering force to climbing axe strikes.',
      cost: 1,
      unlocked: false,
    },
    {
      id: 'serpent_cunning',
      name: "Serpent's Cunning",
      discipline: 'Scavenger',
      icon: '🐍',
      description: 'Harvests double hardwood shafts and cloth from fallen Sol Negro mercenary patrols.',
      cost: 1,
      unlocked: false,
    },
    {
      id: 'condor_eye',
      name: "Condor's Eye",
      discipline: 'Seeker',
      icon: '🦅',
      description: 'Extends Survival Instinct vision duration and reveals hidden Incan quipu caches through stone walls.',
      cost: 2,
      unlocked: false,
    },
  ];

  public recipes: CraftingRecipe[] = [
    {
      id: 'reinforced_quiver',
      name: 'Reinforced Llama-Hide Quiver',
      description: 'Expands maximum arrow capacity from 16 to 24 arrows.',
      requirements: [{ item: 'quipu', count: 1 }, { item: 'leather', count: 3 }],
      crafted: false,
    },
    {
      id: 'fire_obsidian_arrows',
      name: 'Obsidian Fire Arrows',
      description: 'Coats volcanic obsidian arrowheads in pitch to ignite combustible barriers and wooden barricades.',
      requirements: [{ item: 'obsidian', count: 2 }, { item: 'hardwood', count: 4 }],
      crafted: false,
    },
    {
      id: 'coca_balm',
      name: 'Andean Herbal Poultice',
      description: 'Restores vital stamina and accelerates health regeneration in high altitude conditions.',
      requirements: [{ item: 'quipu', count: 1 }, { item: 'hardwood', count: 2 }],
      crafted: false,
    },
  ];

  // UI Modal Container
  private modalContainer: HTMLDivElement | null = null;
  private activeTab: 'skills' | 'crafting' = 'skills';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Highlands_Basecamp';

    // Position at Highlands Camp landmark: (50, y, 50)
    const gy = getGlobalTerrainHeight(50, 50);
    this.campfirePos = new THREE.Vector3(50, gy, 50);
    this.group.position.copy(this.campfirePos);

    // 1. Build Physical Campfire Geometry
    this.buildCampfireMesh();

    // 2. Dynamic Point Light with Chiaroscuro Warmth
    this.fireLight = new THREE.PointLight(0xff6a14, 2.8, 14, 1.8);
    this.fireLight.position.set(0, 0.45, 0);
    this.fireLight.castShadow = true;
    this.fireLight.shadow.bias = -0.002;
    this.group.add(this.fireLight);

    // 3. Floating Ember Sparks
    this.emberGroup = new THREE.Group();
    this.group.add(this.emberGroup);
    this.initEmberParticles();

    this.scene.add(this.group);
    this.initUIModal();
  }

  // Animated flame quads
  private flameMeshes: THREE.Mesh[] = [];

  private buildCampfireMesh(): void {
    // 1. Blackened Charcoal / Ash Ground Bed
    const ashGeo = new THREE.CircleGeometry(0.85, 24);
    ashGeo.rotateX(-Math.PI / 2);
    const ashMat = new THREE.MeshStandardMaterial({
      color: 0x14110e, // Charred soot and ash
      roughness: 0.98,
      metalness: 0.0,
    });
    const ashBed = new THREE.Mesh(ashGeo, ashMat);
    ashBed.position.set(0, 0.02, 0);
    ashBed.receiveShadow = true;
    this.group.add(ashBed);

    // 2. Weathered Dark River Basalt Stones (embedded into terrain)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x272421, // Deep weathered Andean basalt
      roughness: 0.94,
      metalness: 0.04,
      envMapIntensity: 0.15,
    });

    const boulderCount = 11;
    const ringRadius = 0.82;
    for (let i = 0; i < boulderCount; i++) {
      const angle = (i / boulderCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const r = ringRadius + (Math.random() - 0.5) * 0.12;
      const bx = Math.cos(angle) * r;
      const bz = Math.sin(angle) * r;

      const scale = 0.18 + Math.random() * 0.08;
      const bGeo = new THREE.DodecahedronGeometry(scale, 1);
      const bMesh = new THREE.Mesh(bGeo, stoneMat);
      bMesh.position.set(bx, scale * 0.35, bz);
      bMesh.scale.set(1.15, 0.65, 1.15); // Flattened river stone shape
      bMesh.rotation.set(Math.random() * 0.4, angle, Math.random() * 0.4);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      this.group.add(bMesh);
    }

    // 3. Charred Crossed Logs
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x1a1512,
      roughness: 0.92,
      metalness: 0.0,
    });

    const logCount = 6;
    for (let i = 0; i < logCount; i++) {
      const logGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.85, 7);
      const logMesh = new THREE.Mesh(logGeo, woodMat);
      const angle = (i / logCount) * Math.PI + (Math.random() - 0.5) * 0.2;
      logMesh.rotation.set(Math.PI * 0.42, 0, angle);
      logMesh.position.set(0, 0.08 + i * 0.035, 0);
      logMesh.castShadow = true;
      logMesh.receiveShadow = true;
      this.group.add(logMesh);
    }

    // 4. Glowing Core Coals & Hot Embers
    const coalGeo = new THREE.SphereGeometry(0.28, 12, 8);
    const coalMat = new THREE.MeshStandardMaterial({
      color: 0xcc2900,
      emissive: 0xff3b00,
      emissiveIntensity: 2.8,
      roughness: 0.65,
      metalness: 0.1,
    });
    const coals = new THREE.Mesh(coalGeo, coalMat);
    coals.scale.set(1.0, 0.28, 1.0);
    coals.position.set(0, 0.06, 0);
    this.group.add(coals);

    // 5. Procedural Flickering Flame Tongues (Vertical Quads)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff7711,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const flameCount = 4;
    for (let i = 0; i < flameCount; i++) {
      const fGeo = new THREE.PlaneGeometry(0.32, 0.55);
      fGeo.translate(0, 0.275, 0);
      const fMesh = new THREE.Mesh(fGeo, flameMat);
      fMesh.rotation.y = (i / flameCount) * Math.PI;
      fMesh.position.set((Math.random() - 0.5) * 0.08, 0.06, (Math.random() - 0.5) * 0.08);
      this.group.add(fMesh);
      this.flameMeshes.push(fMesh);
    }
  }

  private initEmberParticles(): void {
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xffa033,
      transparent: true,
      opacity: 0.9,
    });

    const count = 28;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.015, 0.015, 0.015);
      const mesh = new THREE.Mesh(geo, emberMat);
      mesh.position.set(
        (Math.random() - 0.5) * 0.5,
        0.1 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.5
      );
      this.emberGroup.add(mesh);

      this.emberParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          0.65 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.25
        ),
        life: Math.random() * 1.5,
        maxLife: 1.5 + Math.random() * 1.2,
      });
    }
  }

  public update(dt: number, camera?: THREE.Camera): void {
    // 1. Dynamic Campfire Flame Light Flicker & Animated Flame Meshes
    this.flickerTime += dt * 9.0;
    const flickerNoise =
      Math.sin(this.flickerTime * 1.7) * 0.25 +
      Math.sin(this.flickerTime * 3.4) * 0.15 +
      (Math.random() - 0.5) * 0.12;
    this.fireLight.intensity = Math.max(1.8, 2.8 + flickerNoise);

    for (let i = 0; i < this.flameMeshes.length; i++) {
      const fl = this.flameMeshes[i];
      const flScaleY = 1.0 + Math.sin(this.flickerTime * 2.2 + i * 1.5) * 0.22 + (Math.random() - 0.5) * 0.08;
      const flScaleXZ = 1.0 + Math.sin(this.flickerTime * 1.8 + i * 2.0) * 0.15;
      fl.scale.set(flScaleXZ, flScaleY, flScaleXZ);
      const flMat = fl.material as THREE.MeshBasicMaterial;
      flMat.opacity = 0.65 + Math.sin(this.flickerTime * 3.0 + i) * 0.2;
    }

    // 2. Rising Ember Sparks Simulation
    for (const p of this.emberParticles) {
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.mesh.position.set(
          (Math.random() - 0.5) * 0.5,
          0.12,
          (Math.random() - 0.5) * 0.5
        );
        p.velocity.set(
          (Math.random() - 0.5) * 0.35,
          0.75 + Math.random() * 0.9,
          (Math.random() - 0.5) * 0.35
        );
      } else {
        p.mesh.position.addScaledVector(p.velocity, dt);
        // Thermal turbulence
        p.velocity.x += (Math.random() - 0.5) * 0.4 * dt;
        p.velocity.z += (Math.random() - 0.5) * 0.4 * dt;

        // Fade scale and opacity
        const progress = p.life / p.maxLife;
        const scale = (1.0 - progress) * (0.8 + Math.sin(p.life * 10) * 0.2);
        p.mesh.scale.setScalar(scale);
      }
    }
  }

  public canInteract(playerPos: THREE.Vector3): boolean {
    const dist = playerPos.distanceTo(this.campfirePos);
    return dist <= 2.8;
  }

  public toggleRest(
    character: CharacterController,
    camera: THREE.Camera,
    saveAPI?: SaveAPI,
    audio?: AudioDirector,
    hud?: SottrHUD
  ): void {
    this.isResting = !this.isResting;

    if (this.isResting) {
      // 1. Transition character into contemplative fireside seated rest pose
      const seatPos = this.campfirePos.clone().add(new THREE.Vector3(1.3, 0, 0.4));
      seatPos.y = getGlobalTerrainHeight(seatPos.x, seatPos.z);
      character.mesh.position.copy(seatPos);
      character.isCrouched = true;
      character.mesh.lookAt(this.campfirePos.x, seatPos.y, this.campfirePos.z);

      // 2. Save game progression checkpoint
      if (saveAPI) {
        saveAPI.save(0);
      }

      // 3. Audio & HUD announcement
      if (audio) {
        audio.play('quena', { volume: 0.65 });
      }
      if (hud) {
        hud.setObjective('HIGHLANDS BASECAMP', 'Resting by the fire. Skills and Quipu upgrades ready.');
        hud.setCinematicMode(true);
      }

      // 4. Open Basecamp Menu Modal
      this.openModal();
    } else {
      // Stand up and exit rest mode
      character.isCrouched = false;
      if (hud) {
        hud.setCinematicMode(false);
      }
      this.closeModal();
    }
  }

  // ==========================================================================
  // SOTTR-Style Basecamp UI Modal DOM
  // ==========================================================================

  private initUIModal(): void {
    if (typeof document === 'undefined') return;

    const modal = document.createElement('div');
    modal.id = 'basecamp-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.display = 'none';
    modal.style.zIndex = '60';
    modal.style.pointerEvents = 'auto';
    modal.style.background = 'radial-gradient(circle at 75% 50%, rgba(10, 15, 12, 0.6) 0%, rgba(5, 8, 6, 0.92) 100%)';
    modal.style.color = '#e2e8f0';
    modal.style.fontFamily = "'Cinzel', 'Trebuchet MS', serif";

    document.body.appendChild(modal);
    this.modalContainer = modal;
  }

  public openModal(): void {
    if (!this.modalContainer) return;
    this.modalContainer.style.display = 'block';
    this.renderModalContent();
  }

  public closeModal(): void {
    if (!this.modalContainer) return;
    this.modalContainer.style.display = 'none';
  }

  private renderModalContent(): void {
    if (!this.modalContainer) return;

    this.modalContainer.innerHTML = `
      <div style="display: flex; height: 100%; width: 100%; box-sizing: border-box; padding: 40px 60px;">
        <!-- Left Panel: Navigation & Inventory Resources -->
        <div style="width: 320px; border-right: 1px solid rgba(212, 163, 75, 0.25); padding-right: 30px; display: flex; flexDirection: column;">
          <div style="margin-bottom: 25px;">
            <span style="font-size: 11px; letter-spacing: 3px; color: #d4a34b; font-weight: 700; text-transform: uppercase;">Sanctuary</span>
            <h1 style="margin: 4px 0 0 0; font-size: 26px; color: #f8fafc; letter-spacing: 1.5px;">HIGHLANDS CAMP</h1>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8; font-family: sans-serif;">Checkpoint Saved • Fireside Rest</p>
          </div>

          <!-- Tab Selection Buttons -->
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px;">
            <button id="tab-skills" style="
              text-align: left;
              padding: 12px 18px;
              background: ${this.activeTab === 'skills' ? 'rgba(212, 163, 75, 0.18)' : 'rgba(255, 255, 255, 0.04)'};
              border: 1px solid ${this.activeTab === 'skills' ? '#d4a34b' : 'rgba(255, 255, 255, 0.1)'};
              color: ${this.activeTab === 'skills' ? '#ffd875' : '#cbd5e1'};
              font-family: inherit; font-size: 14px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;
            ">
              🏹 INCA SKILLS <span style="float: right; font-size: 12px; color: #4ade80;">${this.skillPoints} PTS</span>
            </button>
            <button id="tab-crafting" style="
              text-align: left;
              padding: 12px 18px;
              background: ${this.activeTab === 'crafting' ? 'rgba(212, 163, 75, 0.18)' : 'rgba(255, 255, 255, 0.04)'};
              border: 1px solid ${this.activeTab === 'crafting' ? '#d4a34b' : 'rgba(255, 255, 255, 0.1)'};
              color: ${this.activeTab === 'crafting' ? '#ffd875' : '#cbd5e1'};
              font-family: inherit; font-size: 14px; letter-spacing: 1px; cursor: pointer; border-radius: 4px;
            ">
              🧶 QUIPU CRAFTING
            </button>
          </div>

          <!-- Raw Materials Ledger -->
          <div style="margin-top: auto; padding: 18px; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;">
            <h4 style="margin: 0 0 12px 0; font-size: 12px; letter-spacing: 2px; color: #d4a34b;">EXPEDITION CACHE</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: sans-serif; font-size: 12px;">
              <div>🧶 Quipu Cords: <b style="color: #ffd875;">${this.resources.quipu}</b></div>
              <div>🦌 Llama Hide: <b style="color: #ffd875;">${this.resources.leather}</b></div>
              <div>⛏️ Obsidian: <b style="color: #ffd875;">${this.resources.obsidian}</b></div>
              <div>🪵 Hardwood: <b style="color: #ffd875;">${this.resources.hardwood}</b></div>
            </div>
          </div>

          <!-- Stand Up Action Button -->
          <button id="btn-standup" style="
            margin-top: 20px;
            padding: 14px;
            background: linear-gradient(135deg, #b45309, #78350f);
            border: 1px solid #f59e0b;
            color: #fff;
            font-family: inherit;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 2px;
            cursor: pointer;
            border-radius: 4px;
          ">
            STAND UP [E]
          </button>
        </div>

        <!-- Right Content Panel: Skills Tree or Crafting List -->
        <div style="flex: 1; padding-left: 45px; overflow-y: auto;">
          ${this.activeTab === 'skills' ? this.renderSkillsView() : this.renderCraftingView()}
        </div>
      </div>
    `;

    // Hook DOM event listeners
    this.modalContainer.querySelector('#tab-skills')?.addEventListener('click', () => {
      this.activeTab = 'skills';
      this.renderModalContent();
    });
    this.modalContainer.querySelector('#tab-crafting')?.addEventListener('click', () => {
      this.activeTab = 'crafting';
      this.renderModalContent();
    });
    this.modalContainer.querySelector('#btn-standup')?.addEventListener('click', () => {
      this.closeModal();
      this.isResting = false;
    });

    // Wire Skill Unlock buttons
    this.skills.forEach(skill => {
      const btn = this.modalContainer?.querySelector(`#unlock-${skill.id}`);
      btn?.addEventListener('click', () => {
        if (this.skillPoints >= skill.cost && !skill.unlocked) {
          this.skillPoints -= skill.cost;
          skill.unlocked = true;
          this.renderModalContent();
        }
      });
    });

    // Wire Crafting buttons
    this.recipes.forEach(recipe => {
      const btn = this.modalContainer?.querySelector(`#craft-${recipe.id}`);
      btn?.addEventListener('click', () => {
        const canCraft = recipe.requirements.every(req => (this.resources[req.item] ?? 0) >= req.count);
        if (canCraft && !recipe.crafted) {
          recipe.requirements.forEach(req => {
            this.resources[req.item] -= req.count;
          });
          recipe.crafted = true;
          this.renderModalContent();
        }
      });
    });
  }

  private renderSkillsView(): string {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
          <h2 style="margin: 0; font-size: 22px; color: #f8fafc; letter-spacing: 1.5px;">INCA SURVIVAL DISCIPLINES</h2>
          <div style="font-family: sans-serif; font-size: 13px; color: #cbd5e1;">Available Points: <b style="color: #4ade80; font-size: 16px;">${this.skillPoints}</b></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${this.skills.map(s => `
            <div style="
              display: flex;
              align-items: center;
              padding: 18px 24px;
              background: ${s.unlocked ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.03)'};
              border: 1px solid ${s.unlocked ? '#4ade80' : 'rgba(255, 255, 255, 0.1)'};
              border-radius: 6px;
            ">
              <div style="font-size: 34px; margin-right: 22px;">${s.icon}</div>
              <div style="flex: 1;">
                <div style="display: flex; align-items: baseline; gap: 10px;">
                  <h3 style="margin: 0; font-size: 17px; color: ${s.unlocked ? '#4ade80' : '#f8fafc'};">${s.name}</h3>
                  <span style="font-size: 11px; color: #d4a34b; text-transform: uppercase; font-family: sans-serif;">${s.discipline} Discipline</span>
                </div>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; font-family: sans-serif; line-height: 1.4;">${s.description}</p>
              </div>
              <div style="margin-left: 20px;">
                ${s.unlocked ? `
                  <span style="color: #4ade80; font-size: 13px; font-weight: 700; letter-spacing: 1px;">✓ MASTERED</span>
                ` : `
                  <button id="unlock-${s.id}" ${this.skillPoints >= s.cost ? '' : 'disabled'} style="
                    padding: 9px 18px;
                    background: ${this.skillPoints >= s.cost ? '#2563eb' : 'rgba(255, 255, 255, 0.08)'};
                    border: 1px solid ${this.skillPoints >= s.cost ? '#60a5fa' : 'rgba(255, 255, 255, 0.1)'};
                    color: ${this.skillPoints >= s.cost ? '#fff' : '#64748b'};
                    font-family: inherit; font-size: 12px; cursor: ${this.skillPoints >= s.cost ? 'pointer' : 'not-allowed'};
                    border-radius: 4px;
                  ">
                    UNLOCK (${s.cost} PT)
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderCraftingView(): string {
    return `
      <div>
        <div style="margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
          <h2 style="margin: 0; font-size: 22px; color: #f8fafc; letter-spacing: 1.5px;">QUIPU WEAPON & GEAR CRAFTING</h2>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${this.recipes.map(r => {
            const canCraft = r.requirements.every(req => (this.resources[req.item] ?? 0) >= req.count);
            return `
              <div style="
                display: flex;
                align-items: center;
                padding: 18px 24px;
                background: ${r.crafted ? 'rgba(212, 163, 75, 0.08)' : 'rgba(255, 255, 255, 0.03)'};
                border: 1px solid ${r.crafted ? '#d4a34b' : 'rgba(255, 255, 255, 0.1)'};
                border-radius: 6px;
              ">
                <div style="flex: 1;">
                  <h3 style="margin: 0; font-size: 17px; color: ${r.crafted ? '#ffd875' : '#f8fafc'};">${r.name}</h3>
                  <p style="margin: 6px 0 10px 0; font-size: 13px; color: #94a3b8; font-family: sans-serif;">${r.description}</p>
                  <div style="display: flex; gap: 14px; font-family: sans-serif; font-size: 12px; color: #cbd5e1;">
                    Requirements:
                    ${r.requirements.map(req => {
                      const hasEnough = (this.resources[req.item] ?? 0) >= req.count;
                      return `<span style="color: ${hasEnough ? '#4ade80' : '#f87171'};">${req.item}: ${req.count}</span>`;
                    }).join(' • ')}
                  </div>
                </div>
                <div style="margin-left: 20px;">
                  ${r.crafted ? `
                    <span style="color: #ffd875; font-size: 13px; font-weight: 700; letter-spacing: 1px;">✓ CRAFTED</span>
                  ` : `
                    <button id="craft-${r.id}" ${canCraft ? '' : 'disabled'} style="
                      padding: 9px 18px;
                      background: ${canCraft ? '#d97706' : 'rgba(255, 255, 255, 0.08)'};
                      border: 1px solid ${canCraft ? '#fbbf24' : 'rgba(255, 255, 255, 0.1)'};
                      color: ${canCraft ? '#fff' : '#64748b'};
                      font-family: inherit; font-size: 12px; cursor: ${canCraft ? 'pointer' : 'not-allowed'};
                      border-radius: 4px;
                    ">
                      CRAFT UPGRADE
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  public dispose(): void {
    if (this.modalContainer && this.modalContainer.parentElement) {
      this.modalContainer.parentElement.removeChild(this.modalContainer);
    }
    this.scene.remove(this.group);
  }
}
