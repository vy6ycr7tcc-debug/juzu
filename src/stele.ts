import * as THREE from 'three';
import { getGlobalTerrainHeight } from './terrain.js';
import type { CharacterController } from './character.js';
import type { AudioDirector } from './audio/engine.js';
import type { SottrHUD } from './hud.js';

// ============================================================================
// Incan Stele Murals & Quechua Dialect System (Shadow of the Tomb Raider North Star)
//
// 1. Procedural Andean Andesite Monolith with Inti solar relief & Tocapu glyphs.
// 2. Stepped Chakana plinth with PBR chisel bump and moss weathering.
// 3. Quechua Dialect archaeological deciphering loop with language XP progression.
// 4. SOTTR-style Archaeological Translation modal & Field Journal Codex sync.
// ============================================================================

export interface MonolithData {
  id: string;
  name: string;
  dialect: 'Quechua' | 'Colla' | 'Yucatec';
  requiredLevel: number;
  xpAwarded: number;
  quechuaText: string;
  englishText: string;
  historicalContext: string;
  secretUnlocked: string;
}

export const SUN_STELE_LORE: MonolithData = {
  id: 'stele_solstice_gate',
  name: 'Monolith of the Solstice Gate',
  dialect: 'Quechua',
  requiredLevel: 1,
  xpAwarded: 25,
  quechuaText:
    'Inti Raymi kanchayninpi, Hanan Pacha kawsayta quwanchis. Amaru punkupi, mayup chakanampi, ñawpa pacha yachaqkuna qullqi quiputa pakarqanku.',
  englishText:
    'At the golden dawn of Inti Raymi, the celestial sun grants life to the Antisuyu. Beneath the Serpent\'s Gate where the roaring river carves the granite gorge, the royal quipucamayoc cached the sacred astronomical cords.',
  historicalContext:
    'Carved circa 1475 CE during the reign of Sapa Inca Pachacuti. The relief depicts the celestial triad: Hanan Pacha (Condor), Kay Pacha (Puma), and Uku Pacha (Amaru Serpent).',
  secretUnlocked: 'Map Updated: Hidden Quipu Cache marked at the River Gorge Overlook.',
};

/**
 * Procedurally generates high-resolution PBR relief textures for the Incan Monolith.
 * Includes Inti solar mask, 12 Tocapu heraldic glyphs, and zoomorphic friezes.
 */
function createMonolithTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 1024;

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const dCtx = diffCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rCtx = roughCanvas.getContext('2d')!;

  // 1. Base Andesite Stone Tone
  dCtx.fillStyle = '#3a3632'; // Deep volcanic andesite
  dCtx.fillRect(0, 0, w, h);

  bCtx.fillStyle = '#808080'; // Neutral midpoint bump
  bCtx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#dddddd'; // 0.87 baseline roughness
  rCtx.fillRect(0, 0, w, h);

  // Mineral specks and stone grain
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 2.5 + 0.5;
    const v = Math.random();
    dCtx.fillStyle = v < 0.5 ? 'rgba(25, 23, 20, 0.4)' : 'rgba(75, 70, 64, 0.3)';
    dCtx.beginPath();
    dCtx.arc(x, y, r, 0, Math.PI * 2);
    dCtx.fill();
  }

  // 2. Weathered Moss in Crevices & Borders
  for (let i = 0; i < 800; i++) {
    const mx = Math.random() * w;
    const my = h - Math.random() * 320; // Concentrated near base
    const mr = Math.random() * 5 + 2;
    dCtx.fillStyle = 'rgba(48, 62, 42, 0.35)'; // Mineral green moss
    dCtx.beginPath();
    dCtx.arc(mx, my, mr, 0, Math.PI * 2);
    dCtx.fill();
  }

  // 3. TOP SECTION: Inti Sun Mask & Chakana Halo
  const sunCx = w / 2;
  const sunCy = 230;

  // Concentric Chakana Stepped Halo
  dCtx.strokeStyle = 'rgba(230, 186, 102, 0.9)'; // Inca gold leaf pigment traces
  dCtx.lineWidth = 5;
  bCtx.strokeStyle = '#282828'; // Deep incised carved relief
  bCtx.lineWidth = 7;
  rCtx.strokeStyle = '#444444'; // Polished stone groove
  rCtx.lineWidth = 6;

  [dCtx, bCtx, rCtx].forEach((ctx) => {
    ctx.beginPath();
    ctx.arc(sunCx, sunCy, 130, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sunCx, sunCy, 105, 0, Math.PI * 2);
    ctx.stroke();

    // 16 Radiating Sunburst Rays
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const x1 = sunCx + Math.cos(angle) * 105;
      const y1 = sunCy + Math.sin(angle) * 105;
      const x2 = sunCx + Math.cos(angle) * 145;
      const y2 = sunCy + Math.sin(angle) * 145;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Solar Mask Face
    ctx.strokeRect(sunCx - 55, sunCy - 55, 110, 110);
    // Almond eyes
    ctx.strokeRect(sunCx - 40, sunCy - 25, 26, 14);
    ctx.strokeRect(sunCx + 14, sunCy - 25, 26, 14);
    // Trapezoidal nose
    ctx.beginPath();
    ctx.moveTo(sunCx, sunCy - 10);
    ctx.lineTo(sunCx - 14, sunCy + 15);
    ctx.lineTo(sunCx + 14, sunCy + 15);
    ctx.closePath();
    ctx.stroke();
    // Mouth
    ctx.strokeRect(sunCx - 28, sunCy + 25, 56, 12);
  });

  // 4. MIDDLE SECTION: 12 Tocapu Inca Geometric Heraldic Glyphs
  const tocapuStartY = 430;
  const cols = 3;
  const rows = 4;
  const cellW = 100;
  const cellH = 90;
  const startX = (w - cols * cellW) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = startX + c * cellW;
      const gy = tocapuStartY + r * cellH;

      [dCtx, bCtx, rCtx].forEach((ctx) => {
        ctx.lineWidth = 3;
        ctx.strokeRect(gx + 6, gy + 6, cellW - 12, cellH - 12);

        const patternType = (r * cols + c) % 4;
        if (patternType === 0) {
          // Checkerboard
          ctx.strokeRect(gx + 12, gy + 12, (cellW - 24) / 2, (cellH - 24) / 2);
          ctx.strokeRect(gx + cellW / 2, gy + cellH / 2, (cellW - 24) / 2, (cellH - 24) / 2);
        } else if (patternType === 1) {
          // Diagonal Chakana cross
          ctx.beginPath();
          ctx.moveTo(gx + 10, gy + 10);
          ctx.lineTo(gx + cellW - 10, gy + cellH - 10);
          ctx.moveTo(gx + cellW - 10, gy + 10);
          ctx.lineTo(gx + 10, gy + cellH - 10);
          ctx.stroke();
        } else if (patternType === 2) {
          // Concentric diamonds
          ctx.beginPath();
          ctx.moveTo(gx + cellW / 2, gy + 12);
          ctx.lineTo(gx + cellW - 12, gy + cellH / 2);
          ctx.lineTo(gx + cellW / 2, gy + cellH - 12);
          ctx.lineTo(gx + 12, gy + cellH / 2);
          ctx.closePath();
          ctx.stroke();
        } else {
          // Stepped terraces (Andenes)
          for (let step = 0; step < 3; step++) {
            ctx.strokeRect(gx + 16 + step * 10, gy + 16 + step * 16, cellW - 32 - step * 20, 10);
          }
        }
      });
    }
  }

  // 5. BOTTOM SECTION: Zoomorphic Serpent (Amaru) Chiseled Frieze
  const friezeY = 860;
  [dCtx, bCtx, rCtx].forEach((ctx) => {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(40, friezeY);
    for (let x = 40; x <= w - 40; x += 30) {
      const sy = friezeY + Math.sin((x / 40) * Math.PI) * 28;
      ctx.lineTo(x, sy);
    }
    ctx.stroke();

    // Stepped border frame
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 40, w - 60, h - 80);
  });

  const diffMap = new THREE.CanvasTexture(diffCanvas);
  diffMap.wrapS = THREE.ClampToEdgeWrapping;
  diffMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughMap = new THREE.CanvasTexture(roughCanvas);

  return { map: diffMap, bumpMap, roughnessMap: roughMap };
}

export class SteleManager {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public steleMesh: THREE.Mesh;
  public pos: THREE.Vector3;
  public isInspecting: boolean = false;

  // Quechua Dialect Player Progression
  public dialectLevel: number = 2;
  public dialectXP: number = 45;
  public maxDialectXP: number = 100;

  // UI Modal Container
  private modalContainer: HTMLDivElement | null = null;

  constructor(scene: THREE.Scene, position: THREE.Vector3 = new THREE.Vector3(38, 0, 36)) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Incan_Stele_Solstice';

    const gy = getGlobalTerrainHeight(position.x, position.z);
    this.pos = new THREE.Vector3(position.x, gy, position.z);
    this.group.position.copy(this.pos);

    // 1. Procedural PBR Relief Material
    const { map, bumpMap, roughnessMap } = createMonolithTextures();
    const steleMat = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.045,
      roughnessMap,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.25,
    });

    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x302d2a,
      roughness: 0.94,
      metalness: 0.02,
    });

    // 2. Stepped Chakana Plinth Base
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.28, 1.5), plinthMat);
    base1.position.y = 0.14;
    base1.castShadow = true;
    base1.receiveShadow = true;
    this.group.add(base1);

    const base2 = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.25, 1.15), plinthMat);
    base2.position.y = 0.38;
    base2.castShadow = true;
    base2.receiveShadow = true;
    this.group.add(base2);

    // 3. Upright Carved Andesite Monolith Slab
    const slabGeo = new THREE.BoxGeometry(1.35, 3.6, 0.52);
    // Bevel top shoulders (Inca monolith crown)
    const posAttr = slabGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const x = posAttr.getX(i);
      if (y > 1.4) {
        if (Math.abs(x) > 0.45) {
          posAttr.setY(i, y - 0.25);
        }
      }
    }
    slabGeo.computeVertexNormals();

    this.steleMesh = new THREE.Mesh(slabGeo, steleMat);
    this.steleMesh.position.y = 0.48 + 1.8;
    this.steleMesh.castShadow = true;
    this.steleMesh.receiveShadow = true;
    this.group.add(this.steleMesh);

    this.scene.add(this.group);
    this.initUIModal();
  }

  public canInteract(playerPos: THREE.Vector3): boolean {
    const dist = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    return dist <= 3.2;
  }

  public toggleInspect(
    character: CharacterController,
    camera: THREE.Camera,
    hud?: SottrHUD,
    audio?: AudioDirector
  ): void {
    this.isInspecting = !this.isInspecting;

    if (this.isInspecting) {
      // 1. Character examination posture facing the stele
      const standPos = this.pos.clone().add(new THREE.Vector3(0, 0, 1.45));
      standPos.y = getGlobalTerrainHeight(standPos.x, standPos.z);
      character.mesh.position.copy(standPos);
      character.mesh.lookAt(this.pos.x, standPos.y, this.pos.z);

      // 2. Award Dialect XP
      this.dialectXP += SUN_STELE_LORE.xpAwarded;
      if (this.dialectXP >= this.maxDialectXP) {
        this.dialectLevel++;
        this.dialectXP -= this.maxDialectXP;
      }

      // 3. Audio & HUD
      if (audio) {
        audio.play('quena', { volume: 0.75 });
      }
      if (hud) {
        hud.setObjective('DECIPHERING STELE', 'Studying ancient Quechua inscriptions on the Solstice Monolith.');
        hud.setCinematicMode(true);
      }

      // 4. Open SOTTR Translation Modal
      this.openModal();
    } else {
      if (hud) {
        hud.setCinematicMode(false);
      }
      this.closeModal();
    }
  }

  // ==========================================================================
  // SOTTR-Style Archaeological Translation Modal DOM
  // ==========================================================================

  private initUIModal(): void {
    if (typeof document === 'undefined') return;

    const modal = document.createElement('div');
    modal.id = 'stele-translation-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.display = 'none';
    modal.style.zIndex = '65';
    modal.style.pointerEvents = 'auto';
    modal.style.background =
      'radial-gradient(ellipse at center, rgba(12, 16, 14, 0.7) 0%, rgba(6, 9, 8, 0.94) 100%)';
    modal.style.color = '#f1f5f9';
    modal.style.fontFamily = "'Cinzel', 'Trebuchet MS', serif";

    document.body.appendChild(modal);
    this.modalContainer = modal;
  }

  public openModal(): void {
    if (!this.modalContainer) return;
    this.modalContainer.style.display = 'flex';
    this.renderModalContent();
  }

  public closeModal(): void {
    if (!this.modalContainer) return;
    this.modalContainer.style.display = 'none';
  }

  private renderModalContent(): void {
    if (!this.modalContainer) return;

    const progressPct = Math.min(100, Math.round((this.dialectXP / this.maxDialectXP) * 100));

    this.modalContainer.innerHTML = `
      <div style="margin: auto; width: 680px; max-width: 90vw; background: rgba(18, 24, 21, 0.95); border: 1px solid rgba(212, 163, 75, 0.4); border-radius: 8px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.85); padding: 36px 44px; box-sizing: border-box;">
        
        <!-- Header: Monolith Classification & Dialect -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 1px solid rgba(212, 163, 75, 0.25); padding-bottom: 16px;">
          <div>
            <span style="font-size: 11px; letter-spacing: 3px; color: #d4a34b; text-transform: uppercase; font-weight: 700;">Archaeological Discovery</span>
            <h1 style="margin: 4px 0 0 0; font-size: 24px; color: #f8fafc; letter-spacing: 1.5px;">${SUN_STELE_LORE.name}</h1>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #94a3b8; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1px;">DIALECT FLUENCY</div>
            <div style="font-size: 14px; color: #ffd875; font-weight: 700;">QUECHUA • LEVEL ${this.dialectLevel}</div>
          </div>
        </div>

        <!-- Language XP Progress Bar -->
        <div style="margin-bottom: 26px; background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-family: sans-serif; margin-bottom: 6px;">
            <span style="color: #4ade80; font-weight: 700;">+${SUN_STELE_LORE.xpAwarded} Quechua Dialect XP</span>
            <span style="color: #cbd5e1;">${this.dialectXP} / ${this.maxDialectXP} XP (${progressPct}%)</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #16a34a, #4ade80); border-radius: 3px;"></div>
          </div>
        </div>

        <!-- Quechua Phonetic Inscription -->
        <div style="margin-bottom: 22px;">
          <h4 style="margin: 0 0 8px 0; font-size: 11px; letter-spacing: 2px; color: #d4a34b; text-transform: uppercase;">Quechua Inscription</h4>
          <p style="margin: 0; font-size: 15px; font-style: italic; color: #fde68a; line-height: 1.6; font-family: 'Cinzel', serif;">
            "${SUN_STELE_LORE.quechuaText}"
          </p>
        </div>

        <!-- English Archaeological Translation -->
        <div style="margin-bottom: 24px; padding: 18px 20px; background: rgba(0, 0, 0, 0.3); border-left: 3px solid #d4a34b; border-radius: 0 6px 6px 0;">
          <h4 style="margin: 0 0 8px 0; font-size: 11px; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase;">Translation</h4>
          <p style="margin: 0; font-size: 14px; color: #e2e8f0; line-height: 1.55; font-family: sans-serif;">
            ${SUN_STELE_LORE.englishText}
          </p>
        </div>

        <!-- Secret Unlocked / Map Marker Update -->
        <div style="display: flex; align-items: center; gap: 14px; padding: 12px 18px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; margin-bottom: 28px;">
          <div style="font-size: 20px;">🗺️</div>
          <div style="font-family: sans-serif; font-size: 12px; color: #bae6fd;">
            <b>ARCHAEOLOGICAL CODEX UNLOCKED:</b> ${SUN_STELE_LORE.secretUnlocked}
          </div>
        </div>

        <!-- Close Button -->
        <div style="text-align: right;">
          <button id="btn-close-stele" style="
            padding: 12px 28px;
            background: linear-gradient(135deg, #b45309, #78350f);
            border: 1px solid #f59e0b;
            color: #fff;
            font-family: inherit;
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 2px;
            cursor: pointer;
            border-radius: 4px;
          ">
            CONTINUE EXPEDITION [E]
          </button>
        </div>
      </div>
    `;

    this.modalContainer.querySelector('#btn-close-stele')?.addEventListener('click', () => {
      this.closeModal();
      this.isInspecting = false;
    });
  }

  public dispose(): void {
    if (this.modalContainer && this.modalContainer.parentElement) {
      this.modalContainer.parentElement.removeChild(this.modalContainer);
    }
    this.scene.remove(this.group);
  }
}
