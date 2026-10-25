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

  // Callbacks
  public onFireRecoil?: () => void;

  // 3D Meshes
  public pistolMesh: THREE.Group;
  public holsterMesh: THREE.Group;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashQuad: THREE.Mesh;
  private muzzleFlashTimer = 0;

  // Bullet Tracers
  private tracersGroup: THREE.Group;
  private tracerRays: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    life: number;
    maxLife: number;
  }> = [];

  // Particle debris for surface-differentiated bullet impacts
  private sparksGroup: THREE.Group;
  private sparkParticles: Array<{
    mesh: THREE.Mesh;
    mat?: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
    vel: THREE.Vector3;
    rotVel?: THREE.Vector3;
    life: number;
    maxLife: number;
    isExpanding?: boolean;
    initialScale?: number;
    targetScale?: number;
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

    // Tracers group
    this.tracersGroup = new THREE.Group();
    this.tracersGroup.name = 'Weapon_BulletTracers';
    this.scene.add(this.tracersGroup);

    // Sparks and impact debris group
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
      top: 56px;
      right: 18px;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      background: rgba(14, 18, 16, 0.86);
      border: 1px solid rgba(201, 164, 104, 0.42);
      border-radius: 14px;
      color: #f2ece1;
      font-family: Georgia, serif;
      font-size: 12px;
      letter-spacing: 0.06em;
      pointer-events: none;
      z-index: 40;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
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
      <svg width="13" height="15" viewBox="0 0 14 20" fill="none" stroke="#e8c872" stroke-width="1.6">
        <path d="M4 8 L4 18 L10 18 L10 8 C10 4.5 7 1.5 7 1.5 C7 1.5 4 4.5 4 8 Z" fill="rgba(232,200,114,0.22)"/>
        <line x1="3" y1="18" x2="11" y2="18"/>
        <line x1="4" y1="11" x2="10" y2="11"/>
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

  private spawnBulletTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.25) return;

    // Bullet tracer geometry: slender cylindrical beam
    const geom = new THREE.CylinderGeometry(0.016, 0.016, len, 6);
    geom.translate(0, len / 2, 0); // origin at base
    geom.rotateX(Math.PI / 2); // align with +Z

    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(from);
    mesh.lookAt(to);

    this.tracersGroup.add(mesh);
    this.tracerRays.push({
      mesh,
      mat,
      life: 0.08,
      maxLife: 0.08,
    });
  }

  private detectSurfaceType(hitObj?: THREE.Object3D, hitPoint?: THREE.Vector3): 'stone' | 'wood' | 'water' {
    if (hitPoint && hitPoint.y <= 0.65) return 'water';
    let cur = hitObj;
    while (cur) {
      const name = (cur.name || '').toLowerCase();
      if (name.includes('water') || name.includes('lake') || name.includes('river')) return 'water';
      if (name.includes('wood') || name.includes('bridge') || name.includes('plank') || name.includes('tent') || name.includes('crate') || name.includes('log')) return 'wood';
      cur = cur.parent || undefined;
    }
    return 'stone';
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

    // 1. Play synthesized gunshot audio with canyon acoustic feedback
    this.audio.playGunshot();

    // 2. Trigger Muzzle Flash FX
    this.muzzleFlashTimer = 0.065;
    this.muzzleFlashLight.intensity = 15.0;
    (this.muzzleFlashQuad.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.muzzleFlashQuad.rotation.z = Math.random() * Math.PI * 2;

    // 3. Compute Muzzle Position in World Space
    const muzzlePos = new THREE.Vector3();
    this.muzzleFlashQuad.getWorldPosition(muzzlePos);

    // 4. Hitscan Ballistics via Raycaster from Camera Center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersects = this.raycaster.intersectObjects(collidables, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitPoint = hit.point;
      const hitNormal = hit.face
        ? hit.face.normal.clone().applyQuaternion(hit.object.quaternion)
        : new THREE.Vector3(0, 1, 0);

      const surface = this.detectSurfaceType(hit.object, hitPoint);
      this.spawnImpactDebris(hitPoint, hitNormal, surface);
      this.audio.playBulletImpact(surface);
      this.spawnBulletTracer(muzzlePos, hitPoint);
    } else {
      const endPoint = muzzlePos.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(65));
      this.spawnBulletTracer(muzzlePos, endPoint);
    }

    // 5. Trigger Physical Recoil Spring Kick
    if (this.onFireRecoil) {
      this.onFireRecoil();
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

  private spawnImpactDebris(pos: THREE.Vector3, normal: THREE.Vector3, surface: 'stone' | 'wood' | 'water'): void {
    if (surface === 'stone') {
      // 1. High-velocity incandescent ricochet sparks
      const sparkCount = 8;
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xffd266,
        blending: THREE.AdditiveBlending,
      });
      const sparkGeom = new THREE.SphereGeometry(0.018, 4, 4);

      for (let i = 0; i < sparkCount; i++) {
        const p = new THREE.Mesh(sparkGeom, sparkMat);
        p.position.copy(pos);
        this.sparksGroup.add(p);

        const spread = new THREE.Vector3(
          (Math.random() - 0.5) * 2.2,
          (Math.random() - 0.5) * 2.2,
          (Math.random() - 0.5) * 2.2
        );
        const vel = normal.clone().multiplyScalar(4.5 + Math.random() * 3.5).add(spread);

        this.sparkParticles.push({
          mesh: p,
          vel,
          life: 0.28 + Math.random() * 0.18,
          maxLife: 0.46,
        });
      }

      // 2. Expanding Andean mineral dust clouds
      const dustCount = 4;
      const dustGeom = new THREE.SphereGeometry(0.06, 6, 6);
      for (let i = 0; i < dustCount; i++) {
        const dustMat = new THREE.MeshBasicMaterial({
          color: 0xcdba9e,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        });
        const p = new THREE.Mesh(dustGeom, dustMat);
        p.position.copy(pos).add(normal.clone().multiplyScalar(0.04));
        this.sparksGroup.add(p);

        const vel = normal.clone().multiplyScalar(0.6 + Math.random() * 0.8).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8)
        );

        this.sparkParticles.push({
          mesh: p,
          mat: dustMat,
          vel,
          life: 0.42 + Math.random() * 0.22,
          maxLife: 0.64,
          isExpanding: true,
          initialScale: 1.0,
          targetScale: 3.4,
        });
      }
    } else if (surface === 'wood') {
      // 1. Tumbling timber splinter shards
      const splinterCount = 8;
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x5a3818,
        roughness: 0.85,
      });
      const splinterGeom = new THREE.BoxGeometry(0.012, 0.012, 0.052);

      for (let i = 0; i < splinterCount; i++) {
        const p = new THREE.Mesh(splinterGeom, woodMat);
        p.position.copy(pos);
        this.sparksGroup.add(p);

        const spread = new THREE.Vector3(
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0
        );
        const vel = normal.clone().multiplyScalar(3.0 + Math.random() * 2.5).add(spread);
        const rotVel = new THREE.Vector3(
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 25
        );

        this.sparkParticles.push({
          mesh: p,
          mat: woodMat,
          vel,
          rotVel,
          life: 0.38 + Math.random() * 0.22,
          maxLife: 0.6,
        });
      }

      // 2. Warm wood dust puff
      const dustGeom = new THREE.SphereGeometry(0.05, 5, 5);
      for (let i = 0; i < 3; i++) {
        const dustMat = new THREE.MeshBasicMaterial({
          color: 0xb59c7a,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        });
        const p = new THREE.Mesh(dustGeom, dustMat);
        p.position.copy(pos).add(normal.clone().multiplyScalar(0.03));
        this.sparksGroup.add(p);

        const vel = normal.clone().multiplyScalar(0.5 + Math.random() * 0.6).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)
        );

        this.sparkParticles.push({
          mesh: p,
          mat: dustMat,
          vel,
          life: 0.35 + Math.random() * 0.2,
          maxLife: 0.55,
          isExpanding: true,
          initialScale: 1.0,
          targetScale: 2.8,
        });
      }
    } else if (surface === 'water') {
      // 1. Water plume droplets
      const dropCount = 10;
      const dropMat = new THREE.MeshBasicMaterial({
        color: 0xddf4ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const dropGeom = new THREE.SphereGeometry(0.024, 4, 4);

      for (let i = 0; i < dropCount; i++) {
        const p = new THREE.Mesh(dropGeom, dropMat);
        p.position.copy(pos);
        this.sparksGroup.add(p);

        const spread = new THREE.Vector3(
          (Math.random() - 0.5) * 1.6,
          0,
          (Math.random() - 0.5) * 1.6
        );
        const vel = new THREE.Vector3(0, 3.2 + Math.random() * 2.8, 0).add(spread);

        this.sparkParticles.push({
          mesh: p,
          mat: dropMat,
          vel,
          life: 0.40 + Math.random() * 0.25,
          maxLife: 0.65,
        });
      }

      // 2. Expanding aquatic impact ripple ring
      const ringGeom = new THREE.RingGeometry(0.06, 0.16, 24);
      ringGeom.rotateX(-Math.PI / 2); // lie horizontal on water plane
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc8eeff,
        transparent: true,
        opacity: 0.70,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(pos.x, Math.max(pos.y, 0.55) + 0.02, pos.z);
      this.sparksGroup.add(ringMesh);

      this.sparkParticles.push({
        mesh: ringMesh,
        mat: ringMat,
        vel: new THREE.Vector3(0, 0, 0),
        life: 0.55,
        maxLife: 0.55,
        isExpanding: true,
        initialScale: 1.0,
        targetScale: 4.8,
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

    // Bullet Tracers decay
    for (let i = this.tracerRays.length - 1; i >= 0; i--) {
      const tr = this.tracerRays[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.tracersGroup.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mat.dispose();
        this.tracerRays.splice(i, 1);
      } else {
        tr.mat.opacity = (tr.life / tr.maxLife) * 0.90;
      }
    }

    // Surface impact debris & sparks simulation
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.sparksGroup.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        if (sp.mat && typeof (sp.mat as any).dispose === 'function') {
          (sp.mat as any).dispose();
        }
        this.sparkParticles.splice(i, 1);
        continue;
      }

      const lifeRatio = Math.max(0, sp.life / sp.maxLife);

      if (sp.isExpanding) {
        // Smooth radial expansion & opacity fade
        const progress = 1 - lifeRatio;
        const s = (sp.initialScale || 1.0) + ((sp.targetScale || 3.0) - (sp.initialScale || 1.0)) * progress;
        sp.mesh.scale.set(s, s, s);
        if (sp.mat && 'opacity' in sp.mat) {
          (sp.mat as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.65;
        }
        sp.mesh.position.addScaledVector(sp.vel, dt);
      } else {
        // Physical ballistic particle with gravity & tumbling
        sp.vel.y -= 10.5 * dt; // gravity
        sp.mesh.position.addScaledVector(sp.vel, dt);
        if (sp.rotVel) {
          sp.mesh.rotation.x += sp.rotVel.x * dt;
          sp.mesh.rotation.y += sp.rotVel.y * dt;
          sp.mesh.rotation.z += sp.rotVel.z * dt;
        }
        const scale = Math.max(0.001, lifeRatio);
        sp.mesh.scale.set(scale, scale, scale);
      }
    }

    // Keep weapon attached to current bone
    this.attachWeapon();
  }
}
