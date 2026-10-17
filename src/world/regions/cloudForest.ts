import * as THREE from 'three/webgpu';
import { standAt } from '../terrain';
import { solid } from '../solidity';

export class CloudForestRegion {
  public group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = 'Region_CloudForest';
    scene.add(this.group);
    this.buildHangingBridge();
    this.buildIncaStele();
    this.buildExcavatedRuins();
    this.buildSanctuaryMarker();
  }

  private buildHangingBridge(): void {
    // Hanging rope bridge crossing the river gorge at x=0, z=-20 to z=20
    const bridgeGroup = new THREE.Group();

    const plankMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x544030, // Weather-worn Andean timber
        roughness: 0.85,
        metalness: 0.05,
      })
    );

    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0x8a7050, // Braided ichu fiber rope
      roughness: 0.9,
      metalness: 0.0,
    });

    const numPlanks = 26;
    const bridgeSpan = 38;
    const zStart = -bridgeSpan / 2;

    for (let i = 0; i <= numPlanks; i++) {
      const t = i / numPlanks;
      const z = zStart + t * bridgeSpan;
      // Gentle catenary sag in the middle
      const sag = Math.sin(t * Math.PI) * 1.6;
      const y = 3.6 - sag;

      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.65), plankMat);
      plank.position.set(0, y, z);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }

    // Bridge handrail ropes and anchor posts
    for (const side of [-1.15, 1.15]) {
      // Main cable
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side, 4.8, zStart - 1),
        new THREE.Vector3(side, 3.2, 0),
        new THREE.Vector3(side, 4.8, zStart + bridgeSpan + 1)
      );
      const ropeGeom = new THREE.TubeGeometry(curve, 32, 0.06, 6, false);
      const ropeMesh = new THREE.Mesh(ropeGeom, ropeMat);
      ropeMesh.castShadow = true;
      bridgeGroup.add(ropeMesh);

      // Stone anchor abutments at each bank
      for (const zPost of [zStart - 1.5, zStart + bridgeSpan + 1.5]) {
        const postH = standAt(side, zPost);
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.5, 1.8), plankMat);
        post.position.set(side, postH + 1.5, zPost);
        post.castShadow = true;
        post.receiveShadow = true;
        bridgeGroup.add(post);
      }
    }

    this.group.add(bridgeGroup);
  }

  private buildIncaStele(): void {
    // Carved Inca Stele on the riverbank at (3.5, 0, 14)
    const steleGroup = new THREE.Group();
    const groundH = standAt(3.5, 14);

    const stoneMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x766d60, // Mossy Andean granite
        roughness: 0.78,
        metalness: 0.05,
      })
    );

    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 0.6), stoneMat);
    stele.position.set(3.5, groundH + 1.6, 14);
    stele.rotation.y = -0.3;
    stele.castShadow = true;
    stele.receiveShadow = true;
    steleGroup.add(stele);

    // Carved stele glyph band
    const glyphMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017, // Weathered Inca gold inlay
      roughness: 0.45,
      metalness: 0.75,
    });
    const glyphBand = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.5, 0.62), glyphMat);
    glyphBand.position.set(3.5, groundH + 2.2, 14);
    glyphBand.rotation.y = -0.3;
    steleGroup.add(glyphBand);

    this.group.add(steleGroup);
  }

  private buildExcavatedRuins(): void {
    // Archaeological excavation site with authentic stepped Inca terrace walls (andenes)
    const ruinGroup = new THREE.Group();
    const stoneMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x6e685a,
        roughness: 0.85,
        metalness: 0.05,
      })
    );

    // Terraced hillside perimeter stone walls along west slope (x=-18)
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 16), stoneMat);
    const w1Y = standAt(-18, 0);
    wall1.position.set(-18, w1Y + 1.2, 0);
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    ruinGroup.add(wall1);

    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 1.8), stoneMat);
    const w2Y = standAt(-22, 8);
    wall2.position.set(-22, w2Y + 1.0, 8);
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    ruinGroup.add(wall2);

    this.group.add(ruinGroup);
  }

  private buildSanctuaryMarker(): void {
    // Campfire / Sanctuary rest marker at (0, 0, 7) near spawn
    const campGroup = new THREE.Group();
    const gH = standAt(0, 7);

    const stoneRingMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x4d4942,
        roughness: 0.88,
        metalness: 0.0,
      })
    );

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.35, 12), stoneRingMat);
    ring.position.set(0, gH + 0.17, 7);
    ring.receiveShadow = true;
    campGroup.add(ring);

    // Warm sanctuary flame light
    const fireLight = new THREE.PointLight(0xff9944, 2.2, 10, 1.5);
    fireLight.position.set(0, gH + 0.7, 7);
    fireLight.castShadow = false;
    campGroup.add(fireLight);

    this.group.add(campGroup);
  }
}
