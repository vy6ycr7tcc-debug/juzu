import * as THREE from 'three/webgpu';
import { standAt } from '../world/terrain';
import { solidity } from '../world/solidity';

export class FollowCamera {
  yaw = 0;
  pitch = 0.20;
  dist = 3.1;
  shoulderOffset = 0.34;

  private target = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private effDist = 3.1;
  private landingDip = 0;
  private landingDipVel = 0;
  public sensitivity = 1.0;
  public invertY = false;

  constructor(public camera: THREE.PerspectiveCamera) {
    this.currentPos.set(0, 5.8, 13.1);
  }

  public triggerLandingDip(impactSpeed: number): void {
    this.landingDipVel -= Math.min(2.2, impactSpeed * 0.22);
  }

  public update(
    playerPos: THREE.Vector3,
    lookDelta: { x: number; y: number },
    dt: number,
    isSprinting: boolean = false,
    isCrouching: boolean = false,
    isInstinct: boolean = false
  ): void {
    // 1. Process look inputs
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= lookDelta.x * sens;
    const dy = (this.invertY ? -lookDelta.y : lookDelta.y) * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.32, 1.15);

    // 2. Landing spring dip
    this.landingDipVel += (-this.landingDip * 42 - this.landingDipVel * 9.5) * dt;
    this.landingDip += this.landingDipVel * dt;

    // 3. Dynamic FOV Kick (52° normal -> 59° sprinting -> 46° Survival Instinct / Crouch)
    const targetFov = isInstinct ? 46 : isSprinting ? 59 : isCrouching ? 48 : 52;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 8));
      this.camera.updateProjectionMatrix();
    }

    // 4. Over-the-Shoulder Target Framing (places Naira in left-center third of viewport)
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    // Camera right vector in horizontal plane
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    // Reduce shoulder offset if zoomed in close or in wide vista mode
    const activeShoulder = this.dist < 1.8 || this.dist > 6.0 ? 0.0 : this.shoulderOffset;
    const eyeHeight = (isCrouching ? 1.12 : 1.50) + this.landingDip;

    const targetGoal = new THREE.Vector3(
      playerPos.x + rightX * activeShoulder,
      playerPos.y + eyeHeight,
      playerPos.z + rightZ * activeShoulder
    );
    this.target.lerp(targetGoal, Math.min(1, dt * 15));

    // 5. Compute spherical offset
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);

    const dir = new THREE.Vector3(
      sinYaw * cosPitch,
      sinPitch,
      cosYaw * cosPitch
    ).normalize();

    // 6. Collision check against terrain ground & solid masonry raycast
    let safeDist = this.dist;
    const hitDist = solidity.ray(this.target, dir, this.dist);
    if (hitDist < safeDist) {
      safeDist = Math.max(1.1, hitDist - 0.28);
    }

    const testSteps = 12;
    for (let i = 1; i <= testSteps; i++) {
      const stepDist = (safeDist * i) / testSteps;
      const testPoint = this.target.clone().addScaledVector(dir, stepDist);
      const groundH = standAt(testPoint.x, testPoint.z);
      if (testPoint.y < groundH + 0.35) {
        safeDist = Math.max(1.1, stepDist - 0.35);
        break;
      }
    }

    this.effDist = THREE.MathUtils.lerp(this.effDist, safeDist, Math.min(1, dt * 12));

    const camGoal = this.target.clone().addScaledVector(dir, this.effDist);
    solidity.pushBall(camGoal, 0.25);

    const camGround = standAt(camGoal.x, camGoal.z);
    if (camGoal.y < camGround + 0.4) {
      camGoal.y = camGround + 0.4;
    }

    this.currentPos.lerp(camGoal, Math.min(1, dt * 16));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.target);
  }

  public teleport(pos: THREE.Vector3): void {
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const activeShoulder = this.dist < 1.8 || this.dist > 6.0 ? 0.0 : this.shoulderOffset;
    this.target.set(
      pos.x + rightX * activeShoulder,
      pos.y + 1.50,
      pos.z + rightZ * activeShoulder
    );
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
    this.effDist = this.dist;
    this.currentPos.copy(this.target).addScaledVector(dir, this.dist);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.target);
  }
}
