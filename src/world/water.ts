import * as THREE from 'three/webgpu';
import { WATER_Y } from './terrain';

export class Water {
  public mesh: THREE.Mesh;
  public rapidsMesh: THREE.Mesh;
  public gorgeMist: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;
  private foamMaterial: THREE.MeshStandardMaterial;
  private mistMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    const texLoader = new THREE.TextureLoader();
    const waterNor = texLoader.load('/juzu/textures/water_nor.png');
    waterNor.wrapS = waterNor.wrapT = THREE.RepeatWrapping;
    waterNor.repeat.set(80, 80);

    // 1. Deep Clear Andean Turquoise Glacial River Surface
    this.material = new THREE.MeshStandardMaterial({
      color: 0x1d4d5a,
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

    // 2. Turbulent Whitewater Rapids Ribbon along Urubamba Canyon Centerline
    const rapidsGeom = this.buildRiverRapidsGeometry();
    const foamTex = texLoader.load('/juzu/textures/water_nor.png');
    foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping;
    foamTex.repeat.set(18, 4);

    this.foamMaterial = new THREE.MeshStandardMaterial({
      color: 0xebf7fa,
      roughness: 0.35,
      metalness: 0.04,
      transparent: true,
      opacity: 0.44,
      normalMap: foamTex,
      normalScale: new THREE.Vector2(1.8, 1.8),
      depthWrite: false,
    });

    this.rapidsMesh = new THREE.Mesh(rapidsGeom, this.foamMaterial);
    this.rapidsMesh.position.y = WATER_Y + 0.035;
    this.rapidsMesh.receiveShadow = true;
    scene.add(this.rapidsMesh);

    // 3. Low-Altitude Urubamba Gorge Canyon Mist Plume
    const mistGeom = new THREE.PlaneGeometry(140, 26, 8, 4);
    mistGeom.rotateX(-Math.PI / 2);
    const mPos = mistGeom.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const mx = mPos.getX(i);
      const mz = mPos.getZ(i);
      mPos.setZ(i, -17.0 + Math.sin(mx * 0.018) * 6.5 + mz * 0.5);
    }
    mistGeom.computeVertexNormals();

    this.mistMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6e5e8,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.gorgeMist = new THREE.Mesh(mistGeom, this.mistMaterial);
    this.gorgeMist.position.y = WATER_Y + 1.8;
    scene.add(this.gorgeMist);
  }

  private buildRiverRapidsGeometry(): THREE.BufferGeometry {
    const xSegments = 40;
    const wSegments = 4;
    const geom = new THREE.PlaneGeometry(160, 14, xSegments, wSegments);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const wOffset = pos.getZ(i);
      const riverCenterZ = -17.0 + Math.sin(x * 0.018) * 6.5;
      pos.setZ(i, riverCenterZ + wOffset);
      const ripple = Math.sin(x * 0.45 + wOffset * 0.8) * 0.045;
      pos.setY(i, ripple);
    }
    geom.computeVertexNormals();
    return geom;
  }

  public update(dt: number, time: number): void {
    if (this.material.normalMap) {
      this.material.normalMap.offset.x = (time * 0.03) % 1;
      this.material.normalMap.offset.y = (time * 0.018) % 1;
    }
    if (this.foamMaterial.normalMap) {
      this.foamMaterial.normalMap.offset.x = (time * 0.15) % 1;
      this.foamMaterial.normalMap.offset.y = Math.sin(time * 0.8) * 0.02;
    }
    if (this.gorgeMist) {
      this.gorgeMist.position.y = WATER_Y + 1.8 + Math.sin(time * 0.25) * 0.25;
    }
  }
}
