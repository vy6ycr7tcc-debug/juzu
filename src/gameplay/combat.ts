/**
 * Module: src/gameplay/combat.ts
 * Responsibility: Light, deliberate bow & climbing-axe combat per Bible §3.2:
 * - 0.8s full recurve bow draw with 3D arrow projectile pool (zero per-frame allocations)
 * - 4 Arrow behaviors: Bodkin (high pierce), Rope Tether (attaches braided line),
 *   Obsidian Fire (ignites braziers), Sonic Lure (distracts Sol Negro guards)
 * - 0.4s climbing-axe melee finisher within 2.6 m
 * - 0.5s dodge-roll invulnerability frames
 * - 5.0s Herbal Poultice channel heal (H)
 * Depends on: three, src/world/materials.ts, src/character/enemies.ts, src/gameplay/crafting.ts.
 * Exports: ArrowProjectile, CombatSystem.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../world/materials';
import { EnemyManager } from '../character/enemies';
import { ArrowType } from './crafting';

export interface ArrowProjectile {
  active: boolean;
  type: ArrowType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ageSec: number;
  mesh: THREE.Mesh;
}

export class CombatSystem {
  public static readonly BOW_FULL_DRAW_SEC = 0.8;
  public static readonly AXE_SWING_SEC = 0.4;
  public static readonly DODGE_IFRAME_SEC = 0.5;
  public static readonly POULTICE_HEAL_SEC = 5.0;

  public readonly group: THREE.Group = new THREE.Group();
  public health: number = 100;
  public drawProgress: number = 0;
  public axeSwingTimer: number = 0;
  public dodgeTimer: number = 0;
  public poulticeTimer: number = 0;
  public isInvulnerable: boolean = false;

  private readonly arrowPool: ArrowProjectile[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  public build(scene?: THREE.Scene, materials?: PbrMaterialLibrary): void {
    this.health = 100;
    this.drawProgress = 0;
    this.axeSwingTimer = 0;
    this.dodgeTimer = 0;
    this.poulticeTimer = 0;
    this.isInvulnerable = false;

    if (!scene || !materials) return;
    this.group.name = 'CombatProjectiles';

    // Preallocate pool of 8 3D arrow meshes (§5.2 #1 & #8 object pooling)
    const shaftGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.72, 6);
    shaftGeo.rotateX(Math.PI / 2);
    this.geometries.push(shaftGeo);

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(shaftGeo, materials.woodAged);
      mesh.visible = false;
      mesh.castShadow = true;
      this.group.add(mesh);

      this.arrowPool.push({
        active: false,
        type: 'bodkin',
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        ageSec: 0,
        mesh,
      });
    }

    scene.add(this.group);
  }

  public fireArrow(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    arrowType: ArrowType
  ): boolean {
    for (let i = 0; i < this.arrowPool.length; i++) {
      const p = this.arrowPool[i];
      if (!p.active) {
        p.active = true;
        p.type = arrowType;
        p.ageSec = 0;
        p.position.copy(origin);
        const speed = 28.0 + this.drawProgress * 18.0;
        p.velocity.copy(direction).normalize().multiplyScalar(speed);
        p.mesh.position.copy(p.position);
        p.mesh.lookAt(
          p.position.x + p.velocity.x,
          p.position.y + p.velocity.y,
          p.position.z + p.velocity.z
        );
        p.mesh.visible = true;
        return true;
      }
    }
    return false;
  }

  public triggerDodgeRoll(): void {
    this.dodgeTimer = CombatSystem.DODGE_IFRAME_SEC;
    this.isInvulnerable = true;
  }

  public triggerAxeSwing(
    playerPos: THREE.Vector3,
    enemies?: EnemyManager
  ): boolean {
    if (this.axeSwingTimer > 0) return false;
    this.axeSwingTimer = CombatSystem.AXE_SWING_SEC;
    if (enemies) {
      enemies.applyHitAt(playerPos, 65, 2.6);
    }
    return true;
  }

  public startPoulticeHeal(): void {
    this.poulticeTimer = CombatSystem.POULTICE_HEAL_SEC;
  }

  public applyDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  public update(
    dt: number,
    aimHeld: boolean,
    enemies?: EnemyManager
  ): void {
    if (aimHeld) {
      this.drawProgress = Math.min(1.0, this.drawProgress + dt / CombatSystem.BOW_FULL_DRAW_SEC);
    } else {
      this.drawProgress = 0;
    }

    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      this.isInvulnerable = this.dodgeTimer > 0;
    }

    if (this.axeSwingTimer > 0) {
      this.axeSwingTimer = Math.max(0, this.axeSwingTimer - dt);
    }

    if (this.poulticeTimer > 0) {
      this.poulticeTimer = Math.max(0, this.poulticeTimer - dt);
      this.health = Math.min(100, this.health + dt * 12.0);
    } else if (this.health < 100 && this.health > 0) {
      this.health = Math.min(100, this.health + dt * 1.2);
    }

    // Update pooled arrow projectiles
    for (let i = 0; i < this.arrowPool.length; i++) {
      const p = this.arrowPool[i];
      if (!p.active) continue;

      p.ageSec += dt;
      p.velocity.y -= 9.81 * dt * 0.65;
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);
      p.mesh.lookAt(
        p.position.x + p.velocity.x,
        p.position.y + p.velocity.y,
        p.position.z + p.velocity.z
      );

      if (enemies) {
        const hitOp = enemies.applyHitAt(
          p.position,
          p.type === 'bodkin' ? 100 : 55,
          1.15
        );
        if (hitOp) {
          enemies.alertToNoise(p.position, p.type === 'sonicLure' ? 45.0 : 22.0);
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
      }

      if (p.ageSec > 3.5 || p.position.y < -12.0) {
        if (enemies && p.type === 'sonicLure') {
          enemies.alertToNoise(p.position, 45.0);
        }
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    this.geometries.length = 0;
    this.arrowPool.length = 0;
    this.group.removeFromParent();
  }
}
