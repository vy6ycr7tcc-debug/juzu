import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from './input.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { physics } from './physics.js';
import { getGlobalTerrainHeight } from './terrain.js';
import { hairDark, leatherDark } from './materials.js';
import { createMistTexture } from './textures.js';
import { createClimbingAxe, createRecurveBow, createQuiver } from './equipment.js';

// P-MOBILE verification hook (docs/plans/phase-5-mobile-controls.md §P5.3):
// gates G3/G4 read live locomotion state instead of screenshot guessing.
declare global {
  interface Window {
    __playerDebug?: {
      theta: number;
      phi: number;
      speed: number;
      state: MovementState;
      x: number;
      z: number;
      isGrounded?: boolean;
    };
  }
}

export enum MovementState {
  WALK = 'WALK',
  CLIMB = 'CLIMB',
  LEDGE_GRAB = 'LEDGE_GRAB',
  LEDGE_HANG = 'LEDGE_HANG',
  MANTLE = 'MANTLE',
  WALL_SCRAMBLE = 'WALL_SCRAMBLE',
  SWIM = 'SWIM',
  SLIDE = 'SLIDE',
  ROPE_SWING = 'ROPE_SWING',
  CROUCH = 'CROUCH',
  ROLL = 'ROLL'
}

const HIPS = 'mixamorigHips';

/**
 * Retarget a Mixamo clip authored on one export onto another export that
 * shares bone NAMES but differs in armature-root orientation / proportions.
 *
 * Hips (the only bone whose parent differs between exports) satisfies
 *   R_dstRoot · hips_dst = R_srcRoot · hips_src
 * so every Hips key is pre-multiplied by C = R_dstRoot⁻¹ · R_srcRoot
 * (rotation AND translation). Hip translation is scaled by the bind
 * hip-height ratio so the feet stay planted on her shorter legs. All other
 * translation / scale tracks encode the SOURCE skeleton's bone lengths and are
 * dropped (rotations-only retarget — the standard Mixamo practice).
 */
function retargetMixamoClip(clip: THREE.AnimationClip, srcScene: THREE.Object3D, dstModel: THREE.Object3D): THREE.AnimationClip | null {
  const srcHips = srcScene.getObjectByName(HIPS);
  const dstHips = dstModel.getObjectByName(HIPS);
  if (!srcHips || !dstHips || !srcHips.parent || !dstHips.parent) return null;

  const C = dstHips.parent.quaternion.clone().invert().multiply(srcHips.parent.quaternion);
  // Bind hip height measured in each root frame (vertical component after root rotation).
  const srcH = srcHips.position.clone().applyQuaternion(srcHips.parent.quaternion).y;
  const dstH = dstHips.position.clone().applyQuaternion(dstHips.parent.quaternion).y;
  const hScale = srcH !== 0 ? dstH / srcH : 1;

  const tracks: THREE.KeyframeTrack[] = [];
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const bone = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    if (prop === 'scale') continue;
    if (bone !== HIPS) {
      if (prop === 'quaternion') tracks.push(track.clone());
      continue; // non-hips position = source bone length
    }
    const t = track.clone();
    const vals = t.values;
    if (prop === 'quaternion') {
      for (let i = 0; i < vals.length; i += 4) {
        q.fromArray(vals, i).premultiply(C).toArray(vals, i);
      }
    } else if (prop === 'position') {
      for (let i = 0; i < vals.length; i += 3) {
        v.fromArray(vals, i).applyQuaternion(C).multiplyScalar(hScale).toArray(vals, i);
      }
    }
    tracks.push(t);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function createMudSplatterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
    grad.addColorStop(0, 'rgba(85, 55, 35, 0.95)');
    grad.addColorStop(0.6, 'rgba(115, 80, 45, 0.55)');
    grad.addColorStop(1, 'rgba(70, 45, 25, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CharacterController {
  public mesh: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  protected input: InputManager;

  // Spring-arm orbit camera parameters — Tomb Raider over-the-shoulder framing
  public theta: number = 0;
  public phi: number = Math.PI * 0.44; // ~79°: dramatic horizontal Andean horizon vista
  public radius: number = 3.8;
  public target: THREE.Vector3 = new THREE.Vector3(0, 1.35, 0);
  public currentCameraDistance: number = 3.8;
  public minCameraDistance: number = 0.85;

  // Traversal State Machine
  public state: MovementState = MovementState.WALK;
  private stateTimer: number = 0;

  // Locomotion & Physics parameters (Tomb Raider / Assassin's Creed feel)
  public speed: number = 0;
  private maxWalkSpeed: number = 2.4;
  private maxRunSpeed: number = 5.6;
  private maxCrouchSpeed: number = 1.5;
  private acceleration: number = 24.0;
  private deceleration: number = 28.0;
  private rotationSpeed: number = 16.0;

  // Vertical dynamics & jumping
  public velocityY: number = 0;
  public isGrounded: boolean = true;
  private gravity: number = 18.0;
  private jumpForce: number = 6.4;

  // Dodge roll & crouch mechanics
  public isRolling: boolean = false;
  public rollTimer: number = 0;
  public isCrouched: boolean = false;

  // Archaeologist survival instinct pulse (Tomb Raider survival instinct)
  public isInstinctActive: boolean = false;
  public instinctTimer: number = 0;

  // Ledge Hang & Mantle Traversal (Shadow of the Tomb Raider North Star)
  public ledgeInfo: {
    ledgeY: number;
    wallNormal: THREE.Vector3;
    hangPosition: THREE.Vector3;
    mantleTargetPosition: THREE.Vector3;
  } | null = null;
  public mantleTimer: number = 0;
  public readonly mantleDuration: number = 0.65;
  public mantleStartPosition: THREE.Vector3 = new THREE.Vector3();
  public ledgeCooldown: number = 0;

  // Cached Mixamo bones for upper-body IK and ledge-hang arm postures
  private leftArmBone: THREE.Object3D | null = null;
  private rightArmBone: THREE.Object3D | null = null;
  private leftForeArmBone: THREE.Object3D | null = null;
  private rightForeArmBone: THREE.Object3D | null = null;
  private leftUpLegBone: THREE.Object3D | null = null;
  private rightUpLegBone: THREE.Object3D | null = null;
  private leftLegBone: THREE.Object3D | null = null;
  private rightLegBone: THREE.Object3D | null = null;

  // Wall Scramble (Shadow of the Tomb Raider high vertical foot-push reach)
  public wallScrambleTimer: number = 0;
  public readonly wallScrambleDuration: number = 0.42;
  public wallScrambleTargetLedge: {
    ledgeY: number;
    wallNormal: THREE.Vector3;
    hangPosition: THREE.Vector3;
    mantleTargetPosition: THREE.Vector3;
  } | null = null;

  // Mud Chute Slide Physics (Shadow of the Tomb Raider steep slope navigation)
  public slideSteerAngle: number = 0;
  private mudParticles: THREE.Sprite[] = [];
  private mudAccum: number = 0;
  private mudMat: THREE.SpriteMaterial | null = null;

  // Rigged GLB Model & Animation state
  public isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    crouch?: THREE.AnimationAction;
  } = {};
  private activeAction: THREE.AnimationAction | null = null;
  public characterModel: THREE.Group | null = null;
  private modelBaseY: number = 0;
  private time: number = 0;

  public disableCameraUpdate: boolean = false;

  // Optional rigid body reference for physics interaction
  public body: RAPIER.RigidBody | null = null;
  public collider: RAPIER.Collider | null = null;

  // Breath particles for high altitude Sierra
  private breathParticles: THREE.Sprite[] = [];
  private breathAccum = 0;
  private breathMat: THREE.SpriteMaterial | null = null;

  // Dynamic Surface Wetness & Mud Splatter (Shadow of the Tomb Raider North Star)
  public wetness: number = 0; // 0.0 (bone dry) to 1.0 (soaked)
  public mudSplatter: number = 0; // 0.0 (clean) to 1.0 (mud-caked)
  public charMaterials: THREE.MeshStandardMaterial[] = [];
  private waterDripParticles: THREE.Sprite[] = [];
  private waterDripAccum = 0;
  private waterDripMat: THREE.SpriteMaterial | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;

    // Protagonist root group — positioned in world coordinates
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    // Asynchronously load the authentic female archaeologist model and retargeted animations
    this.load();

    // Camera initial orientation
    this.updateCamera(0.016);
  }

  public load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      const michelleUrl = `${import.meta.env.BASE_URL}models/michelle.glb`;
      const soldierUrl = `${import.meta.env.BASE_URL}models/soldier.glb`;
      const xbotUrl = `${import.meta.env.BASE_URL}models/xbot.glb`;

      Promise.all([
        loader.loadAsync(michelleUrl),
        loader.loadAsync(soldierUrl),
        loader.loadAsync(xbotUrl).catch(() => null)
      ]).then(([michelleGltf, soldierGltf, xbotGltf]) => {
        const model = michelleGltf.scene;

        // Scale model to authentic human adventurer height (1.75 m)
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 1.75;
        const scale = targetHeight / (size.y || 1);
        model.scale.setScalar(scale);

        // Center model and align soles of boots precisely to local y = 0
        const alignedBox = new THREE.Box3().setFromObject(model);
        this.modelBaseY = -alignedBox.min.y;
        model.position.y = this.modelBaseY;

        // Load authentic Andean archaeologist albedo texture
        const texLoader = new THREE.TextureLoader();
        const customAlbedo = texLoader.load(`${import.meta.env.BASE_URL}assets/character-textures/naira_adventurer_albedo.png`);
        customAlbedo.colorSpace = THREE.SRGBColorSpace;
        customAlbedo.flipY = false;

        // Ensure proper PBR material configuration: skin & clothing realism (not shiny plastic/metal)
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.map = customAlbedo;
              mat.envMapIntensity = 0.9;
              mat.roughness = 0.85; // Weather-worn field clothing & natural skin
              mat.metalness = 0.02; // Non-metallic organic surface
              mat.needsUpdate = true;
              this.charMaterials.push(mat);
            }
          }
        });

        // Survival Gear Sockets (Shadow of the Tomb Raider North Star)
        // Authentic survivalist equipment socketed directly into the skeletal rig
        const hipsBone = (model.getObjectByName('mixamorig:Hips') ?? model.getObjectByName('mixamorigHips')) ?? null;
        const spine2Bone = (model.getObjectByName('mixamorig:Spine2') ?? model.getObjectByName('mixamorigSpine2')) ?? (model.getObjectByName('mixamorig:Spine1') ?? model.getObjectByName('mixamorigSpine1')) ?? null;

        if (hipsBone) {
          const axe = createClimbingAxe();
          axe.position.set(16.0, -2.0, 4.0); // right hip loop in cm bone coordinates
          axe.rotation.set(0.1, 0, -0.15);
          axe.scale.setScalar(95.0); // 100x scale to counter 0.01 armature scale
          hipsBone.add(axe);
        }

        if (spine2Bone) {
          // 2. Survival Recurve Bow across spine
          const bow = createRecurveBow();
          bow.position.set(0, 4.0, -12.0); // slung diagonally across upper back
          bow.rotation.set(0.2, 0.1, 0.75); // diagonal sling angle
          bow.scale.setScalar(92.0); // 100x scale
          spine2Bone.add(bow);

          // 3. Arrow Quiver on right shoulder back
          const quiver = createQuiver();
          quiver.position.set(10.0, 10.0, -10.0);
          quiver.rotation.set(-0.25, -0.15, -0.55);
          quiver.scale.setScalar(88.0); // 100x scale
          spine2Bone.add(quiver);
        }

        this.characterModel = model;
        this.mesh.add(model);

        // Cache Mixamo arm and forearm bones for ledge hanging posture
        this.leftArmBone = (model.getObjectByName('mixamorigLeftArm') ?? model.getObjectByName('mixamorig:LeftArm')) ?? null;
        this.rightArmBone = (model.getObjectByName('mixamorigRightArm') ?? model.getObjectByName('mixamorig:RightArm')) ?? null;
        this.leftForeArmBone = (model.getObjectByName('mixamorigLeftForeArm') ?? model.getObjectByName('mixamorig:LeftForeArm')) ?? null;
        this.rightForeArmBone = (model.getObjectByName('mixamorigRightForeArm') ?? model.getObjectByName('mixamorig:RightForeArm')) ?? null;
        this.leftUpLegBone = (model.getObjectByName('mixamorigLeftUpLeg') ?? model.getObjectByName('mixamorig:LeftUpLeg')) ?? null;
        this.rightUpLegBone = (model.getObjectByName('mixamorigRightUpLeg') ?? model.getObjectByName('mixamorig:RightUpLeg')) ?? null;
        this.leftLegBone = (model.getObjectByName('mixamorigLeftLeg') ?? model.getObjectByName('mixamorig:LeftLeg')) ?? null;
        this.rightLegBone = (model.getObjectByName('mixamorigRightLeg') ?? model.getObjectByName('mixamorig:RightLeg')) ?? null;

        // AnimationMixer with RETARGETED locomotion clips. The soldier/xbot
        // exports share Michelle's 65 mixamorig bone names but NOT her
        // armature-root orientation (soldier root −90°X / Z-up hips, Michelle
        // +90°X, xbot identity) — binding the raw clips flipped her upside
        // down ~1 m under the terrain. retargetMixamoClip re-expresses the
        // Hips tracks in her root frame and drops foreign bone-length tracks.
        this.mixer = new THREE.AnimationMixer(model);

        for (const clip of soldierGltf.animations) {
          const name = clip.name;
          if (name !== 'Idle' && name !== 'Walk' && name !== 'Run') continue;
          const rc = retargetMixamoClip(clip, soldierGltf.scene, model);
          if (!rc) continue;
          const action = this.mixer.clipAction(rc);
          if (name === 'Idle') this.actions.idle = action;
          else if (name === 'Walk') this.actions.walk = action;
          else this.actions.run = action;
        }

        if (xbotGltf) {
          const sneak = xbotGltf.animations.find((c) => c.name === 'sneak_pose');
          const rc = sneak ? retargetMixamoClip(sneak, xbotGltf.scene, model) : null;
          if (rc) this.actions.crouch = this.mixer.clipAction(rc);
        }

        if (this.actions.idle) {
          this.actions.idle.play();
          this.activeAction = this.actions.idle;
        }

        this.isLoaded = true;
        resolve();
      }).catch((err) => {
        console.error('Failed to load character GLB models:', err);
        reject(err);
      });
    });
    return this.loadPromise;
  }

  public setForceState(state: MovementState) {
    this.state = state;
    this.stateTimer = 0;
  }

  public getTerrainHeightAndNormal(x: number, z: number): { y: number, normal: THREE.Vector3 } {
    const y = getGlobalTerrainHeight(x, z);
    const eps = 0.1;
    const hx = getGlobalTerrainHeight(x + eps, z);
    const hz = getGlobalTerrainHeight(x, z + eps);
    const dx = hx - y;
    const dz = hz - y;
    const normal = new THREE.Vector3(-dx, eps, -dz).normalize();
    return { y, normal };
  }

  public getGroundedHeight(x: number, z: number): number {
    let h = this.getTerrainHeightAndNormal(x, z).y;
    // Check physics colliders (bridges, stairs, stone platforms)
    const physHeight = physics.raycastDown(x, this.mesh.position.y + 2.0, z, 6.0, this.body ?? undefined);
    if (physHeight !== null && physHeight > h) {
      h = physHeight;
    }
    return h;
  }

  public triggerArchaeologistInstinct(): void {
    this.isInstinctActive = true;
    this.instinctTimer = 3.5;
  }

  /**
   * Dual-probe ledge sensor (Shadow of the Tomb Raider North Star):
   * Casts a horizontal ray forward from chest level to detect a vertical wall/cliff,
   * then casts a vertical downward ray from above the detected wall to find the exact top surface lip.
   * Also verifies headroom clearance to ensure the player can stand on the ledge.
   */
  public checkLedge(forwardDir?: THREE.Vector3, maxReach: number = 2.45): {
    ledgeY: number;
    wallNormal: THREE.Vector3;
    hangPosition: THREE.Vector3;
    mantleTargetPosition: THREE.Vector3;
  } | null {
    const dir = (forwardDir && forwardDir.lengthSq() > 0.001)
      ? forwardDir.clone().normalize()
      : new THREE.Vector3(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y)).normalize();

    const charPos = this.mesh.position;
    const charFeetY = charPos.y;

    // 1. Check Rapier physics colliders (stone architecture, temple ruins, bridges, terraces)
    const chestOrigin = new THREE.Vector3(charPos.x, charFeetY + 1.15, charPos.z);
    const forwardReach = 0.95;
    const forwardHit = physics.raycast(chestOrigin, dir, forwardReach, this.body ?? undefined);

    if (forwardHit && Math.abs(forwardHit.normal.y) < 0.35) {
      // Hit a vertical or near-vertical obstacle (wall)
      const wallNormal = new THREE.Vector3(forwardHit.normal.x, 0, forwardHit.normal.z).normalize();

      // Top-down probe: position slightly past the wall into the platform, cast down from overhead
      const probeOverhang = 0.25;
      const topProbeOrigin = new THREE.Vector3(
        forwardHit.point.x - wallNormal.x * probeOverhang,
        charFeetY + Math.max(2.6, maxReach + 0.35),
        forwardHit.point.z - wallNormal.z * probeOverhang
      );
      const downHit = physics.raycast(topProbeOrigin, new THREE.Vector3(0, -1, 0), maxReach + 0.8, this.body ?? undefined);

      if (downHit && downHit.normal.y > 0.55) {
        const ledgeY = downHit.point.y;
        const deltaY = ledgeY - charFeetY;

        // Reachable range: 0.8m up to maxReach
        if (deltaY >= 0.8 && deltaY <= maxReach) {
          // Headroom check: at least 1.8m vertical clearance above the ledge
          const headroomCheck = physics.raycast(
            new THREE.Vector3(downHit.point.x, ledgeY + 0.1, downHit.point.z),
            new THREE.Vector3(0, 1, 0),
            1.8,
            this.body ?? undefined
          );
          if (!headroomCheck) {
            // Hands grip the edge at ledgeY. Character root hangs suspended flush against wall
            const wallOffset = 0.32; // Body radius to avoid clipping into stone
            const hangPosition = new THREE.Vector3(
              forwardHit.point.x + wallNormal.x * wallOffset,
              ledgeY - 1.55,
              forwardHit.point.z + wallNormal.z * wallOffset
            );
            const mantleTargetPosition = new THREE.Vector3(
              forwardHit.point.x - wallNormal.x * 0.55,
              ledgeY,
              forwardHit.point.z - wallNormal.z * 0.55
            );
            return { ledgeY, wallNormal, hangPosition, mantleTargetPosition };
          }
        }
      }
    }

    // 2. Check analytical terrain height (cliffs, dirt terraces, ridges)
    const probeDist = 0.7;
    const terrainAheadX = charPos.x + dir.x * probeDist;
    const terrainAheadZ = charPos.z + dir.z * probeDist;
    const terrainAheadY = getGlobalTerrainHeight(terrainAheadX, terrainAheadZ);
    const deltaTerrainY = terrainAheadY - charFeetY;

    if (deltaTerrainY >= 0.85 && deltaTerrainY <= maxReach) {
      // Check that the terrain further ahead is relatively flat (a walkable shelf/plateau, not infinite steep slope)
      const shelfX = charPos.x + dir.x * (probeDist + 0.5);
      const shelfZ = charPos.z + dir.z * (probeDist + 0.5);
      const shelfY = getGlobalTerrainHeight(shelfX, shelfZ);

      if (Math.abs(shelfY - terrainAheadY) < 0.45) {
        const wallNormal = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
        const hangPosition = new THREE.Vector3(
          charPos.x + dir.x * 0.4,
          terrainAheadY - 1.55,
          charPos.z + dir.z * 0.4
        );
        const mantleTargetPosition = new THREE.Vector3(shelfX, shelfY, shelfZ);
        return { ledgeY: terrainAheadY, wallNormal, hangPosition, mantleTargetPosition };
      }
    }

    return null;
  }

  private detectStateTransitions(nextX: number, _nextZ: number, terrainData: { y: number, normal: THREE.Vector3 }) {
    // Swimming only applies when down in river water surface level (< 0.5m)
    const isRiver = this.mesh.position.y < 0.5 && terrainData.y < -3.0 && Math.abs(nextX) < 15;

    if (this.state === MovementState.WALK && this.mesh.position.y > 10 && terrainData.normal.y < 0.1 && this.input.isDown('KeyW')) {
      this.state = MovementState.CLIMB;
    }

    if (this.state === MovementState.WALK && isRiver) {
      this.state = MovementState.SWIM;
    } else if (this.state === MovementState.SWIM && !isRiver && terrainData.y > -2.0) {
      this.state = MovementState.WALK;
    }

    const slope = 1.0 - terrainData.normal.y;
    if (this.state === MovementState.WALK && slope > 0.08 && this.speed > 2.2) {
      this.state = MovementState.SLIDE;
    } else if (this.state === MovementState.SLIDE && slope < 0.04) {
      this.state = MovementState.WALK;
    }
  }

  public update(dt: number) {
    this.stateTimer += dt;
    this.time += dt;

    // 1. Consume camera mouse delta (with pointer lock or mouse drag)
    if (typeof this.input.getCameraDelta === 'function') {
      const camDelta = this.input.getCameraDelta();
      if (camDelta.x !== 0 || camDelta.y !== 0) {
        const mouseSensitivity = 0.003;
        this.theta -= camDelta.x * mouseSensitivity;
        // Invert-pitch fix: moving mouse down (camDelta.y > 0) increases phi (tilts camera down toward character/ground)
        this.phi += camDelta.y * mouseSensitivity;
        this.phi = Math.max(0.15, Math.min(Math.PI * 0.48, this.phi));
      }
    }

    // 2. Archaeologist survival instinct timer
    if (this.isInstinctActive) {
      this.instinctTimer -= dt;
      if (this.instinctTimer <= 0) {
        this.isInstinctActive = false;
      }
    }
    if (this.input.consumeJustPressed('KeyQ')) {
      this.triggerArchaeologistInstinct();
    }

    // 3. Movement Direction Input
    const joy = this.input.getJoystickVector();
    const joystickActive = joy.x !== 0 || joy.y !== 0;
    let forward = this.input.isDown('KeyW') ? 1 : (this.input.isDown('KeyS') ? -1 : 0);
    let right = this.input.isDown('KeyD') ? 1 : (this.input.isDown('KeyA') ? -1 : 0);

    if (joystickActive) {
      forward = -joy.y;
      right = joy.x;
    }

    // Camera-relative planar vectors
    const camForward = new THREE.Vector3(
      -Math.sin(this.theta),
      0,
      -Math.cos(this.theta)
    ).normalize();

    const camRight = new THREE.Vector3(
      Math.cos(this.theta),
      0,
      -Math.sin(this.theta)
    ).normalize();

    const moveDir = new THREE.Vector3()
      .addScaledVector(camForward, forward)
      .addScaledVector(camRight, right);

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
    }

    // 4. Ledge Hang & Mantle Traversal State Machine (Shadow of the Tomb Raider North Star)
    if (this.state === MovementState.LEDGE_HANG) {
      if (this.ledgeInfo) {
        // Face directly into the wall face
        const wallFacingAngle = Math.atan2(this.ledgeInfo.wallNormal.x, this.ledgeInfo.wallNormal.z);
        this.mesh.rotation.y = wallFacingAngle;
        this.mesh.position.copy(this.ledgeInfo.hangPosition);
        this.velocityY = 0;
        this.speed = 0;
        this.isGrounded = false;

        // Mantle input (Space or W)
        const wantsMantle = this.input.consumeJustPressed('Space') || this.input.consumeJustPressed('KeyW');
        if (wantsMantle) {
          this.state = MovementState.MANTLE;
          this.mantleTimer = 0;
          this.mantleStartPosition.copy(this.mesh.position);
        }

        // Drop down input (S or C)
        const wantsDrop = this.input.consumeJustPressed('KeyS') || this.input.consumeJustPressed('KeyC');
        if (wantsDrop) {
          this.state = MovementState.WALK;
          this.isGrounded = false;
          this.velocityY = -2.0;
          this.ledgeCooldown = 0.6;
          this.ledgeInfo = null;
          this.updateAnimationAndCamera(dt);
          return;
        }

        // Lateral shimmy (A / D)
        const lateralDir = new THREE.Vector3(-this.ledgeInfo.wallNormal.z, 0, this.ledgeInfo.wallNormal.x).normalize();
        let shimmy = 0;
        if (this.input.isDown('KeyD')) shimmy += 1;
        if (this.input.isDown('KeyA')) shimmy -= 1;
        if (shimmy !== 0) {
          const shimmySpeed = 1.2;
          const delta = lateralDir.clone().multiplyScalar(shimmy * shimmySpeed * dt);
          this.ledgeInfo.hangPosition.add(delta);
          this.ledgeInfo.mantleTargetPosition.add(delta);
          this.mesh.position.copy(this.ledgeInfo.hangPosition);
        }
      } else {
        this.state = MovementState.WALK;
      }

      this.updateAnimationAndCamera(dt);
      return;
    }

    if (this.state === MovementState.MANTLE) {
      if (this.ledgeInfo) {
        this.mantleTimer += dt;
        const progress = Math.min(1.0, this.mantleTimer / this.mantleDuration);

        if (progress < 0.45) {
          // Phase 1: Vertical pull-up (hands push down on rim, torso ascends above ledge lip)
          const t1 = progress / 0.45;
          const smooth1 = t1 * t1 * (3 - 2 * t1);
          const y = THREE.MathUtils.lerp(this.mantleStartPosition.y, this.ledgeInfo.ledgeY + 0.08, smooth1);
          const x = THREE.MathUtils.lerp(this.mantleStartPosition.x, this.mantleStartPosition.x - this.ledgeInfo.wallNormal.x * 0.15, smooth1);
          const z = THREE.MathUtils.lerp(this.mantleStartPosition.z, this.mantleStartPosition.z - this.ledgeInfo.wallNormal.z * 0.15, smooth1);
          this.mesh.position.set(x, y, z);
        } else {
          // Phase 2: Shift weight forward onto platform surface
          const t2 = (progress - 0.45) / 0.55;
          const smooth2 = t2 * t2 * (3 - 2 * t2);
          const startX = this.mantleStartPosition.x - this.ledgeInfo.wallNormal.x * 0.15;
          const startZ = this.mantleStartPosition.z - this.ledgeInfo.wallNormal.z * 0.15;
          const x = THREE.MathUtils.lerp(startX, this.ledgeInfo.mantleTargetPosition.x, smooth2);
          const z = THREE.MathUtils.lerp(startZ, this.ledgeInfo.mantleTargetPosition.z, smooth2);
          const y = THREE.MathUtils.lerp(this.ledgeInfo.ledgeY + 0.08, this.ledgeInfo.mantleTargetPosition.y, smooth2);
          this.mesh.position.set(x, y, z);
        }

        if (progress >= 1.0) {
          this.mesh.position.copy(this.ledgeInfo.mantleTargetPosition);
          this.state = MovementState.WALK;
          this.isGrounded = true;
          this.velocityY = 0;
          this.speed = 0;
          this.ledgeInfo = null;
          this.ledgeCooldown = 0.4;
        }
      } else {
        this.state = MovementState.WALK;
      }

      this.updateAnimationAndCamera(dt);
      return;
    }

    // 5. Wall Scramble State Update (Shadow of the Tomb Raider North Star)
    if (this.state === MovementState.WALL_SCRAMBLE) {
      if (this.wallScrambleTargetLedge) {
        this.wallScrambleTimer += dt;
        const wallNormal = this.wallScrambleTargetLedge.wallNormal;
        const targetYaw = Math.atan2(wallNormal.x, wallNormal.z);
        this.mesh.rotation.y = targetYaw;

        // Upward trajectory with wall friction
        this.mesh.position.y += this.velocityY * dt;
        this.velocityY -= 14.0 * dt;

        // Hug wall face
        this.mesh.position.x = this.wallScrambleTargetLedge.hangPosition.x;
        this.mesh.position.z = this.wallScrambleTargetLedge.hangPosition.z;

        // When reaching ledge hang elevation, grab the rim!
        if (this.mesh.position.y >= this.wallScrambleTargetLedge.hangPosition.y - 0.1 || this.wallScrambleTimer >= this.wallScrambleDuration) {
          this.ledgeInfo = this.wallScrambleTargetLedge;
          this.state = MovementState.LEDGE_HANG;
          this.mesh.position.copy(this.wallScrambleTargetLedge.hangPosition);
          this.velocityY = 0;
          this.speed = 0;
          this.isGrounded = false;
          this.wallScrambleTargetLedge = null;
        }
      } else {
        this.state = MovementState.WALK;
      }

      this.updateAnimationAndCamera(dt);
      return;
    }

    // 6. Mud Chute Slide Physics (Shadow of the Tomb Raider North Star)
    if (this.state === MovementState.SLIDE) {
      const terrainData = this.getTerrainHeightAndNormal(this.mesh.position.x, this.mesh.position.z);
      const slope = 1.0 - terrainData.normal.y;

      // Chute Leap (Space pressed during slide!)
      if (this.input.consumeJustPressed('Space')) {
        this.state = MovementState.WALK;
        this.isGrounded = false;
        this.velocityY = 7.2; // explosive forward leap
        this.speed = Math.min(12.0, this.speed * 1.35);
        this.updateAnimationAndCamera(dt);
        return;
      }

      // Exit slide if slope flattens out
      if (slope < 0.04) {
        this.state = MovementState.WALK;
      }

      // Downhill direction vector
      const downhill = new THREE.Vector3(terrainData.normal.x, 0, terrainData.normal.z);
      if (downhill.lengthSq() > 0.001) {
        downhill.normalize();
      } else {
        downhill.set(0, 0, 1);
      }

      // Lateral steering with A / D
      let steerInput = 0;
      if (this.input.isDown('KeyA')) steerInput -= 1;
      if (this.input.isDown('KeyD')) steerInput += 1;
      this.slideSteerAngle += steerInput * 1.8 * dt;
      this.slideSteerAngle = THREE.MathUtils.clamp(this.slideSteerAngle, -0.65, 0.65);

      const slideDir = downhill.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.slideSteerAngle);

      // Downhill gravity acceleration
      const slideAccel = 14.0 * Math.max(0.3, slope);
      this.speed = THREE.MathUtils.clamp(this.speed + slideAccel * dt, 4.0, 11.5);

      // Translate along slope
      this.mesh.position.addScaledVector(slideDir, this.speed * dt);
      const groundH = this.getGroundedHeight(this.mesh.position.x, this.mesh.position.z);
      this.mesh.position.y = groundH;
      this.isGrounded = true;
      this.velocityY = 0;

      // Mesh orientation: faces slide direction, low back-tilt crouch
      this.mesh.rotation.y = Math.atan2(-slideDir.x, -slideDir.z);
      this.mesh.rotation.x = -0.35;

      // Spawn mud spray particles
      this.mudAccum += dt * 14;
      while (this.mudAccum >= 1) {
        this.mudAccum -= 1;
        if (!this.mudMat) {
          this.mudMat = new THREE.SpriteMaterial({
            map: createMudSplatterTexture(),
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          });
        }
        const mud = new THREE.Sprite(this.mudMat);
        mud.scale.setScalar(0.24);
        const sprayOffset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.35,
          0.12,
          -0.45
        ).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        mud.position.copy(this.mesh.position).add(sprayOffset);
        this.mesh.parent?.add(mud);
        this.mudParticles.push(mud);
      }

      this.updateMudParticles(dt);
      this.updateAnimationAndCamera(dt);
      return;
    }

    // Crouch & Dodge Roll actions
    if (this.input.consumeJustPressed('KeyC')) {
      if (this.isGrounded && this.speed > 1.2 && !this.isRolling) {
        this.isRolling = true;
        this.rollTimer = 0.6;
      } else if (this.isGrounded && !this.isRolling) {
        this.isCrouched = !this.isCrouched;
        if (this.isCrouched) this.state = MovementState.CROUCH;
        else if (this.state === MovementState.CROUCH) this.state = MovementState.WALK;
      }
    }

    // Dodge Roll state update
    if (this.isRolling) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.isRolling = false;
        if (this.characterModel) {
          this.characterModel.position.y = this.modelBaseY;
        }
        this.mesh.rotation.x = 0;
      } else {
        const rollFrac = 1.0 - (this.rollTimer / 0.6);
        // Forward tuck pitch
        this.mesh.rotation.x = Math.sin(rollFrac * Math.PI) * 0.35;
        if (this.characterModel) {
          this.characterModel.position.y = this.modelBaseY - Math.sin(rollFrac * Math.PI) * 0.3;
        }
      }
    }

    // Jump Input & Ledge Grab & Wall Scramble
    const wantsJump = this.input.consumeJustPressed('Space');
    if (this.isGrounded && wantsJump && !this.isRolling && (this.state === MovementState.WALK || this.state === MovementState.CROUCH)) {
      const ledge = this.checkLedge(moveDir.lengthSq() > 0.001 ? moveDir : undefined, 2.45);
      if (ledge && this.ledgeCooldown <= 0) {
        const deltaY = ledge.ledgeY - this.mesh.position.y;
        if (deltaY <= 1.35) {
          // Direct vault / low mantle over chest-high obstacle
          this.ledgeInfo = ledge;
          this.state = MovementState.MANTLE;
          this.mantleTimer = 0;
          this.mantleStartPosition.copy(this.mesh.position);
          this.updateAnimationAndCamera(dt);
          return;
        } else {
          // Jump and grab high ledge!
          this.ledgeInfo = ledge;
          this.state = MovementState.LEDGE_HANG;
          this.mesh.position.copy(ledge.hangPosition);
          this.velocityY = 0;
          this.speed = 0;
          this.isGrounded = false;
          this.updateAnimationAndCamera(dt);
          return;
        }
      } else {
        // Check for high wall for Wall Scramble (2.45m to 3.6m reach!)
        const scrambleLedge = this.checkLedge(moveDir.lengthSq() > 0.001 ? moveDir : undefined, 3.6);
        if (scrambleLedge && this.ledgeCooldown <= 0) {
          const deltaY = scrambleLedge.ledgeY - this.mesh.position.y;
          if (deltaY > 2.2 && deltaY <= 3.6) {
            // Initiate Wall Scramble!
            this.state = MovementState.WALL_SCRAMBLE;
            this.wallScrambleTimer = 0;
            this.wallScrambleTargetLedge = scrambleLedge;
            this.velocityY = 8.2; // explosive foot-kick impulse
            this.isGrounded = false;
            this.updateAnimationAndCamera(dt);
            return;
          }
        }

        this.velocityY = this.jumpForce;
        this.isGrounded = false;
        this.isCrouched = false;
        if (this.state === MovementState.CROUCH) this.state = MovementState.WALK;
      }
    }

    const isRunning = this.input.isDown('ShiftLeft');

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();

      // Snappy turning: rotate mesh directly towards move direction (facing direction matches move vector)
      const targetAngle = Math.atan2(-moveDir.x, -moveDir.z);
      let angleDiff = targetAngle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      this.mesh.rotation.y += angleDiff * Math.min(1.0, this.rotationSpeed * dt);

      // Speed selection
      let targetSpeed: number;
      if (this.isRolling) {
        targetSpeed = this.maxRunSpeed * 1.35;
      } else if (this.isCrouched) {
        targetSpeed = this.maxCrouchSpeed;
      } else if (joystickActive) {
        const t = THREE.MathUtils.clamp((this.input.joystickMagnitude - 0.35) / (0.95 - 0.35), 0, 1);
        targetSpeed = this.maxWalkSpeed + (this.maxRunSpeed - this.maxWalkSpeed) * t * t;
      } else {
        targetSpeed = isRunning ? this.maxRunSpeed : this.maxWalkSpeed;
      }

      this.speed = Math.min(targetSpeed, this.speed + this.acceleration * dt);

      // DIRECT TRANSLATION ALONG INTENDED MOVE VECTOR (Eliminates ice-skating drift)
      const stepDist = this.speed * dt;
      this.mesh.position.x += moveDir.x * stepDist;
      this.mesh.position.z += moveDir.z * stepDist;

    } else {
      this.speed = Math.max(0, this.speed - this.deceleration * dt);
    }

    // Terrain sampling & grounding
    const terrainData = this.getTerrainHeightAndNormal(this.mesh.position.x, this.mesh.position.z);
    this.detectStateTransitions(this.mesh.position.x, this.mesh.position.z, terrainData);

    const groundH = this.getGroundedHeight(this.mesh.position.x, this.mesh.position.z);

    if (this.state === MovementState.SWIM) {
      const riverLevel = 0.5;
      const bob = Math.sin(this.time * 2) * 0.1;
      this.mesh.position.y = riverLevel - 1.5 + bob;
      this.mesh.position.z -= 2.0 * dt; // River current drift
      if (this.mesh.position.y < groundH) {
        this.mesh.position.y = groundH;
      }
      this.isGrounded = false;
      this.velocityY = 0;
    } else if (this.state === MovementState.CLIMB) {
      this.mesh.position.y += forward * this.maxWalkSpeed * 0.5 * dt;
      this.isGrounded = false;
      this.velocityY = 0;
    } else {
      // Grounded vs Airborne physics
      if (!this.isGrounded) {
        this.velocityY -= this.gravity * dt;
        this.mesh.position.y += this.velocityY * dt;

        if (this.mesh.position.y <= groundH) {
          this.mesh.position.y = groundH;
          this.velocityY = 0;
          this.isGrounded = true;
        } else if (this.velocityY <= 3.5 && this.ledgeCooldown <= 0) {
          // Mid-air ledge grab check (catch ledge rim)
          const airborneLedge = this.checkLedge(moveDir.lengthSq() > 0.001 ? moveDir : undefined);
          if (airborneLedge) {
            const deltaY = airborneLedge.ledgeY - this.mesh.position.y;
            if (deltaY >= 0.8 && deltaY <= 2.45) {
              this.ledgeInfo = airborneLedge;
              this.state = MovementState.LEDGE_HANG;
              this.mesh.position.copy(airborneLedge.hangPosition);
              this.velocityY = 0;
              this.speed = 0;
              this.isGrounded = false;
              this.updateAnimationAndCamera(dt);
              return;
            }
          }
        }
      } else {
        // Step-up / step-down tolerance
        const diff = groundH - this.mesh.position.y;
        if (diff > -1.2 && diff < 0.6) {
          this.mesh.position.y = groundH;
        } else if (diff <= -1.2) {
          // Walking off an edge or drop
          this.isGrounded = false;
          this.velocityY = 0;
        } else if (diff >= 0.6 && this.speed > 1.6 && this.ledgeCooldown <= 0) {
          // Running against a low ledge: auto-mantle
          const runLedge = this.checkLedge(moveDir.lengthSq() > 0.001 ? moveDir : undefined);
          if (runLedge && (runLedge.ledgeY - this.mesh.position.y) <= 1.35) {
            this.ledgeInfo = runLedge;
            this.state = MovementState.MANTLE;
            this.mantleTimer = 0;
            this.mantleStartPosition.copy(this.mesh.position);
            this.updateAnimationAndCamera(dt);
            return;
          }
        }
      }
    }

    // Sync kinematic physics body if present
    if (this.body) {
      this.body.setNextKinematicTranslation({
        x: this.mesh.position.x,
        y: this.mesh.position.y,
        z: this.mesh.position.z
      });
    }

    // High Sierra breath vapor particles
    const isHighSierra = this.mesh.position.z > 500 || this.mesh.position.y > 50;
    if (isHighSierra) {
      this.breathAccum += dt * 6;
      while (this.breathAccum >= 1) {
        this.breathAccum -= 1;
        if (!this.breathMat) {
          this.breathMat = new THREE.SpriteMaterial({
            map: createMistTexture(),
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          });
        }
        const breath = new THREE.Sprite(this.breathMat);
        breath.scale.setScalar(0.12);
        breath.position.copy(this.mesh.position).add(
          new THREE.Vector3(0, 1.8, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y)
        );
        this.mesh.parent?.add(breath);
        this.breathParticles.push(breath);
      }
    }

    for (let i = this.breathParticles.length - 1; i >= 0; i--) {
      const p = this.breathParticles[i];
      p.position.y += dt * 1.5;
      p.position.z += dt * 0.5 * Math.cos(this.mesh.rotation.y);
      p.position.x += dt * 0.5 * Math.sin(this.mesh.rotation.y);
      p.material.opacity -= dt * 0.5;
      p.scale.addScalar(dt * 2.0);
      if (p.material.opacity <= 0) {
        p.parent?.remove(p);
        this.breathParticles.splice(i, 1);
      }
    }

    this.updateWetnessAndMud(dt, groundH);
    this.updateMudParticles(dt);
    this.updateAnimationAndCamera(dt);
  }

  private updateWetnessAndMud(dt: number, groundH: number) {
    // Dynamic Surface Wetness & Mud Washed Off in Water (Shadow of the Tomb Raider North Star)
    const isRiverCorridor = Math.abs(this.mesh.position.x) < 22 && this.mesh.position.y < 1.0;
    if (this.state === MovementState.SWIM || isRiverCorridor) {
      this.wetness = Math.min(1.0, this.wetness + dt * 3.0); // Soaks in water
      this.mudSplatter = Math.max(0.0, this.mudSplatter - dt * 2.0); // River washes away mud!
    } else {
      // Natural evaporation drying curve (dries over ~25s)
      this.wetness = Math.max(0.0, this.wetness - dt / 25.0);
    }

    if (this.state === MovementState.SLIDE) {
      this.mudSplatter = Math.min(1.0, this.mudSplatter + dt * 0.8);
    }

    // Water droplet drips when wet
    if (this.wetness > 0.35) {
      this.waterDripAccum += dt * (this.wetness * 12);
      while (this.waterDripAccum >= 1) {
        this.waterDripAccum -= 1;
        if (!this.waterDripMat) {
          this.waterDripMat = new THREE.SpriteMaterial({
            map: createMistTexture(),
            color: 0x99ddff,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          });
        }
        const drip = new THREE.Sprite(this.waterDripMat);
        drip.scale.setScalar(0.04);
        const dripOffset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.45,
          0.3 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.45
        );
        drip.position.copy(this.mesh.position).add(dripOffset);
        this.mesh.parent?.add(drip);
        this.waterDripParticles.push(drip);
      }
    }

    // Update water drip particles
    for (let i = this.waterDripParticles.length - 1; i >= 0; i--) {
      const d = this.waterDripParticles[i];
      d.position.y -= dt * 2.8;
      d.material.opacity -= dt * 1.4;
      if (d.material.opacity <= 0 || d.position.y <= groundH) {
        d.parent?.remove(d);
        this.waterDripParticles.splice(i, 1);
      }
    }

    // Modulate character PBR materials for wetness and mud
    for (const mat of this.charMaterials) {
      const baseRoughness = 0.85;
      const wetRoughness = THREE.MathUtils.lerp(baseRoughness, 0.16, this.wetness);
      mat.roughness = THREE.MathUtils.lerp(wetRoughness, 0.95, this.mudSplatter);
      mat.envMapIntensity = THREE.MathUtils.lerp(0.9, 2.4, this.wetness);

      const wetDarkening = 1.0 - 0.28 * this.wetness;
      const r = wetDarkening * (1.0 - 0.15 * this.mudSplatter);
      const g = wetDarkening * (1.0 - 0.28 * this.mudSplatter);
      const b = wetDarkening * (1.0 - 0.42 * this.mudSplatter);
      mat.color.setRGB(r, g, b);
    }
  }

  private updateMudParticles(dt: number) {
    for (let i = this.mudParticles.length - 1; i >= 0; i--) {
      const p = this.mudParticles[i];
      p.position.y += dt * 0.35;
      p.material.opacity -= dt * 1.6;
      p.scale.addScalar(dt * 0.4);
      if (p.material.opacity <= 0) {
        p.parent?.remove(p);
        this.mudParticles.splice(i, 1);
      }
    }
  }

  private updateAnimationAndCamera(dt: number) {
    // Skeletal animation updates
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Rig arm adjustment for authentic ledge hanging posture (Shadow of the Tomb Raider North Star)
    if (this.state === MovementState.LEDGE_HANG) {
      if (this.leftArmBone && this.rightArmBone) {
        this.leftArmBone.rotation.set(-1.1, 0.25, 0.35);
        this.rightArmBone.rotation.set(-1.1, -0.25, -0.35);
        if (this.leftForeArmBone) this.leftForeArmBone.rotation.set(0.35, 0, 0);
        if (this.rightForeArmBone) this.rightForeArmBone.rotation.set(0.35, 0, 0);
      }
    } else if (this.state === MovementState.MANTLE) {
      if (this.leftArmBone && this.rightArmBone) {
        const u = Math.min(1.0, this.mantleTimer / this.mantleDuration);
        const armX = THREE.MathUtils.lerp(-1.1, 0.2, u);
        this.leftArmBone.rotation.set(armX, 0.25 * (1 - u), 0.35 * (1 - u));
        this.rightArmBone.rotation.set(armX, -0.25 * (1 - u), -0.35 * (1 - u));
      }
    } else if (this.state === MovementState.WALL_SCRAMBLE) {
      if (this.leftArmBone && this.rightArmBone) {
        this.leftArmBone.rotation.set(-1.45, 0.2, 0.2);
        this.rightArmBone.rotation.set(-1.45, -0.2, -0.2);
        if (this.leftForeArmBone) this.leftForeArmBone.rotation.set(0.2, 0, 0);
        if (this.rightForeArmBone) this.rightForeArmBone.rotation.set(0.2, 0, 0);
      }
      if (this.leftUpLegBone && this.rightUpLegBone) {
        const kick = Math.sin(this.wallScrambleTimer * 24.0);
        this.leftUpLegBone.rotation.set(0.75 + kick * 0.4, 0, 0);
        this.rightUpLegBone.rotation.set(0.75 - kick * 0.4, 0, 0);
      }
    } else if (this.state === MovementState.SLIDE) {
      if (this.leftArmBone && this.rightArmBone) {
        this.leftArmBone.rotation.set(0.5, 0.4, -0.45);
        this.rightArmBone.rotation.set(0.5, -0.4, 0.45);
      }
      if (this.leftUpLegBone && this.rightUpLegBone) {
        this.leftUpLegBone.rotation.set(0.9, 0, -0.2);
        this.rightUpLegBone.rotation.set(0.9, 0, 0.2);
      }
    }

    let desiredAction = this.actions.idle;
    if (this.state === MovementState.LEDGE_HANG || this.state === MovementState.MANTLE) {
      desiredAction = this.actions.idle;
    } else if (this.state === MovementState.WALL_SCRAMBLE) {
      desiredAction = this.actions.run ?? this.actions.walk ?? this.actions.idle;
    } else if (this.state === MovementState.SLIDE) {
      desiredAction = this.actions.crouch ?? this.actions.idle;
    } else if (this.isCrouched && this.actions.crouch) {
      desiredAction = this.actions.crouch;
    } else if (this.speed > 0.1) {
      if (this.speed > this.maxWalkSpeed * 1.1) {
        desiredAction = this.actions.run;
      } else {
        desiredAction = this.actions.walk;
      }
    }

    if (desiredAction && desiredAction !== this.activeAction) {
      if (this.activeAction) {
        this.activeAction.fadeOut(0.2);
      }
      desiredAction.reset().fadeIn(0.2).play();
      this.activeAction = desiredAction;
    }

    // Match animation cycle tempo to locomotion ground velocity
    if (this.activeAction === this.actions.walk && this.actions.walk) {
      this.actions.walk.timeScale = Math.max(0.3, this.speed / this.maxWalkSpeed);
    } else if (this.activeAction === this.actions.run && this.actions.run) {
      this.actions.run.timeScale = Math.max(0.6, this.speed / this.maxRunSpeed);
    }

    if (this.state === MovementState.SLIDE) {
      this.mesh.rotation.x = -0.35;
    } else if (!this.isRolling) {
      this.mesh.rotation.x = 0;
    }

    window.__playerDebug = {
      theta: this.theta,
      phi: this.phi,
      speed: this.speed,
      state: this.state,
      x: this.mesh.position.x,
      z: this.mesh.position.z,
      isGrounded: this.isGrounded,
    };

    this.updateCamera(dt);
  }

  public updateCamera(dt: number = 0.016) {
    if (this.disableCameraUpdate) return;

    // 1. Calculate camera orientation vectors
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    // Lateral right vector on horizontal plane
    const camRight = new THREE.Vector3(cosTheta, 0, -sinTheta).normalize();

    // 2. Over-the-shoulder offset:
    // Offset target 0.35m to the right shoulder so adventurer occupies the lower-left third
    const shoulderOffset = camRight.clone().multiplyScalar(0.35);
    this.target.copy(this.mesh.position).add(new THREE.Vector3(0, 1.35, 0)).add(shoulderOffset);

    // 3. Desired camera position at full radius
    const desiredOffset = new THREE.Vector3(
      this.radius * sinPhi * sinTheta,
      this.radius * cosPhi,
      this.radius * sinPhi * cosTheta
    );

    // 4. Spring-arm collision avoidance:
    // Ray-march 12 samples from target towards desired camera position to detect terrain occlusions
    let safeDistance = this.radius;
    const rayDir = desiredOffset.clone().normalize();
    const sampleSteps = 12;
    for (let i = 1; i <= sampleSteps; i++) {
      const dist = (this.radius * i) / sampleSteps;
      const samplePos = this.target.clone().addScaledVector(rayDir, dist);
      const groundAtSample = getGlobalTerrainHeight(samplePos.x, samplePos.z);
      if (samplePos.y <= groundAtSample + 0.35) {
        safeDistance = Math.max(this.minCameraDistance, dist * 0.85);
        break;
      }
    }

    // Smooth damping of spring-arm distance to prevent jarring snaps
    const lerpSpeed = Math.min(1.0, 14.0 * dt);
    this.currentCameraDistance += (safeDistance - this.currentCameraDistance) * lerpSpeed;

    // Compute final camera position
    const finalPos = this.target.clone().addScaledVector(rayDir, this.currentCameraDistance);

    // Ensure camera never clips through terrain floor
    const camFloor = getGlobalTerrainHeight(finalPos.x, finalPos.z) + 0.45;
    if (finalPos.y < camFloor) {
      finalPos.y = camFloor;
    }

    this.camera.position.copy(finalPos);
    this.camera.lookAt(this.target);
  }

  public teleport(x: number, z: number, theta: number = 0, yOverride?: number) {
    const y = yOverride ?? this.getGroundedHeight(x, z);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = theta;
    this.theta = theta;
    this.state = MovementState.WALK;
    this.stateTimer = 0;
    this.speed = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isRolling = false;
    this.isCrouched = false;
    this.ledgeInfo = null;
    this.ledgeCooldown = 0;
    this.updateCamera(0.016);
  }
}
