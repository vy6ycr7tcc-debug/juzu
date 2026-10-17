import * as THREE from 'three/webgpu';
import { standAt, WATER_Y } from '../world/terrain';
import { solidity, STEP } from '../world/solidity';

export type LocomotionPose = 'idle' | 'walk' | 'run' | 'jump' | 'swim';

const WALK_SPEED = 2.6;
const RUN_SPEED = 6.5;
const CROUCH_SPEED = 1.65;
const JUMP_VELOCITY = 6.9;
const GRAVITY = 18.0;
const SWIM_FEET = WATER_Y - 1.0;

export class Controller {
  pos = new THREE.Vector3(0, 4.2, 10);
  vel = new THREE.Vector3();
  heading = Math.PI; // Radians (facing North -Z toward the Urubamba Gorge & Rope Bridge)
  grounded = true;
  swimming = false;
  crouching = false;
  mantling = false;
  justLanded = false;
  landingImpact = 0;
  pose: LocomotionPose = 'idle';
  speed = 0;

  private airTime = 0;
  private mantleTimer = 0;
  private mantleStart = new THREE.Vector3();
  private mantleEnd = new THREE.Vector3();

  get vy(): number {
    return this.vel.y;
  }

  constructor(initialPos: THREE.Vector3 = new THREE.Vector3(0, 4.2, 10)) {
    this.pos.copy(initialPos);
    this.pos.y = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);
  }

  public getGroundAt(x: number, z: number, y: number = Infinity): number {
    let floorH = standAt(x, z);
    const probeY = y === Infinity ? Math.max(this.pos.y, 12.0) : y;

    // Analytical catenary safety deck for the Cloud Forest Urubamba Rope Bridge (z in -35.2..1.2, |x| <= 1.25)
    if (Math.abs(x) <= 1.25 && z <= 1.2 && z >= -35.2 && probeY > 1.5) {
      const u = THREE.MathUtils.clamp((1.0 - z) / 36.0, 0, 1);
      const bridgeDeckY = 4.28 - 1.35 * 4 * u * (1 - u);
      floorH = Math.max(floorH, bridgeDeckY);
    }

    return Math.max(floorH, solidity.floor(x, z, probeY + STEP + 0.15, floorH));
  }

  public getSurfaceType(): 'grass' | 'stone' | 'wood' | 'water' {
    if (this.swimming || this.pos.y < WATER_Y + 0.35) return 'water';
    // Hanging rope bridge span in Cloud Forest (x in -1.5..1.5, z in -35.5..1.5)
    if (Math.abs(this.pos.x) < 1.55 && this.pos.z <= 1.5 && this.pos.z >= -35.5) {
      return 'wood';
    }
    const terrainH = standAt(this.pos.x, this.pos.z);
    const solidH = solidity.floor(this.pos.x, this.pos.z, this.pos.y + STEP + 0.2, -Infinity);
    if (solidH > terrainH + 0.05) return 'stone';
    return 'grass';
  }

  public update(
    inputMove: { x: number; y: number },
    isBoost: boolean,
    isJump: boolean,
    camYaw: number,
    dt: number,
    isCrouch: boolean = false
  ): void {
    this.justLanded = false;

    // 0. Handle active Tomb Raider Ledge Mantle arc
    if (this.mantling) {
      this.mantleTimer += dt;
      const t = Math.min(1, this.mantleTimer / 0.42);
      const ease = t * t * (3 - 2 * t);
      this.pos.x = THREE.MathUtils.lerp(this.mantleStart.x, this.mantleEnd.x, ease);
      this.pos.z = THREE.MathUtils.lerp(this.mantleStart.z, this.mantleEnd.z, ease);
      // Parabolic vertical lift over the ledge lip
      const arcLift = Math.sin(t * Math.PI) * 0.28;
      this.pos.y = THREE.MathUtils.lerp(this.mantleStart.y, this.mantleEnd.y, Math.pow(t, 0.7)) + arcLift;
      this.pose = 'jump';
      if (t >= 1) {
        this.mantling = false;
        this.grounded = true;
        this.vel.y = 0;
        this.justLanded = true;
        this.landingImpact = 3.5;
      }
      return;
    }

    const groundH = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);

    // 1. Water state check
    const inWater = this.pos.y < WATER_Y - 0.4;
    this.swimming = inWater && groundH < SWIM_FEET;
    this.crouching = isCrouch && this.grounded && !this.swimming;

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
          this.crouching = false;
        }
      } else {
        this.airTime += dt;
        const prevVy = this.vel.y;
        this.vel.y -= GRAVITY * dt;
        this.pos.y += this.vel.y * dt;

        // Land on ground
        if (this.pos.y <= groundH) {
          this.pos.y = groundH;
          this.vel.y = 0;
          this.grounded = true;
          if (this.airTime > 0.14) {
            this.justLanded = true;
            this.landingImpact = Math.min(10, Math.abs(prevVy));
          }
        }
      }
    }

    // 3. Horizontal Locomotion (Camera-relative: W moves away from camera along -sinYaw, -cosYaw)
    const hasMove = Math.hypot(inputMove.x, inputMove.y) > 0.08;
    if (hasMove) {
      const sinY = Math.sin(camYaw);
      const cosY = Math.cos(camYaw);
      const wx = inputMove.x * cosY - inputMove.y * sinY;
      const wz = -inputMove.x * sinY - inputMove.y * cosY;
      const targetHeading = Math.atan2(wx, wz);

      let dHeading = (targetHeading - this.heading) % (Math.PI * 2);
      if (dHeading > Math.PI) dHeading -= Math.PI * 2;
      if (dHeading < -Math.PI) dHeading += Math.PI * 2;
      this.heading += dHeading * Math.min(1, dt * 14);

      const targetSpeed = this.crouching
        ? CROUCH_SPEED
        : isBoost
          ? RUN_SPEED
          : WALK_SPEED;
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, Math.min(1, dt * 12));

      const moveDir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));

      // Check airborne Ledge Grab / Mantle against solid masonry or rock ledges (0.8m..2.15m above feet)
      if (!this.grounded && !this.swimming && this.vel.y > -6.5) {
        const probeX = this.pos.x + moveDir.x * 0.68;
        const probeZ = this.pos.z + moveDir.z * 0.68;
        const ledgeTop = solidity.floor(probeX, probeZ, this.pos.y + 2.25, -Infinity);
        const dh = ledgeTop - this.pos.y;
        if (dh >= 0.78 && dh <= 2.15) {
          this.mantling = true;
          this.mantleTimer = 0;
          this.mantleStart.copy(this.pos);
          this.mantleEnd.set(probeX, ledgeTop, probeZ);
          this.vel.y = 0;
          return;
        }
      }

      const step = moveDir.clone().multiplyScalar(this.speed * dt);
      const nextX = this.pos.x + step.x;
      const nextZ = this.pos.z + step.z;
      const nextTerrainH = standAt(nextX, nextZ);

      // Prevent climbing sheer terrain cliffs steeper than 60°
      if (nextTerrainH - this.pos.y < 1.45) {
        this.pos.x = nextX;
        this.pos.z = nextZ;
      }

      // Enforce horizontal solid wall collision push-out against pillars, gates & masonry
      solidity.pushWalk(this.pos, this.pos.y, 0.38);

      // Snap smoothly to stepped floors (bridge planks, terraces, ramps) when grounded
      if (this.grounded) {
        this.pos.y = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);
      }
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, dt * 16));
      solidity.pushWalk(this.pos, this.pos.y, 0.38);
    }

    // 4. Update Pose
    if (this.swimming) {
      this.pose = 'swim';
    } else if (!this.grounded) {
      this.pose = 'jump';
    } else if (this.speed > 3.8 && !this.crouching) {
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
    this.mantling = false;
  }
}
