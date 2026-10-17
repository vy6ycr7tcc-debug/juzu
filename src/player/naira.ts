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

    loader.load(
      '/juzu/models/wanderer.glb',
      (gltf) => {
        this.modelRoot = gltf.scene;
        floatAttributes(this.modelRoot);

        this.applyAndeanMaterials(this.modelRoot);

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

  private applyAndeanMaterials(root: THREE.Object3D): void {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const name = mesh.name.toLowerCase();
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.side = THREE.DoubleSide;

        if (name.includes('joint') || name.includes('2')) {
          // Weathered Andean dark leather: boots, belt, wrist wraps
          mat.color.setHex(0x443020);
          mat.roughness = 0.55;
          mat.metalness = 0.08;
        } else {
          // Weather-worn Andean field canvas khaki / muted olive
          mat.color.setHex(0x8e826e);
          mat.roughness = 0.72;
          mat.metalness = 0.03;
        }
      }
    });
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
