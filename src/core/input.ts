export class Input {
  move = { x: 0, y: 0 };
  lookX = 0;
  lookY = 0;
  zoom = 1;
  wheelDeltaY = 0;

  getAndResetWheel(): number {
    const val = this.wheelDeltaY;
    this.wheelDeltaY = 0;
    return val;
  }

  private virtualMove: { x: number; y: number } | null = null;
  private virtualBoost = false;
  private virtualJump = false;
  public virtualCrouch = false;
  private shootLatched = false;
  private aimLatched = false;

  public triggerVirtualShoot(): void {
    this.shootLatched = true;
  }

  public triggerVirtualAim(): void {
    this.aimLatched = true;
  }

  get shoot(): boolean {
    if (!this.enabled) return false;
    if (this.shootLatched) {
      this.shootLatched = false;
      return true;
    }
    return this.keys.has('r');
  }

  get aim(): boolean {
    if (!this.enabled) return false;
    if (this.aimLatched) {
      this.aimLatched = false;
      return true;
    }
    return this.keys.has('v');
  }

  public setVirtualMove(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len > 0) {
      // Preserve analog deflection while clamping maximum magnitude to 1.0
      const scale = len > 1.0 ? 1.0 / len : 1.0;
      this.virtualMove = { x: x * scale, y: y * scale };
    } else {
      this.virtualMove = null;
    }
    this.updateKeyboardMove();
  }

  public setVirtualBoost(active: boolean): void {
    this.virtualBoost = active;
  }

  public setVirtualJump(active: boolean): void {
    this.virtualJump = active;
  }

  public triggerVirtualInteract(): void {
    this.interactLatched = true;
  }

  public triggerVirtualInstinct(): void {
    this.instinctLatched = true;
  }

  public triggerVirtualJournal(): void {
    this.journalLatched = true;
  }

  get boost(): boolean {
    return this.enabled && (this.keys.has('shift') || this.virtualBoost);
  }

  get jump(): boolean {
    return this.enabled && (this.keys.has(' ') || this.actPressed || this.virtualJump);
  }

  get crouch(): boolean {
    return this.enabled && (this.keys.has('c') || this.virtualCrouch);
  }

  get interact(): boolean {
    if (!this.enabled) return false;
    if (this.interactLatched) {
      this.interactLatched = false;
      return true;
    }
    return this.keys.has('e') || this.interactPressed;
  }

  get instinct(): boolean {
    if (!this.enabled) return false;
    if (this.instinctLatched) {
      this.instinctLatched = false;
      return true;
    }
    return this.keys.has('q');
  }

  get journal(): boolean {
    if (!this.enabled) return false;
    if (this.journalLatched) {
      this.journalLatched = false;
      return true;
    }
    return this.keys.has('tab') || this.keys.has('j');
  }

  get grapple(): boolean {
    if (!this.enabled) return false;
    if (this.grappleLatched) {
      this.grappleLatched = false;
      return true;
    }
    return this.keys.has('f');
  }

  enabled = true;
  private keys = new Set<string>();
  private actPressed = false;
  private interactPressed = false;
  private interactLatched = false;
  private instinctLatched = false;
  private journalLatched = false;
  private grappleLatched = false;

  private lookLast = { x: 0, y: 0 };
  private isMouseDown = false;

  constructor(
    private surface: HTMLElement,
    private joyEl?: HTMLElement,
    private knobEl?: HTMLElement,
    private actionBtn?: HTMLElement
  ) {
    this.bindKeyboard();
    this.bindPointer();
  }

  private bindKeyboard(): void {
    const normalizeKey = (e: KeyboardEvent): string => {
      if (e.code && e.code.startsWith('Key')) {
        return e.code.slice(3).toLowerCase();
      }
      return e.key.toLowerCase();
    };

    window.addEventListener('keydown', (e) => {
      const k = normalizeKey(e);
      if (e.key.toLowerCase() === 'tab') e.preventDefault();
      if (!e.repeat) {
        if (k === 'e') this.interactLatched = true;
        if (k === 'q') this.instinctLatched = true;
        if (k === 'tab' || k === 'j') this.journalLatched = true;
        if (k === 'f') this.grappleLatched = true;
      }
      this.keys.add(k);
      this.updateKeyboardMove();
    });

    window.addEventListener('keyup', (e) => {
      const k = normalizeKey(e);
      this.keys.delete(k);
      this.updateKeyboardMove();
    });

    window.addEventListener('blur', () => {
      // In headless testing or unfocused window contexts, do not clear active keys unless page is truly hidden
      if (document.hidden) {
        this.keys.clear();
        this.move.x = 0;
        this.move.y = 0;
      }
    });
  }

  private updateKeyboardMove(): void {
    if (this.virtualMove !== null) {
      this.move.x = this.virtualMove.x;
      this.move.y = this.virtualMove.y;
      return;
    }
    let x = 0;
    let y = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;

    const len = Math.hypot(x, y);
    if (len > 0) {
      this.move.x = x / len;
      this.move.y = y / len;
    } else {
      this.move.x = 0;
      this.move.y = 0;
    }
  }

  private bindPointer(): void {
    // Desktop mouse look via pointerlock or dragging
    this.surface.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.lookLast.x = e.clientX;
        this.lookLast.y = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.surface) {
        this.lookX += e.movementX;
        this.lookY += e.movementY;
      } else if (this.isMouseDown) {
        const dx = e.clientX - this.lookLast.x;
        const dy = e.clientY - this.lookLast.y;
        this.lookLast.x = e.clientX;
        this.lookLast.y = e.clientY;
        this.lookX += dx;
        this.lookY += dy;
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        this.wheelDeltaY += e.deltaY;
      },
      { passive: true }
    );

    if (this.actionBtn) {
      this.actionBtn.addEventListener('pointerdown', () => {
        this.actPressed = true;
      });
      this.actionBtn.addEventListener('pointerup', () => {
        this.actPressed = false;
      });
      this.actionBtn.addEventListener('pointercancel', () => {
        this.actPressed = false;
      });
    }
  }

  public resetLook(): { x: number; y: number } {
    const lx = this.lookX;
    const ly = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x: lx, y: ly };
  }
}
