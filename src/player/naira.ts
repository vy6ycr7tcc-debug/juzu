import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Controller, LocomotionPose } from './controller';
import { standAt } from '../world/terrain';

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
 * Generate smooth cylindrical UVs and seamless bone-weighted anatomical vertex colors
 * so joints and limbs blend into a unified human skin + field-expedition outfit with zero mannequin seams.
 */
function applyAnatomicalUVsAndColors(skinnedMesh: THREE.SkinnedMesh): void {
  const geometry = skinnedMesh.geometry;
  const pos = geometry.attributes.position;
  if (!pos) return;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);

  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const rangeY = (maxY - minY) || 1.0;

  const skinIdx = geometry.attributes.skinIndex;
  const skinWgt = geometry.attributes.skinWeight;
  const bones = skinnedMesh.skeleton ? skinnedMesh.skeleton.bones : [];

  const getBoneRegionColor = (bName: string): [number, number, number] => {
    const n = bName.toLowerCase();
    // Note: Vertex color Float32Array attributes are read directly in LINEAR space by Three.js!
    // 1. Head, Neck & Fingers: warm Andean sunlit skin tone (linear equivalent of sRGB #c88c66)
    if (n.includes('head') || n.includes('neck') || n.includes('f_') || n.includes('thumb')) {
      return [0.46, 0.25, 0.13];
    }
    // 2. Fingerless leather climbing gloves / wrist wraps (linear saddle brown)
    if (n.includes('hand')) {
      return [0.11, 0.055, 0.030];
    }
    // 3. Weathered slate-teal woven Andean tunic & 3/4 sleeves (exact linear match to tunicClothMat 0x426468)
    if (
      n.includes('spine') ||
      n.includes('hips') ||
      n.includes('pelvis') ||
      n.includes('shoulder') ||
      n.includes('upper_arm') ||
      n.includes('forearm')
    ) {
      return [0.056, 0.124, 0.136];
    }
    // 4. Laced dark cordovan mountaineering boots
    if (n.includes('foot') || n.includes('toe')) {
      return [0.075, 0.042, 0.024];
    }
    // 5. Rugged dark olive-umber cargo expedition trousers (thighs, shins)
    return [0.088, 0.082, 0.056];
  };

  const nrmAttr = geometry.attributes.normal;
  const isJointMesh = skinnedMesh.name.toLowerCase().includes('joint') || skinnedMesh.name.includes('2');

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Inflate interior joint spheres flush with outer shell and smooth 90-degree mannequin socket rim normals
    if (nrmAttr) {
      let nx = nrmAttr.getX(i);
      let ny = nrmAttr.getY(i);
      let nz = nrmAttr.getZ(i);
      if (isJointMesh) {
        pos.setXYZ(i, x + nx * 0.0085, y + ny * 0.0085, z + nz * 0.0085);
      }
      // Dampen steep vertical crease normals on torso/limb socket rims so plate seams vanish
      const normH = (y - minY) / rangeY;
      if (normH > 0.12 && normH < 0.88) {
        const horizLen = Math.hypot(nx, nz);
        if (horizLen > 0.05 && Math.abs(ny) > 0.35) {
          ny *= 0.28;
          const invL = 1.0 / Math.hypot(nx, ny, nz);
          nrmAttr.setXYZ(i, nx * invL, ny * invL, nz * invL);
        }
      }
    }

    const angle = Math.atan2(z, x);
    uvs[i * 2] = ((angle + Math.PI) / (2 * Math.PI)) * 4.0;
    uvs[i * 2 + 1] = ((y - minY) / rangeY) * 6.0;

    let r = 0, g = 0, b = 0, wSum = 0;
    let headWeight = 0;
    if (skinIdx && skinWgt && bones.length > 0) {
      for (let k = 0; k < 4; k++) {
        const w = skinWgt.getComponent(i, k);
        if (w <= 0.001) continue;
        const bi = skinIdx.getComponent(i, k);
        const bone = bones[bi];
        const bName = bone ? bone.name : '';
        if (bName.toLowerCase().includes('head')) headWeight += w;
        const [br, bg, bb] = getBoneRegionColor(bName);
        r += br * w;
        g += bg * w;
        b += bb * w;
        wSum += w;
      }
    }
    if (wSum > 0) {
      let cr = r / wSum;
      let cg = g / wSum;
      let cb = b / wSum;

      // Paint the back of the skull and the entire crown/forehead above the headband with dark espresso hair
      if (headWeight > 0.35) {
        const normY = (y - minY) / rangeY;
        const isScalpOrBack = normY > 0.935 || z < 0.025;
        if (isScalpOrBack) {
          cr = 0.10;
          cg = 0.08;
          cb = 0.06;
        }
      }

      colors[i * 3] = cr;
      colors[i * 3 + 1] = cg;
      colors[i * 3 + 2] = cb;
    } else {
      colors[i * 3] = 0.55;
      colors[i * 3 + 1] = 0.50;
      colors[i * 3 + 2] = 0.44;
    }
  }

  pos.needsUpdate = true;
  if (nrmAttr) nrmAttr.needsUpdate = true;
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export class Naira {
  public root = new THREE.Group();
  public modelRoot: THREE.Object3D | null = null;
  public isLoaded = false;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<LocomotionPose, THREE.AnimationAction>> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private currentPose: LocomotionPose = 'idle';
  private headBone: THREE.Object3D | null = null;
  public rightHandBone: THREE.Object3D | null = null;
  public rightForearmBone: THREE.Object3D | null = null;
  public rightUpperArmBone: THREE.Object3D | null = null;
  public leftUpperArmBone: THREE.Object3D | null = null;
  public leftForearmBone: THREE.Object3D | null = null;
  public rightThighBone: THREE.Object3D | null = null;
  public isAiming = false;

  // Articulated 5-segment hair braid for secondary pendulum motion
  private braidSegments: THREE.Object3D[] = [];
  private braidAngleX = 0.12;
  private braidVelX = 0;
  private braidAngleZ = 0;
  private braidVelZ = 0;
  private smoothPelvisOffset = 0;
  private smoothSpinePitch = 0;
  private smoothTurnBank = 0;
  private smoothHeadYaw = 0;

  constructor(scene: THREE.Scene) {
    this.root.name = 'Naira_PlayerRoot';
    scene.add(this.root);
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const texLoader = new THREE.TextureLoader();

    // 1. Seamless Neutral-Albedo Woven Andean Homespun Fabric for Tunic & Body (preserves exact slate-teal & skin colors!)
    const fabricTex = texLoader.load('/juzu/textures/woven_cloth_albedo.jpg');
    fabricTex.colorSpace = THREE.SRGBColorSpace;
    fabricTex.anisotropy = 8;
    fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
    fabricTex.repeat.set(4, 4);

    // 2. Weathered Field Canvas for Expedition Rucksack & Bedroll (Optimized WebP)
    const canvasTex = texLoader.load('/juzu/assets/character-textures/character-canvas_1k.webp');
    canvasTex.colorSpace = THREE.SRGBColorSpace;
    canvasTex.anisotropy = 8;
    canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
    canvasTex.repeat.set(1, 1);

    // 3. Saddle-Brown Weathered Leather for Harnesses, Bracers, Belt & Quiver (Optimized WebP)
    const leatherTex = texLoader.load('/juzu/assets/character-textures/character-leather_1k.webp');
    leatherTex.colorSpace = THREE.SRGBColorSpace;
    leatherTex.anisotropy = 8;
    leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
    leatherTex.repeat.set(2, 2);

    // 4. 2K Authentic Quechua Geometric Weave (White Inca Diamonds, Gold Checkerboards, Crimson & Teal)
    const weaveTex = texLoader.load('/juzu/assets/character-textures/character-quechua-weave.jpg');
    weaveTex.colorSpace = THREE.SRGBColorSpace;
    weaveTex.anisotropy = 8;
    weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
    weaveTex.repeat.set(4, 1);

    loader.load(
      '/juzu/models/wanderer.glb',
      (gltf) => {
        this.modelRoot = gltf.scene;
        floatAttributes(this.modelRoot);

        this.applyAndeanMaterialsAndGear(
          this.modelRoot,
          fabricTex,
          canvasTex,
          leatherTex,
          weaveTex
        );

        this.modelRoot.scale.setScalar(1.0);
        this.root.add(this.modelRoot);

        this.mixer = new THREE.AnimationMixer(this.modelRoot);
        const clips = gltf.animations || [];

        const findExactOrPartial = (exact: string, fallbackPart: string) =>
          clips.find((c) => c.name.toLowerCase() === exact.toLowerCase()) ||
          clips.find((c) => c.name.toLowerCase().includes(fallbackPart.toLowerCase()));

        const idleClip = findExactOrPartial('Idle_Loop', 'idle');
        const walkClip = findExactOrPartial('Walk_Loop', 'walk');
        const runClip = findExactOrPartial('Jog_Fwd_Loop', 'jog');
        const jumpStartClip = findExactOrPartial('Jump_Start', 'jump_start');
        const jumpClip = findExactOrPartial('Jump_Loop', 'jump_loop');
        const jumpLandClip = findExactOrPartial('Jump_Land', 'jump_land');
        const swimClip = findExactOrPartial('Swim_Fwd_Loop', 'swim_fwd');
        const swimIdleClip = findExactOrPartial('Swim_Idle_Loop', 'swim_idle');
        const interactClip = findExactOrPartial('Interact', 'interact');

        if (idleClip) this.actions.idle = this.mixer.clipAction(idleClip);
        if (walkClip) this.actions.walk = this.mixer.clipAction(walkClip);
        if (runClip) this.actions.run = this.mixer.clipAction(runClip);
        if (jumpStartClip) {
          const act = this.mixer.clipAction(jumpStartClip);
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
          this.actions.jump_start = act;
        }
        if (jumpClip) this.actions.jump = this.mixer.clipAction(jumpClip);
        if (jumpLandClip) {
          const act = this.mixer.clipAction(jumpLandClip);
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
          this.actions.jump_land = act;
        }
        if (swimClip) this.actions.swim = this.mixer.clipAction(swimClip);
        if (swimIdleClip) this.actions.swim_idle = this.mixer.clipAction(swimIdleClip);
        if (interactClip) {
          const act = this.mixer.clipAction(interactClip);
          act.setLoop(THREE.LoopOnce, 1);
          act.clampWhenFinished = true;
          this.actions.interact = act;
        }

        if (this.actions.idle) {
          this.actions.idle.play();
          this.currentAction = this.actions.idle;
        }
        this.isLoaded = true;
      },
      undefined,
      (err) => {
        console.warn('Failed to load character model:', err);
      }
    );
  }

  private applyAndeanMaterialsAndGear(
    root: THREE.Object3D,
    fabricTex: THREE.Texture,
    canvasTex: THREE.Texture,
    leatherTex: THREE.Texture,
    weaveTex: THREE.Texture
  ): void {
    // Unified seamless material for BOTH Mannequin_1 and Mannequin_2 using neutral-albedo woven fabric + micro-bump
    const unifiedBodyMat = new THREE.MeshStandardMaterial({
      map: fabricTex,
      bumpMap: fabricTex,
      bumpScale: 0.014,
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.76,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    root.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh || (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.SkinnedMesh;
        const isJoint = mesh.name.toLowerCase().includes('joint') || mesh.name.includes('2');
        mesh.castShadow = !isJoint;
        mesh.receiveShadow = true;
        applyAnatomicalUVsAndColors(mesh);
        mesh.material = unifiedBodyMat;
      }
    });

    const headBone = root.getObjectByName('DEF-head');
    this.headBone = headBone || null;
    const neckBone = root.getObjectByName('DEF-neck');
    const chestBone = root.getObjectByName('DEF-spine003') || root.getObjectByName('DEF-spine.003');
    const hipsBone = root.getObjectByName('DEF-hips');
    const leftForearmBone =
      root.getObjectByName('DEF-forearmL') || root.getObjectByName('DEF-forearm.L');
    const rightForearmBone =
      root.getObjectByName('DEF-forearmR') || root.getObjectByName('DEF-forearm.R');
    const rightThighBone =
      root.getObjectByName('DEF-thighR') || root.getObjectByName('DEF-thigh.R');
    const leftShinBone =
      root.getObjectByName('DEF-shinL') || root.getObjectByName('DEF-shin.L');
    const rightShinBone =
      root.getObjectByName('DEF-shinR') || root.getObjectByName('DEF-shin.R');

    const rightHandBone =
      root.getObjectByName('DEF-handR') || root.getObjectByName('DEF-hand.R');
    const rightUpperArmBone =
      root.getObjectByName('DEF-upper_armR') || root.getObjectByName('DEF-upper_arm.R');
    const leftUpperArmBone =
      root.getObjectByName('DEF-upper_armL') || root.getObjectByName('DEF-upper_arm.L');

    this.rightHandBone = rightHandBone || null;
    this.rightForearmBone = rightForearmBone || null;
    this.rightUpperArmBone = rightUpperArmBone || null;
    this.leftUpperArmBone = leftUpperArmBone || null;
    this.leftForearmBone = leftForearmBone || null;
    this.rightThighBone = rightThighBone || null;

    // Shared expedition tunic, Quechua weave, leather & brass materials
    const tunicClothMat = new THREE.MeshStandardMaterial({
      map: fabricTex,
      bumpMap: fabricTex,
      bumpScale: 0.016,
      color: 0x426468, // Weathered slate-teal woven Andean tunic matching ref_character_gear
      roughness: 0.80,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const trimWeaveMat = new THREE.MeshStandardMaterial({
      map: weaveTex,
      bumpMap: weaveTex,
      bumpScale: 0.014,
      color: 0xffffff, // Full-color Quechua weave: white Inca diamonds, gold checkerboards, crimson & teal!
      roughness: 0.76,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const harnessLeatherMat = new THREE.MeshStandardMaterial({
      map: leatherTex,
      bumpMap: leatherTex,
      bumpScale: 0.014,
      color: 0xd8b89a, // Preserves the rich dark saddle-brown of character-leather.jpeg
      roughness: 0.54,
      metalness: 0.08,
    });
    const buckleBrassMat = new THREE.MeshStandardMaterial({
      color: 0xc89e48,
      metalness: 0.88,
      roughness: 0.28,
    });

    // 1. Head: Sculpted Hair Crown, Subtle Facial Features, Physics Braid & Quechua Headband
    if (headBone) {
      const headGroup = new THREE.Group();
      const darkHairMat = new THREE.MeshStandardMaterial({
        color: 0x16110d,
        roughness: 0.74,
        metalness: 0.06,
      });
      const skinMat = new THREE.MeshStandardMaterial({
        color: 0xc28860,
        roughness: 0.62,
        metalness: 0.02,
      });

      // Subtle nose bridge and lips blended onto the front of the face
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.028, 6), skinMat);
      nose.rotation.x = Math.PI * 0.44;
      nose.position.set(0, 0.094, 0.111);
      headGroup.add(nose);

      const lipMat = new THREE.MeshStandardMaterial({ color: 0x965044, roughness: 0.55 });
      const lips = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.01), lipMat);
      lips.position.set(0, 0.066, 0.104);
      headGroup.add(lips);

      const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf4eee6, roughness: 0.3 });
      const irisMat = new THREE.MeshStandardMaterial({ color: 0x24160e, roughness: 0.2 });
      const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const side of [-1, 1]) {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(side * 0.032, 0.114, 0.108);
        eyeGroup.rotation.y = side * 0.20;

        const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.010, 0.006), scleraMat);
        const iris = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.010, 0.007), irisMat);
        iris.position.set(0, 0, 0.001);
        const catchlight = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.0035, 0.008), catchlightMat);
        catchlight.position.set(0.0025, 0.002, 0.0015);
        const lash = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.003, 0.008), darkHairMat);
        lash.position.set(0, 0.0055, 0.001);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.0045, 0.008), darkHairMat);
        brow.position.set(0, 0.0145, 0.001);
        brow.rotation.z = -side * 0.08;

        eyeGroup.add(sclera, iris, catchlight, lash, brow);
        headGroup.add(eyeGroup);

        // Slender side-swept temple hair locks framing Naira's cheekbones
        const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.085, 6, 8), darkHairMat);
        sideLock.position.set(side * 0.072, 0.096, 0.042);
        sideLock.rotation.z = side * 0.06;
        sideLock.rotation.x = 0.14;
        headGroup.add(sideLock);
      }

      // Sculpted crown hair dome positioned on back/top of skull so front face stays 100% open
      const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.116, 18, 16),
        darkHairMat
      );
      hairCap.scale.set(0.92, 1.04, 1.06);
      hairCap.position.set(0, 0.146, -0.024);
      headGroup.add(hairCap);

      // Crown side-braid ridges wrapping back toward the nape
      for (const side of [-1, 1]) {
        const crownPlait = new THREE.Mesh(
          new THREE.TorusGeometry(0.095, 0.014, 8, 16, Math.PI * 0.65),
          darkHairMat
        );
        crownPlait.position.set(side * 0.032, 0.152, -0.015);
        crownPlait.rotation.y = Math.PI * 0.5 + side * 0.25;
        crownPlait.rotation.x = 0.35;
        headGroup.add(crownPlait);
      }

      // Articulated 5-segment woven braid plait attached at nape resting visibly over left-back
      this.braidSegments = [];
      let parentPivot: THREE.Object3D = headGroup;
      const segLengths = [0.088, 0.086, 0.082, 0.078, 0.074];
      const segRadii = [0.034, 0.031, 0.028, 0.025, 0.021];

      for (let s = 0; s < segLengths.length; s++) {
        const pivot = new THREE.Group();
        if (s === 0) {
          pivot.position.set(-0.048, 0.072, -0.118);
        } else {
          pivot.position.set(0, -segLengths[s - 1], 0);
        }
        const segLen = segLengths[s];
        // Double-lobed woven plait knot per segment
        for (const lobe of [-0.008, 0.008]) {
          const knot = new THREE.Mesh(
            new THREE.SphereGeometry(segRadii[s] * 0.88, 8, 8),
            darkHairMat
          );
          knot.scale.set(0.95, 1.38, 0.85);
          knot.position.set(lobe, -segLen * 0.45, 0);
          knot.rotation.z = lobe > 0 ? 0.28 : -0.28;
          knot.castShadow = true;
          pivot.add(knot);
        }

        if (s === segLengths.length - 1) {
          const tie = new THREE.Mesh(
            new THREE.CylinderGeometry(0.020, 0.020, 0.028, 10),
            trimWeaveMat
          );
          tie.position.set(0, -segLen * 0.72, 0);
          pivot.add(tie);
        }

        parentPivot.add(pivot);
        this.braidSegments.push(pivot);
        parentPivot = pivot;
      }

      // Quechua woven headband fitted snugly to oval skull width (0.76 X scale)
      const bandMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.116, 0.011, 8, 24),
        trimWeaveMat
      );
      bandMesh.rotation.x = Math.PI / 2 - 0.15;
      bandMesh.scale.set(0.76, 0.96, 1.0);
      bandMesh.position.set(0, 0.155, 0.002);
      headGroup.add(bandMesh);

      headBone.add(headGroup);
    }

    // 2. Neck: Woven Quechua Tunic Collar
    if (neckBone) {
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.084, 0.052, 20, 1, true),
        trimWeaveMat
      );
      collar.scale.set(0.95, 1.0, 0.88);
      collar.position.set(0, 0.018, 0.004);
      collar.castShadow = true;
      neckBone.add(collar);
    }

    // 3. Forearms & Elbows: Rolled Slate-Teal Sleeve Cuffs + Embroidered Trim + Leather Forearm Bracers
    // Completely bridges the wanderer.glb elbow and wrist joints on both arms!
    for (const forearmBone of [leftForearmBone, rightForearmBone]) {
      if (!forearmBone) continue;
      const armGroup = new THREE.Group();

      // Upper forearm rolled slate-teal sleeve cuff bridging the elbow joint (y = -0.045..0.085)
      const sleeveCuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.063, 0.057, 0.13, 18),
        tunicClothMat
      );
      sleeveCuff.position.set(0, 0.02, 0);
      sleeveCuff.castShadow = true;
      armGroup.add(sleeveCuff);

      // Quechua embroidered sleeve cuff band
      const cuffBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.059, 0.057, 0.036, 18),
        trimWeaveMat
      );
      cuffBand.position.set(0, 0.076, 0);
      armGroup.add(cuffBand);

      // Lower forearm saddle-leather archer's bracer (y = 0.12..0.245)
      const bracer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.054, 0.044, 0.125, 18),
        harnessLeatherMat
      );
      bracer.position.set(0, 0.18, 0);
      bracer.castShadow = true;
      armGroup.add(bracer);

      forearmBone.add(armGroup);
    }

    // 4. Shins, Knees & Ankles: Contoured Leather Knee Guards + Andean Woven Leg Gaiters & Boot Cuffs
    // Completely bridges the wanderer.glb knee and ankle joints during running/jumping!
    for (const shinBone of [leftShinBone, rightShinBone]) {
      if (!shinBone) continue;
      const legGroup = new THREE.Group();

      // Knee-joint trouser cuff & leather knee-guard strap bridging y = -0.035..0.075
      const kneeWrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.061, 0.11, 16),
        harnessLeatherMat
      );
      kneeWrap.position.set(0, 0.02, 0.003);
      kneeWrap.castShadow = true;
      legGroup.add(kneeWrap);

      // Woven Andean geometric calf gaiter (y = 0.15..0.28)
      const calfGaiter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.060, 0.052, 0.13, 16),
        trimWeaveMat
      );
      calfGaiter.position.set(0, 0.215, 0);
      calfGaiter.castShadow = true;
      legGroup.add(calfGaiter);

      // Laced leather mountaineering boot shaft bridging the ankle joint (y = 0.27..0.43)
      const bootShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.054, 0.048, 0.16, 16),
        harnessLeatherMat
      );
      bootShaft.position.set(0, 0.35, 0);
      bootShaft.castShadow = true;
      legGroup.add(bootShaft);

      shinBone.add(legGroup);
    }

    // 5. Waist & Pelvis: Contoured Slate-Teal Tunic Bodice + Skirt + Quechua Geometric Hem + Leather Belt & Pouches
    if (hipsBone) {
      const hipsGroup = new THREE.Group();

      // Fitted slate-teal woven tunic waist bodice covering the lower spine/waist seam above the belt
      const waistBodice = new THREE.Mesh(
        new THREE.CylinderGeometry(0.142, 0.148, 0.24, 24, 2, true),
        tunicClothMat
      );
      waistBodice.scale.set(1.04, 1.0, 0.77);
      waistBodice.position.set(0, 0.15, 0.002);
      waistBodice.castShadow = true;
      waistBodice.receiveShadow = true;
      hipsGroup.add(waistBodice);

      // Flared woven tunic skirt covering hips and upper thighs
      const skirtGeom = new THREE.CylinderGeometry(0.145, 0.205, 0.29, 24, 4, true);
      const skirt = new THREE.Mesh(skirtGeom, tunicClothMat);
      skirt.scale.set(1.04, 1.0, 0.78);
      skirt.position.set(0, -0.055, 0.004);
      skirt.castShadow = true;
      skirt.receiveShadow = true;
      hipsGroup.add(skirt);

      // Embroidered Quechua geometric hem border at bottom of tunic skirt (white Inca diamonds & gold checkerboards!)
      const hemGeom = new THREE.CylinderGeometry(0.198, 0.214, 0.068, 24, 1, true);
      const hem = new THREE.Mesh(hemGeom, trimWeaveMat);
      hem.scale.set(1.045, 1.0, 0.785);
      hem.position.set(0, -0.172, 0.004);
      hem.castShadow = true;
      hipsGroup.add(hem);

      // Woven waist sash (chumpi) under leather utility belt
      const sash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.148, 0.154, 0.074, 24),
        trimWeaveMat
      );
      sash.scale.set(1.03, 1.0, 0.77);
      sash.position.set(0, 0.055, 0.004);
      sash.castShadow = true;
      hipsGroup.add(sash);

      // Contoured Brown Leather Expedition Belt + Brass Buckle + Side Utility Pouches
      const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.152, 0.156, 0.036, 24),
        harnessLeatherMat
      );
      belt.scale.set(1.04, 1.0, 0.78);
      belt.position.set(0, 0.055, 0.004);
      belt.castShadow = true;
      hipsGroup.add(belt);

      const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.042, 0.016), buckleBrassMat);
      beltBuckle.position.set(0, 0.055, 0.122);
      hipsGroup.add(beltBuckle);

      // Hip leather utility pouches (left & right-rear as in ref_character_gear)
      for (const pSpec of [
        { x: 0.135, y: 0.015, z: -0.045, ry: -0.35 },
        { x: -0.142, y: 0.01, z: 0.025, ry: 0.25 },
      ]) {
        const hipPouch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, 0.085), harnessLeatherMat);
        hipPouch.position.set(pSpec.x, pSpec.y, pSpec.z);
        hipPouch.rotation.y = pSpec.ry;
        hipPouch.castShadow = true;
        hipsGroup.add(hipPouch);
      }

      hipsBone.add(hipsGroup);
    }

    // 6. Right Thigh: Secondary Leather Holster Strap
    if (rightThighBone) {
      const thighStrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.078, 0.028, 16),
        harnessLeatherMat
      );
      thighStrap.position.set(0, 0.18, 0);
      rightThighBone.add(thighStrap);
    }

    // 7. Torso & Back: Tunic Shoulder Mantle, Crossed Leather X-Harness, Olive Canvas Rucksack,
    // Top Rolled Bedroll, Coiled Hemp Rope, Steel Climbing Pickaxe & Curved Recurve Bow + Arrow Quiver
    if (chestBone) {
      const packGroup = new THREE.Group();

      // Contoured Tunic Shoulder Mantle / Yoke covering the segmented Mannequin_2 shoulder & chest seams
      const shoulderYoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.168, 0.152, 0.21, 24),
        tunicClothMat
      );
      shoulderYoke.scale.set(1.22, 1.0, 0.74);
      shoulderYoke.position.set(0, 0.025, -0.005);
      shoulderYoke.castShadow = true;
      shoulderYoke.receiveShadow = true;
      packGroup.add(shoulderYoke);

      // Crossed Brown Leather Chest & Back X-Harness Straps with Brass Buckle
      for (const diag of [-1, 1]) {
        const backStrap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.28, 0.014), harnessLeatherMat);
        backStrap.position.set(0, 0.02, -0.114);
        backStrap.rotation.z = diag * 0.58;
        backStrap.castShadow = true;
        packGroup.add(backStrap);

        const shoulderStrap = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.08, 0.14), harnessLeatherMat);
        shoulderStrap.position.set(diag * 0.095, 0.125, -0.035);
        shoulderStrap.castShadow = true;
        packGroup.add(shoulderStrap);
      }
      const xBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.018), buckleBrassMat);
      xBuckle.position.set(0.025, 0.01, -0.118);
      xBuckle.rotation.z = 0.58;
      packGroup.add(xBuckle);

      // Weathered Olive-Khaki Canvas Expedition Rucksack (positioned on right-center back so hair braid shows on left)
      const rucksackCanvasMat = new THREE.MeshStandardMaterial({
        map: canvasTex,
        bumpMap: canvasTex,
        bumpScale: 0.016,
        color: 0x6b634b, // Authentic weathered field-khaki canvas
        roughness: 0.84,
        metalness: 0.02,
      });

      const packOffsetX = 0.035;
      const packZ = -0.168;

      // Main sculpted canvas rucksack body + rounded top flap + lower front pocket
      const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.26, 0.115), rucksackCanvasMat);
      packBody.position.set(packOffsetX, -0.015, packZ);
      packBody.castShadow = true;
      packBody.receiveShadow = true;
      packGroup.add(packBody);

      const topFlap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.215, 14), rucksackCanvasMat);
      topFlap.rotation.z = Math.PI / 2;
      topFlap.scale.set(1.0, 1.0, 0.85);
      topFlap.position.set(packOffsetX, 0.105, packZ - 0.005);
      topFlap.castShadow = true;
      packGroup.add(topFlap);

      const frontPocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.042), rucksackCanvasMat);
      frontPocket.position.set(packOffsetX, -0.065, packZ - 0.068);
      frontPocket.castShadow = true;
      packGroup.add(frontPocket);

      // Two vertical brown leather cinch straps with brass buckles down the rucksack face
      for (const sx of [-0.055, 0.055]) {
        const vStrap = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.27, 0.052), harnessLeatherMat);
        vStrap.position.set(packOffsetX + sx, -0.01, packZ - 0.052);
        packGroup.add(vStrap);

        const bkl = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.012), buckleBrassMat);
        bkl.position.set(packOffsetX + sx, 0.025, packZ - 0.082);
        packGroup.add(bkl);
      }

      // Top Rolled Blanket / Bedroll strapped horizontally above the rucksack with 2 leather rings
      const bedrollMat = new THREE.MeshStandardMaterial({
        map: canvasTex,
        bumpMap: canvasTex,
        bumpScale: 0.015,
        color: 0x7c7258,
        roughness: 0.86,
        metalness: 0.01,
      });
      const topBedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.25, 16), bedrollMat);
      topBedroll.rotation.z = Math.PI / 2;
      topBedroll.position.set(packOffsetX, 0.168, packZ);
      topBedroll.castShadow = true;
      packGroup.add(topBedroll);

      // Spiral end-cap detail & 2 leather cinch straps on top bedroll
      for (const bx of [-0.065, 0.065]) {
        const rollStrap = new THREE.Mesh(
          new THREE.TorusGeometry(0.054, 0.007, 8, 16),
          harnessLeatherMat
        );
        rollStrap.rotation.y = Math.PI / 2;
        rollStrap.position.set(packOffsetX + bx, 0.168, packZ);
        packGroup.add(rollStrap);
      }

      // Coiled Hemp Climbing Rope hanging on the left side of the rucksack
      const ropeMat = new THREE.MeshStandardMaterial({
        map: fabricTex,
        bumpMap: fabricTex,
        bumpScale: 0.02,
        color: 0x9c8864,
        roughness: 0.88,
        metalness: 0.0,
      });
      for (let r = 0; r < 4; r++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.012, 8, 16), ropeMat);
        coil.rotation.y = Math.PI / 2 + 0.18;
        coil.position.set(packOffsetX - 0.112 - r * 0.008, 0.005, packZ - 0.005);
        coil.castShadow = true;
        packGroup.add(coil);
      }

      // Forged Steel Mountaineering Climbing Axe strapped to the rucksack face
      const steelMat = new THREE.MeshStandardMaterial({
        color: 0xc4d0da,
        metalness: 0.92,
        roughness: 0.24,
      });
      const woodShaftMat = new THREE.MeshStandardMaterial({
        color: 0x7a5030,
        roughness: 0.65,
      });
      const gripWrapMat = new THREE.MeshStandardMaterial({
        color: 0x221d1a,
        roughness: 0.85,
      });

      const axeGroup = new THREE.Group();
      axeGroup.position.set(packOffsetX - 0.035, -0.02, packZ - 0.095);
      axeGroup.rotation.z = -0.14;

      const axeShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.010, 0.34, 8), woodShaftMat);
      axeShaft.castShadow = true;
      axeGroup.add(axeShaft);

      const axeGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.12, 8), gripWrapMat);
      axeGrip.position.y = -0.11;
      axeGroup.add(axeGrip);

      // Curved steel pick blade & rear adze
      const pickCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.045, 0.155, 0),
        new THREE.Vector3(0.025, 0.168, 0),
        new THREE.Vector3(0.125, 0.128, 0)
      );
      const pickBlade = new THREE.Mesh(new THREE.TubeGeometry(pickCurve, 10, 0.009, 6, false), steelMat);
      pickBlade.scale.set(1.0, 1.0, 0.45);
      pickBlade.castShadow = true;
      axeGroup.add(pickBlade);

      packGroup.add(axeGroup);

      // Curved Wooden Recurve Bow + Taut Bowstring + Leather Quiver with 4 Fletched Arrows on Right Side
      const bowWoodMat = new THREE.MeshStandardMaterial({
        color: 0x825a38,
        roughness: 0.56,
        metalness: 0.04,
      });
      const bowCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.155, -0.18, packZ + 0.02),
        new THREE.Vector3(0.135, -0.04, packZ - 0.01),
        new THREE.Vector3(0.145, 0.12, packZ - 0.02),
        new THREE.Vector3(0.125, 0.28, packZ - 0.01),
        new THREE.Vector3(0.155, 0.42, packZ + 0.02),
      ]);
      const bowLimb = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 20, 0.010, 7, false), bowWoodMat);
      bowLimb.castShadow = true;
      packGroup.add(bowLimb);

      // Taut bowstring connecting the recurved tips
      const stringGeom = new THREE.CylinderGeometry(0.0018, 0.0018, 0.59, 4);
      const stringMat = new THREE.MeshBasicMaterial({ color: 0xd8ceb8 });
      const bowString = new THREE.Mesh(stringGeom, stringMat);
      bowString.position.set(0.105, 0.12, packZ + 0.015);
      bowString.rotation.z = -0.14;
      packGroup.add(bowString);

      // Leather Quiver + 4 Fletched Arrows angled over right shoulder
      const quiverGroup = new THREE.Group();
      quiverGroup.position.set(0.145, 0.04, packZ + 0.015);
      quiverGroup.rotation.z = -0.26;

      const quiverTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.026, 0.24, 12),
        harnessLeatherMat
      );
      quiverTube.castShadow = true;
      quiverGroup.add(quiverTube);

      const featherMat = new THREE.MeshStandardMaterial({
        color: 0xb08a5e,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      for (let a = 0; a < 4; a++) {
        const arrowShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0035, 0.0035, 0.28, 6),
          bowWoodMat
        );
        arrowShaft.position.set((a - 1.5) * 0.009, 0.14, (a % 2) * 0.008);
        arrowShaft.rotation.z = (a - 1.5) * 0.04;
        const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.055, 0.002), featherMat);
        fletch.position.y = 0.11;
        arrowShaft.add(fletch);
        quiverGroup.add(arrowShaft);
      }
      packGroup.add(quiverGroup);

      chestBone.add(packGroup);
    }
  }

  public update(controller: Controller, dt: number, camYaw?: number): void {
    // 1. Sync transform with controller + Foot IK / Crouch / Landing pelvis offset
    this.root.position.copy(controller.pos);
    this.root.rotation.y = controller.heading;

    // 2-Bone Foot Slope Grounding, Crouch drop & Landing knee compression
    const sinH = Math.sin(controller.heading);
    const cosH = Math.cos(controller.heading);
    const leftFootH = standAt(controller.pos.x + cosH * 0.18, controller.pos.z - sinH * 0.18);
    const rightFootH = standAt(controller.pos.x - cosH * 0.18, controller.pos.z + sinH * 0.18);
    const slopeDiff = Math.min(0.35, Math.abs(leftFootH - rightFootH));
    const crouchDrop = controller.crouching ? -0.30 : controller.dodging ? -0.22 : 0;
    const landDrop = controller.pose === 'jump_land' ? -0.14 : 0;
    const targetPelvisOffset = -slopeDiff * 0.35 + crouchDrop + landDrop;
    this.smoothPelvisOffset = THREE.MathUtils.lerp(
      this.smoothPelvisOffset,
      targetPelvisOffset,
      Math.min(1, dt * 12)
    );

    // 2. Forward Athletic Lean (Sprint / Uphill Slope / Mantle / Crouch / Dodge / Grapple) + Turn Banking
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

    // Procedural body banking into turns (proportional to angular velocity * forward speed)
    const speedFactor = THREE.MathUtils.clamp(controller.speed / 6.0, 0.15, 1.0);
    const targetBank = THREE.MathUtils.clamp(-controller.turnRate * 0.042 * speedFactor, -0.18, 0.18);
    this.smoothTurnBank = THREE.MathUtils.lerp(
      this.smoothTurnBank,
      targetBank,
      Math.min(1, dt * 10)
    );

    if (this.modelRoot) {
      this.modelRoot.position.y = this.smoothPelvisOffset;
      this.modelRoot.rotation.x = this.smoothSpinePitch;
      this.modelRoot.rotation.z = this.smoothTurnBank;
    }

    // 3. Secondary Damped-Spring Physics for 5-Segment Hair Braid
    const clampTurn = THREE.MathUtils.clamp(controller.turnRate, -8, 8);
    const restAngleX =
      0.28 +
      (controller.pose === 'run' || controller.pose === 'grapple_swing'
        ? 0.38
        : controller.pose === 'walk'
          ? 0.16
          : 0) +
      Math.max(0, this.smoothSpinePitch * 0.45);
    const strideBounce =
      controller.grounded && controller.speed > 0.2
        ? Math.sin(performance.now() * 0.012 * (controller.pose === 'run' ? 1.5 : 1.0)) *
          0.08 *
          Math.min(1, controller.speed / 4)
        : 0;
    const airLift = !controller.grounded ? THREE.MathUtils.clamp(-controller.vy * 0.05, -0.2, 0.38) : 0;

    const targetX = restAngleX + strideBounce + airLift;
    const targetZ = THREE.MathUtils.clamp(-clampTurn * 0.06, -0.32, 0.32);

    const k = 36;
    const d = 7.5;
    this.braidVelX += ((targetX - this.braidAngleX) * k - this.braidVelX * d) * dt;
    this.braidAngleX += this.braidVelX * dt;

    this.braidVelZ += ((targetZ - this.braidAngleZ) * k - this.braidVelZ * d) * dt;
    this.braidAngleZ += this.braidVelZ * dt;

    for (let i = 0; i < this.braidSegments.length; i++) {
      const seg = this.braidSegments[i];
      // Positive X rotation swings -Y (downward) toward -Z (backward over collar & left shoulder)
      const linkWeight = i === 0 ? 0.55 : i === 1 ? 0.22 : 0.10;
      seg.rotation.x = this.braidAngleX * linkWeight;
      seg.rotation.z = (i === 0 ? -0.14 : -0.02) + this.braidAngleZ * linkWeight;
    }

    // 4. Blend 9-State Locomotion Animations
    if (this.currentPose !== controller.pose) {
      const nextAction =
        this.actions[controller.pose] ||
        (controller.pose === 'grapple_swing' ? this.actions.jump : this.actions.idle);
      if (nextAction && this.currentAction && nextAction !== this.currentAction) {
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

    // 5. Post-Mixer Procedural Grapple Arm Posing
    if (controller.pose === 'grapple_swing') {
      if (this.rightUpperArmBone) {
        this.rightUpperArmBone.rotation.x = -1.65;
        this.rightUpperArmBone.rotation.z = -0.42;
      }
      if (this.rightForearmBone) {
        this.rightForearmBone.rotation.x = -0.35;
      }
      if (this.leftUpperArmBone) {
        this.leftUpperArmBone.rotation.z = 0.65;
      }
      if (this.leftForearmBone) {
        this.leftForearmBone.rotation.x = -0.75;
      }
    } else if (this.isAiming) {
      // Precise two-handed Weaver / isosceles pistol stance pointing forward
      if (this.rightUpperArmBone) {
        this.rightUpperArmBone.rotation.x = -1.48;
        this.rightUpperArmBone.rotation.y = -0.18;
        this.rightUpperArmBone.rotation.z = 0.08;
      }
      if (this.rightForearmBone) {
        this.rightForearmBone.rotation.x = -0.15;
        this.rightForearmBone.rotation.y = 0.05;
      }
      if (this.leftUpperArmBone) {
        this.leftUpperArmBone.rotation.x = -1.35;
        this.leftUpperArmBone.rotation.y = 0.42;
        this.leftUpperArmBone.rotation.z = -0.22;
      }
      if (this.leftForearmBone) {
        this.leftForearmBone.rotation.x = -0.45;
        this.leftForearmBone.rotation.z = 0.35;
      }
    }

    // 6. Post-Mixer Procedural Head Look-Direction Alignment
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
