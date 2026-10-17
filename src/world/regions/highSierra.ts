import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { standAt } from '../terrain';
import { passable, solid } from '../solidity';
import { createIncaBlock, buildTrapezoidalGateway, createIncaAshlarMaterial } from '../masonry';

export class HighSierraRegion {
  public group = new THREE.Group();
  public interactables: THREE.Mesh[] = [];
  private texLoader = new THREE.TextureLoader();
  private gnomonColumn?: THREE.Mesh;
  private gateSealMat?: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_HighSierra';
    scene.add(this.group);

    // Authentic High Sierra Scanned PBR Ashlar Masonry (large_sandstone_blocks 2K)
    const ashlarMat = solid(createIncaAshlarMaterial(this.texLoader));

    const rockDiff = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_diffuse_2k.webp');
    rockDiff.colorSpace = THREE.SRGBColorSpace;
    rockDiff.anisotropy = 8;
    rockDiff.wrapS = rockDiff.wrapT = THREE.RepeatWrapping;

    const rockNor = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_nor_gl_2k.webp');
    rockNor.anisotropy = 8;
    rockNor.wrapS = rockNor.wrapT = THREE.RepeatWrapping;

    const rockRough = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_rough_2k.webp');
    rockRough.anisotropy = 8;
    rockRough.wrapS = rockRough.wrapT = THREE.RepeatWrapping;

    const rockAO = this.texLoader.load('/juzu/textures/scans/aerial_ground_rock_ao_2k.webp');
    rockAO.wrapS = rockAO.wrapT = THREE.RepeatWrapping;

    const bedrockMat = solid(
      new THREE.MeshStandardMaterial({
        map: rockDiff,
        normalMap: rockNor,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: rockRough,
        aoMap: rockAO,
        aoMapIntensity: 0.80,
        color: 0xcdc6b8,
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.03,
      })
    );

    this.buildChakanaGate(ashlarMat);
    this.buildIntihuatanaGnomon(bedrockMat, ashlarMat);
    this.buildTerracedWalls(ashlarMat);
    this.loadPhotogrammetricScans();
  }

  public alignIntihuatanaDial(): void {
    if (this.gnomonColumn) {
      this.gnomonColumn.rotation.y = 0.0;
    }
    if (this.gateSealMat) {
      this.gateSealMat.emissive.setHex(0xd4a028);
      this.gateSealMat.emissiveIntensity = 0.85;
    }
  }

  private createChakanaGeometry(scale = 0.32, depth = 0.38): THREE.BufferGeometry {
    const s = scale;
    const shape = new THREE.Shape();
    // Canonical 12-cornered Inca stepped cross (Chakana)
    shape.moveTo(-s, 3 * s);
    shape.lineTo(s, 3 * s);
    shape.lineTo(s, 2 * s);
    shape.lineTo(2 * s, 2 * s);
    shape.lineTo(2 * s, s);
    shape.lineTo(3 * s, s);
    shape.lineTo(3 * s, -s);
    shape.lineTo(2 * s, -s);
    shape.lineTo(2 * s, -2 * s);
    shape.lineTo(s, -2 * s);
    shape.lineTo(s, -3 * s);
    shape.lineTo(-s, -3 * s);
    shape.lineTo(-s, -2 * s);
    shape.lineTo(-2 * s, -2 * s);
    shape.lineTo(-2 * s, -s);
    shape.lineTo(-3 * s, -s);
    shape.lineTo(-3 * s, s);
    shape.lineTo(-2 * s, s);
    shape.lineTo(-2 * s, 2 * s);
    shape.lineTo(-s, 2 * s);
    shape.closePath();

    // Central circular aperture for the solar solstice alignment beam
    const hole = new THREE.Path();
    hole.absarc(0, 0, s * 0.72, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: s * 0.12,
      bevelThickness: s * 0.12,
    });
    geom.center();
    return geom;
  }

  private buildChakanaGate(ashlarMat: THREE.MeshStandardMaterial): void {
    const gH = standAt(120, -180);
    const gateGroup = buildTrapezoidalGateway(5.4, 2.2, 6.8, 2.2, ashlarMat);
    gateGroup.position.set(120, gH - 0.15, -180);

    // Hand-hammered Golden Chakana keystone above the lintel with central solar aperture
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a028,
      metalness: 0.90,
      roughness: 0.30,
    });
    this.gateSealMat = goldMat;

    const chakanaGeom = this.createChakanaGeometry(0.34, 0.36);
    const keystone = new THREE.Mesh(chakanaGeom, goldMat);
    keystone.position.set(0, 7.6, 1.15);
    keystone.castShadow = true;
    keystone.receiveShadow = true;
    gateGroup.add(keystone);
    this.interactables.push(keystone);

    this.group.add(gateGroup);
  }

  private buildIntihuatanaGnomon(
    bedrockMat: THREE.MeshStandardMaterial,
    ashlarMat: THREE.MeshStandardMaterial
  ): void {
    // Intihuatana ('Hitching Post of the Sun') bedrock gnomon at (120, -165)
    const gnomonGroup = new THREE.Group();
    gnomonGroup.name = 'Inca_Intihuatana_Sanctuary_Altar';
    const gH = standAt(120, -165);

    // Carved stepped bedrock tiers with Inca drafting bevels
    const tier1 = passable(new THREE.Mesh(createIncaBlock(6.4, 0.55, 6.4, 0.08, 2.0), ashlarMat));
    tier1.position.set(120, gH + 0.25, -165);
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    gnomonGroup.add(tier1);

    const tier2 = passable(new THREE.Mesh(createIncaBlock(4.4, 0.65, 4.4, 0.12, 1.8), ashlarMat));
    tier2.position.set(120, gH + 0.82, -165);
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    gnomonGroup.add(tier2);
    this.interactables.push(tier2);

    const tier3 = passable(new THREE.Mesh(createIncaBlock(2.6, 0.55, 2.6, 0.14, 1.6), bedrockMat));
    tier3.position.set(120, gH + 1.38, -165);
    tier3.castShadow = true;
    tier3.receiveShadow = true;
    gnomonGroup.add(tier3);

    // Sculpted multifaceted gnomon monolith with calibrated astronomical solar facets
    const columnGeom = new THREE.CylinderGeometry(0.38, 0.54, 2.2, 5);
    columnGeom.rotateY(0.35);
    const column = new THREE.Mesh(columnGeom, bedrockMat);
    column.position.set(120, gH + 2.55, -165);
    column.rotation.y = 0.68;
    column.castShadow = true;
    column.receiveShadow = true;
    gnomonGroup.add(column);
    this.gnomonColumn = column;
    this.interactables.push(column);

    // Bronze Solstice Calibration Ring with 4 cardinal directional solar ticks
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xc8963e,
      metalness: 0.92,
      roughness: 0.26,
    });
    const ringGroup = new THREE.Group();
    ringGroup.position.set(120, gH + 3.15, -165);

    const solsticeRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 12, 28), bronzeMat);
    solsticeRing.rotation.x = Math.PI / 2;
    solsticeRing.castShadow = true;
    ringGroup.add(solsticeRing);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.06), bronzeMat);
      tick.position.set(Math.cos(angle) * 0.58, 0, Math.sin(angle) * 0.58);
      tick.rotation.y = -angle;
      tick.castShadow = true;
      ringGroup.add(tick);
    }
    gnomonGroup.add(ringGroup);

    this.group.add(gnomonGroup);
  }

  private buildTerracedWalls(terraceMat: THREE.MeshStandardMaterial): void {
    // Concentric agricultural terrace retaining walls with central processional avenue
    const terraceGroup = new THREE.Group();

    for (let r = 0; r < 4; r++) {
      const zOffset = -195 + r * 10;
      for (const side of [-1, 1]) {
        const xCenter = 120 + side * 12.5;
        const wallH = standAt(xCenter, zOffset);
        const wall = new THREE.Mesh(createIncaBlock(16, 2.1, 1.9, 0.12, 2.0), terraceMat);
        wall.position.set(xCenter, wallH + 0.85, zOffset);
        wall.castShadow = true;
        wall.receiveShadow = true;
        terraceGroup.add(wall);
      }
    }

    this.group.add(terraceGroup);
  }

  private loadPhotogrammetricScans(): void {
    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // 1. Megalithic Cirque Escarpment Cliffs framing the High Sierra Pass (namaqualand_cliff_01)
    gltfLoader.load('/juzu/models/scans/namaqualand_cliff_01.glb', (gltf) => {
      let cliffGeom: THREE.BufferGeometry | null = null;
      let cliffMat: THREE.Material | null = null;

      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !cliffGeom) {
          const mesh = child as THREE.Mesh;
          cliffGeom = mesh.geometry.clone();
          cliffMat = mesh.material as THREE.Material;
          if (cliffMat instanceof THREE.MeshStandardMaterial) {
            cliffMat.roughness = 0.90;
            cliffMat.metalness = 0.02;
            if (cliffMat.map) {
              cliffMat.map.colorSpace = THREE.SRGBColorSpace;
              cliffMat.map.anisotropy = 8;
            }
            if (cliffMat.normalMap) {
              cliffMat.normalMap.anisotropy = 8;
              cliffMat.normalScale = new THREE.Vector2(1.3, 1.3);
            }
          }
        }
      });

      if (cliffGeom && cliffMat) {
        const cliffPlacements = [
          // Towering rear mountain massifs behind the Chakana Gate (framing the pass vista)
          { x: 104, y: standAt(104, -208) - 1.2, z: -208, sx: 2.4, sy: 2.7, sz: 2.0, ry: 0.28 },
          { x: 136, y: standAt(136, -208) - 1.2, z: -208, sx: 2.5, sy: 2.8, sz: 2.1, ry: -0.35 },
          { x: 120, y: standAt(120, -222) - 1.8, z: -222, sx: 2.8, sy: 3.0, sz: 2.3, ry: 3.14 },
          // West cirque ridge enclosing the sanctuary
          { x: 94, y: standAt(94, -172) - 0.8, z: -172, sx: 2.1, sy: 2.3, sz: 1.8, ry: 1.57 },
          { x: 90, y: standAt(90, -192) - 1.0, z: -192, sx: 2.3, sy: 2.5, sz: 1.9, ry: 1.25 },
          { x: 98, y: standAt(98, -152) - 0.8, z: -152, sx: 1.9, sy: 2.1, sz: 1.7, ry: 1.82 },
          // East cirque ridge enclosing the sanctuary
          { x: 146, y: standAt(146, -172) - 0.8, z: -172, sx: 2.1, sy: 2.3, sz: 1.8, ry: -1.57 },
          { x: 150, y: standAt(150, -192) - 1.0, z: -192, sx: 2.3, sy: 2.5, sz: 1.9, ry: -1.25 },
          { x: 142, y: standAt(142, -152) - 0.8, z: -152, sx: 1.9, sy: 2.1, sz: 1.7, ry: -1.82 },
        ];

        const cliffInstMesh = new THREE.InstancedMesh(cliffGeom, cliffMat, cliffPlacements.length);
        cliffInstMesh.name = 'HighSierra_Megalithic_Cliffs';
        cliffInstMesh.castShadow = true;
        cliffInstMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        cliffPlacements.forEach((p, idx) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.set(p.sx, p.sy, p.sz);
          dummy.rotation.set(0, p.ry, 0);
          dummy.updateMatrix();
          cliffInstMesh.setMatrixAt(idx, dummy.matrix);
        });
        cliffInstMesh.instanceMatrix.needsUpdate = true;
        this.group.add(cliffInstMesh);
      }
    });

    // 2. Granite Cliff Ledges & Outcroppings framing terraces and bedrock gnomon (namaqualand_cliff_02)
    gltfLoader.load('/juzu/models/scans/namaqualand_cliff_02.glb', (gltf) => {
      let ledgeGeom: THREE.BufferGeometry | null = null;
      let ledgeMat: THREE.Material | null = null;

      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !ledgeGeom) {
          const mesh = child as THREE.Mesh;
          ledgeGeom = mesh.geometry.clone();
          ledgeMat = mesh.material as THREE.Material;
          if (ledgeMat instanceof THREE.MeshStandardMaterial) {
            ledgeMat.roughness = 0.88;
            ledgeMat.metalness = 0.02;
            if (ledgeMat.map) {
              ledgeMat.map.colorSpace = THREE.SRGBColorSpace;
              ledgeMat.map.anisotropy = 8;
            }
            if (ledgeMat.normalMap) {
              ledgeMat.normalMap.anisotropy = 8;
              ledgeMat.normalScale = new THREE.Vector2(1.3, 1.3);
            }
          }
        }
      });

      if (ledgeGeom && ledgeMat) {
        const ledgePlacements = [
          // Natural stepped bedrock crags flanking the Intihuatana outcrop at (120, -165)
          { x: 114.5, y: standAt(114.5, -165.5) - 0.25, z: -165.5, sx: 1.15, sy: 1.25, sz: 1.1, ry: 0.65 },
          { x: 125.5, y: standAt(125.5, -164.5) - 0.25, z: -164.5, sx: 1.2, sy: 1.3, sz: 1.15, ry: -0.72 },
          { x: 120.0, y: standAt(120.0, -169.2) - 0.2, z: -169.2, sx: 1.3, sy: 1.15, sz: 1.1, ry: 3.14 },
          // Terrace shoulder buttresses
          { x: 105.0, y: standAt(105.0, -178.0) - 0.3, z: -178.0, sx: 1.3, sy: 1.35, sz: 1.2, ry: 1.2 },
          { x: 135.0, y: standAt(135.0, -178.0) - 0.3, z: -178.0, sx: 1.35, sy: 1.4, sz: 1.25, ry: -1.15 },
          { x: 106.5, y: standAt(106.5, -192.0) - 0.3, z: -192.0, sx: 1.4, sy: 1.45, sz: 1.3, ry: 0.95 },
          { x: 133.5, y: standAt(133.5, -192.0) - 0.3, z: -192.0, sx: 1.45, sy: 1.4, sz: 1.25, ry: -0.85 },
        ];

        const ledgeInst = new THREE.InstancedMesh(ledgeGeom, ledgeMat, ledgePlacements.length);
        ledgeInst.name = 'HighSierra_Granite_Ledges';
        ledgeInst.castShadow = true;
        ledgeInst.receiveShadow = true;

        const dummy = new THREE.Object3D();
        ledgePlacements.forEach((p, idx) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.set(p.sx, p.sy, p.sz);
          dummy.rotation.set(0, p.ry, 0);
          dummy.updateMatrix();
          ledgeInst.setMatrixAt(idx, dummy.matrix);
        });
        ledgeInst.instanceMatrix.needsUpdate = true;
        this.group.add(ledgeInst);
      }
    });

    // 3. Living Granite Bedrock Shelf anchoring the Intihuatana Gnomon (coast_land_rocks_02)
    gltfLoader.load('/juzu/models/scans/coast_land_rocks_02.glb', (gltf) => {
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = 0.88;
            mesh.material.metalness = 0.02;
            if (mesh.material.map) {
              mesh.material.map.colorSpace = THREE.SRGBColorSpace;
              mesh.material.map.anisotropy = 8;
            }
            if (mesh.material.normalMap) {
              mesh.material.normalMap.anisotropy = 8;
              mesh.material.normalScale = new THREE.Vector2(1.35, 1.35);
            }
          }
        }
      });
      const shelf = gltf.scene;
      const shY = standAt(120, -165);
      shelf.position.set(120, shY - 0.15, -165);
      shelf.scale.set(1.4, 1.2, 1.4);
      shelf.rotation.y = 0.42;
      this.group.add(shelf);
    });

    // 4. Authentic Scanned Ashlar Citadel Masonry: Gateway Turrets, Ramparts, and Stairs (modular_fort_01)
    gltfLoader.load('/juzu/models/scans/modular_fort_01.glb', (gltf) => {
      const fortGroup = new THREE.Group();
      fortGroup.name = 'HighSierra_Scanned_Citadel_Kit';
      this.group.add(fortGroup);

      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = 0.86;
            mesh.material.metalness = 0.02;
            if (mesh.material.map) {
              mesh.material.map.colorSpace = THREE.SRGBColorSpace;
              mesh.material.map.anisotropy = 8;
            }
            if (mesh.material.normalMap) {
              mesh.material.normalMap.anisotropy = 8;
              mesh.material.normalScale = new THREE.Vector2(1.35, 1.35);
            }
          }
        }
      });

      let towerNode: THREE.Object3D | null = null;
      let wallStraightNode: THREE.Object3D | null = null;
      let stairsNode: THREE.Object3D | null = null;

      gltf.scene.traverse((child) => {
        if (child.name === 'modular_fort_01_tower_round' && !towerNode) {
          towerNode = child;
        } else if (child.name === 'modular_fort_01_wall_thick_straight_01' && !wallStraightNode) {
          wallStraightNode = child;
        } else if (child.name === 'modular_fort_01_wall_stairs_straight_01' && !stairsNode) {
          stairsNode = child;
        }
      });

      if (towerNode && wallStraightNode) {
        // Twin flanking citadel bastions at Chakana Gate
        const towerL = (towerNode as THREE.Object3D).clone(true);
        const tyL = standAt(112.5, -181.5);
        towerL.position.set(112.5, tyL, -181.5);
        towerL.scale.set(0.60, 0.72, 0.60);
        fortGroup.add(towerL);

        const towerR = (towerNode as THREE.Object3D).clone(true);
        const tyR = standAt(127.5, -181.5);
        towerR.position.set(127.5, tyR, -181.5);
        towerR.scale.set(0.60, 0.72, 0.60);
        fortGroup.add(towerR);

        // Flanking curtain walls
        const wallL = (wallStraightNode as THREE.Object3D).clone(true);
        const wyL = standAt(107.0, -180.5);
        wallL.position.set(107.0, wyL, -180.5);
        wallL.scale.set(0.72, 0.70, 0.72);
        fortGroup.add(wallL);

        const wallR = (wallStraightNode as THREE.Object3D).clone(true);
        const wyR = standAt(133.0, -180.5);
        wallR.position.set(133.0, wyR, -180.5);
        wallR.scale.set(0.72, 0.70, 0.72);
        fortGroup.add(wallR);
      }

      if (stairsNode) {
        // Scanned processional stone stairway ascending the terraces along central axis
        for (let s = 0; s < 3; s++) {
          const sz = -186 + s * 9.5;
          const sy = standAt(120, sz);
          const stair = (stairsNode as THREE.Object3D).clone(true);
          stair.position.set(120, sy - 0.15, sz);
          stair.scale.set(0.75, 0.65, 0.75);
          stair.rotation.y = 0;
          stair.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) passable(c as THREE.Mesh);
          });
          fortGroup.add(stair);
        }
      }
    });

    // 5. Alpine Flora Scans along terrace copings and rocky margins (shrub_01 & celandine_01)
    gltfLoader.load('/juzu/models/scans/shrub_01.glb', (gltf) => {
      let shrubGeom: THREE.BufferGeometry | null = null;
      let shrubMat: THREE.Material | null = null;
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !shrubGeom) {
          const mesh = child as THREE.Mesh;
          shrubGeom = mesh.geometry.clone();
          shrubMat = mesh.material as THREE.Material;
          if (shrubMat instanceof THREE.MeshStandardMaterial && shrubMat.map) {
            shrubMat.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      });
      if (shrubGeom && shrubMat) {
        const shrubPlacements = [
          { x: 111, z: -160, s: 0.7 },
          { x: 129, z: -160, s: 0.75 },
          { x: 108, z: -172, s: 0.8 },
          { x: 132, z: -172, s: 0.85 },
          { x: 105, z: -188, s: 0.7 },
          { x: 135, z: -188, s: 0.75 },
          { x: 117, z: -168, s: 0.65 },
          { x: 123, z: -168, s: 0.65 },
        ];
        const shrubInst = new THREE.InstancedMesh(shrubGeom, shrubMat, shrubPlacements.length);
        shrubInst.castShadow = true;
        const dummy = new THREE.Object3D();
        shrubPlacements.forEach((p, idx) => {
          const y = standAt(p.x, p.z);
          dummy.position.set(p.x, y, p.z);
          dummy.scale.set(p.s, p.s, p.s);
          dummy.rotation.y = (idx * 1.37) % (Math.PI * 2);
          dummy.updateMatrix();
          shrubInst.setMatrixAt(idx, dummy.matrix);
        });
        shrubInst.instanceMatrix.needsUpdate = true;
        this.group.add(shrubInst);
      }
    });

    // 6. High-Relief Crag Pinnacles (coast_land_rocks_04.glb - 75k tris scan)
    gltfLoader.load('/juzu/models/scans/coast_land_rocks_04.glb', (gltf) => {
      let rockGeom: THREE.BufferGeometry | null = null;
      let rockMat: THREE.Material | null = null;
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !rockGeom) {
          const mesh = child as THREE.Mesh;
          rockGeom = mesh.geometry.clone();
          rockMat = mesh.material as THREE.Material;
          if (rockMat instanceof THREE.MeshStandardMaterial && rockMat.map) {
            rockMat.map.colorSpace = THREE.SRGBColorSpace;
            rockMat.map.anisotropy = 8;
          }
        }
      });
      if (rockGeom && rockMat) {
        const crags = [
          { x: 92, z: -155, s: 1.4, ry: 0.8 },
          { x: 148, z: -155, s: 1.5, ry: 2.1 },
          { x: 98, z: -195, s: 1.6, ry: -1.2 },
          { x: 142, z: -195, s: 1.4, ry: 3.0 },
        ];
        const cragInst = new THREE.InstancedMesh(rockGeom, rockMat, crags.length);
        cragInst.castShadow = true;
        cragInst.receiveShadow = true;
        const dummy = new THREE.Object3D();
        crags.forEach((c, idx) => {
          const y = standAt(c.x, c.z);
          dummy.position.set(c.x, y - 0.4, c.z);
          dummy.scale.set(c.s, c.s, c.s);
          dummy.rotation.y = c.ry;
          dummy.updateMatrix();
          cragInst.setMatrixAt(idx, dummy.matrix);
        });
        cragInst.instanceMatrix.needsUpdate = true;
        this.group.add(cragInst);
      }
    });

    // 7. Subalpine Mountain Trees with Canopy (tree_small_02.glb - 75k tris scan)
    gltfLoader.load('/juzu/models/scans/tree_small_02.glb', (gltf) => {
      const treeModel = gltf.scene;
      treeModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.map) {
            mesh.material.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      });
      const treeSpawns = [
        { x: 104, z: -152, s: 1.1, ry: 0.4 },
        { x: 136, z: -152, s: 1.0, ry: 1.9 },
        { x: 96, z: -175, s: 1.25, ry: -0.7 },
        { x: 144, z: -175, s: 1.15, ry: 2.8 },
        { x: 100, z: -202, s: 1.2, ry: 1.1 },
        { x: 140, z: -202, s: 1.3, ry: -2.3 },
      ];
      treeSpawns.forEach((ts) => {
        const treeInstance = treeModel.clone(true);
        const ty = standAt(ts.x, ts.z);
        treeInstance.position.set(ts.x, ty - 0.2, ts.z);
        treeInstance.scale.set(ts.s, ts.s, ts.s);
        treeInstance.rotation.y = ts.ry;
        this.group.add(treeInstance);
      });
    });
  }
}
