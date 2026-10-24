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
 * Manifest-driven sourced character loader for Naira Quispe.
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

  // Sourced skeleton bone sockets for gear / sidearm attachments & anatomical posture alignment
  private headBone: THREE.Object3D | null = null;
  public rightHandBone: THREE.Object3D | null = null;
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
  public isAiming = false;

  // Dynamic grounding, banking and athletic posture
  private groundOffset = 0;
  private smoothPelvisOffset = 0;
  private smoothSpinePitch = 0;
  private smoothTurnBank = 0;
  private smoothHeadYaw = 0;

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
    const animDir = '/juzu/characters/naira/anims/';

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
                // Human skin is a pure dielectric (fix glTF 0.5 metallicFactor artifact)
                m.metalness = 0.0;
                m.roughness = 0.62;
              } else if (mName.includes('hair') || cName.includes('hair') || cName.includes('eyelash')) {
                m.metalness = 0.0;
                m.roughness = 0.56;
              } else if (mName.includes('jacket') || cName.includes('suit')) {
                // Andean field archaeologist weathered olive-khaki expedition jacket
                m.map = canvasTex;
                m.color.setHex(0x6e6a4c);
                m.metalness = 0.02;
                m.roughness = 0.86;
              } else if (mName.includes('pants') || cName.includes('pants')) {
                // Rugged earth-brown field cargo trousers
                m.map = canvasTex;
                m.color.setHex(0x4c4034);
                m.metalness = 0.02;
                m.roughness = 0.88;
              } else if (mName.includes('shirt') || cName.includes('shirt')) {
                // Warm natural linen field undershirt
                m.color.setHex(0xd6c8b2);
                m.metalness = 0.0;
                m.roughness = 0.84;
              } else if (mName.includes('boots') || cName.includes('heels')) {
                // Oiled dark brown mountain leather boots
                m.map = canvasTex;
                m.color.setHex(0x3a2a1d);
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

      this.headBone = findBone(['Head', 'head']);
      this.rightHandBone = findBone(['RightHand', 'hand.R', 'handR', 'hand_r']);
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

      // Present loud on-screen diagnostic banner
      this.displayMissingAssetBanner(errorMsg);
      throw new Error(errorMsg);
    }
  }

  private registerClip(clip: THREE.AnimationClip, overwrite = false): void {
    if (!this.mixer) return;

    // Sanitize track targets: strip path prefixes and colons to match sanitized bone names
    for (const track of clip.tracks) {
      track.name = track.name
        .replace(/^[^\/]+\//, '')
        .replace(/:/g, '')
        .replace(/_1\./g, '.');
    }

    const name = clip.name.toLowerCase();
    const keyCount = clip.tracks[0]?.times?.length || 0;

    const assignAction = (pose: LocomotionPose, configure?: (a: THREE.AnimationAction) => void) => {
      if (overwrite || !this.actions[pose] || keyCount > (this.actionKeyCounts[pose] || 0)) {
        const action = this.mixer!.clipAction(clip);
        if (configure) configure(action);
        this.actions[pose] = action;
        this.actionKeyCounts[pose] = keyCount;
      }
    };

    if (name.includes('idle') && !name.includes('swim') && !name.includes('sitting')) {
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
    } else if (name.includes('jump')) {
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
    // 1. Sync transform with controller
    this.root.position.copy(controller.pos);
    this.root.rotation.y = controller.heading;

    // 2. Foot Slope Grounding & Crouch/Landing Knee Compression
    const sinH = Math.sin(controller.heading);
    const cosH = Math.cos(controller.heading);
    const leftFootH = standAt(controller.pos.x + cosH * 0.18, controller.pos.z - sinH * 0.18);
    const rightFootH = standAt(controller.pos.x - cosH * 0.18, controller.pos.z + sinH * 0.18);
    const slopeDiff = Math.min(0.35, Math.abs(leftFootH - rightFootH));
    const crouchDrop = controller.crouching ? -0.30 : controller.dodging ? -0.22 : 0;
    const landDrop = controller.pose === 'jump_land' ? -0.14 : 0;
    // Compensate for straightening the baked 40-deg knee squat in idle/walk so boot soles rest flush on terrain
    const uprightLift =
      controller.pose === 'idle'
        ? 0.095
        : controller.pose === 'walk' || controller.pose === 'run'
          ? 0.038
          : 0;
    const targetPelvisOffset = -slopeDiff * 0.35 + crouchDrop + landDrop + uprightLift;
    this.smoothPelvisOffset = THREE.MathUtils.lerp(
      this.smoothPelvisOffset,
      targetPelvisOffset,
      Math.min(1, dt * 12)
    );

    // Forward Athletic Lean (Sprint / Uphill Slope / Mantle / Crouch) + Turn Banking
    const uphillLean = THREE.MathUtils.clamp(controller.slopePitch * 0.22, -0.08, 0.18);
    const targetPitch =
      controller.pose === 'grapple_swing'
        ? THREE.MathUtils.clamp(-controller.vel.y * 0.045, -0.45, 0.45)
        : (controller.mantling
          ? 0.26
          : controller.dodging
            ? 0.34
            : controller.crouching
              ? 0.26
              : controller.pose === 'run'
                ? 0.11
                : controller.pose === 'walk'
                  ? 0.045
                  : 0) + uphillLean;
    this.smoothSpinePitch = THREE.MathUtils.lerp(
      this.smoothSpinePitch,
      targetPitch,
      Math.min(1, dt * 10)
    );

    // Procedural body banking into turns
    const speedFactor = THREE.MathUtils.clamp(controller.speed / 6.0, 0.15, 1.0);
    const targetBank = THREE.MathUtils.clamp(-controller.turnRate * 0.042 * speedFactor, -0.18, 0.18);
    this.smoothTurnBank = THREE.MathUtils.lerp(
      this.smoothTurnBank,
      targetBank,
      Math.min(1, dt * 10)
    );

    if (this.modelRoot) {
      this.modelRoot.position.y = this.groundOffset + this.smoothPelvisOffset;
      this.modelRoot.rotation.x = this.smoothSpinePitch;
      this.modelRoot.rotation.z = this.smoothTurnBank;
    }

    // 3. Blend Locomotion Animations
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
          nextAction.reset();
          nextAction.enabled = true;

          if (controller.pose === 'walk') {
            nextAction.timeScale = Math.max(0.68, controller.speed / 2.35);
          } else if (controller.pose === 'run') {
            nextAction.timeScale = Math.max(0.88, controller.speed / 5.4);
          } else if (
            controller.pose === 'jump_start' ||
            controller.pose === 'jump_land' ||
            controller.pose === 'grapple_swing'
          ) {
            nextAction.timeScale = 1.35;
          } else {
            nextAction.timeScale = 1.0;
          }

          const fadeDur =
            controller.pose === 'jump_start' ||
            controller.pose === 'jump_land' ||
            controller.pose === 'grapple_swing'
              ? 0.12
              : 0.2;
          nextAction.crossFadeFrom(this.currentAction, fadeDur, true);
          nextAction.play();
          this.currentAction = nextAction;
        } else if (!this.currentAction) {
          nextAction.play();
          this.currentAction = nextAction;
        }
      }
      this.currentPose = controller.pose;
    } else if (this.currentAction) {
      if (controller.pose === 'walk') {
        this.currentAction.timeScale = Math.max(0.68, controller.speed / 2.35);
      } else if (controller.pose === 'run') {
        this.currentAction.timeScale = Math.max(0.88, controller.speed / 5.4);
      }
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Post-mixer anatomical retargeting correction (shoulders/elbows, hips/knees, and ankles)
    if (controller.pose !== 'swim' && controller.pose !== 'swim_idle') {
      this.applyAnatomicalPosture(controller.pose);
    }

    // 4. Post-Mixer Procedural Head Look-Direction Alignment
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
  }

  private readonly bindLeftUpLeg = new THREE.Quaternion(0.001, -0.045, -0.998, 0.027).normalize();
  private readonly bindRightUpLeg = new THREE.Quaternion(0.001, 0.045, 0.998, 0.027).normalize();
  private readonly bindShin = new THREE.Quaternion(-0.06, 0.0, 0.0, 0.998).normalize();
  private readonly bindLeftFoot = new THREE.Quaternion(0.55, -0.018, 0.012, 0.835).normalize();
  private readonly bindRightFoot = new THREE.Quaternion(0.462, 0.025, -0.013, 0.887).normalize();
  private readonly footUnflipY180 = new THREE.Quaternion(0, 1, 0, 0);

  /**
   * Correct Mixamo Ch07 vs Quaternius retargeting axis mismatches post-mixer:
   * 1. Upper arms: Ch07 shoulders have a 90-deg roll so local +X lowers the arm to the torso
   *    while local Z swings the arm forward/back during walk/run.
   * 2. Forearms: transfer coronal bend (qx) into sagittal forward elbow flexion (+qz left, -qz right)
   *    so elbows point backward and never flare sideways like chicken wings.
   * 3. Legs & knees: remove wide-squat hip abduction in idle/walk while preserving stride swing.
   * 4. Feet: post-multiply by (0, 1, 0, 0) to undo the 180-deg local-Y ankle flip from retargeting.
   */
  private applyAnatomicalPosture(pose: LocomotionPose): void {
    const isIdle = pose === 'idle';
    const isLoco = pose === 'walk' || pose === 'run';

    if (!this.isAiming) {
      this.fixArmChain(this.leftUpperArmBone, this.leftForearmBone, true, isIdle);
      this.fixArmChain(this.rightUpperArmBone, this.rightForearmBone, false, isIdle);
    }

    const legBlend = isIdle ? 0.84 : isLoco ? 0.30 : 0.15;
    const shinBlend = isIdle ? 0.84 : isLoco ? 0.26 : 0.12;
    if (this.leftThighBone) {
      this.leftThighBone.quaternion.slerp(this.bindLeftUpLeg, legBlend);
    }
    if (this.rightThighBone) {
      this.rightThighBone.quaternion.slerp(this.bindRightUpLeg, legBlend);
    }
    if (this.leftShinBone) {
      this.leftShinBone.quaternion.slerp(this.bindShin, shinBlend);
    }
    if (this.rightShinBone) {
      this.rightShinBone.quaternion.slerp(this.bindShin, shinBlend);
    }

    const footBlend = isIdle ? 0.68 : 0.45;
    if (this.leftFootBone) {
      this.leftFootBone.quaternion.multiply(this.footUnflipY180).normalize();
      this.leftFootBone.quaternion.slerp(this.bindLeftFoot, footBlend);
    }
    if (this.rightFootBone) {
      this.rightFootBone.quaternion.multiply(this.footUnflipY180).normalize();
      this.rightFootBone.quaternion.slerp(this.bindRightFoot, footBlend);
    }
  }

  private fixArmChain(
    upper: THREE.Object3D | null,
    fore: THREE.Object3D | null,
    isLeft: boolean,
    isIdle: boolean
  ): void {
    if (upper) {
      const q = upper.quaternion;
      const targetQx = isIdle ? 0.60 : 0.54;
      const newQx = q.x * 0.10 + targetQx * 0.90;
      const newQy = q.y * 0.20;
      const newQz = q.z * (isIdle ? 0.28 : 0.85);
      q.set(newQx, newQy, newQz, q.w).normalize();
    }
    if (fore) {
      const qf = fore.quaternion;
      const rawFlex = Math.abs(qf.x) * (isIdle ? 0.34 : 0.62) + Math.abs(qf.z) * 0.5;
      const elbowBend = THREE.MathUtils.clamp(rawFlex, 0.12, 0.48);
      const sagittalQz = isLeft ? elbowBend : -elbowBend;
      const adductionQx = isIdle ? 0.13 : 0.08;
      qf.set(adductionQx, qf.y * 0.2, sagittalQz, qf.w).normalize();
    }
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
