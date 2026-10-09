import * as THREE from 'three';
import { ashlarWeathered, caveDark, ashlarLight } from './materials.js';

/**
 * CenoteCavernManager
 *
 * Implements the Subterranean Cenote Underwater Caverns & Air-Pocket Navigation
 * for Juzu (Shadow of the Tomb Raider North Star).
 *
 * Features:
 * 1. Flooded limestone tunnels and subterranean cavern dome.
 * 2. Submerged Inca temple ruins, sunken trapezoidal portal, and stone altar.
 * 3. Vaulted breathable air pocket with resting ledge and ancient oil cresset.
 * 4. Bioluminescent aquatic flora (phosphorescent emerald kelp & cyan shelf coral).
 * 5. Dynamic animated water caustics dancing on the submerged limestone.
 */
export class CenoteCavernManager {
  public group: THREE.Group;
  public airPocketBox: THREE.Box3;
  private scene: THREE.Scene;

  // Bioluminescent and atmospheric lights
  private biolumLight1: THREE.PointLight;
  private biolumLight2: THREE.PointLight;
  private airPocketLight: THREE.PointLight;

  // Animated Water Caustics Texture & Surface
  private causticsCanvas: HTMLCanvasElement;
  private causticsCtx: CanvasRenderingContext2D;
  private causticsTexture: THREE.CanvasTexture;
  private causticsMesh: THREE.Mesh;
  private causticsTime: number = 0;

  // Animated Kelp Fronds
  private kelpStems: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CenoteCavernSystem';

    // 1. Air Pocket Bounding Volume (World Coordinates: x: -6..6, y: -2.8..4.0, z: -18..-6)
    // Surface water is at y ≈ -2.74m; breathable air space extends up to +4.0m under dome
    this.airPocketBox = new THREE.Box3(
      new THREE.Vector3(-6.5, -2.85, -18.0),
      new THREE.Vector3(6.5, 4.2, -6.0)
    );

    // 2. Materials
    // 2. Materials
    const rockMat = caveDark();
    rockMat.side = THREE.DoubleSide;
    rockMat.roughness = 0.95;
    rockMat.metalness = 0.0;
    rockMat.envMapIntensity = 0.02;
    rockMat.color.setHex(0x182420); // Rich deep subterranean Andean limestone tint

    const weatheredStone = ashlarWeathered();
    const lightStone = ashlarLight();

    // 3. Submerged Limestone Cavern Tunnel (enclosing tube along Z: from z = -17 to z = 17)
    // Full cylindrical geometry deformed with craggy rock facets and vaulted air pocket dome
    const tunnelGeo = new THREE.CylinderGeometry(7.5, 8.2, 34.0, 24, 16, true);
    tunnelGeo.rotateX(Math.PI / 2); // Aligns length along Z
    const tPos = tunnelGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const vx = tPos.getX(i);
      const vy = tPos.getY(i);
      const vz = tPos.getZ(i);
      const noise = Math.sin(vx * 0.6) * Math.cos(vz * 0.45) * 0.65;
      let yOffset = noise;
      if (vz < -5.0 && vz > -17.0 && vy > 0) {
        // Natural vaulted air pocket dome ceiling arching high into the Andean limestone
        const domeRatio = (vz - -5.0) / -12.0;
        yOffset += Math.sin(domeRatio * Math.PI) * 4.2;
      }
      tPos.setY(i, vy + yOffset);
      tPos.setX(i, vx + Math.sin(vy * 0.75 + vz * 0.3) * 0.45);
    }
    tunnelGeo.computeVertexNormals();

    const tunnelMesh = new THREE.Mesh(tunnelGeo, rockMat);
    tunnelMesh.position.set(0, -3.2, 0.0);
    tunnelMesh.castShadow = true;
    tunnelMesh.receiveShadow = true;
    this.group.add(tunnelMesh);

    // Cavern Back Rock Wall sealing the subterranean cave
    const backWallGeo = new THREE.PlaneGeometry(28.0, 24.0);
    const backWall = new THREE.Mesh(backWallGeo, rockMat);
    backWall.position.set(0, 0.0, -17.0);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // Underwater teal cavern ambient fill
    const underwaterFill = new THREE.PointLight(0x0a4038, 1.8, 22.0, 1.6);
    underwaterFill.position.set(0, -3.5, 0.0);
    this.group.add(underwaterFill);

    // 4. Sunken Inca Portal Gateway (z = 2.0, y = -6.8 to -2.0)
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, -6.8, 2.0);

    // Left and Right submerged monolithic jambs
    const jambGeoL = new THREE.BoxGeometry(1.8, 4.8, 1.8);
    const jambL = new THREE.Mesh(jambGeoL, weatheredStone);
    jambL.position.set(-3.2, 2.4, 0);
    jambL.rotation.z = -0.05; // 3° inward batter
    jambL.castShadow = true;
    jambL.receiveShadow = true;
    portalGroup.add(jambL);

    const jambGeoR = new THREE.BoxGeometry(1.8, 4.8, 1.8);
    const jambR = new THREE.Mesh(jambGeoR, weatheredStone);
    jambR.position.set(3.2, 2.4, 0);
    jambR.rotation.z = 0.05;
    jambR.castShadow = true;
    jambR.receiveShadow = true;
    portalGroup.add(jambR);

    // Submerged monumental lintel
    const lintelGeo = new THREE.BoxGeometry(8.8, 1.2, 2.2);
    const lintel = new THREE.Mesh(lintelGeo, weatheredStone);
    lintel.position.set(0, 4.6, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    portalGroup.add(lintel);

    // Submerged stone threshold with drainage slots
    const sillGeo = new THREE.BoxGeometry(8.0, 0.4, 2.5);
    const sill = new THREE.Mesh(sillGeo, lightStone);
    sill.position.set(0, 0.2, 0);
    sill.castShadow = true;
    sill.receiveShadow = true;
    portalGroup.add(sill);

    this.group.add(portalGroup);

    // 5. Sunken Relic Altar & Stone Steps (z = -3.5, submerged at y = -6.8)
    const altarGroup = new THREE.Group();
    altarGroup.position.set(0, -6.8, -3.5);

    const step1 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.45, 4.2), weatheredStone);
    step1.position.y = 0.22;
    step1.castShadow = true;
    step1.receiveShadow = true;
    altarGroup.add(step1);

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.45, 3.2), weatheredStone);
    step2.position.y = 0.67;
    step2.castShadow = true;
    step2.receiveShadow = true;
    altarGroup.add(step2);

    const altarBlock = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 2.0), lightStone);
    altarBlock.position.y = 1.35;
    altarBlock.castShadow = true;
    altarBlock.receiveShadow = true;
    altarGroup.add(altarBlock);

    this.group.add(altarGroup);

    // 6. Vaulted Air Pocket Resting Shelf & Ancient Cresset (z = -12.0 to -16.0)
    // Raised dry stone resting shelf inside the dome (y = -1.6m, above water line -2.74m)
    const shelfGeo = new THREE.BoxGeometry(5.8, 0.9, 3.6);
    const shelfMesh = new THREE.Mesh(shelfGeo, weatheredStone);
    shelfMesh.position.set(0, -1.65, -14.5);
    shelfMesh.castShadow = true;
    shelfMesh.receiveShadow = true;
    this.group.add(shelfMesh);

    // Ancient Inca bronze cresset in the air pocket dome
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, -1.05, -15.5);

    const lampBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.18, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x946b2d, metalness: 0.8, roughness: 0.3 })
    );
    lampGroup.add(lampBowl);

    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa33 })
    );
    flameMesh.position.y = 0.22;
    lampGroup.add(flameMesh);

    this.airPocketLight = new THREE.PointLight(0xff9933, 1.8, 14.0, 1.8);
    this.airPocketLight.position.set(0, 0.5, 0);
    lampGroup.add(this.airPocketLight);

    this.group.add(lampGroup);

    // 7. Bioluminescent Aquatic Flora (Phosphorescent Emerald & Cyan Kelp/Coral)
    this.initBioluminescentFlora();

    // 8. Animated Water Caustics Projection
    this.initWaterCaustics();

    this.scene.add(this.group);
  }

  private initBioluminescentFlora(): void {
    const kelpMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.75,
      roughness: 0.35,
      metalness: 0.1,
    });

    const coralMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.85,
      roughness: 0.4,
      metalness: 0.15,
    });

    // Submerged Kelp Clusters flanking the tunnel anchored on the limestone bed
    const kelpPositions = [
      new THREE.Vector3(-3.2, -6.7, 1.5),
      new THREE.Vector3(3.5, -6.7, -0.5),
      new THREE.Vector3(-2.8, -6.7, -3.5),
      new THREE.Vector3(3.0, -6.7, 6.5),
      new THREE.Vector3(-3.5, -6.7, 9.0),
    ];

    for (const kp of kelpPositions) {
      const cluster = new THREE.Group();
      cluster.position.copy(kp);

      for (let k = 0; k < 4; k++) {
        const h = 2.8 + Math.random() * 1.6;
        const stemGeo = new THREE.ConeGeometry(0.09, h, 6);
        stemGeo.translate(0, h / 2, 0);
        const stem = new THREE.Mesh(stemGeo, kelpMat);
        stem.rotation.z = (Math.random() - 0.5) * 0.35;
        stem.rotation.x = (Math.random() - 0.5) * 0.35;
        cluster.add(stem);
        this.kelpStems.push(stem);
      }
      this.group.add(cluster);
    }

    // Phosphorescent Shelf Fungi on limestone tunnel walls
    const shelfGeo = new THREE.CylinderGeometry(0.75, 0.25, 0.18, 8);
    const shelf1 = new THREE.Mesh(shelfGeo, coralMat);
    shelf1.position.set(-4.5, -4.2, 2.0);
    shelf1.rotation.z = -0.4;
    this.group.add(shelf1);

    const shelf2 = new THREE.Mesh(shelfGeo, coralMat);
    shelf2.position.set(4.6, -3.8, -1.0);
    shelf2.rotation.z = 0.4;
    this.group.add(shelf2);

    // Bioluminescent Point Lights casting turquoise/emerald radiance
    this.biolumLight1 = new THREE.PointLight(0x10e6a0, 2.4, 14.0, 1.8);
    this.biolumLight1.position.set(-2.8, -4.0, 1.5);
    this.group.add(this.biolumLight1);

    this.biolumLight2 = new THREE.PointLight(0x06c8e0, 2.5, 16.0, 1.8);
    this.biolumLight2.position.set(2.8, -3.6, -2.0);
    this.group.add(this.biolumLight2);
  }

  private initWaterCaustics(): void {
    const size = 256;
    this.causticsCanvas = document.createElement('canvas');
    this.causticsCanvas.width = size;
    this.causticsCanvas.height = size;
    this.causticsCtx = this.causticsCanvas.getContext('2d')!;

    this.causticsTexture = new THREE.CanvasTexture(this.causticsCanvas);
    this.causticsTexture.wrapS = THREE.RepeatWrapping;
    this.causticsTexture.wrapT = THREE.RepeatWrapping;
    this.causticsTexture.repeat.set(4, 8);

    // Projected caustic light sheet on submerged cenote floor
    const causticMat = new THREE.MeshBasicMaterial({
      map: this.causticsTexture,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const causticGeo = new THREE.PlaneGeometry(16.0, 32.0);
    causticGeo.rotateX(-Math.PI / 2);
    this.causticsMesh = new THREE.Mesh(causticGeo, causticMat);
    this.causticsMesh.position.set(0, -6.65, 0.0);
    this.group.add(this.causticsMesh);

    this.drawCausticsFrame(0);
  }

  private causticsImgData: ImageData | null = null;

  private drawCausticsFrame(time: number): void {
    const w = this.causticsCanvas.width;
    const h = this.causticsCanvas.height;
    const ctx = this.causticsCtx;
    if (!this.causticsImgData) {
      this.causticsImgData = ctx.createImageData(w, h);
    }
    const data = this.causticsImgData.data;

    const t = time * 1.8;
    for (let y = 0; y < h; y++) {
      const ny = (y / h) * 12.0;
      for (let x = 0; x < w; x++) {
        const nx = (x / w) * 12.0;
        // Two intersecting sine wavefronts simulating surface wave refraction
        const wave1 = Math.sin(nx * 0.85 + t) * Math.cos(ny * 0.75 - t * 0.7);
        const wave2 = Math.sin(nx * 1.2 - ny * 0.9 + t * 1.2);
        const wave3 = Math.cos((nx + ny) * 1.4 - t * 0.9);
        const val = Math.pow((wave1 + wave2 + wave3 + 3.0) / 6.0, 3.2);

        const idx = (y * w + x) * 4;
        const intensity = Math.min(255, Math.floor(val * 240));
        data[idx + 0] = Math.floor(intensity * 0.45); // Soft blue-green tint
        data[idx + 1] = Math.floor(intensity * 0.95);
        data[idx + 2] = intensity;
        data[idx + 3] = intensity;
      }
    }
    ctx.putImageData(this.causticsImgData, 0, 0);
    this.causticsTexture.needsUpdate = true;
  }

  public isUnderwater(worldY: number): boolean {
    return worldY < -2.7;
  }

  public isInsideAirPocket(worldPos: THREE.Vector3): boolean {
    return this.airPocketBox.containsPoint(worldPos);
  }

  public update(dt: number, camera?: THREE.Camera): void {
    this.causticsTime += dt;
    if (this.causticsTime >= 0.1) {
      this.drawCausticsFrame(Date.now() * 0.001);
      this.causticsTime = 0;
    }

    // Gently undulate kelp stems with underwater current
    const wave = Math.sin(Date.now() * 0.0025);
    for (let i = 0; i < this.kelpStems.length; i++) {
      this.kelpStems[i].rotation.z = Math.sin(Date.now() * 0.002 + i) * 0.18;
    }

    // Gentle bioluminescent light pulsing
    if (this.biolumLight1) {
      this.biolumLight1.intensity = 2.4 + wave * 0.35;
    }
    if (this.biolumLight2) {
      this.biolumLight2.intensity = 2.6 - wave * 0.35;
    }
    if (this.airPocketLight) {
      this.airPocketLight.intensity = 3.2 + Math.sin(Date.now() * 0.008) * 0.3;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
  }
}
