import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Controller, LocomotionPose } from './controller';

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
 * Generate smooth cylindrical UVs for meshes exported without texture coordinates.
 */
function addCylindricalUVs(geometry: THREE.BufferGeometry): void {
  const pos = geometry.attributes.position;
  if (!pos) return;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);

  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const rangeY = (maxY - minY) || 1.0;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const angle = Math.atan2(z, x);
    const u = ((angle + Math.PI) / (2 * Math.PI)) * 4.0;
    const v = ((y - minY) / rangeY) * 6.0;

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

export class Naira {
  public root = new THREE.Group();
  public modelRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<LocomotionPose, THREE.AnimationAction>> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private currentPose: LocomotionPose = 'idle';

  constructor(scene: THREE.Scene) {
    this.root.name = 'Naira_PlayerRoot';
    scene.add(this.root);
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const texLoader = new THREE.TextureLoader();

    // Load character textures
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

        // Setup Animation Mixer
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
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        addCylindricalUVs(mesh.geometry);

        const name = mesh.name.toLowerCase();
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.side = THREE.DoubleSide;

        if (name.includes('joint') || name.includes('2')) {
          // Weathered Andean dark leather: boots, belt, wrist wraps
          mat.map = leatherTex;
          mat.color.setHex(0x3e2b1d);
          mat.roughness = 0.58;
          mat.metalness = 0.08;
        } else {
          // Weather-worn Andean field canvas khaki / muted olive
          mat.map = canvasTex;
          mat.color.setHex(0x78745c);
          mat.roughness = 0.74;
          mat.metalness = 0.02;
        }
        mat.needsUpdate = true;
      }
    });

    // Rigged Bone Attachments (Skeletal Synchronization)
    const headBone = root.getObjectByName('DEF-head');
    const neckBone = root.getObjectByName('DEF-neck');
    const chestBone = root.getObjectByName('DEF-spine003') || root.getObjectByName('DEF-spine.003');
    const hipsBone = root.getObjectByName('DEF-hips');

    // 1. Head: Hair cap, long nape braid, chumpicord tie, headband, brass field goggles
    if (headBone) {
      const hairGroup = new THREE.Group();
      const darkHairMat = new THREE.MeshStandardMaterial({
        color: 0x14100e,
        roughness: 0.85,
        metalness: 0.08,
      });

      // Scalp hair cap at crown of head
      const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
        darkHairMat
      );
      hairCap.position.set(0, 0.17, -0.01);
      hairGroup.add(hairCap);

      // Long braid running down the back from the nape
      const braidCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.16, -0.10),
        new THREE.Vector3(0.01, 0.04, -0.13),
        new THREE.Vector3(-0.01, -0.12, -0.14),
        new THREE.Vector3(0.01, -0.26, -0.12),
        new THREE.Vector3(0, -0.42, -0.10),
      ]);
      const braidGeom = new THREE.TubeGeometry(braidCurve, 20, 0.018, 8, false);
      const braidMesh = new THREE.Mesh(braidGeom, darkHairMat);
      braidMesh.castShadow = true;
      hairGroup.add(braidMesh);

      // Hair tie / ribbon (woven red chumpicord)
      const tieGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.025, 12);
      const tieMat = new THREE.MeshStandardMaterial({
        color: 0xba3228,
        roughness: 0.6,
        metalness: 0.1,
      });
      const tieMesh = new THREE.Mesh(tieGeom, tieMat);
      tieMesh.position.set(0, -0.38, -0.10);
      tieMesh.rotation.x = 0.2;
      hairGroup.add(tieMesh);

      // Headband / chullo band around brow
      const bandGeom = new THREE.TorusGeometry(0.115, 0.014, 8, 24);
      const bandMat = new THREE.MeshStandardMaterial({
        map: weaveTex,
        color: 0xd47a38,
        roughness: 0.7,
      });
      const bandMesh = new THREE.Mesh(bandGeom, bandMat);
      bandMesh.rotation.x = Math.PI / 2;
      bandMesh.position.set(0, 0.15, 0.01);
      hairGroup.add(bandMesh);

      // Expedition Field Goggles resting on forehead
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xc89842,
        metalness: 0.88,
        roughness: 0.32,
      });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x111e22,
        roughness: 0.1,
        metalness: 0.9,
      });

      const goggleGroup = new THREE.Group();
      goggleGroup.position.set(0, 0.19, 0.10);

      const leftRim = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 16), brassMat);
      leftRim.position.set(-0.045, 0, 0);
      const leftLens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 16), glassMat);
      leftLens.rotation.x = Math.PI / 2;
      leftLens.position.set(-0.045, 0, 0);
      goggleGroup.add(leftRim, leftLens);

      const rightRim = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 16), brassMat);
      rightRim.position.set(0.045, 0, 0);
      const rightLens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 16), glassMat);
      rightLens.rotation.x = Math.PI / 2;
      rightLens.position.set(0.045, 0, 0);
      goggleGroup.add(rightRim, rightLens);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), brassMat);
      goggleGroup.add(bridge);

      hairGroup.add(goggleGroup);
      headBone.add(hairGroup);
    }

    // 2. Neck: Field Cowl / Neckerchief
    if (neckBone) {
      const cowlMat = new THREE.MeshStandardMaterial({
        map: canvasTex,
        color: 0x5a5542,
        roughness: 0.82,
      });
      const cowl = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 8, 20), cowlMat);
      cowl.rotation.x = Math.PI / 2;
      cowl.position.set(0, 0.02, 0);
      cowl.castShadow = true;
      neckBone.add(cowl);
    }

    // 3. Waist: Traditional Andean Woven Sash (Chumpi)
    if (hipsBone) {
      const sashMat = new THREE.MeshStandardMaterial({
        map: weaveTex,
        color: 0xb54026,
        roughness: 0.72,
      });
      const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.195, 0.09, 24, 1, true), sashMat);
      sash.position.set(0, 0.02, 0);
      sash.castShadow = true;
      hipsBone.add(sash);
    }

    // 4. Back: Weathered Leather Expedition Pack & Quena Flute
    if (chestBone) {
      const packGroup = new THREE.Group();
      const packMat = new THREE.MeshStandardMaterial({
        map: leatherTex,
        color: 0x4a3220,
        roughness: 0.62,
        metalness: 0.1,
      });

      const packBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.32, 0.14),
        packMat
      );
      packBody.position.set(0, -0.05, -0.15);
      packBody.castShadow = true;
      packGroup.add(packBody);

      const flap = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.12, 0.15),
        packMat
      );
      flap.position.set(0, 0.07, -0.15);
      packGroup.add(flap);

      const buckleMat = new THREE.MeshStandardMaterial({
        color: 0xc89d42,
        metalness: 0.85,
        roughness: 0.35,
      });
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), buckleMat);
      buckle.position.set(0, 0.02, -0.23);
      packGroup.add(buckle);

      // Cane Quena Flute strapped diagonally across pack
      const fluteMat = new THREE.MeshStandardMaterial({
        color: 0xd4a76a,
        roughness: 0.45,
        metalness: 0.05,
      });
      const flute = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.42, 12),
        fluteMat
      );
      flute.position.set(0.04, -0.02, -0.23);
      flute.rotation.z = 0.55;
      packGroup.add(flute);

      chestBone.add(packGroup);
    }
  }

  public update(controller: Controller, dt: number): void {
    // 1. Sync transform with controller
    this.root.position.copy(controller.pos);
    this.root.rotation.y = controller.heading;

    // 2. Blend locomotion animations
    if (this.currentPose !== controller.pose) {
      const nextAction = this.actions[controller.pose];
      if (nextAction && this.currentAction && nextAction !== this.currentAction) {
        nextAction.reset();
        nextAction.enabled = true;

        // Tune playback rate to ground speed
        if (controller.pose === 'walk') {
          nextAction.timeScale = Math.max(0.7, controller.speed / 2.2);
        } else if (controller.pose === 'run') {
          nextAction.timeScale = Math.max(0.8, controller.speed / 5.5);
        } else {
          nextAction.timeScale = 1.0;
        }

        nextAction.crossFadeFrom(this.currentAction, 0.22, true);
        nextAction.play();
        this.currentAction = nextAction;
      }
      this.currentPose = controller.pose;
    } else if (this.currentAction) {
      if (controller.pose === 'walk') {
        this.currentAction.timeScale = Math.max(0.7, controller.speed / 2.2);
      } else if (controller.pose === 'run') {
        this.currentAction.timeScale = Math.max(0.8, controller.speed / 5.5);
      }
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}
