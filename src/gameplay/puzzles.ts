/**
 * Module: src/gameplay/puzzles.ts
 * Responsibility: Inca stonework mechanisms (water channels, counterweight doors,
 * solar alignments, quipu ciphers) with animated 3D stone/bronze meshes per Bible §3.4.
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts.
 * Exports: PuzzleMechanismState, PuzzleSystem.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../world/materials';
import { TerrainSystem } from '../world/terrain';

export interface PuzzleMechanismState {
  id: string;
  type: 'waterChannel' | 'counterweightDoor' | 'solarAlignment' | 'quipuCipher';
  solved: boolean;
  progress: number;
}

export class PuzzleSystem {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly mechanisms: PuzzleMechanismState[] = [
    {
      id: 'cf_water_stele_channel',
      type: 'waterChannel',
      solved: false,
      progress: 0,
    },
    {
      id: 'cf_counterweight_door',
      type: 'counterweightDoor',
      solved: false,
      progress: 0,
    },
    {
      id: 'hs_solar_alignment',
      type: 'solarAlignment',
      solved: false,
      progress: 0,
    },
    {
      id: 'jl_hydraulic_sluice',
      type: 'waterChannel',
      solved: false,
      progress: 0,
    },
  ];

  private sluiceWheelMesh: THREE.Mesh | null = null;
  private counterweightDoorMesh: THREE.Mesh | null = null;
  private doorClosedY: number = 0;
  private readonly geometries: THREE.BufferGeometry[] = [];

  public build(
    scene?: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'IncaPuzzleMechanisms';
    if (!scene || !materials || !terrain) return;

    // 1. Stone Sluice Wheel beside the Cloud Forest Water-Reckoning Stele (x = -1.1, z = -15.2)
    const wheelY = terrain.getTerrainHeightAt(-1.1, -15.2);
    const pedestalGeo = new THREE.BoxGeometry(0.58, 0.92, 0.58);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12);
    wheelGeo.rotateX(Math.PI / 2);
    this.geometries.push(pedestalGeo, wheelGeo);

    const pedestal = new THREE.Mesh(pedestalGeo, materials.andesiteCut);
    pedestal.position.set(-1.1, wheelY + 0.42, -15.2);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.group.add(pedestal);

    this.sluiceWheelMesh = new THREE.Mesh(wheelGeo, materials.metalBronze);
    this.sluiceWheelMesh.position.set(-1.1, wheelY + 0.82, -14.88);
    this.sluiceWheelMesh.castShadow = true;
    this.group.add(this.sluiceWheelMesh);

    // 2. Heavy Counterweight Stone Door inside the North Sanctuary Portal (x = 0.0, z = -16.8)
    const doorBaseY = terrain.getTerrainHeightAt(0.0, -16.8);
    this.doorClosedY = doorBaseY + 1.32;
    const doorGeo = new THREE.BoxGeometry(1.48, 2.55, 0.36, 3, 4, 2);
    this.geometries.push(doorGeo);

    this.counterweightDoorMesh = new THREE.Mesh(doorGeo, materials.andesiteCut);
    this.counterweightDoorMesh.position.set(0.0, this.doorClosedY, -16.8);
    this.counterweightDoorMesh.castShadow = true;
    this.counterweightDoorMesh.receiveShadow = true;
    this.group.add(this.counterweightDoorMesh);

    scene.add(this.group);
  }

  public markSolved(id: string): void {
    for (let i = 0; i < this.mechanisms.length; i++) {
      if (this.mechanisms[i].id === id) {
        this.mechanisms[i].solved = true;
      }
      // Solving the water channel also releases the counterweight sanctuary door
      if (id === 'cf_water_stele_channel' && this.mechanisms[i].id === 'cf_counterweight_door') {
        this.mechanisms[i].solved = true;
      }
    }
  }

  public update(dt: number): void {
    for (let i = 0; i < this.mechanisms.length; i++) {
      const m = this.mechanisms[i];
      if (m.solved && m.progress < 1.0) {
        m.progress = Math.min(1.0, m.progress + dt * 0.65);
      }
    }

    const steleState = this.mechanisms[0];
    if (this.sluiceWheelMesh && steleState) {
      this.sluiceWheelMesh.rotation.z = steleState.progress * Math.PI * 1.5;
    }

    const doorState = this.mechanisms[1];
    if (this.counterweightDoorMesh && doorState) {
      this.counterweightDoorMesh.position.y = this.doorClosedY + doorState.progress * 2.25;
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    this.geometries.length = 0;
    this.group.removeFromParent();
  }
}
