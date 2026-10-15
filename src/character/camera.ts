/**
 * Module: src/character/camera.ts
 * Responsibility: Third-person over-the-shoulder camera (behind and slightly above
 * Naira's right shoulder so she occupies the left third of the frame), 55–60° vertical
 * FOV, damped smoothing, terrain collision avoidance, Orbit Camera mode, and Photo Mode
 * camera per Bible §2.9 and §3.10.
 * Depends on: three, src/core/input.ts, src/world/terrain.ts.
 * Exports: CameraMode, OverTheShoulderCamera.
 */

import * as THREE from 'three';
import { InputState } from '../core/input';
import { TerrainSystem } from '../world/terrain';
import { LocomotionMode } from './naira';

export type CameraMode = 'overShoulder' | 'orbit' | 'photo' | 'vista' | 'shot';

// Preallocated module-scope vectors — zero per-frame allocations (§5.2 #1)
const _desiredPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _shoulderOffset = new THREE.Vector3();
const _lookOffset = new THREE.Vector3();
const _rotQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

export class OverTheShoulderCamera {
  public readonly camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'overShoulder';
  public yaw: number = Math.PI; // Facing North (-Z) along the valley
  public pitch: number = -0.06;
  public orbitDistance: number = 3.25;

  private readonly smoothedPos: THREE.Vector3 = new THREE.Vector3(0.55, 3.3, 12.2);
  private readonly smoothedLook: THREE.Vector3 = new THREE.Vector3(0.45, 2.9, 6.0);
  private targetRecenterYaw: number | null = null;
  private elapsedSec: number = 0;

  constructor(aspect: number = 16 / 9) {
    // §2.9 FOV: 55–60 degrees vertical (58° default, 60° traversal)
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.15, 320);
  }

  public recenter(targetYaw: number): void {
    this.targetRecenterYaw = targetYaw;
    this.pitch = -0.06;
  }

  public build(initialTarget: THREE.Vector3, initialYaw: number): void {
    this.yaw = initialYaw;
    this.pitch = -0.05;
    this.computeOverShoulderRig(initialTarget, 0);
    this.smoothedPos.copy(_desiredPos);
    this.smoothedLook.copy(_desiredLookAt);
    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }

  public setAspect(width: number, height: number): void {
    this.camera.aspect = Math.max(0.1, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  public setFov(fovDegrees: number): void {
    const clamped = Math.max(35, Math.min(75, fovDegrees));
    if (Math.abs(this.camera.fov - clamped) > 0.05) {
      this.camera.fov = clamped;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Computes over-the-shoulder camera transform placing Naira cleanly in the left
   * third of the frame with her full boots-to-head silhouette visible (§2.9):
   * - Never shows Naira's back filling the frame (distance ~ 3.2 m)
   * - Never cuts off her feet awkwardly
   */
  private computeOverShoulderRig(targetFootPos: THREE.Vector3, speed: number, locoMode: LocomotionMode = 'idle'): void {
    _rotQuat.setFromAxisAngle(_yAxis, this.yaw);

    if (locoMode === 'zipline') {
      // High-velocity zipline camera: pulled back with subtle aerodynamic wind shake
      const windShakeY = Math.sin(this.elapsedSec * 28.0) * 0.016;
      const windShakeX = Math.cos(this.elapsedSec * 22.0) * 0.014;
      _shoulderOffset.set(-0.92, 1.25 + windShakeY, -3.85 + windShakeX).applyQuaternion(_rotQuat);
      _desiredPos.copy(targetFootPos).add(_shoulderOffset);
      _lookOffset.set(-0.25, 1.25, 4.8).applyQuaternion(_rotQuat);
      _desiredLookAt.copy(targetFootPos).add(_lookOffset);
      return;
    }

    if (locoMode === 'climb' || locoMode === 'mantle') {
      // Intimate rock climbing framing
      _shoulderOffset.set(-0.65, 1.35, -2.45).applyQuaternion(_rotQuat);
      _desiredPos.copy(targetFootPos).add(_shoulderOffset);
      _lookOffset.set(-0.15, 1.55, 3.2).applyQuaternion(_rotQuat);
      _desiredLookAt.copy(targetFootPos).add(_lookOffset);
      return;
    }

    // Behind Naira (-Z in character local space) and offset to her right shoulder (-X in character local space)
    // so Naira sits in the left third of the frame while the world fills the right two-thirds (§2.9 & R1).
    const dist = 3.15 + (speed / 5.5) * 0.35;
    const height = 1.42 - Math.sin(this.pitch) * dist * 0.6 - (locoMode === 'vault' ? 0.16 : 0.0);
    _shoulderOffset.set(-0.78, height, -dist).applyQuaternion(_rotQuat);
    _desiredPos.copy(targetFootPos).add(_shoulderOffset);

    const lookPitchY = 1.12 + Math.sin(this.pitch) * 2.0;
    _lookOffset.set(-1.05, lookPitchY, 5.2).applyQuaternion(_rotQuat);
    _desiredLookAt.copy(targetFootPos).add(_lookOffset);
  }

  public snapToShot(
    camX: number,
    camY: number,
    camZ: number,
    lookX: number,
    lookY: number,
    lookZ: number,
    fov: number = 58
  ): void {
    this.mode = 'vista';
    this.setFov(fov);
    this.smoothedPos.set(camX, camY, camZ);
    this.smoothedLook.set(lookX, lookY, lookZ);
    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }

  public update(
    dt: number,
    input: InputState,
    targetFootPos: THREE.Vector3,
    targetSpeed: number,
    terrain: TerrainSystem,
    locoMode: LocomotionMode = 'idle'
  ): void {
    if (this.mode === 'vista') {
      return;
    }
    this.elapsedSec += dt;

    if (input.orbitTogglePressed) {
      this.mode = this.mode === 'orbit' ? 'overShoulder' : 'orbit';
    }

    if (Math.abs(input.lookDeltaX) > 0.001 || Math.abs(input.lookDeltaY) > 0.001) {
      this.targetRecenterYaw = null;
    }

    if (this.targetRecenterYaw !== null) {
      let diff = (this.targetRecenterYaw - this.yaw) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.03) {
        this.yaw = this.targetRecenterYaw;
        this.targetRecenterYaw = null;
      } else {
        this.yaw += diff * Math.min(1.0, dt * 10.0);
      }
    }

    this.yaw -= input.lookDeltaX * 0.008;
    this.pitch = Math.max(-0.55, Math.min(0.48, this.pitch - input.lookDeltaY * 0.006));

    const targetFov =
      locoMode === 'zipline'
        ? 68
        : locoMode === 'climb' || locoMode === 'mantle'
        ? 55
        : targetSpeed > 3.5
        ? 60
        : 58;
    this.setFov(this.camera.fov + (targetFov - this.camera.fov) * Math.min(1, dt * 5));

    if (this.mode === 'orbit' || this.mode === 'photo') {
      const r = this.orbitDistance;
      const cosP = Math.cos(this.pitch);
      _desiredPos.set(
        targetFootPos.x + Math.sin(this.yaw) * cosP * r,
        targetFootPos.y + 1.15 - Math.sin(this.pitch) * r,
        targetFootPos.z + Math.cos(this.yaw) * cosP * r
      );
      _desiredLookAt.set(targetFootPos.x, targetFootPos.y + 1.05, targetFootPos.z);
    } else {
      this.computeOverShoulderRig(targetFootPos, targetSpeed, locoMode);
    }

    const minGroundY = terrain.getTerrainHeightAt(_desiredPos.x, _desiredPos.z) + 0.45;
    if (_desiredPos.y < minGroundY) {
      _desiredPos.y = minGroundY;
    }

    const alpha = Math.min(1.0, dt * 11.0);
    this.smoothedPos.lerp(_desiredPos, alpha);
    this.smoothedLook.lerp(_desiredLookAt, alpha);

    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }

  public dispose(): void {
    // Camera has no GPU buffers to release
  }
}
