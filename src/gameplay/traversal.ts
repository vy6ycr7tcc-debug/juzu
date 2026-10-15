/**
 * Module: src/gameplay/traversal.ts
 * Responsibility: Full traversal suite per Bible §3.1:
 * - Walk (1.4 m/s), Jog (3.0 m/s), Sprint (5.5 m/s), Crouch (0.8 m/s), Dodge Roll (0.5s)
 * - Rock Climbing (0.8 m/s), Ledge Shimmy (0.5 m/s), Mantle (0.6s)
 * - Rope Zipline (8.0 m/s) with 3D braided cable & timber anchor posts
 * - Fall damage calculation (>3 m hurt, >8 m fatal, 0 into river/cenote water)
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts.
 * Exports: TraversalMoveSpec, ClimbableCrag, ZiplineSpan, TRAVERSAL_SPECS, TraversalSystem.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../world/materials';
import { TerrainSystem } from '../world/terrain';
import { IncaMasonrySystem } from '../world/masonry';

export interface TraversalMoveSpec {
  readonly speedMetersPerSec: number;
  readonly staminaDrainPerSec: number;
  readonly durationSec?: number;
}

export interface ClimbableCrag {
  id: string;
  centerX: number;
  centerZ: number;
  width: number;
  bottomY: number;
  topY: number;
  facingYaw: number;
}

export interface ZiplineSpan {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
}

export const TRAVERSAL_SPECS: Record<string, TraversalMoveSpec> = {
  walk: { speedMetersPerSec: 1.4, staminaDrainPerSec: 0 },
  jog: { speedMetersPerSec: 3.0, staminaDrainPerSec: 0 },
  sprint: { speedMetersPerSec: 5.5, staminaDrainPerSec: 14.0 },
  climb: { speedMetersPerSec: 0.8, staminaDrainPerSec: 10.0 },
  ledgeShimmy: { speedMetersPerSec: 0.5, staminaDrainPerSec: 6.0 },
  mantle: { speedMetersPerSec: 1.2, staminaDrainPerSec: 8.0, durationSec: 0.6 },
  zipline: { speedMetersPerSec: 8.0, staminaDrainPerSec: 0 },
  crouch: { speedMetersPerSec: 0.8, staminaDrainPerSec: 0 },
  dodgeRoll: { speedMetersPerSec: 4.2, staminaDrainPerSec: 15.0, durationSec: 0.5 },
  swim: { speedMetersPerSec: 1.8, staminaDrainPerSec: 4.0 },
};

export class TraversalSystem {
  public static readonly HURT_FALL_METERS = 3.0;
  public static readonly FATAL_FALL_METERS = 8.0;

  public readonly group: THREE.Group = new THREE.Group();
  public readonly crags: ClimbableCrag[] = [];
  public readonly ziplines: ZiplineSpan[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  public build(
    scene: THREE.Scene,
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    this.group.name = 'TraversalCourse';

    // 1. Climbable Crag Wall on the North Sanctuary Cliff Face (x = -4.2, z = -14.8)
    const cragX = -4.2;
    const cragZ = -14.8;
    const baseY = terrain.getTerrainHeightAt(cragX, cragZ);
    const topY = baseY + 4.4;

    this.crags.push({
      id: 'crag_north_sanctuary',
      centerX: cragX,
      centerZ: cragZ,
      width: 2.2,
      bottomY: baseY,
      topY,
      facingYaw: Math.PI, // Player faces North (-Z) into the crag wall
    });

    // Build monumental terraced Inca cliff bastion deeply embedded into the hillside
    const cliffGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.8, 4.8, 2.2, {
      courses: 6,
      stonesPerCourse: 4,
      pillowBulge: 0.052,
      jointDepth: 0.026,
      batter: 0.08,
    });
    // Flanking retaining wings locking the bastion into the rising slope
    const wingLGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.2, 4.2, 1.8, {
      courses: 5,
      stonesPerCourse: 3,
      pillowBulge: 0.048,
      batter: 0.08,
    });
    const wingRGeo = IncaMasonrySystem.createIncaPillowWallGeometry(2.8, 3.8, 1.8, {
      courses: 4,
      stonesPerCourse: 3,
      pillowBulge: 0.048,
      batter: 0.08,
    });
    const bermGeo = IncaMasonrySystem.createWallFootingBermGeometry(3.8, 0.35, 0.45);
    // Authentic rectangular stone lookout terrace platform embedded atop the bastion
    const ledgeGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.6, 0.36, 2.4, {
      courses: 1,
      stonesPerCourse: 3,
      pillowBulge: 0.02,
      jointDepth: 0.01,
    });
    this.geometries.push(cliffGeo, wingLGeo, wingRGeo, bermGeo, ledgeGeo);

    const cliffMesh = new THREE.Mesh(cliffGeo, materials.fieldstoneRough);
    cliffMesh.position.set(cragX, baseY + 2.3, cragZ - 0.95);
    cliffMesh.castShadow = true;
    cliffMesh.receiveShadow = true;
    this.group.add(cliffMesh);

    const wingL = new THREE.Mesh(wingLGeo, materials.andesiteCut);
    wingL.position.set(cragX - 2.8, baseY + 2.0, cragZ - 1.25);
    wingL.rotation.y = 0.32;
    wingL.castShadow = true;
    wingL.receiveShadow = true;
    this.group.add(wingL);

    const wingR = new THREE.Mesh(wingRGeo, materials.andesiteCut);
    wingR.position.set(cragX + 2.6, baseY + 1.8, cragZ - 1.15);
    wingR.rotation.y = -0.26;
    wingR.castShadow = true;
    wingR.receiveShadow = true;
    this.group.add(wingR);

    // Footing berm along the base
    const berm = new THREE.Mesh(bermGeo, materials.groundForestFloor);
    berm.position.set(cragX, baseY + 0.02, cragZ + 0.15);
    berm.receiveShadow = true;
    this.group.add(berm);

    // Weathered scree cobbles along base
    for (let c = 0; c < 5; c++) {
      const cobGeo = IncaMasonrySystem.createRiverCobbleGeometry(0.18 + (c % 3) * 0.05, c * 3.1);
      this.geometries.push(cobGeo);
      const cobMesh = new THREE.Mesh(cobGeo, c % 2 === 0 ? materials.andesiteCut : materials.fieldstoneRough);
      cobMesh.position.set(cragX - 1.5 + c * 0.75, baseY + 0.08, cragZ + 0.28 + Math.sin(c * 2.1) * 0.1);
      cobMesh.castShadow = true;
      cobMesh.receiveShadow = true;
      this.group.add(cobMesh);
    }

    // Authentic carved stone climbing bosses / corbels (ñaupa piedras)
    const holdGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.22, 10);
    holdGeo.rotateX(Math.PI * 0.5);
    this.geometries.push(holdGeo);
    for (let h = 0; h < 9; h++) {
      const hx = cragX + ((h % 2 === 0 ? -0.42 : 0.42) + Math.sin(h * 1.9) * 0.18);
      const hy = baseY + 0.55 + h * 0.44;
      const hold = new THREE.Mesh(holdGeo, materials.andesiteCut);
      hold.position.set(hx, hy, cragZ + 0.04);
      hold.rotation.z = Math.sin(h * 2.3) * 0.12;
      hold.castShadow = true;
      hold.receiveShadow = true;
      this.group.add(hold);
    }

    // Top stone lookout terrace platform embedded flush into the upper slope
    const ledgeMesh = new THREE.Mesh(ledgeGeo, materials.andesiteCut);
    ledgeMesh.position.set(cragX, topY - 0.18, cragZ - 1.45);
    ledgeMesh.castShadow = true;
    ledgeMesh.receiveShadow = true;
    this.group.add(ledgeMesh);
    terrain.registerWalkable(ledgeMesh);

    // 2. High-Tension Rope Zipline spanning along High Western Cliff Crags (x=-13.5, z=-19.5) to South Ridge (x=-13.0, z=10.5)
    const startY = terrain.getTerrainHeightAt(-13.5, -19.5) + 3.4;
    const endY = terrain.getTerrainHeightAt(-13.0, 10.5) + 2.8;
    const startVec = new THREE.Vector3(-13.5, startY, -19.5);
    const endVec = new THREE.Vector3(-13.0, endY, 10.5);
    const spanLen = Math.hypot(endVec.x - startVec.x, endVec.y - startVec.y, endVec.z - startVec.z);

    this.ziplines.push({
      id: 'zipline_gorge_express',
      start: startVec,
      end: endVec,
      length: spanLen,
    });

    // Timber zipline anchor posts + braided rope line
    const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 3.6, 8);
    this.geometries.push(postGeo);

    const northPost = new THREE.Mesh(postGeo, materials.woodAged);
    northPost.position.set(startVec.x, startVec.y - 1.5, startVec.z);
    northPost.castShadow = true;
    this.group.add(northPost);

    const southPost = new THREE.Mesh(postGeo, materials.woodAged);
    southPost.position.set(endVec.x, endVec.y - 0.8, endVec.z);
    southPost.castShadow = true;
    this.group.add(southPost);

    const ropeGeo = new THREE.CylinderGeometry(0.022, 0.022, spanLen, 6);
    ropeGeo.rotateX(Math.PI / 2);
    this.geometries.push(ropeGeo);

    const ropeMesh = new THREE.Mesh(ropeGeo, materials.ropeBraided);
    ropeMesh.position.lerpVectors(startVec, endVec, 0.5);
    ropeMesh.lookAt(endVec);
    ropeMesh.castShadow = true;
    this.group.add(ropeMesh);

    scene.add(this.group);
  }

  public findNearbyCrag(pos: THREE.Vector3, radius: number = 1.6): ClimbableCrag | null {
    for (let i = 0; i < this.crags.length; i++) {
      const c = this.crags[i];
      const dx = Math.abs(pos.x - c.centerX);
      const dz = Math.abs(pos.z - c.centerZ);
      if (dx <= c.width * 0.65 && dz <= radius && pos.y >= c.bottomY - 0.5 && pos.y <= c.topY + 0.5) {
        return c;
      }
    }
    return null;
  }

  public findNearbyZipline(pos: THREE.Vector3, radius: number = 2.6): ZiplineSpan | null {
    for (let i = 0; i < this.ziplines.length; i++) {
      const z = this.ziplines[i];
      const dx = pos.x - z.start.x;
      const dz = pos.z - z.start.z;
      if (dx * dx + dz * dz <= radius * radius) {
        return z;
      }
    }
    return null;
  }

  public computeFallDamage(fallMeters: number, intoWater: boolean): number {
    if (intoWater || fallMeters <= TraversalSystem.HURT_FALL_METERS) return 0;
    if (fallMeters >= TraversalSystem.FATAL_FALL_METERS) return 100;
    const t =
      (fallMeters - TraversalSystem.HURT_FALL_METERS) /
      (TraversalSystem.FATAL_FALL_METERS - TraversalSystem.HURT_FALL_METERS);
    return Math.round(t * 85);
  }

  public update(_dt: number): void {
    // Static course geometry; traversal state driven in NairaController
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    this.geometries.length = 0;
    this.crags.length = 0;
    this.ziplines.length = 0;
    this.group.removeFromParent();
  }
}
