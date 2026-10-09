import * as THREE from 'three';
import { getGlobalTerrainHeight } from './terrain.js';
import { ashlarLight, ashlarWeathered, caveDark } from './materials.js';

/**
 * CavernShelterManager
 *
 * Implements the Paititi Hidden Valley Cliff Cavern & Megalithic Rock Overhang Sanctuary.
 * Provides a physical rain shadow occlusion volume for both characters and camera,
 * preserving bone-dry interior ground and rock faces during torrential Andean mountain storms.
 */
export class CavernShelterManager {
  public group: THREE.Group;
  public shelterBox: THREE.Box3;
  public pos: THREE.Vector3;
  public floorY: number;
  private scene: THREE.Scene;

  // Interior atmospheric lantern point light
  private lanternLight: THREE.PointLight;

  constructor(scene: THREE.Scene, position: THREE.Vector3 = new THREE.Vector3(48, 0, 26)) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'PaititiCavernShelter';

    const gy = getGlobalTerrainHeight(position.x, position.z);
    this.pos = new THREE.Vector3(position.x, gy, position.z);
    this.group.position.copy(this.pos);
    this.floorY = gy;

    // 1. Shelter Bounding Box (Rain Shadow Occlusion Volume in World Coordinates)
    // Covers width 20m (x: 38 to 58), depth 14m (z: 18 to 32), height 12m (y: gy - 1 to gy + 11)
    this.shelterBox = new THREE.Box3(
      new THREE.Vector3(position.x - 10, gy - 1.0, position.z - 7.5),
      new THREE.Vector3(position.x + 10, gy + 12.0, position.z + 5.5)
    );

    // 2. Materials
    const darkMat = caveDark();
    const stoneMat = ashlarWeathered();
    const lightMat = ashlarLight();

    // Authentic dry Andean flagstone floor material (dielectric, matte, weathered)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3e3933, // Earthy dry andesite
      roughness: 0.92, // Dry matte stone, protected from rain
      metalness: 0.0,
      bumpScale: 0.03,
    });

    // 3. Dry Flagstone Floor (Embedded flush with terrain)
    const floorGeo = new THREE.BoxGeometry(13.5, 0.35, 12.0);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0.02, -0.8);
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // 4. Solid Back Cliff Rock Wall (Seals Cavern Interior at z = -6.2)
    const backWallGeo = new THREE.BoxGeometry(15.0, 9.0, 2.5);
    const backWall = new THREE.Mesh(backWallGeo, darkMat);
    backWall.position.set(0, 4.5, -6.8);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // 5. Trapezoidal Hornacina Niches in Back Wall with Inca Gold Votive Idol
    for (let i = -1; i <= 1; i++) {
      const nicheGeo = new THREE.BoxGeometry(1.6, 2.0, 0.7);
      const niche = new THREE.Mesh(nicheGeo, lightMat);
      niche.position.set(i * 3.6, 3.2, -5.8);
      niche.receiveShadow = true;
      this.group.add(niche);

      if (i === 0) {
        const idolGeo = new THREE.ConeGeometry(0.22, 0.7, 6);
        const idolMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
        const idol = new THREE.Mesh(idolGeo, idolMat);
        idol.position.set(0, 2.8, -5.6);
        this.group.add(idol);
      }
    }

    // 6. Flanking Megalithic Inca Retaining Jambs (Trapezoidal Inward Batter)
    const jambGeoL = new THREE.BoxGeometry(2.6, 8.0, 12.5);
    const jambL = new THREE.Mesh(jambGeoL, stoneMat);
    jambL.position.set(-6.8, 4.0, -0.8);
    jambL.rotation.z = -0.04;
    jambL.castShadow = true;
    jambL.receiveShadow = true;
    this.group.add(jambL);

    const jambGeoR = new THREE.BoxGeometry(2.6, 8.0, 12.5);
    const jambR = new THREE.Mesh(jambGeoR, stoneMat);
    jambR.position.set(6.8, 4.0, -0.8);
    jambR.rotation.z = 0.04;
    jambR.castShadow = true;
    jambR.receiveShadow = true;
    this.group.add(jambR);

    // 7. Arched Rock Cavern Ceiling / Crag Overhang Roof
    const archGeo = new THREE.CylinderGeometry(6.8, 7.6, 12.5, 16, 4, true, 0, Math.PI);
    archGeo.rotateZ(Math.PI / 2);
    archGeo.rotateY(Math.PI / 2);
    const posAttr = archGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const noise = Math.sin(vx * 0.7) * Math.cos(vz * 0.7) * 0.35;
      posAttr.setY(i, vy + noise);
    }
    archGeo.computeVertexNormals();

    const archMesh = new THREE.Mesh(archGeo, darkMat);
    archMesh.position.set(0, 5.2, -0.8);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    this.group.add(archMesh);

    // Cap slab above arch for total rain streak occlusion
    const capGeo = new THREE.BoxGeometry(16.0, 2.2, 13.0);
    const capMesh = new THREE.Mesh(capGeo, darkMat);
    capMesh.position.set(0, 7.8, -0.8);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    this.group.add(capMesh);

    // 8. Front Entrance Portal & Monolithic Lintel
    const pillarGeoL = new THREE.BoxGeometry(2.0, 5.8, 2.2);
    const pillarL = new THREE.Mesh(pillarGeoL, stoneMat);
    pillarL.position.set(-5.0, 2.9, 4.8);
    pillarL.castShadow = true;
    pillarL.receiveShadow = true;
    this.group.add(pillarL);

    const pillarGeoR = new THREE.BoxGeometry(2.0, 5.8, 2.2);
    const pillarR = new THREE.Mesh(pillarGeoR, stoneMat);
    pillarR.position.set(5.0, 2.9, 4.8);
    pillarR.castShadow = true;
    pillarR.receiveShadow = true;
    this.group.add(pillarR);

    // Heavy carved ashlar lintel spanning entrance mouth
    const lintelGeo = new THREE.BoxGeometry(13.2, 1.4, 2.5);
    const lintel = new THREE.Mesh(lintelGeo, stoneMat);
    lintel.position.set(0, 5.4, 4.8);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.group.add(lintel);

    // Chiseled Drainage Runnel Gutter outside threshold
    const gutterGeo = new THREE.BoxGeometry(12.5, 0.28, 0.7);
    const gutter = new THREE.Mesh(gutterGeo, lightMat);
    gutter.position.set(0, 0.12, 5.6);
    gutter.receiveShadow = true;
    this.group.add(gutter);

    // 9. Interior Sanctuary Cresset & Warm Lantern
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-3.8, 3.4, 0.5);

    const bracketGeo = new THREE.BoxGeometry(0.14, 0.8, 0.6);
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1a, metalness: 0.8, roughness: 0.4 });
    const bracket = new THREE.Mesh(bracketGeo, bracketMat);
    lampGroup.add(bracket);

    const bowlGeo = new THREE.CylinderGeometry(0.26, 0.15, 0.26, 8);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x946b2d, metalness: 0.75, roughness: 0.3 });
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    bowl.position.set(0, -0.22, 0.32);
    lampGroup.add(bowl);

    const flameGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(0, 0.0, 0.32);
    lampGroup.add(flame);

    this.lanternLight = new THREE.PointLight(0xff9933, 2.8, 14.0, 1.8);
    this.lanternLight.position.set(0, 0.1, 0.32);
    this.lanternLight.castShadow = true;
    this.lanternLight.shadow.bias = -0.002;
    lampGroup.add(this.lanternLight);

    this.group.add(lampGroup);

    this.scene.add(this.group);
  }

  public isInsideShelter(worldPos: THREE.Vector3): boolean {
    return this.shelterBox.containsPoint(worldPos);
  }

  public update(dt: number): void {
    if (this.lanternLight) {
      this.lanternLight.intensity = 2.8 + Math.sin(Date.now() * 0.007) * 0.25 + (Math.random() - 0.5) * 0.1;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
  }
}
