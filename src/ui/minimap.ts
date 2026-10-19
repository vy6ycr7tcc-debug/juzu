import * as THREE from 'three/webgpu';

export interface MinimapOptions {
  onOpenWorldMap: () => void;
}

export class Minimap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private playerPos = new THREE.Vector3();
  private playerHeading = 0;
  private onOpenWorldMap: () => void;

  // Major landmarks to draw on the radar
  private landmarks = [
    { name: 'Chakana Gate', x: 120, z: -180, color: '#e8c872' },
    { name: 'Intihuatana', x: 120, z: -165, color: '#ffdd55' },
    { name: 'Cloud Gorge', x: -60, z: 80, color: '#68c4a0' },
    { name: 'Paititi Sanctum', x: 220, z: -80, color: '#f0ad4e' },
    { name: 'Vilcabamba Basin', x: -140, z: -120, color: '#5bc0de' },
  ];

  constructor(options: MinimapOptions) {
    this.onOpenWorldMap = options.onOpenWorldMap;

    // Outer HUD frame
    this.container = document.createElement('div');
    this.container.id = 'juzu-minimap-hud';
    this.container.style.cssText = `
      position: fixed;
      top: 18px;
      left: 18px;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(20,24,28,0.85) 0%, rgba(12,14,18,0.95) 100%);
      border: 2px solid rgba(212, 160, 40, 0.65);
      box-shadow: 0 4px 18px rgba(0,0,0,0.65), inset 0 0 12px rgba(0,0,0,0.8);
      z-index: 40;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: transform 0.15s ease, border-color 0.15s ease;
    `;
    this.container.title = 'Tap to open Expedition World Map';

    this.container.addEventListener('mouseenter', () => {
      this.container.style.transform = 'scale(1.05)';
      this.container.style.borderColor = '#f5eedc';
    });
    this.container.addEventListener('mouseleave', () => {
      this.container.style.transform = 'scale(1.0)';
      this.container.style.borderColor = 'rgba(212, 160, 40, 0.65)';
    });
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpenWorldMap();
    });

    // Radar Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 104;
    this.canvas.height = 104;
    this.canvas.style.cssText = `
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: block;
    `;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Mini map icon badge at bottom
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 9px;
      font-weight: 700;
      color: #e8c872;
      background: rgba(14,16,20,0.92);
      border: 1px solid rgba(212, 160, 40, 0.5);
      padding: 1px 6px;
      border-radius: 8px;
      letter-spacing: 0.08em;
      pointer-events: none;
    `;
    badge.innerText = 'MAP';
    this.container.appendChild(badge);

    document.body.appendChild(this.container);
  }

  public update(playerPos: THREE.Vector3, playerHeading: number): void {
    this.playerPos.copy(playerPos);
    this.playerHeading = playerHeading;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = w * 0.48;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar background grid rings
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(18, 22, 26, 0.88)';
    ctx.fillRect(0, 0, w, h);

    // Range rings (50m, 100m, 150m)
    ctx.strokeStyle = 'rgba(212, 160, 40, 0.16)';
    ctx.lineWidth = 1;
    for (const r of [radius * 0.35, radius * 0.7, radius * 0.95]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cross grid lines
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // 2. Plot Landmarks relative to player
    // Radar scale: radius corresponds to 180 meters
    const radarScale = radius / 180;

    for (const lm of this.landmarks) {
      const dx = lm.x - playerPos.x;
      const dz = lm.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      // Rotate with player orientation so "up" is always the player's view forward
      const angleToTarget = Math.atan2(dx, -dz);
      const relAngle = angleToTarget - playerHeading;

      const rDist = Math.min(dist * radarScale, radius - 6);
      const px = cx + Math.sin(relAngle) * rDist;
      const py = cy - Math.cos(relAngle) * rDist;

      // Landmark pip
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = lm.color;
      ctx.shadowColor = lm.color;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3. Central Player Chevron (gold needle pointing strictly UP)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#f5eedc';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e8c872';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 4. North Indicator 'N' on edge
    const northAngle = -playerHeading;
    const nx = cx + Math.sin(northAngle) * (radius - 9);
    const ny = cy - Math.cos(northAngle) * (radius - 9);

    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#e85d4e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);

    ctx.restore();
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }
}
