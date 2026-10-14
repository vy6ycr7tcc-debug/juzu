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
  public titleScreenEl: HTMLDivElement | null = null;
  public isTitleScreenOpen: boolean = false;

  public build(
    container: HTMLElement,
    quality: QualityManager,
    audio: AudioManager,
    save: SaveManager,
    lightRig: LightRig,
    post: PostProcessor,
    onCapturePng: () => void,
    onBeginExpedition?: () => void,
    onSelectRegion?: (regionId: string) => void
  ): void {
    if (typeof document === 'undefined') return;

    // 0. Atmospheric Title Screen (Vista opening, bypassed in automated shot modes)
    const isShotMode =
      typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).has('shot') ||
        new URLSearchParams(window.location.search).has('region'));

    const titleScreen = document.createElement('div');
    titleScreen.id = 'juzu-title-screen';
    titleScreen.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'background:radial-gradient(ellipse at center, rgba(14,18,16,0.48) 0%, rgba(6,9,8,0.92) 100%)',
      'z-index:45',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#f2ece1',
      'transition:opacity 0.85s ease',
    ].join(';');

    titleScreen.innerHTML = `
      <div style="text-align:center;max-width:560px;padding:32px 24px;border:1px solid rgba(212,184,136,0.3);background:rgba(12,16,14,0.72);border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.85);">
        <div style="font-size:11px;letter-spacing:0.32em;color:#d4b888;text-transform:uppercase;margin-bottom:10px;">Archaeological Expedition · Inca Andes</div>
        <h1 style="font-size:46px;letter-spacing:0.18em;margin:0 0 6px 0;color:#fdfaf2;text-shadow:0 3px 14px rgba(0,0,0,0.9);font-weight:400;">J U Z U</h1>
        <div style="font-size:15px;letter-spacing:0.1em;color:#e6c896;margin-bottom:26px;font-style:italic;">The Search for Paititi</div>
        <div style="display:flex;flex-direction:column;gap:10px;width:240px;margin:0 auto 24px auto;">
          <button id="juzu-btn-begin" style="padding:11px 16px;background:#384836;color:#fdfaf2;border:1px solid #c9a468;cursor:pointer;font-family:Georgia,serif;font-size:14px;letter-spacing:0.08em;transition:background 0.2s ease;">Begin Expedition</button>
          <button id="juzu-btn-toggle-chapters" style="padding:9px 16px;background:rgba(25,32,28,0.85);color:#dcd4c6;border:1px solid #6b5c46;cursor:pointer;font-family:Georgia,serif;font-size:12px;letter-spacing:0.06em;">Select Chapter</button>
        </div>
        <div id="juzu-chapter-list" style="display:none;flex-direction:column;gap:6px;margin-bottom:20px;font-size:12px;">
          <button class="juzu-chap-pick" data-region="cloudForest" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter I: Cloud Forest Valleys</button>
          <button class="juzu-chap-pick" data-region="highSierra" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter IV: High Sierra (Intihuatana)</button>
          <button class="juzu-chap-pick" data-region="jungleLowlands" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter VII: Antisuyu Rainforest Cenote</button>
          <button class="juzu-chap-pick" data-region="paititi" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter X: Paititi — Plaza of the Sun</button>
        </div>
        <div style="font-size:11px;letter-spacing:0.05em;color:#9b9487;line-height:1.6;border-top:1px solid rgba(212,184,136,0.18);padding-top:16px;">
          WASD Move · Space Jump/Climb · Shift Sprint · C Crouch<br/>
          R-Click Aim · L-Click Fire · Q Dodge · H Heal · J Journal · Esc Pause · P Photo Studio
        </div>
      </div>
    `;

    if (isShotMode) {
      titleScreen.style.display = 'none';
      this.isTitleScreenOpen = false;
    } else {
      this.isTitleScreenOpen = true;
    }

    container.appendChild(titleScreen);
    this.titleScreenEl = titleScreen;

    titleScreen.querySelector('#juzu-btn-begin')?.addEventListener('click', () => {
      this.closeTitleScreen();
      onBeginExpedition?.();
    });

    const chapList = titleScreen.querySelector('#juzu-chapter-list') as HTMLDivElement | null;
    titleScreen.querySelector('#juzu-btn-toggle-chapters')?.addEventListener('click', () => {
      if (chapList) {
        chapList.style.display = chapList.style.display === 'none' ? 'flex' : 'none';
      }
    });

    titleScreen.querySelectorAll('.juzu-chap-pick').forEach(btn => {
      btn.addEventListener('click', e => {
        const region = (e.currentTarget as HTMLElement).getAttribute('data-region');
        if (region) {
          this.closeTitleScreen();
          onSelectRegion?.(region);
          onBeginExpedition?.();
        }
      });
    });

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

  public closeTitleScreen(): void {
    if (!this.titleScreenEl) return;
    this.isTitleScreenOpen = false;
    this.titleScreenEl.style.opacity = '0';
    this.titleScreenEl.style.pointerEvents = 'none';
    window.setTimeout(() => {
      if (this.titleScreenEl) this.titleScreenEl.style.display = 'none';
    }, 850);
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
    if (this.titleScreenEl) {
      this.titleScreenEl.remove();
      this.titleScreenEl = null;
    }
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
