import * as THREE from 'three/webgpu';
import { standAt } from '../world/terrain';
import { solidity } from '../world/solidity';

export class FollowCamera {
  yaw = 0;
  pitch = 0.16;
  baseDist = 7.4;
  dist = 7.4;
  shoulderOffset = 0.52;

  private target = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private leadOffset = new THREE.Vector3();
  private effDist = 7.4;
  private landingDip = 0;
  private landingDipVel = 0;
  private stridePhase = 0;
  public sensitivity = 1.0;
  public invertY = false;

  constructor(public camera: THREE.PerspectiveCamera) {
    this.currentPos.set(0, 7.4, 17.4);
  }

  public adjustDistance(delta: number): void {
    this.baseDist = THREE.MathUtils.clamp(this.baseDist + delta, 4.2, 14.0);
  }

  public triggerLandingDip(impactSpeed: number): void {
    this.landingDipVel -= Math.min(2.4, impactSpeed * 0.24);
  }

  public update(
    playerPos: THREE.Vector3,
    lookDelta: { x: number; y: number },
    dt: number,
    isSprinting: boolean = false,
    isCrouching: boolean = false,
    isInstinct: boolean = false,
    playerVel?: THREE.Vector3,
    isGrounded: boolean = true
  ): void {
    // 1. Process look inputs
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= lookDelta.x * sens;
    const dy = (this.invertY ? -lookDelta.y : lookDelta.y) * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.32, 1.15);

    // 2. Landing spring dip
    this.landingDipVel += (-this.landingDip * 42 - this.landingDipVel * 9.5) * dt;
    this.landingDip += this.landingDipVel * dt;

    // 3. Dynamic Distance & FOV Kick
    const targetDist = isSprinting
      ? this.baseDist + 1.25
      : isCrouching
        ? Math.max(4.2, this.baseDist - 0.95)
        : this.baseDist;
    this.dist = THREE.MathUtils.lerp(this.dist, targetDist, Math.min(1, dt * 5));

    const targetFov = isInstinct ? 46 : isSprinting ? 58 : isCrouching ? 48 : 52;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 8));
      this.camera.updateProjectionMatrix();
    }

    // 4. Velocity Lead-Ahead & Grounded Footstep Cadence Micro-Bob
    const speedHoriz = playerVel ? Math.hypot(playerVel.x, playerVel.z) : 0;
    const leadScale = this.dist < 2.5 ? 0.0 : 0.07;
    const goalLeadX = playerVel ? THREE.MathUtils.clamp(playerVel.x * leadScale, -0.45, 0.45) : 0;
    const goalLeadZ = playerVel ? THREE.MathUtils.clamp(playerVel.z * leadScale, -0.45, 0.45) : 0;
    this.leadOffset.x = THREE.MathUtils.lerp(this.leadOffset.x, goalLeadX, Math.min(1, dt * 6));
    this.leadOffset.z = THREE.MathUtils.lerp(this.leadOffset.z, goalLeadZ, Math.min(1, dt * 6));

    let cadenceBobY = 0;
    if (isGrounded && speedHoriz > 0.35 && this.dist >= 2.0) {
      this.stridePhase += dt * (isSprinting ? 13.5 : 8.8);
      const bobAmp = isSprinting ? 0.022 : 0.011;
      cadenceBobY = Math.sin(this.stridePhase) * bobAmp * Math.min(1, speedHoriz / 3.0);
    }

    // 5. Over-the-Shoulder Target Framing (places Naira in left-center third of viewport)
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    // Reduce shoulder offset if zoomed in close or in wide vista mode
    const activeShoulder =
      this.dist < 2.5 ? 0.0 : this.dist > 9.0 ? this.shoulderOffset * 0.35 : this.shoulderOffset;
    const eyeHeight = (isCrouching ? 1.18 : 1.54) + this.landingDip + cadenceBobY;

    const targetGoal = new THREE.Vector3(
      playerPos.x + rightX * activeShoulder + this.leadOffset.x,
      playerPos.y + eyeHeight,
      playerPos.z + rightZ * activeShoulder + this.leadOffset.z
    );
    this.target.lerp(targetGoal, Math.min(1, dt * 15));

    // 6. Compute spherical offset
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);

    const dir = new THREE.Vector3(
      sinYaw * cosPitch,
      sinPitch,
      cosYaw * cosPitch
    ).normalize();

    // 7. Collision check against terrain ground & solid masonry raycast
    let safeDist = this.dist;
    const hitDist = solidity.ray(this.target, dir, this.dist);
    if (hitDist < safeDist) {
      safeDist = Math.max(1.3, hitDist - 0.32);
    }

    const testSteps = 14;
    for (let i = 1; i <= testSteps; i++) {
      const stepDist = (safeDist * i) / testSteps;
      const testPoint = this.target.clone().addScaledVector(dir, stepDist);
      const groundH = standAt(testPoint.x, testPoint.z);
      if (testPoint.y < groundH + 0.4) {
        safeDist = Math.max(1.3, stepDist - 0.4);
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
    const activeShoulder =
      this.dist < 2.2 ? 0.0 : this.dist > 7.2 ? this.shoulderOffset * 0.4 : this.shoulderOffset;
    this.leadOffset.set(0, 0, 0);
    this.target.set(
      pos.x + rightX * activeShoulder,
      pos.y + 1.54,
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
