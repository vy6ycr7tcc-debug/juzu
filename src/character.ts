import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from './input.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { physics } from './physics.js';
import { getGlobalTerrainHeight } from './terrain.js';
import { skinNaira, clothField, clothFieldDark, hairDark, leatherDark, leatherBoot } from './materials.js';
import { createMistTexture } from './textures.js';

// P-MOBILE verification hook (docs/plans/phase-5-mobile-controls.md §P5.3):
// gates G3/G4 read live locomotion state instead of screenshot guessing.
declare global {
  interface Window {
    __playerDebug?: {
      theta: number;
      phi: number;
      speed: number;
      state: MovementState;
      x: number;
      z: number;
    };
  }
}

export enum MovementState {
  WALK = 'WALK',
  CLIMB = 'CLIMB',
  LEDGE_GRAB = 'LEDGE_GRAB',
  SWIM = 'SWIM',
  SLIDE = 'SLIDE',
  ROPE_SWING = 'ROPE_SWING'
}


export class CharacterController {
  public mesh: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  protected input: InputManager;

  // Orbit camera parameters
  private theta: number = 0;
  private phi: number = Math.PI / 3;
  private radius: number = 5;
  private target: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Traversal State Machine
  public state: MovementState = MovementState.WALK;
  private stateTimer: number = 0;

  // Locomotion parameters
  public speed: number = 0;
  private maxWalkSpeed: number = 2.0;
  private maxRunSpeed: number = 5.0;
  private acceleration: number = 10.0;
  private deceleration: number = 15.0;
  private rotationSpeed: number = 10.0;

  // Rigged GLB Model & Animation state
  public isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
  } = {};
  private activeAction: THREE.AnimationAction | null = null;
  private characterModel: THREE.Group | null = null;
  private time: number = 0;

  public disableCameraUpdate: boolean = false;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;

    // Protagonist root group — positioned in world coordinates
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    // Asynchronously load the rigged GLB model
    this.load();

    // Camera orbit controls are handled via input manager now
    this.updateCamera();
  }

  public load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      const modelUrl = `${import.meta.env.BASE_URL}models/soldier.glb`;
      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;

          // Scale model to human adventurer height (1.75 m)
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const targetHeight = 1.75;
          const scale = targetHeight / (size.y || 1);
          model.scale.setScalar(scale);

          // Center model and align soles of feet to y = 0
          const alignedBox = new THREE.Box3().setFromObject(model);
          model.position.y = -alignedBox.min.y;

          // Ensure proper material configuration, shadows, and colorSpace
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = false;
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.envMapIntensity = 1.0;
                mat.roughness = 0.85;
                mat.metalness = 0.05;
                if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
              }
            }
          });

          // Mixamo bone attachments for Naira's signature braids and gear
          const headBone = model.getObjectByName('mixamorig:Head');
          const spineBone = model.getObjectByName('mixamorig:Spine2');

          // Signature twin dark braids (hairDark) attached to head bone
          if (headBone) {
            const braidMat = hairDark();
            const leftBraidCurve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(-6, -2, -6),
              new THREE.Vector3(-10, -18, -2),
              new THREE.Vector3(-12, -35, 4)
            ]);
            const rightBraidCurve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(6, -2, -6),
              new THREE.Vector3(10, -18, -2),
              new THREE.Vector3(12, -35, 4)
            ]);
            const leftBraid = new THREE.Mesh(new THREE.TubeGeometry(leftBraidCurve, 8, 2.2, 8, false), braidMat);
            const rightBraid = new THREE.Mesh(new THREE.TubeGeometry(rightBraidCurve, 8, 2.2, 8, false), braidMat);
            leftBraid.castShadow = true;
            rightBraid.castShadow = true;
            headBone.add(leftBraid);
            headBone.add(rightBraid);
          }

          // Signature leather field pack attached to spine bone
          if (spineBone) {
            const packMat = leatherDark();
            const packMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 36, 18), packMat);
            packMesh.position.set(0, 10, -15);
            packMesh.castShadow = true;
            spineBone.add(packMesh);
          }

          this.characterModel = model;
          this.mesh.add(model);

          // Setup AnimationMixer
          this.mixer = new THREE.AnimationMixer(model);
          for (const clip of gltf.animations) {
            if (clip.name === 'Idle') {
              this.actions.idle = this.mixer.clipAction(clip);
            } else if (clip.name === 'Walk') {
              this.actions.walk = this.mixer.clipAction(clip);
            } else if (clip.name === 'Run') {
              this.actions.run = this.mixer.clipAction(clip);
            }
          }

          if (this.actions.idle) {
            this.actions.idle.play();
            this.activeAction = this.actions.idle;
          }

          this.isLoaded = true;
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load character GLB:', err);
          reject(err);
        }
      );
    });
    return this.loadPromise;
  }

  public setForceState(state: MovementState) { this.state = state; this.stateTimer = 0; }

  public getTerrainHeightAndNormal(x: number, z: number): { y: number, normal: THREE.Vector3 } {
    const y = getGlobalTerrainHeight(x, z);
    const eps = 0.1;
    const hx = getGlobalTerrainHeight(x + eps, z);
    const hz = getGlobalTerrainHeight(x, z + eps);
    const dx = hx - y;
    const dz = hz - y;
    const normal = new THREE.Vector3(-dx, eps, -dz).normalize();
    return { y, normal };
  }


  private detectStateTransitions(nextX: number, _nextZ: number, terrainData: { y: number, normal: THREE.Vector3 }) {
    // Swimming only applies when the character is actually down at the river water surface level (< 0.5m),
    // never when traversing a bridge high above the gorge.
    const isRiver = this.mesh.position.y < 0.5 && terrainData.y < -3.0 && Math.abs(nextX) < 15;

    if (this.state === MovementState.WALK && this.mesh.position.y > 10 && terrainData.normal.y < 0.1 && this.input.isDown('KeyW')) {
        this.state = MovementState.CLIMB;
    }

    if (this.state === MovementState.WALK && isRiver) {
        this.state = MovementState.SWIM;
    } else if (this.state === MovementState.SWIM && !isRiver && terrainData.y > -2.0) {
        this.state = MovementState.WALK;
    }

    const slope = 1.0 - terrainData.normal.y;
    if (this.state === MovementState.WALK && slope > 0.6 && this.speed > 2.0) {
        this.state = MovementState.SLIDE;
    } else if (this.state === MovementState.SLIDE && slope < 0.3) {
        this.state = MovementState.WALK;
    }
  }

  // Optional rigid body reference for physics interaction
  public body: RAPIER.RigidBody | null = null;
  public collider: RAPIER.Collider | null = null;

  // Breath particles — p7: seeded deterministic spawn (the old Math.random()
  // violated the J7 determinism discipline every other system was fixed for)
  // and soft normal-blended sprites (the p4 mist lesson: unlit white MeshBasic
  // spheres read as glow blobs — §4.4 spirit).
  private breathParticles: THREE.Sprite[] = [];
  private breathAccum = 0;
  private breathMat: THREE.SpriteMaterial | null = null;

  public update(dt: number) {
    this.stateTimer += dt;
    this.time += dt;

    // touch-controls: Consume camera delta from touch input
    if (typeof this.input.getCameraDelta === 'function') {
      const camDelta = this.input.getCameraDelta();
      if (camDelta.x !== 0 || camDelta.y !== 0) {
        this.theta -= camDelta.x * 0.01;
        this.phi -= camDelta.y * 0.01;
        this.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.phi));
      }
    }

    // Optional sync to physics
    if (this.body) {
        // Very basic sync for physics interaction, ideally we'd use a proper KinematicCharacterController
        // but for now we just want to push things.
        this.body.setNextKinematicTranslation({
            x: this.mesh.position.x,
            y: this.mesh.position.y,
            z: this.mesh.position.z
        });
    }

    // Movement Input
    const joy = this.input.getJoystickVector();
    const joystickActive = joy.x !== 0 || joy.y !== 0;
    let forward = this.input.isDown('KeyW') ? 1 : (this.input.isDown('KeyS') ? -1 : 0);
    let right = this.input.isDown('KeyD') ? 1 : (this.input.isDown('KeyA') ? -1 : 0);

    // touch-controls: Inject analog joystick input
    if (joystickActive) {
      forward = -joy.y;
      right = joy.x;
    }

    const isRunning = this.input.isDown('ShiftLeft');

    let actualForward = forward;
    let actualRight = right;

    if (this.state === MovementState.SLIDE) {
        actualForward = 1;
        actualRight = right * 0.5;
    } else if (this.state === MovementState.CLIMB) {
        actualForward = forward * 0.5;
        actualRight = right * 0.5;
    } else if (this.state === MovementState.SWIM) {
        actualForward = forward * 0.6;
        actualRight = right * 0.6;
    }

    const inputDir = new THREE.Vector3(actualRight, 0, -actualForward);

    if (inputDir.lengthSq() > 0) {
      inputDir.normalize();

      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      const moveDir = new THREE.Vector3()
        .addScaledVector(camRight, inputDir.x)
        .addScaledVector(camDir, -inputDir.z)
        .normalize();

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);

      let angleDiff = targetAngle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      this.mesh.rotation.y += angleDiff * this.rotationSpeed * dt;

      // P-MOBILE F3: analog walk→run blend from stick deflection. Keyboard
      // keeps the Shift sprint; on touch, full sustained deflection IS the
      // sprint (magnitude ≥ 0.95 → maxRunSpeed). t² eases fine control near
      // the stick center; half deflection stays inside the walk band.
      let targetSpeed: number;
      if (joystickActive) {
        const t = THREE.MathUtils.clamp((this.input.joystickMagnitude - 0.35) / (0.95 - 0.35), 0, 1);
        targetSpeed = this.maxWalkSpeed + (this.maxRunSpeed - this.maxWalkSpeed) * t * t;
      } else {
        targetSpeed = isRunning ? this.maxRunSpeed : this.maxWalkSpeed;
      }
      this.speed = Math.min(targetSpeed, this.speed + this.acceleration * dt);

    } else {
      this.speed = Math.max(0, this.speed - this.deceleration * dt);
    }

    const moveOffset = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y).multiplyScalar(this.speed * dt);

    const nextX = this.mesh.position.x + moveOffset.x;
    const nextZ = this.mesh.position.z + moveOffset.z;

    const terrainData = this.getTerrainHeightAndNormal(nextX, nextZ);


    this.detectStateTransitions(nextX, nextZ, terrainData);

    const slope = 1.0 - terrainData.normal.y;

    if (this.state === MovementState.CLIMB) {
        this.mesh.position.y += actualForward * this.maxWalkSpeed * 0.5 * dt;
        this.mesh.position.x = nextX;
        this.mesh.position.z = nextZ;
    } else if (this.state === MovementState.ROPE_SWING) {
        const swingSpeed = 2.0;
        const swingArc = Math.sin(this.stateTimer * swingSpeed) * 3;
        this.mesh.position.y = this.getTerrainHeightAndNormal(this.mesh.position.x, this.mesh.position.z).y + 5 - Math.cos(this.stateTimer * swingSpeed) * 2;
        this.mesh.position.x += Math.cos(this.mesh.rotation.y) * swingArc * dt;
        this.mesh.position.z += Math.sin(this.mesh.rotation.y) * swingArc * dt;
    } else if (slope < 0.4 || this.state === MovementState.SLIDE || this.state === MovementState.SWIM) {
      this.mesh.position.x = nextX;
      this.mesh.position.z = nextZ;
    }

    if (this.state !== MovementState.CLIMB && this.state !== MovementState.ROPE_SWING) {
        let h = this.getTerrainHeightAndNormal(this.mesh.position.x, this.mesh.position.z).y;

        // Raycast down to find physics colliders (like the rope bridge).
        // Excludes her OWN kinematic capsule — without the exclusion the probe
        // hits it (origin is 2 m up, capsule top at +0.9 m) and she levitates
        // +0.9 m per update step (p7 measured; broke character_closeup framing
        // and every gameplay frame after the first physics step).
        const physHeight = physics.raycastDown(this.mesh.position.x, this.mesh.position.y + 2.0, this.mesh.position.z, 5.0, this.body ?? undefined);
        if (physHeight !== null && physHeight > h) {
            h = physHeight;
        }

        if (this.state === MovementState.SWIM) {
             const riverLevel = 0.5; // same as river height
             // Bob slightly with time
             const bob = Math.sin(this.time * 2) * 0.1;
             this.mesh.position.y = riverLevel - 1.5 + bob;

             // Drift slightly with current
             const driftSpeed = 2.0;
             this.mesh.position.z -= driftSpeed * dt;

             // Ensure we don't clip through the ground while swimming
             if (this.mesh.position.y < h) {
                 this.mesh.position.y = h;
             }
        } else {
             this.mesh.position.y = h;
        }
    }


    // Breath vapor effect for high sierra
    const isHighSierra = this.mesh.position.z > 500 || this.mesh.position.y > 50;
    if (isHighSierra) {
      // Deterministic spawn clock: ~6/s (the old 10%-per-frame rate at 60 fps)
      // driven purely by dt — identical sequences for identical ?t=.
      this.breathAccum += dt * 6;
      while (this.breathAccum >= 1) {
        this.breathAccum -= 1;
        if (!this.breathMat) {
          this.breathMat = new THREE.SpriteMaterial({
            map: createMistTexture(),
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          });
        }
        const breath = new THREE.Sprite(this.breathMat);
        breath.scale.setScalar(0.12);
        // Position roughly at head
        breath.position.copy(this.mesh.position).add(new THREE.Vector3(0, 1.8, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y));
        this.mesh.parent?.add(breath);
        this.breathParticles.push(breath);
      }
    }

    // Update breath particles
    for (let i = this.breathParticles.length - 1; i >= 0; i--) {
        const p = this.breathParticles[i];
        p.position.y += dt * 1.5;
        p.position.z += dt * 0.5 * Math.cos(this.mesh.rotation.y); // drift forward slightly
        p.position.x += dt * 0.5 * Math.sin(this.mesh.rotation.y);
        p.material.opacity -= dt * 0.5;
        p.scale.addScalar(dt * 2.0);
        if (p.material.opacity <= 0) {
            p.parent?.remove(p);
            this.breathParticles.splice(i, 1);
        }
    }

    // Update AnimationMixer for rigged skeletal motion
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Determine target animation action based on speed and state
    let desiredAction = this.actions.idle;
    if (this.speed > 0.1) {
      if (this.speed > this.maxWalkSpeed * 1.1) {
        desiredAction = this.actions.run;
      } else {
        desiredAction = this.actions.walk;
      }
    }

    if (desiredAction && desiredAction !== this.activeAction) {
      if (this.activeAction) {
        this.activeAction.fadeOut(0.2);
      }
      desiredAction.reset().fadeIn(0.2).play();
      this.activeAction = desiredAction;
    }

    // Dynamically pace locomotion cycle to match ground speed
    if (this.activeAction === this.actions.walk && this.actions.walk) {
      this.actions.walk.timeScale = Math.max(0.2, this.speed / this.maxWalkSpeed);
    } else if (this.activeAction === this.actions.run && this.actions.run) {
      this.actions.run.timeScale = Math.max(0.5, this.speed / this.maxRunSpeed);
    }

    if (this.state === MovementState.SLIDE) {
      this.mesh.rotation.x = Math.PI / 6;
    } else {
      this.mesh.rotation.x = 0;
    }

    window.__playerDebug = {
      theta: this.theta,
      phi: this.phi,
      speed: this.speed,
      state: this.state,
      x: this.mesh.position.x,
      z: this.mesh.position.z,
    };

    this.updateCamera();
  }

  public updateCamera() {
    if (this.disableCameraUpdate) return;
    this.target.copy(this.mesh.position).add(new THREE.Vector3(0, 1.2, 0));

    const x = this.target.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.target.y + this.radius * Math.cos(this.phi);
    const z = this.target.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  public teleport(x: number, z: number, theta: number = 0, yOverride?: number) {
    const y = yOverride ?? this.getTerrainHeightAndNormal(x, z).y;
    this.mesh.position.set(x, y, z);
    // p7: callers pass theta as a FACING (rockslide: "position character
    // looking at the slope", shot overrides &ry=) — the old code only set the
    // orbit-camera theta and never touched mesh.rotation.y, so every teleported
    // facing silently no-opped (she always faced +z; the pack/braid framing
    // could not be captured).
    this.mesh.rotation.y = theta;
    this.theta = theta;
    // P-FRESH: a teleport must not inherit the previous location's traversal
    // state. The boot spawn sat in the river channel (V-WATER water table), so
    // state became SWIM on frame 1 — and every later teleport (gate probes,
    // save loads) carried SWIM with it, floating her at the swim height over
    // dry lakebeds with no visible water. WALK re-enters SWIM on the next
    // update if the destination really is river; forced states (shots) use
    // setForceState AFTER teleport, which still wins.
    this.state = MovementState.WALK;
    this.stateTimer = 0;
    this.speed = 0;
    this.updateCamera();
  }
}
