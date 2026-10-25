import * as THREE from 'three/webgpu';
import { standAt, WATER_Y } from '../world/terrain';
import { solidity, STEP } from '../world/solidity';

export type LocomotionPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump_start'
  | 'jump'
  | 'jump_land'
  | 'swim'
  | 'swim_idle'
  | 'interact'
  | 'grapple_swing';

const WALK_SPEED = 2.75;
const RUN_SPEED = 6.65;
const CROUCH_SPEED = 1.7;
const DODGE_SPEED = 8.4;
const JUMP_VELOCITY = 7.0;
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
  grappling = false;
  dodging = false;
  justJumped = false;
  justLanded = false;
  landingImpact = 0;
  turnRate = 0;
  slopePitch = 0;
  accelPitch = 0;
  isBraking = false;
  brakeTimer = 0;
  stridePhase = 0;
  isHardTurning = false;
  pose: LocomotionPose = 'idle';
  speed = 0;
  grappleAnchorPos = new THREE.Vector3();
  grappleSwingProgress = 0;

  private airTime = 0;
  private mantleTimer = 0;
  private mantleStart = new THREE.Vector3();
  private mantleEnd = new THREE.Vector3();
  private landingTimer = 0;
  private interactTimer = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private lastCrouchInput = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

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
      const bridgeDeckY = 4.45 + 0.30 * u - Math.sin(u * Math.PI) * 1.45 + 0.07;
      const dz = Math.abs(z - this.pos.z);
      const dip = dz < 2.0 ? -0.046 * Math.pow(Math.cos((dz / 2.0) * (Math.PI / 2)), 2) : 0;
      floorH = Math.max(floorH, bridgeDeckY + dip);
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

  public triggerInteract(targetPos?: THREE.Vector3): void {
    this.interactTimer = 0.72;
    if (targetPos) {
      const dx = targetPos.x - this.pos.x;
      const dz = targetPos.z - this.pos.z;
      if (Math.hypot(dx, dz) > 0.05) {
        this.heading = Math.atan2(dx, dz);
      }
    }
  }

  public startGrapple(anchorPos: THREE.Vector3): void {
    this.grappling = true;
    this.grounded = false;
    this.mantling = false;
    this.crouching = false;
    this.dodging = false;
    this.grappleAnchorPos.copy(anchorPos);
    this.pose = 'grapple_swing';
  }

  public endGrapple(launchVel?: THREE.Vector3): void {
    this.grappling = false;
    if (launchVel) {
      this.vel.copy(launchVel);
      this.speed = Math.hypot(launchVel.x, launchVel.z);
      if (this.speed > 0.1) {
        this.heading = Math.atan2(launchVel.x, launchVel.z);
      }
    }
    this.airTime = 0.05;
    this.pose = 'jump';
  }

  public update(
    inputMove: { x: number; y: number },
    isBoost: boolean,
    isJump: boolean,
    camYaw: number,
    dt: number,
    isCrouch: boolean = false
  ): void {
    this.justJumped = false;
    this.justLanded = false;
    if (this.landingTimer > 0) this.landingTimer = Math.max(0, this.landingTimer - dt);
    if (this.interactTimer > 0) this.interactTimer = Math.max(0, this.interactTimer - dt);
    if (this.dodgeCooldown > 0) this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (!this.grounded && this.coyoteTimer > 0) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    if (isJump) this.jumpBufferTimer = 0.16;

    const crouchPressedEdge = isCrouch && !this.lastCrouchInput;
    this.lastCrouchInput = isCrouch;

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
      this.pose = 'jump_start';
      this.turnRate = 0;
      if (t >= 1) {
        this.mantling = false;
        this.grounded = true;
        this.vel.y = 0;
        this.justLanded = true;
        this.landingImpact = 3.5;
        this.landingTimer = 0.22;
      }
      return;
    }

    // Handle active athletic Grapple Rope Swing
    if (this.grappling) {
      this.grounded = false;
      this.pose = 'grapple_swing';
      const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
      if (horizSpeed > 0.4) {
        const targetHeading = Math.atan2(this.vel.x, this.vel.z);
        let dHeading = (targetHeading - this.heading) % (Math.PI * 2);
        if (dHeading > Math.PI) dHeading -= Math.PI * 2;
        if (dHeading < -Math.PI) dHeading += Math.PI * 2;
        this.heading += dHeading * Math.min(1, dt * 10);
      }
      this.speed = horizSpeed;
      const groundH = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);
      if (this.pos.y <= groundH + 0.15 && this.vel.y < 0) {
        this.pos.y = groundH;
        this.endGrapple();
        this.grounded = true;
        this.justLanded = true;
        this.landingImpact = Math.min(8, Math.abs(this.vel.y));
        this.landingTimer = 0.22;
      }
      return;
    }

    const groundH = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);

    // 1. Water state check
    const inWater = this.pos.y < WATER_Y - 0.4;
    this.swimming = inWater && groundH < SWIM_FEET;

    // Trigger athletic Tomb Raider scramble/dodge burst if tapping Crouch while sprinting
    if (
      crouchPressedEdge &&
      isBoost &&
      this.grounded &&
      !this.swimming &&
      this.speed > 4.0 &&
      this.dodgeCooldown <= 0
    ) {
      this.dodging = true;
      this.dodgeTimer = 0.36;
      this.dodgeCooldown = 0.75;
    }
    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      if (this.dodgeTimer <= 0) this.dodging = false;
    } else {
      this.dodging = false;
    }

    this.crouching = isCrouch && this.grounded && !this.swimming && !this.dodging;

    if (this.swimming) {
      this.grounded = false;
      this.vel.y = 0;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, SWIM_FEET, Math.min(1, dt * 6));
    } else {
      // 2. Vertical Physics (Gravity & Jump with Coyote Time and Input Buffering)
      const wantsJump = isJump || this.jumpBufferTimer > 0;
      const canJump = (this.grounded || this.coyoteTimer > 0) && wantsJump;

      if (canJump) {
        this.vel.y = JUMP_VELOCITY;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.crouching = false;
        this.dodging = false;
        this.justJumped = true;
      } else if (this.grounded) {
        this.airTime = 0;
        this.vel.y = 0;
        this.pos.y = groundH;
        this.coyoteTimer = 0.14;
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
          this.coyoteTimer = 0.14;
          if (this.airTime > 0.14) {
            this.justLanded = true;
            this.landingImpact = Math.min(10, Math.abs(prevVy));
            this.landingTimer = 0.22;
          }
        }
      }
    }

    // 3. Horizontal Locomotion (Camera-relative: W moves away from camera along -sinYaw, -cosYaw)
    const inputMag = Math.min(1.0, Math.hypot(inputMove.x, inputMove.y));
    const hasMove = inputMag > 0.08 || this.dodging;
    if (hasMove) {
      let turnAlign = 1.0;
      if (inputMag > 0.08) {
        const sinY = Math.sin(camYaw);
        const cosY = Math.cos(camYaw);
        const wx = inputMove.x * cosY - inputMove.y * sinY;
        const wz = -inputMove.x * sinY - inputMove.y * cosY;
        const targetHeading = Math.atan2(wx, wz);

        let dHeading = (targetHeading - this.heading) % (Math.PI * 2);
        if (dHeading > Math.PI) dHeading -= Math.PI * 2;
        if (dHeading < -Math.PI) dHeading += Math.PI * 2;

        const prevHeading = this.heading;
        const turnSpeed = this.grounded ? (Math.abs(dHeading) > 1.1 ? 24.0 : 18.0) : 10.5;
        const turnBlend = Math.min(1, dt * turnSpeed);
        this.heading += dHeading * turnBlend;

        const instTurnRate = (this.heading - prevHeading) / Math.max(0.001, dt);
        this.turnRate = THREE.MathUtils.lerp(this.turnRate, instTurnRate, Math.min(1, dt * 12));
        this.heading = ((this.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        turnAlign = this.dodging ? 1.0 : Math.max(0.28, Math.cos(dHeading * 0.65));
      } else {
        this.turnRate = THREE.MathUtils.lerp(this.turnRate, 0, Math.min(1, dt * 10));
      }

      const moveDir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));

      // Compute forward terrain slope pitch for realistic uphill/downhill speed & body lean
      const aheadH = this.getGroundAt(
        this.pos.x + moveDir.x * 0.65,
        this.pos.z + moveDir.z * 0.65,
        this.pos.y
      );
      const rawSlope = THREE.MathUtils.clamp((aheadH - this.pos.y) / 0.65, -0.65, 0.65);
      this.slopePitch = THREE.MathUtils.lerp(
        this.slopePitch,
        this.grounded ? rawSlope : 0,
        Math.min(1, dt * 10)
      );
      const slopeSpeedFactor = this.grounded
        ? THREE.MathUtils.clamp(1.0 - this.slopePitch * 0.22, 0.78, 1.12)
        : 1.0;

      const baseTargetSpeed = this.dodging
        ? DODGE_SPEED
        : this.crouching
          ? CROUCH_SPEED
          : isBoost
            ? RUN_SPEED
            : WALK_SPEED * Math.max(0.55, inputMag);
      const targetSpeed = baseTargetSpeed * slopeSpeedFactor * turnAlign;

      const prevSpeed = this.speed;
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, Math.min(1, dt * 14));
      this.vel.x = moveDir.x * this.speed;
      this.vel.z = moveDir.z * this.speed;
      this.isBraking = false;
      this.brakeTimer = 0;

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

      const nextX = this.pos.x + this.vel.x * dt;
      const nextZ = this.pos.z + this.vel.z * dt;
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
      // Smooth athletic deceleration inertia with athletic braking heel plant
      const prevSpeed = this.speed;
      if (prevSpeed > 3.0 && !this.isBraking && this.grounded) {
        this.isBraking = true;
        this.brakeTimer = 0.28;
      }
      if (this.isBraking) {
        this.brakeTimer -= dt;
        if (this.brakeTimer <= 0) this.isBraking = false;
        this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, dt * 11));
      } else {
        this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, dt * 15));
      }

      this.turnRate = THREE.MathUtils.lerp(this.turnRate, 0, Math.min(1, dt * 12));
      this.slopePitch = THREE.MathUtils.lerp(this.slopePitch, 0, Math.min(1, dt * 10));
      this.vel.x = Math.sin(this.heading) * this.speed;
      this.vel.z = Math.cos(this.heading) * this.speed;
      if (this.speed > 0.04) {
        const nextX = this.pos.x + this.vel.x * dt;
        const nextZ = this.pos.z + this.vel.z * dt;
        if (standAt(nextX, nextZ) - this.pos.y < 1.45) {
          this.pos.x = nextX;
          this.pos.z = nextZ;
        }
      }
      solidity.pushWalk(this.pos, this.pos.y, 0.38);
      if (this.grounded) {
        this.pos.y = this.getGroundAt(this.pos.x, this.pos.z, this.pos.y);
      }
    }

    // Continuous Athletic Stride Phase & Acceleration Spine Lean
    if (this.grounded && this.speed > 0.06) {
      const strideMeters = THREE.MathUtils.lerp(1.15, 1.62, THREE.MathUtils.clamp((this.speed - 2.5) / 4.0, 0, 1));
      this.stridePhase = (this.stridePhase + (this.speed / strideMeters) * Math.PI * 2 * dt) % (Math.PI * 2);
    }
    const targetAccelPitch = this.isBraking
      ? -0.08
      : hasMove && this.grounded
        ? THREE.MathUtils.clamp((this.speed - 2.0) * 0.026, 0.0, 0.14)
        : 0;
    this.accelPitch = THREE.MathUtils.lerp(this.accelPitch, targetAccelPitch, Math.min(1, dt * 9));

    // 4. Update Pose (Full 9-State Locomotion Machine)
    if (this.swimming) {
      this.pose = this.speed > 0.25 ? 'swim' : 'swim_idle';
    } else if (!this.grounded) {
      this.pose = this.airTime < 0.22 && this.vel.y > 1.5 ? 'jump_start' : 'jump';
    } else if (this.interactTimer > 0 && this.speed < 0.35) {
      this.pose = 'interact';
    } else if (this.landingTimer > 0 && this.speed < 1.2) {
      this.pose = 'jump_land';
    } else if ((this.speed > 3.8 && !this.crouching) || this.dodging) {
      this.pose = 'run';
    } else if (this.speed > 0.18) {
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
    this.turnRate = 0;
    this.slopePitch = 0;
    this.grounded = true;
    this.mantling = false;
    this.dodging = false;
    this.landingTimer = 0;
    this.interactTimer = 0;
  }
}
