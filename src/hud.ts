/**
 * SOTTR HUD — Shadow of the Tomb Raider Minimalist Cinematic Interface
 *
 * Implements:
 * 1. Top-Center Dynamic Azimuth Compass Ribbon with Cardinal Ticks & Objective Markers
 * 2. Top-Left Mission Objective Tracker with Incan gold typography
 * 3. Bottom-Right Survival Gear & Ballistic Arrow Ammo Counter
 * 4. Contextual Interaction Prompt Widget
 * 5. Anamorphic 2.39:1 Cinematic Letterbox Bars
 */
import * as THREE from 'three';

export interface ObjectiveData {
  title: string;
  task: string;
  worldTarget?: THREE.Vector3;
}

export class SOTTRHUD {
  private container: HTMLDivElement;
  private compassContainer: HTMLDivElement;
  private compassTape: HTMLDivElement;
  private objectiveContainer: HTMLDivElement;
  private gearContainer: HTMLDivElement;
  private promptContainer: HTMLDivElement;
  private topLetterbox: HTMLDivElement;
  private bottomLetterbox: HTMLDivElement;

  private currentObjective: ObjectiveData = {
    title: 'SOLSTICE SANCTUM',
    task: 'Uncover the sacred secrets of the Coricancha Sun Temple',
    worldTarget: new THREE.Vector3(35, 12, -58.5),
  };

  private arrowCount: number = 16;
  private maxArrows: number = 16;
  private activeGear: 'bow' | 'axe' | 'torch' = 'bow';
  private isCinematic: boolean = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'sottr-hud-root';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '9000';
    this.container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

    // 1. Cinematic Letterbox Bars (Top & Bottom)
    this.topLetterbox = document.createElement('div');
    this.topLetterbox.style.position = 'absolute';
    this.topLetterbox.style.top = '0';
    this.topLetterbox.style.left = '0';
    this.topLetterbox.style.width = '100%';
    this.topLetterbox.style.height = '0px';
    this.topLetterbox.style.background = '#0a0d0b';
    this.topLetterbox.style.transition = 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    this.container.appendChild(this.topLetterbox);

    this.bottomLetterbox = document.createElement('div');
    this.bottomLetterbox.style.position = 'absolute';
    this.bottomLetterbox.style.bottom = '0';
    this.bottomLetterbox.style.left = '0';
    this.bottomLetterbox.style.width = '100%';
    this.bottomLetterbox.style.height = '0px';
    this.bottomLetterbox.style.background = '#0a0d0b';
    this.bottomLetterbox.style.transition = 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    this.container.appendChild(this.bottomLetterbox);

    // 2. Top-Center Compass Ribbon
    this.compassContainer = document.createElement('div');
    this.compassContainer.style.position = 'absolute';
    this.compassContainer.style.top = '22px';
    this.compassContainer.style.left = '50%';
    this.compassContainer.style.transform = 'translateX(-50%)';
    this.compassContainer.style.width = '420px';
    this.compassContainer.style.height = '36px';
    this.compassContainer.style.overflow = 'hidden';
    this.compassContainer.style.maskImage = 'linear-gradient(to right, transparent, black 25%, black 75%, transparent)';
    this.compassContainer.style.webkitMaskImage = 'linear-gradient(to right, transparent, black 25%, black 75%, transparent)';

    // Compass indicator marker (Gold arrow pointing down)
    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.top = '0px';
    marker.style.left = '50%';
    marker.style.transform = 'translateX(-50%)';
    marker.style.width = '0';
    marker.style.height = '0';
    marker.style.borderLeft = '5px solid transparent';
    marker.style.borderRight = '5px solid transparent';
    marker.style.borderTop = '7px solid #d4af58';
    marker.style.zIndex = '2';
    this.compassContainer.appendChild(marker);

    // Compass Tape (Moving strip with degree ticks and cardinal points)
    this.compassTape = document.createElement('div');
    this.compassTape.style.position = 'absolute';
    this.compassTape.style.top = '10px';
    this.compassTape.style.left = '0px';
    this.compassTape.style.height = '24px';
    this.compassTape.style.whiteSpace = 'nowrap';
    this.compassTape.style.color = 'rgba(235, 230, 218, 0.75)';
    this.compassTape.style.fontSize = '11px';
    this.compassTape.style.letterSpacing = '1px';
    this.compassTape.style.fontWeight = '600';
    this.buildCompassTape();
    this.compassContainer.appendChild(this.compassTape);
    this.container.appendChild(this.compassContainer);

    // 3. Top-Left Mission Objective Widget
    this.objectiveContainer = document.createElement('div');
    this.objectiveContainer.style.position = 'absolute';
    this.objectiveContainer.style.top = '26px';
    this.objectiveContainer.style.left = '32px';
    this.objectiveContainer.style.maxWidth = '360px';
    this.objectiveContainer.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.85)';
    this.objectiveContainer.innerHTML = `
      <div style="font-size: 10px; font-weight: 700; color: #d4af58; letter-spacing: 2.2px; text-transform: uppercase; margin-bottom: 3px;">
        ★ ACTIVE OBJECTIVE
      </div>
      <div style="font-size: 17px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; margin-bottom: 2px;">
        ${this.currentObjective.title}
      </div>
      <div style="font-size: 12px; color: #b0c0ae; font-style: italic;">
        ${this.currentObjective.task}
      </div>
    `;
    this.container.appendChild(this.objectiveContainer);

    // 4. Bottom-Right Survival Gear & Recurve Bow Ammo Counter
    this.gearContainer = document.createElement('div');
    this.gearContainer.style.position = 'absolute';
    this.gearContainer.style.bottom = '28px';
    this.gearContainer.style.right = '32px';
    this.gearContainer.style.display = 'flex';
    this.gearContainer.style.flexDirection = 'column';
    this.gearContainer.style.alignItems = 'flex-end';
    this.gearContainer.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.85)';
    this.updateGearDisplay();
    this.container.appendChild(this.gearContainer);

    // 5. Contextual Interaction Prompt
    this.promptContainer = document.createElement('div');
    this.promptContainer.style.position = 'absolute';
    this.promptContainer.style.bottom = '85px';
    this.promptContainer.style.left = '50%';
    this.promptContainer.style.transform = 'translateX(-50%)';
    this.promptContainer.style.background = 'rgba(16, 20, 18, 0.82)';
    this.promptContainer.style.border = '1px solid rgba(212, 175, 88, 0.4)';
    this.promptContainer.style.borderRadius = '20px';
    this.promptContainer.style.padding = '6px 18px';
    this.promptContainer.style.fontSize = '12px';
    this.promptContainer.style.fontWeight = '600';
    this.promptContainer.style.color = '#e8dec5';
    this.promptContainer.style.letterSpacing = '1px';
    this.promptContainer.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.6)';
    this.promptContainer.style.transition = 'opacity 0.3s ease';
    this.promptContainer.innerHTML = `<span style="color: #ffd875; font-weight: 700;">[E]</span> EXAMINE ALTAR`;
    this.container.appendChild(this.promptContainer);

    document.body.appendChild(this.container);
  }

  private buildCompassTape() {
    const points = [
      'N', '15', '30', 'NE', '60', '75', 'E', '105', '120', 'SE', '150', '165',
      'S', '195', '210', 'SW', '240', '255', 'W', '285', '300', 'NW', '330', '345',
      'N', '15', '30', 'NE', '60', '75', 'E', '105', '120', 'SE', '150', '165',
      'S', '195', '210', 'SW', '240', '255', 'W', '285', '300', 'NW', '330', '345',
    ];

    let html = '';
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isCardinal = p === 'N' || p === 'E' || p === 'S' || p === 'W';
      const isInter = p === 'NE' || p === 'SE' || p === 'SW' || p === 'NW';
      const color = isCardinal ? '#ffd777' : (isInter ? '#ffffff' : 'rgba(180, 190, 180, 0.6)');
      const weight = isCardinal ? '700' : (isInter ? '600' : '400');
      html += `<span style="display: inline-block; width: 48px; text-align: center; color: ${color}; font-weight: ${weight};">${p}</span>`;
    }
    this.compassTape.innerHTML = html;
  }

  public setCinematicMode(enabled: boolean) {
    this.isCinematic = enabled;
    const barHeight = enabled ? '52px' : '0px';
    this.topLetterbox.style.height = barHeight;
    this.bottomLetterbox.style.height = barHeight;
    this.compassContainer.style.top = enabled ? '68px' : '22px';
    this.objectiveContainer.style.top = enabled ? '72px' : '26px';
    this.gearContainer.style.bottom = enabled ? '68px' : '28px';
  }

  public setPrompt(text: string | null) {
    if (!text) {
      this.promptContainer.style.opacity = '0';
    } else {
      this.promptContainer.innerHTML = text;
      this.promptContainer.style.opacity = '1';
    }
  }

  public setObjective(title: string, task: string, worldTarget?: THREE.Vector3) {
    this.currentObjective = { title, task, worldTarget };
    this.objectiveContainer.innerHTML = `
      <div style="font-size: 10px; font-weight: 700; color: #d4af58; letter-spacing: 2.2px; text-transform: uppercase; margin-bottom: 3px;">
        ★ ACTIVE OBJECTIVE
      </div>
      <div style="font-size: 17px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; margin-bottom: 2px;">
        ${title}
      </div>
      <div style="font-size: 12px; color: #b0c0ae; font-style: italic;">
        ${task}
      </div>
    `;
  }

  public setAmmo(current: number, max: number = 16) {
    this.arrowCount = current;
    this.maxArrows = max;
    this.updateGearDisplay();
  }

  public setActiveGear(gear: 'bow' | 'axe' | 'torch') {
    this.activeGear = gear;
    this.updateGearDisplay();
  }

  private updateGearDisplay() {
    this.gearContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="font-size: 11px; color: #9ab098; letter-spacing: 1px; text-transform: uppercase;">SURVIVAL RECURVE BOW</span>
        <span style="font-size: 18px; font-weight: 700; color: #ffffff; font-family: monospace;">
          <span style="color: #ffd875;">${this.arrowCount}</span> / ${this.maxArrows}
        </span>
      </div>
      <div style="display: flex; gap: 10px; font-size: 11px; color: #7a8c78; font-weight: 600;">
        <span style="color: ${this.activeGear === 'axe' ? '#ffd875' : '#8a9c88'};">⛏ CLIMBING AXE</span>
        <span>•</span>
        <span style="color: ${this.activeGear === 'torch' ? '#ffd875' : '#8a9c88'};">🔥 PITCH TORCH</span>
      </div>
    `;
  }

  public update(camera: THREE.Camera) {
    // Calculate camera yaw / azimuth angle in degrees (0 to 360)
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let angleRad = Math.atan2(dir.x, dir.z); // Facing angle
    if (angleRad < 0) angleRad += Math.PI * 2;
    const angleDeg = (angleRad * (180 / Math.PI));

    // Pixels per degree: 48px per 15 degrees = 3.2px per degree
    const offsetPx = (angleDeg * 3.2) % (360 * 3.2);
    // Center at width/2 (210px) minus offset
    this.compassTape.style.transform = `translateX(${210 - offsetPx}px)`;
  }

  public dispose() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

export function createSOTTRHUD(): SOTTRHUD {
  return new SOTTRHUD();
}
