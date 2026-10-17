import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { standAt } from './terrain';

export class Foliage {
  public group = new THREE.Group();
  private trunkInstances: THREE.InstancedMesh;
  private canopyInstances: THREE.InstancedMesh;
  private grassInstances: THREE.InstancedMesh;
  private readonly TREE_COUNT = 380;
  private readonly GRASS_COUNT = 900;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Andean_Foliage';
    scene.add(this.group);

    // 1. Queñua Mountain Tree Geometries
    const trunkGeom = new THREE.CylinderGeometry(0.18, 0.42, 4.2, 6);
    trunkGeom.translate(0, 2.1, 0);

    const c1 = new THREE.ConeGeometry(2.2, 3.2, 7);
    c1.translate(0, 4.2, 0);
    const c2 = new THREE.ConeGeometry(1.6, 2.6, 7);
    c2.translate(0, 5.6, 0);
    const c3 = new THREE.ConeGeometry(1.0, 2.0, 6);
    c3.translate(0, 6.8, 0);

    const canopyGeom = mergeGeometries([c1, c2, c3]);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x483626, // Weathered Andean tree bark
      roughness: 0.88,
      metalness: 0.05,
    });

    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x2e4624, // Deep Andean high-altitude evergreen foliage
      roughness: 0.82,
      metalness: 0.02,
    });

    this.trunkInstances = new THREE.InstancedMesh(trunkGeom, trunkMat, this.TREE_COUNT);
    this.trunkInstances.castShadow = true;
    this.trunkInstances.receiveShadow = true;

    this.canopyInstances = new THREE.InstancedMesh(canopyGeom, canopyMat, this.TREE_COUNT);
    this.canopyInstances.castShadow = true;
    this.canopyInstances.receiveShadow = true;

    // 2. Instanced Ichu Mountain Grass Tufts
    const grassGeom = new THREE.PlaneGeometry(1.4, 1.2);
    grassGeom.translate(0, 0.6, 0);

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x766c3a, // Dry golden Andean ichu grass
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
      alphaTest: 0.35,
    });

    this.grassInstances = new THREE.InstancedMesh(grassGeom, grassMat, this.GRASS_COUNT);
    this.grassInstances.receiveShadow = true;

    this.populateFoliage();

    this.group.add(this.trunkInstances);
    this.group.add(this.canopyInstances);
    this.group.add(this.grassInstances);
  }

  private populateFoliage(): void {
    const dummy = new THREE.Object3D();

    // Distribute trees around the valley slopes
    let treeIdx = 0;
    for (let i = 0; i < this.TREE_COUNT; i++) {
      const angle = (i * 137.5 * Math.PI) / 180;
      const radius = 22 + Math.sqrt(i) * 18;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Keep clear of the hanging bridge & river gorge
      if (Math.abs(x) < 10) continue;
      // Keep clear of the immediate spawn area
      if (Math.hypot(x, z - 8) < 18) continue;

      const y = standAt(x, z);
      if (y < 0.6) continue; // Don't place near water edge

      dummy.position.set(x, y, z);
      dummy.rotation.y = (i * 0.73) % (Math.PI * 2);
      const s = 0.85 + ((i * 37) % 30) * 0.015;
      dummy.scale.set(s, s * (0.9 + ((i * 13) % 20) * 0.01), s);
      dummy.updateMatrix();

      this.trunkInstances.setMatrixAt(treeIdx, dummy.matrix);
      this.canopyInstances.setMatrixAt(treeIdx, dummy.matrix);
      treeIdx++;
    }
    this.trunkInstances.count = treeIdx;
    this.trunkInstances.instanceMatrix.needsUpdate = true;
    this.canopyInstances.count = treeIdx;
    this.canopyInstances.instanceMatrix.needsUpdate = true;

    // Distribute grass tufts on banks and slopes
    let grassIdx = 0;
    for (let j = 0; j < this.GRASS_COUNT; j++) {
      const angle = (j * 89.3 * Math.PI) / 180;
      const radius = 6 + Math.sqrt(j) * 11;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (Math.abs(x) < 4 && Math.abs(z) < 30) continue;

      const y = standAt(x, z);
      if (y < 0.3) continue;

      dummy.position.set(x, y, z);
      dummy.rotation.y = (j * 1.4) % Math.PI;
      const s = 0.7 + ((j * 19) % 40) * 0.015;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      this.grassInstances.setMatrixAt(grassIdx++, dummy.matrix);
    }
    this.grassInstances.count = grassIdx;
    this.grassInstances.instanceMatrix.needsUpdate = true;
  }

  public update(time: number): void {
    const wind = Math.sin(time * 1.5) * 0.02;
    this.canopyInstances.rotation.z = wind * 0.15;
  }
}
