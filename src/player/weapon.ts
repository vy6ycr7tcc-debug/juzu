import * as THREE from 'three/webgpu';
import type { Naira } from './naira';
import type { AudioEngine } from '../core/audio';

export interface HitResult {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  object?: THREE.Object3D;
}

export class WeaponManager {
  public isEquipped = true;
  public isAiming = false;
  public ammo = 7;
  public maxMag = 7;
  public totalAmmo = 28;
  public isReloading = false;

  private scene: THREE.Scene;
  private naira: Naira;
  private audio: AudioEngine;
  private camera: THREE.Camera;

  // 3D Meshes
  public pistolMesh: THREE.Group;
  public holsterMesh: THREE.Group;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashQuad: THREE.Mesh;
  private muzzleFlashTimer = 0;

  // Particle sparks for bullet impacts
  private sparksGroup: THREE.Group;
  private sparkParticles: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
  }> = [];

  // Cooldowns
  private fireCooldown = 0;
  private reloadTimer = 0;

  // Raycaster for hitscan
  private raycaster = new THREE.Raycaster();

  // HUD elements
  private reticleEl: HTMLElement | null = null;
  private ammoEl: HTMLElement | null = null;

  constructor(scene: THREE.Scene, naira: Naira, audio: AudioEngine, camera: THREE.Camera) {
    this.scene = scene;
    this.naira = naira;
    this.audio = audio;
    this.camera = camera;

    // Build vintage expedition sidearm (blued steel, walnut grips, brass trigger)
    this.pistolMesh = this.buildPistolModel();
    this.holsterMesh = this.buildHolsterModel();

    // Muzzle flash FX
    this.muzzleFlashLight = new THREE.PointLight(0xffa233, 0, 8, 2);
    this.muzzleFlashLight.position.set(0, 0.052, 0.17);
    this.pistolMesh.add(this.muzzleFlashLight);

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe088,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flashGeom = new THREE.PlaneGeometry(0.16, 0.16);
    this.muzzleFlashQuad = new THREE.Mesh(flashGeom, flashMat);
    this.muzzleFlashQuad.position.set(0, 0.052, 0.17);
    this.pistolMesh.add(this.muzzleFlashQuad);

    // Sparks group
    this.sparksGroup = new THREE.Group();
    this.sparksGroup.name = 'Weapon_BulletSparks';
    this.scene.add(this.sparksGroup);

    // Create Reticle and Ammo HUD
    this.createHudElements();

    // Initial mount to holster or hand
    this.attachWeapon();
  }

  private buildPistolModel(): THREE.Group {
    const gun = new THREE.Group();
    gun.name = 'Expedition_Sidearm_Pistol';

    // Materials
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1b1d22,
      metalness: 0.94,
      roughness: 0.28,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3d2314,
      metalness: 0.04,
      roughness: 0.65,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc89832,
      metalness: 0.90,
      roughness: 0.35,
    });

    // 1. Slide & Barrel (Upper)
    const slideGeom = new THREE.BoxGeometry(0.028, 0.034, 0.16);
    const slide = new THREE.Mesh(slideGeom, steelMat);
    slide.position.set(0, 0.05, 0.05);
    slide.castShadow = true;
    gun.add(slide);

    // Barrel tip & muzzle aperture
    const barrelGeom = new THREE.CylinderGeometry(0.011, 0.011, 0.04, 12);
    const barrel = new THREE.Mesh(barrelGeom, steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.048, 0.138);
    gun.add(barrel);

    // Iron sights (Front & Rear notch)
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.008), brassMat);
    frontSight.position.set(0, 0.071, 0.125);
    gun.add(frontSight);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.006), steelMat);
    rearSight.position.set(0, 0.071, -0.025);
    gun.add(rearSight);

    // 2. Lower Receiver & Frame
    const frameGeom = new THREE.BoxGeometry(0.026, 0.03, 0.11);
    const frame = new THREE.Mesh(frameGeom, steelMat);
    frame.position.set(0, 0.025, 0.03);
    gun.add(frame);

    // 3. Ergonomic Walnut Handle Grip
    const gripGeom = new THREE.BoxGeometry(0.027, 0.09, 0.045);
    const grip = new THREE.Mesh(gripGeom, woodMat);
    grip.position.set(0, -0.025, -0.015);
    grip.rotation.x = -0.26;
    grip.castShadow = true;
    gun.add(grip);

    // Wooden grip panel plates (flanking left and right)
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.075, 0.038), woodMat);
      panel.position.set(s * 0.0145, -0.025, -0.015);
      panel.rotation.x = -0.26;
      gun.add(panel);
    }

    // 4. Trigger Guard & Brass Trigger
    const guardGeom = new THREE.TorusGeometry(0.016, 0.003, 6, 12, Math.PI);
    const guard = new THREE.Mesh(guardGeom, steelMat);
    guard.rotation.z = Math.PI;
    guard.rotation.y = Math.PI / 2;
    guard.position.set(0, 0.008, 0.032);
    gun.add(guard);

    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.006), brassMat);
    trigger.position.set(0, 0.012, 0.03);
    trigger.rotation.x = 0.22;
    gun.add(trigger);

    // 5. Hammer
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.012), brassMat);
    hammer.position.set(0, 0.058, -0.032);
    hammer.rotation.x = -0.45;
    gun.add(hammer);

    gun.scale.set(0.9, 0.9, 0.9);
    return gun;
  }

  private buildHolsterModel(): THREE.Group {
    const holster = new THREE.Group();
    holster.name = 'Naira_RightThigh_Holster';

    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x2e1810,
      roughness: 0.74,
      metalness: 0.06,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc89832,
      metalness: 0.90,
      roughness: 0.35,
    });

    // Formed leather pouch
    const pouchGeom = new THREE.BoxGeometry(0.062, 0.17, 0.082);
    const pouch = new THREE.Mesh(pouchGeom, leatherMat);
    pouch.position.set(0, -0.04, 0);
    pouch.rotation.x = -0.15;
    pouch.castShadow = true;
    holster.add(pouch);

    // Top retention leather flap with brass snap stud
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.04, 0.086), leatherMat);
    flap.position.set(0, 0.048, 0.005);
    holster.add(flap);

    const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), brassMat);
    snap.rotation.z = Math.PI / 2;
    snap.position.set(0.032, 0.045, 0.01);
    holster.add(snap);

    holster.position.set(0.108, 0.14, 0.01);
    holster.rotation.z = -0.12;
    return holster;
  }

  private createHudElements(): void {
    // 1. Aim Reticle
    const reticle = document.createElement('div');
    reticle.id = 'juzu-aim-reticle';
    reticle.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 44px;
      height: 44px;
      pointer-events: none;
      z-index: 45;
      display: none;
      transition: opacity 0.12s ease-out;
    `;
    reticle.innerHTML = `
      <svg viewBox="0 0 44 44" width="44" height="44" style="filter: drop-shadow(0 0 4px rgba(0,0,0,0.85));">
        <!-- Central Dot -->
        <circle cx="22" cy="22" r="2.5" fill="#f5eedc" />
        <!-- Reticle Crosshairs -->
        <line x1="22" y1="6" x2="22" y2="15" stroke="#e8c872" stroke-width="2" stroke-linecap="round" />
        <line x1="22" y1="29" x2="22" y2="38" stroke="#e8c872" stroke-width="2" stroke-linecap="round" />
        <line x1="6" y1="22" x2="15" y2="22" stroke="#e8c872" stroke-width="2" stroke-linecap="round" />
        <line x1="29" y1="22" x2="38" y2="22" stroke="#e8c872" stroke-width="2" stroke-linecap="round" />
      </svg>
    `;
    document.body.appendChild(reticle);
    this.reticleEl = reticle;

    // 2. Ammo Indicator HUD
    const ammoHud = document.createElement('div');
    ammoHud.id = 'juzu-ammo-hud';
    ammoHud.style.cssText = `
      position: fixed;
      top: 66px;
      right: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(18, 20, 24, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(212, 160, 40, 0.45);
      border-radius: 20px;
      color: #f5eedc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.05em;
      pointer-events: none;
      z-index: 40;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      user-select: none;
      -webkit-user-select: none;
    `;
    this.ammoEl = ammoHud;
    document.body.appendChild(ammoHud);
    this.updateAmmoDisplay();
  }

  public updateAmmoDisplay(): void {
    if (!this.ammoEl) return;
    this.ammoEl.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8c872" stroke-width="2">
        <path d="M7 4h10v16H7z" />
        <path d="M10 2h4v2h-4z" />
        <line x1="12" y1="8" x2="12" y2="12" />
      </svg>
      <span>${this.isReloading ? 'RELOADING...' : `${this.ammo} / ${this.totalAmmo}`}</span>
    `;
  }

  public attachWeapon(): void {
    // If thigh bone is available, attach holster
    if (this.naira.rightThighBone && !this.holsterMesh.parent) {
      this.naira.rightThighBone.add(this.holsterMesh);
    }

    if (this.isAiming || this.isEquipped) {
      // In hand
      if (this.naira.rightHandBone) {
        if (this.pistolMesh.parent !== this.naira.rightHandBone) {
          this.naira.rightHandBone.add(this.pistolMesh);
          this.pistolMesh.position.set(0.015, 0.085, 0.04);
          this.pistolMesh.rotation.set(-Math.PI * 0.48, 0.15, -Math.PI * 0.52);
        }
      }
    } else {
      // Holstered
      if (this.holsterMesh) {
        if (this.pistolMesh.parent !== this.holsterMesh) {
          this.holsterMesh.add(this.pistolMesh);
          this.pistolMesh.position.set(0, 0.03, 0);
          this.pistolMesh.rotation.set(Math.PI * 0.5, 0, 0);
        }
      }
    }
  }

  public toggleAim(): boolean {
    this.setAim(!this.isAiming);
    return this.isAiming;
  }

  public setAim(aiming: boolean): void {
    this.isAiming = aiming;
    this.naira.isAiming = aiming;
    if (this.reticleEl) {
      this.reticleEl.style.display = aiming ? 'block' : 'none';
    }
    this.attachWeapon();
  }

  public fire(collidables: THREE.Object3D[] = []): boolean {
    if (this.fireCooldown > 0 || this.isReloading) return false;

    if (this.ammo <= 0) {
      this.reload();
      return false;
    }

    // Auto-enter aim stance when firing
    if (!this.isAiming) {
      this.setAim(true);
    }

    this.ammo--;
    this.fireCooldown = 0.32;
    this.updateAmmoDisplay();

    // 1. Play synthesized gunshot audio
    this.audio.playGunshot();

    // 2. Trigger Muzzle Flash FX
    this.muzzleFlashTimer = 0.065;
    this.muzzleFlashLight.intensity = 15.0;
    (this.muzzleFlashQuad.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.muzzleFlashQuad.rotation.z = Math.random() * Math.PI * 2;

    // 3. Hitscan Ballistics via Raycaster from Camera Center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersects = this.raycaster.intersectObjects(collidables, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitPoint = hit.point;
      const hitNormal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);

      // Spawn spark burst & play bullet impact sound
      this.spawnImpactSparks(hitPoint, hitNormal);
      this.audio.playBulletImpact();
    }

    return true;
  }

  public reload(): void {
    if (this.isReloading || this.ammo >= this.maxMag || this.totalAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = 1.35;
    this.audio.playGunReload();
    this.updateAmmoDisplay();
  }

  private spawnImpactSparks(pos: THREE.Vector3, normal: THREE.Vector3): void {
    const sparkCount = 10;
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      blending: THREE.AdditiveBlending,
    });
    const sparkGeom = new THREE.SphereGeometry(0.022, 4, 4);

    for (let i = 0; i < sparkCount; i++) {
      const p = new THREE.Mesh(sparkGeom, sparkMat);
      p.position.copy(pos);
      this.sparksGroup.add(p);

      // Random cone velocity reflecting along normal
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      );
      const vel = normal.clone().multiplyScalar(4.0 + Math.random() * 3.0).add(spread);

      this.sparkParticles.push({
        mesh: p,
        vel,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.5,
      });
    }
  }

  public update(dt: number): void {
    // Cooldown timers
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const needed = this.maxMag - this.ammo;
        const take = Math.min(needed, this.totalAmmo);
        this.ammo += take;
        this.totalAmmo -= take;
        this.updateAmmoDisplay();
      }
    }

    // Muzzle flash decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashLight.intensity = 0;
        (this.muzzleFlashQuad.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    // Impact sparks simulation
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.sparksGroup.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        this.sparkParticles.splice(i, 1);
        continue;
      }
      sp.vel.y -= 9.8 * dt; // gravity
      sp.mesh.position.addScaledVector(sp.vel, dt);
      const scale = Math.max(0.001, sp.life / sp.maxLife);
      sp.mesh.scale.set(scale, scale, scale);
    }

    // Keep weapon attached to current bone
    this.attachWeapon();
  }
}
