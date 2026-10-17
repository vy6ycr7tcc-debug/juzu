import * as THREE from 'three/webgpu';
import { solid } from '../world/solidity';

export interface GrapplePoint {
  id: string;
  name: string;
  pos: THREE.Vector3; // 3D world position of the overhead anchor ring
  beamStart?: THREE.Vector3; // Base of the cantilever beam holding the ring
  radius: number; // Max attach distance (typically 16 - 20m)
  mesh?: THREE.Group;
  ringMesh?: THREE.Mesh;
}

export class GrappleManager {
  public group = new THREE.Group();
  public points: GrapplePoint[] = [];
  public activePoint: GrapplePoint | null = null;
  public attached = false;

  // Swing physics state
  public ropeLength = 10.0;
  public swingVel = new THREE.Vector3();
  public swingAngle = 0; // Pitch angle along swing direction
  public swingAxis = new THREE.Vector3(1, 0, 0); // Perpendicular to swing plane
  public swingForward = new THREE.Vector3(0, 0, -1);
  public currentAnchorPos = new THREE.Vector3();

  // Dynamic 3D Rope Mesh
  private ropeMesh: THREE.Mesh;
  private ropeGeom: THREE.CylinderGeometry;
  private ropeMat: THREE.MeshStandardMaterial;

  constructor(private scene: THREE.Scene) {
    this.group.name = 'Grapple_System';
    scene.add(this.group);

    // Realistic braided hemp cordage material (WebGL2 and WebGPU compatible)
    const ropeTex = new THREE.TextureLoader().load(
      '/juzu/assets/environment-textures/woven_cloth_albedo.jpg'
    );
    ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping;
    ropeTex.repeat.set(1, 16);

    this.ropeMat = new THREE.MeshStandardMaterial({
      map: ropeTex,
      color: 0x9a8060,
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: ropeTex,
      bumpScale: 0.015,
      side: THREE.DoubleSide,
    });

    // Cylinder with 12 segments for a smooth, high-fidelity catenary rope
    this.ropeGeom = new THREE.CylinderGeometry(0.018, 0.022, 1, 8, 1, true);
    this.ropeGeom.translate(0, 0.5, 0); // Pivot at the top/hand
    this.ropeMesh = new THREE.Mesh(this.ropeGeom, this.ropeMat);
    this.ropeMesh.castShadow = true;
    this.ropeMesh.visible = false;
    this.group.add(this.ropeMesh);

    this.initDefaultAnchors();
  }

  /**
   * Spawns authentic Inca bronze anchor rings with carved stone/wood cantilever beams
   */
  private initDefaultAnchors(): void {
    const anchors: Array<{
      id: string;
      name: string;
      pos: THREE.Vector3;
      beamStart: THREE.Vector3;
    }> = [
      // 1. Cloud Forest to High Sierra (Huayna Gorge Chasm Crossing)
      {
        id: 'hs_chasm',
        name: 'Huayna Gorge Sun Ring',
        pos: new THREE.Vector3(73.5, 27.0, -114.0),
        beamStart: new THREE.Vector3(73.5, 30.5, -106.0),
      },
      // 2. Cloud Forest Riverbed Gorge Fissure (Descent to Jungle Lowlands)
      {
        id: 'jl_fissure',
        name: 'Urubamba Fissure Ring',
        pos: new THREE.Vector3(-92.0, 14.8, 43.5),
        beamStart: new THREE.Vector3(-85.0, 17.5, 43.5),
      },
      // 3. High Sierra to Paititi High Cordillera Ridge (Wind-Gap Abyss)
      {
        id: 'pt_abyss',
        name: 'Cordillera Wind-Gap Ring',
        pos: new THREE.Vector3(174.0, 39.5, -2.0),
        beamStart: new THREE.Vector3(174.0, 43.0, -9.0),
      },
      // 4. Cloud Forest Urubamba Gorge Lower Falls (Secret Cavern Crossing)
      {
        id: 'cf_gorge_falls',
        name: 'Urubamba Lower Falls Ring',
        pos: new THREE.Vector3(-18.5, 14.2, -18.0),
        beamStart: new THREE.Vector3(-18.5, 17.0, -12.0),
      },
      // 5. Paititi to Jungle Lowlands Southern Canyon (Cascades Traverse)
      {
        id: 'pt_cascades',
        name: 'Southern Cascades Ring',
        pos: new THREE.Vector3(20.0, 24.5, 172.0),
        beamStart: new THREE.Vector3(26.0, 27.5, 172.0),
      },
    ];

    for (const a of anchors) {
      this.addAnchor(a.id, a.name, a.pos, a.beamStart);
    }
  }

  public addAnchor(
    id: string,
    name: string,
    pos: THREE.Vector3,
    beamStart: THREE.Vector3,
    radius = 22.0
  ): GrapplePoint {
    const anchorGroup = new THREE.Group();
    anchorGroup.name = `GrappleAnchor_${id}`;

    // Bronze PBR material for the Inca Sun Anchor Ring
    const bronzeMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0xc89642,
        roughness: 0.38,
        metalness: 0.88,
        emissive: 0x3d2808,
        emissiveIntensity: 0.35,
      })
    );

    // Weathered Andean Cantilever Timber/Stone Outrigger Beam
    const woodMat = solid(
      new THREE.MeshStandardMaterial({
        color: 0x483c30,
        roughness: 0.85,
        metalness: 0.05,
      })
    );

    // Beam connecting beamStart to pos
    const beamDir = new THREE.Vector3().subVectors(pos, beamStart);
    const beamLen = beamDir.length();
    const beamGeom = new THREE.BoxGeometry(0.55, 0.55, beamLen);
    const beamMesh = new THREE.Mesh(beamGeom, woodMat);
    beamMesh.position.copy(beamStart).addScaledVector(beamDir, 0.5);
    beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), beamDir.clone().normalize());
    beamMesh.castShadow = true;
    beamMesh.receiveShadow = true;
    anchorGroup.add(beamMesh);

    // Reinforced Bronze Mounting Collar & Fastening Bands
    const collarGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.85, 12);
    collarGeom.rotateZ(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeom, bronzeMat);
    collarMesh.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));
    collarMesh.castShadow = true;
    anchorGroup.add(collarMesh);

    // Heavy Cast-Bronze Inca Solar Ring (Diameter ~0.85m)
    const ringGeom = new THREE.TorusGeometry(0.44, 0.075, 12, 24);
    ringGeom.rotateY(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeom, bronzeMat);
    ringMesh.position.copy(pos);
    ringMesh.castShadow = true;
    ringMesh.receiveShadow = true;
    anchorGroup.add(ringMesh);

    // Radiating Inca Solar Rays around the rim
    const rayMat = new THREE.MeshStandardMaterial({
      color: 0xdfab4d,
      roughness: 0.3,
      metalness: 0.9,
    });
    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2;
      const rayGeom = new THREE.ConeGeometry(0.045, 0.22, 5);
      rayGeom.rotateZ(angle - Math.PI / 2);
      const ray = new THREE.Mesh(rayGeom, rayMat);
      ray.position.set(
        pos.x,
        pos.y + Math.sin(angle) * 0.52,
        pos.z + Math.cos(angle) * 0.52
      );
      anchorGroup.add(ray);
    }

    // Weathered Hemp Anchor Tether dangling slightly through the ring
    const tetherGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.65, 8);
    const tetherMesh = new THREE.Mesh(tetherGeom, this.ropeMat);
    tetherMesh.position.set(pos.x, pos.y - 0.35, pos.z);
    anchorGroup.add(tetherMesh);

    this.group.add(anchorGroup);

    const pt: GrapplePoint = {
      id,
      name,
      pos: pos.clone(),
      beamStart: beamStart.clone(),
      radius,
      mesh: anchorGroup,
      ringMesh,
    };
    this.points.push(pt);
    return pt;
  }

  /**
   * Finds the best reachable grapple anchor in front of the player
   */
  public findReachableAnchor(
    playerPos: THREE.Vector3,
    camYaw: number,
    isAirborne: boolean
  ): { point: GrapplePoint; dist: number; forwardAngle: number } | null {
    let bestPoint: GrapplePoint | null = null;
    let minScore = Infinity;
    let bestDist = 0;
    let bestAngle = 0;

    const camDir = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));

    for (const pt of this.points) {
      const toAnchor = new THREE.Vector3().subVectors(pt.pos, playerPos);
      const dist = toAnchor.length();

      // Check distance limit
      if (dist > pt.radius || dist < 2.5) continue;

      // Anchor must be above the player's head (between 2.5m and 18m higher)
      const dy = pt.pos.y - playerPos.y;
      if (dy < 2.2 || dy > 19.0) continue;

      // Check horizontal angle relative to camera view
      const horizToAnchor = new THREE.Vector3(toAnchor.x, 0, toAnchor.z).normalize();
      const dot = camDir.dot(horizToAnchor);
      const angle = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));

      // Must be roughly within the field of view (~70 degrees) or closer if already airborne
      const maxAngle = isAirborne ? 1.35 : 1.15;
      if (angle > maxAngle) continue;

      // Score prioritizing center of screen and closeness
      const score = dist * (1.0 + angle * 1.5);
      if (score < minScore) {
        minScore = score;
        bestPoint = pt;
        bestDist = dist;
        bestAngle = angle;
      }
    }

    if (!bestPoint) return null;
    return { point: bestPoint, dist: bestDist, forwardAngle: bestAngle };
  }

  /**
   * Attaches grapple rope to the target anchor and initiates pendulum kinematics
   */
  public attach(
    point: GrapplePoint,
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    camYaw: number
  ): void {
    this.activePoint = point;
    this.attached = true;
    this.currentAnchorPos.copy(point.pos);

    const toPlayer = new THREE.Vector3().subVectors(playerPos, point.pos);
    this.ropeLength = THREE.MathUtils.clamp(toPlayer.length(), 4.5, point.radius);

    // Initial forward swing direction based on player momentum or camera orientation
    const horizVel = new THREE.Vector3(playerVel.x, 0, playerVel.z);
    if (horizVel.length() > 1.5) {
      this.swingForward.copy(horizVel).normalize();
    } else {
      this.swingForward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize();
    }

    // Swing axis perpendicular to forward and vertical
    this.swingAxis.crossVectors(this.swingForward, new THREE.Vector3(0, 1, 0)).normalize();

    // Preserve incoming kinetic momentum into the swing
    this.swingVel.copy(playerVel);
    if (this.swingVel.length() < 5.5) {
      this.swingVel.copy(this.swingForward).multiplyScalar(6.5);
      this.swingVel.y = Math.min(0, playerVel.y);
    }

    this.ropeMesh.visible = true;

    // Ring visual pulse
    if (point.ringMesh) {
      const mat = point.ringMesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissive.setHex(0xffaa22);
        mat.emissiveIntensity = 1.0;
      }
    }
  }

  /**
   * Updates pendulum swing physics and controls:
   * [W] pump forward swing
   * [S] brake swing
   * [A]/[D] steer swing azimuth
   * [Space] / [F] detach and launch
   */
  public update(
    dt: number,
    playerPos: THREE.Vector3,
    inputMove: { x: number; y: number },
    camYaw: number
  ): { pos: THREE.Vector3; vel: THREE.Vector3; swingSpeed: number; swingProgress: number } {
    if (!this.attached || !this.activePoint) {
      return { pos: playerPos, vel: this.swingVel, swingSpeed: 0, swingProgress: 0 };
    }

    const anchor = this.currentAnchorPos;
    const gravity = new THREE.Vector3(0, -18.5, 0);

    // 1. Vector from anchor to player
    const offset = new THREE.Vector3().subVectors(playerPos, anchor);
    const currentLen = offset.length();
    const radial = offset.clone().normalize();

    // 2. Tangential gravity acceleration: a_tan = g - (g . radial) * radial
    const gDotR = gravity.dot(radial);
    const tangentialG = gravity.clone().addScaledVector(radial, -gDotR);

    // 3. Player pumping inputs: W adds impulse in direction of current velocity
    const speed = this.swingVel.length();
    const moveInputY = -inputMove.y; // Forward is negative Y in screen input
    if (moveInputY > 0.1 && speed > 0.5) {
      const pumpDir = this.swingVel.clone().normalize();
      this.swingVel.addScaledVector(pumpDir, 16.5 * moveInputY * dt);
    } else if (moveInputY < -0.1) {
      // S brakes
      this.swingVel.multiplyScalar(Math.max(0.85, 1.0 - 2.5 * dt));
    }

    // Lateral steering with A/D: rotate the velocity vector slightly
    if (Math.abs(inputMove.x) > 0.1) {
      const steerAngle = -inputMove.x * 1.8 * dt;
      this.swingVel.applyAxisAngle(new THREE.Vector3(0, 1, 0), steerAngle);
      this.swingForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), steerAngle);
    }

    // Apply tangential gravity and damping
    this.swingVel.addScaledVector(tangentialG, dt);
    this.swingVel.multiplyScalar(Math.pow(0.994, dt * 60)); // Air drag

    // Enforce velocity remains strictly tangential to the rope
    const vDotR = this.swingVel.dot(radial);
    this.swingVel.addScaledVector(radial, -vDotR);

    // Cap maximum swing velocity to prevent instability
    if (this.swingVel.length() > 17.5) {
      this.swingVel.setLength(17.5);
    }

    // 4. Update Position along spherical constraint
    const newPos = playerPos.clone().addScaledVector(this.swingVel, dt);
    const newOffset = new THREE.Vector3().subVectors(newPos, anchor);
    newOffset.normalize().multiplyScalar(this.ropeLength);
    const constrainedPos = anchor.clone().add(newOffset);

    // Swing progress metric: dot product of offset with forward (-1 to +1)
    const horizOffset = new THREE.Vector3(newOffset.x, 0, newOffset.z).normalize();
    const swingProgress = horizOffset.dot(this.swingForward);

    return {
      pos: constrainedPos,
      vel: this.swingVel.clone(),
      swingSpeed: this.swingVel.length(),
      swingProgress,
    };
  }

  /**
   * Detaches the grapple rope and returns launch impulse
   */
  public detach(): THREE.Vector3 {
    if (!this.attached) return new THREE.Vector3();

    this.attached = false;
    this.ropeMesh.visible = false;

    if (this.activePoint?.ringMesh) {
      const mat = this.activePoint.ringMesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissive.setHex(0x3d2808);
        mat.emissiveIntensity = 0.35;
      }
    }

    // Compute athletic launch boost:
    // Retain forward momentum + vertical parabolic lift boost
    const launchVel = this.swingVel.clone();
    launchVel.multiplyScalar(1.12);
    launchVel.y = Math.max(3.8, launchVel.y + 2.8);

    this.activePoint = null;
    return launchVel;
  }

  /**
   * Updates the 3D rope cylinder between Naira's hand and the anchor point
   */
  public updateRopeVisual(handPos: THREE.Vector3): void {
    if (!this.attached || !this.ropeMesh.visible) return;

    const anchor = this.currentAnchorPos;
    const ropeVec = new THREE.Vector3().subVectors(handPos, anchor);
    const ropeLen = ropeVec.length();

    this.ropeMesh.position.copy(anchor);
    this.ropeMesh.scale.set(1, ropeLen, 1);

    // Orient cylinder from anchor down to hand
    const downDir = ropeVec.clone().normalize();
    this.ropeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), downDir);
  }
}
