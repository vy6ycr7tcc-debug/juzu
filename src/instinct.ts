import * as THREE from 'three';

export type InteractableType = 'mechanism' | 'climbable' | 'relic' | 'hazard';

interface RegisteredInteractable {
  object: THREE.Object3D;
  type: InteractableType;
  materials: THREE.MeshStandardMaterial[];
  originalColors: THREE.Color[];
  originalEmissives: THREE.Color[];
  originalEmissiveIntensities: number[];
  beaconMesh: THREE.Mesh | null;
  isPinged: boolean;
}

/**
 * Archaeological Survival Instincts System (Shadow of the Tomb Raider North Star)
 * Emits an expanding acoustic sonar shockwave (Key Q) revealing ancient Inca mechanisms,
 * climbable crags, and sacred relics in rich golden chiaroscuro illumination (#FFAA00).
 */
export class SurvivalInstinctSystem {
  public isActive: boolean = false;
  public timer: number = 0;
  public duration: number = 3.5;
  public maxRadius: number = 35.0;
  public currentRadius: number = 0;
  public pulseOrigin: THREE.Vector3 = new THREE.Vector3();

  private scene: THREE.Scene;
  private waveGroup: THREE.Group;
  private outerRing: THREE.Mesh;
  private innerRing: THREE.Mesh;
  private waveLight: THREE.PointLight;
  private interactables: RegisteredInteractable[] = [];
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.waveGroup = new THREE.Group();
    this.waveGroup.name = 'SurvivalInstinctWave';
    this.waveGroup.visible = false;

    // Outer acoustic shockwave ring
    const outerGeo = new THREE.RingGeometry(0.95, 1.05, 64);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.outerRing = new THREE.Mesh(outerGeo, outerMat);
    this.waveGroup.add(this.outerRing);

    // Inner resonant trailing ripple
    const innerGeo = new THREE.RingGeometry(0.75, 0.82, 48);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff7711,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.innerRing = new THREE.Mesh(innerGeo, innerMat);
    this.waveGroup.add(this.innerRing);

    // Expanding ethereal amber pulse light
    this.waveLight = new THREE.PointLight(0xffaa22, 0, 30.0, 1.6);
    this.waveLight.castShadow = false;
    this.waveGroup.add(this.waveLight);

    this.scene.add(this.waveGroup);
  }

  /**
   * Registers an interactive object, puzzle mechanism, or climbable crag to highlight during instinct pulse.
   */
  public registerInteractable(object: THREE.Object3D, type: InteractableType = 'mechanism') {
    const materials: THREE.MeshStandardMaterial[] = [];
    const originalColors: THREE.Color[] = [];
    const originalEmissives: THREE.Color[] = [];
    const originalEmissiveIntensities: number[] = [];

    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        materials.push(mat);
        originalColors.push(mat.color ? mat.color.clone() : new THREE.Color(0xffffff));
        originalEmissives.push(mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000));
        originalEmissiveIntensities.push(mat.emissiveIntensity ?? 0);
      }
    });

    // Create an ethereal vertical beacon beam above mechanisms
    let beaconMesh: THREE.Mesh | null = null;
    if (type === 'mechanism' || type === 'relic' || type === 'hazard') {
      const beaconGeo = new THREE.CylinderGeometry(0.06, 0.35, 3.5, 12, 1, true);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: type === 'hazard' ? 0xff3b10 : (type === 'relic' ? 0x22eecc : 0xffbb22),
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.set(0, 2.2, 0);
      beaconMesh.visible = false;
      object.add(beaconMesh);
    }

    this.interactables.push({
      object,
      type,
      materials,
      originalColors,
      originalEmissives,
      originalEmissiveIntensities,
      beaconMesh,
      isPinged: false,
    });
  }

  /**
   * Triggers the acoustic survival instinct pulse from the specified character origin.
   */
  public trigger(origin: THREE.Vector3) {
    this.isActive = true;
    this.timer = this.duration;
    this.currentRadius = 0.5;
    this.pulseOrigin.copy(origin);

    this.waveGroup.position.copy(origin);
    this.waveGroup.position.y += 0.25; // Hover just above terrain
    this.waveGroup.scale.set(this.currentRadius, 1.0, this.currentRadius);
    this.waveGroup.visible = true;

    // Reset pinged status on all registered items
    for (const item of this.interactables) {
      item.isPinged = false;
    }
  }

  public update(dt: number) {
    this.time += dt;

    if (!this.isActive) return;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.deactivate();
      return;
    }

    // 1. Expand acoustic wave outward (28 m/s expansion speed)
    if (this.currentRadius < this.maxRadius) {
      this.currentRadius += 28.0 * dt;
      this.waveGroup.scale.set(this.currentRadius, 1.0, this.currentRadius);

      const progress = this.currentRadius / this.maxRadius;
      const alpha = Math.max(0, 1.0 - progress);

      (this.outerRing.material as THREE.MeshBasicMaterial).opacity = alpha * 0.85;
      (this.innerRing.material as THREE.MeshBasicMaterial).opacity = alpha * 0.55;
      this.waveLight.intensity = alpha * 3.5;
    } else {
      this.waveGroup.visible = false;
    }

    // 2. Check wave collision with registered interactables
    const worldObjPos = new THREE.Vector3();
    const goldColor = new THREE.Color(0xffaa00);
    const hazardColor = new THREE.Color(0xff3b10);
    const relicColor = new THREE.Color(0x22eecc);
    const fadeRatio = Math.min(1.0, this.timer / 1.0); // Smooth fade-out in final 1.0s
    const pulseMod = 0.75 + 0.25 * Math.sin(this.time * 10.0);

    for (const item of this.interactables) {
      item.object.getWorldPosition(worldObjPos);
      const dist = worldObjPos.distanceTo(this.pulseOrigin);

      if (dist <= this.currentRadius + 2.0) {
        item.isPinged = true;
      }

      if (item.isPinged) {
        const baseIntensity = item.type === 'relic' ? 0.45 : (item.type === 'hazard' ? 2.0 : 2.4);
        const intensity = baseIntensity * pulseMod * fadeRatio;
        const pingColor = item.type === 'hazard' ? hazardColor : (item.type === 'relic' ? relicColor : goldColor);

        for (let m = 0; m < item.materials.length; m++) {
          const mat = item.materials[m];
          if (mat.emissive) {
            mat.emissive.copy(pingColor);
            mat.emissiveIntensity = intensity;
          }
        }

        if (item.beaconMesh) {
          item.beaconMesh.visible = true;
          (item.beaconMesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * pulseMod * fadeRatio;
          item.beaconMesh.rotation.y += dt * 1.5;
        }
      }
    }
  }

  private deactivate() {
    this.isActive = false;
    this.waveGroup.visible = false;

    // Restore materials to natural original states
    for (const item of this.interactables) {
      item.isPinged = false;
      for (let m = 0; m < item.materials.length; m++) {
        const mat = item.materials[m];
        if (mat.emissive && item.originalEmissives[m]) {
          mat.emissive.copy(item.originalEmissives[m]);
          mat.emissiveIntensity = item.originalEmissiveIntensities[m] ?? 0;
        }
      }
      if (item.beaconMesh) {
        item.beaconMesh.visible = false;
      }
    }
  }

  public dispose() {
    this.deactivate();
    this.scene.remove(this.waveGroup);
    this.outerRing.geometry.dispose();
    (this.outerRing.material as THREE.Material).dispose();
    this.innerRing.geometry.dispose();
    (this.innerRing.material as THREE.Material).dispose();
  }
}
