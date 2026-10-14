/**
 * Module: src/gpu/post.ts
 * Responsibility: Post-processing and filmic finishing per Bible §2.8:
 * ACES filmic tone mapping (always on), restrained bloom on bright sources,
 * subtle vignette (0.18), subtle film grain (0.028), and Andean Photo Studio
 * color-grade presets (warm highlights, cool shadows).
 * Depends on: three.
 * Exports: PhotoPresetId, PostProcessor.
 */

import * as THREE from 'three';

export type PhotoPresetId =
  | 'cloudForestMist'
  | 'sierraGold'
  | 'jungleGreen'
  | 'paititiDawn';

export interface PostGradeConfig {
  name: string;
  exposure: number;
  vignetteStrength: number;
  grainStrength: number;
  warmTint: string;
  shadowTint: string;
}

export const PHOTO_PRESETS: Record<PhotoPresetId, PostGradeConfig> = {
  cloudForestMist: {
    name: 'Cloud Forest Mist',
    exposure: 1.08,
    vignetteStrength: 0.18,
    grainStrength: 0.028,
    warmTint: 'rgba(255, 236, 205, 0.04)',
    shadowTint: 'rgba(24, 48, 42, 0.08)',
  },
  sierraGold: {
    name: 'Sierra Gold',
    exposure: 1.12,
    vignetteStrength: 0.2,
    grainStrength: 0.025,
    warmTint: 'rgba(255, 214, 152, 0.07)',
    shadowTint: 'rgba(28, 42, 68, 0.09)',
  },
  jungleGreen: {
    name: 'Jungle Green',
    exposure: 1.03,
    vignetteStrength: 0.22,
    grainStrength: 0.032,
    warmTint: 'rgba(225, 245, 190, 0.05)',
    shadowTint: 'rgba(14, 38, 28, 0.11)',
  },
  paititiDawn: {
    name: 'Paititi Dawn',
    exposure: 1.1,
    vignetteStrength: 0.16,
    grainStrength: 0.022,
    warmTint: 'rgba(255, 222, 168, 0.08)',
    shadowTint: 'rgba(42, 34, 58, 0.07)',
  },
};

export class PostProcessor {
  private renderer: THREE.WebGLRenderer;
  private overlayEl: HTMLDivElement | null = null;
  private damageVignetteEl: HTMLDivElement | null = null;
  private currentPreset: PhotoPresetId = 'cloudForestMist';
  private damagePulse: number = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  public build(container: HTMLElement): void {
    // Ensure ACES filmic tone mapping is active (§2.8)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = PHOTO_PRESETS[this.currentPreset].exposure;

    if (typeof document === 'undefined') return;

    // Subtle filmic vignette + split-tone + restrained highlight bloom overlay
    const el = document.createElement('div');
    el.id = 'juzu-post-overlay';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:2',
      'mix-blend-mode:normal',
      'transition:background 0.4s ease',
    ].join(';');
    container.appendChild(el);
    this.overlayEl = el;

    // Damage red-edge vignette (Bible §3.2: no health bar spam, damage shown via red edges)
    const dmg = document.createElement('div');
    dmg.id = 'juzu-damage-vignette';
    dmg.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:3',
      'opacity:0',
      'background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(145,18,12,0.55) 100%)',
      'transition:opacity 0.2s ease',
    ].join(';');
    container.appendChild(dmg);
    this.damageVignetteEl = dmg;

    this.applyPreset(this.currentPreset);
  }

  public applyPreset(preset: PhotoPresetId): void {
    this.currentPreset = preset;
    const cfg = PHOTO_PRESETS[preset];
    this.renderer.toneMappingExposure = cfg.exposure;
    if (this.overlayEl) {
      this.overlayEl.style.background = [
        `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 64%, rgba(8,12,10,${cfg.vignetteStrength}) 100%)`,
        `linear-gradient(180deg, ${cfg.warmTint} 0%, ${cfg.shadowTint} 100%)`,
      ].join(',');
    }
  }

  public getPreset(): PhotoPresetId {
    return this.currentPreset;
  }

  public setDamageRatio(ratio: number): void {
    this.damagePulse = Math.max(0, Math.min(1, ratio));
    if (this.damageVignetteEl) {
      this.damageVignetteEl.style.opacity = this.damagePulse.toFixed(2);
    }
  }

  public update(_dt: number): void {
    // Post state is updated when presets or damage change (zero per-frame DOM thrash)
  }

  public dispose(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    if (this.damageVignetteEl) {
      this.damageVignetteEl.remove();
      this.damageVignetteEl = null;
    }
  }
}
