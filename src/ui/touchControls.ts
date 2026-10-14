/**
 * Module: src/ui/touchControls.ts
 * Responsibility: AAA Mobile Touch Controls overlay per Bible §3.12:
 * - 360-degree Virtual Analog Joystick (left) with dynamic thumb stick & sprint threshold.
 * - Ergonomic Action Button Cluster (right): Contextual Action/Interact, Jump/Mantle,
 *   Dodge Roll, Crouch/Stealth, and Bow Aim/Shoot.
 * - Swipe-to-orbit camera surface across the right half of the screen.
 * - Top Quick Access buttons: Field Journal, Menu/Pause, and Photo Mode.
 * - Auto-detection on mobile devices / small viewports with manual toggle support (?touch=1).
 * Depends on: src/core/input.ts.
 * Exports: TouchControlsOverlay.
 */

import { InputManager } from '../core/input';

export class TouchControlsOverlay {
  public isVisible: boolean = false;
  private rootEl: HTMLDivElement | null = null;
  private joystickWrapEl: HTMLDivElement | null = null;
  private joystickKnobEl: HTMLDivElement | null = null;
  private actionBtnEl: HTMLButtonElement | null = null;
  private crouchBtnEl: HTMLButtonElement | null = null;
  private aimBtnEl: HTMLButtonElement | null = null;
  private toggleBtnEl: HTMLButtonElement | null = null;

  // Joystick touch tracking
  private joystickTouchId: number = -1;
  private joystickOriginX: number = 0;
  private joystickOriginY: number = 0;
  private readonly maxRadius: number = 52;
  private readonly sprintRadius: number = 40;

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

    // Detect if device supports touch or mobile viewport
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
      'font-family:Georgia, "Times New Roman", serif',
    ].join(';');

    // 1. Left Virtual Joystick Base & Knob
    const joyWrap = document.createElement('div');
    joyWrap.id = 'juzu-virtual-joystick';
    joyWrap.style.cssText = [
      'position:absolute',
      'bottom:36px',
      'left:36px',
      'width:128px',
      'height:128px',
      'border-radius:50%',
      'border:2.5px solid rgba(212, 178, 126, 0.45)',
      'background:radial-gradient(circle, rgba(32, 26, 18, 0.55) 0%, rgba(12, 10, 8, 0.75) 100%)',
      'box-shadow:0 8px 24px rgba(0,0,0,0.65), inset 0 0 16px rgba(180, 140, 90, 0.2)',
      'pointer-events:auto',
      'touch-action:none',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    const knob = document.createElement('div');
    knob.id = 'juzu-joystick-knob';
    knob.style.cssText = [
      'width:54px',
      'height:54px',
      'border-radius:50%',
      'background:radial-gradient(circle at 35% 35%, #fae6c4 0%, #b88d4c 75%, #63431d 100%)',
      'border:2px solid rgba(255, 255, 255, 0.75)',
      'box-shadow:0 4px 14px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.4)',
      'transform:translate3d(0, 0, 0)',
      'transition:transform 0.05s ease-out',
      'pointer-events:none',
    ].join(';');
    joyWrap.appendChild(knob);
    root.appendChild(joyWrap);
    this.joystickWrapEl = joyWrap;
    this.joystickKnobEl = knob;

    // 2. Right Action Button Cluster
    const actionCluster = document.createElement('div');
    actionCluster.style.cssText = [
      'position:absolute',
      'bottom:24px',
      'right:24px',
      'width:240px',
      'height:240px',
      'pointer-events:none',
    ].join(';');

    // Primary Action Button (Interact / Sluice / Takedown / Decipher)
    const actionBtn = this.createActionButton(
      'ACTION',
      70,
      'bottom:76px;right:26px;',
      '#e6b868',
      '#784e1d'
    );
    actionBtn.id = 'juzu-btn-action';
    actionCluster.appendChild(actionBtn);
    this.actionBtnEl = actionBtn;

    // Jump / Mantle / Climb Button
    const jumpBtn = this.createActionButton(
      'JUMP',
      56,
      'bottom:16px;right:110px;',
      '#d4c4a8',
      '#423626'
    );
    jumpBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
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
    const dodgeBtn = this.createActionButton(
      'DODGE',
      52,
      'bottom:14px;right:24px;',
      '#c4b094',
      '#3a2e20'
    );
    dodgeBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inputRef) this.inputRef.state.dodgePressed = true;
    });
    actionCluster.appendChild(dodgeBtn);

    // Crouch / Stealth Toggle Button
    const crouchBtn = this.createActionButton(
      'CROUCH',
      50,
      'bottom:158px;right:28px;',
      '#b8a488',
      '#32281b'
    );
    crouchBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inputRef) {
        this.inputRef.state.crouch = !this.inputRef.state.crouch;
        this.updateCrouchButtonVisual();
      }
    });
    actionCluster.appendChild(crouchBtn);
    this.crouchBtnEl = crouchBtn;

    // Bow Aim / Shoot Button
    const aimBtn = this.createActionButton(
      'AIM',
      56,
      'bottom:92px;right:118px;',
      '#e09e52',
      '#5c3214'
    );
    aimBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.isAimingTouch = true;
      if (this.inputRef) this.inputRef.state.aimHeld = true;
      aimBtn.style.transform = 'scale(0.92)';
      aimBtn.textContent = 'RELEASE';
    });
    aimBtn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (this.isAimingTouch) {
        this.isAimingTouch = false;
        if (this.inputRef) {
          this.inputRef.state.shootPressed = true;
          this.inputRef.state.aimHeld = false;
        }
      }
      aimBtn.style.transform = 'scale(1.0)';
      aimBtn.textContent = 'AIM';
    });
    actionCluster.appendChild(aimBtn);
    this.aimBtnEl = aimBtn;

    root.appendChild(actionCluster);

    // 3. Top Quick Access Header Buttons
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
    const journalBtn = document.createElement('button');
    journalBtn.style.cssText = [
      'pointer-events:auto',
      'padding:8px 14px',
      'background:rgba(30, 24, 18, 0.82)',
      'border:1.5px solid #a68453',
      'border-radius:6px',
      'color:#f0e2cd',
      'font-family:inherit',
      'font-size:13px',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'box-shadow:0 4px 10px rgba(0,0,0,0.5)',
    ].join(';');
    journalBtn.innerHTML = '<span>📖</span> Journal [J]';
    journalBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inputRef) this.inputRef.state.journalPressed = true;
    });
    headerBar.appendChild(journalBtn);

    // Right: Pause / Menu & Photo Buttons
    const rightTopBtns = document.createElement('div');
    rightTopBtns.style.cssText = 'display:flex;gap:8px;pointer-events:auto;';

    const photoBtn = document.createElement('button');
    photoBtn.style.cssText = [
      'padding:8px 12px',
      'background:rgba(30, 24, 18, 0.82)',
      'border:1.5px solid #8c6e44',
      'border-radius:6px',
      'color:#dfceb7',
      'font-family:inherit',
      'font-size:13px',
      'cursor:pointer',
    ].join(';');
    photoBtn.innerHTML = '📷 Photo';
    photoBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inputRef) this.inputRef.state.photoModePressed = true;
    });
    rightTopBtns.appendChild(photoBtn);

    const menuBtn = document.createElement('button');
    menuBtn.style.cssText = [
      'padding:8px 14px',
      'background:rgba(30, 24, 18, 0.82)',
      'border:1.5px solid #a68453',
      'border-radius:6px',
      'color:#f0e2cd',
      'font-family:inherit',
      'font-size:13px',
      'cursor:pointer',
    ].join(';');
    menuBtn.innerHTML = '⚙ Menu';
    menuBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
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
      'padding:4px 9px',
      'background:rgba(20, 16, 12, 0.72)',
      'border:1px solid rgba(180, 140, 90, 0.4)',
      'border-radius:4px',
      'color:#cbb89d',
      'font-size:11px',
      'font-family:monospace',
      'cursor:pointer',
    ].join(';');
    toggleBtn.textContent = '📱 Touch: OFF';
    toggleBtn.addEventListener('click', () => this.toggle());
    container.appendChild(toggleBtn);
    this.toggleBtnEl = toggleBtn;

    container.appendChild(root);
    this.rootEl = root;

    // Attach touch event listeners
    this.bindTouchEvents(root, container);

    // Primary Action button click/touch
    actionBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inputRef) {
        this.inputRef.state.interactPressed = true;
        this.inputRef.state.takedownPressed = true;
      }
    });

    if (hasTouch) {
      this.setVisible(true);
    }
  }

  private createActionButton(
    label: string,
    size: number,
    positionCss: string,
    borderColor: string,
    bgColor: string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = [
      'position:absolute',
      positionCss,
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      `border:2px solid ${borderColor}`,
      `background:radial-gradient(circle, ${bgColor} 0%, rgba(16, 13, 10, 0.88) 100%)`,
      'color:#faeedb',
      'font-family:inherit',
      'font-size:11.5px',
      'font-weight:bold',
      'letter-spacing:0.04em',
      'box-shadow:0 6px 16px rgba(0,0,0,0.7), inset 0 1px 3px rgba(255,255,255,0.25)',
      'pointer-events:auto',
      'touch-action:none',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'transition:transform 0.08s ease, box-shadow 0.08s ease',
    ].join(';');
    btn.textContent = label;
    return btn;
  }

  private bindTouchEvents(_root: HTMLElement, container: HTMLElement): void {
    // Joystick touch listener on the virtual joystick element
    if (this.joystickWrapEl) {
      this.joystickWrapEl.addEventListener('touchstart', (e: TouchEvent) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (!t) return;
        this.joystickTouchId = t.identifier;
        const rect = this.joystickWrapEl!.getBoundingClientRect();
        this.joystickOriginX = rect.left + rect.width * 0.5;
        this.joystickOriginY = rect.top + rect.height * 0.5;
        this.handleJoystickMove(t.clientX, t.clientY);
      }, { passive: false });
    }

    // Touch look listener on container (right half of the screen outside buttons)
    container.addEventListener('touchstart', (e: TouchEvent) => {
      const halfW = window.innerWidth * 0.5;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX >= halfW && this.lookTouchId === -1) {
          // Verify touch target is not an interactive button
          const target = t.target as HTMLElement;
          if (target && target.tagName === 'BUTTON') continue;
          this.lookTouchId = t.identifier;
          this.lastLookX = t.clientX;
          this.lastLookY = t.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
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
    }, { passive: false });

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
      this.inputRef.setTouchMovement(normX, normZ, clampedDist >= this.sprintRadius);
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

  public updateContextualAction(promptText: string): void {
    if (!this.actionBtnEl) return;
    if (promptText && promptText.length > 0) {
      if (promptText.includes('Silent Takedown')) {
        this.actionBtnEl.textContent = 'TAKEDOWN';
        this.actionBtnEl.style.borderColor = '#ff4d4d';
        this.actionBtnEl.style.boxShadow = '0 0 18px rgba(255, 60, 60, 0.7)';
      } else if (promptText.includes('Sluice Wheel')) {
        this.actionBtnEl.textContent = 'TURN';
        this.actionBtnEl.style.borderColor = '#ffd275';
        this.actionBtnEl.style.boxShadow = '0 0 16px rgba(250, 200, 90, 0.6)';
      } else if (promptText.includes('Quipu')) {
        this.actionBtnEl.textContent = 'EXAMINE';
        this.actionBtnEl.style.borderColor = '#70c4ff';
        this.actionBtnEl.style.boxShadow = '0 0 16px rgba(90, 180, 255, 0.6)';
      } else {
        this.actionBtnEl.textContent = 'INTERACT';
        this.actionBtnEl.style.borderColor = '#e6b868';
        this.actionBtnEl.style.boxShadow = '0 0 12px rgba(230, 184, 104, 0.5)';
      }
    } else {
      this.actionBtnEl.textContent = 'ACTION';
      this.actionBtnEl.style.borderColor = '#8c6e44';
      this.actionBtnEl.style.boxShadow = '0 6px 16px rgba(0,0,0,0.7)';
    }
  }

  private updateCrouchButtonVisual(): void {
    if (!this.crouchBtnEl || !this.inputRef) return;
    const isCrouched = this.inputRef.state.crouch;
    this.crouchBtnEl.style.borderColor = isCrouched ? '#54c48a' : '#b8a488';
    this.crouchBtnEl.style.boxShadow = isCrouched
      ? '0 0 12px rgba(84, 196, 138, 0.6)'
      : '0 6px 16px rgba(0,0,0,0.7)';
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
      this.toggleBtnEl.style.color = visible ? '#ffd896' : '#cbb89d';
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
