import * as THREE from 'three/webgpu';
import { createIncaBlock, createIncaAshlarMaterial } from './masonry';
import { solid } from './solidity';
import { standAt } from './terrain';
import type { GrappleManager } from '../player/grapple';

import { REGIONAL_ROUTES } from './routeData';

export class RoutesManager {
  public group = new THREE.Group();

  constructor(private scene: THREE.Scene, private grapple: GrappleManager) {
    this.group.name = 'World_Traversal_Routes';
    scene.add(this.group);
    this.buildPhysicalRouteStructures();
  }

  /**
   * Spawns physical traversal structures:
   * - Stepped Inca stone staircases along sloped ascents
   * - Carved stone Apacheta waymarker cairns with quartz offerings
   * - Timber and stone launch platforms jutting over chasms
   * - Directional carved stone trail stelae
   */
  private buildPhysicalRouteStructures(): void {
    // Shared PBR materials
    const texLoader = new THREE.TextureLoader();
    const stoneMat = solid(createIncaAshlarMaterial(texLoader));

    const timberMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x42362c,
        roughness: 0.85,
        metalness: 0.02,
      })
    );

    const bronzeBadgeMat = new THREE.MeshStandardMaterial({
      color: 0xc89642,
      roughness: 0.35,
      metalness: 0.85,
    });

    const quartzMat = new THREE.MeshStandardMaterial({
      color: 0xf4f8f6,
      roughness: 0.22,
      metalness: 0.1,
    });

    for (const route of REGIONAL_ROUTES) {
      const pts = route.waypoints;

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const actualY = standAt(pt.x, pt.z);

        // 1. Waymarker Cairns (Apachetas) at significant viewpoints & path forks
        if (pt.label && i !== route.chasmIndex && i !== (route.chasmIndex ?? -99) + 1) {
          const cairnGroup = new THREE.Group();
          cairnGroup.position.set(pt.x + 2.4, actualY, pt.z + 1.8);

          // Tiered stone stack
          const baseSlab = new THREE.Mesh(createIncaBlock(1.4, 0.45, 1.4, 0.08), stoneMat);
          baseSlab.position.y = 0.22;
          baseSlab.castShadow = true;
          cairnGroup.add(baseSlab);

          const midSlab = new THREE.Mesh(createIncaBlock(1.0, 0.4, 1.0, 0.1), stoneMat);
          midSlab.position.y = 0.65;
          midSlab.rotation.y = 0.35;
          midSlab.castShadow = true;
          cairnGroup.add(midSlab);

          const topSlab = new THREE.Mesh(createIncaBlock(0.68, 0.35, 0.68, 0.12), stoneMat);
          topSlab.position.y = 1.02;
          topSlab.rotation.y = -0.22;
          topSlab.castShadow = true;
          cairnGroup.add(topSlab);

          // Carved white quartz prayer stone on top
          const quartz = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), quartzMat);
          quartz.position.y = 1.32;
          quartz.castShadow = true;
          cairnGroup.add(quartz);

          // Bronze directional trail marker medallion
          const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), bronzeBadgeMat);
          medallion.position.set(0, 0.68, 0.52);
          medallion.rotation.x = Math.PI / 2;
          cairnGroup.add(medallion);

          this.group.add(cairnGroup);
        }

        // 2. Chasm Launch Ramps & Landing Ledges (Where grapple swings take place)
        if (route.chasmIndex !== undefined) {
          // Launch Rim (point before the chasm)
          if (i === route.chasmIndex) {
            const nextPt = pts[i + 1];
            const rampGroup = new THREE.Group();
            rampGroup.position.set(pt.x, actualY, pt.z);

            const toNext = new THREE.Vector3(nextPt.x - pt.x, 0, nextPt.z - pt.z).normalize();
            rampGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toNext);

            // Megalithic cantilever stone flagstones jutting 3.5m over the void
            const launchSlab = new THREE.Mesh(createIncaBlock(3.2, 0.65, 4.2, 0.05), stoneMat);
            launchSlab.position.set(0, 0.32, 1.8);
            launchSlab.castShadow = true;
            launchSlab.receiveShadow = true;
            rampGroup.add(launchSlab);

            // Two carved stone Inca sentinel pillars framing the launch point
            for (const side of [-1.55, 1.55]) {
              const pillar = new THREE.Mesh(createIncaBlock(0.65, 2.8, 0.65, 0.06), stoneMat);
              pillar.position.set(side, 1.4, 0.8);
              pillar.castShadow = true;
              rampGroup.add(pillar);

              // Bronze serpent ring on pillar
              const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), bronzeBadgeMat);
              ring.position.set(side * 0.95, 1.8, 0.8);
              ring.rotation.y = Math.PI / 2;
              rampGroup.add(ring);
            }

            this.group.add(rampGroup);
          }

          // Landing Ledge (point after the chasm)
          if (i === route.chasmIndex + 1) {
            const prevPt = pts[i - 1];
            const landingGroup = new THREE.Group();
            landingGroup.position.set(pt.x, actualY, pt.z);

            const fromPrev = new THREE.Vector3(pt.x - prevPt.x, 0, pt.z - prevPt.z).normalize();
            landingGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fromPrev);

            // Wide receiving terrace slab
            const landingSlab = new THREE.Mesh(createIncaBlock(4.6, 0.7, 4.8, 0.05), stoneMat);
            landingSlab.position.set(0, 0.35, -1.8);
            landingSlab.castShadow = true;
            landingSlab.receiveShadow = true;
            landingGroup.add(landingSlab);

            // Weathered wooden safety posts with woven Andean hemp ropes
            for (const side of [-2.1, 2.1]) {
              const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 8), timberMat);
              post.position.set(side, 0.8, -0.6);
              post.castShadow = true;
              landingGroup.add(post);
            }

            this.group.add(landingGroup);
          }
        }

        // 3. Stepped Inca Flagstone Staircases on steep incline segments
        if (i < pts.length - 1) {
          const nextPt = pts[i + 1];
          const dy = nextPt.h - pt.h;
          const distHoriz = Math.hypot(nextPt.x - pt.x, nextPt.z - pt.z);

          // If slope is noticeable and not a chasm gap, spawn stepped Inca stone slabs
          if (Math.abs(dy) > 2.5 && i !== route.chasmIndex) {
            const stepsCount = Math.floor(Math.abs(dy) / 0.55);
            const stepDir = new THREE.Vector3(nextPt.x - pt.x, 0, nextPt.z - pt.z).normalize();
            const stepRot = Math.atan2(stepDir.x, stepDir.z);

            for (let s = 1; s <= stepsCount; s++) {
              const u = s / (stepsCount + 1);
              const sx = THREE.MathUtils.lerp(pt.x, nextPt.x, u);
              const sz = THREE.MathUtils.lerp(pt.z, nextPt.z, u);
              const sy = standAt(sx, sz);

              const step = new THREE.Mesh(createIncaBlock(2.8, 0.42, 1.1, 0.04, 1.2, s + i * 17), stoneMat);
              step.position.set(sx, sy + 0.18, sz);
              step.rotation.y = stepRot;
              step.castShadow = true;
              step.receiveShadow = true;
              this.group.add(step);
            }
          }
        }
      }
    }
  }
}
