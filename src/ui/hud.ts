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

  private lastObjective: string = '';
  private lastObjectiveVisible: boolean = false;
  private lastPrompt: string = '';
  private lastStaminaVisible: boolean = false;
  private lastStaminaPct: number = 100;
  private lastAmmoVisible: boolean = false;
  private lastAmmoText: string = '';

  public build(container: HTMLElement): void {
    if (typeof document === 'undefined') return;

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
    obj.style.cssText = [
      'position:absolute',
      'top:22px',
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
    prompt.style.cssText = [
      'position:absolute',
      'bottom:36px',
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

    // Bottom-left thin stamina bar (visible ONLY when draining per §3.11)
    const stamWrap = document.createElement('div');
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

    container.appendChild(root);
    this.rootEl = root;
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
    arrowCount: number
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

  public dispose(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
