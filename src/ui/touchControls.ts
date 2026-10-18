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
  private activeJoyTouchId: number | null = null;
  private baseCenter = { x: 0, y: 0 };
  private maxRadius = 52;
  private isJoyActive = false;

  // Camera look touch state (right half of screen swipe)
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

    // 1. Floating Virtual Analog Joystick (Bottom-Left Default Resting Position)
    this.joyBaseEl = document.createElement('div');
    this.joyBaseEl.id = 'juzu-touch-joy-base';
    this.joyBaseEl.style.cssText = `
      position: absolute;
      bottom: 32px;
      left: 28px;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(24,32,28,0.45) 0%, rgba(12,16,14,0.72) 100%);
      border: 2px solid rgba(212, 160, 40, 0.45);
      box-shadow: 0 4px 20px rgba(0,0,0,0.6), inset 0 0 16px rgba(0,0,0,0.5);
      pointer-events: auto;
      touch-action: none;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      opacity: 0.55;
      transition: opacity 0.2s ease, transform 0.15s ease;
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
      background: radial-gradient(circle, #fbf7ee 0%, #caa05b 100%);
      border: 2px solid #ffffff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.7);
      pointer-events: none;
      transition: transform 0.04s ease-out;
    `;
    this.joyBaseEl.appendChild(this.joyKnobEl);
    this.rootEl.appendChild(this.joyBaseEl);

    // 2. Right Ergonomic Action Cluster (Natural Thumb Arc)
    const actionCluster = document.createElement('div');
    actionCluster.id = 'juzu-touch-action-cluster';
    actionCluster.style.cssText = `
      position: absolute;
      bottom: 24px;
      right: 20px;
      width: 220px;
      height: 180px;
      pointer-events: none;
    `;

    // Action button helper
    const createBtn = (
      id: string,
      icon: string,
      label: string,
      size: number,
      posCss: string,
      bgGradient: string,
      borderColor: string
    ) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.style.cssText = `
        position: absolute;
        ${posCss};
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
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        pointer-events: auto;
        touch-action: manipulation;
        box-shadow: 0 4px 16px rgba(0,0,0,0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 0.08s ease, filter 0.12s ease;
      `;
      btn.innerHTML = `
        <span style="font-size: ${Math.round(size * 0.36)}px; line-height: 1;">${icon}</span>
        <span style="font-size: 9px; font-weight: 700; color: #e8c872; letter-spacing: 0.05em; margin-top: 2px;">${label}</span>
      `;
      btn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        btn.style.transform = 'scale(0.92)';
      }, { passive: false });
      btn.addEventListener('touchend', (e) => {
        e.stopPropagation();
        btn.style.transform = 'scale(1.0)';
      }, { passive: false });
      return btn;
    };

    // JUMP Button (Primary Locomotion — Resting thumb position)
    const jumpBtn = createBtn(
      'juzu-btn-jump',
      '▲',
      'JUMP',
      64,
      'right: 8px; bottom: 8px;',
      'radial-gradient(circle, #384e36 0%, #1e281e 100%)',
      '#75caa0'
    );
    jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.setVirtualJump(true);
    });
    jumpBtn.addEventListener('pointerup', () => this.input.setVirtualJump(false));
    jumpBtn.addEventListener('pointerleave', () => this.input.setVirtualJump(false));
    actionCluster.appendChild(jumpBtn);

    // FIRE / SHOOT Button (Above Jump)
    const fireBtn = createBtn(
      'juzu-btn-fire',
      '💥',
      'FIRE',
      60,
      'right: 12px; bottom: 92px;',
      'radial-gradient(circle, #682622 0%, #38120e 100%)',
      '#f06856'
    );
    fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onFire();
    });
    actionCluster.appendChild(fireBtn);

    // ACTION / INTERACT / GRAPPLE Button (Left of Jump)
    const interactBtn = createBtn(
      'juzu-btn-interact',
      '✋',
      'ACTION',
      58,
      'right: 88px; bottom: 12px;',
      'radial-gradient(circle, #343e46 0%, #1a2228 100%)',
      '#e0a830'
    );
    interactBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onInteract();
      this.onGrapple();
    });
    actionCluster.appendChild(interactBtn);

    // AIM Toggle Button (Above Action)
    const aimBtn = createBtn(
      'juzu-btn-aim',
      '🎯',
      'AIM',
      48,
      'right: 88px; bottom: 92px;',
      'radial-gradient(circle, #2a343a 0%, #141a20 100%)',
      'rgba(212, 160, 40, 0.65)'
    );
    aimBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.weapon.toggleAim();
    });
    actionCluster.appendChild(aimBtn);

    // CROUCH Toggle Button (Far Left)
    const crouchBtn = createBtn(
      'juzu-btn-crouch',
      '▼',
      'CROUCH',
      44,
      'right: 160px; bottom: 18px;',
      'radial-gradient(circle, #222a30 0%, #10161a 100%)',
      'rgba(212, 160, 40, 0.45)'
    );
    crouchBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = (this.input as any).virtualCrouch || false;
      (this.input as any).virtualCrouch = !current;
      crouchBtn.style.borderColor = !current ? '#e8c872' : 'rgba(212, 160, 40, 0.45)';
    });
    actionCluster.appendChild(crouchBtn);

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
        background: rgba(18, 24, 20, 0.85);
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

    // Bind Floating Joystick & Right-Half Screen Camera Look
    this.bindFloatingJoystickAndLook();
  }

  private bindFloatingJoystickAndLook(): void {
    const handleTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const isLeftZone = t.clientX < window.innerWidth * 0.48;

        if (isLeftZone) {
          // Left half touch: Anchor floating joystick under the thumb
          if (this.activeJoyTouchId === null) {
            this.activeJoyTouchId = t.identifier;
            this.isJoyActive = true;
            this.baseCenter = { x: t.clientX, y: t.clientY };

            this.joyBaseEl.style.left = `${t.clientX - 60}px`;
            this.joyBaseEl.style.top = `${t.clientY - 60}px`;
            this.joyBaseEl.style.bottom = 'auto';
            this.joyBaseEl.style.opacity = '0.92';
            this.joyBaseEl.style.transform = 'scale(1.06)';

            this.handleJoyMove(t.clientX, t.clientY);
          }
        } else {
          // Right half touch: Camera swipe look (if not clicking an interactive action button)
          const target = e.target as HTMLElement;
          const isButton = target && target.closest('#juzu-touch-action-cluster, #juzu-mobile-top-bar, button');
          if (!isButton && this.lookTouchId === null) {
            this.lookTouchId = t.identifier;
            this.lastLookPos = { x: t.clientX, y: t.clientY };
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (t.identifier === this.activeJoyTouchId) {
          this.handleJoyMove(t.clientX, t.clientY);
        } else if (t.identifier === this.lookTouchId) {
          const dx = t.clientX - this.lastLookPos.x;
          const dy = t.clientY - this.lastLookPos.y;
          this.lastLookPos = { x: t.clientX, y: t.clientY };

          this.input.lookX += dx * 1.35;
          this.input.lookY += dy * 1.35;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (t.identifier === this.activeJoyTouchId) {
          this.activeJoyTouchId = null;
          this.isJoyActive = false;
          this.joyKnobEl.style.transform = 'translate(-50%, -50%)';
          this.input.setVirtualMove(0, 0);
          this.input.setVirtualBoost(false);

          this.joyBaseEl.style.opacity = '0.45';
          this.joyBaseEl.style.transform = 'scale(1.0)';
          // Reset to default resting position
          this.joyBaseEl.style.left = '28px';
          this.joyBaseEl.style.bottom = '32px';
          this.joyBaseEl.style.top = 'auto';
        } else if (t.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // Also bind pointer events on the joyBaseEl directly for desktop mouse drag simulation
    this.joyBaseEl.addEventListener('pointerdown', (e) => {
      if (this.activeJoyTouchId !== null) return;
      this.isJoyActive = true;
      const rect = this.joyBaseEl.getBoundingClientRect();
      this.baseCenter = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      };
      this.handleJoyMove(e.clientX, e.clientY);

      const onPointerMove = (ev: PointerEvent) => {
        if (!this.isJoyActive) return;
        this.handleJoyMove(ev.clientX, ev.clientY);
      };

      const onPointerUp = () => {
        this.isJoyActive = false;
        this.joyKnobEl.style.transform = 'translate(-50%, -50%)';
        this.input.setVirtualMove(0, 0);
        this.input.setVirtualBoost(false);
        this.joyBaseEl.style.opacity = '0.45';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
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
    const moveX = knobX / this.maxRadius;
    const moveY = -(knobY / this.maxRadius); // Inverted Y: up on stick is forward

    this.input.setVirtualMove(moveX, moveY);

    // Auto-sprint past 75% deflection
    if (norm > 0.75) {
      this.input.setVirtualBoost(true);
    } else {
      this.input.setVirtualBoost(false);
    }
  }

  public setVisible(visible: boolean): void {
    this.rootEl.style.display = visible ? 'block' : 'none';
  }
}
