/**
 * Module: src/ui/touchControls.ts
 * Responsibility: AAA Mobile Touch Controls overlay inspired by leading mobile
 * action-adventure titles (Genshin Impact, Oceanhorn 2, Tomb Raider, PUBG Mobile):
 * - Glassmorphic Virtual Analog Joystick (left) with cardinal compass ticks & auto-sprint threshold.
 * - Intuitive Vector Icon Action Cluster (right):
 *     * Primary Action / Dynamic Context (Interact / Takedown / Sluice / Quipu)
 *     * Jump / Mantle / Climb Leap with vertical launch icon
 *     * Dodge Roll with tumble evasion icon
 *     * Crouch / Stealth with silhouetted stalker icon & emerald active halo
 *     * Archery Aim & Release with target reticle crosshair
 *     * Medicinal Poultice Quick Heal with herbal flask icon
 *     * Arrow Type Selector with quiver arrowhead icon
 * - Swipe-to-orbit camera surface across the right half of the screen.
 * - Frosted glass top header with Journal, Photo Studio, and Menu quick toggles.
 * - Haptic touch feedback and scale springs on press.
 * Depends on: src/core/input.ts.
 * Exports: TouchControlsOverlay.
 */

import { InputManager } from '../core/input';

function triggerHaptic(durationMs: number = 12): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Haptics unsupported or blocked by browser policy
    }
  }
}

// Crisp inline SVGs designed for high-DPI mobile displays
const ICONS = {
  actionDefault: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.2-6.8l-2.1 2.1m-9.4 9.4l-2.1 2.1m0-13.6l2.1 2.1m9.4 9.4l2.1 2.1"/></svg>`,
  takedown: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ff4d4d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l2 2 6-6-2-2"/><path d="M16 8l4 4"/></svg>`,
  sluice: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ffd275" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-6.5l-2.1 2.1m-8.8 8.8l-2.1 2.1m0-13l2.1 2.1m8.8 8.8l2.1 2.1"/></svg>`,
  quipu: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#70c4ff" stroke-width="2.2" stroke-linecap="round"><path d="M4 4h16M7 4v16M12 4v16M17 4v16"/><circle cx="7" cy="10" r="1.8" fill="#70c4ff"/><circle cx="12" cy="8" r="1.8" fill="#70c4ff"/><circle cx="12" cy="14" r="1.8" fill="#70c4ff"/><circle cx="17" cy="12" r="1.8" fill="#70c4ff"/></svg>`,
  jump: `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 2.5l6.5 7.5h-4.5v6.5h-4v-6.5H5.5L12 2.5zm-7 16.5h14v2.5H5V19z"/></svg>`,
  dodge: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 12a9.5 9.5 0 1 1-6.8-9.1"/><path d="M21.5 2.5v6.5h-6.5"/></svg>`,
  crouch: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="12" cy="4.5" r="2.3"/><path d="M7 11.5c.8-1.5 2.2-2.5 5-2.5 2.5 0 4 1 5 2.5l1.5 3.5-1.8.8-1.2-2.8-2 2v6h-2v-5l-1.5-1.5-1 2.3-1.8-.8L7 11.5z"/></svg>`,
  aim: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>`,
  heal: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2.5c-3.5 0-6.5 2.8-6.5 6.3 0 4.2 6.5 12.7 6.5 12.7s6.5-8.5 6.5-12.7c0-3.5-3-6.3-6.5-6.3zm1 10h-2v-3H8v-2h3V4.5h2V7.5h3v2h-3v3z"/></svg>`,
  ammo: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2 22l4-1 14-14-3-3L3 18l-1 4zm16.5-17.5l2 2-1 1-2-2 1-1z"/></svg>`,
  journal: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  photo: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

export class TouchControlsOverlay {
  public isVisible: boolean = false;
  private rootEl: HTMLDivElement | null = null;
  private joystickWrapEl: HTMLDivElement | null = null;
  private joystickKnobEl: HTMLDivElement | null = null;
  private actionBtnEl: HTMLButtonElement | null = null;
  private actionIconWrapEl: HTMLSpanElement | null = null;
  private actionLabelEl: HTMLSpanElement | null = null;
  private crouchBtnEl: HTMLButtonElement | null = null;
  private aimBtnEl: HTMLButtonElement | null = null;
  private aimLabelEl: HTMLSpanElement | null = null;
  private toggleBtnEl: HTMLButtonElement | null = null;

  // Joystick touch tracking
  private joystickTouchId: number = -1;
  private joystickOriginX: number = 0;
  private joystickOriginY: number = 0;
  private readonly maxRadius: number = 54;
  private readonly sprintRadius: number = 42;

  // Camera look touch tracking
  private lookTouchId: number = -1;
  private lastLookX: number = 0;
  private lastLookY: number = 0;

  // Bow aim state
  private isAimingTouch: boolean = false;

  private inputRef: InputManager | null = null;

  public build(container: HTMLElement, input: InputManager): void {
    if (typeof document === 'undefined') return;
    this.inputRef = input;

    const hasTouch =
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window !== 'undefined' && window.location.search.includes('touch=1')) ||
      (typeof window !== 'undefined' && window.innerWidth <= 960);

    const root = document.createElement('div');
    root.id = 'juzu-touch-controls-root';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:25',
      'touch-action:none',
      'user-select:none',
      '-webkit-user-select:none',
      'display:none',
      'font-family:Georgia, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif',
    ].join(';');

    // 1. Left Virtual Joystick Base & Knob
    const joyWrap = document.createElement('div');
    joyWrap.id = 'juzu-virtual-joystick';
    joyWrap.style.cssText = [
      'position:absolute',
      'bottom:36px',
      'left:36px',
      'width:136px',
      'height:136px',
      'border-radius:50%',
      'border:2px solid rgba(220, 185, 130, 0.45)',
      'background:radial-gradient(circle, rgba(38, 30, 20, 0.55) 0%, rgba(14, 12, 10, 0.8) 100%)',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'box-shadow:0 8px 30px rgba(0,0,0,0.7), inset 0 0 20px rgba(220, 185, 130, 0.15)',
      'pointer-events:auto',
      'touch-action:none',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    // Outer Sprint ring guide marker (top tick)
    const sprintMarker = document.createElement('div');
    sprintMarker.style.cssText = [
      'position:absolute',
      'top:6px',
      'left:50%',
      'transform:translateX(-50%)',
      'font-size:9px',
      'font-weight:bold',
      'letter-spacing:0.12em',
      'color:rgba(235, 205, 150, 0.8)',
      'pointer-events:none',
    ].join(';');
    sprintMarker.textContent = '▲ SPRINT';
    joyWrap.appendChild(sprintMarker);

    // Inner Knob
    const knob = document.createElement('div');
    knob.id = 'juzu-joystick-knob';
    knob.style.cssText = [
      'width:56px',
      'height:56px',
      'border-radius:50%',
      'background:radial-gradient(circle at 35% 35%, #faedd2 0%, #caa05b 65%, #6a4922 100%)',
      'border:2.5px solid rgba(255, 255, 255, 0.85)',
      'box-shadow:0 6px 18px rgba(0,0,0,0.85), inset 0 2px 5px rgba(255,255,255,0.6)',
      'transform:translate3d(0, 0, 0)',
      'transition:transform 0.04s ease-out',
      'pointer-events:none',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'color:#422a10',
      'font-size:16px',
    ].join(';');
    knob.innerHTML = `✦`;
    joyWrap.appendChild(knob);
    root.appendChild(joyWrap);
    this.joystickWrapEl = joyWrap;
    this.joystickKnobEl = knob;

    // 2. Right Action Button Cluster (Ergonomic Thumb Arc)
    const actionCluster = document.createElement('div');
    actionCluster.style.cssText = [
      'position:absolute',
      'bottom:20px',
      'right:20px',
      'width:260px',
      'height:260px',
      'pointer-events:none',
    ].join(';');

    // Primary Action Button (Interact / Sluice / Takedown / Decipher)
    const { button: actionBtn, iconWrap: actionIconWrap, label: actionLabel } = this.createIntuitiveButton(
      'juzu-btn-action',
      74,
      'bottom:76px;right:28px;',
      ICONS.actionDefault,
      'INTERACT',
      'rgba(235, 188, 108, 0.95)',
      'rgba(230, 184, 104, 0.75)',
      'radial-gradient(circle at 35% 35%, rgba(98, 72, 38, 0.85) 0%, rgba(24, 18, 12, 0.95) 100%)'
    );
    actionBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(18);
      if (this.inputRef) {
        this.inputRef.state.interactPressed = true;
        this.inputRef.state.takedownPressed = true;
      }
    });
    actionCluster.appendChild(actionBtn);
    this.actionBtnEl = actionBtn;
    this.actionIconWrapEl = actionIconWrap;
    this.actionLabelEl = actionLabel;

    // Jump / Mantle / Climb Button
    const { button: jumpBtn } = this.createIntuitiveButton(
      'juzu-btn-jump',
      58,
      'bottom:18px;right:116px;',
      ICONS.jump,
      'JUMP',
      '#f2ece1',
      'rgba(215, 195, 160, 0.65)',
      'radial-gradient(circle at 35% 35%, rgba(68, 54, 38, 0.75) 0%, rgba(20, 16, 12, 0.9) 100%)'
    );
    jumpBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(14);
      if (this.inputRef) {
        this.inputRef.state.jumpPressed = true;
        this.inputRef.state.climbHeld = true;
      }
    });
    jumpBtn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (this.inputRef) this.inputRef.state.climbHeld = false;
    });
    actionCluster.appendChild(jumpBtn);

    // Dodge Roll Button
    const { button: dodgeBtn } = this.createIntuitiveButton(
      'juzu-btn-dodge',
      52,
      'bottom:14px;right:24px;',
      ICONS.dodge,
      'DODGE',
      '#ebd8be',
      'rgba(195, 170, 135, 0.6)',
      'radial-gradient(circle at 35% 35%, rgba(58, 44, 30, 0.75) 0%, rgba(18, 14, 10, 0.9) 100%)'
    );
    dodgeBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(14);
      if (this.inputRef) this.inputRef.state.dodgePressed = true;
    });
    actionCluster.appendChild(dodgeBtn);

    // Crouch / Stealth Toggle Button
    const { button: crouchBtn } = this.createIntuitiveButton(
      'juzu-btn-crouch',
      48,
      'bottom:164px;right:28px;',
      ICONS.crouch,
      'SNEAK',
      '#dcd0bc',
      'rgba(185, 160, 125, 0.6)',
      'radial-gradient(circle at 35% 35%, rgba(52, 40, 28, 0.75) 0%, rgba(16, 12, 10, 0.9) 100%)'
    );
    crouchBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(12);
      if (this.inputRef) {
        this.inputRef.state.crouch = !this.inputRef.state.crouch;
        this.updateCrouchButtonVisual();
      }
    });
    actionCluster.appendChild(crouchBtn);
    this.crouchBtnEl = crouchBtn;

    // Bow Aim / Shoot Button
    const { button: aimBtn, label: aimLabel } = this.createIntuitiveButton(
      'juzu-btn-aim',
      60,
      'bottom:96px;right:124px;',
      ICONS.aim,
      'AIM',
      '#ffca7a',
      'rgba(235, 160, 80, 0.75)',
      'radial-gradient(circle at 35% 35%, rgba(88, 52, 22, 0.85) 0%, rgba(26, 14, 8, 0.95) 100%)'
    );
    aimBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(20);
      this.isAimingTouch = true;
      if (this.inputRef) this.inputRef.state.aimHeld = true;
      aimBtn.style.transform = 'scale(0.90)';
      aimBtn.style.borderColor = '#ff7b2b';
      aimBtn.style.boxShadow = '0 0 20px rgba(255, 123, 43, 0.8)';
      aimLabel.textContent = 'RELEASE';
    });
    aimBtn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (this.isAimingTouch) {
        this.isAimingTouch = false;
        triggerHaptic(24);
        if (this.inputRef) {
          this.inputRef.state.shootPressed = true;
          this.inputRef.state.aimHeld = false;
        }
      }
      aimBtn.style.transform = 'scale(1.0)';
      aimBtn.style.borderColor = 'rgba(235, 160, 80, 0.75)';
      aimBtn.style.boxShadow = '0 8px 24px rgba(0,0,0,0.65)';
      aimLabel.textContent = 'AIM';
    });
    actionCluster.appendChild(aimBtn);
    this.aimBtnEl = aimBtn;
    this.aimLabelEl = aimLabel;

    // Medicinal Poultice Quick Heal Button
    const { button: healBtn } = this.createIntuitiveButton(
      'juzu-btn-heal',
      44,
      'bottom:168px;right:98px;',
      ICONS.heal,
      'HEAL',
      '#8ce6a8',
      'rgba(80, 200, 130, 0.65)',
      'radial-gradient(circle at 35% 35%, rgba(30, 68, 42, 0.8) 0%, rgba(10, 24, 16, 0.92) 100%)'
    );
    healBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(16);
      if (this.inputRef) this.inputRef.state.poulticePressed = true;
    });
    actionCluster.appendChild(healBtn);

    // Arrow Craft / Selector Button
    const { button: ammoBtn } = this.createIntuitiveButton(
      'juzu-btn-ammo',
      42,
      'bottom:102px;right:202px;',
      ICONS.ammo,
      'AMMO',
      '#e6c896',
      'rgba(215, 185, 135, 0.6)',
      'radial-gradient(circle at 35% 35%, rgba(58, 46, 32, 0.8) 0%, rgba(18, 14, 10, 0.92) 100%)'
    );
    ammoBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(14);
      if (this.inputRef) this.inputRef.state.craftPressed = true;
    });
    actionCluster.appendChild(ammoBtn);

    root.appendChild(actionCluster);

    // 3. Top Quick Access Header Buttons (Frosted glass pills)
    const headerBar = document.createElement('div');
    headerBar.style.cssText = [
      'position:absolute',
      'top:16px',
      'left:16px',
      'right:16px',
      'display:flex',
      'justify-content:space-between',
      'pointer-events:none',
    ].join(';');

    // Left: Field Journal Trigger
    const journalBtn = this.createHeaderPill(ICONS.journal, 'Journal');
    journalBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(14);
      if (this.inputRef) this.inputRef.state.journalPressed = true;
    });
    headerBar.appendChild(journalBtn);

    // Right: Photo Studio & Menu Buttons
    const rightTopBtns = document.createElement('div');
    rightTopBtns.style.cssText = 'display:flex;gap:10px;pointer-events:auto;';

    const photoBtn = this.createHeaderPill(ICONS.photo, 'Photo');
    photoBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(14);
      if (this.inputRef) this.inputRef.state.photoModePressed = true;
    });
    rightTopBtns.appendChild(photoBtn);

    const menuBtn = this.createHeaderPill(ICONS.menu, 'Menu');
    menuBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      triggerHaptic(14);
      if (this.inputRef) this.inputRef.state.pausePressed = true;
    });
    rightTopBtns.appendChild(menuBtn);

    headerBar.appendChild(rightTopBtns);
    root.appendChild(headerBar);

    // 4. Desktop Toggle Button (allowing desktop users to test/toggle touch anytime)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'juzu-touch-toggle-pill';
    toggleBtn.style.cssText = [
      'position:fixed',
      'bottom:12px',
      'left:12px',
      'z-index:30',
      'padding:6px 12px',
      'background:rgba(22, 18, 14, 0.78)',
      'border:1px solid rgba(212, 178, 126, 0.45)',
      'border-radius:20px',
      'color:#f2ece1',
      'font-size:11px',
      'letter-spacing:0.06em',
      'font-family:inherit',
      'cursor:pointer',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'box-shadow:0 4px 12px rgba(0,0,0,0.5)',
      'transition:all 0.15s ease',
    ].join(';');
    toggleBtn.textContent = '📱 Touch: OFF';
    toggleBtn.addEventListener('click', () => this.toggle());
    container.appendChild(toggleBtn);
    this.toggleBtnEl = toggleBtn;

    container.appendChild(root);
    this.rootEl = root;

    // Attach touch event listeners
    this.bindTouchEvents(root, container);

    if (hasTouch) {
      this.setVisible(true);
    }
  }

  /**
   * Creates an intuitive circular touch button with embedded vector icon and micro-label.
   */
  private createIntuitiveButton(
    id: string,
    size: number,
    positionCss: string,
    iconSvg: string,
    labelText: string,
    primaryColor: string,
    borderColor: string,
    bgGradient: string
  ): { button: HTMLButtonElement; iconWrap: HTMLSpanElement; label: HTMLSpanElement } {
    const btn = document.createElement('button');
    btn.id = id;
    btn.style.cssText = [
      'position:absolute',
      positionCss,
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      `border:2px solid ${borderColor}`,
      `background:${bgGradient}`,
      `color:${primaryColor}`,
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'box-shadow:0 8px 24px rgba(0,0,0,0.65), inset 0 1px 3px rgba(255,255,255,0.25)',
      'pointer-events:auto',
      'touch-action:none',
      'cursor:pointer',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:2px',
      'padding:0',
      'transition:transform 0.08s ease, border-color 0.15s ease, box-shadow 0.15s ease',
    ].join(';');

    const iconWrap = document.createElement('span');
    iconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.85));';
    iconWrap.innerHTML = iconSvg;
    btn.appendChild(iconWrap);

    const label = document.createElement('span');
    label.style.cssText = [
      'font-size:9px',
      'font-weight:bold',
      'letter-spacing:0.06em',
      'text-transform:uppercase',
      'line-height:1',
      'opacity:0.9',
      'color:inherit',
      'text-shadow:0 1px 3px rgba(0,0,0,0.9)',
    ].join(';');
    label.textContent = labelText;
    btn.appendChild(label);

    // Spring feedback on touch
    btn.addEventListener('pointerdown', () => {
      btn.style.transform = 'scale(0.88)';
    });
    const releaseSpring = () => {
      btn.style.transform = 'scale(1.0)';
    };
    btn.addEventListener('pointerup', releaseSpring);
    btn.addEventListener('pointercancel', releaseSpring);

    return { button: btn, iconWrap, label };
  }

  private createHeaderPill(iconSvg: string, text: string): HTMLButtonElement {
    const pill = document.createElement('button');
    pill.style.cssText = [
      'pointer-events:auto',
      'padding:8px 14px',
      'background:rgba(24, 20, 16, 0.82)',
      'border:1.5px solid rgba(212, 178, 126, 0.55)',
      'border-radius:20px',
      'color:#f2ece1',
      'font-family:inherit',
      'font-size:12px',
      'font-weight:600',
      'letter-spacing:0.04em',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'box-shadow:0 4px 14px rgba(0,0,0,0.6)',
      'transition:transform 0.08s ease, background 0.15s ease',
    ].join(';');
    pill.innerHTML = `<span>${iconSvg}</span><span>${text}</span>`;
    pill.addEventListener('pointerdown', () => {
      pill.style.transform = 'scale(0.92)';
    });
    const release = () => {
      pill.style.transform = 'scale(1.0)';
    };
    pill.addEventListener('pointerup', release);
    pill.addEventListener('pointercancel', release);
    return pill;
  }

  private bindTouchEvents(_root: HTMLElement, container: HTMLElement): void {
    // Joystick touch listener on the virtual joystick element
    if (this.joystickWrapEl) {
      this.joystickWrapEl.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          const t = e.changedTouches[0];
          if (!t) return;
          this.joystickTouchId = t.identifier;
          const rect = this.joystickWrapEl!.getBoundingClientRect();
          this.joystickOriginX = rect.left + rect.width * 0.5;
          this.joystickOriginY = rect.top + rect.height * 0.5;
          this.handleJoystickMove(t.clientX, t.clientY);
        },
        { passive: false }
      );
    }

    // Touch look listener on container (right half of the screen outside buttons)
    container.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        const halfW = window.innerWidth * 0.5;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.clientX >= halfW && this.lookTouchId === -1) {
            const target = t.target as HTMLElement;
            if (target && (target.tagName === 'BUTTON' || target.closest('button'))) continue;
            this.lookTouchId = t.identifier;
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
          }
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          // 1. Joystick movement
          if (t.identifier === this.joystickTouchId) {
            this.handleJoystickMove(t.clientX, t.clientY);
          }
          // 2. Camera swipe look
          if (t.identifier === this.lookTouchId && this.inputRef) {
            const dx = t.clientX - this.lastLookX;
            const dy = t.clientY - this.lastLookY;
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
            this.inputRef.addTouchLookDelta(dx * 0.32, dy * 0.32);
          }
        }
      },
      { passive: false }
    );

    const endTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.joystickTouchId) {
          this.joystickTouchId = -1;
          this.resetJoystick();
        }
        if (t.identifier === this.lookTouchId) {
          this.lookTouchId = -1;
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
  }

  private handleJoystickMove(touchX: number, touchY: number): void {
    const rawDx = touchX - this.joystickOriginX;
    const rawDy = touchY - this.joystickOriginY;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(this.maxRadius, dist);
    const angle = Math.atan2(rawDy, rawDx);

    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;

    if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = `translate3d(${stickX}px, ${stickY}px, 0)`;
    }

    if (this.inputRef) {
      const normX = stickX / this.maxRadius;
      const normZ = stickY / this.maxRadius;
      const isSprinting = clampedDist >= this.sprintRadius;
      this.inputRef.setTouchMovement(normX, normZ, isSprinting);
    }
  }

  private resetJoystick(): void {
    if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = 'translate3d(0, 0, 0)';
    }
    if (this.inputRef) {
      this.inputRef.setTouchMovement(0, 0, false);
    }
  }

  /**
   * Adapts the primary action button icon, label, and aura based on what
   * Naira is currently in range of (Takedown, Sluice Wheel, Quipu, etc.).
   */
  public updateContextualAction(promptText: string): void {
    if (!this.actionBtnEl || !this.actionIconWrapEl || !this.actionLabelEl) return;

    if (promptText && promptText.length > 0) {
      if (promptText.includes('Silent Takedown')) {
        this.actionIconWrapEl.innerHTML = ICONS.takedown;
        this.actionLabelEl.textContent = 'TAKEDOWN';
        this.actionBtnEl.style.borderColor = '#ff4d4d';
        this.actionBtnEl.style.boxShadow = '0 0 20px rgba(255, 60, 60, 0.8), inset 0 0 10px rgba(255, 60, 60, 0.3)';
        this.actionBtnEl.style.color = '#ff6b6b';
      } else if (promptText.includes('Sluice Wheel')) {
        this.actionIconWrapEl.innerHTML = ICONS.sluice;
        this.actionLabelEl.textContent = 'TURN';
        this.actionBtnEl.style.borderColor = '#ffd275';
        this.actionBtnEl.style.boxShadow = '0 0 18px rgba(250, 200, 90, 0.75), inset 0 0 10px rgba(250, 200, 90, 0.25)';
        this.actionBtnEl.style.color = '#ffe49e';
      } else if (promptText.includes('Quipu')) {
        this.actionIconWrapEl.innerHTML = ICONS.quipu;
        this.actionLabelEl.textContent = 'EXAMINE';
        this.actionBtnEl.style.borderColor = '#70c4ff';
        this.actionBtnEl.style.boxShadow = '0 0 18px rgba(110, 200, 255, 0.75), inset 0 0 10px rgba(110, 200, 255, 0.25)';
        this.actionBtnEl.style.color = '#9ad7ff';
      } else {
        this.actionIconWrapEl.innerHTML = ICONS.actionDefault;
        this.actionLabelEl.textContent = 'INTERACT';
        this.actionBtnEl.style.borderColor = '#e6b868';
        this.actionBtnEl.style.boxShadow = '0 0 16px rgba(230, 184, 104, 0.65), inset 0 0 8px rgba(230, 184, 104, 0.2)';
        this.actionBtnEl.style.color = '#faeedb';
      }
    } else {
      this.actionIconWrapEl.innerHTML = ICONS.actionDefault;
      this.actionLabelEl.textContent = 'ACTION';
      this.actionBtnEl.style.borderColor = 'rgba(230, 184, 104, 0.75)';
      this.actionBtnEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.65), inset 0 1px 3px rgba(255,255,255,0.25)';
      this.actionBtnEl.style.color = 'rgba(235, 188, 108, 0.95)';
    }
  }

  private updateCrouchButtonVisual(): void {
    if (!this.crouchBtnEl || !this.inputRef) return;
    const isCrouched = this.inputRef.state.crouch;
    this.crouchBtnEl.style.borderColor = isCrouched ? '#54c48a' : 'rgba(185, 160, 125, 0.6)';
    this.crouchBtnEl.style.boxShadow = isCrouched
      ? '0 0 16px rgba(84, 196, 138, 0.8), inset 0 0 10px rgba(84, 196, 138, 0.3)'
      : '0 8px 24px rgba(0,0,0,0.65)';
    this.crouchBtnEl.style.color = isCrouched ? '#78e0aa' : '#dcd0bc';
  }

  public setGameplayActive(active: boolean): void {
    if (this.rootEl) {
      this.rootEl.style.display = this.isVisible && active ? 'block' : 'none';
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.rootEl) {
      this.rootEl.style.display = visible ? 'block' : 'none';
    }
    if (this.toggleBtnEl) {
      this.toggleBtnEl.textContent = visible ? '📱 Touch: ON' : '📱 Touch: OFF';
      this.toggleBtnEl.style.color = visible ? '#ffd896' : '#f2ece1';
      this.toggleBtnEl.style.borderColor = visible ? '#d4b888' : 'rgba(212, 178, 126, 0.45)';
    }
  }

  public toggle(): void {
    this.setVisible(!this.isVisible);
  }

  public dispose(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
    if (this.toggleBtnEl) {
      this.toggleBtnEl.remove();
      this.toggleBtnEl = null;
    }
  }
}
