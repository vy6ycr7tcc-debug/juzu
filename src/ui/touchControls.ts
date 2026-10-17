import type { Input } from '../core/input';
import type { WeaponManager } from '../player/weapon';
import type { ExpeditionMenu } from './expeditionMenu';

export interface TouchControlsOptions {
  input: Input;
  weapon: WeaponManager;
  expeditionMenu: ExpeditionMenu;
  onFire: () => void;
  onGrapple: () => void;
  onInteract: () => void;
}

export class TouchControls {
  private input: Input;
  private weapon: WeaponManager;
  private expeditionMenu: ExpeditionMenu;
  private onFire: () => void;
  private onGrapple: () => void;
  private onInteract: () => void;

  private rootEl: HTMLElement;
  private joyBaseEl: HTMLElement;
  private joyKnobEl: HTMLElement;

  // Joystick state
  private activeTouchId: number | null = null;
  private baseCenter = { x: 0, y: 0 };
  private maxRadius = 52;
  private isPointerDown = false;

  // Look touch state (upper/right screen drag)
  private lookTouchId: number | null = null;
  private lastLookPos = { x: 0, y: 0 };

  constructor(options: TouchControlsOptions) {
    this.input = options.input;
    this.weapon = options.weapon;
    this.expeditionMenu = options.expeditionMenu;
    this.onFire = options.onFire;
    this.onGrapple = options.onGrapple;
    this.onInteract = options.onInteract;

    // Root touch layer
    const touchLayer = document.getElementById('juzu-touch-layer') || document.body;
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'juzu-mobile-touch-root';
    this.rootEl.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 35;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    touchLayer.appendChild(this.rootEl);

    // 1. Virtual Analog Joystick (Bottom-Left)
    this.joyBaseEl = document.createElement('div');
    this.joyBaseEl.id = 'juzu-touch-joy-base';
    this.joyBaseEl.style.cssText = `
      position: absolute;
      bottom: 32px;
      left: 28px;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(20,24,28,0.5) 0%, rgba(12,14,18,0.78) 100%);
      border: 2px solid rgba(212, 160, 40, 0.45);
      box-shadow: 0 4px 20px rgba(0,0,0,0.6), inset 0 0 16px rgba(0,0,0,0.6);
      pointer-events: auto;
      touch-action: none;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;

    this.joyKnobEl = document.createElement('div');
    this.joyKnobEl.id = 'juzu-touch-joy-knob';
    this.joyKnobEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: radial-gradient(circle, #f5eedc 0%, #d4a028 100%);
      border: 2px solid #ffffff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.65);
      pointer-events: none;
      transition: transform 0.05s ease-out;
    `;
    this.joyBaseEl.appendChild(this.joyKnobEl);
    this.rootEl.appendChild(this.joyBaseEl);

    // 2. Right Action Cluster (Bottom-Right)
    const actionCluster = document.createElement('div');
    actionCluster.id = 'juzu-touch-action-cluster';
    actionCluster.style.cssText = `
      position: absolute;
      bottom: 28px;
      right: 24px;
      display: grid;
      grid-template-areas:
        ". aim fire"
        "crouch jump interact";
      gap: 12px;
      pointer-events: auto;
      touch-action: manipulation;
    `;

    // Action button definitions
    const createBtn = (
      id: string,
      area: string,
      icon: string,
      label: string,
      size = 54,
      bgGradient = 'radial-gradient(circle, rgba(32,38,44,0.85) 0%, rgba(18,22,26,0.95) 100%)',
      borderColor = 'rgba(212, 160, 40, 0.55)'
    ) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.style.cssText = `
        grid-area: ${area};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${bgGradient};
        border: 2px solid ${borderColor};
        color: #f5eedc;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        box-shadow: 0 4px 14px rgba(0,0,0,0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 0.08s ease, background 0.1s ease;
      `;
      btn.innerHTML = `
        <span>${icon}</span>
        <span style="font-size: 9px; font-weight: 700; color: #e8c872; letter-spacing: 0.04em; margin-top: 1px;">${label}</span>
      `;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btn.style.transform = 'scale(0.92)';
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.style.transform = 'scale(1.0)';
      });
      return btn;
    };

    // JUMP Button (Large prominent button)
    const jumpBtn = createBtn('juzu-btn-jump', 'jump', '▲', 'JUMP', 62, 'radial-gradient(circle, #384836 0%, #1e281e 100%)', '#68c4a0');
    jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.setVirtualJump(true);
    });
    jumpBtn.addEventListener('pointerup', () => this.input.setVirtualJump(false));
    jumpBtn.addEventListener('pointerleave', () => this.input.setVirtualJump(false));
    actionCluster.appendChild(jumpBtn);

    // FIRE / SHOOT Button
    const fireBtn = createBtn('juzu-btn-fire', 'fire', '💥', 'FIRE', 60, 'radial-gradient(circle, #5a2822 0%, #32120e 100%)', '#e85d4e');
    fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onFire();
    });
    actionCluster.appendChild(fireBtn);

    // AIM Button (Toggles precision aim & reticle)
    const aimBtn = createBtn('juzu-btn-aim', 'aim', '🎯', 'AIM', 52);
    aimBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.weapon.toggleAim();
    });
    actionCluster.appendChild(aimBtn);

    // CROUCH Button
    const crouchBtn = createBtn('juzu-btn-crouch', 'crouch', '▼', 'CROUCH', 48);
    crouchBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const current = (this.input as any).virtualCrouch || false;
      (this.input as any).virtualCrouch = !current;
      crouchBtn.style.borderColor = !current ? '#e8c872' : 'rgba(212, 160, 40, 0.55)';
    });
    actionCluster.appendChild(crouchBtn);

    // INTERACT Button
    const interactBtn = createBtn('juzu-btn-interact', 'interact', '✋', 'ACTION', 52);
    interactBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onInteract();
    });
    actionCluster.appendChild(interactBtn);

    this.rootEl.appendChild(actionCluster);

    // 3. Top Navigation Pills (World Map & Inventory)
    const topBar = document.createElement('div');
    topBar.id = 'juzu-mobile-top-bar';
    topBar.style.cssText = `
      position: absolute;
      top: 18px;
      right: 18px;
      display: flex;
      gap: 10px;
      pointer-events: auto;
    `;

    const createPill = (icon: string, label: string, onClick: () => void) => {
      const pill = document.createElement('button');
      pill.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 16px;
        background: rgba(18, 22, 28, 0.82);
        border: 1px solid rgba(212, 160, 40, 0.45);
        color: #f5eedc;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      `;
      pill.innerHTML = `<span>${icon}</span><span>${label}</span>`;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return pill;
    };

    topBar.appendChild(createPill('🗺️', 'Map', () => this.expeditionMenu.open('map')));
    topBar.appendChild(createPill('🎒', 'Inventory', () => this.expeditionMenu.open('inventory')));
    topBar.appendChild(createPill('⚙️', 'Menu', () => this.expeditionMenu.open('settings')));

    this.rootEl.appendChild(topBar);

    // Bind Virtual Joystick Events
    this.bindJoystick();

    // Bind Screen Touch Look (dragging in upper screen turns camera)
    this.bindScreenTouchLook();
  }

  private bindJoystick(): void {
    const onStart = (clientX: number, clientY: number, pointerId: number) => {
      this.isPointerDown = true;
      this.activeTouchId = pointerId;
      const rect = this.joyBaseEl.getBoundingClientRect();
      this.baseCenter = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      };
      this.handleJoyMove(clientX, clientY);
    };

    this.joyBaseEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        this.joyBaseEl.setPointerCapture(e.pointerId);
      } catch {}
      onStart(e.clientX, e.clientY, e.pointerId);
    });

    this.joyBaseEl.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown || e.pointerId !== this.activeTouchId) return;
      e.preventDefault();
      this.handleJoyMove(e.clientX, e.clientY);
    });

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.activeTouchId) return;
      this.isPointerDown = false;
      this.activeTouchId = null;
      this.joyKnobEl.style.transform = 'translate(-50%, -50%)';
      this.input.setVirtualMove(0, 0);
      this.input.setVirtualBoost(false);
    };

    this.joyBaseEl.addEventListener('pointerup', onEnd);
    this.joyBaseEl.addEventListener('pointercancel', onEnd);
  }

  private handleJoyMove(clientX: number, clientY: number): void {
    const dx = clientX - this.baseCenter.x;
    const dy = clientY - this.baseCenter.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    const clampedDist = Math.min(dist, this.maxRadius);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    this.joyKnobEl.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

    // Map deflection to movement vector (normalized)
    const norm = clampedDist / this.maxRadius;
    const moveX = (knobX / this.maxRadius);
    const moveY = -(knobY / this.maxRadius); // Inverted Y: up on stick is forward

    this.input.setVirtualMove(moveX, moveY);

    // Auto-sprint past 75% deflection
    if (norm > 0.75) {
      this.input.setVirtualBoost(true);
    } else {
      this.input.setVirtualBoost(false);
    }
  }

  private bindScreenTouchLook(): void {
    // Upper screen touch look area
    window.addEventListener(
      'touchstart',
      (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          // If touch is in upper 65% of screen and not on a button, use for camera look
          if (t.clientY < window.innerHeight * 0.68 && this.lookTouchId === null) {
            this.lookTouchId = t.identifier;
            this.lastLookPos = { x: t.clientX, y: t.clientY };
            break;
          }
        }
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (this.lookTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.lookTouchId) {
            const dx = t.clientX - this.lastLookPos.x;
            const dy = t.clientY - this.lastLookPos.y;
            this.lastLookPos = { x: t.clientX, y: t.clientY };

            // Feed look deltas into input
            this.input.lookX += dx * 1.25;
            this.input.lookY += dy * 1.25;
            break;
          }
        }
      },
      { passive: false }
    );

    const onLookEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookTouchId) {
          this.lookTouchId = null;
          break;
        }
      }
    };

    window.addEventListener('touchend', onLookEnd, { passive: true });
    window.addEventListener('touchcancel', onLookEnd, { passive: true });
  }

  public setVisible(visible: boolean): void {
    this.rootEl.style.display = visible ? 'block' : 'none';
  }
}
