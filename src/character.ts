import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from './input.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { physics } from './physics.js';
import { getGlobalTerrainHeight } from './terrain.js';
import { hairDark, leatherDark } from './materials.js';
import { createMistTexture } from './textures.js';
import { createClimbingAxe, createRecurveBow, createQuiver, createPineTorch } from './equipment.js';
import { waterDepthAt, waterSurfaceY } from './river.js';
import { SurvivalInstinctSystem } from './instinct.js';
import { BowSystem } from './bow.js';
import { climbingSystem, ClimbableWall } from './climbing.js';
import type { StealthSystem } from './combat/stealth.js';

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
      oxygen?: number;
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
  DIVE = 'DIVE',
  SLIDE = 'SLIDE',
  ROPE_SWING = 'ROPE_SWING',
  CROUCH = 'CROUCH',
  ROLL = 'ROLL'
}

const HIPS = 'mixamorigHips';

// Archery IK scratch (module-level: zero per-frame allocation while aiming)
const _UP = new THREE.Vector3(0, 1, 0);
const _Y = new THREE.Vector3(0, 1, 0);
const _ikPos = new THREE.Vector3(), _ikDir = new THREE.Vector3(), _ikCur = new THREE.Vector3();
const _ikS = new THREE.Vector3(), _ikE = new THREE.Vector3(), _ikH = new THREE.Vector3();
const _ikToT = new THREE.Vector3(), _ikPerp = new THREE.Vector3(), _ikElbow = new THREE.Vector3(), _ikEndT = new THREE.Vector3();
const _ikQa = new THREE.Quaternion(), _ikQb = new THREE.Quaternion(), _ikQc = new THREE.Quaternion();
const _aim = new THREE.Vector3(), _right = new THREE.Vector3();
const _sL = new THREE.Vector3(), _bowWrist = new THREE.Vector3(), _poleL = new THREE.Vector3(), _poleR = new THREE.Vector3();
const _headPos = new THREE.Vector3(), _lWrist = new THREE.Vector3(), _anchor = new THREE.Vector3();
const _relaxed = new THREE.Vector3(), _drawWrist = new THREE.Vector3();
const _grip = new THREE.Vector3(), _nock = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _xAx = new THREE.Vector3(), _yAx = new THREE.Vector3(), _zAx = new THREE.Vector3();
const _tmpA = new THREE.Vector3(), _tmpB = new THREE.Vector3(), _tmpC = new THREE.Vector3();
const _bowM = new THREE.Matrix4(), _bowLocal = new THREE.Matrix4();
const _leftHandPos = new THREE.Vector3(), _rightHandPos = new THREE.Vector3();
const _climbDir = new THREE.Vector3();

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
export function retargetMixamoClip(clip: THREE.AnimationClip, srcScene: THREE.Object3D, dstModel: THREE.Object3D): THREE.AnimationClip | null {
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

function createBubbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    // Outer glass bubble rim
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 240, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Subtle cyan interior fill
    const grad = ctx.createRadialGradient(32, 32, 10, 32, 32, 28);
    grad.addColorStop(0, 'rgba(120, 220, 255, 0.05)');
    grad.addColorStop(0.8, 'rgba(160, 235, 255, 0.25)');
    grad.addColorStop(1, 'rgba(210, 250, 255, 0.6)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Bright specular glint
    ctx.beginPath();
    ctx.arc(22, 22, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaterRippleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    // Concentric soft water ripple rings
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(230, 250, 245, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(64, 64, 42, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(190, 235, 230, 0.50)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(64, 64, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160, 220, 215, 0.30)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
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
  private targetTheta: number = 0;
  private targetPhi: number = Math.PI * 0.44;
  public radius: number = 4.8;
  public targetRadius: number = 4.8;
  public minCameraDistance: number = 2.0;
  public maxCameraDistance: number = 6.4;
  public target: THREE.Vector3 = new THREE.Vector3(0, 1.18, 0);
  public currentCameraDistance: number = 4.8;

  // Traversal State Machine
  public state: MovementState = MovementState.WALK;
  private stateTimer: number = 0;

  // Locomotion & Physics parameters (Tomb Raider / Assassin's Creed feel)
  public speed: number = 0;
  private facingDir: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private maxWalkSpeed: number = 2.4;
  private maxRunSpeed: number = 5.6;
  private maxCrouchSpeed: number = 1.5;
  private acceleration: number = 24.0;
  private airAcceleration: number = 9.5;
  private deceleration: number = 28.0;
  private brakingDeceleration: number = 44.0;
  private rotationSpeed: number = 16.0;
  private bankAngle: number = 0;

  // Vertical dynamics, jumping & coyote time
  public velocityY: number = 0;
  public isGrounded: boolean = true;
  private gravity: number = 18.0;
  private jumpForce: number = 6.4;
  public coyoteTimer: number = 0;
  public readonly coyoteDuration: number = 0.12;
  public jumpBufferTimer: number = 0;
  public readonly jumpBufferDuration: number = 0.14;
  public landingDip: number = 0;
  public landingRecoveryTimer: number = 0;

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

  // Craggy Cliff Climbing Axe Traversal (Shadow of the Tomb Raider North Star)
  public activeClimbWall: ClimbableWall | null = null;
  public climbCycle: number = 0;
  public hipAxe: THREE.Group | null = null;
  public leftHandAxe: THREE.Group | null = null;
  public rightHandAxe: THREE.Group | null = null;

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
  public currentRainIntensity: number = 0; // Weather rain coupling
  public isSheltered: boolean = false; // Rain shadow occlusion flag under overhangs/caves
  public mudSplatter: number = 0; // 0.0 (clean) to 1.0 (mud-caked)
  public charMaterials: THREE.MeshStandardMaterial[] = [];
  private waterDripParticles: THREE.Sprite[] = [];
  private waterDripAccum = 0;
  private waterDripMat: THREE.SpriteMaterial | null = null;

  // 6-DOF Underwater Cenote Diving (Shadow of the Tomb Raider North Star)
  public oxygen: number = 1.0; // 1.0 (100% full) to 0.0 (empty)
  public currentAirPocket: boolean = false; // Air-pocket cave dome flag
  public swimPitch: number = 0;
  public swimRoll: number = 0;
  public bubbleParticles: THREE.Sprite[] = [];
  public bubbleTimer: number = 0;
  public bubbleMat: THREE.SpriteMaterial | null = null;
  public swimStrokeTimer: number = 0;
  public waterRipples: Array<{ mesh: THREE.Mesh; life: number; maxLife: number }> = [];
  private rippleMat: THREE.MeshBasicMaterial | null = null;
  private rippleGeo: THREE.PlaneGeometry | null = null;
  public rippleTimer: number = 0;

  // Survival Pine Torch & Chiaroscuro Flame (Shadow of the Tomb Raider North Star)
  public isTorchEquipped: boolean = false;
  public torchData: ReturnType<typeof createPineTorch> | null = null;
  private torchEmberParticles: THREE.Sprite[] = [];
  private torchEmberMat: THREE.SpriteMaterial | null = null;
  private torchEmberTimer: number = 0;
  private leftHandBone: THREE.Object3D | null = null;
  private rightHandBone: THREE.Object3D | null = null;

  // Cinematic Camera Dynamics (Shoulder-Swap, Sprint Shake & FoV Punch)
  public shoulderSide: number = 1.0; // +1.0 = right shoulder, -1.0 = left shoulder
  private currentShoulderOffset: number = 0.38;

  // Survival Recurve Bow & Ballistic Arrow System (Shadow of the Tomb Raider North Star)
  public bowSystem: BowSystem | null = null;
  public spineBow: THREE.Group | null = null;
  public handBow: THREE.Group | null = null;
  public nockedArrow: THREE.Group | null = null;
  private drawnString: THREE.Mesh[] = [];
  private spine1Bone: THREE.Object3D | null = null;
  private spine2Bone: THREE.Object3D | null = null;
  private neckBone: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  public isAiming: boolean = false;
  public forceAim: boolean = false;
  public aimDrawTension: number = 0;

  // Archaeological Survival Instincts System (Shadow of the Tomb Raider North Star)
  public instinctSystem: SurvivalInstinctSystem;
  public stealthSystem: StealthSystem | null = null;

  // Cinematic Spring-Arm & Contextual Framing Dynamics (Shadow of the Tomb Raider North Star)
  public cameraImpulse: THREE.Vector3 = new THREE.Vector3();
  public impulseFovOffset: number = 0;
  public vistaPullRatio: number = 0; // 0.0 (flat/enclosed) to 1.0 (high canyon vista)
  public stealthFramingRatio: number = 0; // 0.0 (upright) to 1.0 (intimate stealth prowl)

  public addCameraImpulse(impulse: THREE.Vector3, fovKick: number = 0) {
    this.cameraImpulse.add(impulse);
    this.impulseFovOffset += fovKick;
  }

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;
    this.instinctSystem = new SurvivalInstinctSystem(scene);
    this.bowSystem = new BowSystem(scene);
    scene.add(climbingSystem.particlesGroup);

    // Protagonist root group — positioned in world coordinates
    this.mesh = new THREE.Group();
    this.mesh.rotation.order = 'YXZ'; // Critical: Yaw (heading) evaluates before Pitch (chest tilt)
    scene.add(this.mesh);

    // Asynchronously load the authentic female archaeologist model and retargeted animations
    this.load();

    // Camera initial orientation
    this.targetTheta = this.theta;
    this.targetPhi = this.phi;
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

        // Load authentic Tomb Raider adventurer texture atlas (olive cargo pants, dark leather, field gear)
        const texLoader = new THREE.TextureLoader();
        const customAlbedo = texLoader.load(`${import.meta.env.BASE_URL}assets/character-textures/naira_adventurer_albedo.png`);
        customAlbedo.colorSpace = THREE.SRGBColorSpace;
        customAlbedo.flipY = false;

        // Ensure authentic PBR realism on rigged character (strictly non-metallic skin & field clothing)
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.map = customAlbedo;
              mat.metalnessMap = null; // Strip embedded glossiness/metalness map to eliminate metallic sheen
              mat.roughnessMap = null; // Strip embedded roughness map to ensure uniform natural micro-roughness
              mat.metalness = 0.0; // Strictly non-metallic organic skin and field garments
              mat.roughness = 0.88; // Natural skin/fabric micro-roughness
              mat.envMapIntensity = 0.10; // Soft natural ambient bounce (eliminates metallic chrome sheen)
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
          axe.position.set(13.5, -6.0, 2.0); // hung vertically along right thigh holster
          axe.rotation.set(Math.PI, Math.PI * 0.5, 0); // blade flush along thigh (Z-axis), shaft hanging vertically down
          axe.scale.setScalar(80.0); // authentic compact technical climbing axe scale
          hipsBone.add(axe);
          this.hipAxe = axe;
        }

        if (spine2Bone) {
          // 2. Survival Recurve Bow across spine
          // Slung diagonally over right shoulder down to left rib, parallel behind quiver
          const bow = createRecurveBow();
          bow.position.set(4.0, 3.0, -12.5); // slung diagonally across upper back behind quiver
          bow.rotation.set(-0.25, -0.10, -0.48); // diagonal sling angle parallel to quiver
          bow.scale.setScalar(92.0); // 100x scale
          spine2Bone.add(bow);
          this.spineBow = bow;

          // 3. Arrow Quiver on right shoulder back
          const quiver = createQuiver();
          quiver.position.set(8.5, 7.0, -9.5);
          quiver.rotation.set(-0.25, -0.10, -0.55);
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
        this.leftHandBone = (model.getObjectByName('mixamorigLeftHand') ?? model.getObjectByName('mixamorig:LeftHand')) ?? null;
        if (this.leftHandBone) {
          const torch = createPineTorch();
          torch.group.position.set(1.5, 9.5, 2.5); // grip in cm coordinates
          torch.group.rotation.set(Math.PI / 2, 0, 0);
          torch.group.scale.setScalar(90.0);
          torch.group.visible = this.isTorchEquipped;
          this.leftHandBone.add(torch.group);
          this.torchData = torch;

          // Equipped survival recurve bow for active aiming. Parented to the
          // character root and placed every frame by applyBowAimPose() from the
          // IK-solved grip (left hand) and nock (right hand) — the hand bone's
          // roll is not trustworthy enough to hang a 1 m bow off.
          const handBow = createRecurveBow();
          handBow.visible = false;
          const bracedString = handBow.getObjectByName('BowString');
          if (bracedString) bracedString.visible = false;

          // Drawn V-string: two segments from the limb tips to the nock point
          const drawnStringMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.6, metalness: 0.0 });
          const drawnStringGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 5);
          this.drawnString = [new THREE.Mesh(drawnStringGeo, drawnStringMat), new THREE.Mesh(drawnStringGeo, drawnStringMat)];
          for (const seg of this.drawnString) handBow.add(seg);

          // Nocked feathered arrow resting on the shelf (placed by applyBowAimPose)
          if (this.bowSystem) {
            const arrow = this.bowSystem.createArrowMesh();
            // Arrowhead toward bow -Z (target side), nock toward +Z (string side)
            arrow.rotation.set(0, Math.PI, 0);
            handBow.add(arrow);
            this.nockedArrow = arrow;
          }

          this.mesh.add(handBow);
          this.handBow = handBow;
        }

        // Dual climbing axes for vertical cliff scaling (Shadow of the Tomb Raider North Star)
        // Parented to this.mesh (meter scale 1.0) and positioned analytically to follow hand bones
        this.leftHandAxe = createClimbingAxe();
        this.leftHandAxe.visible = false;
        this.mesh.add(this.leftHandAxe);

        this.rightHandAxe = createClimbingAxe();
        this.rightHandAxe.visible = false;
        this.mesh.add(this.rightHandAxe);

        this.rightHandBone = (model.getObjectByName('mixamorigRightHand') ?? model.getObjectByName('mixamorig:RightHand')) ?? null;
        const findBone = (n: string) => (model.getObjectByName(`mixamorig${n}`) ?? model.getObjectByName(`mixamorig:${n}`)) ?? null;
        this.spine1Bone = findBone('Spine1');
        this.spine2Bone = findBone('Spine2');
        this.neckBone = findBone('Neck');
        this.headBone = findBone('Head');

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

        // Procedural stalk stance (center of gravity lowering + spine lean) is used for crouching
        // to guarantee authentic bone posture without cross-rig distortion.

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

  public setTorch(equipped: boolean) {
    this.isTorchEquipped = equipped;
    if (this.torchData) {
      this.torchData.group.visible = equipped;
    }
  }

  public toggleTorch() {
    this.setTorch(!this.isTorchEquipped);
  }

  public releaseArrow() {
    if (!this.bowSystem) return;

    // Launch origin: bow rest position in world coordinates (or shoulder height)
    const origin = this.handBow
      ? this.handBow.getWorldPosition(new THREE.Vector3())
      : this.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));

    // Launch direction: along camera optical vector
    const launchDir = new THREE.Vector3();
    this.camera.getWorldDirection(launchDir);

    // Initial ballistic velocity: 22m/s (quick snap) to 42m/s (full draw)
    const speed = 22 + 20 * this.aimDrawTension;
    this.bowSystem.spawnArrow(origin, launchDir, speed);

    // Kinematic recoil impulse on arrow release (tactile physical kick)
    this.addCameraImpulse(launchDir.clone().multiplyScalar(-0.16 * (0.6 + 0.4 * this.aimDrawTension)), -2.2);

    // Reset draw tension and briefly hide nocked arrow
    this.aimDrawTension = 0;
    if (this.nockedArrow) this.nockedArrow.visible = false;
  }

  public setAim(aiming: boolean, tension: number = 0) {
    this.forceAim = aiming;
    this.isAiming = aiming;
    this.aimDrawTension = tension;
    if (this.spineBow) this.spineBow.visible = !aiming;
    if (this.handBow) this.handBow.visible = aiming;
    if (this.nockedArrow) {
      this.nockedArrow.visible = aiming;
    }
    this.bowSystem?.setAimHUD(aiming, tension);
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
    this.instinctSystem.trigger(this.mesh.position);
  }

  /**
   * Enters the craggy cliff wall climbing state (Shadow of the Tomb Raider North Star).
   * Snaps adventurer flush against rock surface, equips dual climbing axes, and triggers rock strike burst.
   */
  public startWallClimb(wall: ClimbableWall, contactPoint: THREE.Vector3, wallNormal: THREE.Vector3) {
    this.state = MovementState.CLIMB;
    this.activeClimbWall = wall;
    this.isGrounded = false;
    this.velocityY = 0;
    this.speed = 0;

    // Stand-off distance from cliff face: 0.32m keeps chest and boots properly braced
    this.mesh.position.copy(contactPoint).addScaledVector(wallNormal, 0.32);

    // Turn character to face directly flush against the cliff face
    this.mesh.rotation.y = Math.atan2(-wallNormal.x, -wallNormal.z);

    // Equip dual climbing axes in hands, hide hip axe
    if (this.hipAxe) this.hipAxe.visible = false;
    if (this.leftHandAxe) this.leftHandAxe.visible = true;
    if (this.rightHandAxe) this.rightHandAxe.visible = true;

    // Stow torch or bow if active
    if (this.torchData) this.torchData.group.visible = false;
    if (this.handBow) this.handBow.visible = false;
    this.isAiming = false;

    // Emit initial strike particles
    climbingSystem.emitRockStrike(contactPoint, wallNormal);
    this.climbCycle = 0;
  }

  public stopWallClimb() {
    this.activeClimbWall = null;
    if (this.hipAxe) this.hipAxe.visible = true;
    if (this.leftHandAxe) this.leftHandAxe.visible = false;
    if (this.rightHandAxe) this.rightHandAxe.visible = false;
    if (this.torchData && this.isTorchEquipped) {
      this.torchData.group.visible = true;
    }
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

  private detectStateTransitions(nextX: number, nextZ: number, terrainData: { y: number, normal: THREE.Vector3 }) {
    // Dynamic aquatic channel solve from river.ts
    const waterDepth = waterDepthAt(nextX, nextZ);
    const surfaceY = waterSurfaceY(nextX, nextZ);
    const isSwimmableWater = waterDepth > 1.2 && surfaceY !== null;

    if (this.state === MovementState.WALK) {
      _climbDir.set(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y)).normalize();
      const climbHit = climbingSystem.checkClimbableWall(this.mesh.position, _climbDir, 1.25);
      if (climbHit && (this.input.isDown('KeyW') || this.input.isDown('Space') || this.input.isDown('KeyE'))) {
        this.startWallClimb(climbHit.wall, climbHit.contactPoint, climbHit.wallNormal);
        return;
      }
    }

    if (this.state === MovementState.WALK && isSwimmableWater && surfaceY !== null && this.mesh.position.y < surfaceY - 0.2) {
      this.state = MovementState.SWIM;
    } else if ((this.state === MovementState.SWIM || this.state === MovementState.DIVE) && (!isSwimmableWater || (surfaceY !== null && terrainData.y > surfaceY - 0.5))) {
      this.state = MovementState.WALK;
      this.swimPitch = 0;
      this.swimRoll = 0;
      this.mesh.rotation.x = 0;
      this.mesh.rotation.z = 0;
    }

    const slope = 1.0 - terrainData.normal.y;
    // AAA Mud chute slide: only trigger on intentional steep mud chutes (slope > 0.40 / > 53° incline)
    // Prevents hijacking player controls on gentle 23° hillsides
    if (this.state === MovementState.WALK && slope > 0.40 && this.speed > 3.5) {
      this.state = MovementState.SLIDE;
    } else if (this.state === MovementState.SLIDE && slope < 0.15) {
      this.state = MovementState.WALK;
    }
  }

  public adjustCameraZoom(delta: number): void {
    this.targetRadius = THREE.MathUtils.clamp(this.targetRadius + delta, 2.2, this.maxCameraDistance);
  }

  public update(dt: number) {
    this.stateTimer += dt;
    this.time += dt;

    // 1. Consume camera mouse delta (with pointer lock or mouse drag) with cinematic exponential smoothing
    if (typeof this.input.getCameraDelta === 'function') {
      const camDelta = this.input.getCameraDelta();
      if (camDelta.x !== 0 || camDelta.y !== 0) {
        const mouseSensitivity = this.isAiming ? 0.0013 : 0.0022;
        this.targetTheta -= camDelta.x * mouseSensitivity;
        // Invert-pitch fix: moving mouse down (camDelta.y > 0) increases phi (tilts camera down toward character/ground)
        this.targetPhi += camDelta.y * mouseSensitivity;
        this.targetPhi = Math.max(0.08, Math.min(Math.PI * 0.48, this.targetPhi));
      }
    }
    const smoothAlpha = 1.0 - Math.exp(-28.0 * dt);
    this.theta += (this.targetTheta - this.theta) * smoothAlpha;
    this.phi += (this.targetPhi - this.phi) * smoothAlpha;

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

    // Survival pine torch toggle (KeyT)
    if (this.input.consumeJustPressed('KeyT')) {
      this.toggleTorch();
    }

    // Over-the-shoulder camera swap (KeyV)
    if (this.input.consumeJustPressed('KeyV')) {
      this.shoulderSide *= -1.0;
    }

    // Survival Recurve Bow Aiming & Release (Shadow of the Tomb Raider North Star)
    // Hold RMB or KeyF to aim; release LMB or Enter to fire arrow
    const aimRequested = (this.forceAim || this.input.isMouseButtonDown(2) || this.input.isDown('KeyF')) &&
      this.state !== MovementState.SWIM &&
      this.state !== MovementState.DIVE &&
      this.state !== MovementState.SLIDE &&
      this.state !== MovementState.MANTLE &&
      this.state !== MovementState.WALL_SCRAMBLE;

    if (aimRequested) {
      if (!this.isAiming) {
        this.isAiming = true;
        this.aimDrawTension = 0;
      }
      this.aimDrawTension = Math.min(1.0, this.aimDrawTension + dt * 2.2);

      // Lock adventurer facing to camera azimuth while aiming
      this.mesh.rotation.y = this.theta;

      if (this.spineBow) this.spineBow.visible = false;
      if (this.handBow) this.handBow.visible = true;
      if (this.nockedArrow) {
        this.nockedArrow.visible = true;
      }

      this.bowSystem?.setAimHUD(true, this.aimDrawTension);

      // Fire arrow on Left Mouse Click or Enter
      if (this.input.consumeMouseButtonJustPressed(0) || this.input.consumeJustPressed('Enter')) {
        this.releaseArrow();
      }
    } else if (this.isAiming) {
      this.isAiming = false;
      this.aimDrawTension = 0;
      if (this.spineBow) this.spineBow.visible = true;
      if (this.handBow) this.handBow.visible = false;
      if (this.nockedArrow) this.nockedArrow.visible = false;
      this.bowSystem?.setAimHUD(false);
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

    // Jump Buffer & Coyote Time update
    if (this.isGrounded) {
      this.coyoteTimer = this.coyoteDuration;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.input.consumeJustPressed('Space')) {
      this.jumpBufferTimer = this.jumpBufferDuration;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Can jump if grounded or within coyote time window
    const canJump = (this.isGrounded || this.coyoteTimer > 0) &&
      this.jumpBufferTimer > 0 &&
      !this.isRolling &&
      (this.state === MovementState.WALK || this.state === MovementState.CROUCH);

    if (canJump) {
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;

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
      this.facingDir.copy(moveDir);

      // Snappy turning: rotate mesh directly towards move direction with speed-dependent angular lerp
      const targetAngle = Math.atan2(-moveDir.x, -moveDir.z);
      let angleDiff = targetAngle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Agile turns when walking, athletic momentum arc when sprinting
      const turnAgility = this.speed > this.maxWalkSpeed ? 14.0 : 18.0;
      this.mesh.rotation.y += angleDiff * Math.min(1.0, turnAgility * dt);

      // Skid momentum bleed on sharp turnaround pivots (> 120°)
      if (Math.abs(angleDiff) > 2.1 && this.speed > this.maxWalkSpeed && this.isGrounded) {
        this.speed = Math.max(this.maxWalkSpeed * 0.8, this.speed - this.brakingDeceleration * dt * 0.6);
      }

      // Athletic body banking lean into turns
      const targetBank = THREE.MathUtils.clamp(-angleDiff * (this.speed / this.maxRunSpeed) * 0.16, -0.15, 0.15);
      this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, targetBank, Math.min(1.0, 10.0 * dt));

      // Speed selection
      let targetSpeed: number;
      if (this.state === MovementState.SWIM) {
        if (joystickActive) {
          const t = THREE.MathUtils.clamp((this.input.joystickMagnitude - 0.35) / (0.95 - 0.35), 0, 1);
          targetSpeed = 1.6 + 1.1 * t; // 1.6 m/s gentle surface swim to 2.7 m/s sprint swim
        } else {
          targetSpeed = isRunning ? 2.6 : 1.7;
        }
      } else if (this.isRolling) {
        targetSpeed = this.maxRunSpeed * 1.35;
      } else if (this.isCrouched) {
        targetSpeed = this.maxCrouchSpeed;
      } else if (joystickActive) {
        const t = THREE.MathUtils.clamp((this.input.joystickMagnitude - 0.35) / (0.95 - 0.35), 0, 1);
        targetSpeed = this.maxWalkSpeed + (this.maxRunSpeed - this.maxWalkSpeed) * t * t;
      } else {
        targetSpeed = isRunning ? this.maxRunSpeed : this.maxWalkSpeed;
      }

      // Landing recovery speed dampening
      if (this.landingRecoveryTimer > 0) {
        targetSpeed = Math.min(targetSpeed, this.maxWalkSpeed * 0.85);
        this.landingRecoveryTimer = Math.max(0, this.landingRecoveryTimer - dt);
      }

      const currentAccel = this.isGrounded ? this.acceleration : this.airAcceleration;
      this.speed = Math.min(targetSpeed, this.speed + currentAccel * dt);
    } else {
      // Natural deceleration along travel direction with ground friction
      this.speed = Math.max(0, this.speed - this.deceleration * dt);
      if (this.speed < 0.05) {
        this.speed = 0;
      }
      this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, 0, Math.min(1.0, 12.0 * dt));
    }

    if (this.speed > 0) {
      const travelDir = moveDir.lengthSq() > 0.001 ? moveDir : this.facingDir;
      const stepDist = this.speed * dt;
      const desiredX = travelDir.x * stepDist;
      const desiredZ = travelDir.z * stepDist;

      // Rapier Kinematic Character Controller collision resolution:
      // Computes obstacle collision, wall-sliding, 50° slope climb blocking, and autostepping
      if (physics.characterController && this.collider) {
        physics.characterController.computeColliderMovement(this.collider, {
          x: desiredX,
          y: 0,
          z: desiredZ,
        });
        const safeMove = physics.characterController.computedMovement();
        this.mesh.position.x += safeMove.x;
        this.mesh.position.z += safeMove.z;
      } else {
        this.mesh.position.x += desiredX;
        this.mesh.position.z += desiredZ;
      }
    }

    // Terrain sampling & grounding
    const terrainData = this.getTerrainHeightAndNormal(this.mesh.position.x, this.mesh.position.z);
    this.detectStateTransitions(this.mesh.position.x, this.mesh.position.z, terrainData);

    const groundH = this.getGroundedHeight(this.mesh.position.x, this.mesh.position.z);

    const surfaceY = waterSurfaceY(this.mesh.position.x, this.mesh.position.z) ?? (groundH + 4.0);

    if (this.state === MovementState.SWIM) {
      this.oxygen = Math.min(1.0, this.oxygen + dt * 2.0); // Surface breathing recharge
      const bob = Math.sin(this.time * 2.2) * 0.04;
      const targetWaterY = surfaceY - 1.25 + bob;
      this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetWaterY, 8.0 * dt);

      // Gentle river current drift when player is moving slowly or idle
      if (this.speed < 0.4) {
        this.mesh.position.z -= 0.35 * dt;
      }

      if (this.mesh.position.y < groundH) {
        this.mesh.position.y = groundH;
      }
      this.isGrounded = false;
      this.velocityY = 0;

      // Smooth pitch: lean forward slightly into water stroke when swimming, upright when treading
      const targetPitch = this.speed > 0.2 ? -0.12 : 0.0;
      this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, 6.0 * dt);

      // Water surface ripple ring emitter
      this.rippleTimer += dt;
      if (this.rippleTimer > (this.speed > 0.5 ? 0.35 : 0.75)) {
        this.rippleTimer = 0;
        if (!this.rippleMat || !this.rippleGeo) {
          this.rippleMat = new THREE.MeshBasicMaterial({
            map: createWaterRippleTexture(),
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          this.rippleGeo = new THREE.PlaneGeometry(1.3, 1.3);
          this.rippleGeo.rotateX(-Math.PI / 2);
        }
        const ripple = new THREE.Mesh(this.rippleGeo, this.rippleMat.clone());
        ripple.position.set(this.mesh.position.x, surfaceY + 0.02, this.mesh.position.z);
        this.mesh.parent?.add(ripple);
        this.waterRipples.push({ mesh: ripple, life: 0, maxLife: 1.8 });
      }

      // Dive underwater input (KeyC)
      if (this.input.consumeJustPressed('KeyC')) {
        this.state = MovementState.DIVE;
        this.velocityY = -2.2;
      }
    } else if (this.state === MovementState.DIVE) {
      // 6-DOF Submerged Cenote Diving Physics (Shadow of the Tomb Raider North Star)
      if (this.currentAirPocket && this.mesh.position.y >= surfaceY - 1.25) {
        // Surfaced inside subterranean air pocket: replenish breath reserve rapidly
        this.oxygen = Math.min(1.0, this.oxygen + dt * 0.75);
      } else {
        this.oxygen = Math.max(0.0, this.oxygen - dt / 35.0); // 35s breath reserve
      }
      this.isGrounded = false;

      // 3D camera-aligned swimming vector
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      let forwardInput = forward;
      let strafeInput = right;

      let verticalInput = 0;
      if (this.input.isDown('Space')) verticalInput += 1; // Surface
      if (this.input.isDown('KeyC')) verticalInput -= 1; // Dive deeper

      // Positive neutral buoyancy (gentle upward drift when idle)
      const buoyancy = 0.35;
      this.velocityY = THREE.MathUtils.clamp(this.velocityY + (verticalInput * 3.0 + buoyancy) * dt, -3.5, 3.0);

      const isRunningSwim = this.input.isDown('ShiftLeft');
      const swimSpeed = isRunningSwim ? 3.2 : 2.2;
      const move3D = camDir.clone().multiplyScalar(forwardInput)
        .add(camRight.clone().multiplyScalar(strafeInput));

      if (move3D.lengthSq() > 0.001) {
        move3D.normalize();
        this.mesh.position.addScaledVector(move3D, swimSpeed * dt);
        const targetYaw = Math.atan2(-move3D.x, -move3D.z);
        let yawDiff = targetYaw - this.mesh.rotation.y;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        this.mesh.rotation.y += yawDiff * Math.min(1.0, 8.0 * dt);

        const targetPitch = Math.asin(THREE.MathUtils.clamp(move3D.y, -0.85, 0.85));
        this.swimPitch = THREE.MathUtils.lerp(this.swimPitch, -1.15 - targetPitch * 0.45, 8.0 * dt);
      } else {
        this.swimPitch = THREE.MathUtils.lerp(this.swimPitch, -1.15, 4.0 * dt);
      }

      this.mesh.position.y += this.velocityY * dt;
      this.mesh.rotation.x = this.swimPitch;

      // Cenote bottom collider check
      if (this.mesh.position.y < groundH + 0.35) {
        this.mesh.position.y = groundH + 0.35;
        this.velocityY = Math.max(0, this.velocityY);
      }

      // Break surface and transition to SWIM
      if (this.mesh.position.y >= surfaceY - 1.25 && (verticalInput > 0 || this.velocityY > 0.2 || (forwardInput > 0 && camDir.y > 0.15))) {
        this.state = MovementState.SWIM;
        this.mesh.position.y = surfaceY - 1.20;
        this.velocityY = 0;
        this.swimPitch = -0.35;
        this.mesh.rotation.x = -0.35;
      }

      // Air Bubble Particle Emitter
      this.bubbleTimer += dt;
      if (this.bubbleTimer >= 1.1) {
        this.bubbleTimer = 0;
        if (!this.bubbleMat) {
          this.bubbleMat = new THREE.SpriteMaterial({
            map: createBubbleTexture(),
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          });
        }
        const burstCount = 2 + Math.floor(Math.random() * 3);
        for (let b = 0; b < burstCount; b++) {
          const bubble = new THREE.Sprite(this.bubbleMat);
          bubble.scale.setScalar(0.06 + Math.random() * 0.05);
          const mouthOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            0.65 + (Math.random() - 0.5) * 0.1,
            -0.35
          ).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
          bubble.position.copy(this.mesh.position).add(mouthOffset);
          this.mesh.parent?.add(bubble);
          this.bubbleParticles.push(bubble);
        }
      }

      // Update bubbles: float upwards and pop at water surface
      for (let i = this.bubbleParticles.length - 1; i >= 0; i--) {
        const b = this.bubbleParticles[i];
        b.position.y += dt * 1.8;
        b.position.x += Math.sin(this.time * 6 + i) * dt * 0.25;
        b.scale.addScalar(dt * 0.04);
        if (b.position.y >= surfaceY || b.scale.x > 0.22) {
          b.parent?.remove(b);
          this.bubbleParticles.splice(i, 1);
        }
      }
    } else if (this.state === MovementState.CLIMB) {
      if (this.activeClimbWall) {
        const wall = this.activeClimbWall;
        const forwardInput = (this.input.isDown('KeyW') ? 1 : 0) - (this.input.isDown('KeyS') ? 1 : 0);
        const lateralInput = (this.input.isDown('KeyD') ? 1 : 0) - (this.input.isDown('KeyA') ? 1 : 0);

        const climbSpeedV = 1.8;
        const climbSpeedH = 1.5;

        // 1. Move vertically (W/S)
        this.mesh.position.y += forwardInput * climbSpeedV * dt;

        // 2. Move laterally along wall tangent (A/D)
        this.mesh.position.addScaledVector(wall.tangent, lateralInput * climbSpeedH * dt);

        // 3. Keep clamped to wall face depth and lateral bounds
        const halfW = wall.width * 0.5 - 0.35;
        const toChar = this.mesh.position.clone().sub(wall.center);
        const latDist = toChar.dot(wall.tangent);
        const clampedLat = THREE.MathUtils.clamp(latDist, -halfW, halfW);

        const currentClimbY = this.mesh.position.y;
        // Re-project position onto wall surface with 0.32m stand-off
        this.mesh.position.copy(wall.center)
          .addScaledVector(wall.tangent, clampedLat)
          .addScaledVector(wall.normal, 0.32);
        this.mesh.position.y = THREE.MathUtils.clamp(currentClimbY, wall.bottomY + 0.5, wall.topY + 0.1);

        // Keep character facing directly into the wall
        this.mesh.rotation.y = Math.atan2(-wall.normal.x, -wall.normal.z);

        // Advance climb cycle for alternating pick strikes and foot movements
        const isMoving = Math.abs(forwardInput) > 0.01 || Math.abs(lateralInput) > 0.01;
        if (isMoving) {
          const prevCycle = this.climbCycle;
          this.climbCycle += dt * 3.5;

          // If crossing cycle boundary (alternating pick strike), emit rock crumb burst!
          if (Math.floor(this.climbCycle) !== Math.floor(prevCycle)) {
            const pickPos = this.mesh.position.clone()
              .addScaledVector(wall.normal, -0.28)
              .addScaledVector(new THREE.Vector3(0, 1, 0), 1.25);
            const isRight = Math.floor(this.climbCycle) % 2 === 0;
            pickPos.addScaledVector(wall.tangent, isRight ? 0.22 : -0.22);
            climbingSystem.emitRockStrike(pickPos, wall.normal);
          }
        }

        // 4. Check Top Lip Mantle:
        if (this.mesh.position.y >= wall.topY - 0.25 && (forwardInput > 0 || this.input.consumeJustPressed('Space'))) {
          this.state = MovementState.MANTLE;
          this.mantleTimer = 0;
          this.mantleStartPosition.copy(this.mesh.position);
          this.ledgeInfo = {
            ledgeY: wall.topY,
            wallNormal: wall.normal.clone(),
            hangPosition: this.mesh.position.clone(),
            mantleTargetPosition: wall.mantlePosition.clone(),
          };
          this.stopWallClimb();
          this.updateAnimationAndCamera(dt);
          return;
        }

        // 5. Wall Leap / Eject:
        if (this.input.consumeJustPressed('Space')) {
          const wallNorm = wall.normal.clone();
          this.stopWallClimb();
          this.state = MovementState.WALK;
          this.isGrounded = false;
          this.velocityY = 5.2; // upward leap
          this.speed = 4.0;
          this.mesh.position.addScaledVector(wallNorm, 0.45);
          return;
        }

        // 6. Drop / Release:
        if (this.input.consumeJustPressed('KeyC') || this.input.consumeJustPressed('ShiftLeft')) {
          const wallNorm = wall.normal.clone();
          this.stopWallClimb();
          this.state = MovementState.WALK;
          this.isGrounded = false;
          this.velocityY = -0.5;
          this.mesh.position.addScaledVector(wallNorm, 0.35);
          return;
        }
      }
      this.isGrounded = false;
      this.velocityY = 0;
      this.speed = 0;
    } else {
      // Grounded vs Airborne physics
      if (!this.isGrounded) {
        // Asymmetric gravity: snappy athletic fall (1.38x), variable jump height on early release (1.55x)
        const isHoldingJump = this.input.isDown('Space');
        let effectiveGravity = this.gravity;
        if (this.velocityY > 0) {
          effectiveGravity = isHoldingJump ? this.gravity : this.gravity * 1.55;
        } else {
          effectiveGravity = this.gravity * 1.38;
        }
        this.velocityY -= effectiveGravity * dt;
        this.velocityY = Math.max(-24.0, this.velocityY); // Clamped terminal velocity
        this.mesh.position.y += this.velocityY * dt;

        if (this.mesh.position.y <= groundH) {
          const fallImpactSpeed = Math.abs(this.velocityY);
          this.mesh.position.y = groundH;
          this.velocityY = 0;
          this.isGrounded = true;

          // Physical landing weight & camera compression
          if (fallImpactSpeed > 5.5) {
            this.landingRecoveryTimer = 0.16;
            this.landingDip = Math.min(0.20, (fallImpactSpeed / 20.0) * 0.20);
          }
        } else if (this.velocityY <= 3.5 && this.ledgeCooldown <= 0) {
          // Mid-air craggy cliff climb grab check (strike axes into rock)
          _climbDir.set(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y)).normalize();
          const airDir = moveDir.lengthSq() > 0.001 ? moveDir : _climbDir;
          const airClimbHit = climbingSystem.checkClimbableWall(this.mesh.position, airDir, 1.35);
          if (airClimbHit) {
            this.startWallClimb(airClimbHit.wall, airClimbHit.contactPoint, airClimbHit.wallNormal);
            this.updateAnimationAndCamera(dt);
            return;
          }

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
        // Step-up / step-down tolerance, downhill slope snapping & drop detection
        const diff = groundH - this.mesh.position.y;
        if (diff < 0 && diff >= -0.48) {
          // Downhill slope snapping: firmly glue feet to terrain, eliminating downhill bounce/micro-hops
          this.mesh.position.y = groundH;
        } else if (diff >= 0 && diff <= 0.40) {
          // Step-up tolerance for steps, stairs, rocks, terraces
          if (diff < 0.20) {
            this.mesh.position.y = groundH;
          } else {
            this.mesh.position.y += diff * Math.min(1.0, 30.0 * dt);
          }
        } else if (diff < -0.48) {
          // True drop-off / cliff edge: begin falling
          this.isGrounded = false;
          this.velocityY = 0;
        } else if (diff > 0.40 && this.speed > 1.6 && this.ledgeCooldown <= 0) {
          // Running against a low ledge / stone terrace: auto-mantle
          const runLedge = this.checkLedge(moveDir.lengthSq() > 0.001 ? moveDir : undefined);
          if (runLedge && (runLedge.ledgeY - this.mesh.position.y) <= 1.45) {
            this.ledgeInfo = runLedge;
            this.state = MovementState.MANTLE;
            this.mantleTimer = 0;
            this.mantleStartPosition.copy(this.mesh.position);
            this.updateAnimationAndCamera(dt);
            return;
          }
        }
        // Strict guarantee: feet NEVER sink under soil
        if (this.mesh.position.y < groundH) {
          this.mesh.position.y = groundH;
        }
      }
    }

    // Sync kinematic physics body if present: capsule center is at torso (y + 0.9m)
    if (this.body) {
      this.body.setNextKinematicTranslation({
        x: this.mesh.position.x,
        y: this.mesh.position.y + 0.9,
        z: this.mesh.position.z
      });
    }

    // Update water surface ripple particles
    for (let i = this.waterRipples.length - 1; i >= 0; i--) {
      const r = this.waterRipples[i];
      r.life += dt;
      const progress = r.life / r.maxLife;
      if (progress >= 1.0) {
        r.mesh.parent?.remove(r.mesh);
        this.waterRipples.splice(i, 1);
      } else {
        const scale = 1.0 + progress * 2.2;
        r.mesh.scale.set(scale, 1, scale);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - progress) * 0.65;
      }
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

    if ((this.state === MovementState.SWIM || this.state === MovementState.DIVE) && this.isTorchEquipped) {
      this.setTorch(false);
    }

    this.updateWetnessAndMud(dt, groundH);
    this.updateMudParticles(dt);
    this.updateTorch(dt);
    this.instinctSystem.update(dt);
    this.bowSystem?.update(dt, physics, this.stealthSystem ?? undefined);
    climbingSystem.update(dt);
    this.updateAnimationAndCamera(dt);
  }

  private updateWetnessAndMud(dt: number, groundH: number) {
    // Dynamic Surface Wetness & Mud Washed Off in Water (Shadow of the Tomb Raider North Star)
    const isRiverCorridor = Math.abs(this.mesh.position.x) < 22 && this.mesh.position.y < 1.0;
    const effectiveRain = this.isSheltered ? 0.0 : this.currentRainIntensity;
    if (this.state === MovementState.SWIM || isRiverCorridor || effectiveRain > 0.08) {
      const soakRate = effectiveRain > 0.08 ? (effectiveRain * 1.6) : 3.0;
      this.wetness = Math.min(1.0, this.wetness + dt * soakRate);
      if (effectiveRain > 0.3) {
        this.mudSplatter = Math.max(0.0, this.mudSplatter - dt * effectiveRain * 0.45);
      }
    } else {
      // Natural evaporation drying curve (dries over ~20s under shelter or clear skies)
      this.wetness = Math.max(0.0, this.wetness - dt / 20.0);
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
      const wetRoughness = THREE.MathUtils.lerp(baseRoughness, 0.52, this.wetness);
      mat.roughness = THREE.MathUtils.lerp(wetRoughness, 0.92, this.mudSplatter);
      mat.envMapIntensity = THREE.MathUtils.lerp(0.25, 0.45, this.wetness);
      mat.metalness = 0.0; // Strictly non-metallic organic skin and field garments

      const wetDarkening = 1.0 - 0.22 * this.wetness;
      const r = wetDarkening * (1.0 - 0.12 * this.mudSplatter);
      const g = wetDarkening * (1.0 - 0.22 * this.mudSplatter);
      const b = wetDarkening * (1.0 - 0.35 * this.mudSplatter);
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

  private updateTorch(dt: number) {
    if (!this.torchData) return;

    if (this.isTorchEquipped) {
      // 1. Turbulent organic flame flicker
      const flicker = Math.sin(this.time * 18.0) * 0.35 + Math.sin(this.time * 31.0) * 0.2 + (Math.random() - 0.5) * 0.15;
      this.torchData.light.intensity = Math.max(0.8, 2.6 + flicker);

      // Flame cone pulsates and stretches
      const pulseY = 1.0 + Math.sin(this.time * 15.0) * 0.15;
      const pulseXZ = 1.0 + Math.sin(this.time * 24.0) * 0.1;
      this.torchData.flameMesh.scale.set(pulseXZ, pulseY, pulseXZ);

      // 2. Rising ember spark particles
      this.torchEmberTimer += dt;
      if (this.torchEmberTimer > 0.07) {
        this.torchEmberTimer = 0;
        if (!this.torchEmberMat) {
          this.torchEmberMat = new THREE.SpriteMaterial({
            map: createMistTexture(),
            color: 0xff7722,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
        }
        const ember = new THREE.Sprite(this.torchEmberMat);
        ember.scale.setScalar(0.025 + Math.random() * 0.02);
        const worldTip = new THREE.Vector3();
        this.torchData.flameMesh.getWorldPosition(worldTip);
        ember.position.copy(worldTip).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.04,
          0.02,
          (Math.random() - 0.5) * 0.04
        ));
        this.mesh.parent?.add(ember);
        this.torchEmberParticles.push(ember);
      }
    }

    // Update ember particles regardless of equipped state
    for (let i = this.torchEmberParticles.length - 1; i >= 0; i--) {
      const p = this.torchEmberParticles[i];
      p.position.y += dt * 0.85;
      p.position.x += Math.sin(this.time * 8.0 + i) * dt * 0.12;
      p.position.z += Math.cos(this.time * 8.0 + i) * dt * 0.12;
      p.material.opacity -= dt * 1.5;
      p.scale.subScalar(dt * 0.018);
      if (p.material.opacity <= 0 || p.scale.x <= 0.005) {
        p.parent?.remove(p);
        this.torchEmberParticles.splice(i, 1);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Archery aim pose (world-space IK). All scratch is module-level (no per-frame
  // allocation — standing performance directives).
  // --------------------------------------------------------------------------

  /** Rotate `bone` (minimal arc, preserving the animation's twist) so its child points at `target`. */
  private aimBoneAt(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
    const pos = bone.getWorldPosition(_ikPos);
    const dir = _ikDir.subVectors(target, pos);
    if (dir.lengthSq() < 1e-10) return;
    dir.normalize();
    bone.parent!.getWorldQuaternion(_ikQa).invert();
    dir.applyQuaternion(_ikQa); // desired child direction in parent space
    const cur = _ikCur.copy(child.position).normalize().applyQuaternion(bone.quaternion);
    _ikQb.setFromUnitVectors(cur, dir);
    bone.quaternion.premultiply(_ikQb);
    bone.updateMatrixWorld(true);
  }

  /** Classic two-bone IK: law-of-cosines elbow placed toward `pole`. */
  private solveTwoBone(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3) {
    const S = upper.getWorldPosition(_ikS);
    const a = lower.getWorldPosition(_ikE).distanceTo(S);
    const b = end.getWorldPosition(_ikH).distanceTo(_ikE);
    const toT = _ikToT.subVectors(target, S);
    const d = THREE.MathUtils.clamp(toT.length(), 1e-4, (a + b) * 0.999);
    toT.normalize();
    const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const perp = _ikPerp.copy(pole).addScaledVector(toT, -pole.dot(toT));
    if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
    perp.normalize();
    const elbow = _ikElbow.copy(S).addScaledVector(toT, cosA * a).addScaledVector(perp, sinA * a);
    const endTarget = _ikEndT.copy(S).addScaledVector(toT, d);
    this.aimBoneAt(upper, lower, elbow);
    this.aimBoneAt(lower, end, endTarget);
  }

  /** Rotate a bone about a WORLD axis (used for the side-on torso turn and head counter-turn). */
  private rotateBoneWorld(bone: THREE.Object3D, axis: THREE.Vector3, angle: number) {
    const p = bone.parent!.getWorldQuaternion(_ikQa);
    _ikQb.setFromAxisAngle(axis, angle);
    // L' = P⁻¹ · Q · P · L
    const delta = _ikQc.copy(p).invert().multiply(_ikQb).multiply(p);
    bone.quaternion.premultiply(delta);
    bone.updateMatrixWorld(true);
  }

  private applyBowAimPose() {
    const la = this.leftArmBone!, lfa = this.leftForeArmBone, lh = this.leftHandBone;
    const ra = this.rightArmBone!, rfa = this.rightForeArmBone, rh = this.rightHandBone;
    if (!lfa || !lh || !rfa || !rh) return;

    this.mesh.updateMatrixWorld(true);
    const aim = this.camera.getWorldDirection(_aim);
    const right = _right.crossVectors(aim, _UP).normalize();

    // 1. Side-on archer stance: torso turns ~40° clockwise (from above) so the
    //    bow shoulder leads toward the target, like Lara's draw in SOTTR.
    if (this.spine1Bone) this.rotateBoneWorld(this.spine1Bone, _UP, -0.30);
    if (this.spine2Bone) this.rotateBoneWorld(this.spine2Bone, _UP, -0.30);
    // Head counter-turns to keep the eyes on the line of the arrow.
    if (this.neckBone) this.rotateBoneWorld(this.neckBone, _UP, 0.30);
    if (this.headBone) this.rotateBoneWorld(this.headBone, _UP, 0.22);

    // 2. Bow arm: nearly straight along the aim line from the left shoulder,
    //    elbow rotated down/out (the classic archer's elbow).
    const sL = la.getWorldPosition(_sL);
    const reachL = lfa.getWorldPosition(_tmpA).distanceTo(sL) + lh.getWorldPosition(_tmpB).distanceTo(_tmpA);
    const bowWrist = _bowWrist.copy(sL).addScaledVector(aim, reachL * 0.97);
    const poleL = _poleL.set(0, -1, 0).addScaledVector(right, -0.6);
    this.solveTwoBone(la, lfa, lh, bowWrist, poleL);

    // 3. Draw hand: from the bow toward the cheek anchor as tension builds.
    const headPos = (this.headBone ?? this.neckBone ?? ra).getWorldPosition(_headPos);
    const lWrist = lh.getWorldPosition(_lWrist);
    const anchor = _anchor.copy(headPos).addScaledVector(right, 0.09).addScaledVector(_UP, -0.06);
    const relaxed = _relaxed.copy(lWrist).addScaledVector(aim, -0.30);
    const drawWrist = _drawWrist.copy(relaxed).lerp(anchor, THREE.MathUtils.clamp(this.aimDrawTension, 0, 1));
    // Draw elbow sits high and behind, in line with the arrow
    const poleR = _poleR.copy(right).addScaledVector(aim, -1.0).addScaledVector(_UP, 0.35);
    this.solveTwoBone(ra, rfa, rh, drawWrist, poleR);

    // 4. Bow + arrow + V-string placed between the solved hands.
    if (!this.handBow) return;
    const lElbow = lfa.getWorldPosition(_tmpA);
    const grip = _grip.copy(lh.getWorldPosition(_lWrist)).addScaledVector(_tmpB.subVectors(_lWrist, lElbow).normalize(), 0.075);
    const rElbow = rfa.getWorldPosition(_tmpA);
    const nock = _nock.copy(rh.getWorldPosition(_tmpC)).addScaledVector(_tmpB.subVectors(_tmpC, rElbow).normalize(), 0.06);

    const f = _fwd.subVectors(grip, nock);
    const drawLen = f.length();
    if (drawLen < 1e-4) f.copy(aim); else f.divideScalar(drawLen);
    const zAxis = _zAx.copy(f).negate();                    // bow +Z = string/archer side
    const yAxis = _yAx.copy(_UP).addScaledVector(zAxis, -_UP.dot(zAxis)).normalize();
    yAxis.applyAxisAngle(f, -0.12);                          // slight canted grip
    const xAxis = _xAx.crossVectors(yAxis, zAxis).normalize();
    _bowM.makeBasis(xAxis, yAxis, zAxis);
    // Grip (bow-local (0,0,-0.14)) sits in the left palm
    _bowM.setPosition(_tmpA.copy(grip).addScaledVector(zAxis, 0.14));
    _bowLocal.copy(this.mesh.matrixWorld).invert().multiply(_bowM);
    _bowLocal.decompose(this.handBow.position, this.handBow.quaternion, this.handBow.scale);

    // Nock point in bow-local space: on the arrow line, drawLen behind the grip
    const nockZ = -0.14 + drawLen;
    if (this.nockedArrow) {
      // Arrow centre is 0.36 m ahead of its nock; rests on the shelf left of the grip
      this.nockedArrow.position.set(-0.016, 0, nockZ - 0.36);
    }
    // V-string: limb tips (0, ±0.525, 0.06) to the nock
    for (let i = 0; i < this.drawnString.length; i++) {
      const seg = this.drawnString[i];
      const tip = _tmpA.set(0, i === 0 ? 0.525 : -0.525, 0.06);
      const n = _tmpB.set(0, 0, nockZ);
      const dir = _tmpC.subVectors(n, tip);
      const len = dir.length();
      seg.position.copy(tip).addScaledVector(dir, 0.5);
      seg.quaternion.setFromUnitVectors(_Y, dir.divideScalar(len));
      seg.scale.set(1, len, 1);
    }
  }

  private updateAnimationAndCamera(dt: number) {
    // Skeletal animation updates
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Procedural crouched stalk posture (Shadow of the Tomb Raider North Star)
    if (this.isCrouched && this.characterModel && !this.isRolling && this.state !== MovementState.CLIMB && this.state !== MovementState.SWIM && this.state !== MovementState.DIVE) {
      this.characterModel.position.y = THREE.MathUtils.lerp(this.characterModel.position.y, this.modelBaseY - 0.28, Math.min(1.0, 12.0 * dt));
      if (this.spine1Bone) {
        this.spine1Bone.rotation.x += 0.22;
      }
      if (this.neckBone) {
        this.neckBone.rotation.x -= 0.12;
      }
    } else if (this.characterModel && !this.isRolling && this.state !== MovementState.SWIM && this.state !== MovementState.DIVE) {
      this.characterModel.position.y = THREE.MathUtils.lerp(this.characterModel.position.y, this.modelBaseY, Math.min(1.0, 12.0 * dt));
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
    } else if (this.state === MovementState.SWIM || this.state === MovementState.DIVE) {
      // Natural aquatic locomotion driven by retargeted Mixamo clips
      // Elevate chin and gaze forward across water surface / flooded cavern
      if (this.neckBone) this.neckBone.rotation.set(0.28, 0, 0);
      if (this.headBone) this.headBone.rotation.set(0.18, 0, 0);
    } else if (this.state === MovementState.CLIMB) {
      // Shadow of the Tomb Raider North Star: Climbing Axe Wall Traversal Pose
      const cycle = this.climbCycle * Math.PI;
      const leftReach = Math.sin(cycle);
      const rightReach = -leftReach;

      if (this.leftArmBone && this.rightArmBone) {
        const leftArmLift = -1.25 - leftReach * 0.22;
        const rightArmLift = -1.25 - rightReach * 0.22;
        this.leftArmBone.rotation.set(leftArmLift, 0.18, 0.22);
        this.rightArmBone.rotation.set(rightArmLift, -0.18, -0.22);

        if (this.leftForeArmBone) {
          this.leftForeArmBone.rotation.set(0.55 + leftReach * 0.12, 0, 0);
        }
        if (this.rightForeArmBone) {
          this.rightForeArmBone.rotation.set(0.55 + rightReach * 0.12, 0, 0);
        }
      }

      // Legs: bent at knees, bracing against vertical stone face
      if (this.leftUpLegBone && this.rightUpLegBone) {
        const leftLegKick = Math.sin(cycle + Math.PI * 0.5) * 0.16;
        this.leftUpLegBone.rotation.set(0.65 + leftLegKick, 0, -0.15);
        this.rightUpLegBone.rotation.set(0.65 - leftLegKick, 0, 0.15);

        if (this.leftLegBone) {
          this.leftLegBone.rotation.set(-0.75 - leftLegKick * 0.4, 0, 0);
        }
        if (this.rightLegBone) {
          this.rightLegBone.rotation.set(-0.75 + leftLegKick * 0.4, 0, 0);
        }
      }

      // Dynamic positioning of dual climbing axes in hands
      if (this.leftHandBone && this.leftHandAxe && this.rightHandBone && this.rightHandAxe) {
        this.leftHandBone.getWorldPosition(_leftHandPos);
        this.mesh.worldToLocal(_leftHandPos);
        this.leftHandAxe.position.set(_leftHandPos.x, _leftHandPos.y + 0.20, _leftHandPos.z);
        this.leftHandAxe.rotation.set(-0.25, Math.PI * 0.5, -0.06);

        this.rightHandBone.getWorldPosition(_rightHandPos);
        this.mesh.worldToLocal(_rightHandPos);
        this.rightHandAxe.position.set(_rightHandPos.x, _rightHandPos.y + 0.20, _rightHandPos.z);
        this.rightHandAxe.rotation.set(-0.25, Math.PI * 0.5, 0.06);
      }
    }

    // Survival Recurve Bow Aiming Posture (Shadow of the Tomb Raider North Star)
    // Solved in world space (two-bone IK) — Euler guesses in Mixamo bone-local
    // frames do not converge (bone axes differ per rig and per animation frame).
    if (this.isAiming && this.leftArmBone && this.rightArmBone && this.state !== MovementState.CLIMB) {
      this.applyBowAimPose();
    } else if (this.isTorchEquipped && this.leftArmBone && this.state !== MovementState.LEDGE_HANG && this.state !== MovementState.MANTLE && this.state !== MovementState.WALL_SCRAMBLE && this.state !== MovementState.SLIDE && this.state !== MovementState.SWIM && this.state !== MovementState.DIVE && this.state !== MovementState.CLIMB) {
      // Hold left arm raised forward and steady to cast torchlight into the dark
      this.leftArmBone.rotation.set(-0.65, 0.35, 0.45);
      if (this.leftForeArmBone) {
        this.leftForeArmBone.rotation.set(0.75, -0.1, -0.2);
      }
    }

    // Equipment visibility state sync
    if (this.state === MovementState.CLIMB) {
      if (this.hipAxe) this.hipAxe.visible = false;
      if (this.leftHandAxe) this.leftHandAxe.visible = true;
      if (this.rightHandAxe) this.rightHandAxe.visible = true;
    } else {
      if (this.hipAxe) this.hipAxe.visible = true;
      if (this.leftHandAxe) this.leftHandAxe.visible = false;
      if (this.rightHandAxe) this.rightHandAxe.visible = false;
    }

    let desiredAction = this.actions.idle;
    if (this.state === MovementState.LEDGE_HANG || this.state === MovementState.MANTLE || this.state === MovementState.CLIMB) {
      desiredAction = this.actions.idle;
    } else if (this.state === MovementState.WALL_SCRAMBLE) {
      desiredAction = this.actions.run ?? this.actions.walk ?? this.actions.idle;
    } else if (this.state === MovementState.SLIDE) {
      desiredAction = this.actions.idle;
    } else if (this.state === MovementState.SWIM || this.state === MovementState.DIVE) {
      desiredAction = this.actions.walk ?? this.actions.idle;
    } else if (this.isCrouched) {
      desiredAction = this.speed > 0.1 ? (this.actions.walk ?? this.actions.idle) : this.actions.idle;
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
      const walkTempo = (this.state === MovementState.SWIM || this.state === MovementState.DIVE)
        ? 0.65
        : this.isCrouched
          ? 0.70
          : (this.speed / this.maxWalkSpeed);
      this.actions.walk.timeScale = Math.max(0.3, walkTempo);
    } else if (this.activeAction === this.actions.run && this.actions.run) {
      this.actions.run.timeScale = Math.max(0.6, this.speed / this.maxRunSpeed);
    }

    if (this.state === MovementState.SLIDE) {
      this.mesh.rotation.x = -0.35;
    } else if (this.state === MovementState.SWIM) {
      // Smooth pitch already maintained in SWIM state update
    } else if (this.state === MovementState.DIVE) {
      this.mesh.rotation.x = this.swimPitch;
    } else if (!this.isRolling) {
      this.mesh.rotation.x = 0;
      this.mesh.rotation.z = this.bankAngle;
    }

    window.__playerDebug = {
      theta: this.theta,
      phi: this.phi,
      speed: this.speed,
      state: this.state,
      x: this.mesh.position.x,
      z: this.mesh.position.z,
      isGrounded: this.isGrounded,
      oxygen: this.oxygen,
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

    // Smooth lerp camera distance toward user target zoom
    this.radius += (this.targetRadius - this.radius) * Math.min(1.0, 8.0 * dt);

    // 0. Contextual canyon vista & drop detection (Tomb Raider panoramic pull-back)
    const forwardX = -sinTheta;
    const forwardZ = -cosTheta;
    const probeX = this.mesh.position.x + forwardX * 7.0;
    const probeZ = this.mesh.position.z + forwardZ * 7.0;
    const terrainAheadH = getGlobalTerrainHeight(probeX, probeZ);
    const dropAhead = this.mesh.position.y - terrainAheadH;
    // Standing at cliff/ridge overlooking a drop > 6.0m
    const isVistaEdge = this.isGrounded && dropAhead > 6.0;
    const targetVista = isVistaEdge ? Math.min(1.0, (dropAhead - 6.0) / 10.0) : 0.0;
    this.vistaPullRatio += (targetVista - this.vistaPullRatio) * Math.min(1.0, 4.0 * dt);

    // Contextual stealth prowl framing (intimate over-the-shoulder)
    const isStealthStance = (this.isCrouched || (this.stealthSystem?.isPlayerConcealed ?? false)) && !this.isAiming;
    const targetStealth = isStealthStance ? 1.0 : 0.0;
    this.stealthFramingRatio += (targetStealth - this.stealthFramingRatio) * Math.min(1.0, 8.0 * dt);

    // 2. Over-the-shoulder offset:
    // Dynamic shoulder offset: right shoulder (+0.38m), left shoulder (-0.38m), wider in stealth (+0.46m), +0.44m when aiming
    const baseShoulder = (0.38 + this.stealthFramingRatio * 0.08) * this.shoulderSide;
    const targetShoulderOffset = this.isAiming ? 0.44 : baseShoulder;
    this.currentShoulderOffset += (targetShoulderOffset - this.currentShoulderOffset) * Math.min(1.0, 12.0 * dt);
    const shoulderOffset = camRight.clone().multiplyScalar(this.currentShoulderOffset);

    // Target height: 1.18m base (torso), 1.06m in stealth, lifts +0.35m on vista ridge, 1.42m when aiming
    const targetHeight = this.isAiming
      ? 1.42
      : (1.18 - this.stealthFramingRatio * 0.12 + this.vistaPullRatio * 0.35);
    this.target.copy(this.mesh.position).add(new THREE.Vector3(0, targetHeight, 0)).add(shoulderOffset);

    // Physical landing impact camera compression
    if (this.landingDip > 0.001) {
      this.target.y -= this.landingDip;
      this.landingDip = THREE.MathUtils.lerp(this.landingDip, 0, Math.min(1.0, 14.0 * dt));
    }

    // Dynamic Velocity FoV Punch, Vista Expansion & Tactical Aim Zoom (Shadow of the Tomb Raider North Star)
    // 66° base FoV opens expansive peripheral vision across Andean valleys and mountain peaks
    const baseFov = 66.0;
    const runRatio = Math.max(0, Math.min(1.0, this.speed / this.maxRunSpeed));
    let targetFov = baseFov;
    if (this.isAiming) {
      targetFov = 42.0; // Tight tactical aim zoom
    } else if (this.state === MovementState.DIVE || this.state === MovementState.SWIM) {
      targetFov = 66.0;
    } else {
      targetFov = baseFov + runRatio * 5.0 + this.vistaPullRatio * 8.0 - this.stealthFramingRatio * 8.0;
    }
    targetFov += this.impulseFovOffset;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, 8.0 * dt);
    this.impulseFovOffset = THREE.MathUtils.lerp(this.impulseFovOffset, 0, Math.min(1.0, 14.0 * dt));
    this.camera.updateProjectionMatrix();

    // 3. Desired camera position at target radius with contextual expansion
    let nominalRadius = this.radius;
    if (this.isAiming) {
      nominalRadius = 1.85;
    } else if (this.state === MovementState.CLIMB) {
      nominalRadius = 3.2;
    } else {
      nominalRadius = (this.radius - this.stealthFramingRatio * 2.2) + this.vistaPullRatio * 1.6;
    }

    const desiredOffset = new THREE.Vector3(
      nominalRadius * sinPhi * sinTheta,
      nominalRadius * cosPhi,
      nominalRadius * sinPhi * cosTheta
    );

    // 4. Spring-arm multi-ray swept collision avoidance:
    let safeDistance = nominalRadius;
    const rayDir = desiredOffset.clone().normalize();

    // 4a. 3-Ray bundle sweep (Center, Top-offset, Lateral-offset) prevents clipping through narrow doorframes or arches
    if (physics.world) {
      const origins = [
        this.target,
        this.target.clone().add(new THREE.Vector3(0, 0.22, 0)),
        this.target.clone().addScaledVector(camRight, 0.22)
      ];
      for (const orig of origins) {
        const physHit = physics.raycast(orig, rayDir, nominalRadius, this.body ?? undefined);
        if (physHit) {
          const clamped = Math.max(this.minCameraDistance, physHit.distance - 0.35);
          if (clamped < safeDistance) safeDistance = clamped;
        }
      }
    }

    // 4b. Terrain occlusion check
    const sampleSteps = 12;
    let terrainBlockedDist: number | null = null;
    for (let i = 1; i <= sampleSteps; i++) {
      const dist = (nominalRadius * i) / sampleSteps;
      const samplePos = this.target.clone().addScaledVector(rayDir, dist);
      const groundAtSample = getGlobalTerrainHeight(samplePos.x, samplePos.z);
      if (samplePos.y <= groundAtSample + 0.32) {
        terrainBlockedDist = dist;
        break;
      }
    }
    if (terrainBlockedDist !== null && terrainBlockedDist < nominalRadius * 0.55) {
      safeDistance = Math.min(safeDistance, Math.max(this.minCameraDistance, terrainBlockedDist * 0.88));
    }

    // AAA Spring-arm response: rapid retraction on obstruction (prevent wall clipping), smooth extension in open air
    const lerpSpeed = safeDistance < this.currentCameraDistance
      ? Math.min(1.0, 36.0 * dt)
      : Math.min(1.0, 10.0 * dt);
    this.currentCameraDistance += (safeDistance - this.currentCameraDistance) * lerpSpeed;

    // Compute final camera position with impulse
    const finalPos = this.target.clone().addScaledVector(rayDir, this.currentCameraDistance);
    finalPos.add(this.cameraImpulse);
    this.cameraImpulse.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, 14.0 * dt));

    // Terrain riding: smoothly lift camera over rising terrain behind player rather than burying it or pulling it in
    const camFloor = getGlobalTerrainHeight(finalPos.x, finalPos.z) + 0.55;
    if (finalPos.y < camFloor) {
      finalPos.y = camFloor;
    }

    // Handheld sprint micro-shake (visceral momentum)
    if (this.speed > this.maxWalkSpeed * 1.1 && this.isGrounded) {
      const shakeIntensity = (this.speed / this.maxRunSpeed) * 0.028;
      finalPos.x += Math.sin(this.time * 24.0) * shakeIntensity;
      finalPos.y += Math.cos(this.time * 28.0) * (shakeIntensity * 1.2);
    }

    this.camera.position.copy(finalPos);
    this.camera.lookAt(this.target);
  }

  public teleport(x: number, z: number, theta: number = 0, yOverride?: number) {
    const y = yOverride ?? this.getGroundedHeight(x, z);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = theta;
    this.theta = theta;
    this.targetTheta = theta;
    this.facingDir.set(-Math.sin(theta), 0, -Math.cos(theta));
    if (this.body) {
      this.body.setTranslation({ x, y: y + 0.9, z }, true);
    }
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
