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

  // 3D Mechanism elements
  private sluiceWheelMesh: THREE.Mesh | null = null;
  private wheelHandleMesh: THREE.Mesh | null = null;
  private counterweightDoorMesh: THREE.Mesh | null = null;
  private counterweightBlockMesh: THREE.Mesh | null = null;
  private waterChannelStreamMesh: THREE.Mesh | null = null;
  private channelWaterMat: THREE.MeshStandardMaterial | null = null;
  private waterCascadeMesh: THREE.Mesh | null = null;
  private cascadeWaterMat: THREE.MeshStandardMaterial | null = null;
  private cisternWaterMesh: THREE.Mesh | null = null;
  private cisternWaterMat: THREE.MeshStandardMaterial | null = null;

  private doorBaseY: number = 0;
  private doorClosedY: number = 0;
  private weightRaisedY: number = 0;
  private elapsedSec: number = 0;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  public build(
    scene?: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'IncaPuzzleMechanisms';
    if (!scene || !materials || !terrain) return;

    // 1. Stone Sluice Wheel & Pedestal beside the Cloud Forest Water Stele (x = -1.1, z = -15.2)
    const wheelY = terrain.getTerrainHeightAt(-1.1, -15.2);
    const pedestalGeo = new THREE.BoxGeometry(0.58, 0.92, 0.58);
    const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.12, 16);
    wheelGeo.rotateX(Math.PI / 2);
    const handleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8);
    handleGeo.rotateX(Math.PI / 2);
    this.geometries.push(pedestalGeo, wheelGeo, handleGeo);

    const pedestal = new THREE.Mesh(pedestalGeo, materials.andesiteCut);
    pedestal.position.set(-1.1, wheelY + 0.42, -15.2);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.group.add(pedestal);

    this.sluiceWheelMesh = new THREE.Mesh(wheelGeo, materials.metalBronze);
    this.sluiceWheelMesh.position.set(-1.1, wheelY + 0.84, -14.88);
    this.sluiceWheelMesh.castShadow = true;

    // Hand crank pin on rim of bronze wheel
    this.wheelHandleMesh = new THREE.Mesh(handleGeo, materials.metalBronze);
    this.wheelHandleMesh.position.set(0.32, 0, 0.12);
    this.sluiceWheelMesh.add(this.wheelHandleMesh);
    this.group.add(this.sluiceWheelMesh);

    // 2. Carved Andesite Stone Aqueduct Channel connecting Sluice to Sanctuary Basin
    const channelGeo = new THREE.BoxGeometry(0.48, 0.22, 2.15);
    this.geometries.push(channelGeo);
    const channelStone = new THREE.Mesh(channelGeo, materials.andesiteCut);
    channelStone.position.set(-0.55, wheelY + 0.08, -16.0);
    channelStone.rotation.y = 0.62;
    channelStone.receiveShadow = true;
    this.group.add(channelStone);

    // Flowing Water Ribbon inside the carved channel
    const waterRibbonGeo = new THREE.PlaneGeometry(0.28, 2.1);
    waterRibbonGeo.rotateX(-Math.PI / 2);
    this.geometries.push(waterRibbonGeo);

    this.channelWaterMat = new THREE.MeshStandardMaterial({
      color: 0x5ea8c8,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.0, // Fades in as water is released!
      depthWrite: false,
    });
    this.materials.push(this.channelWaterMat);

    this.waterChannelStreamMesh = new THREE.Mesh(waterRibbonGeo, this.channelWaterMat);
    this.waterChannelStreamMesh.position.set(-0.55, wheelY + 0.16, -16.0);
    this.waterChannelStreamMesh.rotation.y = 0.62;
    this.group.add(this.waterChannelStreamMesh);

    // 3. Carved Inca Stone Paqcha (fountain spout) pouring into the cistern
    const spoutGeo = new THREE.CylinderGeometry(0.09, 0.14, 0.42, 10);
    spoutGeo.rotateZ(Math.PI * 0.5);
    const cascadeGeo = new THREE.PlaneGeometry(0.24, 0.92);
    this.geometries.push(spoutGeo, cascadeGeo);

    const paqchaSpout = new THREE.Mesh(spoutGeo, materials.andesiteCut);
    paqchaSpout.position.set(0.38, wheelY + 0.12, -16.72);
    paqchaSpout.rotation.y = 0.62;
    paqchaSpout.castShadow = true;
    this.group.add(paqchaSpout);

    this.cascadeWaterMat = new THREE.MeshStandardMaterial({
      color: 0x76c2e2,
      roughness: 0.1,
      metalness: 0.05,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(this.cascadeWaterMat);

    this.waterCascadeMesh = new THREE.Mesh(cascadeGeo, this.cascadeWaterMat);
    this.waterCascadeMesh.position.set(0.68, wheelY - 0.28, -16.78);
    this.group.add(this.waterCascadeMesh);

    // 4. Heavy Counterweight Stone Door inside the North Sanctuary Portal (x = 0.0, z = -16.8)
    this.doorBaseY = terrain.getTerrainHeightAt(0.0, -16.8);
    this.doorClosedY = this.doorBaseY + 1.32;
    const doorGeo = new THREE.BoxGeometry(1.48, 2.55, 0.36, 3, 4, 2);
    this.geometries.push(doorGeo);

    this.counterweightDoorMesh = new THREE.Mesh(doorGeo, materials.andesiteCut);
    this.counterweightDoorMesh.position.set(0.0, this.doorClosedY, -16.8);
    this.counterweightDoorMesh.castShadow = true;
    this.counterweightDoorMesh.receiveShadow = true;
    this.group.add(this.counterweightDoorMesh);

    // 5. Circular Stone Counterweight Cistern Basin (x = 1.05, z = -16.8)
    const cisternBasinGeo = new THREE.CylinderGeometry(0.72, 0.82, 0.88, 18, 1, true);
    const cisternWaterGeo = new THREE.CircleGeometry(0.68, 18);
    cisternWaterGeo.rotateX(-Math.PI / 2);
    this.geometries.push(cisternBasinGeo, cisternWaterGeo);

    const cisternBasin = new THREE.Mesh(cisternBasinGeo, materials.andesiteCut);
    cisternBasin.position.set(1.05, this.doorBaseY + 0.38, -16.8);
    cisternBasin.castShadow = true;
    cisternBasin.receiveShadow = true;
    this.group.add(cisternBasin);

    this.cisternWaterMat = new THREE.MeshStandardMaterial({
      color: 0x4896b8,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.materials.push(this.cisternWaterMat);

    this.cisternWaterMesh = new THREE.Mesh(cisternWaterGeo, this.cisternWaterMat);
    this.cisternWaterMesh.position.set(1.05, this.doorBaseY + 0.08, -16.8);
    this.group.add(this.cisternWaterMesh);

    // 6. Counterweight stone block that lowers into the rising cistern as door rises
    this.weightRaisedY = this.doorClosedY + 2.4;
    const weightGeo = new THREE.BoxGeometry(0.55, 0.65, 0.42);
    this.geometries.push(weightGeo);

    this.counterweightBlockMesh = new THREE.Mesh(weightGeo, materials.andesiteCut);
    this.counterweightBlockMesh.position.set(1.05, this.weightRaisedY, -16.8);
    this.counterweightBlockMesh.castShadow = true;
    this.group.add(this.counterweightBlockMesh);

    // Pulley bracket and rope line
    const pulleyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    pulleyGeo.rotateX(Math.PI / 2);
    this.geometries.push(pulleyGeo);
    const pulley = new THREE.Mesh(pulleyGeo, materials.metalBronze);
    pulley.position.set(1.05, this.doorClosedY + 2.85, -16.8);
    this.group.add(pulley);

    scene.add(this.group);
  }

  /**
   * Interactive wheel turning. Returns true if newly solved.
   */
  public turnWheel(id: string, dt: number): { progress: number; newlySolved: boolean } {
    let newlySolved = false;
    for (let i = 0; i < this.mechanisms.length; i++) {
      const m = this.mechanisms[i];
      if (m.id === id) {
        if (!m.solved) {
          m.progress = Math.min(1.0, m.progress + dt * 0.45);
          if (m.progress >= 1.0) {
            m.solved = true;
            newlySolved = true;
          }
        }
        if (id === 'cf_water_stele_channel') {
          const door = this.mechanisms.find(x => x.id === 'cf_counterweight_door');
          if (door) {
            door.progress = m.progress;
            door.solved = m.solved;
          }
        }
        return { progress: m.progress, newlySolved };
      }
    }
    return { progress: 0, newlySolved: false };
  }

  public markSolved(id: string): void {
    for (let i = 0; i < this.mechanisms.length; i++) {
      if (this.mechanisms[i].id === id) {
        this.mechanisms[i].solved = true;
        this.mechanisms[i].progress = 1.0;
      }
      // Solving the water channel also releases the counterweight sanctuary door
      if (id === 'cf_water_stele_channel' && this.mechanisms[i].id === 'cf_counterweight_door') {
        this.mechanisms[i].solved = true;
        this.mechanisms[i].progress = 1.0;
      }
    }
  }

  public getMechanismProgress(id: string): number {
    const m = this.mechanisms.find(x => x.id === id);
    return m ? m.progress : 0;
  }

  public isSolved(id: string): boolean {
    const m = this.mechanisms.find(x => x.id === id);
    return m ? m.solved : false;
  }

  public update(dt: number): void {
    this.elapsedSec += dt;

    for (let i = 0; i < this.mechanisms.length; i++) {
      const m = this.mechanisms[i];
      if (m.solved && m.progress < 1.0) {
        m.progress = Math.min(1.0, m.progress + dt * 0.65);
      }
    }

    const steleState = this.mechanisms[0];
    if (steleState) {
      if (this.sluiceWheelMesh) {
        this.sluiceWheelMesh.rotation.z = steleState.progress * Math.PI * 2.5;
      }
      // Water stream fades in and ripples as wheel turns
      if (this.channelWaterMat) {
        this.channelWaterMat.opacity = Math.min(0.82, steleState.progress * 0.95);
      }
      // Dynamic cascading paqcha waterfall into cistern
      if (this.waterCascadeMesh && this.cascadeWaterMat) {
        this.cascadeWaterMat.opacity = Math.min(0.88, steleState.progress * 0.98);
        const squirt = steleState.progress > 0.05 ? 1.0 : 0.001;
        this.waterCascadeMesh.scale.set(squirt, squirt, 1.0);
        this.waterCascadeMesh.position.x = 0.68 + Math.sin(this.elapsedSec * 14.0) * 0.006 * steleState.progress;
      }
      // Rising water level in stone counterweight cistern
      if (this.cisternWaterMesh && this.cisternWaterMat) {
        this.cisternWaterMesh.position.y = this.doorBaseY + 0.08 + steleState.progress * 0.52;
        this.cisternWaterMat.opacity = Math.min(0.88, 0.25 + steleState.progress * 0.62);
      }
    }

    const doorState = this.mechanisms[1];
    if (doorState) {
      // Counterweight door rises up into the stone lintel
      if (this.counterweightDoorMesh) {
        this.counterweightDoorMesh.position.y = this.doorClosedY + doorState.progress * 2.25;
      }
      // Counterweight block sinks down into the rising cistern as door rises
      if (this.counterweightBlockMesh) {
        this.counterweightBlockMesh.position.y = this.weightRaisedY - doorState.progress * 1.85;
      }
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.geometries.length; i++) {
      this.geometries[i].dispose();
    }
    for (let i = 0; i < this.materials.length; i++) {
      this.materials[i].dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.group.removeFromParent();
  }
}
