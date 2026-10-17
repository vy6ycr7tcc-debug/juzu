import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class CloudForestRegion {
  public group = new THREE.Group();
  private texLoader = new THREE.TextureLoader();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_CloudForest';
    scene.add(this.group);

    // Shared PBR materials using authentic Andean stone and timber textures
    const stoneDiff = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_diff.jpg');
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;
    stoneDiff.repeat.set(2, 2);

    const stoneNor = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_nor.jpg');
    stoneNor.wrapS = stoneNor.wrapT = THREE.RepeatWrapping;
    stoneNor.repeat.set(2, 2);

    const stoneArm = this.texLoader.load('/juzu/textures/temple/sandstone_blocks_05_arm.jpg');
    stoneArm.wrapS = stoneArm.wrapT = THREE.RepeatWrapping;
    stoneArm.repeat.set(2, 2);

    const ashlarStoneMat = solid(
      new THREE.MeshStandardMaterial({
        map: stoneDiff,
        normalMap: stoneNor,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: stoneArm,
        metalness: 0.04,
        roughness: 0.82,
        color: 0x8a8475,
      })
    );

    const plankDiff = this.texLoader.load('/juzu/assets/environment-textures/environment-planks.jpeg');
    plankDiff.wrapS = plankDiff.wrapT = THREE.RepeatWrapping;
    plankDiff.repeat.set(1.5, 0.5);

    const plankNor = this.texLoader.load('/juzu/assets/environment-textures/environment-planks-normal.jpg');
    plankNor.wrapS = plankNor.wrapT = THREE.RepeatWrapping;
    plankNor.repeat.set(1.5, 0.5);

    const timberPlankMat = solid(
      new THREE.MeshStandardMaterial({
        map: plankDiff,
        normalMap: plankNor,
        normalScale: new THREE.Vector2(0.85, 0.85),
        color: 0x584432,
        roughness: 0.88,
        metalness: 0.02,
      })
    );

    const paveDiff = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_diff.jpg');
    paveDiff.wrapS = paveDiff.wrapT = THREE.RepeatWrapping;
    paveDiff.repeat.set(3, 3);

    const paveNor = this.texLoader.load('/juzu/textures/temple/red_sandstone_pavement_nor.jpg');
    paveNor.wrapS = paveNor.wrapT = THREE.RepeatWrapping;
    paveNor.repeat.set(3, 3);

    const redPavementMat = solid(
      new THREE.MeshStandardMaterial({
        map: paveDiff,
        normalMap: paveNor,
        normalScale: new THREE.Vector2(0.9, 0.9),
        color: 0x8c6d58,
        roughness: 0.84,
        metalness: 0.03,
      })
    );

    this.buildHangingBridge(timberPlankMat, ashlarStoneMat);
    this.buildIncaStele(ashlarStoneMat, redPavementMat);
    this.buildExcavatedRuins(ashlarStoneMat);
    this.buildSanctuaryMarker(redPavementMat);
  }

  private buildHangingBridge(
    plankMat: THREE.MeshStandardMaterial,
    abutmentMat: THREE.MeshStandardMaterial
  ): void {
    const bridgeGroup = new THREE.Group();

    const ropeDiff = this.texLoader.load('/juzu/assets/character-textures/character-quechua-weave.jpg');
    ropeDiff.wrapS = ropeDiff.wrapT = THREE.RepeatWrapping;
    ropeDiff.repeat.set(12, 1);

    const ropeMat = new THREE.MeshStandardMaterial({
      map: ropeDiff,
      color: 0x9e855a,
      roughness: 0.92,
      metalness: 0.0,
    });

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x9e6c38,
      metalness: 0.85,
      roughness: 0.4,
    });

    const numPlanks = 28;
    const bridgeSpan = 38;
    const zStart = -bridgeSpan / 2;

    for (let i = 0; i <= numPlanks; i++) {
      const t = i / numPlanks;
      const z = zStart + t * bridgeSpan;
      const sag = Math.sin(t * Math.PI) * 1.6;
      const y = 3.6 - sag;

      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.65), plankMat);
      plank.position.set(0, y, z);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);

      // Plank side binding ropes
      for (const side of [-1.15, 1.15]) {
        const bind = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6), ropeMat);
        bind.position.set(side, y, z);
        bridgeGroup.add(bind);
      }
    }

    // Bridge handrail ropes and massive stone abutments
    for (const side of [-1.15, 1.15]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, 4.8, zStart - 1.5),
        new THREE.Vector3(side, 3.2, 0),
        new THREE.Vector3(side, 4.8, zStart + bridgeSpan + 1.5)
      );
      const ropeGeom = new THREE.TubeGeometry(curve, 36, 0.055, 8, false);
      const ropeMesh = new THREE.Mesh(ropeGeom, ropeMat);
      ropeMesh.castShadow = true;
      bridgeGroup.add(ropeMesh);

      // Lower footway suspension cables
      const footCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, 3.7, zStart - 1.5),
        new THREE.Vector3(side, 2.0, 0),
        new THREE.Vector3(side, 3.7, zStart + bridgeSpan + 1.5)
      );
      const footRopeGeom = new THREE.TubeGeometry(footCurve, 36, 0.065, 8, false);
      const footRopeMesh = new THREE.Mesh(footRopeGeom, ropeMat);
      footRopeMesh.castShadow = true;
      bridgeGroup.add(footRopeMesh);

      // Stone anchor abutment towers at each bank
      for (const zPost of [zStart - 2.5, zStart + bridgeSpan + 2.5]) {
        const postH = standAt(side, zPost);
        const towerGroup = new THREE.Group();
        towerGroup.position.set(side * 1.4, postH, zPost);

        // Stepped base plinth
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.4), abutmentMat);
        plinth.position.y = 0.6;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        towerGroup.add(plinth);

        // Main pylon tower
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.8, 1.8), abutmentMat);
        pylon.position.y = 2.5;
        pylon.castShadow = true;
        pylon.receiveShadow = true;
        towerGroup.add(pylon);

        // Bronze anchor pin where the bridge cables tie in
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12), bronzeMat);
        pin.rotation.z = Math.PI / 2;
        pin.position.set(0, 3.6, 0);
        pin.castShadow = true;
        towerGroup.add(pin);

        bridgeGroup.add(towerGroup);
      }
    }

    this.group.add(bridgeGroup);
  }

  private buildIncaStele(
    stoneMat: THREE.MeshStandardMaterial,
    plinthMat: THREE.MeshStandardMaterial
  ): void {
    // Monumental Carved Inca Stele on the riverbank at (3.5, y, 14)
    const steleGroup = new THREE.Group();
    const groundH = standAt(3.5, 14);
    steleGroup.position.set(3.5, groundH, 14);
    steleGroup.rotation.y = -0.35;

    // 1. Two-tier stepped carved plinth
    const plinth1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.6), plinthMat);
    plinth1.position.y = 0.175;
    plinth1.castShadow = true;
    plinth1.receiveShadow = true;
    steleGroup.add(plinth1);

    const plinth2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.2), plinthMat);
    plinth2.position.y = 0.45;
    plinth2.castShadow = true;
    plinth2.receiveShadow = true;
    steleGroup.add(plinth2);

    // 2. Monolithic carved pillar (tapered)
    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.2, 0.65), stoneMat);
    stele.position.y = 2.15;
    stele.castShadow = true;
    stele.receiveShadow = true;
    steleGroup.add(stele);

    // 3. Inca Inti / Chakana stepped cross inlaid in antique gold
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a028,
      metalness: 0.88,
      roughness: 0.32,
    });

    const crossGroup = new THREE.Group();
    crossGroup.position.set(0, 2.4, 0.33);

    // Stepped Chakana relief
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.03), goldMat);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.03), goldMat);
    const centerStud = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), goldMat);
    centerStud.rotation.x = Math.PI / 2;

    crossGroup.add(barH, barV, centerStud);
    steleGroup.add(crossGroup);

    this.group.add(steleGroup);
  }

  private buildExcavatedRuins(stoneMat: THREE.MeshStandardMaterial): void {
    // Stepped Andean agricultural terrace walls (andenes) along western slope
    const ruinGroup = new THREE.Group();

    // Lower terrace wall
    const w1Y = standAt(-18, 0);
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 22), stoneMat);
    wall1.position.set(-18, w1Y + 1.4, 0);
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    ruinGroup.add(wall1);

    // Upper terrace retaining wall
    const w2Y = standAt(-24, 6);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 18), stoneMat);
    wall2.position.set(-24, w2Y + 1.6, 6);
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    ruinGroup.add(wall2);

    // Stone terrace stair flight connecting the levels
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 1.2), stoneMat);
      step.position.set(-18 + s * 1.1, w1Y + 0.3 + s * 0.45, -4 + s * 0.8);
      step.castShadow = true;
      step.receiveShadow = true;
      ruinGroup.add(step);
    }

    this.group.add(ruinGroup);
  }

  private buildSanctuaryMarker(pavementMat: THREE.MeshStandardMaterial): void {
    // Expedition Campfire / Sanctuary rest marker beside spawn at (2.2, y, 7.2)
    const campGroup = new THREE.Group();
    const gH = standAt(2.2, 7.2);
    campGroup.position.set(2.2, gH, 7.2);

    // Carved polygonal stone platform
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.3, 16), pavementMat);
    platform.position.y = 0.15;
    platform.receiveShadow = true;
    campGroup.add(platform);

    // Weathered stone hearth ring
    const hearthMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x3d3830,
        roughness: 0.92,
        metalness: 0.0,
      })
    );
    const hearthRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 16), hearthMat);
    hearthRing.rotation.x = Math.PI / 2;
    hearthRing.position.y = 0.35;
    hearthRing.castShadow = true;
    campGroup.add(hearthRing);

    // Warm embers & gentle ambient firelight
    const fireLight = new THREE.PointLight(0xff9944, 2.4, 10, 1.5);
    fireLight.position.y = 0.7;
    fireLight.castShadow = false;
    campGroup.add(fireLight);

    this.group.add(campGroup);
  }
}
