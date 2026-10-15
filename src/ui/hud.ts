/**
 * Module: src/ui/hud.ts
 * Responsibility: Minimal diegetic HUD per Bible §3.11:
 * - No minimap, no health bar, no floating quest markers.
 * - Contextual interaction prompt (bottom-center).
 * - Thin stamina bar (bottom-left, visible ONLY when draining).
 * - Small ammo icon + count (bottom-right, visible ONLY when bow is drawn).
 * - Small objective text (top-left, fades after 5 seconds, reappears on journal open).
 * Depends on: src/gameplay/crafting.ts.
 * Exports: HudOverlay.
 */

import { ArrowType } from '../gameplay/crafting';

export class HudOverlay {
  private rootEl: HTMLDivElement | null = null;
  private objectiveEl: HTMLDivElement | null = null;
  private promptEl: HTMLDivElement | null = null;
  private staminaWrapEl: HTMLDivElement | null = null;
  private staminaFillEl: HTMLDivElement | null = null;
  private ammoEl: HTMLDivElement | null = null;
  private letterboxTopEl: HTMLDivElement | null = null;
  private letterboxBottomEl: HTMLDivElement | null = null;

  private lastObjective: string = '';
  private lastObjectiveVisible: boolean = false;
  private lastPrompt: string = '';
  private lastStaminaVisible: boolean = false;
  private lastStaminaPct: number = 100;
  private lastAmmoVisible: boolean = false;
  private lastAmmoText: string = '';

  public build(container: HTMLElement): void {
    if (typeof document === 'undefined') return;

    // Cinematic 2.35:1 Letterbox Bars for establishing vista sweeps
    const topBar = document.createElement('div');
    topBar.id = 'juzu-letterbox-top';
    topBar.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'height:9.5vh',
      'background:#070908',
      'z-index:22',
      'pointer-events:none',
      'transform:translateY(-100%)',
      'transition:transform 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
      'box-shadow:0 2px 20px rgba(0,0,0,0.85)',
    ].join(';');
    container.appendChild(topBar);
    this.letterboxTopEl = topBar;

    const bottomBar = document.createElement('div');
    bottomBar.id = 'juzu-letterbox-bottom';
    bottomBar.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'height:9.5vh',
      'background:#070908',
      'z-index:22',
      'pointer-events:none',
      'transform:translateY(100%)',
      'transition:transform 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
      'box-shadow:0 -2px 20px rgba(0,0,0,0.85)',
    ].join(';');
    container.appendChild(bottomBar);
    this.letterboxBottomEl = bottomBar;

    const root = document.createElement('div');
    root.id = 'juzu-hud-root';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:10',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#f4efe6',
      'padding:env(safe-area-inset-top, 20px) env(safe-area-inset-right, 24px) env(safe-area-inset-bottom, 20px) env(safe-area-inset-left, 24px)',
    ].join(';');

    // Top-left objective banner (fades after 5s per §3.11)
    const obj = document.createElement('div');
    obj.setAttribute('data-hud-element', 'true');
    obj.style.cssText = [
      'position:absolute',
      'top:60px',
      'left:26px',
      'max-width:440px',
      'font-size:14px',
      'letter-spacing:0.03em',
      'line-height:1.45',
      'text-shadow:0 1px 4px rgba(0,0,0,0.85)',
      'opacity:0',
      'transition:opacity 0.6s ease',
    ].join(';');
    root.appendChild(obj);
    this.objectiveEl = obj;

    // Bottom-center contextual interaction prompt (§3.11)
    const prompt = document.createElement('div');
    prompt.setAttribute('data-hud-element', 'true');
    prompt.style.cssText = [
      'position:absolute',
      'bottom:54px',
      'left:50%',
      'transform:translateX(-50%)',
      'padding:6px 14px',
      'background:rgba(18, 22, 18, 0.72)',
      'border:1px solid rgba(212, 184, 136, 0.42)',
      'border-radius:3px',
      'font-size:13px',
      'letter-spacing:0.05em',
      'opacity:0',
      'transition:opacity 0.2s ease',
    ].join(';');
    root.appendChild(prompt);
    this.promptEl = prompt;

    // Bottom-left thin health bar (crimson andean band, visible when damaged)
    const healthWrap = document.createElement('div');
    healthWrap.id = 'juzu-health-wrap';
    healthWrap.setAttribute('data-hud-element', 'true');
    healthWrap.style.cssText = [
      'position:absolute',
      'bottom:38px',
      'left:26px',
      'width:130px',
      'height:4px',
      'background:rgba(0,0,0,0.5)',
      'border-radius:2px',
      'overflow:hidden',
      'opacity:0',
      'transition:opacity 0.3s ease',
    ].join(';');
    const healthFill = document.createElement('div');
    healthFill.style.cssText = [
      'width:100%',
      'height:100%',
      'background:#b92c28',
      'transition:width 0.2s ease',
    ].join(';');
    healthWrap.appendChild(healthFill);
    root.appendChild(healthWrap);
    this.healthWrapEl = healthWrap;
    this.healthFillEl = healthFill;

    // Bottom-left thin stamina bar (visible ONLY when draining per §3.11)
    const stamWrap = document.createElement('div');
    stamWrap.setAttribute('data-hud-element', 'true');
    stamWrap.style.cssText = [
      'position:absolute',
      'bottom:28px',
      'left:26px',
      'width:130px',
      'height:4px',
      'background:rgba(0,0,0,0.45)',
      'border-radius:2px',
      'overflow:hidden',
      'opacity:0',
      'transition:opacity 0.3s ease',
    ].join(';');
    const stamFill = document.createElement('div');
    stamFill.style.cssText = [
      'width:100%',
      'height:100%',
      'background:#d9b36c',
    ].join(';');
    stamWrap.appendChild(stamFill);
    root.appendChild(stamWrap);
    this.staminaWrapEl = stamWrap;
    this.staminaFillEl = stamFill;

    // Bottom-right ammo count (visible ONLY when bow is drawn per §3.11)
    const ammo = document.createElement('div');
    ammo.setAttribute('data-hud-element', 'true');
    ammo.style.cssText = [
      'position:absolute',
      'bottom:26px',
      'right:28px',
      'font-size:14px',
      'letter-spacing:0.06em',
      'text-shadow:0 1px 3px rgba(0,0,0,0.9)',
      'opacity:0',
      'transition:opacity 0.2s ease',
    ].join(';');
    root.appendChild(ammo);
    this.ammoEl = ammo;

    // 5. Cinematic Screen Damage Vignette (pulsing red edge on taking damage)
    const dmgVignette = document.createElement('div');
    dmgVignette.id = 'juzu-damage-vignette';
    dmgVignette.style.cssText = [
      'position:absolute',
      'inset:0',
      'background:radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(185, 25, 20, 0.72) 100%)',
      'opacity:0',
      'transition:opacity 0.25s ease',
      'pointer-events:none',
    ].join(';');
    root.appendChild(dmgVignette);
    this.damageVignetteEl = dmgVignette;

    // 6. Chapter Transition Title Card
    const chapCard = document.createElement('div');
    chapCard.id = 'juzu-chapter-card';
    chapCard.style.cssText = [
      'position:absolute',
      'top:32%',
      'left:50%',
      'transform:translate(-50%, -50%)',
      'text-align:center',
      'opacity:0',
      'transition:opacity 0.8s ease',
      'pointer-events:none',
    ].join(';');
    chapCard.innerHTML = `
      <div id="juzu-chap-subtitle" style="font-size:12px;letter-spacing:0.25em;color:#d4b888;text-transform:uppercase;margin-bottom:8px;"></div>
      <div id="juzu-chap-title" style="font-size:28px;letter-spacing:0.08em;color:#fdfaf2;text-shadow:0 2px 10px rgba(0,0,0,0.9);"></div>
      <div style="width:64px;height:1px;background:#d4b888;margin:12px auto 0 auto;opacity:0.6;"></div>
    `;
    root.appendChild(chapCard);
    this.chapterCardEl = chapCard;

    // 7. Full-screen Death / Respawn Overlay
    const deathOverlay = document.createElement('div');
    deathOverlay.id = 'juzu-death-overlay';
    deathOverlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(8, 4, 4, 0.94)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'opacity:0',
      'transition:opacity 1.0s ease',
      'pointer-events:none',
      'z-index:50',
    ].join(';');
    deathOverlay.innerHTML = `
      <div style="font-size:14px;letter-spacing:0.3em;color:#b23b38;text-transform:uppercase;margin-bottom:12px;">Expedition Interrupted</div>
      <div style="font-size:32px;letter-spacing:0.06em;color:#f2ede4;margin-bottom:14px;">Naira Has Fallen</div>
      <div style="font-size:13px;letter-spacing:0.08em;color:#9b9487;">Restoring to last sanctuary checkpoint...</div>
    `;
    container.appendChild(deathOverlay);
    this.deathOverlayEl = deathOverlay;

    container.appendChild(root);
    this.rootEl = root;
  }

  private healthWrapEl: HTMLDivElement | null = null;
  private healthFillEl: HTMLDivElement | null = null;
  private lastHealthPct: number = 100;
  private lastHealthVisible: boolean = false;
  private damageVignetteEl: HTMLDivElement | null = null;
  private chapterCardEl: HTMLDivElement | null = null;
  private deathOverlayEl: HTMLDivElement | null = null;
  private damageFlashTimeout: number | null = null;
  private chapterBannerTimeout: number | null = null;

  public flashDamage(intensity: number = 0.75): void {
    if (!this.damageVignetteEl) return;
    this.damageVignetteEl.style.opacity = `${Math.min(1.0, intensity)}`;
    if (this.damageFlashTimeout !== null) clearTimeout(this.damageFlashTimeout);
    this.damageFlashTimeout = window.setTimeout(() => {
      if (this.damageVignetteEl) this.damageVignetteEl.style.opacity = '0';
      this.damageFlashTimeout = null;
    }, 450);
  }

  public showDeathScreen(visible: boolean): void {
    if (!this.deathOverlayEl) return;
    this.deathOverlayEl.style.opacity = visible ? '1' : '0';
    this.deathOverlayEl.style.pointerEvents = visible ? 'auto' : 'none';
  }

  public showChapterBanner(title: string, subtitle: string): void {
    if (!this.chapterCardEl) return;
    const tEl = this.chapterCardEl.querySelector('#juzu-chap-title');
    const sEl = this.chapterCardEl.querySelector('#juzu-chap-subtitle');
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = subtitle;
    this.chapterCardEl.style.opacity = '1';
    if (this.chapterBannerTimeout !== null) clearTimeout(this.chapterBannerTimeout);
    this.chapterBannerTimeout = window.setTimeout(() => {
      if (this.chapterCardEl) this.chapterCardEl.style.opacity = '0';
      this.chapterBannerTimeout = null;
    }, 4200);
  }

  public setVisible(visible: boolean): void {
    if (this.rootEl) {
      this.rootEl.style.display = visible ? 'block' : 'none';
    }
  }

  public update(
    _dt: number,
    objectiveText: string,
    objectiveVisible: boolean,
    interactionPrompt: string,
    stamina: number,
    bowDrawn: boolean,
    arrowType: ArrowType,
    arrowCount: number,
    health: number = 100
  ): void {
    // Dirty-checked DOM updates — zero per-frame string allocations when unchanged (§5.2)
    if (this.objectiveEl) {
      if (this.lastObjective !== objectiveText) {
        this.lastObjective = objectiveText;
        this.objectiveEl.textContent = objectiveText;
      }
      if (this.lastObjectiveVisible !== objectiveVisible) {
        this.lastObjectiveVisible = objectiveVisible;
        this.objectiveEl.style.opacity = objectiveVisible ? '0.92' : '0';
      }
    }

    if (this.promptEl && this.lastPrompt !== interactionPrompt) {
      this.lastPrompt = interactionPrompt;
      this.promptEl.textContent = interactionPrompt;
      this.promptEl.style.opacity = interactionPrompt.length > 0 ? '1' : '0';
    }

    const hpVisible = health < 99.0;
    const hpRounded = Math.max(0, Math.min(100, Math.round(health)));
    if (this.healthWrapEl && this.lastHealthVisible !== hpVisible) {
      this.lastHealthVisible = hpVisible;
      this.healthWrapEl.style.opacity = hpVisible ? '0.92' : '0';
    }
    if (this.healthFillEl && hpVisible && this.lastHealthPct !== hpRounded) {
      this.lastHealthPct = hpRounded;
      this.healthFillEl.style.width = `${hpRounded}%`;
    }

    const stamVisible = stamina < 99.0;
    const stamRounded = Math.round(stamina);
    if (this.staminaWrapEl && this.lastStaminaVisible !== stamVisible) {
      this.lastStaminaVisible = stamVisible;
      this.staminaWrapEl.style.opacity = stamVisible ? '0.9' : '0';
    }
    if (this.staminaFillEl && stamVisible && this.lastStaminaPct !== stamRounded) {
      this.lastStaminaPct = stamRounded;
      this.staminaFillEl.style.width = `${stamRounded}%`;
    }

    if (this.ammoEl) {
      if (this.lastAmmoVisible !== bowDrawn) {
        this.lastAmmoVisible = bowDrawn;
        this.ammoEl.style.opacity = bowDrawn ? '0.95' : '0';
      }
      if (bowDrawn) {
        const label = `${arrowType.toUpperCase()} × ${arrowCount}`;
        if (this.lastAmmoText !== label) {
          this.lastAmmoText = label;
          this.ammoEl.textContent = label;
        }
      }
    }
  }

  public setLetterbox(active: boolean): void {
    if (this.letterboxTopEl) {
      this.letterboxTopEl.style.transform = active ? 'translateY(0)' : 'translateY(-100%)';
    }
    if (this.letterboxBottomEl) {
      this.letterboxBottomEl.style.transform = active ? 'translateY(0)' : 'translateY(100%)';
    }
  }

  public dispose(): void {
    if (this.letterboxTopEl) {
      this.letterboxTopEl.remove();
      this.letterboxTopEl = null;
    }
    if (this.letterboxBottomEl) {
      this.letterboxBottomEl.remove();
      this.letterboxBottomEl = null;
    }
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
