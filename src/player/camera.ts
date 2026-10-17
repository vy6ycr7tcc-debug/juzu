import * as THREE from 'three/webgpu';
import { standAt } from '../world/terrain';

export class FollowCamera {
  yaw = 0;
  pitch = 0.28;
  dist = 5.5;

  private target = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private effDist = 5.5;
  public sensitivity = 1.0;
  public invertY = false;

  constructor(public camera: THREE.PerspectiveCamera) {
    this.currentPos.set(0, 4, 10);
  }

  public update(playerPos: THREE.Vector3, lookDelta: { x: number; y: number }, dt: number): void {
    // 1. Process look inputs
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= lookDelta.x * sens;
    const dy = (this.invertY ? -lookDelta.y : lookDelta.y) * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.25, 1.15);

    // 2. Smoothly follow player target (chest height ≈ 1.3m)
    const targetGoal = playerPos.clone().add(new THREE.Vector3(0, 1.35, 0));
    this.target.lerp(targetGoal, Math.min(1, dt * 14));

    // 3. Compute spherical offset
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const dir = new THREE.Vector3(
      sinYaw * cosPitch,
      sinPitch,
      cosYaw * cosPitch
    ).normalize();

    // 4. Collision check against terrain ground
    let safeDist = this.dist;
    const testSteps = 12;
    for (let i = 1; i <= testSteps; i++) {
      const stepDist = (this.dist * i) / testSteps;
      const testPoint = this.target.clone().addScaledVector(dir, stepDist);
      const groundH = standAt(testPoint.x, testPoint.z);
      if (testPoint.y < groundH + 0.35) {
        safeDist = Math.max(1.8, stepDist - 0.4);
        break;
      }
    }

    this.effDist = THREE.MathUtils.lerp(this.effDist, safeDist, Math.min(1, dt * 12));

    const camGoal = this.target.clone().addScaledVector(dir, this.effDist);
    // Ensure camera never penetrates below ground
    const camGround = standAt(camGoal.x, camGoal.z);
    if (camGoal.y < camGround + 0.4) {
      camGoal.y = camGround + 0.4;
    }

    this.currentPos.lerp(camGoal, Math.min(1, dt * 16));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.target);
  }

  public teleport(pos: THREE.Vector3): void {
    this.target.copy(pos).add(new THREE.Vector3(0, 1.35, 0));
    const dir = new THREE.Vector3(Math.sin(this.yaw), Math.sin(this.pitch), Math.cos(this.yaw)).normalize();
    this.currentPos.copy(this.target).addScaledVector(dir, this.dist);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.target);
  }
}
