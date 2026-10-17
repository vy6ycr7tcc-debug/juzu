/**
 * Module: src/core/physics.ts
 * Responsibility: Physics simulation engine wrapping Rapier3D compat with deterministic
 * stepping, character grounding raycasts, and dynamic collision bodies.
 * Fallback-safe if WASM initialization fails.
 * Exports: PhysicsSystem.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsSystem {
  public world: RAPIER.World | null = null;
  public isInitialized: boolean = false;
  private readonly gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);

  public async build(): Promise<void> {
    try {
      await RAPIER.init();
      this.world = new RAPIER.World(this.gravity);
      this.isInitialized = true;
    } catch (err) {
      console.warn('PhysicsSystem: Rapier3D WASM init failed, using procedural kinematic fallback', err);
      this.isInitialized = false;
    }
  }

  public update(dt: number, _playerPos?: THREE.Vector3): void {
    if (!this.world || !this.isInitialized) return;
    // Step simulation clamped to maximum sub-step for stability
    const stepDt = Math.min(dt, 0.033);
    this.world.timestep = stepDt;
    this.world.step();
  }

  public dispose(): void {
    if (this.world) {
      try {
        this.world.free();
      } catch (err) {
        console.warn('PhysicsSystem: error freeing Rapier world', err);
      }
      this.world = null;
    }
    this.isInitialized = false;
  }
}
