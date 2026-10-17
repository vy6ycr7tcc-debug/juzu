import type { AudioEngine } from '../core/audio';
import type { FollowCamera } from '../player/camera';
import { offlineManager, type OfflineStatus } from '../pwa/offline';

export interface HUDCallbacks {
  onSelectRegion: (region: 'cloudForest' | 'highSierra' | 'jungleLowlands' | 'paititi') => void;
  onBeginExpedition: () => void;
  onToggleTimeOfDay: (tod: 'day' | 'dawn' | 'noon' | 'dusk' | 'night') => void;
}

export class HUD {
  public root: HTMLElement;
  private titleScreenEl: HTMLElement;
  private hudEl: HTMLElement;
  private settingsModalEl: HTMLElement;
  private objectiveTextEl!: HTMLElement;
  private interactHintEl!: HTMLElement;
  private compassEl!: HTMLElement;

  public isTitleOpen = true;

  constructor(
    private audio: AudioEngine,
    private camera: FollowCamera,
    private callbacks: HUDCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.id = 'juzu-ui-root';
    document.body.appendChild(this.root);

    this.titleScreenEl = this.createTitleScreen();
    this.hudEl = this.createGameplayHUD();
    this.settingsModalEl = this.createSettingsModal();

    this.root.appendChild(this.titleScreenEl);
    this.root.appendChild(this.hudEl);
    this.root.appendChild(this.settingsModalEl);

    this.bindSettings();
    this.bindOfflineControls();
  }

  private createTitleScreen(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'juzu-title-screen';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'background:radial-gradient(ellipse at center, rgba(14,18,16,0.48) 0%, rgba(6,9,8,0.92) 100%)',
      'z-index:45',
      'font-family:Georgia, serif',
      'color:#f2ece1',
      'transition:opacity 0.85s ease',
    ].join(';');

    el.innerHTML = `
      <div style="text-align:center;max-width:560px;padding:32px 24px;border:1px solid rgba(212,184,136,0.3);background:rgba(12,16,14,0.78);border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.85);">
        <div id="juzu-offline-indicator" style="display:none;position:absolute;top:16px;right:20px;padding:6px 12px;background:rgba(18,24,20,0.92);border:1px solid #c9a468;border-radius:3px;font-size:11px;letter-spacing:0.12em;color:#e6c896;text-transform:uppercase;box-shadow:0 4px 14px rgba(0,0,0,0.7);">📡 Offline Mode · Ready</div>
        <div style="font-size:11px;letter-spacing:0.32em;color:#d4b888;text-transform:uppercase;margin-bottom:10px;">Archaeological Expedition · Inca Andes</div>
        <h1 style="font-size:46px;letter-spacing:0.18em;margin:0 0 6px 0;color:#fdfaf2;text-shadow:0 3px 14px rgba(0,0,0,0.9);font-weight:400;">J U Z U</h1>
        <div style="font-size:15px;letter-spacing:0.1em;color:#e6c896;margin-bottom:26px;font-style:italic;">The Search for Paititi</div>
        
        <div style="display:flex;flex-direction:column;gap:10px;width:240px;margin:0 auto 24px auto;">
          <button id="juzu-btn-begin" style="padding:11px 16px;background:#384836;color:#fdfaf2;border:1px solid #c9a468;cursor:pointer;font-family:Georgia,serif;font-size:14px;letter-spacing:0.08em;transition:background 0.2s ease;">Begin Expedition</button>
          <button id="juzu-btn-toggle-chapters" style="padding:9px 16px;background:rgba(25,32,28,0.85);color:#dcd4c6;border:1px solid #6b5c46;cursor:pointer;font-family:Georgia,serif;font-size:12px;letter-spacing:0.06em;">Select Chapter</button>
          <button id="juzu-btn-title-offline" style="padding:9px 16px;background:rgba(25,32,28,0.85);color:#dcd4c6;border:1px solid #6b5c46;cursor:pointer;font-family:Georgia,serif;font-size:12px;letter-spacing:0.06em;transition:background 0.2s ease;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
            <span>📥</span><span id="juzu-title-offline-text">Download to Play Offline</span>
          </button>
          <button id="juzu-btn-title-settings" style="padding:9px 16px;background:rgba(25,32,28,0.85);color:#dcd4c6;border:1px solid #6b5c46;cursor:pointer;font-family:Georgia,serif;font-size:12px;letter-spacing:0.06em;">Expedition Settings & Audio</button>
        </div>

        <div id="juzu-chapter-list" style="display:none;flex-direction:column;gap:6px;margin-bottom:20px;font-size:12px;">
          <button class="juzu-chap-pick" data-region="cloudForest" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter I: Cloud Forest Valleys</button>
          <button class="juzu-chap-pick" data-region="highSierra" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter IV: High Sierra (Intihuatana)</button>
          <button class="juzu-chap-pick" data-region="jungleLowlands" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter VII: Antisuyu Rainforest Cenote</button>
          <button class="juzu-chap-pick" data-region="paititi" style="padding:6px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;cursor:pointer;">Chapter X: Paititi — Plaza of the Sun</button>
        </div>

        <div style="font-size:11px;letter-spacing:0.05em;color:#9b9487;line-height:1.6;border-top:1px solid rgba(212,184,136,0.18);padding-top:16px;">
          WASD Move · Space Jump · Shift Sprint · C Dive/Crouch · E Interact
        </div>
      </div>
    `;

    el.querySelector('#juzu-btn-begin')?.addEventListener('click', () => {
      this.closeTitle();
      this.audio.resume();
      this.audio.playQuenaNote(523.25, 1.8);
      this.callbacks.onBeginExpedition();
    });

    const chapList = el.querySelector('#juzu-chapter-list') as HTMLElement;
    el.querySelector('#juzu-btn-toggle-chapters')?.addEventListener('click', () => {
      if (chapList) {
        chapList.style.display = chapList.style.display === 'none' ? 'flex' : 'none';
      }
    });

    el.querySelectorAll('.juzu-chap-pick').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const region = (e.currentTarget as HTMLElement).getAttribute('data-region') as any;
        if (region) {
          this.closeTitle();
          this.audio.resume();
          this.callbacks.onSelectRegion(region);
          this.callbacks.onBeginExpedition();
        }
      });
    });

    el.querySelector('#juzu-btn-title-settings')?.addEventListener('click', () => {
      this.openSettings();
    });

    return el;
  }

  private createGameplayHUD(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'juzu-hud';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'pointer-events:none',
      'z-index:30',
      'font-family:Georgia, serif',
    ].join(';');

    el.innerHTML = `
      <!-- Top Objective Banner -->
      <div id="juzu-objective-wrap" style="position:absolute;top:20px;left:24px;max-width:440px;background:rgba(12,16,14,0.72);border-left:3px solid #c9a468;padding:10px 16px;border-radius:2px;box-shadow:0 4px 18px rgba(0,0,0,0.6);">
        <div style="font-size:10px;letter-spacing:0.25em;color:#c9a468;text-transform:uppercase;margin-bottom:4px;">Current Expedition Objective</div>
        <div id="juzu-objective-text" style="font-size:13px;color:#f2ede4;line-height:1.45;">Cross the hanging bridge and read the carved Inca stele by the water [E].</div>
      </div>

      <!-- Compass Top-Center -->
      <div id="juzu-compass" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);padding:6px 16px;background:rgba(12,16,14,0.65);border:1px solid rgba(212,184,136,0.3);border-radius:20px;font-size:12px;letter-spacing:0.18em;color:#e6c896;">
        N · 045° ANDES
      </div>

      <!-- Interaction Hint Bottom-Center -->
      <div id="juzu-interact-hint" style="display:none;position:absolute;bottom:42px;left:50%;transform:translateX(-50%);padding:8px 18px;background:rgba(14,20,16,0.92);border:1px solid #c9a468;border-radius:4px;font-size:13px;color:#ffd778;box-shadow:0 4px 20px rgba(0,0,0,0.75);">
        [E] Read Carved Inca Stele
      </div>
    `;

    this.objectiveTextEl = el.querySelector('#juzu-objective-text')!;
    this.interactHintEl = el.querySelector('#juzu-interact-hint')!;
    this.compassEl = el.querySelector('#juzu-compass')!;

    return el;
  }

  private createSettingsModal(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'juzu-settings-menu';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(6, 10, 8, 0.85)',
      'z-index:55',
      'font-family:Georgia, serif',
      'color:#f2ece1',
    ].join(';');

    el.innerHTML = `
      <div style="width:min(490px, 92vw);background:rgba(18, 24, 20, 0.96);border:1px solid rgba(212, 184, 136, 0.48);border-radius:4px;padding:24px 28px;box-shadow:0 8px 36px rgba(0,0,0,0.88);max-height:88vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid rgba(212,184,136,0.22);padding-bottom:10px;">
          <div>
            <h2 style="margin:0;font-size:22px;letter-spacing:0.1em;color:#f2ece1;font-weight:400;">EXPEDITION SETTINGS</h2>
            <div style="font-size:11px;letter-spacing:0.2em;color:#c9a468;text-transform:uppercase;">Controls · Audio · Offline Storage</div>
          </div>
          <button id="juzu-settings-close-x" style="background:transparent;border:none;color:#d4b888;font-size:20px;cursor:pointer;">✕</button>
        </div>

        <!-- Controls -->
        <div style="margin-bottom:16px;">
          <div style="font-size:12px;letter-spacing:0.15em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;font-weight:bold;">Controls</div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
            <span style="font-size:13px;color:#dcd4c6;">Invert Look Y-Axis</span>
            <input type="checkbox" id="juzu-opt-inverty" style="cursor:pointer;accent-color:#c9a468;width:18px;height:18px;">
          </div>
        </div>

        <!-- Audio -->
        <div style="margin-bottom:16px;">
          <div style="font-size:12px;letter-spacing:0.15em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;font-weight:bold;">Audio</div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
            <span style="font-size:13px;color:#dcd4c6;">Master Volume</span>
            <input type="range" id="juzu-opt-mastervol" min="0" max="100" value="85" style="width:110px;accent-color:#c9a468;">
          </div>
        </div>

        <!-- Offline Storage -->
        <div style="margin-bottom:20px;padding:12px 14px;background:rgba(12,16,14,0.6);border:1px solid rgba(212,184,136,0.22);border-radius:3px;">
          <div style="font-size:12px;letter-spacing:0.15em;color:#e6c896;text-transform:uppercase;margin-bottom:8px;font-weight:bold;">Offline Play & Device Storage</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="font-size:13px;color:#dcd4c6;font-weight:bold;">Expedition Asset Precache</div>
              <div id="juzu-offline-subtext" style="font-size:11px;color:#9b9487;margin-top:2px;">Store 3D models, textures, audio & shaders for play without internet.</div>
            </div>
            <button id="juzu-btn-download-offline-settings" style="padding:7px 16px;background:#384836;color:#fdfaf2;border:1px solid #c9a468;cursor:pointer;font-family:Georgia,serif;font-size:12px;white-space:nowrap;">📥 Download for Offline</button>
          </div>
          <div id="juzu-offline-progress-wrap" style="display:none;width:100%;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin:8px 0 6px 0;">
            <div id="juzu-offline-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg, #caa05b, #ffd988);"></div>
          </div>
          <div id="juzu-offline-status-text" style="font-size:11px;color:#c9a468;margin-bottom:8px;min-height:14px;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#8a8377;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">
            <span id="juzu-offline-storage-info">Device Storage: Estimating...</span>
            <button id="juzu-btn-clear-offline" style="background:transparent;border:none;color:#b46858;cursor:pointer;font-size:11px;text-decoration:underline;">Remove Offline Cache</button>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button id="juzu-settings-done" style="padding:8px 22px;background:#384836;color:#fdfaf2;border:1px solid #c9a468;cursor:pointer;font-family:Georgia,serif;font-size:13px;">Done</button>
        </div>
      </div>
    `;

    el.querySelector('#juzu-settings-close-x')?.addEventListener('click', () => this.closeSettings());
    el.querySelector('#juzu-settings-done')?.addEventListener('click', () => this.closeSettings());

    return el;
  }

  private bindSettings(): void {
    const chkInvert = this.settingsModalEl.querySelector('#juzu-opt-inverty') as HTMLInputElement | null;
    chkInvert?.addEventListener('change', () => {
      this.camera.invertY = !!chkInvert.checked;
    });

    const rngVol = this.settingsModalEl.querySelector('#juzu-opt-mastervol') as HTMLInputElement | null;
    rngVol?.addEventListener('input', () => {
      const v = parseInt(rngVol.value, 10) / 100;
      this.audio.setMasterVolume(v);
    });
  }

  private bindOfflineControls(): void {
    const btnTitleOffline = this.titleScreenEl.querySelector('#juzu-btn-title-offline') as HTMLButtonElement | null;
    const txtTitleOffline = this.titleScreenEl.querySelector('#juzu-title-offline-text') as HTMLSpanElement | null;
    const badgeOffline = this.titleScreenEl.querySelector('#juzu-offline-indicator') as HTMLElement | null;

    const btnSettingsOffline = this.settingsModalEl.querySelector('#juzu-btn-download-offline-settings') as HTMLButtonElement | null;
    const prgWrap = this.settingsModalEl.querySelector('#juzu-offline-progress-wrap') as HTMLElement | null;
    const prgBar = this.settingsModalEl.querySelector('#juzu-offline-progress-bar') as HTMLElement | null;
    const statusTxt = this.settingsModalEl.querySelector('#juzu-offline-status-text') as HTMLElement | null;
    const storageInfo = this.settingsModalEl.querySelector('#juzu-offline-storage-info') as HTMLElement | null;
    const btnClearOffline = this.settingsModalEl.querySelector('#juzu-btn-clear-offline') as HTMLButtonElement | null;

    const updateUI = (s: OfflineStatus) => {
      if (badgeOffline) badgeOffline.style.display = s.isOffline ? 'block' : 'none';
      if (storageInfo) {
        storageInfo.textContent = s.storageUsedMB > 0 ? `Device Storage: ${s.storageUsedMB} MB cached` : 'Device Storage: Not cached';
      }
      if (s.isReady) {
        if (txtTitleOffline) txtTitleOffline.textContent = '✓ Ready to Play Offline';
        if (btnSettingsOffline) {
          btnSettingsOffline.innerHTML = '✓ Ready for Offline Play';
          btnSettingsOffline.style.background = '#283c26';
        }
      }
    };

    offlineManager.onStatusChange(updateUI);

    const handleDownload = async () => {
      if (btnSettingsOffline) btnSettingsOffline.disabled = true;
      if (prgWrap) prgWrap.style.display = 'block';
      if (statusTxt) statusTxt.textContent = 'Downloading offline assets...';

      try {
        await offlineManager.downloadForOffline((p) => {
          if (prgBar) prgBar.style.width = `${p.progress}%`;
          if (statusTxt) statusTxt.textContent = `Downloading... ${p.progress}% (${p.completed}/${p.total} files)`;
          if (txtTitleOffline) txtTitleOffline.textContent = `Downloading ${p.progress}%`;
        });
        if (statusTxt) statusTxt.textContent = 'Precache complete! All assets ready.';
        if (txtTitleOffline) txtTitleOffline.textContent = '✓ Ready to Play Offline';
        if (btnSettingsOffline) {
          btnSettingsOffline.innerHTML = '✓ Ready for Offline Play';
          btnSettingsOffline.disabled = false;
        }
      } catch (err: any) {
        if (statusTxt) statusTxt.textContent = `Notice: ${err?.message || err}`;
        if (btnSettingsOffline) btnSettingsOffline.disabled = false;
      }
    };

    btnTitleOffline?.addEventListener('click', handleDownload);
    btnSettingsOffline?.addEventListener('click', handleDownload);

    btnClearOffline?.addEventListener('click', async () => {
      if (confirm('Clear downloaded offline cache? Saves will not be deleted.')) {
        await offlineManager.clearOfflineData();
        if (statusTxt) statusTxt.textContent = 'Offline cache cleared.';
      }
    });
  }

  public closeTitle(): void {
    this.isTitleOpen = false;
    this.titleScreenEl.style.opacity = '0';
    this.titleScreenEl.style.pointerEvents = 'none';
    setTimeout(() => {
      this.titleScreenEl.style.display = 'none';
      this.hudEl.style.display = 'block';
    }, 850);
  }

  public openSettings(): void {
    this.settingsModalEl.style.display = 'flex';
  }

  public closeSettings(): void {
    this.settingsModalEl.style.display = 'none';
  }

  public setObjective(text: string): void {
    if (this.objectiveTextEl) this.objectiveTextEl.textContent = text;
  }

  public setInteractHint(text: string | null): void {
    if (!this.interactHintEl) return;
    if (text) {
      this.interactHintEl.textContent = text;
      this.interactHintEl.style.display = 'block';
    } else {
      this.interactHintEl.style.display = 'none';
    }
  }

  public updateCompass(camYawRad: number): void {
    const deg = Math.round(((-camYawRad * 180) / Math.PI + 360) % 360);
    const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const heading = headings[Math.floor(((deg + 22.5) % 360) / 45)];
    const pad = deg < 100 ? (deg < 10 ? '00' : '0') : '';
    if (this.compassEl) {
      this.compassEl.textContent = `${heading} · ${pad}${deg}° ANDES`;
    }
  }
}
