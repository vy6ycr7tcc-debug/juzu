/**
 * Module: src/core/save.ts
 * Responsibility: Save/load persistence and Sanctuary Checkpoints per Bible §3.8.
 * Stores JSON in localStorage + supports downloadable JSON export.
 * Depends on: none.
 * Exports: SaveData, SaveManager.
 */

export interface SaveData {
  version: number;
  timestamp: number;
  chapter: number;
  regionId: 'cloudForest' | 'highSierra' | 'jungleLowlands' | 'paititi';
  timeOfDay: 'dawn' | 'noon' | 'afternoon' | 'dusk' | 'night';
  position: [number, number, number];
  yaw: number;
  health: number;
  stamina: number;
  questFlags: Record<string, boolean>;
  collectedQuipus: string[];
  unlockedViewpoints: string[];
  journalEntries: string[];
}

const STORAGE_KEY = 'juzu_save_v1';

export class SaveManager {
  private currentSave: SaveData;

  constructor() {
    this.currentSave = this.createDefaultSave();
  }

  public build(): void {
    const loaded = this.loadFromStorage();
    if (loaded) {
      this.currentSave = loaded;
    }
  }

  public createDefaultSave(): SaveData {
    return {
      version: 1,
      timestamp: Date.now(),
      chapter: 1,
      regionId: 'cloudForest',
      timeOfDay: 'afternoon',
      position: [0, 0, 14],
      yaw: Math.PI,
      health: 100,
      stamina: 100,
      questFlags: {
        q_cf_entered_valley: true,
        q_cf_bridge_crossed: false,
        q_cf_stele_read: false,
        q_cf_viewpoint_synced: false,
        q_hs_solar_aligned: false,
        q_jl_sluice_opened: false,
        q_exp_vilcabamba_trail: false,
        q_exp_condor_synced: false,
        q_exp_braziers_lit: false,
        q_exp_sanctum_claimed: false,
      },
      collectedQuipus: ['quipu_cusco_market_01'],
      unlockedViewpoints: [],
      journalEntries: [
        'Cusco Archive Note: The knotted cords from the San Pedro market name a cloud-forest ravine where water still runs through cut stone channels.',
      ],
    };
  }

  public hasSavedGame(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      return window.localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  public getState(): SaveData {
    return this.currentSave;
  }

  public saveCheckpoint(
    x: number,
    y: number,
    z: number,
    yaw: number,
    timeOfDay: SaveData['timeOfDay']
  ): void {
    this.currentSave.position[0] = x;
    this.currentSave.position[1] = y;
    this.currentSave.position[2] = z;
    this.currentSave.yaw = yaw;
    this.currentSave.timeOfDay = timeOfDay;
    this.currentSave.timestamp = Date.now();
    this.persist();
  }

  public setQuestFlag(flag: string, value: boolean = true): void {
    if (this.currentSave.questFlags[flag] === value) return;
    this.currentSave.questFlags[flag] = value;
    this.currentSave.timestamp = Date.now();
    this.persist();
  }

  public addJournalEntry(entry: string): void {
    if (!this.currentSave.journalEntries.includes(entry)) {
      this.currentSave.journalEntries.push(entry);
      this.persist();
    }
  }

  public persist(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSave));
    } catch {
      // Ignore quota or SecurityError in restricted webviews / private browsing
    }
  }

  public loadFromStorage(): SaveData | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.position)) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  public exportDownload(): void {
    if (typeof document === 'undefined') return;
    const blob = new Blob([JSON.stringify(this.currentSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `juzu-save-ch${this.currentSave.chapter}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public update(_dt: number): void {
    // Save state is event-driven on checkpoints and quest flag changes
  }

  public dispose(): void {
    this.persist();
  }
}
