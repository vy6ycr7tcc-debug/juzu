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
    // 1. Head & Hair: crown, scalp, and back of head get rich espresso hair color; face gets warm Andean skin
    if (n.includes('head')) {
      return [0.76, 0.53, 0.38];
    }
    if (
      n.includes('neck') ||
      n.includes('forearm') ||
      n.includes('f_') ||
      n.includes('thumb')
    ) {
      return [0.76, 0.53, 0.38];
    }
    // 2. Fingerless leather climbing gloves on palms/wrists
    if (n.includes('hand')) {
      return [0.30, 0.20, 0.14];
    }
    // 3. Tomb Raider teal-slate expedition field top & rolled upper sleeves
    if (n.includes('spine') || n.includes('shoulder') || n.includes('upper_arm')) {
      return [0.27, 0.39, 0.38];
    }
    // 4. Laced dark cordovan mountaineering boots
    if (n.includes('foot') || n.includes('toe')) {
      return [0.20, 0.13, 0.09];
    }
    // 5. Rugged charcoal-earth cargo expedition trousers (hips, thighs, shins)
    return [0.26, 0.23, 0.19];
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

      // Paint the back of the skull and the entire crown/forehead above the goggles with dark espresso hair
      if (headWeight > 0.35) {
        const normY = (y - minY) / rangeY;
        const isScalpOrBack = normY > 0.935 || z < 0.025;
        if (isScalpOrBack) {
          cr = 0.08;
          cg = 0.06;
          cb = 0.05;
        }
      }

      colors[i * 3] = cr;
      colors[i * 3 + 1] = cg;
      colors[i * 3 + 2] = cb;
    } else {
      colors[i * 3] = 0.45;
      colors[i * 3 + 1] = 0.42;
      colors[i * 3 + 2] = 0.36;
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
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<LocomotionPose, THREE.AnimationAction>> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private currentPose: LocomotionPose = 'idle';

  // Articulated 3-segment hair braid for secondary pendulum motion
  private braidSegments: THREE.Object3D[] = [];
  private braidAngleX = 0.12;
  private braidVelX = 0;
  private braidAngleZ = 0;
  private braidVelZ = 0;
  private lastHeading = 0;
  private smoothPelvisOffset = 0;
  private smoothSpinePitch = 0;

  constructor(scene: THREE.Scene) {
    this.root.name = 'Naira_PlayerRoot';
    scene.add(this.root);
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const texLoader = new THREE.TextureLoader();

    const canvasTex = texLoader.load('/juzu/assets/character-textures/character-canvas.jpeg');
    canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
    canvasTex.repeat.set(3, 4);

    const leatherTex = texLoader.load('/juzu/assets/character-textures/character-leather.jpeg');
    leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
    leatherTex.repeat.set(2, 2);

    const weaveTex = texLoader.load('/juzu/assets/character-textures/character-quechua-weave.jpg');
    weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
    weaveTex.repeat.set(4, 1);

    loader.load(
      '/juzu/models/wanderer.glb',
      (gltf) => {
        this.modelRoot = gltf.scene;
        floatAttributes(this.modelRoot);

        this.applyAndeanMaterialsAndGear(this.modelRoot, canvasTex, leatherTex, weaveTex);

        this.modelRoot.scale.setScalar(1.0);
        this.root.add(this.modelRoot);

        this.mixer = new THREE.AnimationMixer(this.modelRoot);
        const clips = gltf.animations || [];

        const findClip = (namePart: string) =>
          clips.find((c) => c.name.toLowerCase().includes(namePart.toLowerCase()));

        const idleClip = findClip('idle');
        const walkClip = findClip('walk');
        const runClip = findClip('jog') || findClip('run');
        const jumpClip = findClip('jump_loop') || findClip('jump');
        const swimClip = findClip('swim_fwd') || findClip('swim');

        if (idleClip) this.actions.idle = this.mixer.clipAction(idleClip);
        if (walkClip) this.actions.walk = this.mixer.clipAction(walkClip);
        if (runClip) this.actions.run = this.mixer.clipAction(runClip);
        if (jumpClip) this.actions.jump = this.mixer.clipAction(jumpClip);
        if (swimClip) this.actions.swim = this.mixer.clipAction(swimClip);

        if (this.actions.idle) {
          this.actions.idle.play();
          this.currentAction = this.actions.idle;
        }
      },
      undefined,
      (err) => {
        console.warn('Failed to load character model:', err);
      }
    );
  }

  private applyAndeanMaterialsAndGear(
    root: THREE.Object3D,
    canvasTex: THREE.Texture,
    leatherTex: THREE.Texture,
    weaveTex: THREE.Texture
  ): void {
    // Unified seamless material for BOTH Mannequin_1 and Mannequin_2 so ball joints vanish completely
    const unifiedBodyMat = new THREE.MeshStandardMaterial({
      map: canvasTex,
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.72,
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
    const neckBone = root.getObjectByName('DEF-neck');
    const chestBone = root.getObjectByName('DEF-spine003') || root.getObjectByName('DEF-spine.003');
    const hipsBone = root.getObjectByName('DEF-hips');
    const rightThighBone = root.getObjectByName('DEF-thigh.R');

    // 1. Head: Sculpted Hair Crown, Subtle Facial Features, Physics Braid, Headband & Goggles
    if (headBone) {
      const headGroup = new THREE.Group();
      const darkHairMat = new THREE.MeshStandardMaterial({
        color: 0x16110d,
        roughness: 0.76,
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

        // Side-swept temple hair locks framing Naira's cheekbones without covering eyes
        const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.11, 6, 8), darkHairMat);
        sideLock.position.set(side * 0.082, 0.088, 0.018);
        sideLock.rotation.z = side * 0.10;
        sideLock.rotation.x = 0.16;
        headGroup.add(sideLock);
      }

      // Sculpted crown hair dome positioned on back/top of skull so front face stays 100% open
      const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.114, 18, 16),
        darkHairMat
      );
      hairCap.scale.set(0.92, 1.02, 1.04);
      hairCap.position.set(0, 0.146, -0.026);
      headGroup.add(hairCap);

      // Articulated 3-segment physics braid chain attached at nape (0, 0.06, -0.11)
      const tieMat = new THREE.MeshStandardMaterial({
        color: 0xba3228,
        roughness: 0.6,
        metalness: 0.1,
      });

      this.braidSegments = [];
      let parentPivot: THREE.Object3D = headGroup;
      const segLengths = [0.15, 0.15, 0.14];
      const segRadii = [0.024, 0.020, 0.015];

      for (let s = 0; s < 3; s++) {
        const pivot = new THREE.Group();
        if (s === 0) {
          pivot.position.set(0, 0.065, -0.105);
        } else {
          pivot.position.set(0, -segLengths[s - 1], 0);
        }
        const segLen = segLengths[s];
        const segMesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(segRadii[s], segLen * 0.7, 6, 8),
          darkHairMat
        );
        segMesh.position.set(0, -segLen * 0.5, 0);
        segMesh.castShadow = true;
        pivot.add(segMesh);

        if (s === 2) {
          const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.026, 10), tieMat);
          tie.position.set(0, -segLen * 0.78, 0);
          pivot.add(tie);
        }

        parentPivot.add(pivot);
        this.braidSegments.push(pivot);
        parentPivot = pivot;
      }

      // Quechua woven headband fitted snugly to oval skull width (0.76 X scale)
      const bandMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.116, 0.013, 8, 24),
        new THREE.MeshStandardMaterial({ map: weaveTex, color: 0xd47a38, roughness: 0.7 })
      );
      bandMesh.rotation.x = Math.PI / 2 - 0.15;
      bandMesh.scale.set(0.76, 0.96, 1.0);
      bandMesh.position.set(0, 0.155, 0.002);
      headGroup.add(bandMesh);

      // Brass Expedition Goggles resting on brow
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xc89842,
        metalness: 0.88,
        roughness: 0.3,
      });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x162830,
        roughness: 0.12,
        metalness: 0.85,
      });
      const goggleGroup = new THREE.Group();
      goggleGroup.position.set(0, 0.172, 0.104);
      goggleGroup.rotation.x = -0.18;

      for (const side of [-0.042, 0.042]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 16), brassMat);
        rim.position.set(side, 0, 0);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.005, 14), glassMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(side, 0, 0);
        goggleGroup.add(rim, lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.006), brassMat);
      goggleGroup.add(bridge);
      headGroup.add(goggleGroup);

      headBone.add(headGroup);
    }

    // 2. Neck: Field Cowl / Neckerchief
    if (neckBone) {
      const cowlMat = new THREE.MeshStandardMaterial({
        map: canvasTex,
        color: 0x7a3428, // Warm rust-red expedition scarf
        roughness: 0.8,
      });
      const cowl = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.026, 8, 20), cowlMat);
      cowl.rotation.x = Math.PI / 2;
      cowl.position.set(0, 0.02, 0.008);
      cowl.castShadow = true;
      neckBone.add(cowl);
    }

    // 3. Waist: Traditional Andean Woven Sash (Chumpi) & Leather Utility Belt
    if (hipsBone) {
      const sashMat = new THREE.MeshStandardMaterial({
        map: weaveTex,
        color: 0xb54026,
        roughness: 0.72,
      });
      const sash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.148, 0.158, 0.075, 24),
        sashMat
      );
      sash.scale.set(1.02, 1.0, 0.78);
      sash.position.set(0, 0.04, 0.005);
      sash.castShadow = true;
      hipsBone.add(sash);
    }

    // 4. Right Thigh: Tomb Raider Leather Artifact Satchel & Strap
    if (rightThighBone) {
      const satchelMat = new THREE.MeshStandardMaterial({
        map: leatherTex,
        color: 0x3e2818,
        roughness: 0.6,
        metalness: 0.08,
      });
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.11), satchelMat);
      pouch.position.set(-0.095, 0.16, 0.01);
      pouch.castShadow = true;
      rightThighBone.add(pouch);
    }

    // 5. Back: Leather Expedition Pack, Shoulder Harness Straps, Quena Flute & Climbing Ice-Axe
    if (chestBone) {
      const packGroup = new THREE.Group();
      const packMat = new THREE.MeshStandardMaterial({
        map: leatherTex,
        color: 0x4a3220,
        roughness: 0.62,
        metalness: 0.1,
      });

      // Clean leather shoulder harness straps over left & right shoulders
      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.24, 0.11), packMat);
        strap.position.set(side * 0.086, 0.03, -0.065);
        strap.castShadow = true;
        packGroup.add(strap);
      }

      const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.31, 0.13), packMat);
      packBody.position.set(0, -0.02, -0.15);
      packBody.castShadow = true;
      packGroup.add(packBody);

      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.14), packMat);
      flap.position.set(0, 0.09, -0.15);
      packGroup.add(flap);

      const buckleMat = new THREE.MeshStandardMaterial({
        color: 0xc89d42,
        metalness: 0.85,
        roughness: 0.35,
      });
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), buckleMat);
      buckle.position.set(0, 0.04, -0.225);
      packGroup.add(buckle);

      // Cane Quena Flute strapped diagonally across pack
      const fluteMat = new THREE.MeshStandardMaterial({
        color: 0xd4a76a,
        roughness: 0.45,
        metalness: 0.05,
      });
      const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.40, 10), fluteMat);
      flute.position.set(0.04, 0.0, -0.225);
      flute.rotation.z = 0.55;
      packGroup.add(flute);

      // Tomb Raider Steel Climbing Ice-Axe strapped to left side of pack
      const steelMat = new THREE.MeshStandardMaterial({
        color: 0xb8c2cc,
        metalness: 0.9,
        roughness: 0.28,
      });
      const axeShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.012, 0.44, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a3324, roughness: 0.5 })
      );
      axeShaft.position.set(-0.125, -0.02, -0.16);
      axeShaft.rotation.z = -0.15;
      const axePick = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 6), steelMat);
      axePick.rotation.z = Math.PI * 0.58;
      axePick.position.set(-0.06, 0.19, 0);
      axeShaft.add(axePick);
      packGroup.add(axeShaft);

      chestBone.add(packGroup);
    }
  }

  public update(controller: Controller, dt: number): void {
    // 1. Sync transform with controller + Foot IK / Crouch pelvis offset
    this.root.position.copy(controller.pos);
    this.root.rotation.y = controller.heading;

    // 2-Bone Foot Slope Grounding & Crouch posture offset
    const sinH = Math.sin(controller.heading);
    const cosH = Math.cos(controller.heading);
    const leftFootH = standAt(controller.pos.x + cosH * 0.18, controller.pos.z - sinH * 0.18);
    const rightFootH = standAt(controller.pos.x - cosH * 0.18, controller.pos.z + sinH * 0.18);
    const slopeDiff = Math.min(0.35, Math.abs(leftFootH - rightFootH));
    const crouchDrop = controller.crouching ? -0.32 : 0;
    const targetPelvisOffset = -slopeDiff * 0.35 + crouchDrop;
    this.smoothPelvisOffset = THREE.MathUtils.lerp(
      this.smoothPelvisOffset,
      targetPelvisOffset,
      Math.min(1, dt * 12)
    );

    // Forward athletic lean when sprinting, mantling, or crouching
    const targetPitch = controller.mantling
      ? 0.24
      : controller.crouching
        ? 0.28
        : controller.pose === 'run'
          ? 0.09
          : controller.pose === 'walk'
            ? 0.04
            : 0;
    this.smoothSpinePitch = THREE.MathUtils.lerp(
      this.smoothSpinePitch,
      targetPitch,
      Math.min(1, dt * 10)
    );

    if (this.modelRoot) {
      this.modelRoot.position.y = this.smoothPelvisOffset;
      this.modelRoot.rotation.x = this.smoothSpinePitch;
    }

    // 3. Secondary Damped-Spring Physics for 3-Segment Hair Braid
    const turnRate = (controller.heading - this.lastHeading) / Math.max(0.001, dt);
    this.lastHeading = controller.heading;
    const clampTurn = THREE.MathUtils.clamp(turnRate, -8, 8);

    const restAngleX = 0.18 + (controller.pose === 'run' ? 0.38 : controller.pose === 'walk' ? 0.16 : 0);
    const strideBounce =
      controller.grounded && controller.speed > 0.2
        ? Math.sin(performance.now() * 0.012 * (controller.pose === 'run' ? 1.5 : 1.0)) *
          0.08 *
          Math.min(1, controller.speed / 4)
        : 0;
    const airLift = !controller.grounded ? THREE.MathUtils.clamp(-controller.vy * 0.06, -0.25, 0.45) : 0;

    const targetX = restAngleX + strideBounce + airLift;
    const targetZ = THREE.MathUtils.clamp(-clampTurn * 0.065, -0.35, 0.35);

    const k = 36;
    const d = 7.5;
    this.braidVelX += ((targetX - this.braidAngleX) * k - this.braidVelX * d) * dt;
    this.braidAngleX += this.braidVelX * dt;

    this.braidVelZ += ((targetZ - this.braidAngleZ) * k - this.braidVelZ * d) * dt;
    this.braidAngleZ += this.braidVelZ * dt;

    for (let i = 0; i < this.braidSegments.length; i++) {
      const seg = this.braidSegments[i];
      const w = (i + 1) * 0.42;
      seg.rotation.x = this.braidAngleX * w;
      seg.rotation.z = this.braidAngleZ * w;
    }

    // 4. Blend locomotion animations
    if (this.currentPose !== controller.pose) {
      const nextAction = this.actions[controller.pose];
      if (nextAction && this.currentAction && nextAction !== this.currentAction) {
        nextAction.reset();
        nextAction.enabled = true;

        if (controller.pose === 'walk') {
          nextAction.timeScale = Math.max(0.7, controller.speed / 2.2);
        } else if (controller.pose === 'run') {
          nextAction.timeScale = Math.max(0.85, controller.speed / 5.5);
        } else {
          nextAction.timeScale = 1.0;
        }

        nextAction.crossFadeFrom(this.currentAction, 0.2, true);
        nextAction.play();
        this.currentAction = nextAction;
      }
      this.currentPose = controller.pose;
    } else if (this.currentAction) {
      if (controller.pose === 'walk') {
        this.currentAction.timeScale = Math.max(0.7, controller.speed / 2.2);
      } else if (controller.pose === 'run') {
        this.currentAction.timeScale = Math.max(0.85, controller.speed / 5.5);
      }
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}
