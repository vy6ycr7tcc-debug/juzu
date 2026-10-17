import * as THREE from 'three/webgpu';
import { standAt, WATER_Y } from '../world/terrain';
import { solidity, STEP } from '../world/solidity';

export type LocomotionPose = 'idle' | 'walk' | 'run' | 'jump' | 'swim';

const WALK_SPEED = 2.4;
const RUN_SPEED = 6.4;
const JUMP_VELOCITY = 6.8;
const GRAVITY = 18.0;
const SWIM_FEET = WATER_Y - 1.0;

export class Controller {
  pos = new THREE.Vector3(0, 2.5, 0);
  vel = new THREE.Vector3();
  heading = 0; // Radians
  grounded = true;
  swimming = false;
  pose: LocomotionPose = 'idle';
  speed = 0;

  private airTime = 0;

  constructor(initialPos: THREE.Vector3 = new THREE.Vector3(0, 2.5, 0)) {
    this.pos.copy(initialPos);
    this.pos.y = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);
  }

  public getGroundAt(x: number, z: number, y: number = Infinity): number {
    const terrainH = standAt(x, z);
    if (y === Infinity) return terrainH;
    return Math.max(terrainH, solidity.floor(x, z, y + STEP + 0.05, terrainH));
  }

  public update(
    inputMove: { x: number; y: number },
    isBoost: boolean,
    isJump: boolean,
    camYaw: number,
    dt: number
  ): void {
    const groundH = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);

    // 1. Water state check
    const inWater = this.pos.y < WATER_Y - 0.4;
    this.swimming = inWater && groundH < SWIM_FEET;

    if (this.swimming) {
      this.grounded = false;
      this.vel.y = 0;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, SWIM_FEET, Math.min(1, dt * 6));
    } else {
      // 2. Vertical Physics (Gravity & Jump)
      if (this.grounded) {
        this.airTime = 0;
        this.vel.y = 0;
        this.pos.y = groundH;

        if (isJump) {
          this.vel.y = JUMP_VELOCITY;
          this.grounded = false;
        }
      } else {
        this.airTime += dt;
        this.vel.y -= GRAVITY * dt;
        this.pos.y += this.vel.y * dt;

        // Land on ground
        if (this.pos.y <= groundH) {
          this.pos.y = groundH;
          this.vel.y = 0;
          this.grounded = true;
        }
      }
    }

    // 3. Horizontal Locomotion (Camera-relative)
    const hasMove = Math.hypot(inputMove.x, inputMove.y) > 0.08;
    if (hasMove) {
      // Calculate world travel direction relative to camera yaw
      // camYaw: 0 looks along -Z. Move x is right, y is forward.
      const forwardAngle = camYaw;
      const inputAngle = Math.atan2(inputMove.x, inputMove.y);
      const targetHeading = forwardAngle + inputAngle;

      // Smooth heading turn
      let dHeading = (targetHeading - this.heading) % (Math.PI * 2);
      if (dHeading > Math.PI) dHeading -= Math.PI * 2;
      if (dHeading < -Math.PI) dHeading += Math.PI * 2;
      this.heading += dHeading * Math.min(1, dt * 14);

      const targetSpeed = isBoost ? RUN_SPEED : WALK_SPEED;
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, Math.min(1, dt * 12));

      const moveDir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      const step = moveDir.multiplyScalar(this.speed * dt);

      // Check collision push-out
      const nextX = this.pos.x + step.x;
      const nextZ = this.pos.z + step.z;
      const nextH = this.getGroundAt(nextX, nextZ, this.pos.y);

      // Prevent climbing sheer cliffs steeper than 60°
      if (nextH - this.pos.y < 1.4) {
        this.pos.x = nextX;
        this.pos.z = nextZ;
      }
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, dt * 16));
    }

    // 4. Update Pose
    if (this.swimming) {
      this.pose = 'swim';
    } else if (!this.grounded) {
      this.pose = 'jump';
    } else if (this.speed > 3.8) {
      this.pose = 'run';
    } else if (this.speed > 0.2) {
      this.pose = 'walk';
    } else {
      this.pose = 'idle';
    }
  }

  public teleport(pos: THREE.Vector3): void {
    this.pos.copy(pos);
    this.pos.y = this.getGroundAt(pos.x, pos.z, pos.y);
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.grounded = true;
  }
}
