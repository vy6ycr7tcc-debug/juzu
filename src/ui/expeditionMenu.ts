import * as THREE from 'three/webgpu';
import type { AudioEngine } from '../core/audio';
import type { WeaponManager } from '../player/weapon';

export interface ExpeditionMenuOptions {
  audio: AudioEngine;
  weapon: WeaponManager;
  onFastTravel: (pos: THREE.Vector3) => void;
}

export type MenuTab = 'map' | 'inventory' | 'journal' | 'settings';

interface InventoryItem {
  id: string;
  name: string;
  category: 'weapon' | 'gear' | 'relic' | 'supply';
  icon: string;
  desc: string;
  lore: string;
  stats?: string;
  quantity?: number;
  equipped?: boolean;
}

interface Waypoint {
  id: string;
  name: string;
  region: string;
  pos: THREE.Vector3;
  desc: string;
  discovered: boolean;
}

export class ExpeditionMenu {
  private overlay: HTMLElement;
  private activeTab: MenuTab = 'map';
  private audio: AudioEngine;
  private weapon: WeaponManager;
  private onFastTravel: (pos: THREE.Vector3) => void;

  public isOpen = false;
  private playerPos = new THREE.Vector3();
  private playerHeading = 0;

  // Map canvas
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapCtx: CanvasRenderingContext2D | null = null;

  // Inventory state
  private items: InventoryItem[] = [
    {
      id: 'sidearm',
      name: 'Colt M1911 Expedition Sidearm',
      category: 'weapon',
      icon: '🔫',
      desc: 'Blued-steel vintage semi-automatic pistol with hand-checkered walnut grip panels.',
      lore: 'Carried through the cloud passes of Vilcabamba. Dependable in torrential Andean rains.',
      stats: 'Caliber: .45 ACP | Capacity: 7 rounds | Condition: Pristine',
      equipped: true,
    },
    {
      id: 'grapple',
      name: 'Hemp & Bronze Grappling Hook',
      category: 'gear',
      icon: '🪝',
      desc: 'Forged Inca bronze triple-fluke anchor spliced with 22-meter mountain hemp climbing cordage.',
      lore: 'Excavated from a chasqui runner cache. Allows traversal across sheer canyon abysses.',
      stats: 'Range: 22m | Tensile Limit: 1200kg | Material: Arsenical Bronze',
      equipped: true,
    },
    {
      id: 'tunic',
      name: 'Machu Picchu Explorer Tunic',
      category: 'gear',
      icon: '🥋',
      desc: 'Double-woven slate-teal alpaca homespun tunic with geometric Quechua diamond trim.',
      lore: 'Insulates against freezing mountain gusts while remaining lightweight during rock scrambles.',
      stats: 'Protection: Weatherproof | Weight: 1.2kg',
      equipped: true,
    },
    {
      id: 'boots',
      name: 'Cordovan Mountaineering Boots',
      category: 'gear',
      icon: '🥾',
      desc: 'Heavy waxed leather field boots with lugged soles and brass eyelets.',
      lore: 'Crafted to grip slick river pebbles and jagged granite scree.',
      stats: 'Traction: High | Water Resistance: 100%',
      equipped: true,
    },
    {
      id: 'chakana_key',
      name: 'Golden Chakana Keystone',
      category: 'relic',
      icon: '✨',
      desc: '12-cornered Inca stepped cross cast in solid gold with a central solar alignment aperture.',
      lore: 'The harmonic seal to the Intihuatana Gate. When solstice rays penetrate its center, the citadel yields its secrets.',
      stats: 'Ancient Purity: 24k Gold | Era: Tawantinsuyu',
    },
    {
      id: 'quipu',
      name: 'Royal Quipu Knot Record',
      category: 'relic',
      icon: '🧶',
      desc: 'Coded knotted alpaca cords dyed with cochineal and indigo.',
      lore: 'A master quipucamayoc astronomical calendar mapping celestial alignments over the Sacred Valley.',
      stats: 'Knots: 108 | Language: Knotted Quechua decimal',
    },
    {
      id: 'ammo_box',
      name: '.45 ACP Ball Cartridges',
      category: 'supply',
      icon: '📦',
      desc: 'Watertight brass-sealed cartridge box with 230-grain full metal jacket rounds.',
      lore: 'Standard military expedition ammunition reserves.',
      stats: 'Rounds Remaining: 28',
      quantity: 28,
    },
    {
      id: 'coca_poultice',
      name: 'Sacred Coca Leaf Salve',
      category: 'supply',
      icon: '🌿',
      desc: 'Crushed dried coca leaves mixed with wild mountain mint and resin.',
      lore: 'Chewed and applied by Chasqui messengers to stave off altitude fatigue and revive stamina.',
      stats: 'Restores 100% Stamina & Focus',
      quantity: 4,
    },
  ];

  private selectedItemId = 'sidearm';

  // Discovered Fast-Travel Waypoints
  private waypoints: Waypoint[] = [
    {
      id: 'wp_sierra',
      name: 'Chakana Gate Plaza',
      region: 'High Sierra',
      pos: new THREE.Vector3(120, 18.5, -180),
      desc: 'Megalithic ashlar portal overlooking the sun-drenched alpine terraces.',
      discovered: true,
    },
    {
      id: 'wp_gnomon',
      name: 'Intihuatana Sun Dial',
      region: 'High Sierra',
      pos: new THREE.Vector3(120, 22.8, -165),
      desc: 'Sacred granite solstice gnomon tied to the zenith passage of Inti.',
      discovered: true,
    },
    {
      id: 'wp_gorge',
      name: 'Cloud Forest Abutment',
      region: 'Cloud Forest',
      pos: new THREE.Vector3(-60, 8.0, 80),
      desc: 'Suspension bridge towers piercing through the dense misty mountain canopy.',
      discovered: true,
    },
    {
      id: 'wp_paititi',
      name: 'Paititi Golden Sanctuary',
      region: 'Paititi',
      pos: new THREE.Vector3(220, 12.0, -80),
      desc: 'Sunken megalithic courtyards adorned with gilded reliefs.',
      discovered: true,
    },
  ];

  constructor(options: ExpeditionMenuOptions) {
    this.audio = options.audio;
    this.weapon = options.weapon;
    this.onFastTravel = options.onFastTravel;

    // Create root modal DOM
    this.overlay = document.createElement('div');
    this.overlay.id = 'juzu-expedition-menu';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 12, 16, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 100;
      display: none;
      flex-direction: column;
      color: #f5eedc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    `;

    document.body.appendChild(this.overlay);

    // Keyboard listener (Tab, M, I, Esc)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        if (this.isOpen && this.activeTab === 'map') {
          this.close();
        } else {
          this.open('map');
        }
      } else if (e.key === 'i' || e.key === 'I' || e.key === 'Tab') {
        e.preventDefault();
        if (this.isOpen && this.activeTab === 'inventory') {
          this.close();
        } else {
          this.open('inventory');
        }
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  public open(tab: MenuTab = 'map'): void {
    this.isOpen = true;
    this.activeTab = tab;
    this.overlay.style.display = 'flex';
    this.render();
    this.audio.playQuenaNote(520, 0.4);
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.audio.playQuenaNote(380, 0.25);
  }

  public update(playerPos: THREE.Vector3, playerHeading: number): void {
    this.playerPos.copy(playerPos);
    this.playerHeading = playerHeading;
    if (this.isOpen && this.activeTab === 'map') {
      this.drawMap();
    }
  }

  private render(): void {
    this.overlay.innerHTML = `
      <!-- Header Navigation Bar -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        border-bottom: 1px solid rgba(212, 160, 40, 0.25);
        background: rgba(16, 20, 26, 0.9);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid #e8c872;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
          ">✦</div>
          <div>
            <div style="font-size: 18px; font-weight: 700; letter-spacing: 0.1em; color: #f5eedc;">
              EXPEDITION FIELD JOURNAL
            </div>
            <div style="font-size: 11px; color: #e8c872; letter-spacing: 0.08em;">
              TAWANTINSUYU EXPEDITION • NAIRA COVALEDA
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 8px;">
          ${this.renderTabButton('map', '🗺️ WORLD MAP')}
          ${this.renderTabButton('inventory', '🎒 INVENTORY')}
          ${this.renderTabButton('journal', '📜 JOURNAL')}
          ${this.renderTabButton('settings', '⚙️ SETTINGS')}
        </div>

        <!-- Close Button -->
        <button id="juzu-menu-close" style="
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(212, 160, 40, 0.4);
          color: #f5eedc;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        ">✕</button>
      </div>

      <!-- Tab Content Area -->
      <div id="juzu-menu-content" style="
        flex: 1;
        overflow: hidden;
        position: relative;
        display: flex;
      ">
        ${this.renderTabContent()}
      </div>
    `;

    // Bind Close Button
    const closeBtn = this.overlay.querySelector('#juzu-menu-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Bind Tab Switching
    this.overlay.querySelectorAll('[data-tab]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as MenuTab;
        this.activeTab = tab;
        this.render();
      });
    });

    // If map tab is active, initialize canvas
    if (this.activeTab === 'map') {
      this.initMapCanvas();
    } else if (this.activeTab === 'inventory') {
      this.bindInventoryEvents();
    }
  }

  private renderTabButton(tab: MenuTab, label: string): string {
    const isActive = this.activeTab === tab;
    return `
      <button data-tab="${tab}" style="
        padding: 8px 16px;
        background: ${isActive ? 'rgba(212, 160, 40, 0.22)' : 'rgba(255,255,255,0.04)'};
        border: 1px solid ${isActive ? '#e8c872' : 'rgba(255,255,255,0.12)'};
        border-radius: 18px;
        color: ${isActive ? '#f5eedc' : 'rgba(245,238,220,0.65)'};
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.06em;
        cursor: pointer;
        transition: all 0.15s ease;
      ">${label}</button>
    `;
  }

  private renderTabContent(): string {
    switch (this.activeTab) {
      case 'map':
        return this.renderMapTab();
      case 'inventory':
        return this.renderInventoryTab();
      case 'journal':
        return this.renderJournalTab();
      case 'settings':
        return this.renderSettingsTab();
    }
  }

  // 1. MAP TAB
  private renderMapTab(): string {
    return `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <!-- Top Status Coordinates Bar -->
        <div style="
          position: absolute;
          top: 16px;
          left: 24px;
          z-index: 10;
          background: rgba(14, 18, 24, 0.88);
          border: 1px solid rgba(212, 160, 40, 0.4);
          border-radius: 8px;
          padding: 8px 16px;
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: #e8c872;
          backdrop-filter: blur(10px);
        ">
          <div>GPS: <b>X: ${this.playerPos.x.toFixed(1)}</b> | <b>Z: ${this.playerPos.z.toFixed(1)}</b></div>
          <div>Altitude: <b>${this.playerPos.y.toFixed(1)}m</b></div>
          <div>Sector: <b style="color: #f5eedc;">High Sierra Sanctuary</b></div>
        </div>

        <!-- Fast Travel Waypoint List Sidebar -->
        <div style="
          position: absolute;
          top: 72px;
          left: 24px;
          width: 280px;
          max-height: calc(100% - 96px);
          overflow-y: auto;
          z-index: 10;
          background: rgba(14, 18, 24, 0.88);
          border: 1px solid rgba(212, 160, 40, 0.35);
          border-radius: 12px;
          padding: 14px;
          backdrop-filter: blur(12px);
        ">
          <div style="font-size: 12px; font-weight: 700; color: #e8c872; letter-spacing: 0.08em; margin-bottom: 10px;">
            DISCOVERED WAYPOINTS
          </div>
          ${this.waypoints
            .map(
              (wp) => `
            <div data-wp-id="${wp.id}" style="
              background: rgba(255,255,255,0.05);
              border: 1px solid rgba(212,160,40,0.25);
              border-radius: 8px;
              padding: 10px;
              margin-bottom: 8px;
              cursor: pointer;
              transition: all 0.15s ease;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <b style="font-size: 13px; color: #f5eedc;">${wp.name}</b>
                <span style="font-size: 10px; color: #e8c872; background: rgba(212,160,40,0.15); padding: 2px 6px; border-radius: 4px;">FAST TRAVEL</span>
              </div>
              <div style="font-size: 11px; color: rgba(245,238,220,0.65); margin-top: 4px;">${wp.region} • ${wp.desc}</div>
            </div>
          `
            )
            .join('')}
        </div>

        <!-- Incan Parchment Map Canvas -->
        <canvas id="juzu-world-map-canvas" style="
          width: 100%;
          height: 100%;
          display: block;
          background: #181d22;
        "></canvas>
      </div>
    `;
  }

  private initMapCanvas(): void {
    const canvas = this.overlay.querySelector('#juzu-world-map-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    this.mapCanvas = canvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.mapCtx = canvas.getContext('2d');

    // Bind waypoint clicks
    this.overlay.querySelectorAll('[data-wp-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const wpId = (e.currentTarget as HTMLElement).dataset.wpId;
        const target = this.waypoints.find((w) => w.id === wpId);
        if (target) {
          this.onFastTravel(target.pos);
          this.close();
        }
      });
    });

    this.drawMap();
  }

  private drawMap(): void {
    if (!this.mapCanvas || !this.mapCtx) return;
    const ctx = this.mapCtx;
    const w = this.mapCanvas.width;
    const h = this.mapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Parchment Topo Background
    ctx.fillStyle = '#16191f';
    ctx.fillRect(0, 0, w, h);

    // Map coordinate mapping: world [-300, 300] -> canvas bounds
    const worldSize = 600;
    const scale = Math.min(w, h) / worldSize;
    const cx = w * 0.5;
    const cy = h * 0.5;

    const toCanvasX = (worldX: number) => cx + worldX * scale;
    const toCanvasY = (worldZ: number) => cy + worldZ * scale;

    // Topo Contour Rings
    ctx.strokeStyle = 'rgba(212, 160, 40, 0.12)';
    ctx.lineWidth = 1;
    for (let r = 50; r <= 280; r += 35) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // River Line (Urubamba Gorge)
    ctx.strokeStyle = '#3d6878';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(-250), toCanvasY(-200));
    ctx.bezierCurveTo(
      toCanvasX(-100),
      toCanvasY(-50),
      toCanvasX(80),
      toCanvasY(50),
      toCanvasX(240),
      toCanvasY(180)
    );
    ctx.stroke();

    // 2. Draw Waypoints
    for (const wp of this.waypoints) {
      const px = toCanvasX(wp.pos.x);
      const py = toCanvasY(wp.pos.z);

      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c872';
      ctx.shadowColor = '#e8c872';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#f5eedc';
      ctx.textAlign = 'center';
      ctx.fillText(wp.name, px, py - 12);
    }

    // 3. Draw Player Position & Pulsing Beacon
    const plX = toCanvasX(this.playerPos.x);
    const plY = toCanvasY(this.playerPos.z);

    // Pulsing circle
    const pulse = (Date.now() % 1600) / 1600;
    ctx.beginPath();
    ctx.arc(plX, plY, 10 + pulse * 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(232, 200, 114, ${1 - pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Central beacon
    ctx.save();
    ctx.translate(plX, plY);
    ctx.rotate(this.playerHeading);

    ctx.fillStyle = '#e85d4e';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // 2. INVENTORY TAB
  private renderInventoryTab(): string {
    const selectedItem = this.items.find((i) => i.id === this.selectedItemId) || this.items[0];

    return `
      <div style="display: flex; width: 100%; height: 100%; padding: 24px; gap: 24px; box-sizing: border-box;">
        <!-- Left: Equipment & Item Grid -->
        <div style="flex: 2; display: flex; flex-direction: column; overflow-y: auto;">
          <div style="font-size: 13px; font-weight: 700; color: #e8c872; letter-spacing: 0.08em; margin-bottom: 12px;">
            EQUIPPED GEAR & ARTIFACTS
          </div>

          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 14px;
          ">
            ${this.items
              .map((item) => {
                const isSelected = item.id === this.selectedItemId;
                return `
                <div data-item-id="${item.id}" style="
                  background: ${isSelected ? 'rgba(212, 160, 40, 0.22)' : 'rgba(255,255,255,0.04)'};
                  border: 1.5px solid ${isSelected ? '#e8c872' : 'rgba(212,160,40,0.2)'};
                  border-radius: 12px;
                  padding: 14px 10px;
                  text-align: center;
                  cursor: pointer;
                  position: relative;
                  transition: all 0.15s ease;
                ">
                  ${
                    item.equipped
                      ? '<span style="position: absolute; top: 6px; right: 6px; font-size: 9px; color: #e8c872; background: rgba(212,160,40,0.25); padding: 1px 5px; border-radius: 4px;">EQUIPPED</span>'
                      : ''
                  }
                  <div style="font-size: 32px; margin-bottom: 8px;">${item.icon}</div>
                  <div style="font-size: 12px; font-weight: 600; color: #f5eedc; line-height: 1.25;">${item.name}</div>
                  ${item.quantity ? `<div style="font-size: 11px; color: #e8c872; margin-top: 4px;">x${item.quantity}</div>` : ''}
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Right: Item Detail Card -->
        <div style="
          flex: 1.2;
          background: rgba(16, 20, 26, 0.88);
          border: 1px solid rgba(212, 160, 40, 0.35);
          border-radius: 14px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        ">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
            <div style="
              width: 58px;
              height: 58px;
              background: rgba(212, 160, 40, 0.15);
              border: 1px solid rgba(212, 160, 40, 0.45);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 30px;
            ">${selectedItem.icon}</div>
            <div>
              <div style="font-size: 18px; font-weight: 700; color: #f5eedc;">${selectedItem.name}</div>
              <div style="font-size: 12px; color: #e8c872; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">
                ${selectedItem.category}
              </div>
            </div>
          </div>

          <div style="font-size: 13px; line-height: 1.5; color: rgba(245,238,220,0.85); margin-bottom: 16px;">
            ${selectedItem.desc}
          </div>

          <div style="
            background: rgba(0,0,0,0.3);
            border-left: 3px solid #e8c872;
            padding: 10px 14px;
            border-radius: 4px;
            font-size: 12px;
            font-style: italic;
            color: rgba(245,238,220,0.7);
            margin-bottom: 16px;
            line-height: 1.4;
          ">
            "${selectedItem.lore}"
          </div>

          ${
            selectedItem.stats
              ? `
            <div style="
              background: rgba(255,255,255,0.04);
              border-radius: 8px;
              padding: 10px 14px;
              font-size: 12px;
              color: #e8c872;
              margin-bottom: 20px;
            ">
              ${selectedItem.stats}
            </div>
          `
              : ''
          }

          <div style="margin-top: auto;">
            ${
              selectedItem.category === 'weapon'
                ? `
              <button id="juzu-item-action" style="
                width: 100%;
                padding: 12px;
                background: rgba(212, 160, 40, 0.25);
                border: 1px solid #e8c872;
                border-radius: 8px;
                color: #f5eedc;
                font-weight: 700;
                letter-spacing: 0.08em;
                cursor: pointer;
              ">${this.weapon.isAiming ? 'LOWER WEAPON' : 'DRAW & AIM WEAPON'}</button>
            `
                : selectedItem.category === 'supply'
                ? `
              <button id="juzu-item-action" style="
                width: 100%;
                padding: 12px;
                background: rgba(104, 196, 160, 0.25);
                border: 1px solid #68c4a0;
                border-radius: 8px;
                color: #f5eedc;
                font-weight: 700;
                letter-spacing: 0.08em;
                cursor: pointer;
              ">USE SUPPLY</button>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  private bindInventoryEvents(): void {
    this.overlay.querySelectorAll('[data-item-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.itemId;
        if (id) {
          this.selectedItemId = id;
          this.render();
        }
      });
    });

    const actionBtn = this.overlay.querySelector('#juzu-item-action');
    actionBtn?.addEventListener('click', () => {
      if (this.selectedItemId === 'sidearm') {
        this.weapon.toggleAim();
        this.close();
      } else if (this.selectedItemId === 'coca_poultice') {
        this.audio.playQuenaNote(660, 0.6);
        alert('Stamina and altitude resistance fully restored!');
      }
    });
  }

  // 3. JOURNAL TAB
  private renderJournalTab(): string {
    return `
      <div style="padding: 32px 48px; max-width: 720px; overflow-y: auto;">
        <h2 style="color: #e8c872; margin-top: 0;">Expedition Logbook: The Solstice Seal</h2>
        <p style="font-size: 14px; line-height: 1.7; color: rgba(245,238,220,0.88);">
          <i>June 21 — Intihuatana Sanctum, High Sierra</i><br>
          We reached the upper megalithic gate at daybreak. The granite blocks are fitted with laser-like precision—not even a razor blade can pass between the ashlar seams. According to the solar chronicles of Pachacuti, the Intihuatana gnomon anchors the sun at winter solstice.
        </p>
        <p style="font-size: 14px; line-height: 1.7; color: rgba(245,238,220,0.88);">
          To unseal the processional staircase, the Chakana solar aperture must align with the morning beam. The sidearm remains ready in the thigh holster; jaguars and spectacled bears have been spotted prowling the cloud forest below.
        </p>
        <div style="border-top: 1px solid rgba(212,160,40,0.3); padding-top: 16px; margin-top: 24px;">
          <b style="color: #e8c872; font-size: 13px;">CURRENT OBJECTIVES:</b>
          <ul style="font-size: 13px; line-height: 1.8; color: rgba(245,238,220,0.8);">
            <li>Explore the High Sierra terraces and find the Intihuatana Gnomon</li>
            <li>Use the Grappling Hook to traverse canyon chasms</li>
            <li>Align the solar keystone to open the road to Paititi</li>
          </ul>
        </div>
      </div>
    `;
  }

  // 4. SETTINGS TAB
  private renderSettingsTab(): string {
    return `
      <div style="padding: 32px 48px; max-width: 640px; overflow-y: auto;">
        <h2 style="color: #e8c872; margin-top: 0;">Expedition Settings</h2>

        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; color: #f5eedc; margin-bottom: 8px;">Master Volume</label>
          <input type="range" min="0" max="100" value="85" style="width: 100%; accent-color: #e8c872;" />
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; color: #f5eedc; margin-bottom: 8px;">SFX & Gunshot Audio</label>
          <input type="range" min="0" max="100" value="90" style="width: 100%; accent-color: #e8c872;" />
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; color: #f5eedc; margin-bottom: 8px;">Camera Look Sensitivity</label>
          <input type="range" min="1" max="10" value="5" style="width: 100%; accent-color: #e8c872;" />
        </div>

        <div style="margin-bottom: 24px;">
          <label style="font-size: 13px; color: #f5eedc; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" checked style="accent-color: #e8c872;" />
            Mobile Auto-Orientation (Dynamic Portrait / Landscape Optics)
          </label>
        </div>
      </div>
    `;
  }
}
