import type { AudioEngine } from '../core/audio';
import type { FollowCamera } from '../player/camera';
import { offlineManager, type OfflineStatus } from '../pwa/offline';
import { MOBILE } from '../core/quality';

export interface HUDCallbacks {
  onSelectRegion: (region: 'cloudForest' | 'highSierra' | 'jungleLowlands' | 'paititi') => void;
  onBeginExpedition: () => void;
  onToggleTimeOfDay: (tod: 'day' | 'dawn' | 'noon' | 'dusk' | 'night') => void;
}

export interface JournalEntry {
  id: string;
  title: string;
  quechua: string;
  body: string;
}

export class HUD {
  public root: HTMLElement;
  private titleScreenEl: HTMLElement;
  private hudEl: HTMLElement;
  private settingsModalEl: HTMLElement;
  private journalModalEl: HTMLElement;
  private journalListEl!: HTMLElement;
  private objectiveTextEl!: HTMLElement;
  private interactHintEl!: HTMLElement;
  private compassEl!: HTMLElement;
  private instinctBadgeEl!: HTMLElement;
  private grapplePromptEl!: HTMLElement;
  private grappleTextEl!: HTMLElement;

  public isTitleOpen = true;
  public isJournalOpen = false;
  private entries: JournalEntry[] = [
    {
      id: 'prologue',
      title: 'Expedition Log I — Urubamba Gorge',
      quechua: 'Qhapaq Ñan · The Royal Road',
      body: 'Dr. Naira Quispe: Our ascent through the cloud forest has brought us to a surviving Q’eswachaka suspension bridge. A bronze Inti sun-mirror stands on the south cliff rim, aimed toward a carved monolith across the canyon.',
    },
  ];

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
    this.journalModalEl = this.createJournalModal();

    this.root.appendChild(this.titleScreenEl);
    this.root.appendChild(this.hudEl);
    this.root.appendChild(this.settingsModalEl);
    this.root.appendChild(this.journalModalEl);

    this.bindSettings();
    this.bindOfflineControls();
    this.renderJournalEntries();
  }

  private createTitleScreen(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'juzu-title-screen';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'justify-content:space-between',
      'align-items:center',
      'padding:20px 16px 28px 16px',
      'background:linear-gradient(180deg, rgba(8,12,10,0.65) 0%, rgba(8,12,10,0.0) 22%, rgba(8,12,10,0.0) 74%, rgba(8,12,10,0.72) 100%)',
      'z-index:45',
      'font-family:Georgia, serif',
      'color:#f2ece1',
      'transition:opacity 0.6s ease',
      'pointer-events:none',
    ].join(';');

    const controlsHint = MOBILE
      ? ''
      : '<div style="font-size:11px;letter-spacing:0.05em;color:#9b9487;line-height:1.6;margin-top:8px;">WASD Move · Space Jump · F Grapple · Shift Sprint · C Crouch · Tab Journal</div>';

    el.innerHTML = `
      <!-- Top Title Bar (Non-blocking) -->
      <div style="text-align:center;pointer-events:auto;background:rgba(12,16,14,0.72);padding:12px 24px;border-radius:6px;border:1px solid rgba(212,184,136,0.32);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 4px 22px rgba(0,0,0,0.55);max-width:440px;width:90%;">
        <div id="juzu-offline-indicator" style="display:none;position:absolute;top:12px;right:16px;padding:4px 8px;background:rgba(18,24,20,0.92);border:1px solid #c9a468;border-radius:3px;font-size:10px;letter-spacing:0.12em;color:#e6c896;text-transform:uppercase;">📡 Offline</div>
        <div style="font-size:10px;letter-spacing:0.32em;color:#d4b888;text-transform:uppercase;margin-bottom:3px;">Archaeological Expedition · Inca Andes</div>
        <h1 style="font-size:32px;letter-spacing:0.2em;margin:0 0 2px 0;color:#fdfaf2;text-shadow:0 2px 12px rgba(0,0,0,0.9);font-weight:400;">J U Z U</h1>
        <div style="font-size:13px;letter-spacing:0.1em;color:#e6c896;font-style:italic;">The Search for Paititi</div>
      </div>

      <!-- Bottom Interactive Action Bar -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:auto;max-width:440px;width:90%;">
        <button id="juzu-btn-begin" style="width:100%;max-width:280px;padding:12px 24px;background:radial-gradient(circle, #384836 0%, #1e281e 100%);color:#fdfaf2;border:2px solid #c9a468;border-radius:24px;cursor:pointer;font-family:Georgia,serif;font-size:14px;letter-spacing:0.1em;box-shadow:0 6px 20px rgba(0,0,0,0.65);transition:transform 0.15s ease;">
          ✦ Begin Expedition ✦
        </button>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
          <button id="juzu-btn-toggle-chapters" style="padding:6px 14px;background:rgba(22,28,24,0.85);color:#dcd4c6;border:1px solid #6b5c46;border-radius:14px;cursor:pointer;font-family:Georgia,serif;font-size:11px;letter-spacing:0.06em;">Select Chapter</button>
          <button id="juzu-btn-title-offline" style="padding:6px 14px;background:rgba(22,28,24,0.85);color:#dcd4c6;border:1px solid #6b5c46;border-radius:14px;cursor:pointer;font-family:Georgia,serif;font-size:11px;letter-spacing:0.06em;display:inline-flex;align-items:center;gap:4px;">
            <span>📥</span><span id="juzu-title-offline-text">Offline Mode</span>
          </button>
          <button id="juzu-btn-title-settings" style="padding:6px 14px;background:rgba(22,28,24,0.85);color:#dcd4c6;border:1px solid #6b5c46;border-radius:14px;cursor:pointer;font-family:Georgia,serif;font-size:11px;letter-spacing:0.06em;">Settings</button>
        </div>

        <div id="juzu-chapter-list" style="display:none;flex-direction:column;gap:6px;width:100%;font-size:11px;">
          <button class="juzu-chap-pick" data-region="cloudForest" style="padding:7px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;border-radius:3px;cursor:pointer;">Chapter I: Cloud Forest Valleys</button>
          <button class="juzu-chap-pick" data-region="highSierra" style="padding:7px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;border-radius:3px;cursor:pointer;">Chapter IV: High Sierra (Intihuatana)</button>
          <button class="juzu-chap-pick" data-region="jungleLowlands" style="padding:7px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;border-radius:3px;cursor:pointer;">Chapter VII: Antisuyu Rainforest Cenote</button>
          <button class="juzu-chap-pick" data-region="paititi" style="padding:7px 10px;background:#1e2722;color:#f2ece1;border:1px solid #584c3c;border-radius:3px;cursor:pointer;">Chapter X: Paititi — Plaza of the Sun</button>
        </div>

        ${controlsHint}
      </div>
    `;

    const startExpedition = () => {
      this.closeTitle();
      this.audio.resume();
      this.audio.playQuenaNote(523.25, 1.8);
      this.callbacks.onBeginExpedition();
    };

    el.querySelector('#juzu-btn-begin')?.addEventListener('click', startExpedition);

    // Any touch/click outside the buttons also dismisses the title screen and begins
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.isTitleOpen) return;
        const target = e.target as HTMLElement;
        if (
          target.closest('#juzu-btn-toggle-chapters') ||
          target.closest('#juzu-chapter-list') ||
          target.closest('#juzu-btn-title-offline') ||
          target.closest('#juzu-btn-title-settings') ||
          target.closest('#juzu-settings-modal')
        ) {
          return;
        }
        startExpedition();
      },
      { once: true }
    );

    const chapList = el.querySelector('#juzu-chapter-list') as HTMLElement;
    el.querySelector('#juzu-btn-toggle-chapters')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chapList) {
        chapList.style.display = chapList.style.display === 'none' ? 'flex' : 'none';
      }
    });

    el.querySelectorAll('.juzu-chap-pick').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const region = (e.currentTarget as HTMLElement).getAttribute('data-region') as any;
        if (region) {
          this.closeTitle();
          this.audio.resume();
          this.callbacks.onSelectRegion(region);
          this.callbacks.onBeginExpedition();
        }
      });
    });

    el.querySelector('#juzu-btn-title-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
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
      <div id="juzu-objective-wrap" style="position:absolute;top:136px;left:18px;max-width:320px;background:rgba(12,16,14,0.76);border-left:3px solid #c9a468;padding:8px 14px;border-radius:4px;box-shadow:0 4px 18px rgba(0,0,0,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
        <div style="font-size:9px;letter-spacing:0.2em;color:#c9a468;text-transform:uppercase;margin-bottom:2px;">Objective</div>
        <div id="juzu-objective-text" style="font-size:12px;color:#f2ede4;line-height:1.35;">Align the bronze Inti sun-mirror on the south cliff or cross the hanging bridge to the North Sanctuary.</div>
      </div>

      <div id="juzu-compass" style="display:none;"></div>
      <div id="juzu-instinct-badge" style="display:none;"></div>

      <!-- Grapple Swing Reticle & Prompt Center-Screen -->
      <div id="juzu-grapple-prompt" style="display:none;position:absolute;top:44%;left:50%;transform:translate(-50%, -50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;">
        <div style="width:38px;height:38px;border:2px solid #ffd778;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(255,215,120,0.85);background:rgba(20,16,10,0.45);">
          <div style="width:12px;height:12px;background:#ffd778;border-radius:50%;"></div>
        </div>
        <div id="juzu-grapple-text" style="padding:4px 12px;background:rgba(12,16,14,0.88);border:1px solid #c9a468;border-radius:3px;font-size:11px;letter-spacing:0.12em;color:#fdfaf2;text-transform:uppercase;box-shadow:0 2px 10px rgba(0,0,0,0.7);">
          [F / Space] Grapple Swing
        </div>
      </div>

      <!-- Interaction Hint Bottom-Center -->
      <div id="juzu-interact-hint" style="display:none;position:absolute;bottom:42px;left:50%;transform:translateX(-50%);padding:9px 20px;background:rgba(14,20,16,0.92);border:1px solid #c9a468;border-radius:4px;font-size:13px;color:#ffd778;box-shadow:0 4px 20px rgba(0,0,0,0.75);">
        [E] Interact
      </div>
    `;

    this.objectiveTextEl = el.querySelector('#juzu-objective-text')!;
    this.interactHintEl = el.querySelector('#juzu-interact-hint')!;
    this.compassEl = el.querySelector('#juzu-compass')!;
    this.instinctBadgeEl = el.querySelector('#juzu-instinct-badge')!;
    this.grapplePromptEl = el.querySelector('#juzu-grapple-prompt')!;
    this.grappleTextEl = el.querySelector('#juzu-grapple-text')!;

    el.querySelector('#juzu-btn-hud-journal')?.addEventListener('click', () => {
      this.toggleJournal();
    });

    return el;
  }

  private createJournalModal(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'juzu-journal-modal';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(6, 10, 8, 0.82)',
      'z-index:52',
      'font-family:Georgia, serif',
      'color:#f2ece1',
    ].join(';');

    el.innerHTML = `
      <div style="width:min(560px, 92vw);background:rgba(24, 20, 16, 0.96);border:1px solid #c9a468;border-radius:4px;padding:26px 30px;box-shadow:0 12px 42px rgba(0,0,0,0.9);max-height:84vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(201,164,104,0.3);padding-bottom:12px;margin-bottom:18px;">
          <div>
            <div style="font-size:10px;letter-spacing:0.26em;color:#c9a468;text-transform:uppercase;">Dr. Naira Quispe · Archaeological Notes</div>
            <h2 style="margin:4px 0 0 0;font-size:22px;letter-spacing:0.08em;color:#fdfaf2;font-weight:400;">EXPEDITION FIELD JOURNAL</h2>
          </div>
          <button id="juzu-journal-close" style="background:transparent;border:none;color:#d4b888;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div id="juzu-journal-entries" style="display:flex;flex-direction:column;gap:14px;"></div>
      </div>
    `;

    this.journalListEl = el.querySelector('#juzu-journal-entries')!;
    el.querySelector('#juzu-journal-close')?.addEventListener('click', () => {
      this.toggleJournal(false);
    });

    return el;
  }

  public addJournalEntry(entry: JournalEntry): void {
    if (this.entries.some((e) => e.id === entry.id)) return;
    this.entries.unshift(entry);
    this.renderJournalEntries();
  }

  private renderJournalEntries(): void {
    if (!this.journalListEl) return;
    this.journalListEl.innerHTML = this.entries
      .map(
        (e) => `
        <div style="padding:12px 14px;background:rgba(14,12,10,0.68);border-left:3px solid #c9a468;border-radius:2px;">
          <div style="font-size:10px;letter-spacing:0.18em;color:#c9a468;text-transform:uppercase;">${e.quechua}</div>
          <div style="font-size:15px;color:#fdfaf2;margin:3px 0 6px 0;font-weight:bold;">${e.title}</div>
          <div style="font-size:13px;color:#dcd4c6;line-height:1.5;">${e.body}</div>
        </div>
      `
      )
      .join('');
  }

  public toggleJournal(force?: boolean): void {
    this.isJournalOpen = force !== undefined ? force : !this.isJournalOpen;
    this.journalModalEl.style.display = this.isJournalOpen ? 'flex' : 'none';
  }

  public setInstinctActive(active: boolean): void {
    if (!this.instinctBadgeEl) return;
    if (active) {
      this.instinctBadgeEl.style.borderColor = '#ffd778';
      this.instinctBadgeEl.style.color = '#ffd778';
      this.instinctBadgeEl.style.background = 'rgba(48, 38, 16, 0.88)';
    } else {
      this.instinctBadgeEl.style.borderColor = 'rgba(212,184,136,0.3)';
      this.instinctBadgeEl.style.color = '#d4b888';
      this.instinctBadgeEl.style.background = 'rgba(12,16,14,0.72)';
    }
  }

  public setGrapplePrompt(visible: boolean, text = '[F / Space] Grapple Swing'): void {
    if (!this.grapplePromptEl) return;
    this.grapplePromptEl.style.display = visible ? 'flex' : 'none';
    if (this.grappleTextEl && text) {
      this.grappleTextEl.textContent = text;
    }
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
    this.titleScreenEl.style.display = 'none';
    this.hudEl.style.display = 'block';
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
