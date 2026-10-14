/**
 * Module: src/character/naira.ts
 * Responsibility: Naira Quispe protagonist controller, rigged GLB loading
 * (`/juzu/models/michelle.glb`), mesh tailoring (removing sunglasses/headphones/puffs
 * to match Naira's §1.3 archaeologist appearance), `AnimationMixer` state machine
 * (Idle, Walk 1.4 m/s, Jog 3.0 m/s, Sprint 5.5 m/s, Crouch 0.8 m/s), secondary
 * physics hair braid, bone-attached Andean field kit (satchel, quiver, bow, woven
 * Quechua belt, knife, water skin, chakana pendant), and per-frame raycast terrain
 * grounding with contact shadow per Bible §1.3, §2.7, §3.1.
 * Depends on: three, three/addons/loaders/GLTFLoader.js, src/core/input.ts,
 * src/world/materials.ts, src/world/terrain.ts, src/core/audio.ts.
 * Exports: LocomotionMode, NairaController.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { InputState } from '../core/input';
import { AudioManager } from '../core/audio';
import { PbrMaterialLibrary } from '../world/materials';
import { TerrainSystem } from '../world/terrain';
import { TraversalSystem, ZiplineSpan } from '../gameplay/traversal';

export type LocomotionMode = 'idle' | 'walk' | 'jog' | 'sprint' | 'crouch' | 'climb' | 'zipline' | 'aim';

// Preallocated module-scope scratch objects — zero per-frame allocations (§5.2 #1)
const _moveVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);

export class NairaController {
  public readonly root: THREE.Group = new THREE.Group();
  public readonly position: THREE.Vector3 = new THREE.Vector3(0, 1.68, 9.2);
  public yaw: number = Math.PI; // Facing North toward the hanging bridge & valley vista
  public speed: number = 0;
  public stamina: number = 100;
  public mode: LocomotionMode = 'idle';
  public isGrounded: boolean = true;
  public modelLoaded: boolean = false;
  public ziplineActive: boolean = false;

  private ziplineSpan: ZiplineSpan | null = null;
  private ziplineT: number = 0;
  private fallApexY: number = 0;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<LocomotionMode, THREE.AnimationAction>> = {};
  private activeAction: THREE.AnimationAction | null = null;
  private modelRoot: THREE.Object3D | null = null;
  private contactShadowMesh: THREE.Mesh | null = null;
  private heldBowGroup: THREE.Group | null = null;
  private backBowMesh: THREE.Mesh | null = null;

  // Skeleton bone references
  private hipsBone: THREE.Object3D | null = null;
  private spineBone: THREE.Object3D | null = null;
  private spine1Bone: THREE.Object3D | null = null;
  private spine2Bone: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  private leftArmBone: THREE.Object3D | null = null;
  private rightArmBone: THREE.Object3D | null = null;
  private leftForeArmBone: THREE.Object3D | null = null;
  private rightForeArmBone: THREE.Object3D | null = null;
  private leftUpLegBone: THREE.Object3D | null = null;
  private rightUpLegBone: THREE.Object3D | null = null;
  private leftLegBone: THREE.Object3D | null = null;
  private rightLegBone: THREE.Object3D | null = null;

  // Secondary physics hair braid segments (§1.3 & §2.7 "The braid must move with physics")
  private readonly braidNodes: THREE.Object3D[] = [];
  private readonly braidAnglesX: Float32Array = new Float32Array(5);
  private readonly braidAnglesZ: Float32Array = new Float32Array(5);
  private readonly braidVelX: Float32Array = new Float32Array(5);
  private readonly braidVelZ: Float32Array = new Float32Array(5);

  private verticalVelocity: number = 0;
  private sprintDurationSec: number = 0;
  private elapsedSec: number = 0;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  public async build(
    scene: THREE.Scene,
    pbr: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): Promise<void> {
    this.root.name = 'NairaQuispe';
    const startY = terrain.sampleGroundY(this.position.x, this.position.z, 3.0);
    this.position.y = startY;
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;

    // 1. Contact shadow decal beneath Naira's boots (§2.1 "Everything touches the ground with contact shadow")
    const shadowTex = this.createContactShadowTexture(64);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x060907),
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    shadowGeo.rotateX(-Math.PI / 2);
    this.geometries.push(shadowGeo);
    this.materials.push(shadowMat);
    this.contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadowMesh.position.set(0, 0.02, 0);
    this.root.add(this.contactShadowMesh);

    scene.add(this.root);

    // 2. Load rigged GLB character (`/juzu/models/michelle.glb`) + Naira custom weathered texture
    await this.loadRiggedGlbCharacter(pbr);
  }

  private async loadRiggedGlbCharacter(pbr: PbrMaterialLibrary): Promise<void> {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const nairaAlbedo = await new Promise<THREE.Texture | null>(resolve => {
      texLoader.load(
        '/juzu/assets/character-textures/naira_adventurer_albedo.png',
        tex => {
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          this.textures.push(tex);
          resolve(tex);
        },
        undefined,
        () => resolve(null)
      );
    });

    const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null>(
      resolve => {
        loader.load(
          '/juzu/models/michelle.glb',
          res => resolve(res),
          undefined,
          () => resolve(null)
        );
      }
    );

    if (!gltf) return;

    const model = gltf.scene;
    model.name = 'NairaRiggedGLB';

    // `michelle.glb` bind geometry is 1.6616 m tall; scale by 1.011 to match exact 1.68 m (§1.3)
    model.scale.setScalar(1.011);
    model.position.set(0, 0, 0);

    model.traverse(child => {
      const n = child.name;
      if (n === 'mixamorigHips' || n === 'mixamorig:Hips') this.hipsBone = child;
      else if (n === 'mixamorigSpine' || n === 'mixamorig:Spine') this.spineBone = child;
      else if (n === 'mixamorigSpine1' || n === 'mixamorig:Spine1') this.spine1Bone = child;
      else if (n === 'mixamorigSpine2' || n === 'mixamorig:Spine2') this.spine2Bone = child;
      else if (n === 'mixamorigHead' || n === 'mixamorig:Head') this.headBone = child;
      else if (n === 'mixamorigLeftArm' || n === 'mixamorig:LeftArm') this.leftArmBone = child;
      else if (n === 'mixamorigRightArm' || n === 'mixamorig:RightArm') this.rightArmBone = child;
      else if (n === 'mixamorigLeftForeArm' || n === 'mixamorig:LeftForeArm') this.leftForeArmBone = child;
      else if (n === 'mixamorigRightForeArm' || n === 'mixamorig:RightForeArm') this.rightForeArmBone = child;
      else if (n === 'mixamorigLeftUpLeg' || n === 'mixamorig:LeftUpLeg') this.leftUpLegBone = child;
      else if (n === 'mixamorigRightUpLeg' || n === 'mixamorig:RightUpLeg') this.rightUpLegBone = child;
      else if (n === 'mixamorigLeftLeg' || n === 'mixamorig:LeftLeg') this.leftLegBone = child;
      else if (n === 'mixamorigRightLeg' || n === 'mixamorig:RightLeg') this.rightLegBone = child;

      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        this.tailorNairaMeshGeometry(mesh.geometry);
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        const oldMat = mesh.material as THREE.MeshStandardMaterial;
        const nairaMat = new THREE.MeshStandardMaterial({
          name: 'NairaWeatheredFieldKitPBR',
          color: new THREE.Color(0xfffaf2),
          map: nairaAlbedo || oldMat?.map || null,
          normalMap: oldMat?.normalMap || null,
          normalScale: new THREE.Vector2(0.75, 0.75),
          roughness: 0.78,
          metalness: 0.04,
        });
        this.materials.push(nairaMat);
        mesh.material = nairaMat;
      }
    });

    // Attach Naira's §1.3 field kit & physics hair braid (Mixamo bone space is in cm -> scale 100)
    this.attachFieldKitAndBraid(pbr, 100.0);

    this.modelRoot = model;
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);

    this.buildSkeletonAnimationClips();

    if (this.actions.idle && this.mixer) {
      this.activeAction = this.actions.idle;
      this.activeAction.play();
      this.mixer.update(0.05);
    }

    this.modelLoaded = true;
  }

  /**
   * Tailors the raw `michelle.glb` geometry into Naira Quispe (§1.3):
   * Removes the disconnected sunglasses, headphones, and side pigtail puff components
   * while preserving her face, eyes, brows, parted scalp hair, and body mesh.
   */
  private tailorNairaMeshGeometry(geo: THREE.BufferGeometry): void {
    const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
    const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
    const idxAttr = geo.index;
    if (!pos || !uv || !idxAttr) return;

    const vCount = pos.count;
    const parent = new Int32Array(vCount);
    for (let i = 0; i < vCount; i++) parent[i] = i;

    const find = (x: number): number => {
      let curr = x;
      while (parent[curr] !== curr) {
        parent[curr] = parent[parent[curr]];
        curr = parent[curr];
      }
      return curr;
    };

    const indices = idxAttr.array;
    for (let i = 0; i < indices.length; i += 3) {
      const r0 = find(indices[i]);
      const r1 = find(indices[i + 1]);
      const r2 = find(indices[i + 2]);
      if (r0 !== r1) parent[r0] = r1;
      if (find(r1) !== r2) parent[find(r1)] = r2;
    }

    const compSize = new Int32Array(vCount);
    const minY = new Float32Array(vCount).fill(Infinity);
    const maxZ = new Float32Array(vCount).fill(-Infinity);
    const minZ = new Float32Array(vCount).fill(Infinity);
    const maxUvY = new Float32Array(vCount).fill(-Infinity);

    for (let v = 0; v < vCount; v++) {
      const r = find(v);
      compSize[r]++;
      const py = pos.getY(v);
      const pz = pos.getZ(v);
      const uy = uv.getY(v);
      if (py < minY[r]) minY[r] = py;
      if (pz > maxZ[r]) maxZ[r] = pz;
      if (pz < minZ[r]) minZ[r] = pz;
      if (uy > maxUvY[r]) maxUvY[r] = uy;
    }
    // Tailor mesh UVs and vertex positions into Naira field attire (§1.3 & §2.7)
    for (let v = 0; v < vCount; v++) {
      const r = find(v);
      let vx = pos.getX(v);
      let vy = pos.getY(v);
      let vz = pos.getZ(v);

      // Taper flared lower pant leg cuffs into straight-cut field trousers (§1.3)
      if (vy >= 0.14 && vy <= 0.56) {
        const legCx = vx >= 0 ? 0.098 : -0.098;
        const legCz = -0.002;
        const dx = vx - legCx;
        const dz = vz - legCz;
        const rad = Math.hypot(dx, dz);
        const maxRad = 0.062;
        if (rad > maxRad) {
          const newRad = maxRad + (rad - maxRad) * 0.24;
          const s = newRad / rad;
          vx = legCx + dx * s;
          vz = legCz + dz * s;
          pos.setXYZ(v, vx, vy, vz);
        }
      }
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;

    // Filter out triangles belonging to headphones, sunglasses, or side hair puffs
    const keptIndices: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      const r = find(a);

      let remove = false;
      if (minY[r] > 1.35) {
        // Sunglasses (all frames, bridge, and lenses have UV in top strip maxUvY < 0.15)
        if (maxUvY[r] < 0.15) {
          remove = true;
        }
        // Headphones (earcups at sides minX < -0.10 or maxX > 0.10 with compSize >= 400)
        if (compSize[r] >= 400 && (maxZ[r] <= 0.06 && minZ[r] >= -0.06)) {
          remove = true;
        }
        // Side pigtail hair-puff balls (outside natural head silhouette: |X| > 0.11, Z < 0.02)
        if (compSize[r] <= 120 && maxZ[r] <= 0.03 && (minY[r] > 1.38)) {
          remove = true;
        }
      }

      if (!remove) {
        keptIndices.push(a, b, c);
      }
    }

    geo.setIndex(keptIndices);
    geo.computeVertexNormals();
  }

  private buildSkeletonAnimationClips(): void {
    if (!this.mixer) return;

    const composeTrack = (
      bone: THREE.Object3D | null,
      times: number[],
      localEulers: Array<[number, number, number]>
    ): THREE.KeyframeTrack | null => {
      if (!bone) return null;
      const bindQ = new THREE.Quaternion(
        bone.quaternion.x,
        bone.quaternion.y,
        bone.quaternion.z,
        bone.quaternion.w
      );
      const values = new Float32Array(times.length * 4);
      const eul = new THREE.Euler();
      const dq = new THREE.Quaternion();
      const outQ = new THREE.Quaternion();

      for (let i = 0; i < times.length; i++) {
        const [rx, ry, rz] = localEulers[i];
        eul.set(rx, ry, rz);
        dq.setFromEuler(eul);
        outQ.copy(bindQ).multiply(dq);
        values[i * 4] = outQ.x;
        values[i * 4 + 1] = outQ.y;
        values[i * 4 + 2] = outQ.z;
        values[i * 4 + 3] = outQ.w;
      }
      return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values);
    };

    const composeDirectEulerTrack = (
      bone: THREE.Object3D | null,
      times: number[],
      localEulers: Array<[number, number, number]>
    ): THREE.KeyframeTrack | null => {
      if (!bone) return null;
      const values = new Float32Array(times.length * 4);
      const eul = new THREE.Euler();
      const q = new THREE.Quaternion();

      for (let i = 0; i < times.length; i++) {
        const [rx, ry, rz] = localEulers[i];
        eul.set(rx, ry, rz);
        q.setFromEuler(eul);
        values[i * 4] = q.x;
        values[i * 4 + 1] = q.y;
        values[i * 4 + 2] = q.z;
        values[i * 4 + 3] = q.w;
      }
      return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values);
    };

    const idleTimes = [0.0, 1.2, 2.4];
    const idleTracks: THREE.KeyframeTrack[] = [];
    const addT = (list: THREE.KeyframeTrack[], tr: THREE.KeyframeTrack | null): void => {
      if (tr) list.push(tr);
    };

    addT(idleTracks, composeTrack(this.spineBone, idleTimes, [
      [0.03, 0.02, 0.0],
      [0.05, -0.01, 0.0],
      [0.03, 0.02, 0.0],
    ]));
    addT(idleTracks, composeTrack(this.spine2Bone, idleTimes, [
      [0.02, 0.03, 0.0],
      [0.04, -0.02, 0.0],
      [0.02, 0.03, 0.0],
    ]));
    addT(idleTracks, composeTrack(this.headBone, idleTimes, [
      [-0.04, -0.06, 0.0],
      [-0.02, 0.05, 0.01],
      [-0.04, -0.06, 0.0],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.leftArmBone, idleTimes, [
      [1.15, 0.05, -0.15],
      [1.18, 0.04, -0.14],
      [1.15, 0.05, -0.15],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.rightArmBone, idleTimes, [
      [1.15, -0.05, 0.15],
      [1.18, -0.04, 0.14],
      [1.15, -0.05, 0.15],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.leftForeArmBone, idleTimes, [
      [0.20, 0.0, 0.20],
      [0.22, 0.0, 0.20],
      [0.20, 0.0, 0.20],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.rightForeArmBone, idleTimes, [
      [0.20, 0.0, -0.20],
      [0.22, 0.0, -0.20],
      [0.20, 0.0, -0.20],
    ]));
    addT(idleTracks, composeTrack(this.leftUpLegBone, idleTimes, [
      [0.02, 0.0, -0.02],
      [0.03, 0.0, -0.02],
      [0.02, 0.0, -0.02],
    ]));
    addT(idleTracks, composeTrack(this.rightUpLegBone, idleTimes, [
      [-0.02, 0.0, 0.02],
      [-0.03, 0.0, 0.02],
      [-0.02, 0.0, 0.02],
    ]));
    addT(idleTracks, composeTrack(this.leftLegBone, idleTimes, [
      [-0.05, 0.0, 0.0],
      [-0.03, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]));
    addT(idleTracks, composeTrack(this.rightLegBone, idleTimes, [
      [-0.05, 0.0, 0.0],
      [-0.03, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]));

    const idleClip = new THREE.AnimationClip('idle', 2.4, idleTracks);
    this.actions.idle = this.mixer.clipAction(idleClip);

    const buildStrideClip = (
      clipName: string,
      dur: number,
      legSwing: number,
      kneeBend: number,
      armSwing: number,
      spineLean: number
    ): THREE.AnimationClip => {
      const t = [0.0, dur * 0.25, dur * 0.5, dur * 0.75, dur];
      const trs: THREE.KeyframeTrack[] = [];

      addT(trs, composeTrack(this.spineBone, t, [
        [spineLean, -0.06, 0.02],
        [spineLean + 0.03, 0.0, 0.0],
        [spineLean, 0.06, -0.02],
        [spineLean + 0.03, 0.0, 0.0],
        [spineLean, -0.06, 0.02],
      ]));
      addT(trs, composeDirectEulerTrack(this.leftArmBone, t, [
        [1.15 - armSwing * 0.7, 0.05, -0.15],
        [1.15, 0.05, -0.15],
        [1.15 + armSwing * 0.7, 0.05, -0.15],
        [1.15, 0.05, -0.15],
        [1.15 - armSwing * 0.7, 0.05, -0.15],
      ]));
      addT(trs, composeDirectEulerTrack(this.rightArmBone, t, [
        [1.15 + armSwing * 0.7, -0.05, 0.15],
        [1.15, -0.05, 0.15],
        [1.15 - armSwing * 0.7, -0.05, 0.15],
        [1.15, -0.05, 0.15],
        [1.15 + armSwing * 0.7, -0.05, 0.15],
      ]));
      addT(trs, composeDirectEulerTrack(this.leftForeArmBone, t, [
        [0.20 + armSwing * 0.25, 0.0, 0.20],
        [0.20, 0.0, 0.20],
        [0.20 - armSwing * 0.15, 0.0, 0.20],
        [0.20, 0.0, 0.20],
        [0.20 + armSwing * 0.25, 0.0, 0.20],
      ]));
      addT(trs, composeDirectEulerTrack(this.rightForeArmBone, t, [
        [0.20 - armSwing * 0.25, 0.0, -0.20],
        [0.20, 0.0, -0.20],
        [0.20 + armSwing * 0.15, 0.0, -0.20],
        [0.20, 0.0, -0.20],
        [0.20 - armSwing * 0.25, 0.0, -0.20],
      ]));
      addT(trs, composeTrack(this.leftUpLegBone, t, [
        [legSwing, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [-legSwing * 0.85, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [legSwing, 0.0, 0.0],
      ]));
      addT(trs, composeTrack(this.rightUpLegBone, t, [
        [-legSwing * 0.85, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [legSwing, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [-legSwing * 0.85, 0.0, 0.0],
      ]));
      addT(trs, composeTrack(this.leftLegBone, t, [
        [-0.12, 0.0, 0.0],
        [-kneeBend * 0.5, 0.0, 0.0],
        [-0.18, 0.0, 0.0],
        [-kneeBend, 0.0, 0.0],
        [-0.12, 0.0, 0.0],
      ]));
      addT(trs, composeTrack(this.rightLegBone, t, [
        [-0.18, 0.0, 0.0],
        [-kneeBend, 0.0, 0.0],
        [-0.12, 0.0, 0.0],
        [-kneeBend * 0.5, 0.0, 0.0],
        [-0.18, 0.0, 0.0],
      ]));

      return new THREE.AnimationClip(clipName, dur, trs);
    };

    this.actions.walk = this.mixer.clipAction(buildStrideClip('walk', 1.1, 0.34, 0.52, 0.24, 0.08));
    this.actions.jog = this.mixer.clipAction(buildStrideClip('jog', 0.78, 0.52, 0.78, 0.38, 0.14));
    this.actions.sprint = this.mixer.clipAction(buildStrideClip('sprint', 0.56, 0.68, 0.95, 0.52, 0.22));
    this.actions.crouch = this.mixer.clipAction(buildStrideClip('crouch', 1.3, 0.28, 0.65, 0.16, 0.32));

    // Phase 2 Rock Climbing clip (reaching upward toward stone handholds on crag wall)
    const climbT = [0, 0.35, 0.7, 1.05, 1.4];
    const climbTracks: THREE.KeyframeTrack[] = [];
    addT(climbTracks, composeTrack(this.leftArmBone, climbT, [
      [1.15, 0.0, 1.85], [1.15, 0.0, 2.05], [1.15, 0.0, 1.85], [1.15, 0.0, 1.35], [1.15, 0.0, 1.85]
    ]));
    addT(climbTracks, composeTrack(this.rightArmBone, climbT, [
      [1.15, 0.0, -1.35], [1.15, 0.0, -1.85], [1.15, 0.0, -2.05], [1.15, 0.0, -1.85], [1.15, 0.0, -1.35]
    ]));
    addT(climbTracks, composeTrack(this.leftForeArmBone, climbT, [
      [0.15, 0.0, 0.75], [0.15, 0.0, 0.55], [0.15, 0.0, 0.75], [0.15, 0.0, 0.95], [0.15, 0.0, 0.75]
    ]));
    addT(climbTracks, composeTrack(this.rightForeArmBone, climbT, [
      [0.15, 0.0, -0.95], [0.15, 0.0, -0.75], [0.15, 0.0, -0.55], [0.15, 0.0, -0.75], [0.15, 0.0, -0.95]
    ]));
    addT(climbTracks, composeTrack(this.leftUpLegBone, climbT, [
      [0.65, 0.0, 0.08], [0.25, 0.0, 0.08], [0.65, 0.0, 0.08], [0.85, 0.0, 0.08], [0.65, 0.0, 0.08]
    ]));
    addT(climbTracks, composeTrack(this.rightUpLegBone, climbT, [
      [0.25, 0.0, -0.08], [0.65, 0.0, -0.08], [0.85, 0.0, -0.08], [0.25, 0.0, -0.08], [0.25, 0.0, -0.08]
    ]));
    addT(climbTracks, composeTrack(this.leftLegBone, climbT, [
      [-0.75, 0.0, 0.0], [-0.35, 0.0, 0.0], [-0.75, 0.0, 0.0], [-0.95, 0.0, 0.0], [-0.75, 0.0, 0.0]
    ]));
    addT(climbTracks, composeTrack(this.rightLegBone, climbT, [
      [-0.35, 0.0, 0.0], [-0.75, 0.0, 0.0], [-0.95, 0.0, 0.0], [-0.35, 0.0, 0.0], [-0.35, 0.0, 0.0]
    ]));
    this.actions.climb = this.mixer.clipAction(new THREE.AnimationClip('climb', 1.4, climbTracks));

    // Phase 2 Zipline clip (arms overhead gripping pulley, knees bent)
    const zipT = [0, 0.5, 1.0];
    const zipTracks: THREE.KeyframeTrack[] = [];
    addT(zipTracks, composeTrack(this.leftArmBone, zipT, [[0.35, 0.65, -1.05], [0.35, 0.65, -1.05], [0.35, 0.65, -1.05]]));
    addT(zipTracks, composeTrack(this.rightArmBone, zipT, [[0.35, -0.65, 1.05], [0.35, -0.65, 1.05], [0.35, -0.65, 1.05]]));
    addT(zipTracks, composeTrack(this.leftUpLegBone, zipT, [[0.55, 0, 0], [0.62, 0, 0], [0.55, 0, 0]]));
    addT(zipTracks, composeTrack(this.rightUpLegBone, zipT, [[0.48, 0, 0], [0.56, 0, 0], [0.48, 0, 0]]));
    addT(zipTracks, composeTrack(this.leftLegBone, zipT, [[-0.85, 0, 0], [-0.92, 0, 0], [-0.85, 0, 0]]));
    addT(zipTracks, composeTrack(this.rightLegBone, zipT, [[-0.78, 0, 0], [-0.85, 0, 0], [-0.78, 0, 0]]));
    this.actions.zipline = this.mixer.clipAction(new THREE.AnimationClip('zipline', 1.0, zipTracks));

    // Phase 3 Recurve Bow Aim clip (left arm extended forward holding bow, right hand drawn to cheek)
    const aimT = [0, 0.5, 1.0];
    const aimTracks: THREE.KeyframeTrack[] = [];
    addT(aimTracks, composeTrack(this.spine1Bone, aimT, [[0.06, -0.22, 0], [0.06, -0.22, 0], [0.06, -0.22, 0]]));
    addT(aimTracks, composeTrack(this.leftArmBone, aimT, [[1.18, 0.0, 1.38], [1.18, 0.0, 1.38], [1.18, 0.0, 1.38]]));
    addT(aimTracks, composeTrack(this.leftForeArmBone, aimT, [[0.08, 0.0, 0.18], [0.08, 0.0, 0.18], [0.08, 0.0, 0.18]]));
    addT(aimTracks, composeTrack(this.rightArmBone, aimT, [[1.18, 0.0, -0.95], [1.18, 0.0, -0.95], [1.18, 0.0, -0.95]]));
    addT(aimTracks, composeTrack(this.rightForeArmBone, aimT, [[0.25, 0.0, -1.65], [0.25, 0.0, -1.65], [0.25, 0.0, -1.65]]));
    addT(aimTracks, composeTrack(this.leftUpLegBone, aimT, [[0.22, 0, 0.08], [0.22, 0, 0.08], [0.22, 0, 0.08]]));
    addT(aimTracks, composeTrack(this.rightUpLegBone, aimT, [[-0.18, 0, -0.08], [-0.18, 0, -0.08], [-0.18, 0, -0.08]]));
    addT(aimTracks, composeTrack(this.leftLegBone, aimT, [[-0.28, 0, 0], [-0.28, 0, 0], [-0.28, 0, 0]]));
    addT(aimTracks, composeTrack(this.rightLegBone, aimT, [[-0.22, 0, 0], [-0.22, 0, 0], [-0.22, 0, 0]]));
    this.actions.aim = this.mixer.clipAction(new THREE.AnimationClip('aim', 1.0, aimTracks));
  }

  /**
   * Attaches Naira's §1.3 gear (satchel, quiver, recurve bow, woven Quechua belt,
   * sheathed knife, water skin, chakana pendant, and 5-link physics hair braid)
   * directly to her Mixamo skeleton bones (`cmScale = 100.0`).
   */
  private attachFieldKitAndBraid(pbr: PbrMaterialLibrary, cmScale: number): void {
    // 1. Physics Hair Braid attached to Head bone (§1.3 "single thick braid down her back")
    if (this.headBone) {
      const braidRoot = new THREE.Group();
      braidRoot.position.set(0, 0.05 * cmScale, -0.095 * cmScale);
      this.headBone.add(braidRoot);

      let parentNode: THREE.Object3D = braidRoot;
      const segCount = 5;
      for (let i = 0; i < segCount; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(0, i === 0 ? 0 : -0.088 * cmScale, 0);
        const radius = (0.025 - i * 0.003) * cmScale;
        const len = 0.095 * cmScale;
        const segGeo = new THREE.CylinderGeometry(radius * 0.85, radius, len, 7);
        segGeo.translate(0, -len * 0.5, 0);
        this.geometries.push(segGeo);
        const segMesh = new THREE.Mesh(segGeo, pbr.hair);
        segMesh.castShadow = true;
        pivot.add(segMesh);

        if (i === segCount - 1) {
          const tieGeo = new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, len * 0.25, 7);
          tieGeo.translate(0, -len * 0.2, 0);
          this.geometries.push(tieGeo);
          const tieMesh = new THREE.Mesh(tieGeo, pbr.clothQuechuaRed);
          pivot.add(tieMesh);
        }

        parentNode.add(pivot);
        this.braidNodes.push(pivot);
        parentNode = pivot;
      }
    }

    // 2. Spine gear: Quiver + Recurve Bow on back, Chakana Pendant at collar
    const chestBone = this.spine2Bone || this.spine1Bone || this.spineBone;
    if (chestBone) {
      const spineKit = new THREE.Group();
      spineKit.scale.setScalar(cmScale);

      // Quiver on back
      const quiverGeo = new THREE.CylinderGeometry(0.038, 0.032, 0.36, 8);
      this.geometries.push(quiverGeo);
      const quiverMesh = new THREE.Mesh(quiverGeo, pbr.leather);
      quiverMesh.position.set(0.045, 0.04, -0.11);
      quiverMesh.rotation.z = -0.28;
      quiverMesh.rotation.x = 0.06;
      quiverMesh.castShadow = true;
      spineKit.add(quiverMesh);

      // Recurve Bow slung across back (§1.3)
      const bowGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.62, 6);
      this.geometries.push(bowGeo);
      const bowMesh = new THREE.Mesh(bowGeo, pbr.woodAged);
      bowMesh.position.set(-0.02, 0.04, -0.12);
      bowMesh.rotation.z = 0.42;
      bowMesh.castShadow = true;
      spineKit.add(bowMesh);
      this.backBowMesh = bowMesh;

      // Simplified stone Chakana cross pendant at collar (§1.3)
      const pendantGeo = new THREE.BoxGeometry(0.026, 0.026, 0.008);
      this.geometries.push(pendantGeo);
      const pendantMesh = new THREE.Mesh(pendantGeo, pbr.andesiteCut);
      pendantMesh.position.set(0, 0.055, 0.088);
      pendantMesh.rotation.z = Math.PI * 0.25;
      spineKit.add(pendantMesh);

      chestBone.add(spineKit);
    }

    // 3. Hips gear: Woven Quechua Belt, Canvas Satchel Bag, Sheathed Belt Knife, Water Skin (§1.3)
    if (this.hipsBone) {
      const hipKit = new THREE.Group();
      hipKit.scale.setScalar(cmScale);

      // Mother's woven Quechua belt fitted to waist (radius 0.112..0.118, scaled elliptical in Z)
      const beltGeo = new THREE.CylinderGeometry(0.112, 0.118, 0.045, 14);
      beltGeo.scale(1.0, 1.0, 0.78);
      this.geometries.push(beltGeo);
      const beltMesh = new THREE.Mesh(beltGeo, pbr.clothQuechuaRed);
      beltMesh.position.set(0, 0.02, 0.0);
      hipKit.add(beltMesh);

      // Canvas Satchel resting snugly at left hip
      const satchelGeo = new THREE.BoxGeometry(0.055, 0.14, 0.16);
      this.geometries.push(satchelGeo);
      const satchelMesh = new THREE.Mesh(satchelGeo, pbr.clothTrousers);
      satchelMesh.position.set(0.125, -0.05, -0.01);
      satchelMesh.rotation.z = -0.06;
      satchelMesh.castShadow = true;
      hipKit.add(satchelMesh);

      // Sheathed belt knife at right hip + leather water skin
      const sheathGeo = new THREE.CylinderGeometry(0.012, 0.009, 0.14, 6);
      const flaskGeo = new THREE.SphereGeometry(0.045, 8, 6);
      flaskGeo.scale(0.65, 1.15, 0.85);
      this.geometries.push(sheathGeo, flaskGeo);

      const sheathMesh = new THREE.Mesh(sheathGeo, pbr.leather);
      sheathMesh.position.set(-0.12, -0.04, 0.03);
      sheathMesh.rotation.x = 0.25;
      hipKit.add(sheathMesh);

      const flaskMesh = new THREE.Mesh(flaskGeo, pbr.leather);
      flaskMesh.position.set(-0.1, -0.05, -0.08);
      hipKit.add(flaskMesh);

      this.hipsBone.add(hipKit);
    }
    // 4. Held Recurve Bow + Nocked Arrow on LeftForeArm for Combat Aiming (§3.2)
    if (this.leftForeArmBone) {
      const bowGrp = new THREE.Group();
      bowGrp.scale.setScalar(cmScale);
      const limbGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.68, 7);
      const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.66, 5);
      const arrowGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.58, 6);
      arrowGeo.rotateX(Math.PI / 2);
      this.geometries.push(limbGeo, stringGeo, arrowGeo);
      const limb = new THREE.Mesh(limbGeo, pbr.woodAged);
      limb.position.set(0.0, 0.22, 0.04);
      limb.rotation.z = Math.PI * 0.5;
      const str = new THREE.Mesh(stringGeo, pbr.leather);
      str.position.set(0.0, 0.22, -0.06);
      str.rotation.z = Math.PI * 0.5;
      const arr = new THREE.Mesh(arrowGeo, pbr.goldOrnamental);
      arr.position.set(0.0, 0.22, 0.12);
      bowGrp.add(limb, str, arr);
      bowGrp.visible = false;
      this.leftForeArmBone.add(bowGrp);
      this.heldBowGroup = bowGrp;
    }
  }

  public transitionToMode(nextMode: LocomotionMode, force: boolean = false): void {
    if (!force && this.mode === nextMode && this.activeAction === (this.actions[nextMode] || null)) return;
    this.mode = nextMode;
    const nextAction = this.actions[nextMode] || this.actions.idle || null;
    if (nextAction && (nextAction !== this.activeAction || force)) {
      nextAction.reset().fadeIn(0.2).play();
      if (this.activeAction && this.activeAction !== nextAction) {
        this.activeAction.fadeOut(0.2);
      }
      this.activeAction = nextAction;
    }
  }

  public update(
    dt: number,
    input: InputState,
    cameraYaw: number,
    terrain: TerrainSystem,
    audio: AudioManager,
    traversal?: TraversalSystem,
    onLandDamage?: (damage: number) => void
  ): void {
    this.elapsedSec += dt;

    // 1. Handle active zipline descent
    if (this.ziplineActive && this.ziplineSpan) {
      this.ziplineT += (8.0 / Math.max(1.0, this.ziplineSpan.length)) * dt;
      this.position.lerpVectors(this.ziplineSpan.start, this.ziplineSpan.end, Math.min(1.0, this.ziplineT));
      this.root.position.copy(this.position);
      const spanDx = this.ziplineSpan.end.x - this.ziplineSpan.start.x;
      const spanDz = this.ziplineSpan.end.z - this.ziplineSpan.start.z;
      this.yaw = Math.atan2(spanDx, spanDz);
      this.root.rotation.set(0, this.yaw, 0);
      if (this.contactShadowMesh) this.contactShadowMesh.visible = false;

      if (this.ziplineT >= 1.0) {
        this.ziplineActive = false;
        this.ziplineSpan = null;
        this.isGrounded = true;
        this.transitionToMode('idle', true);
        audio.playSfx('footstep', 0, 'dirt');
      }

      this.updateBraidPhysics(dt);
      if (this.mixer && this.activeAction) {
        this.mixer.update(dt);
      }
      return;
    }

    // 2. Check nearby zipline entry
    if (traversal && !this.ziplineActive) {
      const nearZip = traversal.findNearbyZipline(this.position, 2.2);
      if (nearZip && (input.interactPressed || input.jumpPressed)) {
        this.ziplineActive = true;
        this.ziplineSpan = nearZip;
        this.ziplineT = 0;
        this.transitionToMode('zipline', true);
        audio.playSfx('zipline_slide', 0);
        return;
      }
    }

    const inputMag = Math.hypot(input.moveX, input.moveZ);
    let targetSpeed = 0;
    let nextMode: LocomotionMode = 'idle';

    const nearbyCrag = traversal ? traversal.findNearbyCrag(this.position, 1.8) : null;
    const shouldClimb = (nearbyCrag && (input.climbHeld || (!this.isGrounded && input.moveZ < -0.1))) || input.climbHeld;

    if (shouldClimb) {
      nextMode = 'climb';
      targetSpeed = 0.8;
      if (nearbyCrag) {
        this.yaw = nearbyCrag.facingYaw;
        this.root.rotation.set(0, this.yaw, 0);
      }
    } else if (input.aimHeld) {
      nextMode = 'aim';
      targetSpeed = inputMag > 0.08 ? 1.0 : 0.0;
    } else if (inputMag > 0.08) {
      if (input.crouch) {
        nextMode = 'crouch';
        targetSpeed = 0.8;
      } else if (input.sprint && this.stamina > 5.0) {
        nextMode = 'sprint';
        targetSpeed = 5.5;
      } else if (input.walkToggle || inputMag < 0.55) {
        nextMode = 'walk';
        targetSpeed = 1.4;
      } else {
        nextMode = 'jog';
        targetSpeed = 3.0;
      }
    }

    this.transitionToMode(nextMode);
    if (this.heldBowGroup) this.heldBowGroup.visible = (nextMode === 'aim');
    if (this.backBowMesh) this.backBowMesh.visible = (nextMode !== 'aim');

    const accel = targetSpeed > this.speed ? 10.0 : 12.0;
    this.speed += (targetSpeed - this.speed) * Math.min(1.0, accel * dt);

    if (nextMode === 'sprint') {
      this.sprintDurationSec += dt;
      this.stamina = Math.max(0, this.stamina - dt * 14.0);
      if (this.sprintDurationSec > 10.0) {
        audio.playSfx('breath_exert', 0);
      }
    } else {
      this.sprintDurationSec = Math.max(0, this.sprintDurationSec - dt * 2.0);
      this.stamina = Math.min(100, this.stamina + dt * 18.0);
    }

    if (inputMag > 0.08 && this.speed > 0.05 && nextMode !== 'climb') {
      _forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      _right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

      _moveVec
        .set(0, 0, 0)
        .addScaledVector(_right, input.moveX)
        .addScaledVector(_forward, -input.moveZ)
        .normalize();

      const targetYaw = Math.atan2(_moveVec.x, _moveVec.z);
      _targetQuat.setFromAxisAngle(_upAxis, targetYaw);
      this.root.quaternion.slerp(_targetQuat, Math.min(1.0, dt * 10.5));
      this.yaw = targetYaw;

      this.position.x += _moveVec.x * this.speed * dt;
      this.position.z += _moveVec.z * this.speed * dt;

      this.position.x = Math.max(-28, Math.min(28, this.position.x));
      this.position.z = Math.max(-32, Math.min(24, this.position.z));

      const onBridge = Math.abs(this.position.x) <= 1.35 && Math.abs(this.position.z) <= 5.85;
      audio.playSfx('footstep', 0, onBridge ? 'wood' : 'dirt');
    }

    if (input.jumpPressed && this.isGrounded && nextMode !== 'climb') {
      this.verticalVelocity = 3.96;
      this.isGrounded = false;
      this.fallApexY = this.position.y;
    }

    const groundY = terrain.sampleGroundY(this.position.x, this.position.z, this.position.y);
    if (nextMode === 'climb') {
      if (Math.abs(input.moveZ) > 0.05) {
        this.position.y += -input.moveZ * 0.8 * dt;
      }
      if (traversal) {
        const crag = traversal.findNearbyCrag(this.position, 2.0);
        if (crag) {
          this.position.y = Math.max(crag.bottomY + 0.2, this.position.y);
          // Auto mantle onto platform ledge when reaching top
          if (this.position.y >= crag.topY - 0.22) {
            this.position.y = crag.topY;
            this.position.z = crag.centerZ - 0.95;
            this.position.x = crag.centerX;
            this.isGrounded = true;
            this.verticalVelocity = 0;
            input.climbHeld = false;
            this.transitionToMode('idle', true);
            audio.playSfx('footstep', 0, 'stone');
          }
        }
      }
      if (this.contactShadowMesh) this.contactShadowMesh.visible = false;
    } else if (!this.isGrounded) {
      if (this.contactShadowMesh) this.contactShadowMesh.visible = true;
      this.verticalVelocity -= 9.81 * dt;
      this.position.y += this.verticalVelocity * dt;
      this.fallApexY = Math.max(this.fallApexY, this.position.y);
      if (this.position.y <= groundY) {
        const fallDist = this.fallApexY - groundY;
        this.fallApexY = groundY;
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        if (traversal && onLandDamage && fallDist > 3.0) {
          const dmg = traversal.computeFallDamage(fallDist, groundY <= 0.6);
          if (dmg > 0) {
            onLandDamage(dmg);
            audio.playSfx('breath_exert', 0);
          }
        }
      }
    } else {
      this.fallApexY = groundY;
      if (this.contactShadowMesh) this.contactShadowMesh.visible = true;
      this.position.y = groundY;
    }

    this.root.position.copy(this.position);

    this.updateBraidPhysics(dt);
    if (this.mixer && this.activeAction) {
      this.mixer.update(dt);
    }
  }

  private updateBraidPhysics(dt: number): void {
    const clampedDt = Math.min(0.033, dt);
    const moveSwayX =
      0.14 +
      (this.speed / 5.5) * 0.26 +
      Math.sin(this.elapsedSec * 5.2) * 0.04 * (this.speed + 0.3);
    const moveSwayZ = Math.cos(this.elapsedSec * 3.6) * 0.05 * (this.speed + 0.25);

    for (let i = 0; i < this.braidNodes.length; i++) {
      const targetX = i === 0 ? moveSwayX : this.braidAnglesX[i - 1] * 0.88 + 0.04;
      const targetZ = i === 0 ? moveSwayZ : this.braidAnglesZ[i - 1] * 0.85;
      const stiffness = 42.0 - i * 4.5;
      const damping = 6.5;

      const accX = (targetX - this.braidAnglesX[i]) * stiffness - this.braidVelX[i] * damping;
      const accZ = (targetZ - this.braidAnglesZ[i]) * stiffness - this.braidVelZ[i] * damping;

      this.braidVelX[i] += accX * clampedDt;
      this.braidVelZ[i] += accZ * clampedDt;
      this.braidAnglesX[i] += this.braidVelX[i] * clampedDt;
      this.braidAnglesZ[i] += this.braidVelZ[i] * clampedDt;

      this.braidNodes[i].rotation.set(this.braidAnglesX[i], 0, this.braidAnglesZ[i]);
    }
  }

  private createContactShadowTexture(size: number): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const ny = (y / size) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        const a = Math.max(0, 1.0 - r2);
        const idx = (y * size + x) * 4;
        data[idx] = 6;
        data[idx + 1] = 10;
        data[idx + 2] = 8;
        data[idx + 3] = Math.round(a * a * 210);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    for (let i = 0; i < this.materials.length; i++) {
      this.materials[i].dispose();
    }
    for (let i = 0; i < this.textures.length; i++) {
      this.textures[i].dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.root.removeFromParent();
  }
}
