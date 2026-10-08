/**
 * SOTTR HUD — Shadow of the Tomb Raider Minimalist Cinematic Interface
 *
 * Implements:
 * 1. Top-Center Dynamic Azimuth Compass Ribbon with Cardinal Ticks & Objective Markers
 * 2. Top-Left Mission Objective Tracker with Incan gold typography
 * 3. Bottom-Right Survival Gear & Ballistic Arrow Ammo Counter
 * 4. Contextual Interaction Prompt Widget
 * 5. Anamorphic 2.39:1 Cinematic Letterbox Bars
 * 6. Authentic Tomb Raider Expedition Topographic Map with real-time GPS, POIs & Nav Beacon
 */
import * as THREE from 'three';

export interface ObjectiveData {
  title: string;
  task: string;
  worldTarget?: THREE.Vector3;
}

export interface MapLandmark {
  id: string;
  name: string;
  category: 'temple' | 'bridge' | 'cistern' | 'climb' | 'dive' | 'relic' | 'camp' | 'poi';
  pos: THREE.Vector3;
  icon: string;
  color: string;
  summary: string;
  labelAlign?: 'top' | 'bottom' | 'left' | 'right';
}

export const MAP_LANDMARKS: MapLandmark[] = [
  {
    id: 'coricancha_sanctum',
    name: 'Solstice Sanctum (Coricancha)',
    category: 'temple',
    pos: new THREE.Vector3(35, 12, -72),
    icon: '🏛️',
    color: '#ffd777',
    summary: 'Ancient Inca Sun Temple sanctuary holding the sacred solar relic altar.',
    labelAlign: 'top',
  },
  {
    id: 'inti_altar',
    name: 'Sacred Altar of Inti',
    category: 'relic',
    pos: new THREE.Vector3(68, 2.5, -57.1),
    icon: '☀️',
    color: '#f5c542',
    summary: 'Chiseled stone altar displaying the golden Inti Solar Effigy.',
    labelAlign: 'right',
  },
  {
    id: 'inca_crypt',
    name: 'Crypt Puzzle Corridor',
    category: 'temple',
    pos: new THREE.Vector3(35, 2.2, -48),
    icon: '🏺',
    color: '#e0a96d',
    summary: 'Stepped pressure-plate trap corridor with suspended spiked portcullis.',
    labelAlign: 'bottom',
  },
  {
    id: 'hydraulic_cistern',
    name: 'Hydraulic Cistern & Sluice Gate',
    category: 'cistern',
    pos: new THREE.Vector3(48, -2, -24),
    icon: '⚙️',
    color: '#68d8d6',
    summary: 'Ancient rotary bronze water wheel controlling canyon irrigation sluice gates.',
    labelAlign: 'right',
  },
  {
    id: 'rope_bridge',
    name: "Q'eswachaka Suspension Bridge",
    category: 'bridge',
    pos: new THREE.Vector3(-14, 20, 0),
    icon: '🌉',
    color: '#d8b26e',
    summary: 'Handwoven grass-rope bridge spanning 100m across the Urubamba canyon.',
    labelAlign: 'left',
  },
  {
    id: 'cenote_basin',
    name: 'Cenote Deep Dive Basin',
    category: 'dive',
    pos: new THREE.Vector3(-16, -3.8, 16),
    icon: '🌊',
    color: '#38b2ac',
    summary: 'Submerged subterranean river cavern with emerald depths and air pockets.',
    labelAlign: 'left',
  },
  {
    id: 'craggy_cliff',
    name: 'Craggy Axe Climbing Wall',
    category: 'climb',
    pos: new THREE.Vector3(45, 12, 18),
    icon: '⛏️',
    color: '#cbd5e1',
    summary: 'Vertical porous granite cliff face requiring dual climbing ice picks.',
    labelAlign: 'right',
  },
  {
    id: 'highlands_camp',
    name: 'Highlands Base Camp',
    category: 'camp',
    pos: new THREE.Vector3(50, 1.2, 50),
    icon: '⛺',
    color: '#86efac',
    summary: 'Sheltered campfire terrace overlooking the canyon and mountain terraces.',
  },
  {
    id: 'cliff_staircase',
    name: 'Cliff Staircase',
    category: 'poi',
    pos: new THREE.Vector3(200, 0, 80),
    icon: '🧗',
    color: '#fbcfe8',
    summary: 'Ancient stepped mountain path carved into the sheer canyon wall.',
  },
  {
    id: 'excavated_ruin',
    name: 'Excavated Ruin Pit',
    category: 'poi',
    pos: new THREE.Vector3(150, 0, -300),
    icon: '⛏️',
    color: '#c4b5fd',
    summary: 'Raw-earth excavation pit crawling with archaeological equipment.',
  },
  {
    id: 'quipu_archive',
    name: 'Quipu Knot Archive',
    category: 'poi',
    pos: new THREE.Vector3(150, 0, -350),
    icon: '📜',
    color: '#fed7aa',
    summary: 'Underground chamber housing ancient knotted Incan quipu records.',
  },
  {
    id: 'tomas_blockade',
    name: 'Tayta Tomas (Blockade)',
    category: 'poi',
    pos: new THREE.Vector3(-100, 24.8, -500),
    icon: '🧔',
    color: '#86efac',
    summary: 'Quechua community elder organizing resistance against Sol Negro bulldozers.',
    labelAlign: 'bottom',
  },
  {
    id: 'vance_chakana',
    name: 'Dr. Elias Vance (Chakana)',
    category: 'poi',
    pos: new THREE.Vector3(-78, 48.0, 448),
    icon: '📚',
    color: '#cbd5e1',
    summary: 'Academic consultant debating the astronomical meaning of the Chakana gate.',
    labelAlign: 'top',
  },
  {
    id: 'vargas_outpost',
    name: 'Vargas (Sol Negro Outpost)',
    category: 'poi',
    pos: new THREE.Vector3(120, 68.0, 650),
    icon: '🎖️',
    color: '#f87171',
    summary: 'Leader of Sol Negro resource extraction front overseeing illegal demolitions.',
    labelAlign: 'right',
  },
];

export interface JournalEntryData {
  id: string;
  act: number;
  entryNumber: string;
  title: string;
  date: string;
  audioDuration: string;
  transcript: string;
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
  private mapButton: HTMLButtonElement;
  private journalButton: HTMLButtonElement;

  // Expedition Journal Elements
  public isJournalOpen: boolean = false;
  private journalModal: HTMLDivElement;
  private journalListEl: HTMLDivElement;
  private journalReaderEl: HTMLDivElement;
  private journalEntries: JournalEntryData[] = [];
  private selectedJournalIndex: number = 0;

  // Expedition Map Elements
  public isMapOpen: boolean = false;
  private mapModal: HTMLDivElement;
  private mapCanvas: HTMLCanvasElement;
  private mapCtx: CanvasRenderingContext2D | null = null;
  private mapElevationEl: HTMLSpanElement;
  private mapRegionEl: HTMLSpanElement;
  private mapObjectiveBar: HTMLDivElement;
  private mapPanX: number = 0;
  private mapPanZ: number = 0;
  private mapZoom: number = 1.0;
  private isMapDragging: boolean = false;
  private mapDragStartX: number = 0;
  private mapDragStartY: number = 0;
  private mapStartPanX: number = 0;
  private mapStartPanZ: number = 0;
  private cachedPlayerPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private cachedCameraYaw: number = 0;

  private currentObjective: ObjectiveData = {
    title: 'SOLSTICE SANCTUM',
    task: 'Uncover the sacred secrets of the Coricancha Sun Temple',
    worldTarget: new THREE.Vector3(35, 12, -72),
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
    this.promptContainer.style.opacity = '0';
    this.promptContainer.style.transition = 'opacity 0.3s ease';
    this.container.appendChild(this.promptContainer);

    // 6. Top-Right HUD Map Button (clickable on desktop & mobile)
    this.mapButton = document.createElement('button');
    this.mapButton.id = 'hud-map-btn';
    this.mapButton.style.position = 'absolute';
    this.mapButton.style.top = '24px';
    this.mapButton.style.right = '32px';
    this.mapButton.style.pointerEvents = 'auto';
    this.mapButton.style.background = 'rgba(18, 24, 20, 0.88)';
    this.mapButton.style.border = '1px solid rgba(212, 175, 88, 0.6)';
    this.mapButton.style.borderRadius = '6px';
    this.mapButton.style.padding = '8px 16px';
    this.mapButton.style.color = '#ffd777';
    this.mapButton.style.fontSize = '11px';
    this.mapButton.style.fontWeight = '700';
    this.mapButton.style.letterSpacing = '1.5px';
    this.mapButton.style.cursor = 'pointer';
    this.mapButton.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.6)';
    this.mapButton.style.transition = 'all 0.2s ease';
    this.mapButton.innerHTML = `🗺️ MAP <span style="color: rgba(255,255,255,0.7); font-size: 10px; margin-left: 4px;">[M]</span>`;
    this.mapButton.addEventListener('mouseenter', () => {
      this.mapButton.style.background = 'rgba(32, 42, 36, 0.95)';
      this.mapButton.style.borderColor = '#ffd777';
      this.mapButton.style.transform = 'scale(1.04)';
    });
    this.mapButton.addEventListener('mouseleave', () => {
      this.mapButton.style.background = 'rgba(18, 24, 20, 0.88)';
      this.mapButton.style.borderColor = 'rgba(212, 175, 88, 0.6)';
      this.mapButton.style.transform = 'scale(1.0)';
    });
    this.mapButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMap();
    });
    this.container.appendChild(this.mapButton);

    // 6b. Top-Right HUD Journal Button
    this.journalButton = document.createElement('button');
    this.journalButton.id = 'hud-journal-btn';
    this.journalButton.style.position = 'absolute';
    this.journalButton.style.top = '24px';
    this.journalButton.style.right = '164px';
    this.journalButton.style.pointerEvents = 'auto';
    this.journalButton.style.background = 'rgba(18, 24, 20, 0.88)';
    this.journalButton.style.border = '1px solid rgba(212, 175, 88, 0.6)';
    this.journalButton.style.borderRadius = '6px';
    this.journalButton.style.padding = '8px 16px';
    this.journalButton.style.color = '#ffd777';
    this.journalButton.style.fontSize = '11px';
    this.journalButton.style.fontWeight = '700';
    this.journalButton.style.letterSpacing = '1.5px';
    this.journalButton.style.cursor = 'pointer';
    this.journalButton.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.6)';
    this.journalButton.style.transition = 'all 0.2s ease';
    this.journalButton.innerHTML = `📖 JOURNAL <span style="color: rgba(255,255,255,0.7); font-size: 10px; margin-left: 4px;">[J]</span>`;
    this.journalButton.addEventListener('mouseenter', () => {
      this.journalButton.style.background = 'rgba(32, 42, 36, 0.95)';
      this.journalButton.style.borderColor = '#ffd777';
      this.journalButton.style.transform = 'scale(1.04)';
    });
    this.journalButton.addEventListener('mouseleave', () => {
      this.journalButton.style.background = 'rgba(18, 24, 20, 0.88)';
      this.journalButton.style.borderColor = 'rgba(212, 175, 88, 0.6)';
      this.journalButton.style.transform = 'scale(1.0)';
    });
    this.journalButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleJournal();
    });
    this.container.appendChild(this.journalButton);

    // 7. Fullscreen Tomb Raider Expedition Topographic Map Modal
    this.mapModal = document.createElement('div');
    this.mapModal.id = 'expedition-map-modal';
    this.mapModal.style.position = 'fixed';
    this.mapModal.style.top = '0';
    this.mapModal.style.left = '0';
    this.mapModal.style.width = '100vw';
    this.mapModal.style.height = '100vh';
    this.mapModal.style.background = 'radial-gradient(ellipse at center, rgba(16, 22, 18, 0.96) 0%, rgba(8, 12, 10, 0.99) 100%)';
    this.mapModal.style.zIndex = '9500';
    this.mapModal.style.display = 'none';
    this.mapModal.style.flexDirection = 'column';
    this.mapModal.style.boxSizing = 'border-box';
    this.mapModal.style.padding = '18px 28px';
    this.mapModal.style.userSelect = 'none';
    this.mapModal.style.color = '#e8dec5';

    // Map Header Bar
    const mapHeader = document.createElement('div');
    mapHeader.style.display = 'flex';
    mapHeader.style.justifyContent = 'space-between';
    mapHeader.style.alignItems = 'center';
    mapHeader.style.paddingBottom = '12px';
    mapHeader.style.borderBottom = '1px solid rgba(212, 175, 88, 0.35)';

    const titleGroup = document.createElement('div');
    titleGroup.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px; color: #ffd777;">★</span>
        <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">
          EXPEDITION TOPOGRAPHIC MAP
        </span>
      </div>
      <div style="font-size: 11px; color: #9ab098; letter-spacing: 1.2px; margin-top: 3px;">
        SECTOR IV: URUBAMBA RIVER VALLEY • INCA ANDES HIGHLANDS
      </div>
    `;
    mapHeader.appendChild(titleGroup);

    const statsGroup = document.createElement('div');
    statsGroup.style.display = 'flex';
    statsGroup.style.gap = '20px';
    statsGroup.style.fontSize = '12px';
    statsGroup.style.fontWeight = '600';
    statsGroup.style.color = '#d4af58';

    this.mapRegionEl = document.createElement('span');
    this.mapRegionEl.textContent = 'REGION: HIGHLANDS VALLEY';
    statsGroup.appendChild(this.mapRegionEl);

    this.mapElevationEl = document.createElement('span');
    this.mapElevationEl.textContent = 'ELEVATION: 2,430m ASL';
    statsGroup.appendChild(this.mapElevationEl);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ CLOSE [M / ESC]';
    closeBtn.style.background = 'rgba(212, 175, 88, 0.15)';
    closeBtn.style.border = '1px solid rgba(212, 175, 88, 0.6)';
    closeBtn.style.color = '#ffd777';
    closeBtn.style.padding = '6px 14px';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.fontWeight = '700';
    closeBtn.style.fontSize = '11px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.addEventListener('click', () => this.closeMap());
    statsGroup.appendChild(closeBtn);

    mapHeader.appendChild(statsGroup);
    this.mapModal.appendChild(mapHeader);

    // Active Objective Banner Strip
    this.mapObjectiveBar = document.createElement('div');
    this.mapObjectiveBar.style.padding = '8px 14px';
    this.mapObjectiveBar.style.margin = '10px 0';
    this.mapObjectiveBar.style.background = 'rgba(212, 175, 88, 0.12)';
    this.mapObjectiveBar.style.border = '1px solid rgba(212, 175, 88, 0.3)';
    this.mapObjectiveBar.style.borderRadius = '4px';
    this.mapObjectiveBar.style.fontSize = '12px';
    this.mapObjectiveBar.style.color = '#ffd875';
    this.mapObjectiveBar.style.display = 'flex';
    this.mapObjectiveBar.style.alignItems = 'center';
    this.mapObjectiveBar.style.gap = '10px';
    this.mapObjectiveBar.innerHTML = `
      <span style="font-weight: 800;">★ ACTIVE WAYPOINT:</span>
      <span style="color: #ffffff; font-weight: 600;">${this.currentObjective.title}</span>
      <span style="color: #9ab098;">— ${this.currentObjective.task}</span>
    `;
    this.mapModal.appendChild(this.mapObjectiveBar);

    // Map Canvas Container with Antique Bronze Frame
    const canvasWrap = document.createElement('div');
    canvasWrap.style.position = 'relative';
    canvasWrap.style.flex = '1';
    canvasWrap.style.width = '100%';
    canvasWrap.style.minHeight = '320px';
    canvasWrap.style.background = '#0e1411';
    canvasWrap.style.border = '2px solid rgba(212, 175, 88, 0.35)';
    canvasWrap.style.borderRadius = '6px';
    canvasWrap.style.overflow = 'hidden';
    canvasWrap.style.boxShadow = 'inset 0 0 40px rgba(0,0,0,0.85), 0 8px 32px rgba(0,0,0,0.7)';

    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.style.width = '100%';
    this.mapCanvas.style.height = '100%';
    this.mapCanvas.style.display = 'block';
    this.mapCanvas.style.cursor = 'grab';
    canvasWrap.appendChild(this.mapCanvas);

    // Canvas Interactive Zoom & Recenter Controls Overlay
    const mapControls = document.createElement('div');
    mapControls.style.position = 'absolute';
    mapControls.style.bottom = '18px';
    mapControls.style.right = '18px';
    mapControls.style.display = 'flex';
    mapControls.style.flexDirection = 'column';
    mapControls.style.gap = '8px';
    mapControls.style.zIndex = '5';

    const makeBtn = (text: string, title: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.title = title;
      b.style.background = 'rgba(18, 24, 20, 0.9)';
      b.style.border = '1px solid rgba(212, 175, 88, 0.5)';
      b.style.color = '#ffd777';
      b.style.width = '36px';
      b.style.height = '36px';
      b.style.borderRadius = '4px';
      b.style.fontSize = '16px';
      b.style.fontWeight = 'bold';
      b.style.cursor = 'pointer';
      b.style.display = 'flex';
      b.style.alignItems = 'center';
      b.style.justifyContent = 'center';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };

    mapControls.appendChild(makeBtn('+', 'Zoom In', () => {
      this.mapZoom = Math.min(3.2, this.mapZoom * 1.25);
      this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
    }));
    mapControls.appendChild(makeBtn('−', 'Zoom Out', () => {
      this.mapZoom = Math.max(0.45, this.mapZoom / 1.25);
      this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
    }));
    const centerBtn = document.createElement('button');
    centerBtn.innerHTML = '⌖';
    centerBtn.title = 'Recenter on Player (Space)';
    centerBtn.style.background = 'rgba(18, 24, 20, 0.9)';
    centerBtn.style.border = '1px solid rgba(212, 175, 88, 0.5)';
    centerBtn.style.color = '#ffd777';
    centerBtn.style.width = '36px';
    centerBtn.style.height = '36px';
    centerBtn.style.borderRadius = '4px';
    centerBtn.style.fontSize = '18px';
    centerBtn.style.cursor = 'pointer';
    centerBtn.style.display = 'flex';
    centerBtn.style.alignItems = 'center';
    centerBtn.style.justifyContent = 'center';
    centerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.recenterOnPlayer();
    });
    mapControls.appendChild(centerBtn);
    canvasWrap.appendChild(mapControls);

    this.mapModal.appendChild(canvasWrap);

    // Map Footer with Legend & Instructions
    const mapFooter = document.createElement('div');
    mapFooter.style.display = 'flex';
    mapFooter.style.justifyContent = 'space-between';
    mapFooter.style.alignItems = 'center';
    mapFooter.style.paddingTop = '12px';
    mapFooter.style.borderTop = '1px solid rgba(212, 175, 88, 0.25)';
    mapFooter.style.fontSize = '11px';

    const legendGroup = document.createElement('div');
    legendGroup.style.display = 'flex';
    legendGroup.style.gap = '14px';
    legendGroup.style.color = '#a0b0a2';
    legendGroup.innerHTML = `
      <span><b style="color: #ffd777;">🏛️</b> Sun Temple / Sanctum</span>
      <span><b style="color: #d8b26e;">🌉</b> Rope Bridge</span>
      <span><b style="color: #68d8d6;">⚙️</b> Sluice Mechanism</span>
      <span><b style="color: #cbd5e1;">⛏️</b> Climbing Wall</span>
      <span><b style="color: #f5c542;">☀️</b> Sacred Relic</span>
      <span><b style="color: #38b2ac;">🌊</b> Cenote Dive</span>
      <span><b style="color: #ffd777;">●</b> Player GPS</span>
    `;
    mapFooter.appendChild(legendGroup);

    const hintsGroup = document.createElement('div');
    hintsGroup.style.color = '#8a9c88';
    hintsGroup.style.fontWeight = '600';
    hintsGroup.innerHTML = `[DRAG] PAN • [SCROLL] ZOOM • [SPACE] RECENTER • [M / ESC] CLOSE`;
    mapFooter.appendChild(hintsGroup);

    this.mapModal.appendChild(mapFooter);

    // 8. Fullscreen Tomb Raider Archaeological Field Journal Modal
    this.journalModal = document.createElement('div');
    this.journalModal.id = 'expedition-journal-modal';
    this.journalModal.style.position = 'fixed';
    this.journalModal.style.top = '0';
    this.journalModal.style.left = '0';
    this.journalModal.style.width = '100vw';
    this.journalModal.style.height = '100vh';
    this.journalModal.style.background = 'radial-gradient(ellipse at center, rgba(16, 22, 18, 0.97) 0%, rgba(8, 12, 10, 0.99) 100%)';
    this.journalModal.style.zIndex = '9600';
    this.journalModal.style.display = 'none';
    this.journalModal.style.flexDirection = 'column';
    this.journalModal.style.boxSizing = 'border-box';
    this.journalModal.style.padding = '22px 34px';
    this.journalModal.style.userSelect = 'none';
    this.journalModal.style.color = '#e8dec5';

    // Journal Header Bar
    const jHeader = document.createElement('div');
    jHeader.style.display = 'flex';
    jHeader.style.justifyContent = 'space-between';
    jHeader.style.alignItems = 'center';
    jHeader.style.paddingBottom = '14px';
    jHeader.style.borderBottom = '1px solid rgba(212, 175, 88, 0.35)';

    const jTitle = document.createElement('div');
    jTitle.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px; color: #ffd777;">★</span>
        <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">
          NAIRA'S ARCHAEOLOGICAL FIELD JOURNAL
        </span>
      </div>
      <div style="font-size: 11px; color: #9ab098; letter-spacing: 1.2px; margin-top: 3px;">
        EXPEDITION AUDIO TRANSCRIPTS & RECOVERED LORE
      </div>
    `;
    jHeader.appendChild(jTitle);

    const jClose = document.createElement('button');
    jClose.textContent = '✕ CLOSE [J / ESC]';
    jClose.style.background = 'rgba(212, 175, 88, 0.15)';
    jClose.style.border = '1px solid rgba(212, 175, 88, 0.6)';
    jClose.style.color = '#ffd777';
    jClose.style.padding = '6px 14px';
    jClose.style.borderRadius = '4px';
    jClose.style.fontWeight = '700';
    jClose.style.fontSize = '11px';
    jClose.style.cursor = 'pointer';
    jClose.addEventListener('click', () => this.closeJournal());
    jHeader.appendChild(jClose);
    this.journalModal.appendChild(jHeader);

    // Journal Content Body (2 columns)
    const jBody = document.createElement('div');
    jBody.style.display = 'flex';
    jBody.style.flex = '1';
    jBody.style.gap = '24px';
    jBody.style.marginTop = '18px';
    jBody.style.minHeight = '0';

    this.journalListEl = document.createElement('div');
    this.journalListEl.style.width = '320px';
    this.journalListEl.style.borderRight = '1px solid rgba(212, 175, 88, 0.25)';
    this.journalListEl.style.overflowY = 'auto';
    this.journalListEl.style.paddingRight = '14px';
    jBody.appendChild(this.journalListEl);

    this.journalReaderEl = document.createElement('div');
    this.journalReaderEl.style.flex = '1';
    this.journalReaderEl.style.overflowY = 'auto';
    this.journalReaderEl.style.padding = '16px 28px';
    this.journalReaderEl.style.background = 'rgba(10, 14, 12, 0.65)';
    this.journalReaderEl.style.border = '1px solid rgba(212, 175, 88, 0.25)';
    this.journalReaderEl.style.borderRadius = '6px';
    jBody.appendChild(this.journalReaderEl);

    this.journalModal.appendChild(jBody);

    // Journal Footer
    const jFooter = document.createElement('div');
    jFooter.style.paddingTop = '14px';
    jFooter.style.borderTop = '1px solid rgba(212, 175, 88, 0.25)';
    jFooter.style.display = 'flex';
    jFooter.style.justifyContent = 'space-between';
    jFooter.style.fontSize = '11px';
    jFooter.style.color = '#8a9c88';
    jFooter.innerHTML = `
      <span>[CLICK] SELECT LOG • [J / ESC] CLOSE</span>
      <span style="color: #ffd777;">ARCHAEOLOGICAL FIELD ARCHIVE • ANTISUYU EXPEDITION</span>
    `;
    this.journalModal.appendChild(jFooter);

    document.body.appendChild(this.container);
    document.body.appendChild(this.mapModal);
    document.body.appendChild(this.journalModal);

    // Setup Canvas Drag & Zoom Events
    this.setupMapInteraction();

    // Global Keyboard Shortcuts: [M] toggles map, [J] toggles journal, [ESC] closes
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggleMap();
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        this.toggleJournal();
      } else if (e.code === 'Escape') {
        if (this.isJournalOpen) {
          e.preventDefault();
          this.closeJournal();
        } else if (this.isMapOpen) {
          e.preventDefault();
          this.closeMap();
        }
      } else if (e.code === 'Space' && this.isMapOpen) {
        e.preventDefault();
        this.recenterOnPlayer();
      }
    });

    window.addEventListener('resize', () => {
      if (this.isMapOpen) {
        this.resizeCanvas();
        this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
      }
    });
  }

  private setupMapInteraction() {
    this.mapCanvas.addEventListener('mousedown', (e) => {
      this.isMapDragging = true;
      this.mapCanvas.style.cursor = 'grabbing';
      this.mapDragStartX = e.clientX;
      this.mapDragStartY = e.clientY;
      this.mapStartPanX = this.mapPanX;
      this.mapStartPanZ = this.mapPanZ;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMapDragging) return;
      const dx = e.clientX - this.mapDragStartX;
      const dy = e.clientY - this.mapDragStartY;
      const scale = 2.4 * this.mapZoom;
      this.mapPanX = this.mapStartPanX - dx / scale;
      this.mapPanZ = this.mapStartPanZ - dy / scale;
      this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
    });

    window.addEventListener('mouseup', () => {
      if (this.isMapDragging) {
        this.isMapDragging = false;
        this.mapCanvas.style.cursor = 'grab';
      }
    });

    this.mapCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      this.mapZoom = Math.max(0.45, Math.min(3.2, this.mapZoom * zoomFactor));
      this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
    }, { passive: false });

    // Touch support for mobile dragging
    this.mapCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isMapDragging = true;
        this.mapDragStartX = e.touches[0].clientX;
        this.mapDragStartY = e.touches[0].clientY;
        this.mapStartPanX = this.mapPanX;
        this.mapStartPanZ = this.mapPanZ;
      }
    }, { passive: true });

    this.mapCanvas.addEventListener('touchmove', (e) => {
      if (!this.isMapDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.mapDragStartX;
      const dy = e.touches[0].clientY - this.mapDragStartY;
      const scale = 2.4 * this.mapZoom;
      this.mapPanX = this.mapStartPanX - dx / scale;
      this.mapPanZ = this.mapStartPanZ - dy / scale;
      this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
    }, { passive: true });

    this.mapCanvas.addEventListener('touchend', () => {
      this.isMapDragging = false;
    });
  }

  public toggleMap(playerPos?: THREE.Vector3, cameraYaw?: number) {
    if (this.isMapOpen) {
      this.closeMap();
    } else {
      this.openMap(playerPos, cameraYaw);
    }
  }

  public openMap(playerPos?: THREE.Vector3, cameraYaw?: number) {
    this.isMapOpen = true;
    this.mapModal.style.display = 'flex';
    if (playerPos) {
      this.cachedPlayerPos.copy(playerPos);
      this.mapPanX = playerPos.x;
      this.mapPanZ = playerPos.z;
    }
    if (cameraYaw !== undefined) {
      this.cachedCameraYaw = cameraYaw;
    }
    this.resizeCanvas();
    this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
  }

  public closeMap() {
    this.isMapOpen = false;
    this.mapModal.style.display = 'none';
  }

  public recenterOnPlayer() {
    this.mapPanX = this.cachedPlayerPos.x;
    this.mapPanZ = this.cachedPlayerPos.z;
    this.mapZoom = 1.0;
    this.drawMap(this.cachedPlayerPos, this.cachedCameraYaw);
  }

  private resizeCanvas() {
    const rect = this.mapCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.mapCanvas.width = rect.width * dpr;
    this.mapCanvas.height = rect.height * dpr;
    this.mapCtx = this.mapCanvas.getContext('2d');
    if (this.mapCtx) {
      this.mapCtx.scale(dpr, dpr);
    }
  }

  public drawMap(playerPos: THREE.Vector3, cameraYaw: number) {
    if (!this.mapCtx || !this.mapCanvas) return;
    const ctx = this.mapCtx;
    const rect = this.mapCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear background: antique deep expedition cartography charcoal
    ctx.fillStyle = '#101713';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = 2.4 * this.mapZoom;

    const toScreenX = (wx: number) => cx + (wx - this.mapPanX) * scale;
    const toScreenY = (wz: number) => cy + (wz - this.mapPanZ) * scale;

    // 1. Draw Topographic Coordinate Grid (50m squares)
    ctx.strokeStyle = 'rgba(212, 175, 88, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    const minGridX = Math.floor((this.mapPanX - cx / scale) / gridSize) * gridSize;
    const maxGridX = Math.ceil((this.mapPanX + cx / scale) / gridSize) * gridSize;
    const minGridZ = Math.floor((this.mapPanZ - cy / scale) / gridSize) * gridSize;
    const maxGridZ = Math.ceil((this.mapPanZ + cy / scale) / gridSize) * gridSize;

    for (let gx = minGridX; gx <= maxGridX; gx += gridSize) {
      const sx = toScreenX(gx);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (let gz = minGridZ; gz <= maxGridZ; gz += gridSize) {
      const sy = toScreenY(gz);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // 2. Topographic Elevation Isobar Contours (Andean Terraces & Mountain Ridges)
    ctx.strokeStyle = 'rgba(160, 190, 168, 0.14)';
    ctx.lineWidth = 1.2;
    for (let r = 40; r <= 320; r += 35) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.12) {
        const rad = r + Math.sin(a * 4 + r * 0.1) * 10 + Math.cos(a * 2) * 14;
        const wx = Math.cos(a) * rad * 1.35;
        const wz = Math.sin(a) * rad;
        const sx = toScreenX(wx);
        const sy = toScreenY(wz);
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 3. Draw River Urubamba Waterway Ribbon
    ctx.beginPath();
    ctx.strokeStyle = '#1a4448';
    ctx.lineWidth = 22 * scale * 0.35;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let z = -500; z <= 300; z += 25) {
      const x = Math.sin(z * 0.015) * 14 + Math.cos(z * 0.005) * 8;
      const sx = toScreenX(x);
      const sy = toScreenY(z);
      if (z === -500) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // River Center Specular Flow Line
    ctx.beginPath();
    ctx.strokeStyle = '#38b2ac';
    ctx.lineWidth = 2.5;
    for (let z = -500; z <= 300; z += 25) {
      const x = Math.sin(z * 0.015) * 14 + Math.cos(z * 0.005) * 8;
      const sx = toScreenX(x);
      const sy = toScreenY(z);
      if (z === -500) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // 4. Draw Waypoint Trail & Pulsing Beacon for Active Objective
    if (this.currentObjective.worldTarget) {
      const obj = this.currentObjective.worldTarget;
      const pX = toScreenX(playerPos.x);
      const pY = toScreenY(playerPos.z);
      const tX = toScreenX(obj.x);
      const tY = toScreenY(obj.z);

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(performance.now() * 0.025) % 14;
      ctx.strokeStyle = 'rgba(255, 215, 119, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.moveTo(pX, pY);
      ctx.lineTo(tX, tY);
      ctx.stroke();
      ctx.restore();

      // Pulsing Objective Ring at Target
      const pulse = 1.0 + Math.sin(performance.now() * 0.006) * 0.28;
      ctx.beginPath();
      ctx.arc(tX, tY, 18 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd777';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Target Label with distance readout
      const distM = Math.round(playerPos.distanceTo(obj));
      ctx.font = '700 12px sans-serif';
      ctx.fillStyle = '#ffd777';
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      ctx.fillText(`★ ${this.currentObjective.title} (${distM}m)`, tX, tY - 26);
      ctx.shadowBlur = 0;
    }

    // 5. Draw Major Landmarks & Discoveries
    for (const lm of MAP_LANDMARKS) {
      const sx = toScreenX(lm.pos.x);
      const sy = toScreenY(lm.pos.z);

      // Icon badge
      ctx.beginPath();
      ctx.arc(sx, sy, 15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 22, 18, 0.94)';
      ctx.fill();
      ctx.strokeStyle = lm.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Emoji/Icon
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lm.icon, sx, sy + 1);

      // Landmark Name Label with Directional Alignment
      ctx.font = '700 11px sans-serif';
      ctx.fillStyle = '#e8dec5';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 6;
      const align = lm.labelAlign || 'bottom';
      if (align === 'top') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(lm.name, sx, sy - 18);
      } else if (align === 'left') {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(lm.name, sx - 20, sy);
      } else if (align === 'right') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(lm.name, sx + 20, sy);
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(lm.name, sx, sy + 20);
      }
      ctx.shadowBlur = 0;
    }

    // 6. Draw Player GPS Pin & 66° Sight Cone
    const px = toScreenX(playerPos.x);
    const py = toScreenY(playerPos.z);

    // Sight cone (semi-transparent gold fan)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, py);
    const coneAngle = 0.58; // ~33° half-angle for 66° FoV
    const mapYaw = cameraYaw - Math.PI / 2;
    ctx.arc(px, py, 52 * scale * 0.35, mapYaw - coneAngle, mapYaw + coneAngle);
    ctx.closePath();
    const coneGrad = ctx.createRadialGradient(px, py, 2, px, py, 52 * scale * 0.35);
    coneGrad.addColorStop(0, 'rgba(255, 215, 119, 0.50)');
    coneGrad.addColorStop(1, 'rgba(255, 215, 119, 0.0)');
    ctx.fillStyle = coneGrad;
    ctx.fill();
    ctx.restore();

    // Player Marker Circle
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd777';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Player Title
    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#ffd777';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.fillText('YOU (Michelle)', px, py - 14);
    ctx.shadowBlur = 0;

    // 7. Ornate Golden Compass Rose (Top-Right)
    const crX = width - 50;
    const crY = 50;
    ctx.save();
    ctx.beginPath();
    ctx.arc(crX, crY, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 24, 20, 0.88)';
    ctx.fill();
    ctx.strokeStyle = '#d4af58';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // North Needle
    ctx.beginPath();
    ctx.moveTo(crX, crY - 20);
    ctx.lineTo(crX - 6, crY);
    ctx.lineTo(crX + 6, crY);
    ctx.closePath();
    ctx.fillStyle = '#ffd777';
    ctx.fill();

    // South Needle
    ctx.beginPath();
    ctx.moveTo(crX, crY + 20);
    ctx.lineTo(crX - 6, crY);
    ctx.lineTo(crX + 6, crY);
    ctx.closePath();
    ctx.fillStyle = '#6b7f6a';
    ctx.fill();

    ctx.font = '800 11px sans-serif';
    ctx.fillStyle = '#ffd777';
    ctx.textAlign = 'center';
    ctx.fillText('N', crX, crY - 25);
    ctx.restore();

    // 8. Distance Scale Bar (Bottom-Left)
    const sbX = 35;
    const sbY = height - 25;
    const barMeters = 50;
    const barPx = barMeters * scale;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY);
    ctx.lineTo(sbX + barPx, sbY);
    ctx.moveTo(sbX, sbY - 5);
    ctx.lineTo(sbX, sbY + 5);
    ctx.moveTo(sbX + barPx, sbY - 5);
    ctx.lineTo(sbX + barPx, sbY + 5);
    ctx.strokeStyle = '#d4af58';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '700 11px monospace';
    ctx.fillStyle = '#e8dec5';
    ctx.textAlign = 'left';
    ctx.fillText('50 METERS', sbX + barPx + 10, sbY + 4);
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
    this.mapObjectiveBar.innerHTML = `
      <span style="font-weight: 800;">★ ACTIVE WAYPOINT:</span>
      <span style="color: #ffffff; font-weight: 600;">${title}</span>
      <span style="color: #9ab098;">— ${task}</span>
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

  public update(camera: THREE.Camera, playerPos?: THREE.Vector3) {
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

    if (playerPos) {
      this.cachedPlayerPos.copy(playerPos);
      this.cachedCameraYaw = Math.atan2(dir.x, -dir.z);

      if (this.isMapOpen) {
        // Update altitude & region readout
        const altM = Math.round(playerPos.y + 2420);
        this.mapElevationEl.textContent = `ELEVATION: ${altM}m ASL`;

        let regionName = 'URUBAMBA CANYON';
        if (playerPos.z < -45) regionName = 'SOLSTICE SANCTUM';
        else if (playerPos.z > 200 || playerPos.y > 35) regionName = 'HIGH SIERRA PASS';
        else if (playerPos.x > 30) regionName = 'CLOUD FOREST';
        this.mapRegionEl.textContent = `REGION: ${regionName}`;

        this.drawMap(playerPos, this.cachedCameraYaw);
      }
    }
  }

  public openJournal() {
    this.isJournalOpen = true;
    if (this.isMapOpen) this.closeMap();
    this.journalModal.style.display = 'flex';
    this.renderJournal();
  }

  public closeJournal() {
    this.isJournalOpen = false;
    this.journalModal.style.display = 'none';
  }

  public toggleJournal() {
    if (this.isJournalOpen) this.closeJournal();
    else this.openJournal();
  }

  public setJournalEntries(entries: JournalEntryData[]) {
    this.journalEntries = entries;
    if (this.isJournalOpen) this.renderJournal();
  }

  public selectJournalEntry(index: number) {
    if (index >= 0 && index < this.journalEntries.length) {
      this.selectedJournalIndex = index;
      this.renderJournal();
    }
  }

  private renderJournal() {
    this.journalListEl.innerHTML = '';
    this.journalReaderEl.innerHTML = '';

    if (this.journalEntries.length === 0) {
      this.journalListEl.innerHTML = '<div style="color: #8a9c88; padding: 12px; font-size: 12px;">No recovered field entries yet.</div>';
      this.journalReaderEl.innerHTML = '<div style="color: #8a9c88; padding: 24px; font-size: 13px;">Explore the Antisuyu regions to discover voice notes and quipu records.</div>';
      return;
    }

    // Render list
    this.journalEntries.forEach((entry, idx) => {
      const item = document.createElement('div');
      item.style.padding = '10px 12px';
      item.style.marginBottom = '6px';
      item.style.borderRadius = '4px';
      item.style.cursor = 'pointer';
      item.style.transition = 'all 0.15s ease';
      const isSelected = idx === this.selectedJournalIndex;
      item.style.background = isSelected ? 'rgba(212, 175, 88, 0.20)' : 'rgba(255, 255, 255, 0.03)';
      item.style.border = isSelected ? '1px solid rgba(212, 175, 88, 0.7)' : '1px solid rgba(212, 175, 88, 0.15)';

      item.innerHTML = `
        <div style="font-size: 10px; color: ${isSelected ? '#ffd777' : '#9ab098'}; font-weight: 700; letter-spacing: 1px;">
          ${entry.entryNumber} • ACT ${entry.act}
        </div>
        <div style="font-size: 12px; font-weight: 700; color: #ffffff; margin-top: 2px;">
          ${entry.title}
        </div>
        <div style="font-size: 10px; color: #7a8c78; margin-top: 2px;">
          ⏱ ${entry.audioDuration} • ${entry.date}
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectJournalEntry(idx);
      });
      this.journalListEl.appendChild(item);
    });

    // Render active entry reader
    const active = this.journalEntries[this.selectedJournalIndex] || this.journalEntries[0];
    if (active) {
      this.journalReaderEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(212, 175, 88, 0.25); padding-bottom: 12px;">
          <div>
            <div style="font-size: 11px; color: #ffd777; font-weight: 800; letter-spacing: 1.5px;">
              ${active.entryNumber} • ACT ${active.act}
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 1.2px; margin-top: 3px;">
              ${active.title}
            </div>
            <div style="font-size: 11px; color: #9ab098; margin-top: 4px;">
              📅 ${active.date} • VOICE MEMO TRANSCRIPT
            </div>
          </div>
          <button style="background: rgba(212, 175, 88, 0.2); border: 1px solid #ffd777; color: #ffd777; border-radius: 4px; padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer;">
            ▶ PLAY VOICE NOTE (${active.audioDuration})
          </button>
        </div>

        <div style="margin-top: 18px; font-size: 14px; line-height: 1.7; color: #f0ede6; font-style: italic; background: rgba(0,0,0,0.25); padding: 18px; border-radius: 6px; border-left: 3px solid #ffd777;">
          "${active.transcript}"
        </div>

        <div style="margin-top: 18px; font-size: 12px; color: #a0af9f; line-height: 1.5;">
          <b style="color: #d4af58;">ARCHAEOLOGICAL COMMENTARY:</b> Primary audio field recording synced from Naira's field recorder. Cross-referenced with Santa Leonor de Jucul quipu catalogs and Jesuit archives.
        </div>
      `;
    }
  }

  public dispose() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    if (this.mapModal && this.mapModal.parentElement) {
      this.mapModal.parentElement.removeChild(this.mapModal);
    }
    if (this.journalModal && this.journalModal.parentElement) {
      this.journalModal.parentElement.removeChild(this.journalModal);
    }
  }
}

export function createSOTTRHUD(): SOTTRHUD {
  return new SOTTRHUD();
}
