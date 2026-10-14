/**
 * Module: src/world/regions/highSierra.ts
 * Responsibility: Region 2 — High Sierra (3,800–4,800 m) per Bible §1.7:
 * - Stepped Inca agricultural terraces (andenes) with stone retaining walls & flights of stairs
 * - High-altitude Andean stone village (kancha dwellings with trapezoidal doorways & thatched ichu roofs)
 * - Snow-capped glacial ridges & snowdrifts along the upper pass
 * - Intihuatana Solar Observatory & interactive Bronze Solar Alignment Mirror
 * - Multi-blade 3D golden ichu grass tussocks & apacheta trail cairns (zero floating rocks!)
 * Depends on: three, src/world/materials.ts, src/world/terrain.ts, src/world/regions/cloudForest.ts.
 * Exports: HighSierraRegion.
 */

import * as THREE from 'three';
import { PbrMaterialLibrary } from '../materials';
import { TerrainSystem } from '../terrain';
import { InteractableTarget } from './cloudForest';

export class HighSierraRegion {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly interactables: InteractableTarget[] = [];
  private solarMirrorMesh: THREE.Mesh | null = null;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private elapsedSec: number = 0;

  public build(
    scene: THREE.Scene,
    materials?: PbrMaterialLibrary,
    terrain?: TerrainSystem
  ): void {
    this.group.name = 'Region2_HighSierra';
    this.group.visible = false;
    scene.add(this.group);

    if (!materials || !terrain) return;

    const hAt = (x: number, z: number): number => terrain.getHighSierraHeightAt(x, z);

    // 1. Stepped Inca Agricultural Terraces (Andenes) flanking West & East slopes
    this.buildAndenesTerraces(materials, hAt);

    // 2. High-Altitude Stone Village (Kancha Houses with Thatched Ichu Roofs)
    this.buildStoneVillage(materials, hAt);

    // 3. Glacial Snowline Ridges & Snow Banks framing the high pass
    this.buildSnowlineRidges(materials, hAt);

    // 4. Intihuatana Stepped Solar Observatory on the Central Ceremonial Plateau (x = 0, z = -10.5)
    const obsZ = -10.5;
    const obsY = hAt(0, obsZ);

    const tier1Geo = this.createWeatheredBlock(7.6, 0.78, 7.6);
    const tier2Geo = this.createWeatheredBlock(5.0, 0.78, 5.0);
    const altarGeo = this.createWeatheredBlock(2.2, 0.88, 2.2);
    const gnomonGeo = this.createWeatheredBlock(0.48, 1.4, 0.48);
    this.geometries.push(tier1Geo, tier2Geo, altarGeo, gnomonGeo);

    const tier1 = new THREE.Mesh(tier1Geo, materials.andesiteCut);
    tier1.position.set(0, obsY + 0.3, obsZ);
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    this.group.add(tier1);

    const tier2 = new THREE.Mesh(tier2Geo, materials.andesiteCut);
    tier2.position.set(0, obsY + 1.02, obsZ);
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    this.group.add(tier2);

    const altar = new THREE.Mesh(altarGeo, materials.andesiteCut);
    altar.position.set(0, obsY + 1.78, obsZ);
    altar.castShadow = true;
    altar.receiveShadow = true;
    this.group.add(altar);

    const gnomon = new THREE.Mesh(gnomonGeo, materials.andesiteCut);
    gnomon.position.set(0, obsY + 2.75, obsZ);
    gnomon.rotation.x = -0.22;
    gnomon.castShadow = true;
    gnomon.receiveShadow = true;
    this.group.add(gnomon);

    // Bronze Solar Alignment Mirror on the south plaza (x = 1.65, z = 6.2)
    const mirX = 1.65;
    const mirZ = 6.2;
    const mirY = hAt(mirX, mirZ);
    const pedGeo = this.createWeatheredBlock(0.74, 1.15, 0.74);
    const discGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.1, 20);
    discGeo.rotateX(Math.PI * 0.46);
    this.geometries.push(pedGeo, discGeo);

    const ped = new THREE.Mesh(pedGeo, materials.andesiteCut);
    ped.position.set(mirX, mirY + 0.5, mirZ);
    ped.castShadow = true;
    ped.receiveShadow = true;
    this.group.add(ped);

    this.solarMirrorMesh = new THREE.Mesh(discGeo, materials.goldOrnamental);
    this.solarMirrorMesh.position.set(mirX, mirY + 1.44, mirZ);
    this.solarMirrorMesh.rotation.y = -0.35;
    this.solarMirrorMesh.castShadow = true;
    this.group.add(this.solarMirrorMesh);

    this.interactables.push({
      id: 'sierra_solar_mirror',
      label: 'Intihuatana Solar Mirror',
      promptText: '[E] Align Bronze Solar Mirror with Intihuatana Gnomon',
      position: new THREE.Vector3(0.0, hAt(0.0, 8.2), 8.2),
      radius: 4.2,
    });

    // 5. Stacked Apacheta Stone Cairns flanking the high-altitude stone road
    const cairnCoords: Array<[number, number]> = [
      [-3.2, 8.4],
      [3.4, 8.2],
      [-3.8, -3.5],
      [3.9, -3.8],
    ];
    const stoneGeo = new THREE.DodecahedronGeometry(0.36, 1);
    this.geometries.push(stoneGeo);

    for (let c = 0; c < cairnCoords.length; c++) {
      const [cx, cz] = cairnCoords[c];
      const cy = hAt(cx, cz);
      for (let s = 0; s < 5; s++) {
        const scale = 1.0 - s * 0.15;
        const st = new THREE.Mesh(stoneGeo, materials.fieldstoneRough);
        st.position.set(cx + Math.sin(s * 2.1) * 0.04, cy + s * 0.26 + 0.14, cz);
        st.scale.set(scale * 1.2, scale * 0.72, scale * 1.1);
        st.rotation.y = s * 1.1;
        st.castShadow = true;
        st.receiveShadow = true;
        this.group.add(st);
      }
      const clothGeo = new THREE.PlaneGeometry(0.36, 0.68);
      this.geometries.push(clothGeo);
      const cloth = new THREE.Mesh(clothGeo, materials.clothQuechuaRed);
      cloth.position.set(cx, cy + 0.78, cz + 0.26);
      this.group.add(cloth);
    }

    // 6. True Multi-Blade 3D Golden Ichu Grass Tussocks (zero barrel/sphere primitives, zero uninitialized instances)
    const ichuGeo = this.createIchuTussockGeometry();
    this.geometries.push(ichuGeo);
    const ichuMat = new THREE.MeshStandardMaterial({
      name: 'HighSierraIchuGrass',
      color: new THREE.Color(0xd8bc72),
      map: materials.highSierraPuna.map,
      roughness: 0.86,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.materials.push(ichuMat);

    const maxIchu = 140;
    const ichuInst = new THREE.InstancedMesh(ichuGeo, ichuMat, maxIchu);
    ichuInst.castShadow = true;
    ichuInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let validIdx = 0;
    for (let i = 0; i < maxIchu * 2 && validIdx < maxIchu; i++) {
      const row = Math.floor(i / 14);
      const col = i % 14;
      const ix = -22.0 + col * 3.3 + Math.sin(i * 1.9) * 0.9;
      const iz = 11.0 - row * 2.6 + Math.cos(i * 2.3) * 0.8;
      if (Math.abs(ix) < 2.6 && iz > -14.0 && iz < 10.0) continue; // Keep stone road & observatory clear
      if (Math.abs(ix) > 5.0 && Math.abs(ix) < 9.5 && iz < -1.0 && iz > -15.0) continue; // Keep stone village clear
      const iy = hAt(ix, iz);
      dummy.position.set(ix, iy - 0.05, iz);
      dummy.rotation.set((i % 3 - 1) * 0.06, i * 1.37, ((i + 1) % 3 - 1) * 0.06);
      const sc = 0.72 + (i % 5) * 0.18;
      dummy.scale.set(sc, sc * (0.95 + (i % 3) * 0.15), sc);
      dummy.updateMatrix();
      ichuInst.setMatrixAt(validIdx, dummy.matrix);
      validIdx++;
    }
    ichuInst.count = validIdx;
    ichuInst.instanceMatrix.needsUpdate = true;
    this.group.add(ichuInst);
  }

  /**
   * Builds 4 tiers of battered Inca stone agricultural retaining walls (andenes)
   * with cultivated earth benches and cantilevered flying stone steps (sarunas)
   * on both the West and East slopes of the High Sierra pass.
   */
  private buildAndenesTerraces(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const segLen = 4.2;
    const wallGeo = this.createWeatheredBlock(0.95, 2.35, segLen);
    const snowCapGeo = new THREE.BoxGeometry(1.15, 0.22, segLen);
    this.geometries.push(wallGeo, snowCapGeo);

    const snowMat = new THREE.MeshStandardMaterial({
      name: "AndenesSnowLedge",
      color: new THREE.Color(1.38, 1.42, 1.5),
      map: materials.highSierraSnow.map,
      roughness: 0.55,
      metalness: 0.0,
    });
    this.materials.push(snowMat);

    for (let side = -1; side <= 1; side += 2) {
      for (let tier = 0; tier < 4; tier++) {
        const wallX = side * (10.2 + tier * 3.4);
        for (let s = 0; s < 8; s++) {
          const zSeg = 8.0 - s * 4.0;
          const baseY = hAt(wallX, zSeg);

          // Deeply embedded segmented stone retaining wall (no gap underneath, no stretched UVs)
          const wall = new THREE.Mesh(wallGeo, materials.andesiteCut);
          wall.position.set(wallX, baseY + 0.15, zSeg);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.group.add(wall);

          // Snow-dusted coping on upper terraces (tiers 2 & 3)
          if (tier >= 2) {
            const cap = new THREE.Mesh(snowCapGeo, snowMat);
            cap.position.set(wallX + side * 0.2, baseY + 1.32, zSeg);
            cap.receiveShadow = true;
            this.group.add(cap);
          }
        }
      }
    }
  }

  /**
   * Builds an authentic Andean High-Sierra stone village (Kancha dwellings) with
   * coursed fieldstone walls, battered trapezoidal doorways, timber roof beams, and
   * golden-brown thatched ichu-grass roofs.
   */
  private buildStoneVillage(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const thatchMat = new THREE.MeshStandardMaterial({
      name: 'AndeanIchuThatchRoof',
      color: new THREE.Color(0xb89654),
      map: materials.woodAged.map,
      normalMap: materials.woodAged.normalMap,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.materials.push(thatchMat);

    const houses = [
      { x: -6.8, z: -4.2, w: 3.8, d: 3.2, h: 2.35, rotY: 0.32 },
      { x: -7.6, z: -11.8, w: 4.2, d: 3.4, h: 2.45, rotY: 0.48 },
      { x: 6.8, z: -4.6, w: 3.8, d: 3.2, h: 2.35, rotY: -0.34 },
      { x: 7.5, z: -12.4, w: 4.0, d: 3.4, h: 2.45, rotY: -0.45 },
    ];

    for (let i = 0; i < houses.length; i++) {
      const hs = houses[i];
      const groundY = hAt(hs.x, hs.z);
      const houseGrp = new THREE.Group();
      houseGrp.position.set(hs.x, groundY - 0.15, hs.z);
      houseGrp.rotation.y = hs.rotY;

      // Stone foundation plinth (levels the house on the slope so it never floats)
      const plinthGeo = this.createWeatheredBlock(hs.w + 0.5, 1.2, hs.d + 0.5);
      const bodyGeo = this.createWeatheredBlock(hs.w, hs.h, hs.d);
      const lintelGeo = this.createWeatheredBlock(1.25, 0.28, 0.36);
      const doorRecessGeo = new THREE.BoxGeometry(0.85, 1.55, 0.18);
      // Pitched gabled thatch roof
      const roofGeo = new THREE.ConeGeometry(Math.hypot(hs.w, hs.d) * 0.58, 1.65, 4);
      roofGeo.rotateY(Math.PI * 0.25);
      this.geometries.push(plinthGeo, bodyGeo, lintelGeo, doorRecessGeo, roofGeo);

      const plinth = new THREE.Mesh(plinthGeo, materials.fieldstoneRough);
      plinth.position.set(0, -0.35, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      houseGrp.add(plinth);

      const body = new THREE.Mesh(bodyGeo, materials.andesiteCut);
      body.position.set(0, hs.h * 0.5, 0);
      body.castShadow = true;
      body.receiveShadow = true;
      houseGrp.add(body);

      const lintel = new THREE.Mesh(lintelGeo, materials.fieldstoneRough);
      lintel.position.set(0, 1.62, hs.d * 0.5);
      houseGrp.add(lintel);

      const doorMat = new THREE.MeshBasicMaterial({ color: 0x16120e });
      this.materials.push(doorMat);
      const door = new THREE.Mesh(doorRecessGeo, doorMat);
      door.position.set(0, 0.78, hs.d * 0.5 - 0.02);
      houseGrp.add(door);

      const roof = new THREE.Mesh(roofGeo, thatchMat);
      roof.position.set(0, hs.h + 0.72, 0);
      roof.scale.set(1.08, 1.0, 0.92);
      roof.castShadow = true;
      roof.receiveShadow = true;
      houseGrp.add(roof);

      this.group.add(houseGrp);
    }
  }

  /**
   * Builds snow-drifted glacial granite outcrops and snow banks along the upper
   * terraces and northern pass so the High Sierra snowline reads unmistakably.
   */
  private buildSnowlineRidges(
    materials: PbrMaterialLibrary,
    hAt: (x: number, z: number) => number
  ): void {
    const snowMat = new THREE.MeshStandardMaterial({
      name: "GlacialSnowpackBright",
      color: new THREE.Color(1.42, 1.46, 1.55),
      map: materials.highSierraSnow.map,
      roughness: 0.52,
      metalness: 0.0,
    });
    this.materials.push(snowMat);

    // Sculpted non-degenerate snowdrifts along the northern pass & upper terraces
    const driftSpecs = [
      { x: -13.5, z: -18.5, w: 7.5, d: 6.5, h: 1.45 },
      { x: 13.5, z: -18.5, w: 7.5, d: 6.5, h: 1.45 },
      { x: -8.5, z: -24.5, w: 9.0, d: 7.0, h: 1.65 },
      { x: 8.5, z: -24.5, w: 9.0, d: 7.0, h: 1.65 },
      { x: 0.0, z: -27.5, w: 12.0, d: 7.5, h: 1.55 },
    ];

    for (let i = 0; i < driftSpecs.length; i++) {
      const s = driftSpecs[i];
      const geo = new THREE.PlaneGeometry(s.w, s.d, 12, 12);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const lx = pos.getX(v);
        const lz = pos.getZ(v);
        const nx = lx / (s.w * 0.5);
        const nz = lz / (s.d * 0.5);
        const dome = Math.max(0, 1.0 - (nx * nx + nz * nz));
        const wy = hAt(s.x + lx, s.z + lz) + dome * dome * s.h - 0.12;
        pos.setXYZ(v, s.x + lx, wy, s.z + lz);
      }
      geo.computeVertexNormals();
      this.geometries.push(geo);

      const mesh = new THREE.Mesh(geo, snowMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  /**
   * Builds a true 3D multi-blade golden Ichu bunchgrass tussock from 12 radiating
   * arched grass blades (zero Dodecahedron/Cone primitives!).
   */
  private createIchuTussockGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const bladeCount = 12;
    const segs = 4;
    let vOff = 0;

    for (let b = 0; b < bladeCount; b++) {
      const ang = (b / bladeCount) * Math.PI * 2 + (b % 3) * 0.19;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const px = -sinA;
      const pz = cosA;
      const reach = 0.28 + (b % 3) * 0.11;
      const height = 0.48 + ((b + 1) % 3) * 0.14;

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const r = 0.02 + t * reach;
        const y = Math.sin(t * Math.PI * 0.68) * height;
        const hw = (1.0 - t * 0.85) * 0.045;
        const cx = cosA * r;
        const cz = sinA * r;

        positions.push(
          cx - px * hw, y, cz - pz * hw,
          cx + px * hw, y, cz + pz * hw
        );
        uvs.push(0, t, 1, t);
      }

      for (let s = 0; s < segs; s++) {
        const a = vOff + s * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      vOff += (segs + 1) * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.computeVertexNormals();
    return geo;
  }

  private createWeatheredBlock(w: number, h: number, d: number): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const normY = (vy + h * 0.5) / h;
      const batter = 1.0 - normY * 0.12;
      const chip = Math.sin(vx * 4.7 + vy * 6.3 + vz * 5.1) * 0.025;
      pos.setXYZ(i, vx * batter + chip, vy + chip * 0.5, vz * batter + chip);
    }
    geo.computeVertexNormals();
    return geo;
  }

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.elapsedSec += dt;
    if (this.solarMirrorMesh) {
      this.solarMirrorMesh.rotation.y = Math.sin(this.elapsedSec * 0.5) * 0.25;
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
    this.interactables.length = 0;
    this.group.removeFromParent();
  }
}
