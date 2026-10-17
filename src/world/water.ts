import * as THREE from 'three/webgpu';
import { WATER_Y } from './terrain';

export class Water {
  public mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    const texLoader = new THREE.TextureLoader();
    const rippleNor = texLoader.load('/juzu/assets/environment-textures/environment-planks-normal.jpg');
    rippleNor.wrapS = rippleNor.wrapT = THREE.RepeatWrapping;
    rippleNor.repeat.set(120, 120);

    // Realistic alpine water material
    this.material = new THREE.MeshStandardMaterial({
      color: 0x224a5a, // Deep clear alpine blue-green
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.88,
      normalMap: rippleNor,
      normalScale: new THREE.Vector2(0.35, 0.35),
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
      this.material.normalMap.offset.x = (time * 0.04) % 1;
      this.material.normalMap.offset.y = (time * 0.02) % 1;
    }
  }
}
