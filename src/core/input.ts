/**
 * Module: src/core/input.ts
 * Responsibility: Unified Keyboard + Mouse, DualSense/Xbox Gamepad, and Mobile Touch
 * input system per Bible §3.12 and §5.2 (zero per-frame allocations).
 * Depends on: none.
 * Exports: InputState, InputManager.
 */

export interface InputState {
  moveX: number;
  moveZ: number;
  lookDeltaX: number;
  lookDeltaY: number;
  sprint: boolean;
  walkToggle: boolean;
  jumpPressed: boolean;
  crouch: boolean;
  dodgePressed: boolean;
  interactPressed: boolean;
  takedownPressed: boolean;
  climbHeld: boolean;
  aimHeld: boolean;
  shootPressed: boolean;
  radialOpen: boolean;
  craftPressed: boolean;
  poulticePressed: boolean;
  whistlePressed: boolean;
  condorPressed: boolean;
  photoModePressed: boolean;
  journalPressed: boolean;
  pausePressed: boolean;
  orbitTogglePressed: boolean;
  regionSelect: 'cloudForest' | 'highSierra' | 'jungleLowlands' | 'paititi' | null;
  shotSelect: string | null;
}

export class InputManager {
  public readonly state: InputState = {
    moveX: 0,
    moveZ: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    sprint: false,
    walkToggle: false,
    jumpPressed: false,
    crouch: false,
    dodgePressed: false,
    interactPressed: false,
    takedownPressed: false,
    climbHeld: false,
    aimHeld: false,
    shootPressed: false,
    radialOpen: false,
    craftPressed: false,
    poulticePressed: false,
    whistlePressed: false,
    condorPressed: false,
    photoModePressed: false,
    journalPressed: false,
    pausePressed: false,
    orbitTogglePressed: false,
    regionSelect: null,
    shotSelect: null,
  };
  public onRegionSelect: ((regionId: 'cloudForest' | 'highSierra' | 'jungleLowlands' | 'paititi') => void) | null = null;
  public onShotSelect: ((shotId: string) => void) | null = null;

  public sensitivity: number = 1.0;
  public invertY: boolean = false;
  public hasTouchOverlay: boolean = false;

  private keysDown: Set<string> = new Set();
  private accumMouseX: number = 0;
  private accumMouseY: number = 0;
  private isPointerLocked: boolean = false;
  private mouseDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Touch state (preallocated primitives, zero per-frame allocations)
  private moveTouchId: number = -1;
  private moveOriginX: number = 0;
  private moveOriginY: number = 0;
  private touchMoveX: number = 0;
  private touchMoveZ: number = 0;
  private touchSprint: boolean = false;
  private touchClimbHeld: boolean = false;
  private lookTouchId: number = -1;
  private lastTouchLookX: number = 0;
  private lastTouchLookY: number = 0;

  // Gamepad edge triggers
  private prevGpJump: boolean = false;
  private prevGpInteract: boolean = false;
  private prevGpDodge: boolean = false;
  private prevGpCraft: boolean = false;
  private prevGpPause: boolean = false;
  private prevGpJournal: boolean = false;

  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onMouseMoveBound: (e: MouseEvent) => void;
  private readonly onMouseDownBound: (e: MouseEvent) => void;
  private readonly onMouseUpBound: (e: MouseEvent) => void;
  private readonly onTouchStartBound: (e: TouchEvent) => void;
  private readonly onTouchMoveBound: (e: TouchEvent) => void;
  private readonly onTouchEndBound: (e: TouchEvent) => void;

  constructor() {
    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onMouseDownBound = this.onMouseDown.bind(this);
    this.onMouseUpBound = this.onMouseUp.bind(this);
    this.onTouchStartBound = this.onTouchStart.bind(this);
    this.onTouchMoveBound = this.onTouchMove.bind(this);
    this.onTouchEndBound = this.onTouchEnd.bind(this);
  }

  public build(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    window.addEventListener('touchstart', this.onTouchStartBound, { passive: false });
    window.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
    window.addEventListener('touchend', this.onTouchEndBound);
    window.addEventListener('touchcancel', this.onTouchEndBound);
  }

  public update(_dt: number): void {
    // 1. Keyboard axes
    let kx = 0;
    let kz = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kx += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) kz -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) kz += 1;

    // Normalize keyboard diagonal
    if (kx !== 0 && kz !== 0) {
      const inv = 0.70710678;
      kx *= inv;
      kz *= inv;
    }

    // 2. Poll Gamepad if connected
    let gpx = 0;
    let gpz = 0;
    let gpLookX = 0;
    let gpLookY = 0;
    let gpSprint = false;
    let gpAim = false;

    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const pad = pads ? pads[0] : null;
      if (pad) {
        const ax0 = pad.axes[0] || 0;
        const ax1 = pad.axes[1] || 0;
        const ax2 = pad.axes[2] || 0;
        const ax3 = pad.axes[3] || 0;
        if (Math.abs(ax0) > 0.15) gpx = ax0;
        if (Math.abs(ax1) > 0.15) gpz = ax1;
        if (Math.abs(ax2) > 0.15) gpLookX = ax2 * 4.5;
        if (Math.abs(ax3) > 0.15) gpLookY = ax3 * 3.5;

        const btnA = !!pad.buttons[0]?.pressed;
        const btnB = !!pad.buttons[1]?.pressed;
        const btnX = !!pad.buttons[2]?.pressed;
        const btnY = !!pad.buttons[3]?.pressed;
        const btnLT = (pad.buttons[6]?.value || 0) > 0.3;
        const btnRT = (pad.buttons[7]?.value || 0) > 0.5;
        const btnBack = !!pad.buttons[8]?.pressed;
        const btnStart = !!pad.buttons[9]?.pressed;
        const btnL3 = !!pad.buttons[10]?.pressed;

        if (btnA && !this.prevGpJump) this.state.jumpPressed = true;
        if (btnB && !this.prevGpDodge) this.state.dodgePressed = true;
        if (btnX && !this.prevGpInteract) this.state.interactPressed = true;
        if (btnY && !this.prevGpCraft) this.state.craftPressed = true;
        if (btnBack && !this.prevGpJournal) this.state.journalPressed = true;
        if (btnStart && !this.prevGpPause) this.state.pausePressed = true;

        this.prevGpJump = btnA;
        this.prevGpDodge = btnB;
        this.prevGpInteract = btnX;
        this.prevGpCraft = btnY;
        this.prevGpJournal = btnBack;
        this.prevGpPause = btnStart;

        gpSprint = btnL3;
        gpAim = btnLT;
        if (btnRT && !this.state.shootPressed) {
          this.state.shootPressed = true;
        }
      }
    }

    // Combine movement sources (Keyboard + Gamepad + Touch)
    let mx = kx + gpx + this.touchMoveX;
    let mz = kz + gpz + this.touchMoveZ;
    const magSq = mx * mx + mz * mz;
    if (magSq > 1.0) {
      const invMag = 1.0 / Math.sqrt(magSq);
      mx *= invMag;
      mz *= invMag;
    }
    this.state.moveX = mx;
    this.state.moveZ = mz;

    // Pass raw look deltas; OverTheShoulderCamera applies sensitivity & invertY
    this.state.lookDeltaX = this.accumMouseX + gpLookX;
    this.state.lookDeltaY = this.accumMouseY + gpLookY;
    this.accumMouseX = 0;
    this.accumMouseY = 0;

    this.state.sprint =
      this.keysDown.has('ShiftLeft') ||
      this.keysDown.has('ShiftRight') ||
      gpSprint ||
      this.touchSprint;
    this.state.walkToggle = this.keysDown.has('AltLeft') || this.keysDown.has('ControlLeft');
    this.state.climbHeld = this.keysDown.has('KeyC') || this.touchClimbHeld;
    this.state.radialOpen = this.keysDown.has('Tab');
    this.state.aimHeld = this.state.aimHeld || gpAim;
  }

  public setTouchMovement(x: number, z: number, sprint: boolean = false): void {
    this.touchMoveX = x;
    this.touchMoveZ = z;
    this.touchSprint = sprint;
  }

  public setTouchClimbHeld(held: boolean): void {
    this.touchClimbHeld = held;
  }

  public addTouchLookDelta(dx: number, dy: number): void {
    this.accumMouseX += dx;
    this.accumMouseY += dy;
  }

  public consumeOneShotFlags(): void {
    this.state.jumpPressed = false;
    this.state.dodgePressed = false;
    this.state.interactPressed = false;
    this.state.takedownPressed = false;
    this.state.shootPressed = false;
    this.state.craftPressed = false;
    this.state.poulticePressed = false;
    this.state.whistlePressed = false;
    this.state.condorPressed = false;
    this.state.photoModePressed = false;
    this.state.journalPressed = false;
    this.state.pausePressed = false;
    this.state.orbitTogglePressed = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Tab') {
      e.preventDefault();
    }
    this.keysDown.add(e.code);
    if (e.repeat) return;

    switch (e.code) {
      case 'Space':
        this.state.jumpPressed = true;
        break;
      case 'KeyC':
        this.state.crouch = !this.state.crouch;
        break;
      case 'KeyV':
        this.state.dodgePressed = true;
        break;
      case 'KeyE':
        this.state.interactPressed = true;
        break;
      case 'KeyR':
        this.state.craftPressed = true;
        break;
      case 'KeyH':
        this.state.poulticePressed = true;
        break;
      case 'KeyG':
        this.state.whistlePressed = true;
        break;
      case 'KeyX':
        this.state.condorPressed = true;
        break;
      case 'KeyP':
        this.state.photoModePressed = true;
        break;
      case 'KeyJ':
        this.state.journalPressed = true;
        break;
      case 'Escape':
        this.state.pausePressed = true;
        break;
      case 'KeyF':
        this.state.takedownPressed = true;
        this.state.interactPressed = true;
        break;
      case 'KeyO':
        this.state.orbitTogglePressed = true;
        break;
      case 'Digit1':
      case 'Numpad1':
        this.state.shotSelect = 'valley';
        if (this.onShotSelect) this.onShotSelect('valley');
        break;
      case 'Digit2':
      case 'Numpad2':
        this.state.shotSelect = 'bridge';
        if (this.onShotSelect) this.onShotSelect('bridge');
        break;
      case 'Digit3':
      case 'Numpad3':
        this.state.shotSelect = 'character';
        if (this.onShotSelect) this.onShotSelect('character');
        break;
      case 'Digit4':
      case 'Numpad4':
        this.state.shotSelect = 'climb';
        if (this.onShotSelect) this.onShotSelect('climb');
        break;
      case 'Digit5':
      case 'Numpad5':
        this.state.shotSelect = 'combat';
        if (this.onShotSelect) this.onShotSelect('combat');
        break;
      case 'Digit6':
      case 'Numpad6':
        this.state.regionSelect = 'cloudForest';
        if (this.onRegionSelect) this.onRegionSelect('cloudForest');
        break;
      case 'Digit7':
      case 'Numpad7':
        this.state.regionSelect = 'highSierra';
        if (this.onRegionSelect) this.onRegionSelect('highSierra');
        break;
      case 'Digit8':
      case 'Numpad8':
        this.state.regionSelect = 'jungleLowlands';
        if (this.onRegionSelect) this.onRegionSelect('jungleLowlands');
        break;
      case 'Digit9':
      case 'Numpad9':
        this.state.regionSelect = 'paititi';
        if (this.onRegionSelect) this.onRegionSelect('paititi');
        break;
    }
    if (e.key === '6') { this.state.regionSelect = 'cloudForest'; if (this.onRegionSelect) this.onRegionSelect('cloudForest'); }
    else if (e.key === '7') { this.state.regionSelect = 'highSierra'; if (this.onRegionSelect) this.onRegionSelect('highSierra'); }
    else if (e.key === '8') { this.state.regionSelect = 'jungleLowlands'; if (this.onRegionSelect) this.onRegionSelect('jungleLowlands'); }
    else if (e.key === '9') { this.state.regionSelect = 'paititi'; if (this.onRegionSelect) this.onRegionSelect('paititi'); }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (this.state.aimHeld) {
        this.state.shootPressed = true;
      }
    } else if (e.button === 2) {
      this.state.aimHeld = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDragging = false;
    } else if (e.button === 2) {
      this.state.aimHeld = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    this.isPointerLocked = typeof document !== 'undefined' && document.pointerLockElement !== null;
    if (this.isPointerLocked) {
      this.accumMouseX += e.movementX * 0.15;
      this.accumMouseY += e.movementY * 0.15;
    } else if (this.mouseDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.accumMouseX += dx * 0.22;
      this.accumMouseY += dy * 0.22;
    }
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.hasTouchOverlay) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'BUTTON' || target.closest('button, a, input, select'))) return;

    const halfW = window.innerWidth * 0.5;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < halfW && this.moveTouchId === -1) {
        this.moveTouchId = t.identifier;
        this.moveOriginX = t.clientX;
        this.moveOriginY = t.clientY;
        this.touchMoveX = 0;
        this.touchMoveZ = 0;
      } else if (t.clientX >= halfW && this.lookTouchId === -1) {
        this.lookTouchId = t.identifier;
        this.lastTouchLookX = t.clientX;
        this.lastTouchLookY = t.clientY;
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.hasTouchOverlay) return;
    const maxRadius = 56;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.moveTouchId) {
        const dx = t.clientX - this.moveOriginX;
        const dy = t.clientY - this.moveOriginY;
        this.touchMoveX = Math.max(-1, Math.min(1, dx / maxRadius));
        this.touchMoveZ = Math.max(-1, Math.min(1, dy / maxRadius));
      } else if (t.identifier === this.lookTouchId) {
        const dx = t.clientX - this.lastTouchLookX;
        const dy = t.clientY - this.lastTouchLookY;
        this.lastTouchLookX = t.clientX;
        this.lastTouchLookY = t.clientY;
        this.accumMouseX += dx * 0.3;
        this.accumMouseY += dy * 0.3;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.hasTouchOverlay) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.moveTouchId) {
        this.moveTouchId = -1;
        this.touchMoveX = 0;
        this.touchMoveZ = 0;
      } else if (t.identifier === this.lookTouchId) {
        this.lookTouchId = -1;
      }
    }
  }

  public dispose(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    window.removeEventListener('touchstart', this.onTouchStartBound);
    window.removeEventListener('touchmove', this.onTouchMoveBound);
    window.removeEventListener('touchend', this.onTouchEndBound);
    window.removeEventListener('touchcancel', this.onTouchEndBound);
    this.keysDown.clear();
  }
}
