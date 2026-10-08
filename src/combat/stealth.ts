import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getGlobalTerrainHeight } from '../terrain.js';
import { ironDark } from '../materials.js';
import type { AudioDirector } from '../audio/engine.js';
import type { CharacterController } from '../character.js';

export type SentryState = 'PATROL' | 'SUSPICIOUS' | 'COMBAT' | 'DOWNED';

export interface SentryWaypoint {
  x: number;
  z: number;
  pauseDuration?: number;
}

export interface SentryConfig {
  id: string;
  name: string;
  spawnPos: THREE.Vector3;
  waypoints: SentryWaypoint[];
  patrolSpeed?: number;
  combatSpeed?: number;
  visionRange?: number;
  visionFovDeg?: number;
}

export class EnemySentry {
  public id: string;
  public name: string;
  public group: THREE.Group;
  public state: SentryState = 'PATROL';
  public health: number = 100;
  public maxHealth: number = 100;
  public awareness: number = 0; // 0.0 (unaware) to 1.0 (fully alerted to combat)

  // Waypoint navigation
  private waypoints: SentryWaypoint[];
  private currentWaypointIdx: number = 0;
  private waypointWaitTimer: number = 0;
  public patrolSpeed: number = 1.6;
  public combatSpeed: number = 4.2;

  // Vision cone
  public visionRange: number = 18.0;
  public visionFovDeg: number = 80.0;
  public facingDir: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

  // Mesh & skeletal animations
  public mixer: THREE.AnimationMixer | null = null;
  public actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
  } = {};
  public activeAction: THREE.AnimationAction | null = null;
  public isLoaded: boolean = false;
  public modelGroup: THREE.Object3D | null = null;

  // Visual awareness icon/ring
  public awarenessWidget: THREE.Group;
  public awarenessFillMesh: THREE.Mesh;
  public instinctHighlightMesh: THREE.Mesh | null = null;

  // Combat firing / attack cooldown
  private attackCooldown: number = 0;
  public hasLooted: boolean = false;

  constructor(config: SentryConfig) {
    this.id = config.id;
    this.name = config.name;
    this.waypoints = config.waypoints.length > 0 ? config.waypoints : [{ x: config.spawnPos.x, z: config.spawnPos.z }];
    this.patrolSpeed = config.patrolSpeed ?? 1.6;
    this.combatSpeed = config.combatSpeed ?? 4.2;
    this.visionRange = config.visionRange ?? 18.0;
    this.visionFovDeg = config.visionFovDeg ?? 80.0;

    this.group = new THREE.Group();
    this.group.name = `Sentry_${this.id}`;
    this.group.position.copy(config.spawnPos);

    // Overhead subtle awareness ring widget
    this.awarenessWidget = new THREE.Group();
    this.awarenessWidget.position.set(0, 2.15, 0);

    const ringBgGeo = new THREE.RingGeometry(0.14, 0.18, 24);
    ringBgGeo.rotateX(-Math.PI / 2);
    const ringBgMat = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringBg = new THREE.Mesh(ringBgGeo, ringBgMat);
    this.awarenessWidget.add(ringBg);

    const fillGeo = new THREE.RingGeometry(0.14, 0.18, 24, 1, 0, Math.PI * 2);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.awarenessFillMesh = new THREE.Mesh(fillGeo, fillMat);
    this.awarenessFillMesh.visible = false;
    this.awarenessWidget.add(this.awarenessFillMesh);

    this.group.add(this.awarenessWidget);
  }

  public setAnimation(actionName: 'idle' | 'walk' | 'run') {
    const next = this.actions[actionName];
    if (!next || next === this.activeAction) return;

    if (this.activeAction) {
      this.activeAction.fadeOut(0.2);
    }
    next.reset().fadeIn(0.2).play();
    this.activeAction = next;
  }

  public takeDamage(amount: number, isHeadshot: boolean = false): { killed: boolean; headshot: boolean } {
    if (this.state === 'DOWNED') return { killed: false, headshot: false };

    if (isHeadshot) {
      this.health = 0;
    } else {
      this.health -= amount;
    }

    if (this.health <= 0) {
      this.health = 0;
      this.state = 'DOWNED';
      this.awareness = 0;
      this.awarenessWidget.visible = false;

      // Collapse animation (fall to ground)
      if (this.modelGroup) {
        this.modelGroup.rotation.x = Math.PI * 0.48; // Face down in dirt
        this.modelGroup.position.y = 0.15;
      }
      if (this.activeAction) {
        this.activeAction.stop();
      }
      return { killed: true, headshot: isHeadshot };
    } else {
      // Body shot stagger -> instant combat alert
      this.awareness = 1.0;
      this.state = 'COMBAT';
      return { killed: false, headshot: false };
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    isPlayerConcealed: boolean,
    audio?: AudioDirector
  ): { spottedPlayer: boolean; triggeredAlert: boolean } {
    if (this.mixer) {
      this.mixer.update(dt);
    }

    if (this.state === 'DOWNED') {
      return { spottedPlayer: false, triggeredAlert: false };
    }

    let spottedPlayer = false;
    let triggeredAlert = false;

    // 1. Line-of-sight & vision cone check against player
    const eyePos = this.group.position.clone().add(new THREE.Vector3(0, 1.65, 0));
    const targetPlayerPos = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
    const toPlayer = targetPlayerPos.clone().sub(eyePos);
    const distToPlayer = toPlayer.length();

    // Concealment in tall grass / ferns cuts sentry sight range from 18m to 3.5m
    const effectiveVisionRange = isPlayerConcealed ? 3.5 : this.visionRange;

    if (distToPlayer <= effectiveVisionRange) {
      const dirToPlayer = toPlayer.clone().normalize();
      const dot = this.facingDir.dot(dirToPlayer);
      const halfFovRad = THREE.MathUtils.degToRad(this.visionFovDeg * 0.5);
      const cosHalfFov = Math.cos(halfFovRad);

      // Within horizontal vision cone (or immediate 2m proximity)
      if (dot >= cosHalfFov || distToPlayer < 2.2) {
        // Line-of-sight raycast against terrain heightfield to avoid seeing through ridges
        const steps = 6;
        let occluded = false;
        for (let s = 1; s < steps; s++) {
          const sample = eyePos.clone().lerp(targetPlayerPos, s / steps);
          const terrainH = getGlobalTerrainHeight(sample.x, sample.z);
          if (sample.y < terrainH + 0.25) {
            occluded = true;
            break;
          }
        }

        if (!occluded) {
          spottedPlayer = true;
        }
      }
    }

    // 2. Awareness Meter Dynamics
    if (spottedPlayer) {
      // Closer range builds awareness faster
      const rate = 1.5 + (1.0 - Math.min(1.0, distToPlayer / this.visionRange)) * 1.5;
      this.awareness = Math.min(1.0, this.awareness + dt * rate);

      // Face the player while detecting
      const targetFacing = toPlayer.clone();
      targetFacing.y = 0;
      targetFacing.normalize();
      this.facingDir.lerp(targetFacing, Math.min(1.0, 10.0 * dt));
      this.group.rotation.y = Math.atan2(this.facingDir.x, this.facingDir.z);

      if (this.awareness >= 1.0 && this.state !== 'COMBAT') {
        this.state = 'COMBAT';
        triggeredAlert = true;
        if (audio) {
          audio.play('alert_stinger', { position: this.group.position, volume: 0.85 });
        }
      } else if (this.state === 'PATROL' && this.awareness > 0.3) {
        this.state = 'SUSPICIOUS';
      }
    } else {
      // Natural awareness decay when out of sight
      if (this.state === 'SUSPICIOUS' || this.state === 'PATROL') {
        this.awareness = Math.max(0.0, this.awareness - dt * 0.35);
        if (this.awareness <= 0.05 && this.state === 'SUSPICIOUS') {
          this.state = 'PATROL';
        }
      } else if (this.state === 'COMBAT') {
        // In combat, awareness lingers for 8 seconds before returning to suspicious
        this.awareness = Math.max(0.0, this.awareness - dt * 0.12);
        if (this.awareness <= 0.2) {
          this.state = 'PATROL';
        }
      }
    }

    // Update awareness overhead visual
    if (this.awareness > 0.05) {
      this.awarenessWidget.visible = true;
      this.awarenessFillMesh.visible = true;
      const angle = this.awareness * Math.PI * 2;
      this.awarenessFillMesh.rotation.z = -angle;

      const mat = this.awarenessFillMesh.material as THREE.MeshBasicMaterial;
      if (this.state === 'COMBAT' || this.awareness >= 0.95) {
        mat.color.setHex(0xf87171); // Red combat
      } else if (this.awareness > 0.35) {
        mat.color.setHex(0xfbbf24); // Yellow suspicious
      } else {
        mat.color.setHex(0xffffff); // White detecting
      }
    } else {
      this.awarenessWidget.visible = false;
    }

    // 3. Movement and State Execution
    if (this.state === 'COMBAT') {
      // Pursuit: move toward player
      this.setAnimation('run');
      const step = toPlayer.clone();
      step.y = 0;
      if (distToPlayer > 3.0) {
        step.normalize().multiplyScalar(this.combatSpeed * dt);
        this.group.position.add(step);
      }
      this.facingDir.copy(step.normalize());
      this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      // Firing attack cooldown
      this.attackCooldown += dt;
      if (this.attackCooldown > 2.2 && distToPlayer <= 20.0) {
        this.attackCooldown = 0;
        // Sentry bursts fire!
        if (audio) {
          audio.play('bow_twang', { position: this.group.position, volume: 0.6 });
        }
      }
    } else if (this.state === 'PATROL') {
      // Patrol waypoint navigation
      const currentWp = this.waypoints[this.currentWaypointIdx];
      const wpPos = new THREE.Vector3(currentWp.x, getGlobalTerrainHeight(currentWp.x, currentWp.z), currentWp.z);
      const toWp = wpPos.clone().sub(this.group.position);
      toWp.y = 0;
      const distToWp = toWp.length();

      if (distToWp < 0.65) {
        // Reached waypoint: pause briefly
        this.waypointWaitTimer += dt;
        this.setAnimation('idle');
        const pauseTime = currentWp.pauseDuration ?? 2.5;
        if (this.waypointWaitTimer >= pauseTime) {
          this.waypointWaitTimer = 0;
          this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.waypoints.length;
        }
      } else {
        this.setAnimation('walk');
        toWp.normalize();
        this.facingDir.lerp(toWp, Math.min(1.0, 8.0 * dt));
        this.group.rotation.y = Math.atan2(this.facingDir.x, this.facingDir.z);
        this.group.position.addScaledVector(this.facingDir, this.patrolSpeed * dt);
      }
    } else if (this.state === 'SUSPICIOUS') {
      this.setAnimation('idle');
    }

    // Ground clamp
    const groundY = getGlobalTerrainHeight(this.group.position.x, this.group.position.z);
    this.group.position.y = groundY;

    return { spottedPlayer, triggeredAlert };
  }
}

export class StealthSystem {
  public scene: THREE.Scene;
  public sentries: EnemySentry[] = [];
  private loader: GLTFLoader = new GLTFLoader();
  private soldierGltf: any = null;

  // Tall grass & foliage concealment volumes
  public foliagePatches: { center: THREE.Vector3; radius: number }[] = [];

  // Active threat awareness (highest among sentries, 0..1)
  public maxAwareness: number = 0;
  public threatDirection: THREE.Vector2 = new THREE.Vector2(0, 0); // Normalized 2D screen direction for HUD arc
  public isPlayerConcealed: boolean = false;

  // Silent Takedown availability
  public activeTakedownTarget: EnemySentry | null = null;

  // Loot prompt
  public activeLootTarget: EnemySentry | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initFoliagePatches();
  }

  public async load(): Promise<void> {
    const soldierUrl = `${import.meta.env.BASE_URL}models/soldier.glb`;
    this.soldierGltf = await this.loader.loadAsync(soldierUrl).catch(() => null);
    this.spawnDefaultSentries();
  }

  private initFoliagePatches(): void {
    // Dense fern / brush stealth groves scattered across ruins and ridges
    this.foliagePatches = [
      { center: new THREE.Vector3(32, 0, 16), radius: 5.5 },
      { center: new THREE.Vector3(48, 0, 32), radius: 6.0 },
      { center: new THREE.Vector3(135, 0, -280), radius: 8.0 },
      { center: new THREE.Vector3(142, 0, -310), radius: 7.5 },
      { center: new THREE.Vector3(-85, 0, -485), radius: 6.5 },
      { center: new THREE.Vector3(25, 0, -60), radius: 6.0 },
    ];
  }

  private spawnDefaultSentries(): void {
    const configs: SentryConfig[] = [
      // Sentry 1: Lower Ruins Perimeter Patrol
      {
        id: 'sentry_ruins_east',
        name: 'Sol Negro Sentry (Perimeter)',
        spawnPos: new THREE.Vector3(42, getGlobalTerrainHeight(42, 28), 28),
        waypoints: [
          { x: 42, z: 28, pauseDuration: 2.5 },
          { x: 50, z: 36, pauseDuration: 3.0 },
          { x: 36, z: 42, pauseDuration: 2.0 },
          { x: 30, z: 32, pauseDuration: 3.5 },
        ],
        patrolSpeed: 1.5,
        combatSpeed: 4.4,
        visionRange: 18.0,
      },
      // Sentry 2: Ridge Overlook
      {
        id: 'sentry_ridge_overlook',
        name: 'Sol Negro Scout',
        spawnPos: new THREE.Vector3(26, getGlobalTerrainHeight(26, 48), 48),
        waypoints: [
          { x: 26, z: 48, pauseDuration: 4.0 },
          { x: 20, z: 54, pauseDuration: 3.0 },
          { x: 18, z: 44, pauseDuration: 2.5 },
        ],
        patrolSpeed: 1.4,
        combatSpeed: 4.5,
        visionRange: 20.0,
      },
      // Sentry 3: Sunken Crypt Guard
      {
        id: 'sentry_crypt_gate',
        name: 'Sol Negro Enforcer',
        spawnPos: new THREE.Vector3(38, getGlobalTerrainHeight(38, -42), -42),
        waypoints: [
          { x: 38, z: -42, pauseDuration: 3.0 },
          { x: 45, z: -46, pauseDuration: 2.5 },
          { x: 34, z: -50, pauseDuration: 3.0 },
        ],
        patrolSpeed: 1.6,
        combatSpeed: 4.2,
        visionRange: 16.0,
      },
    ];

    for (const cfg of configs) {
      const sentry = new EnemySentry(cfg);
      this.buildSentryMesh(sentry);
      this.scene.add(sentry.group);
      this.sentries.push(sentry);
    }
  }

  private buildSentryMesh(sentry: EnemySentry): void {
    if (!this.soldierGltf) return;

    const cloned = SkeletonUtils.clone(this.soldierGltf.scene);
    const targetHeight = 1.80;
    const scale = targetHeight / 1.832;
    cloned.scale.setScalar(scale);
    cloned.position.y = 0;

    // Tactical dark olive / slate field uniform PBR
    const tacticalMat = new THREE.MeshStandardMaterial({
      color: 0x272c28,
      roughness: 0.85,
      metalness: 0.12,
    });

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.material = tacticalMat;
      }
    });

    // Attach animation mixer with Walk, Run, Idle
    sentry.mixer = new THREE.AnimationMixer(cloned);
    const idleClip = this.soldierGltf.animations.find((c: THREE.AnimationClip) => c.name === 'Idle');
    const walkClip = this.soldierGltf.animations.find((c: THREE.AnimationClip) => c.name === 'Walk');
    const runClip = this.soldierGltf.animations.find((c: THREE.AnimationClip) => c.name === 'Run');

    if (idleClip) sentry.actions.idle = sentry.mixer.clipAction(idleClip);
    if (walkClip) sentry.actions.walk = sentry.mixer.clipAction(walkClip);
    if (runClip) sentry.actions.run = sentry.mixer.clipAction(runClip);

    sentry.setAnimation('idle');

    // Equip tactical carbine prop in right hand
    const weaponGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.45), ironDark());
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.18), ironDark());
    stock.position.set(0, -0.02, -0.20);
    weaponGroup.add(barrel);
    weaponGroup.add(stock);
    weaponGroup.position.set(0.18, 1.10, 0.22);
    weaponGroup.rotation.set(0.2, 0, 0);
    cloned.add(weaponGroup);

    sentry.modelGroup = cloned;
    sentry.group.add(cloned);
    sentry.isLoaded = true;
  }

  public checkFoliageConcealment(playerPos: THREE.Vector3, isCrouched: boolean): boolean {
    if (!isCrouched) return false;
    for (const patch of this.foliagePatches) {
      const dist = new THREE.Vector2(playerPos.x - patch.center.x, playerPos.z - patch.center.z).length();
      if (dist <= patch.radius) {
        return true;
      }
    }
    return false;
  }

  public checkArrowHits(
    arrowPos: THREE.Vector3,
    flightDist: number,
    flightDir: THREE.Vector3
  ): { hit: boolean; sentry: EnemySentry | null; isHeadshot: boolean } {
    for (const s of this.sentries) {
      if (s.state === 'DOWNED') continue;

      const sentryPos = s.group.position;
      const toSentry = sentryPos.clone().sub(arrowPos);
      const projDist = toSentry.dot(flightDir);

      if (projDist >= 0 && projDist <= flightDist + 0.3) {
        const closestPoint = arrowPos.clone().addScaledVector(flightDir, projDist);
        const lateralDist = new THREE.Vector2(closestPoint.x - sentryPos.x, closestPoint.z - sentryPos.z).length();

        // Sentry cylinder radius ~0.42m
        if (lateralDist <= 0.42) {
          const deltaY = closestPoint.y - sentryPos.y;
          // Sentry height 0 to 1.95m
          if (deltaY >= 0.2 && deltaY <= 1.95) {
            // Headshot is top 35cm (1.55m to 1.95m)
            const isHeadshot = deltaY >= 1.55;
            return { hit: true, sentry: s, isHeadshot };
          }
        }
      }
    }
    return { hit: false, sentry: null, isHeadshot: false };
  }

  public executeSilentTakedown(
    character: CharacterController,
    audio?: AudioDirector
  ): boolean {
    if (!this.activeTakedownTarget) return false;
    const target = this.activeTakedownTarget;

    // Dash character forward flush behind the sentry
    const behindPos = target.group.position.clone().addScaledVector(target.facingDir, -0.75);
    behindPos.y = getGlobalTerrainHeight(behindPos.x, behindPos.z);
    character.mesh.position.copy(behindPos);
    character.mesh.rotation.y = target.group.rotation.y;

    // Execute instant takedown with visceral camera impulse punch
    target.takeDamage(999, false);
    character.addCameraImpulse(target.facingDir.clone().multiplyScalar(0.24), 2.8);

    if (audio) {
      audio.play('takedown', { position: target.group.position, volume: 0.95 });
    }

    this.activeTakedownTarget = null;
    return true;
  }

  public lootSentry(sentry: EnemySentry): { arrows: number; quipu: number } {
    sentry.hasLooted = true;
    return { arrows: 3, quipu: 1 };
  }

  public update(
    dt: number,
    character: CharacterController,
    camera: THREE.Camera,
    audio?: AudioDirector
  ): void {
    const playerPos = character.mesh.position;
    this.isPlayerConcealed = this.checkFoliageConcealment(playerPos, character.isCrouched);

    let highestAwareness = 0;
    let threatVector = new THREE.Vector2(0, 0);
    let takedownCandidate: EnemySentry | null = null;
    let lootCandidate: EnemySentry | null = null;

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    for (const sentry of this.sentries) {
      sentry.update(dt, playerPos, this.isPlayerConcealed, audio);

      if (sentry.state === 'DOWNED') {
        if (!sentry.hasLooted && sentry.group.position.distanceTo(playerPos) < 2.5) {
          lootCandidate = sentry;
        }
        continue;
      }

      if (sentry.awareness > highestAwareness) {
        highestAwareness = sentry.awareness;
        // Calculate relative direction on screen
        const toSentry = new THREE.Vector2(sentry.group.position.x - playerPos.x, sentry.group.position.z - playerPos.z).normalize();
        threatVector.copy(toSentry);
      }

      // Check silent takedown opportunity: within 2.0m, behind sentry, sentry not in combat
      const dist = sentry.group.position.distanceTo(playerPos);
      if (dist <= 2.2 && sentry.state !== 'COMBAT') {
        const toPlayer = playerPos.clone().sub(sentry.group.position);
        toPlayer.y = 0;
        toPlayer.normalize();
        const dotBehind = sentry.facingDir.dot(toPlayer);
        // Behind the sentry (dot < -0.3)
        if (dotBehind < -0.3) {
          takedownCandidate = sentry;
        }
      }

      // Survival instinct pulse visibility
      if (character.isInstinctActive) {
        if (!sentry.instinctHighlightMesh) {
          const auraGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.85, 12);
          const auraMat = new THREE.MeshBasicMaterial({
            color: sentry.state === 'COMBAT' ? 0xff4444 : 0xffbb33,
            transparent: true,
            opacity: 0.35,
            wireframe: true,
          });
          sentry.instinctHighlightMesh = new THREE.Mesh(auraGeo, auraMat);
          sentry.instinctHighlightMesh.position.set(0, 0.92, 0);
          sentry.group.add(sentry.instinctHighlightMesh);
        }
        sentry.instinctHighlightMesh.visible = true;
      } else if (sentry.instinctHighlightMesh) {
        sentry.instinctHighlightMesh.visible = false;
      }
    }

    this.maxAwareness = highestAwareness;
    this.threatDirection.copy(threatVector);
    this.activeTakedownTarget = takedownCandidate;
    this.activeLootTarget = lootCandidate;
  }
}
