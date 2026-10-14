/**
 * Module: src/ui/menus.ts
 * Responsibility: Clean vista Title Screen ("Continue Journey" / "New Journey" /
 * "Settings"), Pause Menu (Esc), Settings (Quality Tier, Audio buses, Time-of-Day),
 * and Andean Photo Studio (P) per Bible §3.10 and §3.11.
 * Depends on: src/core/quality.ts, src/core/audio.ts, src/core/save.ts,
 * src/gpu/lightRig.ts, src/gpu/post.ts.
 * Exports: MenusOverlay.
 */

import { QualityManager, QualityTier } from '../core/quality';
import { AudioManager } from '../core/audio';
import { SaveManager } from '../core/save';
import { LightRig, TimeOfDayGrade } from '../gpu/lightRig';
import { PHOTO_PRESETS, PhotoPresetId, PostProcessor } from '../gpu/post';

export class MenusOverlay {
  public isPaused: boolean = false;
  public isPhotoMode: boolean = false;
  private rootEl: HTMLDivElement | null = null;
  private photoBarEl: HTMLDivElement | null = null;

  public build(
    container: HTMLElement,
    quality: QualityManager,
    audio: AudioManager,
    save: SaveManager,
    lightRig: LightRig,
    post: PostProcessor,
    onCapturePng: () => void
  ): void {
    if (typeof document === 'undefined') return;

    // 1. Pause / Settings Modal (Esc)
    const root = document.createElement('div');
    root.id = 'juzu-pause-menu';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(8, 12, 10, 0.76)',
      'z-index:40',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#f2ece1',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'width:min(440px, 90vw)',
      'background:rgba(20, 26, 22, 0.95)',
      'border:1px solid rgba(212, 184, 136, 0.45)',
      'border-radius:4px',
      'padding:26px 30px',
    ].join(';');

    panel.innerHTML = `
      <h2 style="margin:0 0 6px 0;font-size:24px;letter-spacing:0.08em;color:#e6c896;">JUZU</h2>
      <p style="margin:0 0 18px 0;font-size:13px;color:#b8b2a6;">Cloud Forest Valleys — Chapter 1: The Quipu Fragment</p>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px;">
        <button id="juzu-btn-resume" style="padding:9px 14px;background:#3a4a38;color:#f2ece1;border:1px solid #8c7652;cursor:pointer;">Continue Journey</button>
        <button id="juzu-btn-tier" style="padding:9px 14px;background:#252e27;color:#f2ece1;border:1px solid #5c5242;cursor:pointer;">Quality Tier: ${quality.getTier()}</button>
        <button id="juzu-btn-tod" style="padding:9px 14px;background:#252e27;color:#f2ece1;border:1px solid #5c5242;cursor:pointer;">Time of Day: ${lightRig.getGrade().toUpperCase()}</button>
        <button id="juzu-btn-save" style="padding:9px 14px;background:#252e27;color:#f2ece1;border:1px solid #5c5242;cursor:pointer;">Export Save JSON</button>
      </div>
    `;

    root.appendChild(panel);
    container.appendChild(root);
    this.rootEl = root;

    panel.querySelector('#juzu-btn-resume')?.addEventListener('click', () => {
      this.setPaused(false);
    });
    panel.querySelector('#juzu-btn-tier')?.addEventListener('click', e => {
      const order: QualityTier[] = ['HIGH', 'MEDIUM', 'LOW'];
      const next = order[(order.indexOf(quality.getTier()) + 1) % order.length];
      quality.setTier(next);
      (e.currentTarget as HTMLButtonElement).textContent = `Quality Tier: ${next}`;
      audio.playSfx('journal_turn', 0);
    });
    panel.querySelector('#juzu-btn-tod')?.addEventListener('click', e => {
      const order: TimeOfDayGrade[] = ['dawn', 'noon', 'afternoon', 'dusk', 'night'];
      const next = order[(order.indexOf(lightRig.getGrade()) + 1) % order.length];
      lightRig.applyGrade(next);
      (e.currentTarget as HTMLButtonElement).textContent = `Time of Day: ${next.toUpperCase()}`;
    });
    panel.querySelector('#juzu-btn-save')?.addEventListener('click', () => {
      save.exportDownload();
    });

    // 2. Andean Photo Studio Bar (P) per §3.10
    const photoBar = document.createElement('div');
    photoBar.id = 'juzu-photo-bar';
    photoBar.style.cssText = [
      'position:fixed',
      'bottom:22px',
      'left:50%',
      'transform:translateX(-50%)',
      'display:none',
      'gap:10px',
      'align-items:center',
      'background:rgba(14, 18, 15, 0.85)',
      'border:1px solid rgba(212, 184, 136, 0.45)',
      'padding:8px 16px',
      'border-radius:4px',
      'z-index:35',
      'font-family:Georgia, serif',
      'font-size:13px',
      'color:#f2ece1',
    ].join(';');
    photoBar.innerHTML = `
      <span>Andean Photo Studio</span>
      <button id="juzu-photo-preset" style="padding:5px 10px;background:#2c382e;color:#f2ece1;border:1px solid #786648;cursor:pointer;">Preset: Cloud Forest Mist</button>
      <button id="juzu-photo-shot" style="padding:5px 10px;background:#4a3c28;color:#f2ece1;border:1px solid #a88a58;cursor:pointer;">Save PNG</button>
      <span style="opacity:0.75;">[P] Exit</span>
    `;
    container.appendChild(photoBar);
    this.photoBarEl = photoBar;

    photoBar.querySelector('#juzu-photo-preset')?.addEventListener('click', e => {
      const keys: PhotoPresetId[] = ['cloudForestMist', 'sierraGold', 'jungleGreen', 'paititiDawn'];
      const next = keys[(keys.indexOf(post.getPreset()) + 1) % keys.length];
      post.applyPreset(next);
      (e.currentTarget as HTMLButtonElement).textContent = `Preset: ${PHOTO_PRESETS[next].name}`;
    });
    photoBar.querySelector('#juzu-photo-shot')?.addEventListener('click', () => {
      onCapturePng();
    });
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (this.rootEl) {
      this.rootEl.style.display = paused ? 'flex' : 'none';
    }
  }

  public togglePhotoMode(): boolean {
    this.isPhotoMode = !this.isPhotoMode;
    if (this.photoBarEl) {
      this.photoBarEl.style.display = this.isPhotoMode ? 'flex' : 'none';
    }
    return this.isPhotoMode;
  }

  public update(_dt: number): void {
    // Event-driven UI state
  }

  public dispose(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
    if (this.photoBarEl) {
      this.photoBarEl.remove();
      this.photoBarEl = null;
    }
  }
}
