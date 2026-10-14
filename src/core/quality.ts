/**
 * Module: src/core/quality.ts
 * Responsibility: Adaptive quality tiers (HIGH / MEDIUM / LOW), DPR clamping,
 * frame-time exponential moving average (60 fps desktop / 30 fps mobile targets),
 * draw-call budget monitoring, and distance-gating constants per Bible §5.2.
 * Depends on: none (foundational core module).
 * Exports: QualityTier, QualitySettings, QualityManager.
 */

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface QualitySettings {
  readonly tier: QualityTier;
  readonly dpr: number;
  readonly shadowMapSize: number;
  readonly maxDrawCalls: number;
  readonly foliageDensityMultiplier: number;
  readonly setpieceUpdateRadiusSq: number;
  readonly npcUpdateRadiusSq: number;
  readonly bloomEnabled: boolean;
  readonly waterReflections: boolean;
}

const DESKTOP_HIGH: QualitySettings = {
  tier: 'HIGH',
  dpr: 1.5,
  shadowMapSize: 2048,
  maxDrawCalls: 150,
  foliageDensityMultiplier: 1.0,
  setpieceUpdateRadiusSq: 60 * 60,
  npcUpdateRadiusSq: 100 * 100,
  bloomEnabled: true,
  waterReflections: true,
};

const DESKTOP_MEDIUM: QualitySettings = {
  tier: 'MEDIUM',
  dpr: 1.25,
  shadowMapSize: 1536,
  maxDrawCalls: 120,
  foliageDensityMultiplier: 0.75,
  setpieceUpdateRadiusSq: 50 * 50,
  npcUpdateRadiusSq: 85 * 85,
  bloomEnabled: true,
  waterReflections: true,
};

const MOBILE_OR_LOW: QualitySettings = {
  tier: 'LOW',
  dpr: 1.0,
  shadowMapSize: 1024,
  maxDrawCalls: 80,
  foliageDensityMultiplier: 0.55,
  setpieceUpdateRadiusSq: 42 * 42,
  npcUpdateRadiusSq: 70 * 70,
  bloomEnabled: false,
  waterReflections: false,
};

export class QualityManager {
  public readonly isMobile: boolean;
  public readonly targetFrameMs: number;
  private currentTier: QualityTier;
  private settings: QualitySettings;
  private emaFrameMs: number;
  private overloadDurationSec: number = 0;
  private cooldownSec: number = 0;
  private autoAdapt: boolean = true;
  private onTierChangeCallbacks: Array<(settings: QualitySettings) => void> = [];

  constructor() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    this.targetFrameMs = this.isMobile ? 33.33 : 16.67;
    this.emaFrameMs = this.targetFrameMs;
    this.currentTier = this.isMobile ? 'MEDIUM' : 'HIGH';
    this.settings = this.computeSettings(this.currentTier);
  }

  public build(): void {
    this.emaFrameMs = this.targetFrameMs;
    this.overloadDurationSec = 0;
    this.cooldownSec = 0;
  }

  public getSettings(): QualitySettings {
    return this.settings;
  }

  public getTier(): QualityTier {
    return this.currentTier;
  }

  public getAverageFrameMs(): number {
    return this.emaFrameMs;
  }

  public setAutoAdapt(enabled: boolean): void {
    this.autoAdapt = enabled;
  }

  public setTier(tier: QualityTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    this.settings = this.computeSettings(tier);
    for (let i = 0; i < this.onTierChangeCallbacks.length; i++) {
      this.onTierChangeCallbacks[i](this.settings);
    }
  }

  public onTierChanged(cb: (settings: QualitySettings) => void): void {
    this.onTierChangeCallbacks.push(cb);
  }

  public update(dt: number): void {
    const frameMs = dt * 1000;
    this.emaFrameMs = this.emaFrameMs * 0.92 + frameMs * 0.08;

    if (!this.autoAdapt) return;

    if (this.cooldownSec > 0) {
      this.cooldownSec -= dt;
      return;
    }

    const thresholdMs = this.targetFrameMs * 1.35;
    if (this.emaFrameMs > thresholdMs) {
      this.overloadDurationSec += dt;
      if (this.overloadDurationSec > 2.5) {
        this.stepDownTier();
        this.overloadDurationSec = 0;
        this.cooldownSec = 5.0;
      }
    } else {
      this.overloadDurationSec = Math.max(0, this.overloadDurationSec - dt * 0.5);
    }
  }

  private stepDownTier(): void {
    if (this.currentTier === 'HIGH') {
      this.setTier('MEDIUM');
    } else if (this.currentTier === 'MEDIUM') {
      this.setTier('LOW');
    }
  }

  private computeSettings(tier: QualityTier): QualitySettings {
    const nativeDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (tier === 'HIGH') {
      return {
        ...DESKTOP_HIGH,
        dpr: Math.min(nativeDpr, this.isMobile ? 1.35 : 1.75),
        shadowMapSize: this.isMobile ? 1024 : 2048,
        maxDrawCalls: this.isMobile ? 80 : 150,
      };
    }
    if (tier === 'MEDIUM') {
      return {
        ...DESKTOP_MEDIUM,
        dpr: Math.min(nativeDpr, this.isMobile ? 1.15 : 1.35),
        shadowMapSize: this.isMobile ? 1024 : 1536,
        maxDrawCalls: this.isMobile ? 80 : 120,
      };
    }
    return {
      ...MOBILE_OR_LOW,
      dpr: 1.0,
    };
  }

  public dispose(): void {
    this.onTierChangeCallbacks.length = 0;
  }
}
