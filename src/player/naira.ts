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
  private smoothSlopePitch = 0;
  private smoothSlopeRoll = 0;
  private smoothTurnBank = 0;
  private smoothHeadYaw = 0;
  private smoothLocoWeight = 0; // 0 = idle, 1 = walk, 2 = run
  private stridePhase = 0;
  private readonly tempVecA = new THREE.Vector3();
  private readonly tempVecB = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();
  // Phase 8a speed-vault hand-plant pose targets (pre-allocated: slerped per frame, never built)
  private readonly plantUpperQ = new THREE.Quaternion();
  private readonly plantForeQ = new THREE.Quaternion();
  private readonly plantHandQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0.15, -0.65));
  /** Verify-harness tune hook for the vault plant pose (null during normal play). */
  public plantUpperOverride: { x: number; y: number; z: number } | null = null;
  public plantForeOverride: { x: number; y: number; z: number } | null = null;
  /** Verify-harness tune hook: skip the plant arm layer to capture the base pose. */
  public plantDisabled = false;

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

      const leatherTex = texLoader.load(
        MOBILE
          ? '/juzu/assets/character-textures/character-leather_1k.webp'
          : '/juzu/assets/character-textures/character-leather.webp'
      );
      leatherTex.colorSpace = THREE.SRGBColorSpace;
      leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
      leatherTex.repeat.set(2, 2);

      const quechuaTex = texLoader.load('/juzu/assets/character-textures/character-quechua-weave.jpg');
      quechuaTex.colorSpace = THREE.SRGBColorSpace;
      quechuaTex.wrapS = quechuaTex.wrapT = THREE.RepeatWrapping;
      quechuaTex.repeat.set(2, 1);

      // Enable PBR shadows across sourced geometry, reshape shoes into rugged field boots, and grade expedition wardrobe
      this.modelRoot.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;

          const mesh = child as THREE.Mesh;
          const cName = (child.name || '').toLowerCase();

          // Reshape stiletto heel geometry (Ch07_Heels) into sturdy flat-soled Andean expedition field boots
          if (cName.includes('heels') || cName.includes('boots') || cName.includes('shoe')) {
            this.reshapeIntoExpeditionBoots(mesh.geometry);
          }

          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              const mName = (m.name || '').toLowerCase();
              if (mName.includes('body') || cName.includes('body')) {
                m.metalness = 0.02;
                m.roughness = 0.64; // Soft organic epidermal scattering
                m.color.setHex(0xeacbb0); // Warm Quechua Andean skin tone
              } else if (mName.includes('hair') || cName.includes('hair') || cName.includes('eyelash')) {
                m.color.setHex(0x1a120c); // Deep raven-black Andean hair with espresso undertone
                m.metalness = 0.16; // Subtle anisotropic specular sheen along strands
                m.roughness = 0.42; // Sleek healthy conditioned hair sheen (eliminates matte rubber look)
              } else if (mName.includes('jacket') || cName.includes('suit')) {
                m.map = canvasTex;
                m.bumpMap = canvasTex;
                m.bumpScale = 0.008;
                m.color.setHex(0x786a4e);
                m.metalness = 0.02;
                m.roughness = 0.84;
              } else if (mName.includes('pants') || cName.includes('pants')) {
                m.map = canvasTex;
                m.bumpMap = canvasTex;
                m.bumpScale = 0.006;
                m.color.setHex(0x3a322a);
                m.metalness = 0.02;
                m.roughness = 0.86;
              } else if (mName.includes('shirt') || cName.includes('shirt')) {
                m.color.setHex(0xd6c8b2);
                m.metalness = 0.0;
                m.roughness = 0.84;
              } else if (mName.includes('boots') || cName.includes('heels')) {
                m.map = leatherTex;
                m.bumpMap = leatherTex;
                m.bumpScale = 0.012;
                m.color.setHex(0x3a281c);
                m.metalness = 0.06;
                m.roughness = 0.62;
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

      // Attach bone-socketed 3D Andean archaeologist expedition gear (pack, bedroll, rope, harness, belt, wrist wraps)
      this.attachExpeditionGear(canvasTex, leatherTex, quechuaTex);

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

  /**
   * Reshapes the sourced Ch07_Heels mesh vertices in-place from thin stiletto spikes
   * into sturdy, flat-soled Andean leather expedition boots with a solid block heel and lug sole.
   */
  private reshapeIntoExpeditionBoots(geom: THREE.BufferGeometry): void {
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const norm = geom.attributes.normal as THREE.BufferAttribute | undefined;
    if (!pos) return;

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const ny = norm ? norm.getY(i) : 0;

      const signX = x >= 0 ? 1 : -1;
      const footCenterX = signX * 0.145;
      const dx = x - footCenterX;

      // 1. Widen the thin stiletto heel spike (z < -0.050, y < 0.085) into a sturdy 7cm block boot heel
      if (z < -0.050 && y < 0.085) {
        const heelBlend = THREE.MathUtils.clamp((0.085 - y) / 0.055, 0, 1);
        const dz = z - (-0.086);
        x = footCenterX + dx * (1.0 + 2.35 * heelBlend);
        z = -0.086 + dz * (1.0 + 1.95 * heelBlend);
      }

      // 2. Fill the open high-heel arch gap (-0.080 <= z < 0.038, y < 0.105) into a thick continuous lug sole
      if (z >= -0.080 && z < 0.038 && y < 0.105) {
        const archFactor = Math.sin(
          THREE.MathUtils.clamp((z - (-0.080)) / 0.118, 0, 1) * Math.PI
        );
        if (ny < 0.35 || y < 0.082) {
          y = THREE.MathUtils.lerp(y, 0.004, archFactor * 0.94);
          x = footCenterX + (x - footCenterX) * (1.0 + 0.35 * archFactor);
        }
      }

      // 3. Raise the open pump vamp over the instep so leather covers the top of the foot
      if (z > -0.055 && z < 0.065 && y > 0.045 && ny > 0.15) {
        y += 0.024;
      }

      // 4. Widen the forefoot & toe box slightly into a rugged expedition boot welt
      if (y < 0.055) {
        x = footCenterX + (x - footCenterX) * 1.15;
      }

      // 5. Flare the upper ankle collar (y > 0.085) slightly outward and upward into a field boot cuff
      if (y > 0.085) {
        const cuffT = THREE.MathUtils.clamp((y - 0.085) / 0.085, 0, 1);
        x = footCenterX + (x - footCenterX) * (1.0 + 0.16 * cuffT);
        z = z * (1.0 + 0.10 * cuffT);
        y += cuffT * 0.022;
      }

      pos.setXYZ(i, x, y, z);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();
  }

  /**
   * Attaches authentic Andean archaeological expedition gear (weathered canvas field pack,
   * rolled Quechua blanket, coiled hemp climbing rope, cross-body leather bandolier,
   * waist utility belt with pouches, and woven wrist bracers) directly to Naira's skeleton bones.
   * Note: Armature scale is 0.01, so 1 unit in bone-local space = 1 cm (0.01m).
   */
  private attachExpeditionGear(
    canvasTex: THREE.Texture,
    leatherTex: THREE.Texture,
    quechuaTex: THREE.Texture
  ): void {
    const packCanvasMat = new THREE.MeshStandardMaterial({
      map: canvasTex,
      bumpMap: canvasTex,
      bumpScale: 0.012,
      color: 0x78684e, // Weathered olive-khaki expedition canvas
      roughness: 0.88,
      metalness: 0.02,
    });

    const darkLeatherMat = new THREE.MeshStandardMaterial({
      map: leatherTex,
      bumpMap: leatherTex,
      bumpScale: 0.015,
      color: 0x3b2314, // Oiled saddle leather straps & pouches
      roughness: 0.62,
      metalness: 0.06,
    });

    const quechuaWoolMat = new THREE.MeshStandardMaterial({
      map: quechuaTex,
      bumpMap: quechuaTex,
      bumpScale: 0.016,
      color: 0xb84a32, // Traditional crimson-terracotta woven Andean textile
      roughness: 0.86,
      metalness: 0.02,
    });

    const hempRopeMat = new THREE.MeshStandardMaterial({
      map: canvasTex,
      bumpMap: canvasTex,
      bumpScale: 0.02,
      color: 0xb89b6a, // Twisted natural ichu/hemp climbing rope
      roughness: 0.90,
      metalness: 0.01,
    });

    const bronzeHardwareMat = new THREE.MeshStandardMaterial({
      color: 0xc4933f, // Aged Inca bronze buckles & sun medallion
      roughness: 0.34,
      metalness: 0.84,
    });

    // 1. Spine1 Bone Attachments: Expedition Backpack, Bedroll, Climbing Rope & Cross-Body Bandolier
    if (this.spine1Bone) {
      const packGroup = new THREE.Group();
      packGroup.name = 'Naira_Expedition_Backpack';

      // Main canvas rucksack body on upper/mid back (cm coordinates)
      const mainBag = new THREE.Mesh(new THREE.BoxGeometry(19.5, 23.5, 9.5), packCanvasMat);
      mainBag.position.set(0, 4.5, -13.2);
      mainBag.castShadow = true;
      mainBag.receiveShadow = true;
      packGroup.add(mainBag);

      // Rounded leather top storm-flap
      const topFlap = new THREE.Mesh(new THREE.BoxGeometry(20.2, 6.5, 10.2), darkLeatherMat);
      topFlap.position.set(0, 14.2, -13.2);
      topFlap.castShadow = true;
      packGroup.add(topFlap);

      // Exterior lower field pocket
      const outerPocket = new THREE.Mesh(new THREE.BoxGeometry(15.5, 10.5, 3.2), packCanvasMat);
      outerPocket.position.set(0, 1.2, -18.8);
      outerPocket.castShadow = true;
      packGroup.add(outerPocket);

      // Twin vertical leather cinch straps & bronze buckles on the rucksack
      for (const sx of [-5.8, 5.8]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 24.5, 10.8), darkLeatherMat);
        strap.position.set(sx, 4.8, -13.4);
        strap.castShadow = true;
        packGroup.add(strap);

        const buckle = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 1.2), bronzeHardwareMat);
        buckle.position.set(sx, 8.5, -18.8);
        packGroup.add(buckle);
      }

      // Rolled Quechua wool blanket strapped atop the rucksack
      const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 22.5, 14), quechuaWoolMat);
      bedroll.rotation.z = Math.PI / 2;
      bedroll.position.set(0, 18.8, -12.6);
      bedroll.castShadow = true;
      packGroup.add(bedroll);

      for (const bx of [-6.5, 6.5]) {
        const rollStrap = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 4.05, 1.8, 12), darkLeatherMat);
        rollStrap.rotation.z = Math.PI / 2;
        rollStrap.position.set(bx, 18.8, -12.6);
        packGroup.add(rollStrap);
      }

      // Coiled hemp climbing rope lashed to the left side of the pack
      const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(5.2, 1.35, 10, 20), hempRopeMat);
      ropeCoil.rotation.y = Math.PI / 2;
      ropeCoil.position.set(10.6, 3.5, -13.2);
      ropeCoil.castShadow = true;
      packGroup.add(ropeCoil);

      // Shoulder harness straps wrapping from pack over shoulders
      for (const shX of [-7.5, 7.5]) {
        const shoulderStrap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 20.0, 1.6), darkLeatherMat);
        shoulderStrap.position.set(shX, 7.5, -6.5);
        shoulderStrap.rotation.x = 0.25;
        packGroup.add(shoulderStrap);
      }

      this.spine1Bone.add(packGroup);
    }

    // 2. Hips Bone Attachments: Utility Belt, Leather Satchel Pouch & Brass Expedition Canteen
    if (this.hipsBone) {
      const beltGroup = new THREE.Group();
      beltGroup.name = 'Naira_Utility_Belt';

      // Heavy leather waist belt
      const beltRing = new THREE.Mesh(new THREE.CylinderGeometry(14.6, 15.2, 3.6, 20), darkLeatherMat);
      beltRing.scale.set(1.0, 1.0, 0.74);
      beltRing.position.set(0, 1.5, 0.2);
      beltRing.castShadow = true;
      beltGroup.add(beltRing);

      // Center bronze Inca belt buckle
      const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.2, 1.6), bronzeHardwareMat);
      beltBuckle.position.set(0, 1.5, 11.2);
      beltGroup.add(beltBuckle);

      // Left hip leather field journal & tool pouch
      const leftPouch = new THREE.Mesh(new THREE.BoxGeometry(4.8, 9.2, 7.2), darkLeatherMat);
      leftPouch.position.set(14.8, -1.5, 1.2);
      leftPouch.rotation.z = 0.08;
      leftPouch.castShadow = true;
      beltGroup.add(leftPouch);

      // Right hip expedition canteen / astrolabe case
      const rightCase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 8.5, 12), bronzeHardwareMat);
      rightCase.position.set(-14.6, -1.8, -1.0);
      rightCase.rotation.z = -0.10;
      rightCase.castShadow = true;
      beltGroup.add(rightCase);

      this.hipsBone.add(beltGroup);
    }

    // 3. Forearm Bone Attachments: Woven Quechua Wrist Bracers & Leather Cuffs
    for (const [bone, sideName] of [
      [this.leftForearmBone, 'Left'],
      [this.rightForearmBone, 'Right'],
    ] as const) {
      if (!bone) continue;
      const bracerGroup = new THREE.Group();
      bracerGroup.name = `Naira_Wrist_Bracer_${sideName}`;

      const woolWrap = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 8.2, 14), quechuaWoolMat);
      woolWrap.position.set(0, 14.2, 0);
      woolWrap.castShadow = true;
      bracerGroup.add(woolWrap);

      const leatherCuff = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.75, 2.4, 14), darkLeatherMat);
      leatherCuff.position.set(0, 16.2, 0);
      bracerGroup.add(leatherCuff);

      bone.add(bracerGroup);
    }

    // 4. Lower-Leg / Ankle Boot Gaiter Cuffs & Instep Tongue Covers (eliminates pump skin gap)
    for (const [footBone, sideName] of [
      [this.leftFootBone, 'Left'],
      [this.rightFootBone, 'Right'],
    ] as const) {
      const shinBone = footBone?.parent;
      if (!shinBone) continue;
      const gaiterGroup = new THREE.Group();
      gaiterGroup.name = `Naira_Boot_Gaiter_${sideName}`;

      // Rugged leather ankle boot shaft wrapping lower shin to ankle (cm coordinates along LeftLeg/RightLeg)
      const bootShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(4.3, 4.7, 9.5, 14),
        darkLeatherMat
      );
      bootShaft.position.set(0, 32.5, -0.3);
      bootShaft.castShadow = true;
      gaiterGroup.add(bootShaft);

      // Top wool-trimmed boot collar cuff
      const collarTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 4.4, 2.2, 14),
        quechuaWoolMat
      );
      collarTrim.position.set(0, 28.2, -0.3);
      gaiterGroup.add(collarTrim);

      // Laced leather instep vamp cover bridging the ankle down over the top of the foot
      const instepCover = new THREE.Mesh(
        new THREE.BoxGeometry(7.2, 6.5, 8.8),
        darkLeatherMat
      );
      instepCover.position.set(0, 36.2, 2.4);
      instepCover.rotation.x = 0.48;
      instepCover.castShadow = true;
      gaiterGroup.add(instepCover);

      shinBone.add(gaiterGroup);
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
    const leftFootH = controller.getGroundAt(controller.pos.x + cosH * 0.16, controller.pos.z - sinH * 0.16, controller.pos.y);
    const rightFootH = controller.getGroundAt(controller.pos.x - cosH * 0.16, controller.pos.z + sinH * 0.16, controller.pos.y);
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
          : controller.vaulting
            // Speed vault: pitch hard into the hand plant early, unwind toward the landing fold
            ? THREE.MathUtils.lerp(0.95, 0.35, Math.min(1, controller.vaultProgress * 1.3))
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
      // Biomechanical slope accommodation: subtle pitch & roll tilt (0.30 gain) so torso aligns with terrain gradient
      const targetSlopePitch = controller.grounded ? -controller.slopePitch * 0.30 : 0;
      const targetSlopeRoll = controller.grounded ? -controller.slopeRoll * 0.30 : 0;
      this.smoothSlopePitch = THREE.MathUtils.lerp(this.smoothSlopePitch, targetSlopePitch, Math.min(1, dt * 10));
      this.smoothSlopeRoll = THREE.MathUtils.lerp(this.smoothSlopeRoll, targetSlopeRoll, Math.min(1, dt * 10));
      this.modelRoot.rotation.x = this.smoothSlopePitch;
      this.modelRoot.rotation.z = this.smoothTurnBank * 0.35 + this.smoothSlopeRoll;
    }

    // 3. Continuous 3-Way Parametric Blend Space (Idle <-> Walk <-> Run) with Phase Synchronization
    const isGroundLoco =
      controller.grounded &&
      (controller.pose === 'idle' || controller.pose === 'walk' || controller.pose === 'run');

    if (isGroundLoco && this.actions.idle && this.actions.walk && this.actions.run) {
      const speed = controller.speed;
      let wIdle = 0;
      let wWalk = 0;
      let wRun = 0;

      if (speed <= 0.08) {
        wIdle = 1.0;
        wWalk = 0.0;
        wRun = 0.0;
      } else if (speed <= 2.85) {
        const t = THREE.MathUtils.clamp((speed - 0.08) / (2.85 - 0.08), 0, 1);
        wIdle = 1.0 - t;
        wWalk = t;
        wRun = 0.0;
      } else {
        const t = THREE.MathUtils.clamp((speed - 2.85) / (6.65 - 2.85), 0, 1);
        wIdle = 0.0;
        wWalk = 1.0 - t;
        wRun = t;
      }

      this.actions.idle.enabled = true;
      this.actions.walk.enabled = true;
      this.actions.run.enabled = true;

      this.actions.idle.setEffectiveWeight(wIdle);
      this.actions.walk.setEffectiveWeight(wWalk);
      this.actions.run.setEffectiveWeight(wRun);

      if (!this.actions.idle.isRunning()) this.actions.idle.play();
      if (!this.actions.walk.isRunning()) this.actions.walk.play();
      if (!this.actions.run.isRunning()) this.actions.run.play();

      // Synchronize relative stride cycle between walk and run to eliminate foot skating
      const walkDur = this.actions.walk.getClip().duration || 1.067;
      const runDur = this.actions.run.getClip().duration || 0.733;

      const walkScale = Math.max(0.65, speed / 2.75);
      const runScale = Math.max(0.75, speed / 6.65);
      this.actions.walk.setEffectiveTimeScale(walkScale);
      this.actions.run.setEffectiveTimeScale(runScale);

      if (wWalk > 0.02 && wRun > 0.02) {
        const normCycle = (this.actions.walk.time % walkDur) / walkDur;
        this.actions.run.time = normCycle * runDur;
      }

      const targetLocoWeight = wRun > 0 ? 1.0 + wRun : wWalk;
      this.smoothLocoWeight = THREE.MathUtils.lerp(
        this.smoothLocoWeight,
        targetLocoWeight,
        Math.min(1, dt * 14)
      );

      this.currentAction = wRun > 0.5 ? this.actions.run : wWalk > 0.5 ? this.actions.walk : this.actions.idle;
      this.currentPose = controller.pose;
    } else {
      // Non-ground locomotion (jump, jump_start, jump_land, grapple_swing, interact, swim)
      if (this.actions.idle) this.actions.idle.setEffectiveWeight(0);
      if (this.actions.walk) this.actions.walk.setEffectiveWeight(0);
      if (this.actions.run) this.actions.run.setEffectiveWeight(0);

      if (this.currentPose !== controller.pose) {
        const nextAction =
          this.actions[controller.pose] ||
          (controller.pose === 'grapple_swing' ? this.actions.jump : this.actions.idle);
        if (nextAction && this.currentAction && nextAction !== this.currentAction) {
          nextAction.reset();
          nextAction.enabled = true;
          nextAction.setEffectiveWeight(1.0);
          nextAction.crossFadeFrom(this.currentAction, 0.15, false);
          nextAction.play();
          this.currentAction = nextAction;
        }
        this.currentPose = controller.pose;
      }
      this.smoothLocoWeight = THREE.MathUtils.lerp(
        this.smoothLocoWeight,
        0,
        Math.min(1, dt * 10)
      );
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

    // 1. Upright Pelvis Alignment, Lateral Weight Transfer & Stride Swivel
    if (this.hipsBone) {
      const pelvisUprightBlend = isAirborne ? 0.55 : 0.84;
      this.hipsBone.quaternion.slerp(this.bindHipsQuat, pelvisUprightBlend);

      // Athletic pelvic roll, yaw swivel and pivot skid banking
      if (!isAirborne) {
        if (controller.isPivoting) {
          // Assassin's Creed Skid Pivot: Dynamic athletic inward banking and momentum absorption
          const pivotBanking = controller.pivotSign * 0.16;
          const pivotYaw = controller.pivotSign * 0.14;
          this.tempQuat.set(0, pivotBanking * 0.5, pivotYaw * 0.5, 1.0).normalize();
          this.hipsBone.quaternion.multiply(this.tempQuat);
        } else if (controller.stationaryTurnPhase > 0) {
          // Stationary turn-in-place stepping swivel
          const stepSwivel = Math.sin(controller.stationaryTurnPhase) * 0.08;
          this.tempQuat.set(0, 0, stepSwivel * 0.5, 1.0).normalize();
          this.hipsBone.quaternion.multiply(this.tempQuat);
        } else {
          const pelvicRoll = Math.sin(controller.stridePhase) * THREE.MathUtils.lerp(0.024, 0.042, run01) * loco01;
          const pelvicYaw = -Math.cos(controller.stridePhase) * THREE.MathUtils.lerp(0.038, 0.065, run01) * loco01;
          this.tempQuat.set(0, pelvicRoll * 0.5, pelvicYaw * 0.5, 1.0).normalize();
          this.hipsBone.quaternion.multiply(this.tempQuat);
        }
      }

      // Stabilize Hips local translation & dynamic lateral weight shift
      const hp = this.hipsBone.position;
      if (controller.isPivoting) {
        // Lower center of mass during plant-and-turn pivot
        hp.x = THREE.MathUtils.lerp(hp.x, -controller.pivotSign * 1.8, 0.35);
        hp.y = THREE.MathUtils.lerp(hp.y, 0.76, 0.4);
        hp.z = THREE.MathUtils.lerp(hp.z, -97.8, 0.4);
      } else {
        const lateralWeightShift = Math.sin(controller.stridePhase) * THREE.MathUtils.lerp(1.2, 2.2, run01) * loco01;
        hp.x = THREE.MathUtils.lerp(hp.x, lateralWeightShift, 0.75);
        hp.y = THREE.MathUtils.lerp(hp.y, 0.84, 0.82);
        if (!isAirborne) {
          const cadenceAmp = THREE.MathUtils.lerp(0.0, THREE.MathUtils.lerp(1.4, 2.6, run01), loco01);
          const cadenceBob = Math.sin(controller.stridePhase * 2.0) * cadenceAmp;
          hp.z = THREE.MathUtils.lerp(hp.z, -95.5 + cadenceBob, 0.85);
        }
      }
    }

    // 2. Upper-Torso Spine Pitch, Turn Banking & Acceleration/Braking Lean
    const pivotSpineBank = controller.isPivoting ? -controller.pivotSign * 0.32 : 0;
    const totalSpinePitch = (this.smoothSpinePitch + controller.accelPitch) * 0.34;
    const spinePitchPerBone = totalSpinePitch;
    const spineBankPerBone = (-this.smoothTurnBank * 0.28 + pivotSpineBank) * 0.34;
    for (const sb of [this.spineBone, this.spine1Bone, this.spine2Bone]) {
      if (sb) {
        this.tempQuat.set(spinePitchPerBone * 0.5, 0, spineBankPerBone * 0.5, 1.0).normalize();
        sb.quaternion.multiply(this.tempQuat);
      }
    }
    // Keep neck and head looking forward at the horizon instead of pitched down at the ground
    if (this.neckBone) {
      const nq = this.neckBone.quaternion;
      const counterPitch = -totalSpinePitch * 0.42;
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
        // Airborne jump / mantle / vault:
        if (controller.vaulting) {
          // Dynamic parkour speed vault leg kinematics:
          const vt = controller.vaultProgress;
          const tuckW =
            THREE.MathUtils.smoothstep(vt, 0.04, 0.22) *
            (1 - THREE.MathUtils.smoothstep(vt, 0.65, 0.95));
          // Leading outside leg (left) swings forward across the obstacle (swings foot +0.54m ahead of hips)
          this.tempQuat.set(0, 0, -0.296, 0.955).normalize();
          lq.slerp(this.tempQuat, tuckW);

          // Trailing inside leg (right) tucks up tight under pelvis to clear the stone
          this.tempQuat.set(0.185, -0.097, -0.31, 0.927).normalize();
          rq.slerp(this.tempQuat, tuckW);
        } else {
          lq.slerp(this.bindLeftUpLeg, 0.18);
          rq.slerp(this.bindRightUpLeg, 0.18);
        }
      }
    }

    // 4. Knees: Straighten Stance Crouch While Preserving Swing-Phase Ground Clearance
    // Procedural Slope Height Delta between Left & Right Feet on inclined terrain
    let slopeHeightDelta = 0;
    if (!isAirborne && this.leftFootBone && this.rightFootBone) {
      this.leftFootBone.getWorldPosition(this.tempVecA);
      this.rightFootBone.getWorldPosition(this.tempVecB);
      const groundYL = controller.getGroundAt(this.tempVecA.x, this.tempVecA.z, controller.pos.y + 0.6);
      const groundYR = controller.getGroundAt(this.tempVecB.x, this.tempVecB.z, controller.pos.y + 0.6);
      slopeHeightDelta = THREE.MathUtils.clamp(groundYL - groundYR, -0.45, 0.45);
    }

    // 4. Knees: Straighten Stance Crouch While Preserving Swing-Phase Ground Clearance & Slope Elevation
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

        // Uphill leg flexion: bend knee upward to rest uphill foot on elevated terrain slope
        const uphillKneeFlex = isLeft
          ? (slopeHeightDelta > 0.015 ? slopeHeightDelta * 1.8 : 0)
          : (slopeHeightDelta < -0.015 ? -slopeHeightDelta * 1.8 : 0);

        sq.x = THREE.MathUtils.lerp(-0.04, locoKneeQx, loco01) - uphillKneeFlex;
        sq.y *= 0.15 * loco01;
        sq.z *= 0.15 * loco01;
        sq.w = Math.sqrt(Math.max(0.01, 1.0 - sq.x * sq.x - sq.y * sq.y - sq.z * sq.z));
        sq.normalize();

        if (thigh && Math.abs(uphillKneeFlex) > 0.01) {
          thigh.quaternion.y += (isLeft ? uphillKneeFlex : -uphillKneeFlex) * 0.25;
          thigh.quaternion.normalize();
        }
      } else {
        if (controller.vaulting) {
          const vt = controller.vaultProgress;
          const tuckW =
            THREE.MathUtils.smoothstep(vt, 0.04, 0.22) *
            (1 - THREE.MathUtils.smoothstep(vt, 0.65, 0.95));
          // Outside lead leg extends forward to clear the obstacle
          if (isLeft) {
            sq.x = THREE.MathUtils.lerp(sq.x, -0.15, tuckW);
          } else {
            // Inside trailing leg flexes tightly (~90 deg) tucked under pelvis
            sq.x = THREE.MathUtils.lerp(sq.x, -0.95, tuckW);
          }
          sq.w = Math.sqrt(Math.max(0.01, 1.0 - sq.x * sq.x));
          sq.normalize();
        } else {
          sq.slerp(this.bindShin, 0.15);
        }
      }
    }

    // 5. Ankles & Toes: Undo 180-deg Y Flip, Plant Level & Conform to Slope Normal
    const footLevelBlend = isAirborne ? 0.45 : THREE.MathUtils.lerp(0.88, 0.72, loco01);
    const slopePitchFoot = !isAirborne ? -controller.slopePitch * 0.85 : 0;
    const slopeRollFoot = !isAirborne ? -controller.slopeRoll * 0.75 : 0;
    this.tempQuat.set(slopePitchFoot * 0.5, 0, slopeRollFoot * 0.5, 1.0).normalize();

    if (this.leftFootBone) {
      this.leftFootBone.quaternion.multiply(this.footUnflipY180).normalize();
      if (this.leftFootBone.quaternion.w < 0) {
        const fq = this.leftFootBone.quaternion;
        fq.set(-fq.x, -fq.y, -fq.z, -fq.w);
      }
      this.leftFootBone.quaternion.slerp(this.levelLeftFoot, footLevelBlend);
      if (!isAirborne) {
        this.leftFootBone.quaternion.multiply(this.tempQuat);
      }
    }
    if (this.rightFootBone) {
      this.rightFootBone.quaternion.multiply(this.footUnflipY180).normalize();
      if (this.rightFootBone.quaternion.w < 0) {
        const fq = this.rightFootBone.quaternion;
        fq.set(-fq.x, -fq.y, -fq.z, -fq.w);
      }
      this.rightFootBone.quaternion.slerp(this.levelRightFoot, footLevelBlend);
      if (!isAirborne) {
        this.rightFootBone.quaternion.multiply(this.tempQuat);
      }
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

    // 6b. Phase 8a speed-vault hand plant: leading (right) arm sweeps down-forward to plant on the
    // stone top throughout the vault crossing (prog 0.08..0.55), pushing off cleanly at the apex.
    if (
      controller.vaulting &&
      !this.isAiming &&
      !this.plantDisabled &&
      this.rightUpperArmBone &&
      this.rightForearmBone
    ) {
      const vt = controller.vaultProgress;
      const plantW =
        THREE.MathUtils.smoothstep(vt, 0.04, 0.16) *
        (1 - THREE.MathUtils.smoothstep(vt, 0.52, 0.82));
      if (plantW > 0.002) {
        const ou = this.plantUpperOverride;
        const ux = ou ? ou.x : 0.52;
        const uy = ou ? ou.y : 0.04;
        const uz = ou ? ou.z : -0.42;
        const uqw = Math.sqrt(Math.max(0.05, 1.0 - ux * ux - uy * uy - uz * uz));
        this.plantUpperQ.set(ux, uy, uz, uqw).normalize();
        const of = this.plantForeOverride;
        const fx = of ? of.x : 0.05;
        const fy = of ? of.y : 0.0;
        const fz = of ? of.z : -0.38;
        const fqw = Math.sqrt(Math.max(0.05, 1.0 - fx * fx - fy * fy - fz * fz));
        this.plantForeQ.set(fx, fy, fz, fqw).normalize();
        this.rightUpperArmBone.quaternion.slerp(this.plantUpperQ, plantW);
        this.rightForearmBone.quaternion.slerp(this.plantForeQ, plantW);
        if (this.rightHandBone) {
          this.plantHandQ.set(0.38, 0, -0.16, 0.91).normalize();
          this.rightHandBone.quaternion.slerp(this.plantHandQ, plantW * 0.95);
        }
      }
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
      const blendRate = controller.justLanded ? 1.0 : Math.min(1, dt * 28);
      this.smoothFootContactOffset = THREE.MathUtils.lerp(
        this.smoothFootContactOffset,
        desiredCorrection,
        blendRate
      );
    }

    this.modelRoot.position.y =
      this.groundOffset + this.smoothPelvisOffset + this.smoothFootContactOffset;
    this.root.updateMatrixWorld(true);
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
