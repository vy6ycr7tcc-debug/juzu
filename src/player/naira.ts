import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Controller, LocomotionPose } from './controller';
import { standAt } from '../world/terrain';
import { MOBILE } from '../core/quality';

/**
 * Turn quantized vertex data (16-bit positions, 16-bit normals from KHR_mesh_quantization)
 * into plain Float32Arrays. WebGPU/WebGL2 shaders misread quantized normals, breaking lighting.
 */
function floatAttributes(root: THREE.Object3D): void {
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (!g) return;
    for (const [name, a] of Object.entries(g.attributes)) {
      if (a.array instanceof Float32Array || (!a.normalized && name !== 'position')) continue;
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) {
        for (let k = 0; k < a.itemSize; k++) {
          f[i * a.itemSize + k] = (a as any).getComponent(i, k);
        }
      }
      g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
    }
  });
}

/**
 * Manifest-driven sourced character loader & biomechanical locomotion solver for Naira Quispe.
 * Strictly adheres to AGENTS.md & Character Brief:
 * - NO procedural human geometry anywhere in the codebase.
 * - Sourced rigged 3D asset only (Mixamo / ActorCore).
 * - Fails loudly if asset is missing (never falls back to a generated placeholder).
 */
export class Naira {
  public root = new THREE.Group();
  public modelRoot: THREE.Object3D | null = null;
  public isLoaded = false;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<LocomotionPose, THREE.AnimationAction>> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private currentPose: LocomotionPose = 'idle';

  // Sourced skeleton bone sockets for gear / sidearm attachments & biomechanical alignment
  private hipsBone: THREE.Object3D | null = null;
  private spineBone: THREE.Object3D | null = null;
  private spine1Bone: THREE.Object3D | null = null;
  private spine2Bone: THREE.Object3D | null = null;
  private neckBone: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  public rightHandBone: THREE.Object3D | null = null;
  public leftHandBone: THREE.Object3D | null = null;
  public rightForearmBone: THREE.Object3D | null = null;
  public rightUpperArmBone: THREE.Object3D | null = null;
  public leftUpperArmBone: THREE.Object3D | null = null;
  public leftForearmBone: THREE.Object3D | null = null;
  public leftThighBone: THREE.Object3D | null = null;
  public rightThighBone: THREE.Object3D | null = null;
  public leftShinBone: THREE.Object3D | null = null;
  public rightShinBone: THREE.Object3D | null = null;
  public leftFootBone: THREE.Object3D | null = null;
  public rightFootBone: THREE.Object3D | null = null;
  public leftToeBone: THREE.Object3D | null = null;
  public rightToeBone: THREE.Object3D | null = null;
  private fingerBones: THREE.Object3D[] = [];
  private bindQuats: Map<string, THREE.Quaternion> = new Map();
  public isAiming = false;

  // Dynamic grounding, banking, continuous locomotion weight, and athletic posture
  private groundOffset = 0;
  private smoothPelvisOffset = 0;
  private smoothFootContactOffset = 0;
  private smoothSpinePitch = 0;
  private smoothTurnBank = 0;
  private smoothHeadYaw = 0;
  private smoothLocoWeight = 0; // 0 = idle, 1 = walk, 2 = run
  private stridePhase = 0;
  private readonly tempVecA = new THREE.Vector3();
  private readonly tempVecB = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();

  constructor(scene: THREE.Scene) {
    this.root.name = 'Naira_PlayerRoot';
    scene.add(this.root);
    (window as any).__naira = this;
    this.loadSourcedCharacter();
  }

  private actionKeyCounts: Partial<Record<LocomotionPose, number>> = {};

  private async loadSourcedCharacter(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const charUrl = '/juzu/characters/naira/naira.glb';

    try {
      const gltf = await loader.loadAsync(charUrl);
      this.modelRoot = gltf.scene;
      floatAttributes(this.modelRoot);

      // Authenticate scale: human archaeologist height (1.75m)
      const box = new THREE.Box3().setFromObject(this.modelRoot);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 0.1) {
        const targetHeight = 1.75;
        const scale = targetHeight / size.y;
        this.modelRoot.scale.setScalar(scale);
      }

      // Grounding alignment: align soles of boots precisely to local y = 0
      const alignedBox = new THREE.Box3().setFromObject(this.modelRoot);
      this.groundOffset = -alignedBox.min.y;
      this.modelRoot.position.y = this.groundOffset;

      // Expedition canvas weave texture for field archaeologist jacket & cargo pants (preserving sculpted normal maps)
      const texLoader = new THREE.TextureLoader();
      const canvasTex = texLoader.load(
        MOBILE
          ? '/juzu/assets/character-textures/character-canvas_1k.webp'
          : '/juzu/assets/character-textures/character-canvas.jpeg'
      );
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
      canvasTex.repeat.set(3, 3);
      canvasTex.flipY = false;

      // Enable PBR shadows across sourced geometry, fix dielectric skin/hair metalness, and grade expedition wardrobe
      this.modelRoot.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;

          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              const mName = (m.name || '').toLowerCase();
              const cName = (child.name || '').toLowerCase();
              if (mName.includes('body') || cName.includes('body')) {
                m.metalness = 0.0;
                m.roughness = 0.58;
              } else if (mName.includes('hair') || cName.includes('hair') || cName.includes('eyelash')) {
                m.metalness = 0.0;
                m.roughness = 0.54;
              } else if (mName.includes('jacket') || cName.includes('suit')) {
                m.map = canvasTex;
                m.color.setHex(0x6e6a4c);
                m.metalness = 0.02;
                m.roughness = 0.86;
              } else if (mName.includes('pants') || cName.includes('pants')) {
                m.map = canvasTex;
                m.color.setHex(0x38322c);
                m.metalness = 0.02;
                m.roughness = 0.88;
              } else if (mName.includes('shirt') || cName.includes('shirt')) {
                m.color.setHex(0xd6c8b2);
                m.metalness = 0.0;
                m.roughness = 0.84;
              } else if (mName.includes('boots') || cName.includes('heels')) {
                m.map = canvasTex;
                m.color.setHex(0x2b221a);
                m.metalness = 0.04;
                m.roughness = 0.64;
              }
              m.needsUpdate = true;
            }
          }
        }
        if (child.name && child.name.includes(':')) {
          child.name = child.name.replace(/:/g, '');
        }
        if ((child as THREE.Bone).isBone && child.name) {
          this.bindQuats.set(child.name, child.quaternion.clone());
        }
      });

      this.root.add(this.modelRoot);

      // Sourced bone sockets (standard Mixamo rig or sanitized names)
      const findBone = (names: string[]): THREE.Object3D | null => {
        for (const name of names) {
          const b =
            this.modelRoot?.getObjectByName(name) ||
            this.modelRoot?.getObjectByName(`mixamorig${name}`) ||
            this.modelRoot?.getObjectByName(`mixamorig:${name}`) ||
            this.modelRoot?.getObjectByName(`DEF-${name}`);
          if (b) return b;
        }
        return null;
      };

      this.hipsBone = findBone(['Hips', 'hips', 'pelvis']);
      this.spineBone = findBone(['Spine', 'spine']);
      this.spine1Bone = findBone(['Spine1', 'spine1']);
      this.spine2Bone = findBone(['Spine2', 'spine2']);
      this.neckBone = findBone(['Neck', 'neck']);
      this.headBone = findBone(['Head', 'head']);
      this.rightHandBone = findBone(['RightHand', 'hand.R', 'handR', 'hand_r']);
      this.leftHandBone = findBone(['LeftHand', 'hand.L', 'handL', 'hand_l']);
      this.rightForearmBone = findBone(['RightForeArm', 'forearm.R', 'forearmR', 'forearm_r']);
      this.rightUpperArmBone = findBone(['RightArm', 'upper_arm.R', 'upper_armR', 'arm_r']);
      this.leftUpperArmBone = findBone(['LeftArm', 'upper_arm.L', 'upper_armL', 'arm_l']);
      this.leftForearmBone = findBone(['LeftForeArm', 'forearm.L', 'forearmL', 'forearm_l']);
      this.leftThighBone = findBone(['LeftUpLeg', 'thigh.L', 'thighL', 'thigh_l']);
      this.rightThighBone = findBone(['RightUpLeg', 'thigh.R', 'thighR', 'thigh_r']);
      this.leftShinBone = findBone(['LeftLeg', 'shin.L', 'shinL', 'shin_l']);
      this.rightShinBone = findBone(['RightLeg', 'shin.R', 'shinR', 'shin_r']);
      this.leftFootBone = findBone(['LeftFoot', 'foot.L', 'footL', 'foot_l']);
      this.rightFootBone = findBone(['RightFoot', 'foot.R', 'footR', 'foot_r']);
      this.leftToeBone = findBone(['LeftToeBase', 'toe.L', 'toeL']);
      this.rightToeBone = findBone(['RightToeBase', 'toe.R', 'toeR']);

      // Collect finger phalanges so we can apply natural relaxed hand curl post-mixer
      this.fingerBones = [];
      for (const side of ['Left', 'Right']) {
        for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
          for (const phalanx of ['1', '2', '3']) {
            const b = findBone([`${side}Hand${finger}${phalanx}`]);
            if (b) this.fingerBones.push(b);
          }
        }
      }

      // Setup AnimationMixer
      this.mixer = new THREE.AnimationMixer(this.modelRoot);

      // Embedded animations from the character GLB
      for (const clip of gltf.animations || []) {
        this.registerClip(clip);
      }

      // Start in idle
      if (this.actions.idle) {
        this.actions.idle.play();
        this.currentAction = this.actions.idle;
      }

      (window as any).__naira = this;
      this.isLoaded = true;
    } catch (err) {
      const errorMsg =
        `[Naira] Failed to load sourced character asset at ${charUrl}.\n` +
        `Contract Violation: No procedural human geometry will be generated.\n` +
        `Action Required: Download character FBX from Mixamo or ActorCore into ~/game-assets/characters/naira/source/ and run ~/game-assets/scripts/process_naira.py`;
      console.error(errorMsg, err);

      this.displayMissingAssetBanner(errorMsg);
      throw new Error(errorMsg);
    }
  }

  private registerClip(clip: THREE.AnimationClip, overwrite = false): void {
    if (!this.mixer) return;

    // Sanitize track targets & enforce quaternion hemisphere continuity across all keyframes
    let maxKeys = 0;
    for (const track of clip.tracks) {
      track.name = track.name
        .replace(/^[^\/]+\//, '')
        .replace(/:/g, '')
        .replace(/_1\./g, '.');
      if (track.times && track.times.length > maxKeys) {
        maxKeys = track.times.length;
      }

      if (track.name.endsWith('.quaternion') && track.values && track.values.length >= 4) {
        const boneName = track.name.slice(0, -11);
        const bindQ = this.bindQuats.get(boneName);
        const vals = track.values;
        // Align first keyframe with bind pose hemisphere if available
        if (bindQ) {
          const dot0 =
            vals[0] * bindQ.x + vals[1] * bindQ.y + vals[2] * bindQ.z + vals[3] * bindQ.w;
          if (dot0 < 0) {
            vals[0] = -vals[0];
            vals[1] = -vals[1];
            vals[2] = -vals[2];
            vals[3] = -vals[3];
          }
        }
        // Align every subsequent keyframe with its predecessor so crossfades and slerps never flip 360 deg
        for (let i = 4; i < vals.length; i += 4) {
          const dot =
            vals[i] * vals[i - 4] +
            vals[i + 1] * vals[i - 3] +
            vals[i + 2] * vals[i - 2] +
            vals[i + 3] * vals[i - 1];
          if (dot < 0) {
            vals[i] = -vals[i];
            vals[i + 1] = -vals[i + 1];
            vals[i + 2] = -vals[i + 2];
            vals[i + 3] = -vals[i + 3];
          }
        }
      }
    }

    const name = clip.name.toLowerCase();
    const keyCount = maxKeys;

    const assignAction = (pose: LocomotionPose, configure?: (a: THREE.AnimationAction) => void) => {
      if (overwrite || !this.actions[pose] || keyCount > (this.actionKeyCounts[pose] || 0)) {
        const action = this.mixer!.clipAction(clip);
        if (configure) configure(action);
        this.actions[pose] = action;
        this.actionKeyCounts[pose] = keyCount;
      }
    };

    if (name.includes('idle') && !name.includes('swim') && !name.includes('sitting') && !name.includes('spell')) {
      assignAction('idle');
    } else if (name.includes('walk')) {
      assignAction('walk');
    } else if (name.includes('run') || name.includes('jog')) {
      assignAction('run');
    } else if (name.includes('jump_start')) {
      assignAction('jump_start', (a) => {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      });
    } else if (name.includes('jump_land')) {
      assignAction('jump_land', (a) => {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      });
    } else if (name.includes('jump') && !name.includes('loop')) {
      assignAction('jump');
    } else if (name.includes('swim_idle')) {
      assignAction('swim_idle');
    } else if (name.includes('swim')) {
      assignAction('swim');
    } else if (name.includes('interact')) {
      assignAction('interact', (a) => {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      });
    }
  }

  private displayMissingAssetBanner(msg: string): void {
    const existing = document.getElementById('juzu-asset-error-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'juzu-asset-error-banner';
    banner.style.position = 'fixed';
    banner.style.top = '20px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.maxWidth = '680px';
    banner.style.background = 'rgba(180, 20, 20, 0.92)';
    banner.style.color = '#ffffff';
    banner.style.padding = '16px 24px';
    banner.style.borderRadius = '8px';
    banner.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    banner.style.fontSize = '14px';
    banner.style.lineHeight = '1.5';
    banner.style.zIndex = '999999';
    banner.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';
    banner.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    banner.innerHTML = `
      <strong style="display: block; font-size: 16px; margin-bottom: 6px;">⚠️ SOURCED CHARACTER REQUIRED</strong>
      ${msg.replace(/\n/g, '<br>')}
    `;
    document.body.appendChild(banner);
  }

  public update(controller: Controller, dt: number, camYaw?: number): void {
    // 1. Sync root transform with controller
    this.root.position.copy(controller.pos);
    this.root.rotation.y = controller.heading;

    // Continuous locomotion blend weight (0 = idle, 1 = walk, 2 = run) so transitions never snap
    const goalLocoWeight =
      controller.pose === 'run'
        ? THREE.MathUtils.clamp(1.0 + (controller.speed - 2.75) / 3.9, 1.15, 2.0)
        : controller.pose === 'walk'
          ? THREE.MathUtils.clamp(controller.speed / 2.75, 0.35, 1.0)
          : 0.0;
    this.smoothLocoWeight = THREE.MathUtils.lerp(
      this.smoothLocoWeight,
      goalLocoWeight,
      Math.min(1, dt * 11)
    );

    // Advance continuous stride phase for biomechanical cadence stabilization
    if (controller.grounded && controller.speed > 0.15) {
      const freq = controller.pose === 'run' ? 8.8 : 5.85;
      this.stridePhase = (this.stridePhase + dt * freq * Math.max(0.65, controller.speed / (controller.pose === 'run' ? 6.65 : 2.75))) % (Math.PI * 2);
    }

    // 2. Crouch / Dodge / Landing Pelvis Compression
    const sinH = Math.sin(controller.heading);
    const cosH = Math.cos(controller.heading);
    const leftFootH = standAt(controller.pos.x + cosH * 0.16, controller.pos.z - sinH * 0.16);
    const rightFootH = standAt(controller.pos.x - cosH * 0.16, controller.pos.z + sinH * 0.16);
    const slopeDiff = Math.min(0.28, Math.abs(leftFootH - rightFootH));
    const crouchDrop = controller.crouching ? -0.24 : controller.dodging ? -0.18 : 0;
    const landDrop = controller.pose === 'jump_land' ? -0.12 : 0;
    const targetPelvisOffset = -slopeDiff * 0.25 + crouchDrop + landDrop;
    this.smoothPelvisOffset = THREE.MathUtils.lerp(
      this.smoothPelvisOffset,
      targetPelvisOffset,
      Math.min(1, dt * 12)
    );

    // Forward Athletic Torso Lean (applied to Spine bones rather than tilting modelRoot around ankles)
    const uphillLean = THREE.MathUtils.clamp(controller.slopePitch * 0.18, -0.06, 0.14);
    const targetPitch =
      controller.pose === 'grapple_swing'
        ? THREE.MathUtils.clamp(-controller.vel.y * 0.035, -0.35, 0.35)
        : (controller.mantling
          ? 0.20
          : controller.dodging
            ? 0.24
            : controller.crouching
              ? 0.22
              : controller.pose === 'run'
                ? 0.08
                : controller.pose === 'walk'
                  ? 0.03
                  : 0) + uphillLean;
    this.smoothSpinePitch = THREE.MathUtils.lerp(
      this.smoothSpinePitch,
      targetPitch,
      Math.min(1, dt * 10)
    );

    // Procedural body banking into turns
    const speedFactor = THREE.MathUtils.clamp(controller.speed / 6.0, 0.15, 1.0);
    const targetBank = THREE.MathUtils.clamp(-controller.turnRate * 0.035 * speedFactor, -0.14, 0.14);
    this.smoothTurnBank = THREE.MathUtils.lerp(
      this.smoothTurnBank,
      targetBank,
      Math.min(1, dt * 10)
    );

    if (this.modelRoot) {
      // Keep modelRoot upright (no ankle-pivot tipping); subtle banking only
      this.modelRoot.rotation.x = 0;
      this.modelRoot.rotation.z = this.smoothTurnBank * 0.35;
    }

    // 3. Blend Locomotion Animations with Phase Synchronization between Walk and Run
    if (!this.currentAction && this.actions.idle) {
      this.actions.idle.play();
      this.currentAction = this.actions.idle;
    }

    if (this.currentPose !== controller.pose) {
      const nextAction =
        this.actions[controller.pose] ||
        (controller.pose === 'grapple_swing' ? this.actions.jump : this.actions.idle);
      if (nextAction) {
        if (this.currentAction && nextAction !== this.currentAction) {
          const prevAction = this.currentAction;
          const isPrevLoco = this.currentPose === 'walk' || this.currentPose === 'run';
          const isNextLoco = controller.pose === 'walk' || controller.pose === 'run';

          nextAction.reset();
          nextAction.enabled = true;
          nextAction.setEffectiveWeight(1.0);

          // Phase-match normalized stride cycle when transitioning between Walk and Run
          if (isPrevLoco && isNextLoco) {
            const prevDur = prevAction.getClip().duration || 1;
            const nextDur = nextAction.getClip().duration || 1;
            nextAction.time = ((prevAction.time % prevDur) / prevDur) * nextDur;
          }

          let targetScale = 1.0;
          if (controller.pose === 'walk') {
            targetScale = Math.max(0.75, controller.speed / 2.65);
          } else if (controller.pose === 'run') {
            targetScale = Math.max(0.88, controller.speed / 6.1);
          } else if (
            controller.pose === 'jump_start' ||
            controller.pose === 'jump_land' ||
            controller.pose === 'grapple_swing'
          ) {
            targetScale = 1.3;
          }
          nextAction.setEffectiveTimeScale(targetScale);

          const fadeDur =
            controller.pose === 'jump_start' ||
            controller.pose === 'jump_land' ||
            controller.pose === 'grapple_swing'
              ? 0.12
              : isPrevLoco && isNextLoco
                ? 0.22
                : 0.18;
          nextAction.crossFadeFrom(prevAction, fadeDur, false);
          nextAction.play();
          this.currentAction = nextAction;
        } else if (!this.currentAction) {
          nextAction.enabled = true;
          nextAction.setEffectiveWeight(1.0);
          nextAction.play();
          this.currentAction = nextAction;
        }
      }
      this.currentPose = controller.pose;
    } else if (this.currentAction) {
      if (controller.pose === 'walk') {
        this.currentAction.setEffectiveTimeScale(Math.max(0.75, controller.speed / 2.65));
      } else if (controller.pose === 'run') {
        this.currentAction.setEffectiveTimeScale(Math.max(0.88, controller.speed / 6.1));
      }
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    // 4. Post-mixer Biomechanical Alignment (Pelvis, Spine, Legs, Knees, Feet, Arms, Hands)
    if (controller.pose !== 'swim' && controller.pose !== 'swim_idle') {
      this.applyBiomechanicalPosture(controller);
    }

    // 5. Post-Mixer Procedural Head Look-Direction & Horizon Stabilization
    if (this.headBone && camYaw !== undefined) {
      const camForwardYaw = camYaw + Math.PI;
      let diffYaw = (camForwardYaw - controller.heading) % (Math.PI * 2);
      if (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      if (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      const goalHeadYaw =
        Math.abs(diffYaw) < 1.35
          ? THREE.MathUtils.clamp(diffYaw * 0.35, -0.32, 0.32)
          : 0;
      this.smoothHeadYaw = THREE.MathUtils.lerp(this.smoothHeadYaw, goalHeadYaw, Math.min(1, dt * 8));
      this.headBone.rotation.y += this.smoothHeadYaw;
    }

    // 6. Dynamic Per-Frame Boot-Sole Grounding (eliminates mid-stride foot floating & toe clipping)
    this.applyDynamicFootGrounding(controller, dt);
  }

  private readonly bindHipsQuat = new THREE.Quaternion(-0.70710677, 0, 0, 0.70710677);
  private readonly bindLeftUpLeg = new THREE.Quaternion(0.001, -0.025, -0.999, 0.027).normalize();
  private readonly bindRightUpLeg = new THREE.Quaternion(0.001, 0.025, 0.999, 0.027).normalize();
  private readonly bindShin = new THREE.Quaternion(-0.04, 0.0, 0.0, 0.999).normalize();
  private readonly levelLeftFoot = new THREE.Quaternion(0.35, -0.015, 0.01, 0.936).normalize();
  private readonly levelRightFoot = new THREE.Quaternion(0.35, 0.015, -0.01, 0.936).normalize();
  private readonly footUnflipY180 = new THREE.Quaternion(0, 1, 0, 0);

  /**
   * Resolves all retargeting & posture flaws in the sourced rig post-mixer:
   * 1. Pelvis (`Hips`): removes the 15-20 deg forward pelvic tilt and 23cm vertical pogo bounce
   *    so legs swing symmetrically in front of AND behind the hips.
   * 2. Spine (`Spine`, `Spine1`, `Spine2`) & Neck: applies athletic forward lean and turn banking
   *    through the upper torso while keeping the head looking level at the horizon.
   * 3. Thighs (`LeftUpLeg`, `RightUpLeg`): removes the baked -28 deg hip-flexion crouch bias so
   *    the front leg steps out ahead of the chest and the trailing leg extends cleanly behind the hip.
   * 4. Knees (`LeftLeg`, `RightLeg`): straightens the stance-phase crouch bend while preserving
   *    natural swing-phase knee lift for ground clearance.
   * 5. Ankles (`LeftFoot`, `RightFoot`): undoes the 180-deg Y flip and levels the boot sole.
   * 6. Arms & Hands: drives symmetrical counter-rotating arm swing in phase with opposite legs,
   *    dynamic elbow flexion, and natural relaxed finger curl.
   */
  private applyBiomechanicalPosture(controller: Controller): void {
    const wLoco = this.smoothLocoWeight; // 0 = idle, 1 = walk, 2 = run
    const isAirborne = !controller.grounded;
    const loco01 = THREE.MathUtils.clamp(wLoco, 0, 1);
    const run01 = THREE.MathUtils.clamp(wLoco - 1.0, 0, 1);

    // 1. Upright Pelvis Alignment & Controlled Stride Cadence Bob
    if (this.hipsBone) {
      const pelvisUprightBlend = isAirborne ? 0.55 : 0.84;
      this.hipsBone.quaternion.slerp(this.bindHipsQuat, pelvisUprightBlend);

      // Stabilize Hips local translation (local Z is vertical in Mixamo -90X Hips space)
      const hp = this.hipsBone.position;
      hp.x *= 0.25; // Dampen excessive 4.5cm lateral lurch
      hp.y = THREE.MathUtils.lerp(hp.y, 0.84, 0.82);
      if (!isAirborne) {
        const cadenceAmp = THREE.MathUtils.lerp(0.0, THREE.MathUtils.lerp(1.4, 2.6, run01), loco01);
        const cadenceBob = Math.sin(this.stridePhase * 2.0) * cadenceAmp;
        hp.z = THREE.MathUtils.lerp(hp.z, -95.5 + cadenceBob, 0.85);
      }
    }

    // 2. Upper-Torso Spine Pitch, Turn Banking & Horizon Head Counter-Pitch
    const spinePitchPerBone = this.smoothSpinePitch * 0.34;
    const spineBankPerBone = -this.smoothTurnBank * 0.28;
    for (const sb of [this.spineBone, this.spine1Bone, this.spine2Bone]) {
      if (sb) {
        this.tempQuat.set(spinePitchPerBone * 0.5, 0, spineBankPerBone * 0.5, 1.0).normalize();
        sb.quaternion.multiply(this.tempQuat);
      }
    }
    // Keep neck and head looking forward at the horizon instead of pitched down at the ground
    if (this.neckBone) {
      const nq = this.neckBone.quaternion;
      const counterPitch = -this.smoothSpinePitch * 0.42;
      nq.x = THREE.MathUtils.clamp(nq.x * 0.35 + counterPitch * 0.5, -0.12, 0.08);
      nq.z *= 0.35;
      nq.normalize();
    }
    if (this.headBone) {
      const hq = this.headBone.quaternion;
      hq.x = THREE.MathUtils.clamp(hq.x * 0.35, -0.08, 0.08);
      hq.z *= 0.35;
      hq.normalize();
    }

    // 3. Thighs & Knees: Remove Baked Squat Bias & Extend Stance Leg Straight
    let leftLegForwardSignal = 0;
    if (this.leftThighBone && this.rightThighBone) {
      const lq = this.leftThighBone.quaternion;
      const rq = this.rightThighBone.quaternion;
      // Ensure canonical hemisphere: LeftUpLeg qz < 0, RightUpLeg qz > 0
      if (lq.z > 0) lq.set(-lq.x, -lq.y, -lq.z, -lq.w);
      if (rq.z < 0) rq.set(-rq.x, -rq.y, -rq.z, -rq.w);

      if (!isAirborne) {
        // Remove baked forward hip-flexion crouch bias (-0.285 on L, +0.285 on R) and center stride around 0
        const crouchBias = THREE.MathUtils.lerp(0.28, 0.31, run01);
        const strideGain = THREE.MathUtils.lerp(1.12, 0.92, run01) * loco01;
        const maxSwing = THREE.MathUtils.lerp(0.26, 0.38, run01);

        const rawLeftSwing = THREE.MathUtils.clamp((lq.y + crouchBias) * strideGain, -maxSwing, maxSwing * 0.88);
        const rawRightSwing = THREE.MathUtils.clamp((rq.y - crouchBias) * strideGain, -maxSwing * 0.88, maxSwing);

        lq.x = THREE.MathUtils.lerp(0.001, lq.x * 0.35, loco01);
        lq.y = THREE.MathUtils.lerp(-0.02, rawLeftSwing, loco01);
        lq.w = THREE.MathUtils.lerp(0.027, lq.w * 0.5, loco01);
        lq.z = -Math.sqrt(Math.max(0.01, 1.0 - lq.x * lq.x - lq.y * lq.y - lq.w * lq.w));
        lq.normalize();

        rq.x = THREE.MathUtils.lerp(0.001, rq.x * 0.35, loco01);
        rq.y = THREE.MathUtils.lerp(0.02, rawRightSwing, loco01);
        rq.w = THREE.MathUtils.lerp(0.027, rq.w * 0.5, loco01);
        rq.z = Math.sqrt(Math.max(0.01, 1.0 - rq.x * rq.x - rq.y * rq.y - rq.w * rq.w));
        rq.normalize();

        // Since -rawLeftSwing is left-leg-forward and +rawRightSwing is right-leg-forward:
        // leftLegForwardSignal = (leftLegFwd - rightLegFwd) * 0.5 = -(rawLeftSwing + rawRightSwing) * 0.5
        leftLegForwardSignal = -(rawLeftSwing + rawRightSwing) * 0.5;
      } else {
        // Airborne jump / mantle: gentle alignment only
        lq.slerp(this.bindLeftUpLeg, 0.18);
        rq.slerp(this.bindRightUpLeg, 0.18);
      }
    }

    // 4. Knees: Straighten Stance Crouch While Preserving Swing-Phase Ground Clearance
    for (const [shin, thigh, isLeft] of [
      [this.leftShinBone, this.leftThighBone, true],
      [this.rightShinBone, this.rightThighBone, false],
    ] as const) {
      if (!shin) continue;
      const sq = shin.quaternion;
      if (sq.w < 0) sq.set(-sq.x, -sq.y, -sq.z, -sq.w);

      if (!isAirborne) {
        // Determine whether this leg is in front stance (straight knee) or rear/swing lift (bent knee)
        const thighFwd = thigh
          ? isLeft
            ? -thigh.quaternion.y
            : thigh.quaternion.y
          : 0;
        const stanceStraighten = THREE.MathUtils.clamp(thighFwd * 2.2, 0.0, 0.75);
        // Subtract baked -0.26 crouch flexion; allow swing-phase flexion up to -0.42 (walk) / -0.58 (run)
        const rawFlex = Math.max(0, -sq.x - 0.25);
        const swingGain = THREE.MathUtils.lerp(0.76, 0.82, run01) * (1.0 - stanceStraighten * 0.55);
        const maxKneeFlex = THREE.MathUtils.lerp(0.42, 0.58, run01);
        const locoKneeQx = -THREE.MathUtils.clamp(0.045 + rawFlex * swingGain, 0.04, maxKneeFlex);

        sq.x = THREE.MathUtils.lerp(-0.04, locoKneeQx, loco01);
        sq.y *= 0.15 * loco01;
        sq.z *= 0.15 * loco01;
        sq.w = Math.sqrt(Math.max(0.01, 1.0 - sq.x * sq.x - sq.y * sq.y - sq.z * sq.z));
        sq.normalize();
      } else {
        sq.slerp(this.bindShin, 0.15);
      }
    }

    // 5. Ankles & Toes: Undo 180-deg Y Flip and Plant Boot Soles Level
    const footLevelBlend = isAirborne ? 0.45 : THREE.MathUtils.lerp(0.88, 0.72, loco01);
    if (this.leftFootBone) {
      this.leftFootBone.quaternion.multiply(this.footUnflipY180).normalize();
      if (this.leftFootBone.quaternion.w < 0) {
        const fq = this.leftFootBone.quaternion;
        fq.set(-fq.x, -fq.y, -fq.z, -fq.w);
      }
      this.leftFootBone.quaternion.slerp(this.levelLeftFoot, footLevelBlend);
    }
    if (this.rightFootBone) {
      this.rightFootBone.quaternion.multiply(this.footUnflipY180).normalize();
      if (this.rightFootBone.quaternion.w < 0) {
        const fq = this.rightFootBone.quaternion;
        fq.set(-fq.x, -fq.y, -fq.z, -fq.w);
      }
      this.rightFootBone.quaternion.slerp(this.levelRightFoot, footLevelBlend);
    }

    // 6. Symmetrical Counter-Rotating Arm Swing & Dynamic Elbow Flexion
    if (!this.isAiming) {
      this.fixArmChain(
        this.leftUpperArmBone,
        this.leftForearmBone,
        true,
        loco01,
        run01,
        leftLegForwardSignal
      );
      this.fixArmChain(
        this.rightUpperArmBone,
        this.rightForearmBone,
        false,
        loco01,
        run01,
        leftLegForwardSignal
      );
    }

    // 7. Natural Relaxed Expedition Finger Curl (eliminates rigid splayed T-pose hands)
    const fingerCurlQz = THREE.MathUtils.lerp(0.22, 0.42, run01);
    const fingerCurlQw = Math.sqrt(1.0 - fingerCurlQz * fingerCurlQz);
    for (const fb of this.fingerBones) {
      fb.quaternion.set(0, 0, fingerCurlQz, fingerCurlQw);
    }
  }

  /**
   * Drives clean sagittal counter-rotating arm swing and phase-coupled elbow flexion:
   * - When the left leg steps forward (`leftLegForwardSignal > 0`), the right arm swings forward
   *   and the left arm swings backward behind the hip.
   * - On the forward swing, the elbow flexes naturally; on the backswing, the elbow extends
   *   so the hand clears behind the pelvis.
   */
  private fixArmChain(
    upper: THREE.Object3D | null,
    fore: THREE.Object3D | null,
    isLeft: boolean,
    loco01: number,
    run01: number,
    leftLegForwardSignal: number
  ): void {
    // armForward > 0 when this arm swings forward (+Z), < 0 when this arm swings backward (-Z)
    const swingGain = THREE.MathUtils.lerp(1.25, 1.48, run01) * loco01;
    const armForward = THREE.MathUtils.clamp(
      (isLeft ? -leftLegForwardSignal : leftLegForwardSignal) * swingGain - 0.05 * loco01,
      -0.38,
      0.38
    );

    if (upper) {
      const q = upper.quaternion;
      // Lower arm naturally to side of torso with heroic shoulder-to-hip clearance (0.535 idle, 0.525 walk, 0.505 run)
      const targetQx = THREE.MathUtils.lerp(0.535, THREE.MathUtils.lerp(0.525, 0.505, run01), loco01);
      // Local +Z swings LeftArm forward (+Z) and RightArm backward (-Z); slight -0.035 idle offset centers elbow over hip
      const idleRest = -0.035 * (1.0 - loco01);
      const sagittalQz = isLeft ? (armForward + idleRest) : -(armForward + idleRest);
      const subtleQy = isLeft ? -0.02 : 0.02;
      const qw = Math.sqrt(
        Math.max(0.05, 1.0 - targetQx * targetQx - subtleQy * subtleQy - sagittalQz * sagittalQz)
      );
      q.set(targetQx, subtleQy, sagittalQz, qw).normalize();
    }

    if (fore) {
      const qf = fore.quaternion;
      // Base elbow flexion: 10 deg in idle, 18 deg in walk, 38 deg in run
      // Plus extra flexion on the forward swing and extension on the backswing
      const baseFlex = THREE.MathUtils.lerp(0.085, THREE.MathUtils.lerp(0.16, 0.36, run01), loco01);
      const dynamicFlex =
        armForward > 0
          ? armForward * THREE.MathUtils.lerp(0.55, 0.82, run01)
          : armForward * 0.35;
      const elbowBend = THREE.MathUtils.clamp(baseFlex + dynamicFlex, 0.04, 0.58);
      const sagittalQz = isLeft ? elbowBend : -elbowBend;
      const adductionQx = THREE.MathUtils.lerp(-0.025, 0.02, loco01);
      const qw = Math.sqrt(Math.max(0.05, 1.0 - adductionQx * adductionQx - sagittalQz * sagittalQz));
      qf.set(adductionQx, 0, sagittalQz, qw).normalize();
    }
  }

  /**
   * Measures actual world-space Y of the left and right heel/ankle and toe bones after
   * the skeleton poses each frame, and shifts `modelRoot.position.y` so the lowest
   * supporting boot sole rests flush on the ground (`controller.pos.y`) with zero floating or sinking.
   */
  private applyDynamicFootGrounding(controller: Controller, dt: number): void {
    if (!this.modelRoot) return;

    if (!controller.grounded || controller.pose === 'swim' || controller.pose === 'swim_idle') {
      this.smoothFootContactOffset = THREE.MathUtils.lerp(
        this.smoothFootContactOffset,
        0,
        Math.min(1, dt * 10)
      );
      this.modelRoot.position.y = this.groundOffset + this.smoothPelvisOffset + this.smoothFootContactOffset;
      return;
    }

    // Evaluate world positions with base offset first
    this.modelRoot.position.y = this.groundOffset + this.smoothPelvisOffset;
    this.root.updateMatrixWorld(true);

    let minSoleY = Infinity;
    // Sole thickness offsets below bone centers (calibrated from bind pose where min.y = 0)
    const samples: Array<{ bone: THREE.Object3D | null; soleRadius: number }> = [
      { bone: this.leftFootBone, soleRadius: 0.088 },
      { bone: this.rightFootBone, soleRadius: 0.088 },
      { bone: this.leftToeBone, soleRadius: 0.026 },
      { bone: this.rightToeBone, soleRadius: 0.026 },
    ];

    for (const s of samples) {
      if (!s.bone) continue;
      s.bone.getWorldPosition(this.tempVecA);
      const soleY = this.tempVecA.y - s.soleRadius;
      if (soleY < minSoleY) {
        minSoleY = soleY;
      }
    }

    if (Number.isFinite(minSoleY)) {
      const desiredCorrection = THREE.MathUtils.clamp(controller.pos.y - minSoleY, -0.22, 0.22);
      this.smoothFootContactOffset = THREE.MathUtils.lerp(
        this.smoothFootContactOffset,
        desiredCorrection,
        Math.min(1, dt * 28)
      );
    }

    this.modelRoot.position.y =
      this.groundOffset + this.smoothPelvisOffset + this.smoothFootContactOffset;
  }

  public getRightHandWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    if (this.rightHandBone) {
      return this.rightHandBone.getWorldPosition(out);
    }
    if (this.rightForearmBone) {
      return this.rightForearmBone.getWorldPosition(out).add(new THREE.Vector3(0, 0.25, 0));
    }
    return out.copy(this.root.position).add(new THREE.Vector3(0.25, 1.45, 0.2));
  }
}
