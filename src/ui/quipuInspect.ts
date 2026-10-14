/**
 * Module: src/ui/quipuInspect.ts
 * Responsibility: Interactive 3D Quipu Knot Deciphering lightbox overlay for archaeological
 * inspection of Inca knotted cords (khipu) with decimal knots, dye identification, and
 * archival transcription notes per Bible §3.4 and §3.7.
 * Depends on: three, src/core/save.ts.
 * Exports: QuipuInspectOverlay.
 */

import * as THREE from 'three';
import { SaveManager } from '../core/save';

interface QuipuCordData {
  id: number;
  colorName: string;
  hexColor: number;
  fiber: string;
  hundreds: number;
  tens: number;
  units: number;
  total: number;
  interpretation: string;
}

const CORD_DATA: QuipuCordData[] = [
  {
    id: 1,
    colorName: 'Crimson Cochineal',
    hexColor: 0x8a2325,
    fiber: 'Alpaca wool dyed with Kermes cochineal',
    hundreds: 1,
    tens: 2,
    units: 0,
    total: 120,
    interpretation: 'Military Garrison — 120 Sol Negro / Inca outpost vanguard soldiers stationed across the Cloud Forest defensive chokepoints.',
  },
  {
    id: 2,
    colorName: 'Vicuña Golden Amber',
    hexColor: 0xc8963e,
    fiber: 'Rare wild vicuña fleece, reserved for Sapa Inca royalty',
    hundreds: 3,
    tens: 4,
    units: 5,
    total: 345,
    interpretation: 'Imperial Sapa Inca Tribute — 345 fanegas of ceremonial yellow maize harvested from the Urubamba river terraces.',
  },
  {
    id: 3,
    colorName: 'Sacred Indigo Blue',
    hexColor: 0x2d4f7c,
    fiber: 'Highland cotton dyed with fermented indigofera',
    hundreds: 0,
    tens: 1,
    units: 8,
    total: 18,
    interpretation: 'Ceque Line Astronomy — 18 sacred huaca shrines aligned radially from Coricancha toward the June Solstice sunrise.',
  },
  {
    id: 4,
    colorName: 'Unbleached Native Cotton',
    hexColor: 0xd9ceb8,
    fiber: 'Natural Peruvian coastal white and tan raw cotton',
    hundreds: 5,
    tens: 6,
    units: 0,
    total: 560,
    interpretation: 'State Storehouses (Qullqas) — 560 bundles of freeze-dried chuño potato and salted llama charqui stored for winter droughts.',
  },
  {
    id: 5,
    colorName: 'Deep Andean Ochre',
    hexColor: 0xa45b2b,
    fiber: 'Llama wool treated with mineral iron-oxide pigments',
    hundreds: 0,
    tens: 8,
    units: 4,
    total: 84,
    interpretation: 'Metalsmith Foundry — 84 bronze tumi blades and copper chisels forged for the Paititi eastern road masonry.',
  },
  {
    id: 6,
    colorName: 'Vilcabamba Forest Emerald',
    hexColor: 0x2d5a3f,
    fiber: 'Spun wild tree bark bast with vegetable moss dyes',
    hundreds: 2,
    tens: 1,
    units: 3,
    total: 213,
    interpretation: 'Medicinal Herbarium — 213 woven sacks of wild quinquina bark (quinine) and coca leaves dedicated to the Viracocha priestesshood.',
  },
];

export class QuipuInspectOverlay {
  public isOpen: boolean = false;
  private rootEl: HTMLDivElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private infoEl: HTMLDivElement | null = null;
  private cordListEl: HTMLDivElement | null = null;

  // 3D Three.js Viewport
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private quipuGroup: THREE.Group | null = null;
  private cordMeshes: THREE.Group[] = [];
  private selectedCordIndex: number = 1; // Default to vicuña amber

  // Mouse interaction
  private isDragging: boolean = false;
  private previousMouseX: number = 0;
  private rotationAngleY: number = 0.15;
  private targetZoom: number = 3.8;
  private currentZoom: number = 3.8;
  private animFrameId: number | null = null;

  public build(container: HTMLElement): void {
    if (typeof document === 'undefined') return;

    const root = document.createElement('div');
    root.id = 'juzu-quipu-inspect-overlay';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(8, 10, 8, 0.88)',
      'z-index:45',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#e6dac2',
      'user-select:none',
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'width:min(960px, 94vw)',
      'max-height:90vh',
      'background:#1c1813',
      'border:3px solid #7c5e39',
      'border-radius:8px',
      'box-shadow:0 24px 60px rgba(0,0,0,0.85)',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = [
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
      'padding:14px 22px',
      'background:#282017',
      'border-bottom:2px solid #5a4228',
    ].join(';');
    header.innerHTML = `
      <div>
        <h2 style="margin:0;font-size:19px;color:#f0e4cf;letter-spacing:0.04em;">Archaeological Deciphering: Inca Master Quipu</h2>
        <span style="font-size:12px;color:#a89274;">Tribute Register & Astronomical Ceque Calendar (Cusco–Paititi Corridor)</span>
      </div>
      <button id="juzu-quipu-close" style="background:#4a3522;color:#ecdcc4;border:1px solid #7a5c3b;border-radius:4px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:13px;">
        ✕ Close [Esc]
      </button>
    `;
    modal.appendChild(header);

    // Body content: Left 3D Canvas, Right Deciphering Desk
    const body = document.createElement('div');
    body.style.cssText = [
      'display:grid',
      'grid-template-columns:1.2fr 1fr',
      'height:540px',
      'max-height:calc(90vh - 70px)',
      'background:#14110e',
    ].join(';');

    // 3D Canvas Container
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = [
      'position:relative',
      'width:100%',
      'height:100%',
      'cursor:grab',
      'background:radial-gradient(circle at center, #26211a 0%, #0e0c0a 100%)',
      'border-right:1px solid #3c2f21',
    ].join(';');

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    canvasWrap.appendChild(canvas);

    const hint = document.createElement('div');
    hint.style.cssText = [
      'position:absolute',
      'bottom:10px',
      'left:0',
      'right:0',
      'text-align:center',
      'font-size:11.5px',
      'color:#8c775d',
      'pointer-events:none',
    ].join(';');
    hint.textContent = 'Drag to rotate 3D cords • Scroll to zoom • Click cord to inspect';
    canvasWrap.appendChild(hint);

    body.appendChild(canvasWrap);

    // Right Sidebar: Deciphering Transcription Notes
    const desk = document.createElement('div');
    desk.style.cssText = [
      'padding:20px 22px',
      'overflow-y:auto',
      'background:#1c1813',
      'display:flex',
      'flex-direction:column',
      'gap:14px',
    ].join(';');

    // Cord selector pills
    const cordPills = document.createElement('div');
    cordPills.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    desk.appendChild(cordPills);
    this.cordListEl = cordPills;

    // Info card
    const info = document.createElement('div');
    info.style.cssText = [
      'background:#251f18',
      'border:1px solid #4a3825',
      'border-radius:6px',
      'padding:16px',
      'font-size:13.5px',
      'line-height:1.6',
    ].join(';');
    desk.appendChild(info);
    this.infoEl = info;

    body.appendChild(desk);
    modal.appendChild(body);
    root.appendChild(modal);
    container.appendChild(root);

    this.rootEl = root;
    this.canvasEl = canvas;

    // Event listeners
    const closeBtn = root.querySelector('#juzu-quipu-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Canvas orbit drag controls
    canvasWrap.addEventListener('pointerdown', (e: PointerEvent) => {
      this.isDragging = true;
      this.previousMouseX = e.clientX;
      canvasWrap.style.cursor = 'grabbing';
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
      if (canvasWrap) canvasWrap.style.cursor = 'grab';
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMouseX;
      this.previousMouseX = e.clientX;
      this.rotationAngleY += deltaX * 0.012;
    });

    canvasWrap.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + e.deltaY * 0.003, 2.2, 5.2);
    }, { passive: false });

    // Build the Three.js mini viewport
    this.initThreeViewport(canvas);
    this.renderCordPills();
    this.updateInfoPanel();
  }

  private initThreeViewport(canvas: HTMLCanvasElement): void {
    const width = 500;
    const height = 500;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(2.0, window.devicePixelRatio || 1));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 30);
    this.camera.position.set(0, -0.4, this.currentZoom);

    // Warm museum directional light + soft ambient
    const amb = new THREE.AmbientLight(0xfff1de, 1.2);
    const dir = new THREE.DirectionalLight(0xffecc7, 2.4);
    dir.position.set(2, 4, 3);
    const rim = new THREE.DirectionalLight(0x8faec8, 0.9);
    rim.position.set(-2, -1, -2);
    this.scene.add(amb, dir, rim);

    // Build 3D Quipu model
    this.quipuGroup = new THREE.Group();
    this.buildQuipuModel(this.quipuGroup);
    this.scene.add(this.quipuGroup);
  }

  private buildQuipuModel(group: THREE.Group): void {
    // 1. Primary horizontal cord (thick twisted alpaca wool)
    const primaryGeo = new THREE.CylinderGeometry(0.042, 0.042, 2.8, 16);
    primaryGeo.rotateZ(Math.PI / 2);
    const primaryMat = new THREE.MeshStandardMaterial({
      color: 0x5a4128,
      roughness: 0.88,
      metalness: 0.05,
    });
    const primaryMesh = new THREE.Mesh(primaryGeo, primaryMat);
    primaryMesh.position.set(0, 1.0, 0);
    group.add(primaryMesh);

    // Wooden mounting pins at each end
    const pinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12);
    pinGeo.rotateX(Math.PI / 2);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.7 });
    const pinLeft = new THREE.Mesh(pinGeo, pinMat);
    pinLeft.position.set(-1.42, 1.0, 0);
    const pinRight = new THREE.Mesh(pinGeo, pinMat);
    pinRight.position.set(1.42, 1.0, 0);
    group.add(pinLeft, pinRight);

    // 2. Pendant cords with 3D knots
    this.cordMeshes = [];
    const cordSpacing = 0.42;
    const startX = -((CORD_DATA.length - 1) * cordSpacing) * 0.5;

    for (let c = 0; c < CORD_DATA.length; c++) {
      const data = CORD_DATA[c];
      const cordGroup = new THREE.Group();
      cordGroup.position.set(startX + c * cordSpacing, 1.0, 0);

      const cordMat = new THREE.MeshStandardMaterial({
        color: data.hexColor,
        roughness: 0.78,
        metalness: 0.08,
      });

      // Hanging vertical cord
      const cordLength = 1.85 + (c % 3) * 0.12;
      const strandGeo = new THREE.CylinderGeometry(0.02, 0.02, cordLength, 10);
      const strandMesh = new THREE.Mesh(strandGeo, cordMat);
      strandMesh.position.set(0, -cordLength * 0.5, 0);
      cordGroup.add(strandMesh);

      // Top suspension loop over primary cord
      const loopGeo = new THREE.TorusGeometry(0.046, 0.02, 8, 14);
      const loopMesh = new THREE.Mesh(loopGeo, cordMat);
      loopMesh.rotation.y = Math.PI / 2;
      cordGroup.add(loopMesh);

      // Decimal knot clusters:
      // Tier 1: Hundreds (y = -0.32 to -0.48)
      for (let h = 0; h < data.hundreds; h++) {
        const knot = this.createKnotMesh(cordMat, 0.038);
        knot.position.set(0, -0.34 - h * 0.08, 0);
        cordGroup.add(knot);
      }

      // Tier 2: Tens (y = -0.72 to -1.0)
      for (let t = 0; t < data.tens; t++) {
        const knot = this.createKnotMesh(cordMat, 0.034);
        knot.position.set(0, -0.74 - t * 0.07, 0);
        cordGroup.add(knot);
      }

      // Tier 3: Units (multi-turn long knot or figure-eight, y = -1.28 to -1.52)
      if (data.units > 0) {
        const unitKnotGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.05 + data.units * 0.024, 10);
        const unitKnot = new THREE.Mesh(unitKnotGeo, cordMat);
        unitKnot.position.set(0, -1.35, 0);
        cordGroup.add(unitKnot);
      }

      // Small hanging tassel weight at the cord bottom
      const tasselGeo = new THREE.ConeGeometry(0.032, 0.1, 8);
      const tassel = new THREE.Mesh(tasselGeo, cordMat);
      tassel.position.set(0, -cordLength, 0);
      cordGroup.add(tassel);

      this.cordMeshes.push(cordGroup);
      group.add(cordGroup);
    }
  }

  private createKnotMesh(material: THREE.Material, size: number): THREE.Mesh {
    const geo = new THREE.TorusGeometry(size, size * 0.48, 8, 12);
    return new THREE.Mesh(geo, material);
  }

  private renderCordPills(): void {
    if (!this.cordListEl) return;
    this.cordListEl.innerHTML = '';

    for (let i = 0; i < CORD_DATA.length; i++) {
      const data = CORD_DATA[i];
      const btn = document.createElement('button');
      const isSelected = i === this.selectedCordIndex;
      btn.style.cssText = [
        'border-radius:4px',
        `border:2px solid ${isSelected ? '#e8bd78' : '#4a3825'}`,
        `background:${isSelected ? '#382a1d' : '#221b14'}`,
        `color:${isSelected ? '#fff' : '#b09c84'}`,
        'padding:6px 10px',
        'font-size:12px',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'gap:6px',
      ].join(';');

      const dotColor = '#' + data.hexColor.toString(16).padStart(6, '0');
      btn.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};"></span> Cord #${i + 1}`;
      btn.addEventListener('click', () => {
        this.selectedCordIndex = i;
        this.renderCordPills();
        this.updateInfoPanel();
      });
      this.cordListEl.appendChild(btn);
    }
  }

  private updateInfoPanel(): void {
    if (!this.infoEl) return;
    const cord = CORD_DATA[this.selectedCordIndex];
    const dotColor = '#' + cord.hexColor.toString(16).padStart(6, '0');

    this.infoEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;border-bottom:1px solid #4a3825;padding-bottom:8px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};"></span>
        <h3 style="margin:0;font-size:16px;color:#f2e6d2;">Cord #${cord.id}: ${cord.colorName}</h3>
      </div>
      <div style="font-size:12.5px;color:#a89378;margin-bottom:10px;">
        <strong>Fiber &amp; Dye:</strong> ${cord.fiber}
      </div>
      <div style="background:#17130f;border:1px solid #3c2c1c;padding:10px 14px;border-radius:4px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:bold;color:#e6c48a;margin-bottom:6px;">Decoded Inca Decimal Value: ${cord.total}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#c0ad94;">
          <span>Hundreds: <strong>${cord.hundreds}</strong> (× 100)</span>
          <span>Tens: <strong>${cord.tens}</strong> (× 10)</span>
          <span>Units: <strong>${cord.units}</strong></span>
        </div>
      </div>
      <div style="font-size:13px;color:#dfd0ba;">
        <strong style="color:#d4a86a;">Archaeological Interpretation:</strong><br/>
        ${cord.interpretation}
      </div>
    `;
  }

  public open(save?: SaveManager): void {
    this.isOpen = true;
    if (this.rootEl) {
      this.rootEl.style.display = 'flex';
    }
    if (save) {
      save.addJournalEntry(
        'Inca Master Quipu Deciphered: Knot clusters record 120 soldiers, 345 maize fanegas, 18 solstice ceque shrines, and 84 bronze tumi blades.'
      );
    }
    this.startAnimationLoop();
  }

  public close(): void {
    this.isOpen = false;
    if (this.rootEl) {
      this.rootEl.style.display = 'none';
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private startAnimationLoop(): void {
    if (this.animFrameId !== null) return;

    const animate = () => {
      if (!this.isOpen) return;

      // Smooth zoom
      this.currentZoom += (this.targetZoom - this.currentZoom) * 0.1;
      if (this.camera) {
        this.camera.position.z = this.currentZoom;
      }

      // Smooth auto gentle sway when idle
      if (!this.isDragging) {
        this.rotationAngleY += 0.003;
      }

      if (this.quipuGroup) {
        this.quipuGroup.rotation.y = this.rotationAngleY;
        this.quipuGroup.rotation.x = Math.sin(this.rotationAngleY * 0.5) * 0.08;
      }

      // Highlight selected cord with slight pulse
      const t = Date.now() * 0.004;
      for (let i = 0; i < this.cordMeshes.length; i++) {
        const mesh = this.cordMeshes[i];
        if (i === this.selectedCordIndex) {
          mesh.scale.set(1.12, 1.0, 1.12);
          mesh.position.z = 0.08 + Math.sin(t) * 0.02;
        } else {
          mesh.scale.set(1.0, 1.0, 1.0);
          mesh.position.z = 0.0;
        }
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  public dispose(): void {
    this.close();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
