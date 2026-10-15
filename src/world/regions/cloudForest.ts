/**
 * Module: src/world/regions/cloudForest.ts
 * Responsibility: Region 1 — Cloud Forest Valleys vertical slice architecture
 * and setpieces per Bible §1.7:
 * - Hanging rope-and-plank bridge spanning the ravine with Inca stone anchor towers
 * - Battered Inca polygonal andesite retaining walls and stone steps cut into slopes
 * - Trail shelter with weathered timber rafters and woven Quechua cloth banner
 * - Carved Inca Stele & flowing stone water channel
 * - Sanctuary Checkpoint circle and Condor Viewpoint ridge marker
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts.
 * Exports: InteractableTarget, CloudForestRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';
import { IncaMasonrySystem } from '../masonry';

export interface InteractableTarget {
  id: string;
  label: string;
  promptText: string;
  position: THREE.Vector3;
  radius: number;
}

export class CloudForestRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  private bridgeGroup: THREE.Group = new THREE.Group();
  private condorMesh: THREE.Group = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private materialsList: THREE.Material[] = [];
  private elapsedSec: number = 0;

  public build(
    scene: THREE.Scene,
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    this.group.name = 'Region1_CloudForestValleys';

    // 1. Hanging Rope-and-Plank Bridge across the central ravine (z = -5.85 to +5.85)
    this.buildHangingBridge(materials, terrain);

    // 2. Battered Inca Retaining Walls & Cut Stone Steps on South and North approaches
    this.buildStoneTerracesAndSteps(materials, terrain);

    // 3. Trail Shelter & Carved Inca Stele + Water Channel on the North Sanctuary Terrace
    this.buildTrailShelterAndStele(materials, terrain);

    // 4. Sanctuary Checkpoint Circle (south of bridge) & Condor Viewpoint (north ridge)
    this.buildCheckpointAndViewpoint(materials, terrain);

    scene.add(this.group);
  }

  private buildHangingBridge(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    this.bridgeGroup.name = 'RavineHangingBridge';

    // Authentic low battered Inca stone anchor bollards & foundation abutments on South (z = +6.0) and North (z = -6.0) rims
    const abutmentGeo = IncaMasonrySystem.createIncaPillowWallGeometry(4.2, 3.4, 2.6, {
      courses: 5,
      stonesPerCourse: 5,
      pillowBulge: 0.052,
      jointDepth: 0.026,
      batter: 0.08,
    });
    // Low, rounded battered stone anchor bollards (Clavijas de piedra) - waist-height, open vista
    const bollardGeo = IncaMasonrySystem.createIncaPillarGeometry(0.72, 1.18, 0.72, {
      courses: 3,
      pillowBulge: 0.045,
      jointDepth: 0.022,
      batter: 0.06,
    });
    const capGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(0.48, 0.16, 16);
    // Ground-level timber bolster sill embedded flush across the stone ramp floor
    const groundSillGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 12);
    groundSillGeo.rotateZ(Math.PI * 0.5);
    const ropeWrapGeo = new THREE.TorusGeometry(0.16, 0.045, 8, 16);
    this.geometries.push(abutmentGeo, bollardGeo, capGeo, groundSillGeo, ropeWrapGeo);

    const ends = [6.0, -6.0];
    for (let e = 0; e < ends.length; e++) {
      const ez = ends[e];
      const baseY = terrain.getTerrainHeightAt(0, ez);

      // Massive stepped andesite abutment foundation with coursed pillow masonry
      const abutment = new THREE.Mesh(abutmentGeo, materials.andesiteCut);
      abutment.position.set(0, baseY - 1.15, ez);
      if (e === 1) abutment.rotation.y = Math.PI;
      abutment.castShadow = true;
      abutment.receiveShadow = true;
      this.group.add(abutment);
      terrain.registerWalkable(abutment);

      // Natural earth/moss footing berm along the base of the abutment
      const abutmentBermGeo = IncaMasonrySystem.createWallFootingBermGeometry(4.4, 0.35, 0.45);
      this.geometries.push(abutmentBermGeo);
      const abutmentBerm = new THREE.Mesh(abutmentBermGeo, materials.groundForestFloor);
      abutmentBerm.position.set(0, baseY - 0.25, ez + (e === 0 ? 1.3 : -1.3));
      if (e === 1) abutmentBerm.rotation.y = Math.PI;
      abutmentBerm.receiveShadow = true;
      this.group.add(abutmentBerm);

      // Left & Right low battered coursed stone anchor bollards (waist-height, leaving sky and gorge open)
      const sides = [-1.45, 1.45];
      for (let s = 0; s < sides.length; s++) {
        const sx = sides[s];
        const bollard = new THREE.Mesh(bollardGeo, materials.andesiteCut);
        bollard.position.set(sx, baseY + 0.52, ez);
        bollard.castShadow = true;
        bollard.receiveShadow = true;
        this.group.add(bollard);

        const cap = new THREE.Mesh(capGeo, materials.andesiteCut);
        cap.position.set(sx, baseY + 1.15, ez);
        cap.castShadow = true;
        cap.receiveShadow = true;
        this.group.add(cap);
      }

      // Ground-level timber bolster sill embedded flush across the stone ramp floor (Tirante de suelo)
      const sill = new THREE.Mesh(groundSillGeo, materials.woodAged);
      sill.position.set(0, baseY + 0.14, ez + (e === 0 ? 0.35 : -0.35));
      sill.castShadow = true;
      sill.receiveShadow = true;
      this.group.add(sill);

      // Heavy braided rope tensioning coils securing the cables into subterranean anchor pits
      const wrapXs = [-1.22, -0.78, 0.78, 1.22];
      for (let w = 0; w < wrapXs.length; w++) {
        const wrap = new THREE.Mesh(ropeWrapGeo, materials.ropeBraided);
        wrap.position.set(wrapXs[w], baseY + 0.16, ez + (e === 0 ? 0.35 : -0.35));
        wrap.rotation.y = Math.PI * 0.5;
        wrap.castShadow = true;
        this.group.add(wrap);
      }
    }

    // 28 Weathered Wooden Planks with catenary sag & organic tilt
    const plankCount = 28;
    const plankGeo = this.createChippedBlockGeometry(2.55, 0.11, 0.38);
    this.geometries.push(plankGeo);
    const plankInstanced = new THREE.InstancedMesh(plankGeo, materials.woodAged, plankCount);
    plankInstanced.castShadow = true;
    plankInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < plankCount; i++) {
      const t = i / (plankCount - 1);
      const z = 5.6 - t * 11.2;
      const normZ = z / 5.85;
      const sag = (1.0 - normZ * normZ) * 0.32;
      const y = 1.66 - sag;
      const jitterYaw = Math.sin(i * 2.7) * 0.022;
      const jitterRoll = Math.cos(i * 3.1) * 0.018;

      dummy.position.set(0, y, z);
      dummy.rotation.set(0, jitterYaw, jitterRoll);
      dummy.scale.set(1.0 + Math.sin(i * 1.9) * 0.03, 1.0, 1.0);
      dummy.updateMatrix();
      plankInstanced.setMatrixAt(i, dummy.matrix);

      color.setHSL(0.08, 0.25, 0.42 + Math.sin(i * 4.3) * 0.08);
      plankInstanced.setColorAt(i, color);
    }
    plankInstanced.instanceMatrix.needsUpdate = true;
    if (plankInstanced.instanceColor) plankInstanced.instanceColor.needsUpdate = true;
    this.bridgeGroup.add(plankInstanced);

    // Transverse timber binding cleats lashed across the deck every 5 planks
    const cleatGeo = this.createChippedBlockGeometry(2.65, 0.08, 0.16);
    this.geometries.push(cleatGeo);
    for (let c = 2; c < plankCount; c += 5) {
      const t = c / (plankCount - 1);
      const z = 5.6 - t * 11.2;
      const normZ = z / 5.85;
      const sag = (1.0 - normZ * normZ) * 0.32;
      const y = 1.66 - sag + 0.08;
      const cleat = new THREE.Mesh(cleatGeo, materials.woodAged);
      cleat.position.set(0, y, z);
      cleat.castShadow = true;
      this.bridgeGroup.add(cleat);
    }

    // Walkable bridge collision strip for downward grounding raycast
    const bridgeDeckColliderGeo = new THREE.BoxGeometry(2.6, 0.14, 11.6);
    this.geometries.push(bridgeDeckColliderGeo);
    const bridgeColliderMesh = new THREE.Mesh(bridgeDeckColliderGeo, materials.woodAged);
    bridgeColliderMesh.position.set(0, 1.48, 0);
    bridgeColliderMesh.visible = false;
    this.bridgeGroup.add(bridgeColliderMesh);
    terrain.registerWalkable(bridgeColliderMesh);

    // Braided suspension cable networks (authentic Q'eswachaka style)
    const cableSegs = 24;
    const handCableGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.0, 7);
    handCableGeo.rotateX(Math.PI * 0.5);
    const mainCableGeo = new THREE.CylinderGeometry(0.048, 0.048, 1.0, 7);
    mainCableGeo.rotateX(Math.PI * 0.5);
    const midCableGeo = new THREE.CylinderGeometry(0.020, 0.020, 1.0, 6);
    midCableGeo.rotateX(Math.PI * 0.5);
    const latticeGeo = new THREE.CylinderGeometry(0.010, 0.010, 1.0, 5);
    latticeGeo.rotateX(Math.PI * 0.5);
    this.geometries.push(handCableGeo, mainCableGeo, midCableGeo, latticeGeo);

    // Under-deck main load cables (Duros) supporting the planks
    const underDeckSides = [-0.88, 0.88];
    for (let u = 0; u < underDeckSides.length; u++) {
      const ux = underDeckSides[u];
      for (let i = 0; i < cableSegs; i++) {
        const t0 = i / cableSegs;
        const t1 = (i + 1) / cableSegs;
        const z0 = 6.0 - t0 * 12.0;
        const z1 = 6.0 - t1 * 12.0;
        const n0 = z0 / 6.0;
        const n1 = z1 / 6.0;
        const y0 = 1.58 - (1.0 - n0 * n0) * 0.32;
        const y1 = 1.58 - (1.0 - n1 * n1) * 0.32;

        const mainSeg = new THREE.Mesh(mainCableGeo, materials.ropeBraided);
        mainSeg.position.set(ux, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
        const dz = z1 - z0;
        const dy = y1 - y0;
        mainSeg.scale.set(1, 1, Math.hypot(dy, dz));
        mainSeg.rotation.x = Math.atan2(dy, -dz);
        mainSeg.castShadow = true;
        this.bridgeGroup.add(mainSeg);
      }
    }

    // Handrail cables, mid stabilizer cables, and woven diagonal rope lattice (Redes de Baranda)
    const ropeSides = [-1.28, 1.28];
    for (let s = 0; s < ropeSides.length; s++) {
      const rx = ropeSides[s];
      for (let i = 0; i < cableSegs; i++) {
        const t0 = i / cableSegs;
        const t1 = (i + 1) / cableSegs;
        const z0 = 6.0 - t0 * 12.0;
        const z1 = 6.0 - t1 * 12.0;
        const n0 = z0 / 6.0;
        const n1 = z1 / 6.0;
        const handY0 = 2.85 - (1.0 - n0 * n0) * 0.55;
        const handY1 = 2.85 - (1.0 - n1 * n1) * 0.55;
        const midY0 = 2.15 - (1.0 - n0 * n0) * 0.42;
        const midY1 = 2.15 - (1.0 - n1 * n1) * 0.42;
        const deckY0 = 1.62 - (1.0 - n0 * n0) * 0.32;
        const deckY1 = 1.62 - (1.0 - n1 * n1) * 0.32;

        // Top handrail cable
        const handCable = new THREE.Mesh(handCableGeo, materials.ropeBraided);
        handCable.position.set(rx, (handY0 + handY1) * 0.5, (z0 + z1) * 0.5);
        const dz = z1 - z0;
        const handDy = handY1 - handY0;
        handCable.scale.set(1, 1, Math.hypot(handDy, dz));
        handCable.rotation.x = Math.atan2(handDy, -dz);
        handCable.castShadow = true;
        this.bridgeGroup.add(handCable);

        // Mid-height stabilizer cable
        const midCable = new THREE.Mesh(midCableGeo, materials.ropeBraided);
        midCable.position.set(rx * 0.95, (midY0 + midY1) * 0.5, (z0 + z1) * 0.5);
        const midDy = midY1 - midY0;
        midCable.scale.set(1, 1, Math.hypot(midDy, dz));
        midCable.rotation.x = Math.atan2(midDy, -dz);
        midCable.castShadow = true;
        this.bridgeGroup.add(midCable);

        // Diagonal woven rope lattice (Redes de Baranda)
        const lat1 = new THREE.Mesh(latticeGeo, materials.ropeBraided);
        const p1x = rx;
        const p1y = handY0;
        const p1z = z0;
        const p2x = rx * 0.88;
        const p2y = deckY1;
        const p2z = z1;
        lat1.position.set((p1x + p2x) * 0.5, (p1y + p2y) * 0.5, (p1z + p2z) * 0.5);
        const l1dx = p2x - p1x;
        const l1dy = p2y - p1y;
        const l1dz = p2z - p1z;
        lat1.scale.set(1, 1, Math.hypot(l1dx, l1dy, l1dz));
        lat1.rotation.x = Math.atan2(l1dy, -l1dz);
        lat1.rotation.y = Math.atan2(l1dx, Math.hypot(l1dy, l1dz));
        lat1.castShadow = true;
        this.bridgeGroup.add(lat1);

        const lat2 = new THREE.Mesh(latticeGeo, materials.ropeBraided);
        const p3x = rx * 0.88;
        const p3y = deckY0;
        const p3z = z0;
        const p4x = rx;
        const p4y = handY1;
        const p4z = z1;
        lat2.position.set((p3x + p4x) * 0.5, (p3y + p4y) * 0.5, (p3z + p4z) * 0.5);
        const l2dx = p4x - p3x;
        const l2dy = p4y - p3y;
        const l2dz = p4z - p3z;
        lat2.scale.set(1, 1, Math.hypot(l2dx, l2dy, l2dz));
        lat2.rotation.x = Math.atan2(l2dy, -l2dz);
        lat2.rotation.y = Math.atan2(l2dx, Math.hypot(l2dy, l2dz));
        lat2.castShadow = true;
        this.bridgeGroup.add(lat2);
      }
    }

    this.group.add(this.bridgeGroup);
  }

  private buildStoneTerracesAndSteps(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    // Cut stone steps leading up from the north side of the bridge (z = -6.8 to -15.5)
    const stepCount = 12;
    const stepGeo = this.createChippedBlockGeometry(2.8, 0.34, 0.72);
    this.geometries.push(stepGeo);

    for (let i = 0; i < stepCount; i++) {
      const sz = -6.8 - i * 0.72;
      const sy = terrain.getTerrainHeightAt(0, sz);
      const step = new THREE.Mesh(stepGeo, materials.andesiteCut);
      step.position.set(Math.sin(i * 0.6) * 0.08, sy - 0.06, sz);
      step.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.015;
      step.castShadow = true;
      step.receiveShadow = true;
      this.group.add(step);
      terrain.registerWalkable(step);
    }

    // Battered Inca polygonal retaining walls flanking the valley path & ravine rim
    const wallSpecs = [
      { x: -6.4, z: 9.8, w: 4.8, h: 2.0, d: 1.1, rotY: 0.38 },
      { x: 7.2, z: 10.5, w: 4.4, h: 1.85, d: 1.1, rotY: -0.42 },
      { x: -6.5, z: -11.5, w: 5.2, h: 2.4, d: 1.2, rotY: -0.18 },
      { x: 7.2, z: -12.0, w: 4.8, h: 2.2, d: 1.2, rotY: 0.18 },
      { x: -8.2, z: -18.5, w: 6.0, h: 2.8, d: 1.3, rotY: 0.12 },
      { x: 8.2, z: -19.0, w: 5.8, h: 2.8, d: 1.3, rotY: -0.15 },
    ];

    for (let i = 0; i < wallSpecs.length; i++) {
      const w = wallSpecs[i];
      const wy = terrain.getTerrainHeightAt(w.x, w.z);
      const wGeo = IncaMasonrySystem.createIncaPillowWallGeometry(w.w, w.h, w.d, {
        courses: Math.max(3, Math.round(w.h / 0.65)),
        stonesPerCourse: Math.max(4, Math.round(w.w / 0.85)),
        pillowBulge: 0.05,
        jointDepth: 0.026,
        batter: 0.09,
      });
      this.geometries.push(wGeo);
      const wall = new THREE.Mesh(wGeo, materials.andesiteCut);
      wall.position.set(w.x, wy + w.h * 0.35, w.z);
      wall.rotation.y = w.rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);
      terrain.registerWalkable(wall);

      // Footing berm along the base of the retaining wall to eliminate harsh 90-degree intersection
      const bermGeo = IncaMasonrySystem.createWallFootingBermGeometry(w.w * 0.98, 0.32, 0.42);
      this.geometries.push(bermGeo);
      const berm = new THREE.Mesh(bermGeo, materials.groundForestFloor);
      berm.position.set(
        w.x - Math.sin(w.rotY) * (w.d * 0.42),
        wy + 0.02,
        w.z + Math.cos(w.rotY) * (w.d * 0.42)
      );
      berm.rotation.y = w.rotY;
      berm.receiveShadow = true;
      this.group.add(berm);

      // Natural weathered scree cobbles along the base
      for (let s = 0; s < 3; s++) {
        const scGeo = IncaMasonrySystem.createRiverCobbleGeometry(0.16 + s * 0.04, i * 4 + s);
        this.geometries.push(scGeo);
        const scMesh = new THREE.Mesh(
          scGeo,
          s % 2 === 0 ? materials.andesiteCut : materials.fieldstoneRough
        );
        const sxOffset = (-0.35 + s * 0.35) * w.w;
        scMesh.position.set(
          w.x + Math.cos(w.rotY) * sxOffset - Math.sin(w.rotY) * (w.d * 0.48),
          wy + 0.08,
          w.z + Math.sin(w.rotY) * sxOffset + Math.cos(w.rotY) * (w.d * 0.48)
        );
        scMesh.castShadow = true;
        scMesh.receiveShadow = true;
        this.group.add(scMesh);
      }
    }
  }

  private buildTrailShelterAndStele(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    // 1. Stone Trail Shelter on the North Terrace (x = 4.2, z = -15.5) per §1.7
    const shX = 4.2;
    const shZ = -15.5;
    const shY = terrain.getTerrainHeightAt(shX, shZ);

    // Dedicated high-resolution combed ichu thatch material
    const thatchAlbedo = materials.highSierraPuna.map ? materials.highSierraPuna.map.clone() : null;
    if (thatchAlbedo) {
      thatchAlbedo.wrapS = THREE.RepeatWrapping;
      thatchAlbedo.wrapT = THREE.RepeatWrapping;
      thatchAlbedo.repeat.set(1.5, 2.0);
    }
    const thatchNormal = materials.woodBark.normalMap ? materials.woodBark.normalMap.clone() : null;
    if (thatchNormal) {
      thatchNormal.wrapS = THREE.RepeatWrapping;
      thatchNormal.wrapT = THREE.RepeatWrapping;
      thatchNormal.repeat.set(3.0, 8.0);
    }

    const thatchMat = new THREE.MeshStandardMaterial({
      name: 'CloudForestIchuThatch',
      color: new THREE.Color(0xffffff),
      map: thatchAlbedo,
      normalMap: thatchNormal,
      normalScale: new THREE.Vector2(1.5, 3.5),
      roughness: 0.95,
      metalness: 0.0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    this.materialsList.push(thatchMat);

    const backWallGeo = IncaMasonrySystem.createIncaPillowWallGeometry(3.6, 2.8, 0.55, {
      courses: 5,
      stonesPerCourse: 5,
      pillowBulge: 0.045,
    });
    const sideWallGeo = IncaMasonrySystem.createIncaPillowWallGeometry(2.6, 2.4, 0.55, {
      courses: 4,
      stonesPerCourse: 4,
      pillowBulge: 0.045,
    });
    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.85, 10);
    const postPlinthGeo = IncaMasonrySystem.createRiverCobbleGeometry(0.24, 2.8);
    const lintelGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 10);
    lintelGeo.rotateZ(Math.PI * 0.5);
    const rafterGeo = new THREE.CylinderGeometry(0.075, 0.085, 3.4, 8);
    rafterGeo.rotateX(Math.PI * 0.5);
    const thatchRoofGeo = this.createAndeanShedRoofGeometry(3.6, 2.6, 1.25, 0.30, 0.45);
    const shelterBermGeo = IncaMasonrySystem.createWallFootingBermGeometry(3.8, 0.35, 0.45);
    const bannerGeo = new THREE.PlaneGeometry(0.85, 1.45);
    this.geometries.push(
      backWallGeo,
      sideWallGeo,
      postGeo,
      postPlinthGeo,
      lintelGeo,
      rafterGeo,
      thatchRoofGeo,
      shelterBermGeo,
      bannerGeo
    );

    const backWall = new THREE.Mesh(backWallGeo, materials.andesiteCut);
    backWall.position.set(shX, shY + 1.25, shZ - 1.1);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    const leftWall = new THREE.Mesh(sideWallGeo, materials.andesiteCut);
    leftWall.position.set(shX - 1.55, shY + 0.95, shZ);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, materials.andesiteCut);
    rightWall.position.set(shX + 1.55, shY + 0.95, shZ);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.group.add(rightWall);

    // Footing berm sealing back wall into slope
    const shelterBerm = new THREE.Mesh(shelterBermGeo, materials.groundForestFloor);
    shelterBerm.position.set(shX, shY + 0.02, shZ - 0.75);
    shelterBerm.receiveShadow = true;
    this.group.add(shelterBerm);

    // Front support timber columns on stone plinths
    const postPositions = [shX - 1.55, shX + 1.55];
    for (let p = 0; p < postPositions.length; p++) {
      const px = postPositions[p];
      const pz = shZ + 1.25;
      const py = terrain.getTerrainHeightAt(px, pz);

      const plinth = new THREE.Mesh(postPlinthGeo, materials.andesiteCut);
      plinth.position.set(px, py + 0.08, pz);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      this.group.add(plinth);

      const post = new THREE.Mesh(postGeo, materials.woodAged);
      post.position.set(px, py + 0.98, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      this.group.add(post);
    }

    // Heavy cross-lintel timber log atop the front posts
    const lintel = new THREE.Mesh(lintelGeo, materials.woodAged);
    lintel.position.set(shX, shY + 1.82, shZ + 1.25);
    lintel.castShadow = true;
    this.group.add(lintel);

    // 5 sloped timber rafters connecting rear wall to front lintel
    for (let r = 0; r < 5; r++) {
      const rx = shX - 1.45 + r * 0.725;
      const rafter = new THREE.Mesh(rafterGeo, materials.woodAged);
      rafter.position.set(rx, shY + 2.24, shZ + 0.06);
      rafter.rotation.x = 0.34;
      rafter.castShadow = true;
      this.group.add(rafter);
    }

    // Authentic 3D volumetric combed ichu thatch roof with steep 20-degree Andean pitch
    const thatchRoof = new THREE.Mesh(thatchRoofGeo, thatchMat);
    thatchRoof.position.set(shX, shY + 1.76, shZ);
    thatchRoof.castShadow = true;
    thatchRoof.receiveShadow = true;
    this.group.add(thatchRoof);

    // Quechua ceremonial textile banner draped inside shelter entrance
    const banner = new THREE.Mesh(bannerGeo, materials.clothQuechuaRed);
    banner.position.set(shX - 0.75, shY + 1.25, shZ + 0.45);
    banner.rotation.y = 0.12;
    banner.castShadow = true;
    this.group.add(banner);

    // Stone offering niche & hanging quipu record inside the shelter
    const nicheGeo = this.createChippedBlockGeometry(0.75, 0.85, 0.45);
    const quipuDowelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);
    quipuDowelGeo.rotateZ(Math.PI / 2);
    this.geometries.push(nicheGeo, quipuDowelGeo);

    const niche = new THREE.Mesh(nicheGeo, materials.andesiteCut);
    niche.position.set(shX, shY + 0.42, shZ - 0.7);
    niche.castShadow = true;
    niche.receiveShadow = true;
    this.group.add(niche);

    const quipuDowel = new THREE.Mesh(quipuDowelGeo, materials.woodAged);
    quipuDowel.position.set(shX, shY + 0.95, shZ - 0.7);
    this.group.add(quipuDowel);

    this.interactables.push({
      id: 'quipu_cloud_forest_archive',
      label: 'Ancient Inca Quipu Knot Fragment',
      promptText: '[E] Decipher Inca Quipu',
      position: new THREE.Vector3(shX, shY + 0.9, shZ - 0.5),
      radius: 2.6,
    });

    // 2. Carved Inca Stele & Ceremonial Paccha Water Fountain at (x = -2.6, z = -16.2)
    const stX = -2.6;
    const stZ = -16.2;
    const stY = terrain.getTerrainHeightAt(stX, stZ);

    const plinthGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(1.4, 0.45, 18);
    const steleGeo = IncaMasonrySystem.createIncaWakaSteleGeometry(0.46, 2.35, 12);
    const sunDiscGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
    sunDiscGeo.rotateX(Math.PI / 2);

    // Monolithic carved andesite basin (Paccha)
    const basinGeo = this.createChippedBlockGeometry(1.4, 0.65, 1.2);
    const basinWaterGeo = new THREE.PlaneGeometry(1.15, 0.95);
    basinWaterGeo.rotateX(-Math.PI * 0.5);
    const spoutGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.35, 8);
    spoutGeo.rotateX(Math.PI * 0.5);
    const channelGeo = this.createChippedBlockGeometry(4.2, 0.35, 0.65);
    const channelWaterGeo = new THREE.PlaneGeometry(4.0, 0.36);
    channelWaterGeo.rotateX(-Math.PI * 0.5);

    // Spoked bronze sluice wheel
    const wheelRimGeo = new THREE.TorusGeometry(0.28, 0.035, 8, 18);
    const wheelHubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12);
    wheelHubGeo.rotateX(Math.PI * 0.5);
    const spokeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.52, 6);

    this.geometries.push(
      plinthGeo,
      steleGeo,
      sunDiscGeo,
      basinGeo,
      basinWaterGeo,
      spoutGeo,
      channelGeo,
      channelWaterGeo,
      wheelRimGeo,
      wheelHubGeo,
      spokeGeo
    );

    const plinth = new THREE.Mesh(plinthGeo, materials.andesiteCut);
    plinth.position.set(stX, stY + 0.15, stZ);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    const stele = new THREE.Mesh(steleGeo, materials.andesiteCut);
    stele.position.set(stX, stY + 1.45, stZ);
    stele.castShadow = true;
    stele.receiveShadow = true;
    this.group.add(stele);

    // Carved ornamental gold Chakana solar medallion on the stele
    const sunDisc = new THREE.Mesh(sunDiscGeo, materials.goldOrnamental);
    sunDisc.position.set(stX, stY + 1.72, stZ + 0.23);
    this.group.add(sunDisc);

    // Carved stone fountain basin
    const basin = new THREE.Mesh(basinGeo, materials.andesiteCut);
    basin.position.set(stX + 0.95, stY + 0.28, stZ + 0.65);
    basin.castShadow = true;
    basin.receiveShadow = true;
    this.group.add(basin);

    const basinWater = new THREE.Mesh(basinWaterGeo, materials.water);
    basinWater.position.set(stX + 0.95, stY + 0.55, stZ + 0.65);
    this.group.add(basinWater);

    // Stone water spout protruding from stele base pouring into basin
    const spout = new THREE.Mesh(spoutGeo, materials.andesiteCut);
    spout.position.set(stX + 0.35, stY + 0.72, stZ + 0.38);
    spout.castShadow = true;
    this.group.add(spout);

    // Bronze spoked sluice wheel assembly
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(stX - 0.35, stY + 1.05, stZ + 0.26);
    const wheelRim = new THREE.Mesh(wheelRimGeo, materials.metalBronze);
    wheelRim.castShadow = true;
    wheelGroup.add(wheelRim);

    const wheelHub = new THREE.Mesh(wheelHubGeo, materials.metalBronze);
    wheelHub.castShadow = true;
    wheelGroup.add(wheelHub);

    for (let sp = 0; sp < 3; sp++) {
      const spoke = new THREE.Mesh(spokeGeo, materials.metalBronze);
      spoke.rotation.z = (sp / 3) * Math.PI;
      spoke.castShadow = true;
      wheelGroup.add(spoke);
    }
    this.group.add(wheelGroup);

    // Stone water channel extending outward
    const channel = new THREE.Mesh(channelGeo, materials.andesiteCut);
    channel.position.set(stX + 2.8, stY + 0.1, stZ + 1.15);
    channel.castShadow = true;
    channel.receiveShadow = true;
    this.group.add(channel);

    const channelWater = new THREE.Mesh(channelWaterGeo, materials.water);
    channelWater.position.set(stX + 2.8, stY + 0.29, stZ + 1.15);
    this.group.add(channelWater);

    this.interactables.push({
      id: 'stele_cloud_forest',
      label: 'Inca Water-Reckoning Stele & Sluice Wheel',
      promptText: '[E] Turn Bronze Sluice Wheel',
      position: new THREE.Vector3(stX, stY + 1.0, stZ + 0.8),
      radius: 3.2,
    });
  }

  private buildCheckpointAndViewpoint(
    materials: PbrMaterialLibrary,
    terrain: TerrainSystem
  ): void {
    // 1. Sanctuary Checkpoint Stone Circle near South Trailhead (x = -2.2, z = 8.4) per §3.8
    const cpX = -2.2;
    const cpZ = 8.4;
    const cpY = terrain.getTerrainHeightAt(cpX, cpZ);

    // Authentic circular stepped Inca Usnu altar platform embedded into the forest loam
    const daisGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(1.65, 0.22, 20);
    const innerDaisGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(1.22, 0.16, 20);
    // Carved andesite offering vessel receptacle (Qonopa basin)
    const vesselPlinthGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(0.38, 0.18, 16);
    // Sacred carved Inca Waka monolith with stepped Chakana collars on the rear flank
    const markerGeo = IncaMasonrySystem.createIncaWakaSteleGeometry(0.28, 0.95, 12);
    // Rustic beaten bronze ceremonial offering dish
    const bronzeDishGeo = new THREE.CylinderGeometry(0.24, 0.16, 0.08, 16);
    const emberGeo = new THREE.SphereGeometry(0.12, 12, 8);
    this.geometries.push(daisGeo, innerDaisGeo, vesselPlinthGeo, markerGeo, bronzeDishGeo, emberGeo);

    const dais = new THREE.Mesh(daisGeo, materials.andesiteCut);
    dais.position.set(cpX, cpY + 0.08, cpZ);
    dais.castShadow = true;
    dais.receiveShadow = true;
    this.group.add(dais);
    terrain.registerWalkable(dais);

    const innerDais = new THREE.Mesh(innerDaisGeo, materials.andesiteCut);
    innerDais.position.set(cpX, cpY + 0.22, cpZ);
    innerDais.castShadow = true;
    innerDais.receiveShadow = true;
    this.group.add(innerDais);

    // 10 Natural, rounded river-worn / moraine andesite cobbles nestled around the dais
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + Math.sin(i * 1.7) * 0.15;
      const rad = 1.62 + Math.sin(i * 2.3) * 0.12;
      const rx = cpX + Math.cos(ang) * rad;
      const rz = cpZ + Math.sin(ang) * rad;
      const ry = terrain.getTerrainHeightAt(rx, rz);
      const cobbleGeo = IncaMasonrySystem.createRiverCobbleGeometry(0.18 + (i % 3) * 0.04, i * 2.3);
      this.geometries.push(cobbleGeo);
      const cobble = new THREE.Mesh(
        cobbleGeo,
        i % 2 === 0 ? materials.andesiteCut : materials.fieldstoneRough
      );
      cobble.position.set(rx, ry + 0.08, rz);
      cobble.rotation.set(Math.sin(i * 1.5) * 0.2, ang, Math.cos(i * 1.9) * 0.2);
      cobble.castShadow = true;
      cobble.receiveShadow = true;
      this.group.add(cobble);
    }

    // Carved andesite ceremonial vessel (Qonopa) on the inner dais
    const vessel = new THREE.Mesh(vesselPlinthGeo, materials.andesiteCut);
    vessel.position.set(cpX, cpY + 0.36, cpZ);
    vessel.castShadow = true;
    vessel.receiveShadow = true;
    this.group.add(vessel);

    // Rustic beaten bronze offering dish nested inside
    const dish = new THREE.Mesh(bronzeDishGeo, materials.metalBronze);
    dish.position.set(cpX, cpY + 0.42, cpZ);
    dish.castShadow = true;
    this.group.add(dish);

    // Glowing sacred ember
    const ember = new THREE.Mesh(emberGeo, materials.goldOrnamental);
    ember.position.set(cpX, cpY + 0.46, cpZ);
    this.group.add(ember);

    // Standing sacred Waka stele monolith on the flank of the altar
    const marker = new THREE.Mesh(markerGeo, materials.andesiteCut);
    marker.position.set(cpX - 0.68, cpY + 0.58, cpZ - 0.22);
    marker.rotation.y = 0.35;
    marker.castShadow = true;
    marker.receiveShadow = true;
    this.group.add(marker);

    this.interactables.push({
      id: 'checkpoint_south_trail',
      label: 'Sanctuary Checkpoint',
      promptText: '[E] Rest at Sanctuary Marker',
      position: new THREE.Vector3(cpX, cpY + 1.0, cpZ),
      radius: 2.8,
    });

    // 2. Condor Viewpoint on the North Overlook Ridge (x = 0.0, z = -24.5) per §3.5 & Phase 1 spec
    const vpX = 0.0;
    const vpZ = -24.5;
    const vpY = terrain.getTerrainHeightAt(vpX, vpZ);

    const daisVpGeo = IncaMasonrySystem.createIncaAltarDaisGeometry(2.4, 0.45, 24);
    const perchGeo = IncaMasonrySystem.createIncaWakaSteleGeometry(0.42, 1.75, 12);
    this.geometries.push(daisVpGeo, perchGeo);

    const vpDais = new THREE.Mesh(daisVpGeo, materials.andesiteCut);
    vpDais.position.set(vpX, vpY + 0.2, vpZ);
    vpDais.castShadow = true;
    vpDais.receiveShadow = true;
    this.group.add(vpDais);
    terrain.registerWalkable(vpDais);

    const perch = new THREE.Mesh(perchGeo, materials.andesiteCut);
    perch.position.set(vpX, vpY + 1.15, vpZ - 1.1);
    perch.castShadow = true;
    perch.receiveShadow = true;
    this.group.add(perch);

    // Weathered Andean bedrock crag outcrops framing the ridge pass behind the viewpoint
    const ridgeCrags = [
      { x: -3.2, yOff: 0.65, z: -25.6, rad: 2.1, seed: 4.1 },
      { x: 3.2, yOff: 0.65, z: -25.6, rad: 2.1, seed: 5.7 },
      { x: 0.0, yOff: 0.95, z: -27.2, rad: 2.6, seed: 6.9 },
      { x: -1.6, yOff: 0.40, z: -24.2, rad: 1.1, seed: 2.3 },
      { x: 1.6, yOff: 0.40, z: -24.2, rad: 1.1, seed: 3.1 },
    ];
    for (let i = 0; i < ridgeCrags.length; i++) {
      const rc = ridgeCrags[i];
      const rcy = terrain.getTerrainHeightAt(rc.x, rc.z);
      const cragGeo = IncaMasonrySystem.createRiverCobbleGeometry(rc.rad, rc.seed);
      this.geometries.push(cragGeo);
      const cragMesh = new THREE.Mesh(cragGeo, materials.fieldstoneRough);
      cragMesh.position.set(rc.x, rcy + rc.yOff, rc.z);
      cragMesh.rotation.set(Math.sin(rc.seed) * 0.2, rc.seed, Math.cos(rc.seed) * 0.2);
      cragMesh.castShadow = true;
      cragMesh.receiveShadow = true;
      this.group.add(cragMesh);
    }

    // Circling Majestic Andean Condor (Vultur gryphus) high overhead
    this.condorMesh = this.createCondorMesh(materials);
    this.condorMesh.position.set(0, 26, -18);
    this.group.add(this.condorMesh);

    this.interactables.push({
      id: 'viewpoint_cloud_forest',
      label: 'Cloud Forest Condor Viewpoint',
      promptText: '[X] / [E] Synchronize Viewpoint',
      position: new THREE.Vector3(vpX, vpY + 1.0, vpZ),
      radius: 3.5,
    });
  }

  private createCondorMesh(materials: PbrMaterialLibrary): THREE.Group {
    const group = new THREE.Group();

    // 1. Sleek Torso / Fuselage
    const torsoGeo = new THREE.ConeGeometry(0.24, 1.35, 10);
    torsoGeo.rotateX(Math.PI * 0.5);
    const torso = new THREE.Mesh(torsoGeo, materials.hair);
    group.add(torso);

    // 2. White Feathered Neck Collar (Iconic Andean Condor ruff)
    const collarGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.16, 12);
    collarGeo.rotateX(Math.PI * 0.5);
    const collar = new THREE.Mesh(collarGeo, materials.highSierraSnow);
    collar.position.set(0, 0.04, -0.62);
    group.add(collar);

    // 3. Head & Hooked Predatory Beak
    const headGeo = new THREE.SphereGeometry(0.16, 12, 10);
    const head = new THREE.Mesh(headGeo, materials.hair);
    head.position.set(0, 0.08, -0.82);
    group.add(head);

    const beakGeo = new THREE.ConeGeometry(0.07, 0.24, 6);
    beakGeo.rotateX(-Math.PI * 0.45);
    const beak = new THREE.Mesh(beakGeo, materials.woodAged);
    beak.position.set(0, 0.02, -0.98);
    group.add(beak);

    // 4. Broad Tail Fan
    const tailGeo = new THREE.BoxGeometry(0.65, 0.04, 0.72);
    const tail = new THREE.Mesh(tailGeo, materials.hair);
    tail.position.set(0, -0.02, 0.85);
    tail.rotation.x = -0.08;
    group.add(tail);

    // 5. Majestic Soaring Wings (Left & Right) with white dorsal patches & slotted primaries
    for (let side = -1; side <= 1; side += 2) {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 0.18, 0.06, -0.15);

      // Main inner wing
      const mainWingGeo = new THREE.BoxGeometry(1.65, 0.04, 0.58);
      const mainWing = new THREE.Mesh(mainWingGeo, materials.hair);
      mainWing.position.set(side * 0.82, 0, 0);
      wingGroup.add(mainWing);

      // Distinctive white dorsal wing coverts patch (upper wing)
      const whitePatchGeo = new THREE.BoxGeometry(1.15, 0.02, 0.28);
      const whitePatch = new THREE.Mesh(whitePatchGeo, materials.highSierraSnow);
      whitePatch.position.set(side * 0.65, 0.03, -0.08);
      wingGroup.add(whitePatch);

      // Outer swept wing
      const outerWingGeo = new THREE.BoxGeometry(1.1, 0.035, 0.46);
      const outerWing = new THREE.Mesh(outerWingGeo, materials.hair);
      outerWing.position.set(side * 1.95, 0.04, 0.06);
      outerWing.rotation.z = side * 0.06;
      wingGroup.add(outerWing);

      // 5 Slotted primary flight feather "fingers" at wingtip
      for (let p = 0; p < 5; p++) {
        const primGeo = new THREE.BoxGeometry(0.42, 0.02, 0.08);
        const prim = new THREE.Mesh(primGeo, materials.hair);
        const pz = -0.16 + p * 0.09;
        const px = side * (2.45 + p * 0.04);
        prim.position.set(px, 0.08 + p * 0.015, pz);
        prim.rotation.y = side * (-0.12 + p * 0.08);
        prim.rotation.z = side * (0.12 + p * 0.03);
        wingGroup.add(prim);
        this.geometries.push(primGeo);
      }

      this.geometries.push(mainWingGeo, whitePatchGeo, outerWingGeo);
      group.add(wingGroup);
    }

    this.geometries.push(torsoGeo, collarGeo, headGeo, beakGeo, tailGeo);
    return group;
  }

  private createChippedBlockGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    // §2.1 "No perfect geometry. Stone blocks have chips, bevels, uneven faces."
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const chip =
        Math.sin(vx * 5.3 + vy * 7.1 + vz * 4.7) * 0.025 +
        Math.cos(vx * 9.2 - vz * 8.4) * 0.015;
      // Bevel outer edges slightly
      const edgeBevel =
        Math.abs(vy) > h * 0.45 ? 0.96 : 1.0;
      pos.setXYZ(i, vx * edgeBevel + chip, vy + chip * 0.6, vz * edgeBevel + chip);
    }
    geo.computeVertexNormals();
    return geo;
  }

  private createBatteredWallGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
    // Inca walls have an inward batter (slope) toward the top per Bible §1.7 & R3/R15
    const geo = new THREE.BoxGeometry(w, h, d, 5, 4, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const normY = (vy + h * 0.5) / h; // 0 at bottom, 1 at top
      const batter = 1.0 - normY * 0.14;
      const irreg = Math.sin(vx * 4.1 + vy * 6.3 + vz * 5.2) * 0.028;
      pos.setXYZ(i, vx * batter + irreg, vy + irreg * 0.5, vz * batter + irreg);
    }
    geo.computeVertexNormals();
    return geo;
  }

  public update(dt: number, playerPosition?: THREE.Vector3): void {
    this.elapsedSec += dt;

    // Distance-gated subtle bridge sway & condor flight (§5.2 #3)
    if (!playerPosition || playerPosition.lengthSq() < 60 * 60) {
      this.bridgeGroup.position.x = Math.sin(this.elapsedSec * 1.4) * 0.008;
    }

    const cAng = this.elapsedSec * 0.28;
    this.condorMesh.position.set(
      Math.cos(cAng) * 18.0,
      25.0 + Math.sin(cAng * 2.0) * 1.2,
      -18.0 + Math.sin(cAng) * 14.0
    );
    this.condorMesh.rotation.y = -cAng;
    this.condorMesh.rotation.z = 0.18;
  }

  /**
   * Generates an authentic 3D volumetric Andean shed / lean-to ichu thatch roof.
   * Features a sloping thatch plane descending from back to front, generous eaves overhang,
   * combed straw ridges with organic displacement, vertical eave faces, 3D verge edge faces,
   * and multi-tone vertex-colored straw gradient (bleached gold to weathered amber).
   */
  private createAndeanShedRoofGeometry(
    w: number,
    d: number,
    slopeDrop: number,
    eaveThick: number,
    overhang: number
  ): THREE.BufferGeometry {
    const ow = w + overhang * 2;
    const od = d + overhang * 2;
    const halfW = ow * 0.5;
    const halfD = od * 0.5;

    const stepsX = 10;
    const stepsZ = 10;

    const posList: number[] = [];
    const normList: number[] = [];
    const uvList: number[] = [];
    const colList: number[] = [];
    const idxList: number[] = [];

    const addQuad = (
      p0: [number, number, number],
      p1: [number, number, number],
      p2: [number, number, number],
      p3: [number, number, number],
      norm: [number, number, number],
      u0: number, v0: number, u1: number, v1: number,
      c0: [number, number, number],
      c1: [number, number, number],
      c2: [number, number, number],
      c3: [number, number, number]
    ): void => {
      const baseIdx = posList.length / 3;
      posList.push(...p0, ...p1, ...p2, ...p3);
      normList.push(...norm, ...norm, ...norm, ...norm);
      uvList.push(u0, v0, u1, v0, u1, v1, u0, v1);
      colList.push(...c0, ...c1, ...c2, ...c3);
      idxList.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
    };

    // Color swatches for combed Andean ichu straw
    const cHighRidge: [number, number, number] = [0.88, 0.74, 0.46]; // Bleached sunlit straw
    const cMidSlope: [number, number, number] = [0.76, 0.58, 0.32];  // Warm amber ichu body
    const cEaveLow: [number, number, number] = [0.60, 0.44, 0.22];   // Weathered straw
    const cEaveFace: [number, number, number] = [0.46, 0.34, 0.18];  // Exposed vertical straw cut
    const cUnderside: [number, number, number] = [0.28, 0.20, 0.10]; // Deep shadow occlusion

    // 1. Top sloped combed thatch surface
    for (let iz = 0; iz < stepsZ; iz++) {
      const tz0 = iz / stepsZ;
      const tz1 = (iz + 1) / stepsZ;
      const z0 = -halfD + tz0 * od;
      const z1 = -halfD + tz1 * od;

      const baseH0 = (1.0 - tz0) * slopeDrop;
      const baseH1 = (1.0 - tz1) * slopeDrop;

      for (let ix = 0; ix < stepsX; ix++) {
        const tx0 = ix / stepsX;
        const tx1 = (ix + 1) / stepsX;
        const x0 = -halfW + tx0 * ow;
        const x1 = -halfW + tx1 * ow;

        const disp00 = Math.sin(x0 * 7.5 + z0 * 5.2) * 0.035 + Math.cos(x0 * 14.0) * 0.015;
        const disp10 = Math.sin(x1 * 7.5 + z0 * 5.2) * 0.035 + Math.cos(x1 * 14.0) * 0.015;
        const disp11 = Math.sin(x1 * 7.5 + z1 * 5.2) * 0.035 + Math.cos(x1 * 14.0) * 0.015;
        const disp01 = Math.sin(x0 * 7.5 + z1 * 5.2) * 0.035 + Math.cos(x0 * 14.0) * 0.015;

        const y00 = baseH0 + disp00;
        const y10 = baseH0 + disp10;
        const y11 = baseH1 + disp11;
        const y01 = baseH1 + disp01;

        const col0: [number, number, number] = [
          cHighRidge[0] * (1.0 - tz0) + cMidSlope[0] * tz0,
          cHighRidge[1] * (1.0 - tz0) + cMidSlope[1] * tz0,
          cHighRidge[2] * (1.0 - tz0) + cMidSlope[2] * tz0,
        ];
        const col1: [number, number, number] = [
          cHighRidge[0] * (1.0 - tz1) + cEaveLow[0] * tz1,
          cHighRidge[1] * (1.0 - tz1) + cEaveLow[1] * tz1,
          cHighRidge[2] * (1.0 - tz1) + cEaveLow[2] * tz1,
        ];

        const slopeAngle = Math.atan2(slopeDrop, od);
        const ny = Math.cos(slopeAngle);
        const nz = Math.sin(slopeAngle);

        addQuad(
          [x0, y00, z0],
          [x1, y10, z0],
          [x1, y11, z1],
          [x0, y01, z1],
          [0, ny, nz],
          tx0 * 2.5, tz0 * 3.5,
          tx1 * 2.5, tz1 * 3.5,
          col0, col0, col1, col1
        );
      }
    }

    // 2. Front eave vertical face (+Z)
    const frontZ = halfD;
    const frontBaseY = 0;
    for (let ix = 0; ix < stepsX; ix++) {
      const tx0 = ix / stepsX;
      const tx1 = (ix + 1) / stepsX;
      const x0 = -halfW + tx0 * ow;
      const x1 = -halfW + tx1 * ow;
      const droop0 = Math.sin(tx0 * Math.PI * 6.0) * 0.025;
      const droop1 = Math.sin(tx1 * Math.PI * 6.0) * 0.025;

      addQuad(
        [x0, frontBaseY - eaveThick + droop0, frontZ],
        [x1, frontBaseY - eaveThick + droop1, frontZ],
        [x1, frontBaseY + droop1, frontZ],
        [x0, frontBaseY + droop0, frontZ],
        [0, 0, 1],
        tx0 * 2.5, 0, tx1 * 2.5, 0.4,
        cEaveFace, cEaveFace, cEaveFace, cEaveFace
      );

      // Underside soffit return
      addQuad(
        [x0, frontBaseY - eaveThick + droop0, frontZ - overhang],
        [x1, frontBaseY - eaveThick + droop1, frontZ - overhang],
        [x1, frontBaseY - eaveThick + droop1, frontZ],
        [x0, frontBaseY - eaveThick + droop0, frontZ],
        [0, -1, 0],
        tx0 * 2.5, 0, tx1 * 2.5, 0.3,
        cUnderside, cUnderside, cUnderside, cUnderside
      );
    }

    // 3. Back eave vertical face (-Z)
    const backZ = -halfD;
    const backBaseY = slopeDrop;
    for (let ix = 0; ix < stepsX; ix++) {
      const tx0 = ix / stepsX;
      const tx1 = (ix + 1) / stepsX;
      const x0 = -halfW + tx0 * ow;
      const x1 = -halfW + tx1 * ow;

      addQuad(
        [x1, backBaseY - eaveThick, backZ],
        [x0, backBaseY - eaveThick, backZ],
        [x0, backBaseY, backZ],
        [x1, backBaseY, backZ],
        [0, 0, -1],
        tx1 * 2.5, 0, tx0 * 2.5, 0.4,
        cEaveFace, cEaveFace, cEaveFace, cEaveFace
      );

      // Underside soffit return
      addQuad(
        [x1, backBaseY - eaveThick, backZ],
        [x1, backBaseY - eaveThick, backZ + overhang],
        [x0, backBaseY - eaveThick, backZ + overhang],
        [x0, backBaseY - eaveThick, backZ],
        [0, -1, 0],
        tx1 * 2.5, 0, tx0 * 2.5, 0.3,
        cUnderside, cUnderside, cUnderside, cUnderside
      );
    }

    // 4. Left (-X) and Right (+X) verge edge faces closing the 3D volume
    for (let side = -1; side <= 1; side += 2) {
      const vx = side * halfW;
      const normX = side;

      for (let iz = 0; iz < stepsZ; iz++) {
        const tz0 = iz / stepsZ;
        const tz1 = (iz + 1) / stepsZ;
        const z0 = -halfD + tz0 * od;
        const z1 = -halfD + tz1 * od;
        const y0 = (1.0 - tz0) * slopeDrop;
        const y1 = (1.0 - tz1) * slopeDrop;

        if (side === 1) {
          addQuad(
            [vx, y0, z0],
            [vx, y1, z1],
            [vx, y1 - eaveThick, z1],
            [vx, y0 - eaveThick, z0],
            [normX, 0, 0],
            tz0 * 3.5, 0, tz1 * 3.5, 0.4,
            cMidSlope, cEaveLow, cEaveLow, cMidSlope
          );
        } else {
          addQuad(
            [vx, y1, z1],
            [vx, y0, z0],
            [vx, y0 - eaveThick, z0],
            [vx, y1 - eaveThick, z1],
            [normX, 0, 0],
            tz1 * 3.5, 0, tz0 * 3.5, 0.4,
            cEaveLow, cMidSlope, cMidSlope, cEaveLow
          );
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posList), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normList), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvList), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colList), 3));
    geo.setIndex(idxList);
    geo.computeVertexNormals();
    return geo;
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    this.geometries.length = 0;
    for (let i = 0; i < this.materialsList.length; i++) {
      this.materialsList[i].dispose();
    }
    this.materialsList.length = 0;
    this.interactables.length = 0;
    this.group.removeFromParent();
  }
}
