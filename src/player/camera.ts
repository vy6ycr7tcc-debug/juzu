import * as THREE from 'three/webgpu';
import { standAt } from '../world/terrain';
import { solidity } from '../world/solidity';

export class FollowCamera {
  private _yaw = 0;
  private _pitch = 0.12;
  targetYaw = 0;
  targetPitch = 0.12;
  baseDist = 7.4;
  dist = 7.4;
  shoulderOffset = 0.38;

  get yaw(): number {
    return this._yaw;
  }
  set yaw(v: number) {
    this._yaw = v;
    this.targetYaw = v;
  }

  get pitch(): number {
    return this._pitch;
  }
  set pitch(v: number) {
    this._pitch = v;
    this.targetPitch = v;
  }

  private target = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private leadOffset = new THREE.Vector3();
  private effDist = 7.4;
  private landingDip = 0;
  private landingDipVel = 0;
  private recoilPitch = 0;
  private recoilPitchVel = 0;
  private recoilYaw = 0;
  private recoilYawVel = 0;
  private stridePhase = 0;
  public sensitivity = 1.0;
  public invertY = false;

  constructor(public camera: THREE.PerspectiveCamera) {
    this.targetYaw = this._yaw;
    this.targetPitch = this._pitch;
    this.currentPos.set(0, 4.2, 11.5);
  }

  public adjustDistance(delta: number): void {
    this.baseDist = THREE.MathUtils.clamp(this.baseDist + delta, 3.0, 10.0);
  }

  public triggerLandingDip(impactSpeed: number): void {
    this.landingDipVel -= Math.min(2.4, impactSpeed * 0.24);
  }

  public triggerRecoilKick(pitchDelta: number = 0.038, yawDelta: number = 0): void {
    this.recoilPitchVel += pitchDelta * 22;
    this.recoilYawVel += yawDelta * 22;
  }

  public update(
    playerPos: THREE.Vector3,
    lookDelta: { x: number; y: number },
    dt: number,
    isSprinting: boolean = false,
    isCrouching: boolean = false,
    isInstinct: boolean = false,
    playerVel?: THREE.Vector3,
    isGrounded: boolean = true,
    isAiming: boolean = false
  ): void {
    // 1. Process look inputs with smooth interpolation to eliminate touch/mouse micro-jitter
    const sens = 0.0022 * this.sensitivity;
    this.targetYaw -= lookDelta.x * sens;
    const dy = (this.invertY ? -lookDelta.y : lookDelta.y) * sens;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy, -0.32, 1.15);

    const lookBlend = Math.min(1, dt * 26);
    this._yaw = THREE.MathUtils.lerp(this._yaw, this.targetYaw, lookBlend);
    this._pitch = THREE.MathUtils.lerp(this._pitch, this.targetPitch, lookBlend);

    // 2. Landing spring dip
    this.landingDipVel += (-this.landingDip * 42 - this.landingDipVel * 9.5) * dt;
    this.landingDip += this.landingDipVel * dt;

    // 3. Kinetic weapon recoil spring recovery
    this.recoilPitchVel += (-this.recoilPitch * 62 - this.recoilPitchVel * 14) * dt;
    this.recoilPitch += this.recoilPitchVel * dt;
    this.recoilYawVel += (-this.recoilYaw * 62 - this.recoilYawVel * 14) * dt;
    this.recoilYaw += this.recoilYawVel * dt;

    const effYaw = this._yaw + this.recoilYaw;
    const effPitch = this._pitch + this.recoilPitch;

    // 4. Adaptive Mobile Orientation & Dynamic Distance
    const aspect = Math.max(0.2, this.camera.aspect || window.innerWidth / window.innerHeight);
    const isPortrait = aspect < 1.0;

    // In portrait, maintain comfortable distance so the avatar does not obstruct forward view
    const portraitDistMultiplier = isPortrait ? 1.05 : 1.0;
    const targetDist = isAiming
      ? Math.max(2.0, this.baseDist - 1.4)
      : isSprinting
        ? (this.baseDist + 0.75) * portraitDistMultiplier
        : isCrouching
          ? Math.max(2.4, this.baseDist - 0.55) * portraitDistMultiplier
          : this.baseDist * portraitDistMultiplier;
    this.dist = THREE.MathUtils.lerp(this.dist, targetDist, Math.min(1, dt * 6));

    // Dynamic FOV: keep natural perspective without wide-angle fisheye distortion
    let baseFov = isAiming ? 38 : isInstinct ? 46 : isSprinting ? 56 : isCrouching ? 48 : 50;
    if (isPortrait) {
      // In vertical portrait, maintain balanced 52-60 degree vertical FOV for heroic character presence
      baseFov = isAiming ? 40 : 56;
    }

    if (Math.abs(this.camera.fov - baseFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, baseFov, Math.min(1, dt * 8));
      this.camera.updateProjectionMatrix();
    }

    // 5. Velocity Lead-Ahead & Grounded Footstep Cadence Micro-Bob
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

    // 6. Over-the-Shoulder Target Framing
    const sinYaw = Math.sin(effYaw);
    const cosYaw = Math.cos(effYaw);
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    // Center the character horizontally in portrait to avoid edge clipping
    const activeShoulder = isPortrait
      ? (isAiming ? 0.22 : 0.0)
      : isAiming
        ? 0.58
        : this.dist < 2.5
          ? 0.0
          : this.dist > 9.0
            ? this.shoulderOffset * 0.35
            : this.shoulderOffset;

    const eyeHeight = (isCrouching ? 1.08 : (isPortrait ? 1.34 : 1.48)) + this.landingDip + cadenceBobY;

    const targetGoal = new THREE.Vector3(
      playerPos.x + rightX * activeShoulder + this.leadOffset.x,
      playerPos.y + eyeHeight,
      playerPos.z + rightZ * activeShoulder + this.leadOffset.z
    );
    this.target.lerp(targetGoal, Math.min(1, dt * 15));

    // 7. Compute spherical offset with recoil
    const cosPitch = Math.cos(effPitch);
    const sinPitch = Math.sin(effPitch);

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
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
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
