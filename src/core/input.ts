export class Input {
  move = { x: 0, y: 0 };
  lookX = 0;
  lookY = 0;
  zoom = 1;

  get boost(): boolean {
    return this.enabled && (this.keys.has('shift') || this.joyRun > 0.5);
  }

  get jump(): boolean {
    return this.enabled && (this.keys.has(' ') || this.actPressed);
  }

  get crouch(): boolean {
    return this.enabled && this.keys.has('c');
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

  enabled = true;
  private keys = new Set<string>();
  private actPressed = false;
  private interactPressed = false;
  private interactLatched = false;
  private instinctLatched = false;
  private journalLatched = false;

  // Touch joystick
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private joyR = 56;
  private joyRun = 0;

  // Touch look
  private lookId: number | null = null;
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
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'tab') e.preventDefault();
      if (!e.repeat) {
        if (k === 'e') this.interactLatched = true;
        if (k === 'q') this.instinctLatched = true;
        if (k === 'tab' || k === 'j') this.journalLatched = true;
      }
      this.keys.add(k);
      this.updateKeyboardMove();
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      this.updateKeyboardMove();
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.move.x = 0;
      this.move.y = 0;
    });
  }

  private updateKeyboardMove(): void {
    if (this.joyId !== null) return; // Touch joystick takes precedence
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

    // Touch events for mobile
    this.surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const isLeft = e.clientX < window.innerWidth * 0.45;
      if (isLeft && this.joyId === null) {
        // Start virtual joystick
        this.joyId = e.pointerId;
        this.joyCenter.x = e.clientX;
        this.joyCenter.y = e.clientY;
        if (this.joyEl) {
          this.joyEl.style.display = 'block';
          this.joyEl.style.left = `${e.clientX - 56}px`;
          this.joyEl.style.top = `${e.clientY - 56}px`;
        }
      } else if (!isLeft && this.lookId === null) {
        // Start touch look
        this.lookId = e.pointerId;
        this.lookLast.x = e.clientX;
        this.lookLast.y = e.clientY;
      }
    });

    this.surface.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerId === this.joyId) {
        const dx = e.clientX - this.joyCenter.x;
        const dy = e.clientY - this.joyCenter.y;
        const dist = Math.hypot(dx, dy);
        const norm = dist > 0 ? Math.min(dist, this.joyR) : 0;
        const angle = Math.atan2(dy, dx);

        const kx = Math.cos(angle) * norm;
        const ky = Math.sin(angle) * norm;

        if (this.knobEl) {
          this.knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
        }

        this.move.x = kx / this.joyR;
        this.move.y = -ky / this.joyR;
        this.joyRun = norm / this.joyR;
      } else if (e.pointerId === this.lookId) {
        const dx = e.clientX - this.lookLast.x;
        const dy = e.clientY - this.lookLast.y;
        this.lookLast.x = e.clientX;
        this.lookLast.y = e.clientY;
        this.lookX += dx;
        this.lookY += dy;
      }
    });

    const endTouch = (e: PointerEvent) => {
      if (e.pointerId === this.joyId) {
        this.joyId = null;
        this.move.x = 0;
        this.move.y = 0;
        this.joyRun = 0;
        if (this.knobEl) this.knobEl.style.transform = 'translate(0px, 0px)';
        if (this.joyEl) this.joyEl.style.display = 'none';
        this.updateKeyboardMove();
      } else if (e.pointerId === this.lookId) {
        this.lookId = null;
      }
    };

    this.surface.addEventListener('pointerup', endTouch);
    this.surface.addEventListener('pointercancel', endTouch);

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
