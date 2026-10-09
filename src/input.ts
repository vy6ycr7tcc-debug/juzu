export class InputManager {
  public keys: Record<string, boolean> = {};
  public justPressed: Record<string, boolean> = {};
  public joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  // Analog magnitude (0..1) of the virtual stick — P-MOBILE F3: the
  // character controller maps this onto the walk→run band (full deflection
  // sustains run speed). Keyboard input keeps magnitude implicit (1).
  public joystickMagnitude: number = 0;
  public cameraDelta: { x: number; y: number } = { x: 0, y: 0 };
  public tap: boolean = false;
  public hold: boolean = false;

  public mouseButtons: Record<number, boolean> = {};
  public mouseButtonsJustPressed: Record<number, boolean> = {};
  public mouseButtonsJustReleased: Record<number, boolean> = {};

  public mouseSensitivityMultiplier: number = 1.0;

  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) {
        this.justPressed[e.code] = true;
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      delete this.justPressed[e.code];
    });

    window.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.mouseButtons[e.button] = true;
      this.mouseButtonsJustPressed[e.button] = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      this.mouseButtons[e.button] = false;
      this.mouseButtonsJustReleased[e.button] = true;
      delete this.mouseButtonsJustPressed[e.button];
    });
    window.addEventListener('contextmenu', (e) => {
      // Suppress browser context menu so Right Click can be used for survival bow aiming
      e.preventDefault();
    });
    let ignorePointerLockSpike = 0;
    document.addEventListener('pointerlockchange', () => {
      // Browsers often fire a large synthetic mousemove delta on the initial lock frame.
      // Ignore the first 2 move events following a lock state change to prevent camera snap-glitches.
      ignorePointerLockSpike = 2;
      this.cameraDelta.x = 0;
      this.cameraDelta.y = 0;
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        if (ignorePointerLockSpike > 0) {
          ignorePointerLockSpike--;
          return;
        }
        // Clamp raw delta per frame to reject extreme browser hitch spikes (600px allows fast 1:1 gaming mouse flicks)
        const mx = Math.max(-600, Math.min(600, e.movementX));
        const my = Math.max(-600, Math.min(600, e.movementY));
        this.cameraDelta.x += mx * this.mouseSensitivityMultiplier;
        this.cameraDelta.y += my * this.mouseSensitivityMultiplier;
      } else if (this.isDragging) {
        const dx = Math.max(-600, Math.min(600, e.clientX - this.previousMousePosition.x));
        const dy = Math.max(-600, Math.min(600, e.clientY - this.previousMousePosition.y));
        this.cameraDelta.x += dx * this.mouseSensitivityMultiplier;
        this.cameraDelta.y += dy * this.mouseSensitivityMultiplier;
      }
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // P-MOBILE F7: an app switch must never leave a key latched down
    // (the character kept walking after returning to the tab).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys = {};
        this.justPressed = {};
        this.mouseButtons = {};
        this.mouseButtonsJustPressed = {};
        this.mouseButtonsJustReleased = {};
      }
    });
  }

  isDown(code: string): boolean {
    return !!this.keys[code];
  }

  consumeJustPressed(code: string): boolean {
    if (this.justPressed[code]) {
      delete this.justPressed[code];
      return true;
    }
    return false;
  }

  isMouseButtonDown(button: number): boolean {
    return !!this.mouseButtons[button];
  }

  consumeMouseButtonJustPressed(button: number): boolean {
    if (this.mouseButtonsJustPressed[button]) {
      delete this.mouseButtonsJustPressed[button];
      return true;
    }
    return false;
  }

  consumeMouseButtonJustReleased(button: number): boolean {
    if (this.mouseButtonsJustReleased[button]) {
      delete this.mouseButtonsJustReleased[button];
      return true;
    }
    return false;
  }

  // P-MOBILE F7: full input wipe (used alongside TouchControls.releaseAll
  // when the tab hides or the pause menu opens).
  clear(): void {
    this.keys = {};
    this.justPressed = {};
    this.joystickVector = { x: 0, y: 0 };
    this.joystickMagnitude = 0;
    this.cameraDelta = { x: 0, y: 0 };
    this.tap = false;
    this.hold = false;
  }

  getJoystickVector(): { x: number; y: number } {
    return this.joystickVector;
  }

  getCameraDelta(): { x: number; y: number } {
    const delta = { ...this.cameraDelta };
    this.cameraDelta.x = 0;
    this.cameraDelta.y = 0;
    return delta;
  }

  consumeTap(): boolean {
    if (this.tap) {
      this.tap = false;
      return true;
    }
    return false;
  }

  consumeHold(): boolean {
    if (this.hold) {
      this.hold = false;
      return true;
    }
    return false;
  }
}

// P-MOBILE: touch-capable device probe (coarse primary pointer or real
// touchstart surface). Drives the mobile default quality tier (renderer.ts)
// and whether the touch UI layer mounts (main.ts). `&touch=1` bypasses this
// for desktop verification captures.
export function isTouchLikeDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}
