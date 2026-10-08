import * as THREE from 'three';
import { getGlobalTerrainHeight } from './terrain.js';
import type { PhysicsSystem } from './physics.js';
import type { StealthSystem } from './combat/stealth.js';

// ============================================================================
// Survival Recurve Bow & Ballistic Arrow System (Shadow of the Tomb Raider North Star)
//
// 1. Ballistic projectile flight with gravity and aerodynamic orientation.
// 2. Continuous swept collision against terrain, structures, and colliders.
// 3. Arrow penetration and surface sticking with impact debris.
// 4. Dynamic Inca survival aiming crosshair overlay.
// ============================================================================

export interface ArrowProjectile {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  isStuck: boolean;
  stuckLife: number;
  hitTarget?: any;
}

export class BowSystem {
  private scene: THREE.Scene;
  private arrows: ArrowProjectile[] = [];
  private maxStuckArrows = 24;

  // Impact particle system
  private particleGroup: THREE.Group;
  private particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];

  // Reusable materials (strictly dielectric PBR)
  private arrowShaftMat: THREE.MeshStandardMaterial;
  private arrowHeadMat: THREE.MeshStandardMaterial;
  private fletchMat1: THREE.MeshStandardMaterial;
  private fletchMat2: THREE.MeshStandardMaterial;
  private splinterMat: THREE.MeshStandardMaterial;

  // Aim crosshair HUD element
  private crosshairCanvas: HTMLCanvasElement | null = null;
  private crosshairCtx: CanvasRenderingContext2D | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.arrowShaftMat = new THREE.MeshStandardMaterial({
      color: 0x5a422e, // Weathered Andean birch
      roughness: 0.85,
      metalness: 0.0,
      envMapIntensity: 0.25,
    });

    this.arrowHeadMat = new THREE.MeshStandardMaterial({
      color: 0x222224, // Chipped volcanic obsidian
      roughness: 0.75,
      metalness: 0.0,
      envMapIntensity: 0.35,
    });

    this.fletchMat1 = new THREE.MeshStandardMaterial({
      color: 0x8a2b20, // Andean crimson turkey feather
      roughness: 0.7,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.fletchMat2 = new THREE.MeshStandardMaterial({
      color: 0xd4a34b, // Inca gold feather accent
      roughness: 0.7,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.splinterMat = new THREE.MeshStandardMaterial({
      color: 0x8c6d48,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.initCrosshairHUD();
  }

  private initCrosshairHUD() {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.id = 'bow-crosshair';
    canvas.width = 256;
    canvas.height = 256;
    canvas.style.position = 'fixed';
    canvas.style.top = '50%';
    canvas.style.left = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '50';
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    this.crosshairCanvas = canvas;
    this.crosshairCtx = canvas.getContext('2d');
  }

  public setAimHUD(visible: boolean, drawTension: number = 0) {
    if (!this.crosshairCanvas || !this.crosshairCtx) return;
    if (!visible) {
      this.crosshairCanvas.style.display = 'none';
      return;
    }

    this.crosshairCanvas.style.display = 'block';
    const ctx = this.crosshairCtx;
    ctx.clearRect(0, 0, 256, 256);

    const cx = 128, cy = 128;
    const tension = THREE.MathUtils.clamp(drawTension, 0, 1);

    // Outer aiming arc radius (collapses inward as string is drawn tight)
    const arcRadius = THREE.MathUtils.lerp(38, 14, tension);

    // Warm Inca gold / amber survival reticle
    ctx.save();
    ctx.strokeStyle = `rgba(240, 180, 50, ${0.45 + tension * 0.45})`;
    ctx.fillStyle = `rgba(255, 230, 160, ${0.7 + tension * 0.3})`;
    ctx.lineWidth = 1.8;

    // Center focal dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 4 cardinal tick marks
    const tickLen = 5;
    ctx.beginPath();
    // Top
    ctx.moveTo(cx, cy - arcRadius - tickLen);
    ctx.lineTo(cx, cy - arcRadius);
    // Bottom
    ctx.moveTo(cx, cy + arcRadius);
    ctx.lineTo(cx, cy + arcRadius + tickLen);
    // Left
    ctx.moveTo(cx - arcRadius - tickLen, cy);
    ctx.lineTo(cx - arcRadius, cy);
    // Right
    ctx.moveTo(cx + arcRadius, cy);
    ctx.lineTo(cx + arcRadius + tickLen, cy);
    ctx.stroke();

    // Dual tension brackets
    const bracketAngle = Math.PI * 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, -bracketAngle, bracketAngle);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, Math.PI - bracketAngle, Math.PI + bracketAngle);
    ctx.stroke();

    ctx.restore();
  }

  public createArrowMesh(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Arrow';

    // Shaft (0.72m long, 8mm thick)
    // Local Z axis is flight direction (+Z forward, -Z nock)
    const shaftGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.72, 8);
    shaftGeo.rotateX(Math.PI / 2);
    const shaft = new THREE.Mesh(shaftGeo, this.arrowShaftMat);
    shaft.castShadow = true;
    group.add(shaft);

    // Obsidian Arrowhead at +Z tip (+0.38m)
    const headGeo = new THREE.ConeGeometry(0.012, 0.045, 6);
    headGeo.rotateX(Math.PI / 2);
    const head = new THREE.Mesh(headGeo, this.arrowHeadMat);
    head.position.set(0, 0, 0.38);
    head.castShadow = true;
    group.add(head);

    // 3 Turkey feather fletchings at -Z rear (-0.28m)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const fGeo = new THREE.PlaneGeometry(0.02, 0.09);
      fGeo.rotateX(Math.PI / 2);
      const fMesh = new THREE.Mesh(fGeo, i === 0 ? this.fletchMat2 : this.fletchMat1);
      fMesh.position.set(Math.cos(angle) * 0.008, Math.sin(angle) * 0.008, -0.28);
      fMesh.rotation.z = angle;
      group.add(fMesh);
    }

    return group;
  }

  public spawnArrow(origin: THREE.Vector3, direction: THREE.Vector3, speed: number): ArrowProjectile {
    const mesh = this.createArrowMesh();
    mesh.position.copy(origin);

    const normDir = direction.clone().normalize();
    // Align arrow +Z with launch direction
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normDir);

    this.scene.add(mesh);

    const arrow: ArrowProjectile = {
      mesh,
      velocity: normDir.multiplyScalar(speed),
      isStuck: false,
      stuckLife: 0,
    };

    this.arrows.push(arrow);
    return arrow;
  }

  private spawnImpactSparks(pos: THREE.Vector3, normal: THREE.Vector3) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.012, 0.012, 0.012);
      const mesh = new THREE.Mesh(geo, this.splinterMat);
      mesh.position.copy(pos);
      this.particleGroup.add(mesh);

      const spread = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * 1.5,
        normal.y + Math.random() * 1.2,
        normal.z + (Math.random() - 0.5) * 1.5
      ).normalize().multiplyScalar(2.0 + Math.random() * 3.5);

      this.particles.push({
        mesh,
        velocity: spread,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.35,
      });
    }
  }

  public update(dt: number, physics?: PhysicsSystem, stealthSystem?: StealthSystem) {
    const gravity = -9.81;

    // 1. Update in-flight and stuck arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];

      if (a.isStuck) {
        a.stuckLife += dt;
        // Clean up ancient stuck arrows (30s lifetime)
        if (a.stuckLife > 30.0) {
          this.scene.remove(a.mesh);
          this.arrows.splice(i, 1);
        }
        continue;
      }

      // Ballistic flight step
      const currentPos = a.mesh.position.clone();
      const stepVel = a.velocity.clone().multiplyScalar(dt);
      const nextPos = currentPos.clone().add(stepVel);
      const flightDist = stepVel.length();
      const flightDir = a.velocity.clone().normalize();

      // Continuous collision check against sentries, terrain, and physics colliders
      let hit = false;
      let hitSentry = false;
      const hitPoint = new THREE.Vector3();
      const hitNormal = new THREE.Vector3(0, 1, 0);

      // Check collision with enemy sentries (headshots & body hits)
      if (stealthSystem && flightDist > 0.001) {
        const sentryHit = stealthSystem.checkArrowHits(currentPos, flightDist, flightDir);
        if (sentryHit.hit && sentryHit.sentry) {
          hit = true;
          hitSentry = true;
          hitPoint.copy(currentPos).addScaledVector(flightDir, 0.4);
          sentryHit.sentry.takeDamage(sentryHit.isHeadshot ? 999 : 60, sentryHit.isHeadshot);
          this.spawnImpactSparks(hitPoint, flightDir.clone().negate());
        }
      }

      // Check physics raycast
      if (!hit && physics && flightDist > 0.001) {
        const physHitDist = physics.raycastDown(
          currentPos.x,
          currentPos.y,
          currentPos.z,
          flightDist,
          undefined
        );
        if (physHitDist !== null && physHitDist <= flightDist) {
          hit = true;
          hitPoint.copy(currentPos).addScaledVector(flightDir, physHitDist);
        }
      }

      // Check terrain heightfield collision
      const groundAtNext = getGlobalTerrainHeight(nextPos.x, nextPos.z);
      if (!hit && nextPos.y <= groundAtNext + 0.05) {
        hit = true;
        hitPoint.set(nextPos.x, groundAtNext, nextPos.z);
        // Estimate terrain normal
        const eps = 0.1;
        const hx = getGlobalTerrainHeight(nextPos.x + eps, nextPos.z);
        const hz = getGlobalTerrainHeight(nextPos.x, nextPos.z + eps);
        hitNormal.set(groundAtNext - hx, eps, groundAtNext - hz).normalize();
      }

      if (hit) {
        // Arrow penetrates 12cm into surface and embeds
        a.isStuck = true;
        a.mesh.position.copy(hitPoint).addScaledVector(flightDir, 0.12);
        a.velocity.set(0, 0, 0);
        this.spawnImpactSparks(hitPoint, hitNormal);

        // Acoustic Arrow-Lure: impact clatter broadcasts noise to attract nearby sentries
        if (!hitSentry && stealthSystem) {
          stealthSystem.broadcastAcousticDistraction(hitPoint, 24.0);
        }

        // Limit maximum stuck arrows
        const stuckCount = this.arrows.filter(x => x.isStuck).length;
        if (stuckCount > this.maxStuckArrows) {
          const oldest = this.arrows.find(x => x.isStuck);
          if (oldest) {
            this.scene.remove(oldest.mesh);
            const idx = this.arrows.indexOf(oldest);
            if (idx >= 0) this.arrows.splice(idx, 1);
          }
        }
      } else {
        // Move arrow and apply gravity
        a.mesh.position.copy(nextPos);
        a.velocity.y += gravity * dt;
        // Orient arrow along new trajectory
        if (a.velocity.lengthSq() > 0.01) {
          a.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            a.velocity.clone().normalize()
          );
        }
      }
    }

    // 2. Update impact debris particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y += gravity * 1.5 * dt;
      p.mesh.rotation.x += dt * 8.0;
      p.mesh.rotation.y += dt * 6.0;
      const scale = 1.0 - p.life / p.maxLife;
      p.mesh.scale.setScalar(scale);
    }
  }

  public dispose() {
    for (const a of this.arrows) {
      this.scene.remove(a.mesh);
    }
    this.arrows = [];
    if (this.crosshairCanvas && this.crosshairCanvas.parentElement) {
      this.crosshairCanvas.parentElement.removeChild(this.crosshairCanvas);
    }
  }
}
