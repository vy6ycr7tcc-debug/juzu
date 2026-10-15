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
import { OverTheShoulderCamera } from '../character/camera';

export class MenusOverlay {
  public isPaused: boolean = false;
  public isPhotoMode: boolean = false;
  private rootEl: HTMLDivElement | null = null;
  private photoBarEl: HTMLDivElement | null = null;
  public titleScreenEl: HTMLDivElement | null = null;
  public isTitleScreenOpen: boolean = false;
  public victoryScreenEl: HTMLDivElement | null = null;
  public isVictoryScreenOpen: boolean = false;
  public settingsModalEl: HTMLDivElement | null = null;
  public isSettingsOpen: boolean = false;

  public build(
    container: HTMLElement,
    quality: QualityManager,
    audio: AudioManager,
    save: SaveManager,
    lightRig: LightRig,
    post: PostProcessor,
    onCapturePng: () => void,
    onBeginExpedition?: () => void,
    onSelectRegion?: (regionId: string) => void,
    camera?: OverTheShoulderCamera
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
          <button id="juzu-btn-title-settings" style="padding:9px 16px;background:rgba(25,32,28,0.85);color:#dcd4c6;border:1px solid #6b5c46;cursor:pointer;font-family:Georgia,serif;font-size:12px;letter-spacing:0.06em;">Expedition Settings & Audio</button>
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

    titleScreen.querySelector('#juzu-btn-title-settings')?.addEventListener('click', () => {
      this.openSettings();
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

    // 1. Pause Menu (Esc)
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
        <button id="juzu-btn-pause-settings" style="padding:9px 14px;background:#252e27;color:#f2ece1;border:1px solid #5c5242;cursor:pointer;">Settings & Accessibility</button>
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
    panel.querySelector('#juzu-btn-pause-settings')?.addEventListener('click', () => {
      this.openSettings();
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

    // 1b. Dedicated Settings & Accessibility Modal (Pillar C & D)
    const settingsRoot = document.createElement('div');
    settingsRoot.id = 'juzu-settings-menu';
    settingsRoot.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(6, 10, 8, 0.82)',
      'z-index:55',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#f2ece1',
    ].join(';');

    const settingsPanel = document.createElement('div');
    settingsPanel.style.cssText = [
      'width:min(490px, 92vw)',
      'background:rgba(18, 24, 20, 0.96)',
      'border:1px solid rgba(212, 184, 136, 0.48)',
      'border-radius:4px',
      'padding:24px 28px',
      'box-shadow:0 8px 36px rgba(0,0,0,0.88)',
      'max-height:88vh',
      'overflow-y:auto',
    ].join(';');

    settingsPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid rgba(212,184,136,0.22);padding-bottom:10px;">
        <div>
          <h2 style="margin:0;font-size:22px;letter-spacing:0.1em;color:#f2ece1;font-weight:400;">EXPEDITION SETTINGS</h2>
          <div style="font-size:11px;letter-spacing:0.2em;color:#c9a468;text-transform:uppercase;">Accessibility · Controls · Audio Immersion</div>
        </div>
        <button id="juzu-btn-settings-close-x" style="background:transparent;border:none;color:#d4b888;font-size:20px;cursor:pointer;line-height:1;">✕</button>
      </div>

      <!-- Controls & Camera Section -->
      <div style="margin-bottom:18px;">
        <div style="font-size:12px;letter-spacing:0.15em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;font-weight:bold;">Camera & Controls</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:13px;color:#dcd4c6;">Invert Look Y-Axis</span>
          <input type="checkbox" id="juzu-opt-inverty" style="cursor:pointer;accent-color:#c9a468;width:18px;height:18px;">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:13px;color:#dcd4c6;">Look Sensitivity</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="range" id="juzu-opt-sens" min="0.5" max="2.5" step="0.1" value="1.0" style="width:110px;accent-color:#c9a468;cursor:pointer;">
            <span id="juzu-lbl-sens" style="font-size:12px;color:#c9a468;width:34px;">1.0x</span>
          </div>
        </div>
      </div>

      <!-- Accessibility Section -->
      <div style="margin-bottom:18px;">
        <div style="font-size:12px;letter-spacing:0.15em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;font-weight:bold;">Accessibility</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div>
            <div style="font-size:13px;color:#dcd4c6;">High-Contrast HUD & Prompts</div>
            <div style="font-size:11px;color:#9b9487;">Enhanced outlines, dark backdrop & high legibility typography</div>
          </div>
          <input type="checkbox" id="juzu-opt-highcontrast" style="cursor:pointer;accent-color:#c9a468;width:18px;height:18px;">
        </div>
      </div>

      <!-- Audio Immersion Section -->
      <div style="margin-bottom:18px;">
        <div style="font-size:12px;letter-spacing:0.15em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;font-weight:bold;">Audio Immersion</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:13px;color:#dcd4c6;">Master Volume</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="range" id="juzu-opt-mastervol" min="0" max="100" step="5" value="85" style="width:110px;accent-color:#c9a468;cursor:pointer;">
            <span id="juzu-lbl-mastervol" style="font-size:12px;color:#c9a468;width:34px;">85%</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:13px;color:#dcd4c6;">Ambient & Music</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="range" id="juzu-opt-musicvol" min="0" max="100" step="5" value="55" style="width:110px;accent-color:#c9a468;cursor:pointer;">
            <span id="juzu-lbl-musicvol" style="font-size:12px;color:#c9a468;width:34px;">55%</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:13px;color:#dcd4c6;">Foley & Sound Effects</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="range" id="juzu-opt-sfxvol" min="0" max="100" step="5" value="85" style="width:110px;accent-color:#c9a468;cursor:pointer;">
            <span id="juzu-lbl-sfxvol" style="font-size:12px;color:#c9a468;width:34px;">85%</span>
          </div>
        </div>
      </div>

      <!-- Keybindings Reference Section -->
      <div style="margin-bottom:20px;padding:12px 14px;background:rgba(12,16,14,0.6);border:1px solid rgba(212,184,136,0.18);border-radius:3px;">
        <div style="font-size:11px;letter-spacing:0.12em;color:#c9a468;text-transform:uppercase;margin-bottom:6px;font-weight:bold;">Keybindings & Exploration Controls</div>
        <div style="font-size:11px;color:#bcb5a8;line-height:1.7;">
          <strong>WASD:</strong> Movement · <strong>Space:</strong> Jump / Climb / Mantle · <strong>Shift:</strong> Sprint<br/>
          <strong>C:</strong> Crouch / Dive · <strong>R-Click:</strong> Aim Recurve Bow · <strong>L-Click:</strong> Fire Arrow<br/>
          <strong>F:</strong> Silent Takedown · <strong>Q:</strong> Dodge Roll · <strong>H:</strong> Herbal Poultice<br/>
          <strong>J:</strong> Field Journal · <strong>P:</strong> Andean Photo Studio · <strong>Esc:</strong> Pause Menu
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button id="juzu-btn-settings-done" style="padding:8px 22px;background:#384836;color:#fdfaf2;border:1px solid #c9a468;cursor:pointer;font-family:Georgia,serif;font-size:13px;letter-spacing:0.08em;">Done</button>
      </div>
    `;

    settingsRoot.appendChild(settingsPanel);
    container.appendChild(settingsRoot);
    this.settingsModalEl = settingsRoot;

    // Load persisted settings
    const savedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('juzu_settings_v1') : null;
    let currentSettings = {
      invertY: false,
      sensitivity: 1.0,
      highContrast: false,
      masterVol: 85,
      musicVol: 55,
      sfxVol: 85,
    };
    if (savedRaw) {
      try {
        currentSettings = { ...currentSettings, ...JSON.parse(savedRaw) };
      } catch {
        // fallback
      }
    }

    if (camera) {
      camera.invertY = currentSettings.invertY;
      camera.sensitivity = currentSettings.sensitivity;
    }
    if (currentSettings.highContrast && typeof document !== 'undefined') {
      document.body.classList.add('high-contrast-mode');
    }
    audio.setMasterVolume(currentSettings.masterVol / 100);
    audio.setMusicVolume(currentSettings.musicVol / 100);
    audio.setSfxVolume(currentSettings.sfxVol / 100);

    const chkInvertY = settingsPanel.querySelector('#juzu-opt-inverty') as HTMLInputElement | null;
    const rngSens = settingsPanel.querySelector('#juzu-opt-sens') as HTMLInputElement | null;
    const lblSens = settingsPanel.querySelector('#juzu-lbl-sens') as HTMLSpanElement | null;
    const chkHighContrast = settingsPanel.querySelector('#juzu-opt-highcontrast') as HTMLInputElement | null;
    const rngMaster = settingsPanel.querySelector('#juzu-opt-mastervol') as HTMLInputElement | null;
    const lblMaster = settingsPanel.querySelector('#juzu-lbl-mastervol') as HTMLSpanElement | null;
    const rngMusic = settingsPanel.querySelector('#juzu-opt-musicvol') as HTMLInputElement | null;
    const lblMusic = settingsPanel.querySelector('#juzu-lbl-musicvol') as HTMLSpanElement | null;
    const rngSfx = settingsPanel.querySelector('#juzu-opt-sfxvol') as HTMLInputElement | null;
    const lblSfx = settingsPanel.querySelector('#juzu-lbl-sfxvol') as HTMLSpanElement | null;

    if (chkInvertY) chkInvertY.checked = currentSettings.invertY;
    if (rngSens) rngSens.value = currentSettings.sensitivity.toString();
    if (lblSens) lblSens.textContent = `${currentSettings.sensitivity.toFixed(1)}x`;
    if (chkHighContrast) chkHighContrast.checked = currentSettings.highContrast;
    if (rngMaster) rngMaster.value = currentSettings.masterVol.toString();
    if (lblMaster) lblMaster.textContent = `${currentSettings.masterVol}%`;
    if (rngMusic) rngMusic.value = currentSettings.musicVol.toString();
    if (lblMusic) lblMusic.textContent = `${currentSettings.musicVol}%`;
    if (rngSfx) rngSfx.value = currentSettings.sfxVol.toString();
    if (lblSfx) lblSfx.textContent = `${currentSettings.sfxVol}%`;

    const saveSettings = () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('juzu_settings_v1', JSON.stringify(currentSettings));
      }
    };

    chkInvertY?.addEventListener('change', () => {
      currentSettings.invertY = !!chkInvertY.checked;
      if (camera) camera.invertY = currentSettings.invertY;
      saveSettings();
    });

    rngSens?.addEventListener('input', () => {
      const val = parseFloat(rngSens.value);
      currentSettings.sensitivity = val;
      if (lblSens) lblSens.textContent = `${val.toFixed(1)}x`;
      if (camera) camera.sensitivity = val;
      saveSettings();
    });

    chkHighContrast?.addEventListener('change', () => {
      currentSettings.highContrast = !!chkHighContrast.checked;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('high-contrast-mode', currentSettings.highContrast);
      }
      saveSettings();
    });

    rngMaster?.addEventListener('input', () => {
      const val = parseInt(rngMaster.value, 10);
      currentSettings.masterVol = val;
      if (lblMaster) lblMaster.textContent = `${val}%`;
      audio.setMasterVolume(val / 100);
      saveSettings();
    });

    rngMusic?.addEventListener('input', () => {
      const val = parseInt(rngMusic.value, 10);
      currentSettings.musicVol = val;
      if (lblMusic) lblMusic.textContent = `${val}%`;
      audio.setMusicVolume(val / 100);
      saveSettings();
    });

    rngSfx?.addEventListener('input', () => {
      const val = parseInt(rngSfx.value, 10);
      currentSettings.sfxVol = val;
      if (lblSfx) lblSfx.textContent = `${val}%`;
      audio.setSfxVolume(val / 100);
      saveSettings();
    });

    const closeSettingsModal = () => {
      this.closeSettings();
    };

    settingsPanel.querySelector('#juzu-btn-settings-close-x')?.addEventListener('click', closeSettingsModal);
    settingsPanel.querySelector('#juzu-btn-settings-done')?.addEventListener('click', closeSettingsModal);

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

  public showVictoryScreen(stats: {
    quipusFound: number;
    totalQuipus: number;
    relicsFound: number;
    timePlayedSec: number;
    onContinue?: () => void;
  }): void {
    if (typeof document === 'undefined') return;
    if (this.victoryScreenEl) {
      this.victoryScreenEl.remove();
      this.victoryScreenEl = null;
    }

    const minutes = Math.floor(stats.timePlayedSec / 60);
    const seconds = Math.floor(stats.timePlayedSec % 60);
    const timeFormatted = `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;

    const el = document.createElement('div');
    el.id = 'juzu-victory-screen';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'background:radial-gradient(ellipse at center, rgba(16, 22, 18, 0.78) 0%, rgba(5, 8, 7, 0.95) 100%)',
      'z-index:50',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#f2ece1',
      'opacity:0',
      'transition:opacity 0.8s ease',
    ].join(';');

    el.innerHTML = `
      <div style="text-align:center;max-width:540px;width:90vw;padding:34px 28px;border:1px solid rgba(212, 184, 136, 0.5);background:rgba(14, 19, 16, 0.92);border-radius:4px;box-shadow:0 12px 40px rgba(0,0,0,0.92);">
        <div style="width:64px;height:64px;margin:0 auto 16px auto;">
          <svg viewBox="0 0 100 100" width="64" height="64" fill="none">
            <path d="M35 5 H65 V20 H80 V35 H95 V65 H80 V80 H65 V95 H35 V80 H20 V65 H5 V35 H20 V20 H35 Z" fill="rgba(60, 48, 25, 0.95)" stroke="#f5d799" stroke-width="3" stroke-linejoin="round"/>
            <circle cx="50" cy="50" r="14" fill="#0d110f" stroke="#e6c896" stroke-width="2.5"/>
            <circle cx="50" cy="50" r="5" fill="#ffd700"/>
          </svg>
        </div>
        <div style="font-size:11px;letter-spacing:0.38em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;">Sanctuary of the Sun King · Coricancha</div>
        <h1 style="font-size:38px;letter-spacing:0.2em;margin:0 0 8px 0;color:#fdfaf2;font-weight:400;text-shadow:0 3px 16px rgba(0,0,0,0.9);">PAITITI REACHED</h1>
        <div style="font-size:13px;letter-spacing:0.12em;color:#c9a468;margin-bottom:20px;font-style:italic;">The Master Chronicle Completed</div>
        <p style="font-size:13px;line-height:1.65;color:#c2baa9;margin:0 0 24px 0;border-top:1px solid rgba(212,184,136,0.22);border-bottom:1px solid rgba(212,184,136,0.22);padding:14px 8px;">
          The sacred solar beam aligns across the golden gnomon. Untouched for five centuries, the living archives of Tawantinsuyu reveal their stewardship to Naira Quispe.
        </p>

        <!-- Stats Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:26px;text-align:left;">
          <div style="background:rgba(25, 34, 29, 0.85);padding:10px 14px;border:1px solid rgba(138, 118, 86, 0.35);border-radius:2px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#9e9482;">Quipu Ciphers</div>
            <div style="font-size:18px;color:#e6c896;font-weight:bold;margin-top:2px;">${stats.quipusFound} / ${stats.totalQuipus} Deciphered</div>
          </div>
          <div style="background:rgba(25, 34, 29, 0.85);padding:10px 14px;border:1px solid rgba(138, 118, 86, 0.35);border-radius:2px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#9e9482;">Sacred Relics</div>
            <div style="font-size:18px;color:#e6c896;font-weight:bold;margin-top:2px;">${stats.relicsFound} Recovered</div>
          </div>
          <div style="background:rgba(25, 34, 29, 0.85);padding:10px 14px;border:1px solid rgba(138, 118, 86, 0.35);border-radius:2px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#9e9482;">Expedition Time</div>
            <div style="font-size:18px;color:#e6c896;font-weight:bold;margin-top:2px;">${timeFormatted}</div>
          </div>
          <div style="background:rgba(25, 34, 29, 0.85);padding:10px 14px;border:1px solid rgba(138, 118, 86, 0.35);border-radius:2px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#9e9482;">Archaeological Honor</div>
            <div style="font-size:16px;color:#ffd788;font-weight:bold;margin-top:2px;">Master Explorer</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="juzu-btn-victory-continue" style="padding:10px 20px;background:#384836;color:#fdfaf2;border:1px solid #c9a468;cursor:pointer;font-family:Georgia,serif;font-size:13px;letter-spacing:0.08em;transition:background 0.2s ease;">Continue Free Roam</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.victoryScreenEl = el;
    this.isVictoryScreenOpen = true;

    requestAnimationFrame(() => {
      el.style.opacity = '1';
    });

    el.querySelector('#juzu-btn-victory-continue')?.addEventListener('click', () => {
      this.closeVictoryScreen();
      stats.onContinue?.();
    });
  }

  public closeVictoryScreen(): void {
    if (!this.victoryScreenEl) return;
    this.isVictoryScreenOpen = false;
    this.victoryScreenEl.style.opacity = '0';
    this.victoryScreenEl.style.pointerEvents = 'none';
    const ref = this.victoryScreenEl;
    setTimeout(() => {
      if (ref) ref.remove();
    }, 800);
    this.victoryScreenEl = null;
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

  public openSettings(): void {
    this.isSettingsOpen = true;
    if (this.settingsModalEl) {
      this.settingsModalEl.style.display = 'flex';
    }
  }

  public closeSettings(): void {
    this.isSettingsOpen = false;
    if (this.settingsModalEl) {
      this.settingsModalEl.style.display = 'none';
    }
  }

  public update(_dt: number): void {
    // Event-driven UI state
  }

  public dispose(): void {
    if (this.settingsModalEl) {
      this.settingsModalEl.remove();
      this.settingsModalEl = null;
    }
    if (this.victoryScreenEl) {
      this.victoryScreenEl.remove();
      this.victoryScreenEl = null;
    }
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
