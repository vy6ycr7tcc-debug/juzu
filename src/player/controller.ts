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

// Phase 8a — AC speed vault over waist-high stone. The body already steps anything <= STEP+0.15
// (0.65 m) and mantles 0.78..2.15 m when airborne; everything between was a dead stop at a wall.
// Vault band therefore starts just above the auto-step range and ends at waist height.
const VAULT_MIN_H = 0.66;
const VAULT_MAX_H = 1.25;
const VAULT_MIN_SPEED = 3.4; // running (run pose threshold is 3.8; allow trigger during spin-up)
const VAULT_EXIT_MIN = 4.5; // land in stride preserving sprint momentum (spec: 4.5..5.5 m/s)
const VAULT_EXIT_MAX = 5.5;
const VAULT_COOLDOWN = 0.35; // stops instant re-vault when landing beside a stepped run of stone

const _vaultRayOrigin = new THREE.Vector3();
const _vaultRayDir = new THREE.Vector3();

export class Controller {
  pos = new THREE.Vector3(0, 4.2, 10);
  vel = new THREE.Vector3();
  heading = Math.PI; // Radians (facing North -Z toward the Urubamba Gorge & Rope Bridge)
  grounded = true;
  swimming = false;
  crouching = false;
  mantling = false;
  vaulting = false;
  grappling = false;
  dodging = false;
  justJumped = false;
  justLanded = false;
  landingImpact = 0;
  turnRate = 0;
  slopePitch = 0;
  slopeRoll = 0;
  accelPitch = 0;
  isBraking = false;
  brakeTimer = 0;
  isPivoting = false;
  pivotTimer = 0;
  pivotSign = 1;
  stationaryTurnPhase = 0;
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
  private vaultTimer = 0;
  private vaultDuration = 0.5;
  private vaultCooldown = 0;
  private vaultStart = new THREE.Vector3();
  private vaultEnd = new THREE.Vector3();
  private vaultTopY = 0;
  private vaultFrontD = 0.45;
  private vaultExitSpeed = 4.8;
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

  /** 0..1 through an active speed vault (drives the Naira hand-plant pose blend). */
  get vaultProgress(): number {
    return this.vaultDuration > 0 ? THREE.MathUtils.clamp(this.vaultTimer / this.vaultDuration, 0, 1) : 0;
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
    this.vaulting = false;
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
    if (this.vaultCooldown > 0) this.vaultCooldown = Math.max(0, this.vaultCooldown - dt);
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

    // 0b. Handle active AC speed vault: hand-plant arc across waist-high stone, landing in stride
    if (this.vaulting) {
      this.vaultTimer += dt;
      const t = Math.min(1, this.vaultTimer / this.vaultDuration);
      // Near-constant horizontal velocity: duration was derived from travel/exit speed, so entry
      // momentum carries through the vault with no velocity discontinuity at either end.
      this.pos.x = this.vaultStart.x + (this.vaultEnd.x - this.vaultStart.x) * t;
      this.pos.z = this.vaultStart.z + (this.vaultEnd.z - this.vaultStart.z) * t;
      // Parabolic rise over the stone lip: apex clears obstacle closely allowing right hand
      // to plant firmly ON the stone surface while outside leg swings forward and inside leg tucks.
      const sy = this.vaultStart.y;
      const ey = this.vaultEnd.y;
      // Parabolic rise over the stone: apex height brings character hip and right hand
      // directly down to stone surface level (vaultTopY) for authentic hand-plant contact
      const arcAmp = Math.max(0.0, this.vaultTopY - 0.92 - (sy + ey) * 0.5);
      this.pos.y = sy + (ey - sy) * t + Math.sin(t * Math.PI) * arcAmp;
      const travel = Math.hypot(this.vaultEnd.x - this.vaultStart.x, this.vaultEnd.z - this.vaultStart.z);
      this.speed = travel / this.vaultDuration;
      this.grounded = false;
      this.vel.y = 0;
      this.turnRate = 0;
      this.isPivoting = false;
      // Vault phases ride the existing retargeted jump clips (no dedicated vault clip exists on
      // the rig): plant/crouch -> airborne tuck -> landing fold.
      this.pose = t < 0.3 ? 'jump_start' : t < 0.85 ? 'jump' : 'jump_land';
      if (t >= 1) {
        this.vaulting = false;
        this.pos.x = this.vaultEnd.x;
        this.pos.z = this.vaultEnd.z;
        this.pos.y = this.getGroundAt(this.pos.x, this.pos.z, this.vaultEnd.y + 0.65);
        this.grounded = true;
        this.vel.y = 0;
        this.speed = this.vaultExitSpeed; // land in stride at 4.5..5.5 m/s
        this.justLanded = true;
        this.landingImpact = 2.6;
        this.landingTimer = 0.22;
        this.vaultCooldown = VAULT_COOLDOWN;
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

        // Assassin's Creed Momentum: Detect sharp 180-degree cuts/reversals during run
        if (
          this.grounded &&
          !this.swimming &&
          !this.isPivoting &&
          this.speed > 2.8 &&
          Math.abs(dHeading) > 1.85 &&
          !this.dodging
        ) {
          this.isPivoting = true;
          this.pivotTimer = 0.28;
          this.pivotSign = dHeading > 0 ? 1 : -1;
          this.speed *= 0.36; // Absorb momentum on foot plant
        }

        if (this.isPivoting) {
          this.pivotTimer -= dt;
          if (this.pivotTimer <= 0) this.isPivoting = false;
        }

        // Stationary turn-in-place stepping cadence vs moving turn
        const isStationary = this.speed < 0.35;
        if (isStationary && Math.abs(dHeading) > 0.55) {
          this.stationaryTurnPhase += dt * 4.8;
        } else {
          this.stationaryTurnPhase = 0;
        }

        const prevHeading = this.heading;
        const turnSpeed = this.grounded
          ? this.isPivoting
            ? 22.0
            : isStationary
              ? 8.5 // Natural deliberate stepping rate, not a 30rad/s turntable spin
              : Math.abs(dHeading) > 1.1
                ? 18.0
                : 14.0
          : 10.5;
        const turnBlend = Math.min(1, dt * turnSpeed);
        this.heading += dHeading * turnBlend;

        const instTurnRate = (this.heading - prevHeading) / Math.max(0.001, dt);
        this.turnRate = THREE.MathUtils.lerp(this.turnRate, instTurnRate, Math.min(1, dt * 12));
        this.heading = ((this.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        turnAlign = this.dodging ? 1.0 : this.isPivoting ? 0.45 : Math.max(0.28, Math.cos(dHeading * 0.65));
      } else {
        this.turnRate = THREE.MathUtils.lerp(this.turnRate, 0, Math.min(1, dt * 10));
        this.isPivoting = false;
        this.stationaryTurnPhase = 0;
      }

      const moveDir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));

      // 3-Point Terrain Normal Sampling for authentic slope pitch & roll under boots
      const probeD = 0.48;
      const sinH = Math.sin(this.heading);
      const cosH = Math.cos(this.heading);
      const aheadH = this.getGroundAt(this.pos.x + sinH * probeD, this.pos.z + cosH * probeD, this.pos.y);
      const behindH = this.getGroundAt(this.pos.x - sinH * probeD, this.pos.z - cosH * probeD, this.pos.y);
      const rightH = this.getGroundAt(this.pos.x + cosH * probeD, this.pos.z - sinH * probeD, this.pos.y);
      const leftH = this.getGroundAt(this.pos.x - cosH * probeD, this.pos.z + sinH * probeD, this.pos.y);

      const rawPitch = THREE.MathUtils.clamp((aheadH - behindH) / (probeD * 2), -0.75, 0.75);
      const rawRoll = THREE.MathUtils.clamp((rightH - leftH) / (probeD * 2), -0.65, 0.65);

      this.slopePitch = THREE.MathUtils.lerp(
        this.slopePitch,
        this.grounded ? rawPitch : 0,
        Math.min(1, dt * 10)
      );
      this.slopeRoll = THREE.MathUtils.lerp(
        this.slopeRoll,
        this.grounded ? rawRoll : 0,
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

      // Phase 8a: running into waist-high stone vaults instead of dead-stopping in her tracks
      if (this.tryVault(moveDir.x, moveDir.z)) return;

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
      // 3-Point Terrain Normal Sampling for authentic slope pitch & roll under boots (stationary)
      if (this.grounded) {
        const probeD = 0.48;
        const sinH = Math.sin(this.heading);
        const cosH = Math.cos(this.heading);
        const aheadH = this.getGroundAt(this.pos.x + sinH * probeD, this.pos.z + cosH * probeD, this.pos.y);
        const behindH = this.getGroundAt(this.pos.x - sinH * probeD, this.pos.z - cosH * probeD, this.pos.y);
        const rightH = this.getGroundAt(this.pos.x + cosH * probeD, this.pos.z - sinH * probeD, this.pos.y);
        const leftH = this.getGroundAt(this.pos.x - cosH * probeD, this.pos.z + sinH * probeD, this.pos.y);

        const rawPitch = THREE.MathUtils.clamp((aheadH - behindH) / (probeD * 2), -0.75, 0.75);
        const rawRoll = THREE.MathUtils.clamp((rightH - leftH) / (probeD * 2), -0.65, 0.65);

        this.slopePitch = THREE.MathUtils.lerp(this.slopePitch, rawPitch, Math.min(1, dt * 12));
        this.slopeRoll = THREE.MathUtils.lerp(this.slopeRoll, rawRoll, Math.min(1, dt * 12));
      } else {
        this.slopePitch = THREE.MathUtils.lerp(this.slopePitch, 0, Math.min(1, dt * 10));
        this.slopeRoll = THREE.MathUtils.lerp(this.slopeRoll, 0, Math.min(1, dt * 10));
      }
      this.isPivoting = false;
      this.stationaryTurnPhase = 0;
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

  /**
   * Phase 8a speed-vault probe: called once per frame while grounded and running. Finds a
   * waist-high solid face just ahead (0.66..1.25 m — above the 0.65 m auto-step ceiling, below
   * the 0.78 m airborne mantle floor, the dead-stop band) and, if there is a clear landing past
   * it, starts the vault. Zero allocations per frame (reused module ray temps, scalar loop).
   */
  public tryVault(dirX: number, dirZ: number): boolean {
    if (
      this.vaulting ||
      this.vaultCooldown > 0 ||
      !this.grounded ||
      this.swimming ||
      this.dodging ||
      this.crouching ||
      this.isPivoting ||
      this.speed < VAULT_MIN_SPEED
    ) {
      return false;
    }

    // 1. Obstacle top just beyond arm's reach of the body capsule (contact happens at r=0.38)
    const fx = this.pos.x + dirX * 0.62;
    const fz = this.pos.z + dirZ * 0.62;
    const top = solidity.floor(fx, fz, this.pos.y + 1.4, this.pos.y + 0.1);
    if (!Number.isFinite(top)) return false;
    const dh = top - this.pos.y;
    if (dh < VAULT_MIN_H || dh > VAULT_MAX_H) return false;

    // 2. Front face distance (chest-height ray) — the hand-plant reference for the animation layer
    _vaultRayOrigin.set(this.pos.x, this.pos.y + 0.55, this.pos.z);
    _vaultRayDir.set(dirX, 0, dirZ);
    const frontHit = solidity.ray(_vaultRayOrigin, _vaultRayDir, 2.0);
    this.vaultFrontD = Number.isFinite(frontHit) ? frontHit : 0.45;

    // 3. Landing scan: first sample past the block with no waist-high solid and sane ground
    let landX = 0;
    let landZ = 0;
    let landY = 0;
    let landD = -1;
    for (let d = this.vaultFrontD + 0.35; d <= this.vaultFrontD + 3.0; d += 0.15) {
      const cx = this.pos.x + dirX * d;
      const cz = this.pos.z + dirZ * d;
      const s = solidity.floor(cx, cz, this.pos.y + 1.4, this.pos.y - 1.6);
      if (Number.isFinite(s) && s > this.pos.y + 0.45) continue; // still on top of / inside the block
      const ground = this.getGroundAt(cx, cz, this.pos.y + 1.4);
      if (ground > this.pos.y + 0.6 || ground < this.pos.y - 1.8) continue; // new wall / cliff drop
      landX = cx;
      landZ = cz;
      landY = ground;
      landD = d;
      break;
    }
    if (landD < 0) return false; // no clear run-out: keep the old collide behaviour

    // 3.5 Airspace clearance: the arc crosses just above the obstacle top — if anything
    //    solid occupies the body/head band over the crossing (a tower standing on the
    //    plinth, an arch, a merlon), the vault would clip straight through it. Reject and
    //    keep normal collision. Sampled at the body's ±0.33 m width: the courtyard plinth
    //    at x=-3.0 squeezed past the tower's west face by 0.08 m and put her shoulder
    //    INSIDE the tower at apex. (Found via the phase-8a verify harness.)
    _vaultRayDir.set(dirX, 0, dirZ);
    const airDist = this.vaultFrontD + 3.0;
    const perpX = -dirZ;
    const perpZ = dirX;
    for (const off of [-0.33, 0, 0.33]) {
      _vaultRayOrigin.set(this.pos.x + perpX * off, top + 0.35, this.pos.z + perpZ * off);
      if (Number.isFinite(solidity.ray(_vaultRayOrigin, _vaultRayDir, airDist))) return false;
      _vaultRayOrigin.y = top + 1.5;
      if (Number.isFinite(solidity.ray(_vaultRayOrigin, _vaultRayDir, airDist))) return false;
    }

    // 4. Arm the vault: constant-velocity travel so entry speed carries through and the exit
    //    speed lands inside the 4.5..5.5 m/s sprint-preservation band.
    this.vaulting = true;
    this.vaultTimer = 0;
    this.vaultStart.copy(this.pos);
    this.vaultEnd.set(landX, landY, landZ);
    this.vaultTopY = top;
    this.vaultExitSpeed = THREE.MathUtils.clamp(this.speed, VAULT_EXIT_MIN, VAULT_EXIT_MAX);
    const travel = Math.hypot(landX - this.pos.x, landZ - this.pos.z);
    this.vaultDuration = travel / this.vaultExitSpeed;
    this.mantling = false;
    return true;
  }

  public teleport(pos: THREE.Vector3): void {
    this.pos.copy(pos);
    this.pos.y = this.getGroundAt(pos.x, pos.z, pos.y);
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.turnRate = 0;
    this.grounded = true;
    this.mantling = false;
    this.vaulting = false;
    this.vaultCooldown = 0;
    this.dodging = false;
    this.landingTimer = 0;
    this.interactTimer = 0;

    const probeD = 0.48;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const aheadH = this.getGroundAt(this.pos.x + sinH * probeD, this.pos.z + cosH * probeD, this.pos.y);
    const behindH = this.getGroundAt(this.pos.x - sinH * probeD, this.pos.z - cosH * probeD, this.pos.y);
    const rightH = this.getGroundAt(this.pos.x + cosH * probeD, this.pos.z - sinH * probeD, this.pos.y);
    const leftH = this.getGroundAt(this.pos.x - cosH * probeD, this.pos.z + sinH * probeD, this.pos.y);
    this.slopePitch = THREE.MathUtils.clamp((aheadH - behindH) / (probeD * 2), -0.75, 0.75);
    this.slopeRoll = THREE.MathUtils.clamp((rightH - leftH) / (probeD * 2), -0.65, 0.65);
  }
}
