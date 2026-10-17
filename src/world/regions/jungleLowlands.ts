import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class JungleLowlandsRegion {
  public group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_JungleLowlands';
    scene.add(this.group);
    this.buildSerpentArches();
    this.buildSubmergedPassage();
  }

  private buildSerpentArches(): void {
    // Carved limestone serpent arches rising from deep jungle at (-180, 140)
    const archGroup = new THREE.Group();
    const gH = standAt(-180, 140);

    const jungleStoneMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x4a5442, // Heavy mossy limestone reclaimed by rainforest
        roughness: 0.92,
        metalness: 0.05,
      })
    );

    // Succession of 3 serpent arches along canyon
    for (let i = 0; i < 3; i++) {
      const z = 130 + i * 16;
      const h = standAt(-180, z);

      const left = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.5, 1.6), jungleStoneMat);
      left.position.set(-186, h + 3.25, z);
      left.castShadow = true;
      left.receiveShadow = true;
      archGroup.add(left);

      const right = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.5, 1.6), jungleStoneMat);
      right.position.set(-174, h + 3.25, z);
      right.castShadow = true;
      right.receiveShadow = true;
      archGroup.add(right);

      const top = new THREE.Mesh(new THREE.BoxGeometry(14, 1.8, 1.8), jungleStoneMat);
      top.position.set(-180, h + 6.8, z);
      top.castShadow = true;
      archGroup.add(top);
    }

    this.group.add(archGroup);
  }

  private buildSubmergedPassage(): void {
    // Cenote passage leading into submerged stone chamber
    const cenoteGroup = new THREE.Group();
    const gH = standAt(-180, 175);

    const wetStoneMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x363d35,
        roughness: 0.65,
        metalness: 0.1,
      })
    );

    const basinRim = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 9.5, 2.2, 14, 1, true),
      wetStoneMat
    );
    basinRim.position.set(-180, gH + 1.1, 175);
    basinRim.castShadow = true;
    basinRim.receiveShadow = true;
    cenoteGroup.add(basinRim);

    this.group.add(cenoteGroup);
  }
}
