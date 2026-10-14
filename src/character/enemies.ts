/**
 * Module: src/character/enemies.ts
 * Responsibility: Sol Negro field operative AI, rigged GLB mesh loading (`/juzu/models/soldier.glb`),
 * patrol routes, sight-cone detection, and 5-state awareness state machine
 * (`unaware → suspicious → alerted → searching → combat`) with 100 m distance gating
 * per Bible §1.4, §3.2, §3.3, and §5.2.
 * Depends on: three, three/addons/loaders/GLTFLoader.js, src/world/materials.ts, src/world/terrain.ts.
 * Exports: EnemyAwarenessState, SolNegroOperative, EnemyManager.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PbrMaterialLibrary } from '../world/materials';
import { TerrainSystem } from '../world/terrain';

export type EnemyAwarenessState =
  | 'unaware'
  | 'suspicious'
  | 'alerted'
  | 'searching'
  | 'combat';

export interface SolNegroOperative {
  id: string;
  name: string;
  position: THREE.Vector3;
  patrolStart: THREE.Vector3;
  patrolEnd: THREE.Vector3;
  patrolT: number;
  patrolDir: number;
  yaw: number;
  state: EnemyAwarenessState;
  awareness: number; // 0.0 to 1.0
  health: number;
  active: boolean;
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
}

const _toPlayer = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class EnemyManager {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly operatives: SolNegroOperative[] = [];

  public async build(
    scene: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): Promise<void> {
    this.group.name = 'SolNegroOperatives';
    scene.add(this.group);

    if (!materials || !terrain) return;

    const specs = [
      {
        id: 'operative_north_terrace',
        name: 'Sol Negro Recon Scout',
        x0: -3.2,
        z0: -21.0,
        x1: 3.2,
        z1: -21.0,
      },
      {
        id: 'operative_ridge_guard',
        name: 'Sol Negro Excavation Guard',
        x0: -2.5,
        z0: -28.5,
        x1: 2.8,
        z1: -27.0,
      },
    ];

    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const y0 = terrain.getTerrainHeightAt(s.x0, s.z0);
      const y1 = terrain.getTerrainHeightAt(s.x1, s.z1);
      const opRoot = new THREE.Group();
      opRoot.name = s.id;
      opRoot.position.set(s.x0, y0, s.z0);
      this.group.add(opRoot);

      const op: SolNegroOperative = {
        id: s.id,
        name: s.name,
        position: new THREE.Vector3(s.x0, y0, s.z0),
        patrolStart: new THREE.Vector3(s.x0, y0, s.z0),
        patrolEnd: new THREE.Vector3(s.x1, y1, s.z1),
        patrolT: i * 0.5,
        patrolDir: 1,
        yaw: 0,
        state: 'unaware',
        awareness: 0,
        health: 100,
        active: true,
        root: opRoot,
        mixer: null,
      };
      this.operatives.push(op);

      await this.populateOperativeMesh(op);
    }
  }

  private async populateOperativeMesh(op: SolNegroOperative): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null>(
      resolve => {
        loader.load(
          '/juzu/models/soldier.glb',
          loaded => resolve(loaded as { scene: THREE.Group; animations: THREE.AnimationClip[] }),
          undefined,
          () => resolve(null)
        );
      }
    );

    if (!gltf) return;

    const model = gltf.scene;
    let leftArm: THREE.Object3D | null = null;
    let rightArm: THREE.Object3D | null = null;
    let leftForeArm: THREE.Object3D | null = null;
    let rightForeArm: THREE.Object3D | null = null;

    model.traverse(child => {
      const n = child.name.replace(/^mixamorig:?/i, '');
      if (n === 'LeftArm') leftArm = child;
      else if (n === 'RightArm') rightArm = child;
      else if (n === 'LeftForeArm') leftForeArm = child;
      else if (n === 'RightForeArm') rightForeArm = child;

      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
        if (m.material) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.color) mat.color.setHex(0x4a5244);
          mat.roughness = 0.82;
          mat.metalness = 0.08;
        }
      }
    });
    op.root.add(model);

    op.mixer = new THREE.AnimationMixer(model);
    const tracks: THREE.KeyframeTrack[] = [];
    const setQ = (
      bone: THREE.Object3D | null,
      qx: number,
      qy: number,
      qz: number,
      qw: number
    ): void => {
      if (!bone) return;
      bone.quaternion.set(qx, qy, qz, qw);
      tracks.push(
        new THREE.KeyframeTrack(
          `${bone.name}.quaternion`,
          [0, 1],
          new Float32Array([qx, qy, qz, qw, qx, qy, qz, qw])
        )
      );
    };
    setQ(leftArm, -0.0475, -0.1166, 0.5226, 0.8432);
    setQ(rightArm, -0.1868, 0.097, 0.4908, 0.8455);
    setQ(leftForeArm, -0.405, 0.0579, -0.0125, 0.9124);
    setQ(rightForeArm, 0.3595, 0.0291, 0.0447, 0.9316);
    const clip = new THREE.AnimationClip('patrol', 1.0, tracks);
    const act = op.mixer.clipAction(clip);
    act.play();
    op.mixer.update(0.1);
  }

  public applyHitAt(
    hitPos: THREE.Vector3,
    damage: number,
    radius: number = 1.1
  ): SolNegroOperative | null {
    for (let i = 0; i < this.operatives.length; i++) {
      const op = this.operatives[i];
      if (!op.active) continue;
      const dx = hitPos.x - op.position.x;
      const dy = hitPos.y - (op.position.y + 1.0);
      const dz = hitPos.z - op.position.z;
      if (dx * dx + dy * dy + dz * dz <= radius * radius) {
        op.health = Math.max(0, op.health - damage);
        op.awareness = 1.0;
        op.state = 'combat';
        if (op.health <= 0) {
          op.active = false;
          op.root.visible = false;
        }
        return op;
      }
    }
    return null;
  }

  public update(
    dt: number,
    playerPosition: THREE.Vector3,
    playerCrouching: boolean,
    terrain?: TerrainSystem
  ): void {
    for (let i = 0; i < this.operatives.length; i++) {
      const op = this.operatives[i];
      if (!op.active) continue;

      _toPlayer.subVectors(playerPosition, op.position);
      const distSq = _toPlayer.lengthSq();
      if (distSq > 100 * 100) continue;

      if (op.state === 'unaware' || op.state === 'suspicious') {
        const patrolSpeed = op.state === 'unaware' ? 0.14 : 0.06;
        op.patrolT += dt * patrolSpeed * op.patrolDir;
        if (op.patrolT >= 1.0) {
          op.patrolT = 1.0;
          op.patrolDir = -1;
        } else if (op.patrolT <= 0.0) {
          op.patrolT = 0.0;
          op.patrolDir = 1;
        }
        op.position.lerpVectors(op.patrolStart, op.patrolEnd, op.patrolT);
        if (terrain) {
          op.position.y = terrain.sampleGroundY(op.position.x, op.position.z, op.position.y);
        }
        const dx = op.patrolEnd.x - op.patrolStart.x;
        const dz = op.patrolEnd.z - op.patrolStart.z;
        op.yaw = Math.atan2(dx * op.patrolDir, dz * op.patrolDir);
      } else {
        op.yaw = Math.atan2(_toPlayer.x, _toPlayer.z);
      }

      op.root.position.copy(op.position);
      op.root.rotation.set(0, op.yaw, 0);

      if (op.mixer) {
        op.mixer.update(dt);
      }

      const dist = Math.sqrt(distSq);
      _forward.set(Math.sin(op.yaw), 0, Math.cos(op.yaw));
      const dirDot = dist > 0.01 ? (_toPlayer.x * _forward.x + _toPlayer.z * _forward.z) / dist : 0;
      const inSightCone = dirDot > 0.35;
      const detectionRange = playerCrouching ? 9.5 : 20.0;

      if (dist < detectionRange && (inSightCone || dist < 4.5)) {
        op.awareness = Math.min(1.0, op.awareness + dt * (playerCrouching ? 0.22 : 0.48));
      } else {
        op.awareness = Math.max(0.0, op.awareness - dt * 0.18);
      }

      if (op.awareness > 0.85) op.state = 'combat';
      else if (op.awareness > 0.6) op.state = 'alerted';
      else if (op.awareness > 0.35) op.state = 'searching';
      else if (op.awareness > 0.15) op.state = 'suspicious';
      else op.state = 'unaware';
    }
  }

  public dispose(): void {
    this.operatives.length = 0;
    this.group.removeFromParent();
  }
}
