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

export type LocomotionMode =
  | 'idle'
  | 'walk'
  | 'jog'
  | 'sprint'
  | 'crouch'
  | 'jump'
  | 'dodge'
  | 'climb'
  | 'zipline'
  | 'aim'
  | 'vault'
  | 'mantle'
  | 'takedown';

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
  public isMantling: boolean = false;
  public isVaulting: boolean = false;
  public isDodging: boolean = false;

  private mantleTimer: number = 0;
  private readonly mantleDuration: number = 0.52;
  private readonly mantleStartPos: THREE.Vector3 = new THREE.Vector3();
  private readonly mantleTargetPos: THREE.Vector3 = new THREE.Vector3();

  private vaultTimer: number = 0;
  private readonly vaultDuration: number = 0.46;
  private readonly vaultStartPos: THREE.Vector3 = new THREE.Vector3();
  private readonly vaultTargetPos: THREE.Vector3 = new THREE.Vector3();
  private vaultApexY: number = 0;

  private dodgeTimer: number = 0;
  private readonly dodgeDuration: number = 0.44;
  private readonly dodgeDir: THREE.Vector3 = new THREE.Vector3(0, 0, -1);

  private readonly lastMoveDir: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private staminaExhausted: boolean = false;
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;

  private ziplineSpan: ZiplineSpan | null = null;
  private ziplineT: number = 0;
  private fallApexY: number = 0;
  public mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<LocomotionMode, THREE.AnimationAction>> = {};
  private activeAction: THREE.AnimationAction | null = null;
  private modelRoot: THREE.Object3D | null = null;
  private contactShadowMesh: THREE.Mesh | null = null;
  private contactShadowMat: THREE.MeshBasicMaterial | null = null;
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

  public verticalVelocity: number = 0;
  private sprintDurationSec: number = 0;
  private elapsedSec: number = 0;
  private isTakedownActive: boolean = false;
  private takedownTimer: number = 0;
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
      opacity: 0.75,
      depthWrite: false,
    });
    const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    shadowGeo.rotateX(-Math.PI / 2);
    this.geometries.push(shadowGeo);
    this.materials.push(shadowMat);
    this.contactShadowMat = shadowMat;
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
      if (child.name.includes(':')) {
        child.name = child.name.replace(/:/g, '_');
      }
      const n = child.name;
      if (n === 'mixamorigHips' || n === 'mixamorig_Hips') this.hipsBone = child;
      else if (n === 'mixamorigSpine' || n === 'mixamorig_Spine') this.spineBone = child;
      else if (n === 'mixamorigSpine1' || n === 'mixamorig_Spine1') this.spine1Bone = child;
      else if (n === 'mixamorigSpine2' || n === 'mixamorig_Spine2') this.spine2Bone = child;
      else if (n === 'mixamorigHead' || n === 'mixamorig_Head') this.headBone = child;
      else if (n === 'mixamorigLeftArm' || n === 'mixamorig_LeftArm') this.leftArmBone = child;
      else if (n === 'mixamorigRightArm' || n === 'mixamorig_RightArm') this.rightArmBone = child;
      else if (n === 'mixamorigLeftForeArm' || n === 'mixamorig_LeftForeArm') this.leftForeArmBone = child;
      else if (n === 'mixamorigRightForeArm' || n === 'mixamorig_RightForeArm') this.rightForeArmBone = child;
      else if (n === 'mixamorigLeftUpLeg' || n === 'mixamorig_LeftUpLeg') this.leftUpLegBone = child;
      else if (n === 'mixamorigRightUpLeg' || n === 'mixamorig_RightUpLeg') this.rightUpLegBone = child;
      else if (n === 'mixamorigLeftLeg' || n === 'mixamorig_LeftLeg') this.leftLegBone = child;
      else if (n === 'mixamorigRightLeg' || n === 'mixamorig_RightLeg') this.rightLegBone = child;

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
          normalScale: new THREE.Vector2(0.85, 0.85),
          roughness: 0.68,
          metalness: 0.04,
          envMapIntensity: 0.92,
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
      return new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values);
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
      return new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values);
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
      [1.12, 0.04, 0.28],
      [1.14, 0.04, 0.28],
      [1.12, 0.04, 0.28],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.rightArmBone, idleTimes, [
      [1.12, -0.04, -0.28],
      [1.14, -0.04, -0.28],
      [1.12, -0.04, -0.28],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.leftForeArmBone, idleTimes, [
      [0.22, 0.02, 0.06],
      [0.24, 0.02, 0.06],
      [0.22, 0.02, 0.06],
    ]));
    addT(idleTracks, composeDirectEulerTrack(this.rightForeArmBone, idleTimes, [
      [0.22, -0.02, -0.06],
      [0.24, -0.02, -0.06],
      [0.22, -0.02, -0.06],
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

      // Pelvis: weight shift and pelvic sway
      addT(trs, composeTrack(this.hipsBone, t, [
        [0.015, -spineLean * 0.35, 0.035],
        [-0.03, 0.0, 0.0],
        [0.015, spineLean * 0.35, -0.035],
        [-0.03, 0.0, 0.0],
        [0.015, -spineLean * 0.35, 0.035],
      ]));

      // Spine counter-rotation for athletic balance
      addT(trs, composeTrack(this.spineBone, t, [
        [spineLean, -0.08, 0.03],
        [spineLean + 0.03, 0.0, 0.0],
        [spineLean, 0.08, -0.03],
        [spineLean + 0.03, 0.0, 0.0],
        [spineLean, -0.08, 0.03],
      ]));
      addT(trs, composeTrack(this.spine2Bone, t, [
        [spineLean * 0.4, -0.09, -0.025],
        [spineLean * 0.4 + 0.02, 0.0, 0.0],
        [spineLean * 0.4, 0.09, 0.025],
        [spineLean * 0.4 + 0.02, 0.0, 0.0],
        [spineLean * 0.4, -0.09, -0.025],
      ]));
      addT(trs, composeTrack(this.headBone, t, [
        [-spineLean * 0.45, 0.04, 0.0],
        [-spineLean * 0.45 - 0.02, 0.0, 0.0],
        [-spineLean * 0.45, -0.04, 0.0],
        [-spineLean * 0.45 - 0.02, 0.0, 0.0],
        [-spineLean * 0.45, 0.04, 0.0],
      ]));

      // Direct Euler shoulder swing: Left arm swings backward at t=0 when Left leg is forward
      addT(trs, composeDirectEulerTrack(this.leftArmBone, t, [
        [1.01, -armSwing * 0.28, 0.16 - armSwing * 0.18], // t=0.0: back
        [1.16, 0.02, 0.18],                                // t=0.25: pass
        [1.02, armSwing * 0.28, 0.16 + armSwing * 0.18],  // t=0.50: forward
        [1.16, 0.02, 0.18],                                // t=0.75: pass
        [1.01, -armSwing * 0.28, 0.16 - armSwing * 0.18], // t=1.00: back
      ]));

      // Right arm swings forward at t=0 when Left leg is forward
      addT(trs, composeDirectEulerTrack(this.rightArmBone, t, [
        [1.02, -armSwing * 0.28, -(0.16 + armSwing * 0.18)], // t=0.0: forward
        [1.16, -0.02, -0.18],                                  // t=0.25: pass
        [1.01, armSwing * 0.28, -(0.16 - armSwing * 0.18)],   // t=0.50: back
        [1.16, -0.02, -0.18],                                  // t=0.75: pass
        [1.02, -armSwing * 0.28, -(0.16 + armSwing * 0.18)], // t=1.00: forward
      ]));

      // Forearm elbow flexion coordinated with arm drive
      addT(trs, composeDirectEulerTrack(this.leftForeArmBone, t, [
        [0.15, 0.0, 0.04],
        [0.18, 0.0, 0.06],
        [0.22, 0.0, 0.06 + armSwing * 0.32],
        [0.18, 0.0, 0.06],
        [0.15, 0.0, 0.04],
      ]));
      addT(trs, composeDirectEulerTrack(this.rightForeArmBone, t, [
        [0.22, 0.0, -(0.06 + armSwing * 0.32)],
        [0.18, 0.0, -0.06],
        [0.15, 0.0, -0.04],
        [0.18, 0.0, -0.06],
        [0.22, 0.0, -(0.06 + armSwing * 0.32)],
      ]));

      // Left Thigh: forward at t=0, back at t=0.5
      addT(trs, composeTrack(this.leftUpLegBone, t, [
        [legSwing, 0.0, -0.02],
        [0.06, 0.0, 0.0],
        [-legSwing * 0.72, 0.0, 0.02],
        [0.04, 0.0, 0.0],
        [legSwing, 0.0, -0.02],
      ]));

      // Right Thigh: back at t=0, forward at t=0.5
      addT(trs, composeTrack(this.rightUpLegBone, t, [
        [-legSwing * 0.72, 0.0, 0.02],
        [0.04, 0.0, 0.0],
        [legSwing, 0.0, -0.02],
        [0.06, 0.0, 0.0],
        [-legSwing * 0.72, 0.0, 0.02],
      ]));

      // Left Knee: bends when leg is behind and swinging through
      addT(trs, composeTrack(this.leftLegBone, t, [
        [-0.08, 0.0, 0.0],
        [-kneeBend * 0.35, 0.0, 0.0],
        [-kneeBend, 0.0, 0.0],
        [-kneeBend * 0.55, 0.0, 0.0],
        [-0.08, 0.0, 0.0],
      ]));

      // Right Knee: bends when leg is behind and swinging through
      addT(trs, composeTrack(this.rightLegBone, t, [
        [-kneeBend, 0.0, 0.0],
        [-kneeBend * 0.55, 0.0, 0.0],
        [-0.08, 0.0, 0.0],
        [-kneeBend * 0.35, 0.0, 0.0],
        [-kneeBend, 0.0, 0.0],
      ]));

      return new THREE.AnimationClip(clipName, dur, trs);
    };

    this.actions.walk = this.mixer.clipAction(buildStrideClip('walk', 0.96, 0.38, 0.56, 0.28, 0.07));
    this.actions.jog = this.mixer.clipAction(buildStrideClip('jog', 0.68, 0.56, 0.82, 0.42, 0.14));
    this.actions.sprint = this.mixer.clipAction(buildStrideClip('sprint', 0.50, 0.74, 1.02, 0.58, 0.22));
    this.actions.crouch = this.mixer.clipAction(buildStrideClip('crouch', 1.15, 0.32, 0.68, 0.18, 0.34));

    // Dedicated Athletic Jump Clip (push-off -> airborne dynamic knee tuck & forward reach -> landing)
    const jmpT = [0.0, 0.12, 0.68, 0.92];
    const jmpTracks: THREE.KeyframeTrack[] = [];
    addT(jmpTracks, composeTrack(this.spineBone, jmpT, [
      [0.18, -0.05, 0.0],
      [0.26, -0.08, 0.0],
      [0.22, -0.06, 0.0],
      [0.10, 0.0, 0.0],
    ]));
    addT(jmpTracks, composeTrack(this.spine2Bone, jmpT, [
      [0.08, -0.06, 0.0],
      [0.12, -0.10, 0.0],
      [0.10, -0.08, 0.0],
      [0.04, 0.0, 0.0],
    ]));
    addT(jmpTracks, composeTrack(this.headBone, jmpT, [
      [-0.12, 0.04, 0.0],
      [-0.18, 0.06, 0.0],
      [-0.14, 0.05, 0.0],
      [-0.06, 0.0, 0.0],
    ]));
    addT(jmpTracks, composeDirectEulerTrack(this.leftArmBone, jmpT, [
      [1.16, 0.02, 0.18],
      [1.02, 0.14, 0.38],
      [1.05, 0.10, 0.28],
      [1.16, 0.02, 0.18],
    ]));
    addT(jmpTracks, composeDirectEulerTrack(this.rightArmBone, jmpT, [
      [1.16, -0.02, -0.18],
      [1.02, -0.14, -0.38],
      [1.05, -0.10, -0.28],
      [1.16, -0.02, -0.18],
    ]));
    addT(jmpTracks, composeDirectEulerTrack(this.leftForeArmBone, jmpT, [
      [0.15, 0.0, 0.06],
      [0.26, 0.0, 0.45],
      [0.24, 0.0, 0.35],
      [0.15, 0.0, 0.06],
    ]));
    addT(jmpTracks, composeDirectEulerTrack(this.rightForeArmBone, jmpT, [
      [0.15, 0.0, -0.06],
      [0.26, 0.0, -0.45],
      [0.24, 0.0, -0.35],
      [0.15, 0.0, -0.06],
    ]));
    addT(jmpTracks, composeTrack(this.leftUpLegBone, jmpT, [
      [0.45, 0.04, 0.06],
      [0.92, 0.06, 0.10],
      [0.82, 0.05, 0.08],
      [0.25, 0.02, 0.04],
    ]));
    addT(jmpTracks, composeTrack(this.rightUpLegBone, jmpT, [
      [-0.20, -0.04, -0.05],
      [-0.38, -0.06, -0.07],
      [-0.28, -0.05, -0.05],
      [0.15, -0.02, -0.03],
    ]));
    addT(jmpTracks, composeTrack(this.leftLegBone, jmpT, [
      [-0.55, 0.0, 0.0],
      [-1.10, 0.0, 0.0],
      [-0.95, 0.0, 0.0],
      [-0.35, 0.0, 0.0],
    ]));
    addT(jmpTracks, composeTrack(this.rightLegBone, jmpT, [
      [-0.42, 0.0, 0.0],
      [-0.95, 0.0, 0.0],
      [-0.82, 0.0, 0.0],
      [-0.28, 0.0, 0.0],
    ]));
    this.actions.jump = this.mixer.clipAction(new THREE.AnimationClip('jump', 0.92, jmpTracks));

    // Dedicated Dodge Evasion Clip (low tactical tuck & dash)
    const ddgT = [0.0, 0.14, 0.30, 0.44];
    const ddgTracks: THREE.KeyframeTrack[] = [];
    addT(ddgTracks, composeTrack(this.spineBone, ddgT, [
      [0.28, 0.08, -0.06],
      [0.48, 0.12, -0.10],
      [0.32, -0.06, 0.05],
      [0.08, 0.0, 0.0],
    ]));
    addT(ddgTracks, composeTrack(this.leftArmBone, ddgT, [
      [1.08, 0.10, 0.48],
      [1.02, 0.14, 0.78],
      [1.10, 0.08, 0.25],
      [1.15, 0.05, -0.15],
    ]));
    addT(ddgTracks, composeTrack(this.rightArmBone, ddgT, [
      [1.08, -0.10, -0.48],
      [1.02, -0.14, -0.78],
      [1.10, -0.08, -0.25],
      [1.15, -0.05, 0.15],
    ]));
    addT(ddgTracks, composeTrack(this.leftUpLegBone, ddgT, [
      [0.52, 0.06, 0.08],
      [0.82, 0.08, 0.12],
      [0.42, 0.04, 0.06],
      [0.06, 0.0, -0.02],
    ]));
    addT(ddgTracks, composeTrack(this.rightUpLegBone, ddgT, [
      [-0.28, -0.06, -0.06],
      [0.58, -0.08, -0.10],
      [0.28, -0.04, -0.05],
      [-0.04, 0.0, 0.02],
    ]));
    addT(ddgTracks, composeTrack(this.leftLegBone, ddgT, [
      [-0.65, 0.0, 0.0],
      [-1.05, 0.0, 0.0],
      [-0.48, 0.0, 0.0],
      [-0.08, 0.0, 0.0],
    ]));
    addT(ddgTracks, composeTrack(this.rightLegBone, ddgT, [
      [-0.45, 0.0, 0.0],
      [-0.92, 0.0, 0.0],
      [-0.38, 0.0, 0.0],
      [-0.06, 0.0, 0.0],
    ]));
    this.actions.dodge = this.mixer.clipAction(new THREE.AnimationClip('dodge', 0.44, ddgTracks));

    // Phase 2 Rock Climbing clip (reaching upward toward stone handholds on crag wall)
    const climbT = [0, 0.35, 0.7, 1.05, 1.4];
    const climbTracks: THREE.KeyframeTrack[] = [];
    addT(climbTracks, composeTrack(this.spineBone, climbT, [
      [-0.08, 0.03, 0.0],
      [-0.12, -0.03, 0.0],
      [-0.08, 0.03, 0.0],
      [-0.05, 0.05, 0.0],
      [-0.08, 0.03, 0.0],
    ]));
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
    // Hip abduction and controlled pitch prevent thighs/knees from sinking inside stone geometry
    addT(climbTracks, composeTrack(this.leftUpLegBone, climbT, [
      [0.28, 0.10, 0.30], [0.18, 0.06, 0.24], [0.28, 0.10, 0.30], [0.38, 0.12, 0.34], [0.28, 0.10, 0.30]
    ]));
    addT(climbTracks, composeTrack(this.rightUpLegBone, climbT, [
      [0.18, -0.06, -0.24], [0.28, -0.10, -0.30], [0.38, -0.12, -0.34], [0.18, -0.06, -0.24], [0.18, -0.06, -0.24]
    ]));
    // Natural knee flex keeping feet planted on wall holds
    addT(climbTracks, composeTrack(this.leftLegBone, climbT, [
      [-0.42, 0.0, 0.0], [-0.22, 0.0, 0.0], [-0.42, 0.0, 0.0], [-0.58, 0.0, 0.0], [-0.42, 0.0, 0.0]
    ]));
    addT(climbTracks, composeTrack(this.rightLegBone, climbT, [
      [-0.22, 0.0, 0.0], [-0.42, 0.0, 0.0], [-0.58, 0.0, 0.0], [-0.22, 0.0, 0.0], [-0.22, 0.0, 0.0]
    ]));
    this.actions.climb = this.mixer.clipAction(new THREE.AnimationClip('climb', 1.4, climbTracks));

    // Phase 2 Zipline clip (arms overhead gripping pulley, knees bent and tucked)
    const zipT = [0, 0.5, 1.0];
    const zipTracks: THREE.KeyframeTrack[] = [];
    addT(zipTracks, composeTrack(this.spineBone, zipT, [[-0.08, 0, 0], [-0.08, 0, 0], [-0.08, 0, 0]]));
    addT(zipTracks, composeTrack(this.leftArmBone, zipT, [[1.15, 0.1, 1.95], [1.15, 0.1, 1.95], [1.15, 0.1, 1.95]]));
    addT(zipTracks, composeTrack(this.rightArmBone, zipT, [[1.15, -0.1, -1.95], [1.15, -0.1, -1.95], [1.15, -0.1, -1.95]]));
    addT(zipTracks, composeTrack(this.leftForeArmBone, zipT, [[0.35, 0.0, 0.65], [0.35, 0.0, 0.65], [0.35, 0.0, 0.65]]));
    addT(zipTracks, composeTrack(this.rightForeArmBone, zipT, [[0.35, 0.0, -0.65], [0.35, 0.0, -0.65], [0.35, 0.0, -0.65]]));
    addT(zipTracks, composeTrack(this.leftUpLegBone, zipT, [[0.65, 0.12, 0.22], [0.72, 0.12, 0.22], [0.65, 0.12, 0.22]]));
    addT(zipTracks, composeTrack(this.rightUpLegBone, zipT, [[0.55, -0.12, -0.22], [0.62, -0.12, -0.22], [0.55, -0.12, -0.22]]));
    addT(zipTracks, composeTrack(this.leftLegBone, zipT, [[-0.92, 0, 0], [-0.98, 0, 0], [-0.92, 0, 0]]));
    addT(zipTracks, composeTrack(this.rightLegBone, zipT, [[-0.82, 0, 0], [-0.88, 0, 0], [-0.82, 0, 0]]));
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

    // Milestone 3: Mantle clip (pulling up onto stone platform ledge)
    const manT = [0, 0.18, 0.36, 0.55];
    const manTracks: THREE.KeyframeTrack[] = [];
    addT(manTracks, composeTrack(this.spineBone, manT, [
      [-0.08, 0.0, 0.0],
      [0.24, 0.0, 0.0],
      [0.18, 0.0, 0.0],
      [0.02, 0.0, 0.0],
    ]));
    addT(manTracks, composeTrack(this.leftArmBone, manT, [
      [1.15, 0.0, 1.85],
      [0.45, 0.1, 0.35],
      [0.65, 0.08, 0.25],
      [1.15, 0.05, -0.15],
    ]));
    addT(manTracks, composeTrack(this.rightArmBone, manT, [
      [1.15, 0.0, -1.85],
      [0.45, -0.1, -0.35],
      [0.65, -0.08, -0.25],
      [1.15, -0.05, 0.15],
    ]));
    addT(manTracks, composeTrack(this.leftUpLegBone, manT, [
      [0.28, 0.10, 0.30],
      [0.68, 0.08, 0.14],
      [0.42, 0.04, 0.08],
      [0.02, 0.0, -0.02],
    ]));
    addT(manTracks, composeTrack(this.rightUpLegBone, manT, [
      [0.18, -0.06, -0.24],
      [0.32, -0.08, -0.12],
      [0.18, -0.04, -0.06],
      [-0.02, 0.0, 0.02],
    ]));
    addT(manTracks, composeTrack(this.leftLegBone, manT, [
      [-0.42, 0.0, 0.0],
      [-0.85, 0.0, 0.0],
      [-0.32, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]));
    addT(manTracks, composeTrack(this.rightLegBone, manT, [
      [-0.22, 0.0, 0.0],
      [-0.48, 0.0, 0.0],
      [-0.20, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]));
    this.actions.mantle = this.mixer.clipAction(new THREE.AnimationClip('mantle', 0.55, manTracks));

    // Milestone 3: Low-obstacle vault clip (one hand planted, hips tuck and legs clear stone wall)
    const vltT = [0, 0.16, 0.32, 0.48];
    const vltTracks: THREE.KeyframeTrack[] = [];
    addT(vltTracks, composeTrack(this.spineBone, vltT, [
      [0.12, 0.08, -0.16],
      [0.22, 0.12, -0.22],
      [0.14, 0.06, -0.08],
      [0.05, 0.0, 0.0],
    ]));
    addT(vltTracks, composeTrack(this.rightArmBone, vltT, [
      [0.65, -0.15, -0.35],
      [0.45, -0.25, -0.55],
      [0.85, -0.12, -0.15],
      [1.15, -0.05, 0.15],
    ]));
    addT(vltTracks, composeTrack(this.leftArmBone, vltT, [
      [1.25, 0.25, 0.45],
      [1.45, 0.35, 0.65],
      [1.20, 0.15, 0.15],
      [1.15, 0.05, -0.15],
    ]));
    addT(vltTracks, composeTrack(this.leftUpLegBone, vltT, [
      [0.72, 0.12, -0.24],
      [0.95, 0.18, -0.32],
      [0.45, 0.08, -0.10],
      [0.08, 0.0, -0.02],
    ]));
    addT(vltTracks, composeTrack(this.rightUpLegBone, vltT, [
      [0.55, -0.08, -0.18],
      [0.82, -0.12, -0.26],
      [0.38, -0.04, -0.08],
      [-0.04, 0.0, 0.02],
    ]));
    addT(vltTracks, composeTrack(this.leftLegBone, vltT, [
      [-0.82, 0.0, 0.0],
      [-1.05, 0.0, 0.0],
      [-0.38, 0.0, 0.0],
      [-0.08, 0.0, 0.0],
    ]));
    addT(vltTracks, composeTrack(this.rightLegBone, vltT, [
      [-0.72, 0.0, 0.0],
      [-0.92, 0.0, 0.0],
      [-0.28, 0.0, 0.0],
      [-0.06, 0.0, 0.0],
    ]));
    this.actions.vault = this.mixer.clipAction(new THREE.AnimationClip('vault', 0.48, vltTracks));

    // Sprint B: Close-quarters stealth takedown grapple clip (lunges, sweeping arm hook, takedown slam)
    const tkT = [0, 0.22, 0.52, 0.85];
    const tkTracks: THREE.KeyframeTrack[] = [];
    addT(tkTracks, composeTrack(this.spineBone, tkT, [
      [0.08, 0.0, 0.0],
      [0.32, 0.08, 0.05],
      [0.45, 0.04, -0.08],
      [0.05, 0.0, 0.0],
    ]));
    addT(tkTracks, composeTrack(this.rightArmBone, tkT, [
      [0.85, 0.15, -0.35],
      [0.45, 0.45, -0.85],
      [0.75, 0.25, -0.65],
      [1.15, -0.05, 0.15],
    ]));
    addT(tkTracks, composeTrack(this.leftArmBone, tkT, [
      [1.15, -0.15, 0.25],
      [0.65, -0.45, 0.65],
      [0.85, -0.25, 0.45],
      [1.15, 0.05, -0.15],
    ]));
    addT(tkTracks, composeTrack(this.leftUpLegBone, tkT, [
      [0.25, 0.08, 0.18],
      [0.65, 0.14, 0.22],
      [0.48, 0.08, 0.12],
      [0.02, 0.0, -0.02],
    ]));
    addT(tkTracks, composeTrack(this.rightUpLegBone, tkT, [
      [0.18, -0.06, -0.15],
      [0.42, -0.10, -0.18],
      [0.28, -0.06, -0.10],
      [-0.02, 0.0, 0.02],
    ]));
    addT(tkTracks, composeTrack(this.leftLegBone, tkT, [
      [-0.35, 0.0, 0.0],
      [-0.78, 0.0, 0.0],
      [-0.42, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]));
    addT(tkTracks, composeTrack(this.rightLegBone, tkT, [
      [-0.25, 0.0, 0.0],
      [-0.55, 0.0, 0.0],
      [-0.30, 0.0, 0.0],
      [-0.05, 0.0, 0.0],
    ]));
    this.actions.takedown = this.mixer.clipAction(new THREE.AnimationClip('takedown', 0.85, tkTracks));
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
      const beltGeo = new THREE.CylinderGeometry(0.112, 0.118, 0.048, 16);
      beltGeo.scale(1.0, 1.0, 0.78);
      const buckleGeo = new THREE.BoxGeometry(0.034, 0.028, 0.012);
      this.geometries.push(beltGeo, buckleGeo);

      let beltMat: THREE.Material = pbr.clothQuechuaRed;
      if (pbr.clothQuechuaRed.map) {
        const beltTex = pbr.clothQuechuaRed.map.clone();
        beltTex.repeat.set(10.0, 1.0);
        beltTex.wrapS = THREE.RepeatWrapping;
        beltTex.wrapT = THREE.ClampToEdgeWrapping;
        beltTex.needsUpdate = true;
        this.textures.push(beltTex);
        const wovenBeltMat = new THREE.MeshStandardMaterial({
          name: 'NairaWovenQuechuaBelt',
          map: beltTex,
          color: new THREE.Color(0x8a2016),
          roughness: 0.86,
          metalness: 0.0,
        });
        this.materials.push(wovenBeltMat);
        beltMat = wovenBeltMat;
      }

      const beltMesh = new THREE.Mesh(beltGeo, beltMat);
      beltMesh.position.set(0, 0.02, 0.0);
      hipKit.add(beltMesh);

      const buckleMesh = new THREE.Mesh(buckleGeo, pbr.metalBronze);
      buckleMesh.position.set(0, 0.02, 0.092);
      hipKit.add(buckleMesh);

      // Canvas Satchel resting snugly at left hip (tucked back to clear arm stride swing)
      const satchelGeo = new THREE.BoxGeometry(0.052, 0.13, 0.15);
      this.geometries.push(satchelGeo);
      const satchelMesh = new THREE.Mesh(satchelGeo, pbr.clothTrousers);
      satchelMesh.position.set(0.10, -0.06, -0.05);
      satchelMesh.rotation.set(0.08, -0.18, -0.08);
      satchelMesh.castShadow = true;
      hipKit.add(satchelMesh);

      // Sheathed belt knife at right hip + leather water skin (clearing arm swing)
      const sheathGeo = new THREE.CylinderGeometry(0.012, 0.009, 0.14, 6);
      const flaskGeo = new THREE.SphereGeometry(0.045, 8, 6);
      flaskGeo.scale(0.65, 1.15, 0.85);
      this.geometries.push(sheathGeo, flaskGeo);

      const sheathMesh = new THREE.Mesh(sheathGeo, pbr.leather);
      sheathMesh.position.set(-0.10, -0.05, -0.04);
      sheathMesh.rotation.set(0.20, 0.15, 0.05);
      hipKit.add(sheathMesh);

      const flaskMesh = new THREE.Mesh(flaskGeo, pbr.leather);
      flaskMesh.position.set(-0.08, -0.06, -0.09);
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

  public triggerTakedownGrapple(): void {
    this.isTakedownActive = true;
    this.takedownTimer = 0.85;
    this.speed = 0;
    this.transitionToMode('takedown', true);
  }

  public triggerDodge(cameraYaw: number, input: InputState, audio: AudioManager): void {
    if (this.isDodging || this.isMantling || this.isVaulting || this.ziplineActive || this.isTakedownActive) return;
    this.isDodging = true;
    this.dodgeTimer = this.dodgeDuration;

    const inputMag = Math.hypot(input.moveX, input.moveZ);
    if (inputMag > 0.08) {
      _forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      _right.set(-Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
      this.dodgeDir
        .set(0, 0, 0)
        .addScaledVector(_right, input.moveX)
        .addScaledVector(_forward, -input.moveZ)
        .normalize();
    } else {
      this.dodgeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    }

    this.lastMoveDir.copy(this.dodgeDir);
    this.yaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    _targetQuat.setFromAxisAngle(_upAxis, this.yaw);
    this.root.quaternion.copy(_targetQuat);
    this.speed = 5.8;
    this.transitionToMode('dodge', true);
    audio.playSfx('cloth_rustle', 0);
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

    // Handle active mantle progression (Milestone 3: Assassin's Creed parkour ledge pull-up)
    if (this.isMantling) {
      this.mantleTimer += dt;
      const t = Math.min(1.0, this.mantleTimer / this.mantleDuration);
      // Hermite curve: vertical rise first, then forward translation onto ledge
      const yProg = Math.sin(Math.min(1.0, t * 1.6) * Math.PI * 0.5);
      const xzProg = Math.max(0, (t - 0.22) / 0.78);
      const smoothXZ = xzProg * xzProg * (3 - 2 * xzProg);
      this.position.y = THREE.MathUtils.lerp(this.mantleStartPos.y, this.mantleTargetPos.y, yProg);
      this.position.x = THREE.MathUtils.lerp(this.mantleStartPos.x, this.mantleTargetPos.x, smoothXZ);
      this.position.z = THREE.MathUtils.lerp(this.mantleStartPos.z, this.mantleTargetPos.z, smoothXZ);
      this.root.position.copy(this.position);
      if (this.modelRoot) this.modelRoot.position.y = 0;

      if (this.contactShadowMesh) this.contactShadowMesh.visible = t > 0.6;

      if (t >= 1.0) {
        this.isMantling = false;
        this.isGrounded = true;
        this.verticalVelocity = 0;
        input.climbHeld = false;
        this.transitionToMode('idle', true);
        audio.playSfx('footstep', 0, 'stone');
      }

      this.updateBraidPhysics(dt);
      if (this.mixer && this.activeAction) {
        this.activeAction.timeScale = 1.0;
        this.mixer.update(dt);
      }
      return;
    }

    // Handle active low-obstacle vault progression (Milestone 3)
    if (this.isVaulting) {
      this.vaultTimer += dt;
      const t = Math.min(1.0, this.vaultTimer / this.vaultDuration);
      this.position.x = THREE.MathUtils.lerp(this.vaultStartPos.x, this.vaultTargetPos.x, t);
      this.position.z = THREE.MathUtils.lerp(this.vaultStartPos.z, this.vaultTargetPos.z, t);
      const baseHeight = THREE.MathUtils.lerp(this.vaultStartPos.y, this.vaultTargetPos.y, t);
      const arc = Math.sin(t * Math.PI) * 0.34;
      this.position.y = baseHeight + arc;
      this.root.position.copy(this.position);
      if (this.modelRoot) this.modelRoot.position.y = 0;

      if (t >= 1.0) {
        this.isVaulting = false;
        this.isGrounded = true;
        this.position.copy(this.vaultTargetPos);
        const exitMode = input.sprint && !this.staminaExhausted ? 'sprint' : 'jog';
        this.transitionToMode(exitMode, true);
        audio.playSfx('footstep', 0, 'stone');
      }

      this.updateBraidPhysics(dt);
      if (this.mixer && this.activeAction) {
        this.activeAction.timeScale = 1.0;
        this.mixer.update(dt);
      }
      return;
    }

    // Handle active evasive dodge dash
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      const progress = 1.0 - Math.max(0, this.dodgeTimer / this.dodgeDuration);
      const dashSpeed = 6.4 * (1.0 - progress * 0.45);
      this.position.x = Math.max(-28, Math.min(28, this.position.x + this.dodgeDir.x * dashSpeed * dt));
      this.position.z = Math.max(-32, Math.min(24, this.position.z + this.dodgeDir.z * dashSpeed * dt));
      const gY = terrain.sampleGroundY(this.position.x, this.position.z, this.position.y);
      if (this.isGrounded) {
        this.position.y = gY;
      }
      this.root.position.copy(this.position);
      if (this.modelRoot) this.modelRoot.position.y = 0;

      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.speed = 2.6;
        this.transitionToMode('jog', true);
        audio.playSfx('footstep', 0, 'dirt');
      }

      this.updateBraidPhysics(dt);
      if (this.mixer && this.activeAction) {
        this.activeAction.timeScale = 1.0;
        this.mixer.update(dt);
      }
      return;
    }

    // Handle active stealth takedown animation
    if (this.isTakedownActive) {
      this.takedownTimer -= dt;
      if (this.takedownTimer <= 0) {
        this.isTakedownActive = false;
        this.transitionToMode('crouch', true);
      }
      this.updateBraidPhysics(dt);
      if (this.mixer && this.activeAction) {
        this.activeAction.timeScale = 1.0;
        this.mixer.update(dt);
      }
      return;
    }

    // 1. Handle active zipline descent
    if (this.ziplineActive && this.ziplineSpan) {
      this.ziplineT += (8.0 / Math.max(1.0, this.ziplineSpan.length)) * dt;
      this.position.lerpVectors(this.ziplineSpan.start, this.ziplineSpan.end, Math.min(1.0, this.ziplineT));
      this.position.y -= 1.68;
      this.root.position.copy(this.position);
      if (this.modelRoot) this.modelRoot.position.y = 0;
      const spanDx = this.ziplineSpan.end.x - this.ziplineSpan.start.x;
      const spanDz = this.ziplineSpan.end.z - this.ziplineSpan.start.z;
      this.yaw = Math.atan2(spanDx, spanDz);
      this.root.rotation.set(0, this.yaw, 0);
      if (this.contactShadowMesh) this.contactShadowMesh.visible = false;

      // Deceleration flare near landing
      if (this.ziplineT > 0.82 && this.leftUpLegBone && this.rightUpLegBone) {
        this.leftUpLegBone.rotation.x = THREE.MathUtils.lerp(this.leftUpLegBone.rotation.x, 0.78, dt * 10.0);
        this.rightUpLegBone.rotation.x = THREE.MathUtils.lerp(this.rightUpLegBone.rotation.x, 0.78, dt * 10.0);
      }

      if (this.ziplineT >= 1.0) {
        this.ziplineActive = false;
        this.ziplineSpan = null;
        this.isGrounded = true;
        this.transitionToMode('idle', true);
        audio.playSfx('footstep', 0, 'dirt');
        audio.playSfx('breath_exert', 0);
      }

      this.updateBraidPhysics(dt);
      if (this.mixer && this.activeAction) {
        this.activeAction.timeScale = 1.0;
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

    // Update coyote time and jump buffer
    if (this.isGrounded) {
      this.coyoteTimer = 0.14;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (input.jumpPressed) {
      this.jumpBufferTimer = 0.16;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Stamina exhaustion hysteresis so sprint never oscillates at 60Hz when low on stamina
    if (this.stamina <= 2.0) {
      this.staminaExhausted = true;
    } else if (this.stamina >= 28.0 || !input.sprint) {
      this.staminaExhausted = false;
    }

    const inputMag = Math.hypot(input.moveX, input.moveZ);
    let targetSpeed = 0;
    let nextMode: LocomotionMode = 'idle';

    const nearbyCrag = traversal ? traversal.findNearbyCrag(this.position, 1.8) : null;
    const shouldClimb =
      nearbyCrag !== null && (input.climbHeld || (!this.isGrounded && input.moveZ < -0.1));

    if (shouldClimb && nearbyCrag) {
      nextMode = 'climb';
      targetSpeed = 0.85;
      this.yaw = nearbyCrag.facingYaw;
      this.root.rotation.set(0, this.yaw, 0);
      const targetZ = nearbyCrag.centerZ + 0.38;
      this.position.z = THREE.MathUtils.lerp(this.position.z, targetZ, 0.25);
    } else if (input.aimHeld) {
      nextMode = 'aim';
      targetSpeed = inputMag > 0.06 ? 1.35 : 0.0;
    } else if (inputMag > 0.06) {
      if (input.crouch) {
        nextMode = 'crouch';
        targetSpeed = 1.15;
      } else if (input.sprint && !this.staminaExhausted && this.stamina > 2.0) {
        nextMode = 'sprint';
        targetSpeed = 5.8;
      } else if (input.walkToggle || inputMag < 0.45) {
        nextMode = 'walk';
        targetSpeed = 1.65;
      } else {
        nextMode = 'jog';
        targetSpeed = 3.6;
      }
    }

    if (!this.isGrounded && nextMode !== 'climb' && nextMode !== 'aim') {
      nextMode = 'jump';
    }

    this.transitionToMode(nextMode);
    if (this.heldBowGroup) this.heldBowGroup.visible = nextMode === 'aim';
    if (this.backBowMesh) this.backBowMesh.visible = nextMode !== 'aim';

    const accel = targetSpeed > this.speed ? 11.5 : 13.5;
    this.speed += (targetSpeed - this.speed) * Math.min(1.0, accel * dt);
    if (targetSpeed === 0 && this.speed < 0.04) {
      this.speed = 0;
    }

    if (nextMode === 'sprint' || (!this.isGrounded && input.sprint && !this.staminaExhausted && inputMag > 0.2)) {
      this.sprintDurationSec += dt;
      this.stamina = Math.max(0, this.stamina - dt * 11.5);
      if (this.sprintDurationSec > 10.0) {
        audio.playSfx('breath_exert', 0);
      }
    } else {
      this.sprintDurationSec = Math.max(0, this.sprintDurationSec - dt * 2.5);
      this.stamina = Math.min(100, this.stamina + dt * 22.0);
    }

    // Camera-relative movement direction (camera looks along (+sin(yaw), 0, +cos(yaw)))
    if (nextMode !== 'climb') {
      if (inputMag > 0.06) {
        _forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
        _right.set(-Math.cos(cameraYaw), 0, Math.sin(cameraYaw));

        _moveVec
          .set(0, 0, 0)
          .addScaledVector(_right, input.moveX)
          .addScaledVector(_forward, -input.moveZ)
          .normalize();

        this.lastMoveDir.copy(_moveVec);

        const desiredYaw = nextMode === 'aim' ? cameraYaw : Math.atan2(_moveVec.x, _moveVec.z);
        let angleDiff = desiredYaw - this.yaw;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        const turnRate = this.isGrounded ? 12.0 : 6.0;
        this.yaw += angleDiff * Math.min(1.0, dt * turnRate);
        _targetQuat.setFromAxisAngle(_upAxis, this.yaw);
        this.root.quaternion.copy(_targetQuat);
      } else if (nextMode === 'aim') {
        let angleDiff = cameraYaw - this.yaw;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        this.yaw += angleDiff * Math.min(1.0, dt * 14.0);
        _targetQuat.setFromAxisAngle(_upAxis, this.yaw);
        this.root.quaternion.copy(_targetQuat);
      }

      if (this.speed > 0.04) {
        const inWater = this.position.y <= -2.1;
        const airControlMult = this.isGrounded ? 1.0 : 1.08;
        const speedMult = (inWater ? 0.72 : 1.0) * airControlMult;
        const nextX = Math.max(-28, Math.min(28, this.position.x + this.lastMoveDir.x * this.speed * speedMult * dt));
        const nextZ = Math.max(-32, Math.min(24, this.position.z + this.lastMoveDir.z * this.speed * speedMult * dt));
        this.position.x = nextX;
        this.position.z = nextZ;

        if (this.isGrounded && inputMag > 0.06) {
          const onBridge = Math.abs(this.position.x) <= 1.35 && Math.abs(this.position.z) <= 5.85;
          const onStone = this.position.z < -10.0 || (Math.abs(this.position.x) <= 3.5 && this.position.z > 6.0);
          const surface = inWater ? 'water' : onBridge ? 'wood' : onStone ? 'stone' : 'dirt';
          audio.playSfx('footstep', 0, surface);
          if (onBridge) {
            audio.playSfx('rope_creak', 0);
          }
          if (inWater) {
            audio.playSfx('water_stroke', 0);
          }
        }
      }
    }

    // Low-obstacle vault detection while moving at athletic speed (Milestone 3)
    if (this.isGrounded && this.speed > 2.0 && (inputMag > 0.2 || input.jumpPressed) && nextMode !== 'climb') {
      const probeDist = 0.95;
      const aheadX = this.position.x + Math.sin(this.yaw) * probeDist;
      const aheadZ = this.position.z + Math.cos(this.yaw) * probeDist;
      const ledgeY = terrain.sampleLedgeHeight(aheadX, aheadZ, this.position.y, 1.35);
      const aheadY = ledgeY !== null ? ledgeY : terrain.sampleGroundY(aheadX, aheadZ, this.position.y, 1.35);
      const heightDelta = aheadY - this.position.y;

      if (heightDelta >= 0.35 && heightDelta <= 1.15) {
        const landDist = 1.85;
        const landX = this.position.x + Math.sin(this.yaw) * landDist;
        const landZ = this.position.z + Math.cos(this.yaw) * landDist;
        const landY = terrain.sampleGroundY(landX, landZ, aheadY, 1.35);
        if (landY <= aheadY + 0.3) {
          this.startVault(landX, landY, landZ);
          audio.playSfx('cloth_rustle', 0);
          return;
        }
      }
    }

    // Athletic Jump + Ledge Mantle on Jump Press (with Coyote Time & Jump Buffering)
    if (this.jumpBufferTimer > 0 && (this.isGrounded || this.coyoteTimer > 0) && nextMode !== 'climb') {
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;

      // Check if jumping directly toward an elevated ledge / terrace wall (0.55m - 1.95m above feet)
      const sinYaw = Math.sin(this.yaw);
      const cosYaw = Math.cos(this.yaw);
      const probeNearX = this.position.x + sinYaw * 0.85;
      const probeNearZ = this.position.z + cosYaw * 0.85;
      const probeFarX = this.position.x + sinYaw * 1.35;
      const probeFarZ = this.position.z + cosYaw * 1.35;
      const nearLedgeY = terrain.sampleLedgeHeight(probeNearX, probeNearZ, this.position.y, 1.95);
      const farLedgeY = terrain.sampleLedgeHeight(probeFarX, probeFarZ, this.position.y, 1.95);
      const chosenLedgeY = nearLedgeY !== null ? nearLedgeY : farLedgeY;

      if (chosenLedgeY !== null && chosenLedgeY - this.position.y >= 0.55 && chosenLedgeY - this.position.y <= 1.95) {
        const targetX = nearLedgeY !== null ? probeNearX + sinYaw * 0.25 : probeFarX;
        const targetZ = nearLedgeY !== null ? probeNearZ + cosYaw * 0.25 : probeFarZ;
        this.startMantle(chosenLedgeY, targetZ, targetX);
        audio.playSfx('climb_grip', 0);
        return;
      }

      // Launch athletic leap with forward momentum boost
      this.verticalVelocity = 5.45;
      this.isGrounded = false;
      this.fallApexY = this.position.y;
      if (inputMag > 0.08) {
        this.speed = Math.max(this.speed * 1.14, input.sprint ? 6.1 : 4.2);
      }
      this.transitionToMode('jump', true);
      audio.playSfx('cloth_rustle', 0);
    }

    const groundY = terrain.sampleGroundY(this.position.x, this.position.z, this.position.y);
    if (nextMode === 'climb') {
      if (this.modelRoot) this.modelRoot.position.y = 0;
      if (Math.abs(input.moveZ) > 0.05) {
        this.position.y += -input.moveZ * 0.95 * dt;
        if (Math.sin(this.elapsedSec * 6.5) > 0.96) {
          audio.playSfx('climb_grip', 0);
        }
      }
      if (traversal) {
        const crag = traversal.findNearbyCrag(this.position, 2.0);
        if (crag) {
          // Lateral shimmy across crag wall (Milestone 3)
          if (Math.abs(input.moveX) > 0.05) {
            this.position.x += input.moveX * 0.85 * dt;
            const halfW = crag.width * 0.46;
            this.position.x = Math.max(crag.centerX - halfW, Math.min(crag.centerX + halfW, this.position.x));
            if (Math.sin(this.elapsedSec * 7.0) > 0.96) {
              audio.playSfx('climb_grip', 0);
            }
          }
          // Procedural lateral shimmy tilt on spine
          const shimmyTilt = -input.moveX * 0.16;
          if (this.spineBone) {
            this.spineBone.rotation.z = THREE.MathUtils.lerp(this.spineBone.rotation.z, shimmyTilt, dt * 8.0);
          }

          // Maintain physical standoff distance from crag wall so body and legs never sink
          const targetZ = crag.centerZ + 0.38;
          this.position.z = THREE.MathUtils.lerp(this.position.z, targetZ, dt * 10.0);
          this.position.y = Math.max(crag.bottomY + 0.2, this.position.y);

          // Initiate smooth parametric mantle onto platform ledge when reaching top (Milestone 3)
          if (this.position.y >= crag.topY - 0.32 && (-input.moveZ > 0.05 || this.position.y >= crag.topY - 0.08)) {
            this.startMantle(crag.topY, crag.centerZ - 0.95, this.position.x);
            audio.playSfx('climb_grip', 0);
            return;
          }
        }
      }
      if (this.contactShadowMesh) this.contactShadowMesh.visible = false;
    } else if (!this.isGrounded) {
      if (this.modelRoot) this.modelRoot.position.y = 0;
      if (this.contactShadowMesh) this.contactShadowMesh.visible = true;
      const gravity = this.verticalVelocity > 0 ? 11.2 : 13.8;
      this.verticalVelocity -= gravity * dt;
      this.position.y += this.verticalVelocity * dt;
      this.fallApexY = Math.max(this.fallApexY, this.position.y);

      // Automatic mid-air ledge grab / mantle when jumping toward an elevated platform
      if (this.verticalVelocity > -3.5 && (inputMag > 0.08 || input.jumpPressed || input.climbHeld)) {
        const sinYaw = Math.sin(this.yaw);
        const cosYaw = Math.cos(this.yaw);
        const ledgeX = this.position.x + sinYaw * 0.82;
        const ledgeZ = this.position.z + cosYaw * 0.82;
        const ledgeY = terrain.sampleLedgeHeight(ledgeX, ledgeZ, groundY, 2.2);
        if (
          ledgeY !== null &&
          ledgeY - groundY >= 0.5 &&
          this.position.y >= ledgeY - 0.85 &&
          this.position.y <= ledgeY + 0.35
        ) {
          this.startMantle(ledgeY, ledgeZ + cosYaw * 0.22, ledgeX + sinYaw * 0.22);
          audio.playSfx('climb_grip', 0);
          return;
        }
      }

      if (this.position.y <= groundY) {
        const fallDist = this.fallApexY - groundY;
        this.fallApexY = groundY;
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        audio.playSfx('footstep', 0, 'dirt');
        if (traversal && onLandDamage && fallDist > 3.5) {
          const dmg = traversal.computeFallDamage(fallDist, groundY <= 0.6);
          if (dmg > 0) {
            onLandDamage(dmg);
            audio.playSfx('breath_exert', 0);
          }
        }
      }
    } else {
      this.fallApexY = groundY;
      // Juzu smooth ground elevation tracking: never pop, follow gentle slopes and steps smoothly
      if (this.isGrounded && groundY > this.position.y - 0.75 && groundY < this.position.y + 0.85) {
        this.position.y += (groundY - this.position.y) * Math.min(1.0, dt * 14.0);
      } else {
        this.position.y = groundY;
      }
      if (groundY > this.position.y) {
        this.position.y = groundY; // Never sink into ground or rising terrain
      }

      // Subtle grounded stride vertical bounce on modelRoot so feet stay planted at root.y while hips bob naturally
      if (this.modelRoot) {
        if (this.speed > 0.25 && (nextMode === 'walk' || nextMode === 'jog' || nextMode === 'sprint')) {
          const freq = nextMode === 'sprint' ? 11.5 : nextMode === 'jog' ? 8.8 : 6.2;
          const amp = nextMode === 'sprint' ? 0.028 : nextMode === 'jog' ? 0.018 : 0.010;
          this.modelRoot.position.y = Math.abs(Math.sin(this.elapsedSec * freq)) * amp;
        } else {
          this.modelRoot.position.y = THREE.MathUtils.lerp(this.modelRoot.position.y, 0, Math.min(1.0, dt * 12.0));
        }
      }
    }

    this.root.position.copy(this.position);

    // Juzu soft contact shadow: stays pinned on the terrain/bridge surface under feet
    if (this.contactShadowMesh) {
      if (nextMode === 'climb' || this.ziplineActive) {
        this.contactShadowMesh.visible = false;
      } else {
        const heightAboveGround = Math.max(0, this.position.y - groundY);
        const shadowFade = Math.max(0, 1.0 - THREE.MathUtils.smoothstep(heightAboveGround, 0.1, 2.8));
        this.contactShadowMesh.position.y = (groundY - this.position.y) + 0.015;
        this.contactShadowMesh.scale.setScalar(1.0 + heightAboveGround * 0.42);
        if (this.contactShadowMat) {
          this.contactShadowMat.opacity = 0.75 * shadowFade;
        }
        this.contactShadowMesh.visible = shadowFade > 0.02;
      }
    }

    this.updateBraidPhysics(dt);
    if (this.mixer && this.activeAction) {
      if (nextMode === 'walk') {
        this.activeAction.timeScale = THREE.MathUtils.clamp(this.speed / 1.5, 0.65, 1.35);
      } else if (nextMode === 'jog') {
        this.activeAction.timeScale = THREE.MathUtils.clamp(this.speed / 3.4, 0.7, 1.35);
      } else if (nextMode === 'sprint') {
        this.activeAction.timeScale = THREE.MathUtils.clamp(this.speed / 5.4, 0.75, 1.35);
      } else {
        this.activeAction.timeScale = 1.0;
      }
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

  public startMantle(topY: number, targetZ: number, targetX: number = this.position.x): void {
    this.isMantling = true;
    this.mantleTimer = 0;
    this.mantleStartPos.copy(this.position);
    this.mantleTargetPos.set(targetX, topY, targetZ);
    this.transitionToMode('mantle', true);
  }

  public startVault(targetX: number, targetY: number, targetZ: number): void {
    this.isVaulting = true;
    this.vaultTimer = 0;
    this.vaultStartPos.copy(this.position);
    this.vaultTargetPos.set(targetX, targetY, targetZ);
    this.vaultApexY = Math.max(this.position.y, targetY) + 0.28;
    this.transitionToMode('vault', true);
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
