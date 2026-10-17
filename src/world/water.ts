import * as THREE from 'three/webgpu';
import { WATER_Y } from './terrain';

export class Water {
  public mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    const texLoader = new THREE.TextureLoader();
    const waterNor = texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(80, 80);

    // Realistic Andean glacial river water material
    this.material = new THREE.MeshStandardMaterial({
      color: 0x1d4d5a, // Deep clear Andean turquoise-blue river
      roughness: 0.06,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
      normalMap: waterNor,
      normalScale: new THREE.Vector2(0.45, 0.45),
    });

    const geom = new THREE.PlaneGeometry(6000, 6000, 1, 1);
    geom.rotateX(-Math.PI / 2);

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.y = WATER_Y;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  public update(dt: number, time: number): void {
    if (this.material.normalMap) {
      // Natural downhill river current flow
      this.material.normalMap.offset.x = (time * 0.03) % 1;
      this.material.normalMap.offset.y = (time * 0.018) % 1;
    }
  }
}
