import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retargetMixamoClip } from '../character.js';
import { getGlobalTerrainHeight } from '../terrain.js';
import {
  clothField,
  clothFieldDark,
  woodWet,
  ironDark,
  leatherBoot,
} from '../materials.js';

export interface NPCConfig {
  id: string;
  name: string;
  role: string;
  modelType: 'elder' | 'commander' | 'academic' | 'soldier' | 'defender';
  position: THREE.Vector3;
  rotationY: number;
  dialogueSceneId: string;
  prompt: string;
  icon: string;
  interactRadius?: number;
}

export class NPCCharacter {
  public config: NPCConfig;
  public group: THREE.Group;
  public mixer: THREE.AnimationMixer | null = null;
  public isLoaded: boolean = false;

  constructor(config: NPCConfig) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = `NPC_${config.id}`;
    this.group.position.copy(config.position);
    this.group.rotation.y = config.rotationY;
  }

  public update(dt: number): void {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  public canInteract(playerPos: THREE.Vector3): boolean {
    const radius = this.config.interactRadius || 3.5;
    return this.group.position.distanceTo(playerPos) <= radius;
  }
}

export class NPCManager {
  private scene: THREE.Scene;
  public npcs: NPCCharacter[] = [];
  private loader: GLTFLoader = new GLTFLoader();

  // Cached template GLTFs
  private soldierGltf: any = null;
  private michelleGltf: any = null;
  private xbotGltf: any = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public async load(): Promise<void> {
    const michelleUrl = `${import.meta.env.BASE_URL}models/michelle.glb`;
    const soldierUrl = `${import.meta.env.BASE_URL}models/soldier.glb`;
    const xbotUrl = `${import.meta.env.BASE_URL}models/xbot.glb`;

    const [michelle, soldier, xbot] = await Promise.all([
      this.loader.loadAsync(michelleUrl).catch(() => null),
      this.loader.loadAsync(soldierUrl).catch(() => null),
      this.loader.loadAsync(xbotUrl).catch(() => null),
    ]);

    this.michelleGltf = michelle;
    this.soldierGltf = soldier;
    this.xbotGltf = xbot;

    this.initNPCs();
  }

  private initNPCs(): void {
    const configs: NPCConfig[] = [
      // Act I: The Cloud Forest — Lower Blockade
      {
        id: 'tomas_blockade',
        name: 'Tayta Tomas',
        role: 'Quechua Community Elder',
        modelType: 'elder',
        position: new THREE.Vector3(-100, getGlobalTerrainHeight(-100, -500), -500),
        rotationY: Math.PI * 0.15,
        dialogueSceneId: 'scene_act1_blockade',
        prompt: '<span style="color: #ffd875; font-weight: 700;">[E]</span> SPEAK WITH TAYTA TOMAS',
        icon: '🧔',
        interactRadius: 4.2,
      },
      {
        id: 'defender_blockade_1',
        name: 'Quechua Guardian',
        role: 'Community Defender',
        modelType: 'defender',
        position: new THREE.Vector3(-96, getGlobalTerrainHeight(-96, -498), -498),
        rotationY: -Math.PI * 0.25,
        dialogueSceneId: 'scene_act1_blockade',
        prompt: '<span style="color: #ffd875; font-weight: 700;">[E]</span> TALK TO DEFENDER',
        icon: '🛡️',
        interactRadius: 3.5,
      },
      {
        id: 'merc_dig_1',
        name: 'Sol Negro Sentry',
        role: 'Mercenary Patrol',
        modelType: 'soldier',
        position: new THREE.Vector3(152, getGlobalTerrainHeight(152, -295), -295),
        rotationY: Math.PI * 0.85,
        dialogueSceneId: 'scene_act2_outpost',
        prompt: '<span style="color: #f87171; font-weight: 700;">[E]</span> OVERHEAR MERCENARY',
        icon: '🪖',
        interactRadius: 3.8,
      },

      // Act II: The High Sierra — The Chakana Gate
      {
        id: 'vance_chakana',
        name: 'Dr. Elias Vance',
        role: 'Consultant Academic',
        modelType: 'academic',
        position: new THREE.Vector3(-78, getGlobalTerrainHeight(-78, 448), 448),
        rotationY: -Math.PI * 0.45,
        dialogueSceneId: 'scene_act2_chakana',
        prompt: '<span style="color: #ffd875; font-weight: 700;">[E]</span> APPROACH THE CHAKANA DISPUTE',
        icon: '📚',
        interactRadius: 4.5,
      },
      {
        id: 'tomas_chakana',
        name: 'Tayta Tomas',
        role: 'Quechua Community Elder',
        modelType: 'elder',
        position: new THREE.Vector3(-82, getGlobalTerrainHeight(-82, 452), 452),
        rotationY: Math.PI * 0.35,
        dialogueSceneId: 'scene_act2_chakana',
        prompt: '<span style="color: #ffd875; font-weight: 700;">[E]</span> LISTEN TO TAYTA TOMAS',
        icon: '🧔',
        interactRadius: 4.5,
      },

      // Act II: The High Sierra — The Mining Outpost
      {
        id: 'vargas_outpost',
        name: 'Vargas',
        role: 'Commander of Sol Negro',
        modelType: 'commander',
        position: new THREE.Vector3(120, getGlobalTerrainHeight(120, 650), 650),
        rotationY: Math.PI * 0.95,
        dialogueSceneId: 'scene_act2_outpost',
        prompt: '<span style="color: #f87171; font-weight: 700;">[E]</span> CONFRONT VARGAS',
        icon: '🎖️',
        interactRadius: 5.0,
      },
      {
        id: 'merc_outpost_1',
        name: 'Sol Negro Elite',
        role: 'Demolition Squad',
        modelType: 'soldier',
        position: new THREE.Vector3(124, getGlobalTerrainHeight(124, 646), 646),
        rotationY: Math.PI * 0.75,
        dialogueSceneId: 'scene_act2_outpost',
        prompt: '<span style="color: #f87171; font-weight: 700;">[E]</span> EXAMINE DYNAMITE CRATES',
        icon: '🧨',
        interactRadius: 3.5,
      },

      // Act III: The Jungle Lowlands — Vanguard Choke
      {
        id: 'tomas_vanguard',
        name: 'Tayta Tomas',
        role: 'Quechua Community Elder',
        modelType: 'elder',
        position: new THREE.Vector3(0, getGlobalTerrainHeight(0, -700), -700),
        rotationY: 0,
        dialogueSceneId: 'scene_act3_uku_pacha',
        prompt: '<span style="color: #ffd875; font-weight: 700;">[E]</span> CONSULT WITH TOMAS',
        icon: '🧔',
        interactRadius: 4.5,
      },

      // Act IV: Paititi Sanctuary
      {
        id: 'vargas_sanctuary',
        name: 'Vargas',
        role: 'Commander of Sol Negro',
        modelType: 'commander',
        position: new THREE.Vector3(800, getGlobalTerrainHeight(800, 0), 0),
        rotationY: Math.PI,
        dialogueSceneId: 'scene_act4_sanctuary',
        prompt: '<span style="color: #f87171; font-weight: 700;">[E]</span> STOP VARGAS',
        icon: '🎖️',
        interactRadius: 6.0,
      },
    ];

    for (const cfg of configs) {
      const npc = new NPCCharacter(cfg);
      this.buildNPCMesh(npc);
      this.scene.add(npc.group);
      this.npcs.push(npc);
    }
  }

  private buildNPCMesh(npc: NPCCharacter): void {
    const type = npc.config.modelType;

    if (type === 'commander' || type === 'soldier') {
      // Use Soldier rig for Vargas & Sol Negro mercenaries (base height 1.832m)
      if (this.soldierGltf) {
        const cloned = SkeletonUtils.clone(this.soldierGltf.scene);
        const targetHeight = type === 'commander' ? 1.84 : 1.78;
        const scale = targetHeight / 1.832;
        cloned.scale.setScalar(scale);
        cloned.position.y = 0;

        // Custom tactical military materials (charcoal/slate/olive)
        const darkTacticalMat = new THREE.MeshStandardMaterial({
          color: type === 'commander' ? 0x181a1b : 0x2c332d,
          roughness: 0.85,
          metalness: 0.12,
        });

        cloned.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            m.material = darkTacticalMat;
          }
        });

        // Attach idle animation
        npc.mixer = new THREE.AnimationMixer(cloned);
        const idleClip = this.soldierGltf.animations.find((c: THREE.AnimationClip) => c.name === 'Idle');
        if (idleClip) {
          const action = npc.mixer.clipAction(idleClip);
          action.play();
        }

        // Add sidearm holster / tactical radio prop
        if (type === 'commander') {
          const radioGroup = new THREE.Group();
          const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.04), ironDark());
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12), ironDark());
          antenna.position.set(0.02, 0.12, 0);
          radioGroup.add(radioBody);
          radioGroup.add(antenna);
          radioGroup.position.set(0.18, 1.25, 0.10);
          cloned.add(radioGroup);
        }

        npc.group.add(cloned);
        npc.isLoaded = true;
        return;
      }
    } else if (type === 'elder') {
      // Tayta Tomas — Quechua Elder with traditional woven poncho and staff (base height 1.664m)
      if (this.michelleGltf && this.soldierGltf) {
        const cloned = SkeletonUtils.clone(this.michelleGltf.scene);
        const scale = 1.68 / 1.664;
        cloned.scale.setScalar(scale);
        cloned.position.y = 0;

        // Rich Andean terracotta/crimson traditional poncho
        const ponchoMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d22, // Rich Andean madder crimson
          roughness: 0.95,
          metalness: 0.0,
        });

        cloned.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            m.material = ponchoMat;
          }
        });

        // Retarget Soldier's gentle Idle clip to elder rig
        npc.mixer = new THREE.AnimationMixer(cloned);
        const idleClip = this.soldierGltf.animations.find((c: THREE.AnimationClip) => c.name === 'Idle');
        if (idleClip) {
          const retargeted = retargetMixamoClip(idleClip, this.soldierGltf.scene, cloned);
          if (retargeted) {
            const action = npc.mixer.clipAction(retargeted);
            action.timeScale = 0.85; // Slightly slower, dignified breathing cycle
            action.play();
          }
        }

        // Add carved wooden walking staff
        const staffGeo = new THREE.CylinderGeometry(0.022, 0.028, 1.55, 7);
        const staffMesh = new THREE.Mesh(staffGeo, woodWet());
        staffMesh.position.set(0.32, 0.77, 0.18);
        staffMesh.rotation.set(0.08, 0, -0.05);
        staffMesh.castShadow = true;
        npc.group.add(staffMesh);

        npc.group.add(cloned);
        npc.isLoaded = true;
        return;
      }
    } else if (type === 'academic') {
      // Dr. Elias Vance — Academic field researcher with spectacles & clipboard
      const sourceGltf = this.xbotGltf || this.soldierGltf;
      if (sourceGltf) {
        const cloned = SkeletonUtils.clone(sourceGltf.scene);
        const scale = 1.0;
        cloned.scale.setScalar(scale);
        cloned.position.y = 0;

        const khakiMat = new THREE.MeshStandardMaterial({
          color: 0xc4b38d, // Academic field khaki
          roughness: 0.90,
          metalness: 0.0,
        });

        cloned.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            m.material = khakiMat;
          }
        });

        npc.mixer = new THREE.AnimationMixer(cloned);
        if (this.soldierGltf) {
          const idleClip = this.soldierGltf.animations.find((c: THREE.AnimationClip) => c.name === 'Idle');
          if (idleClip) {
            const rc = retargetMixamoClip(idleClip, this.soldierGltf.scene, cloned);
            if (rc) {
              npc.mixer.clipAction(rc).play();
            }
          }
        }

        // Clipboard prop
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.015), woodWet());
        board.position.set(-0.25, 1.05, 0.30);
        board.rotation.set(-0.4, 0.2, -0.1);
        npc.group.add(board);

        npc.group.add(cloned);
        npc.isLoaded = true;
        return;
      }
    }

    // Fallback: Styled procedural humanoid representation
    const bodyMat = clothField();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.75, 8), bodyMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    npc.group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), clothFieldDark());
    head.position.y = 1.58;
    head.castShadow = true;
    npc.group.add(head);

    npc.isLoaded = true;
  }

  public getNearbyInteractable(playerPos: THREE.Vector3): NPCCharacter | null {
    for (const npc of this.npcs) {
      if (npc.canInteract(playerPos)) {
        return npc;
      }
    }
    return null;
  }

  public update(dt: number): void {
    for (const npc of this.npcs) {
      npc.update(dt);
    }
  }

  public getNPCById(id: string): NPCCharacter | undefined {
    return this.npcs.find((n) => n.config.id === id);
  }
}
