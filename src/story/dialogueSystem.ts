import * as THREE from 'three';
import type { AudioDirector } from '../audio/engine.js';

export interface DialogueLine {
  speaker: 'NAIRA' | 'TOMAS' | 'VARGAS' | 'VANCE' | 'DEFENDER' | 'MERCENARY';
  speakerName: string;
  speakerRole: string;
  speakerColor: string;
  icon: string;
  stageDirection?: string;
  text: string;
  audioCue?: 'quena' | 'drum' | 'tension';
  cameraShot?: {
    eyeOffset: THREE.Vector3;
    lookOffset: THREE.Vector3;
  };
}

export interface DialogueScene {
  id: string;
  title: string;
  act: number;
  lines: DialogueLine[];
  onCompleteFlag?: string;
  nextObjective?: {
    title: string;
    task: string;
    targetPos?: THREE.Vector3;
  };
}

export const DIALOGUE_SCENES: Record<string, DialogueScene> = {
  // Act I: The Cloud Forest — The Lower Blockade
  scene_act1_blockade: {
    id: 'scene_act1_blockade',
    title: 'THE LOWER BLOCKADE',
    act: 1,
    onCompleteFlag: 'q_act1_met_tomas',
    nextObjective: {
      title: 'INFILTRATE EXCAVATION',
      task: 'Bypass Sol Negro patrols and find the underground Quipu Archive',
      targetPos: new THREE.Vector3(150, 21.0, -300),
    },
    lines: [
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Standing beside the felled timber barricade, leaning on his carved wooden staff',
        text: 'You walk like someone from the city, but you look at the mountain with eyes that understand. Are you with the mining company, or are you here for the stones?',
        audioCue: 'quena',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Unhooking her field pack, showing her university credentials and topological charts',
        text: 'I\'m Naira Quispe. I was a mountain guide here before I became an archaeologist. I heard Sol Negro brought heavy bulldozers into the cloud forest.',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Gazing gravely through the rising valley fog toward the floodlit dig site',
        text: 'Vargas has mercenaries everywhere. They found an old Jesuit letter from Rome—Father López, 1600. It spoke of a golden city deep in Antisuyu. But Vargas does not care about our ancestors. He wants to tear down the walls so the state declares this open land for an illegal mine.',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Checking the tension on her recurve bow',
        text: 'If I can document an unbroken archaeological record before they dynamite the lower chambers, your community can file an emergency federal heritage injunction.',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Handing Naira an ancient woven cord sample',
        text: 'In the excavated ruin ahead, they uncovered a royal khipu archive. Look for human hair braided into the primary cords—the signature of the royal panaca. That is the truth they are trying to bury. Walk softly, daughter.',
        audioCue: 'quena',
      },
    ],
  },

  // Act II: The High Sierra — The Contested Chakana
  scene_act2_chakana: {
    id: 'scene_act2_chakana',
    title: 'THE CONTESTED CHAKANA',
    act: 2,
    onCompleteFlag: 'q_act2_chakana_solved',
    nextObjective: {
      title: 'ALIGN SAYHUITE MONOLITH',
      task: 'Manipulate mountain water flow across the 3D map table',
      targetPos: new THREE.Vector3(120, 68.0, 650),
    },
    lines: [
      {
        speaker: 'VANCE',
        speakerName: 'DR. ELIAS VANCE',
        speakerRole: 'Consultant Academic',
        speakerColor: '#cbd5e1',
        icon: '📚',
        stageDirection: 'Tracing the massive stone steps of the carved cross on the monolithic gate',
        text: 'It’s brilliant, really! The classic Andean cosmological map. Three steps: Hanan Pacha, Kay Pacha, Uku Pacha. If we just align the pressure plates to the three worlds—',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Shaking his head with quiet conviction',
        text: 'You are reading a tourist brochure, Doctor.',
        audioCue: 'quena',
      },
      {
        speaker: 'VANCE',
        speakerName: 'DR. ELIAS VANCE',
        speakerRole: 'Consultant Academic',
        speakerColor: '#cbd5e1',
        icon: '📚',
        stageDirection: 'Adjusting his spectacles, gesturing impatiently',
        text: 'The symbolism is universal, Tomas. Every academic text—',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Slotting a polished bronze mirror into the center aperture of the Chakana',
        text: 'Every text written in the last fifty years. The Inca didn’t map it like that. It’s a bridge. It doesn\'t point to heaven or hell. It points to the Southern Cross. It’s celestial math.',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Smiling as the sunbeam strikes the mirror and unlatches the massive counterweight',
        text: 'The stars do not lie for tourists. The gate opens.',
      },
    ],
  },

  // Act II: The High Sierra — The Mining Claim Outpost
  scene_act2_outpost: {
    id: 'scene_act2_outpost',
    title: 'THE MINING CLAIM',
    act: 2,
    onCompleteFlag: 'q_act2_outpost_confrontation',
    nextObjective: {
      title: 'DESCEND INTO UKU PACHA',
      task: 'Enter the ancient cavern paqarina down into the subterranean world',
      targetPos: new THREE.Vector3(-100, -12.0, -550),
    },
    lines: [
      {
        speaker: 'VARGAS',
        speakerName: 'VARGAS',
        speakerRole: 'Commander of Sol Negro',
        speakerColor: '#f87171',
        icon: '🎖️',
        stageDirection: 'Standing atop the stone bastion, mercenaries armed with assault rifles flanking him',
        text: 'You’re disappointed, Dr. Quispe. You thought we were chasing El Dorado. But this outpost... it’s just rocks.',
        audioCue: 'tension',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Grip firm on her bow, standing tall against the wind',
        text: 'You knew Paititi wasn\'t here. You\'re just destroying the trail.',
      },
      {
        speaker: 'VARGAS',
        speakerName: 'VARGAS',
        speakerRole: 'Commander of Sol Negro',
        speakerColor: '#f87171',
        icon: '🎖️',
        stageDirection: 'Tapping a surveyor\'s lithium and neodymium geological map on his folding table',
        text: 'The antiquities are a side hustle. This valley sits on the largest rare-earth deposit in the hemisphere. But the government won\'t grant the concession if your friends here can prove it\'s an unbroken ancestral site.',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Voice steady with righteous indignation',
        text: 'So you erase the history.',
      },
      {
        speaker: 'VARGAS',
        speakerName: 'VARGAS',
        speakerRole: 'Commander of Sol Negro',
        speakerColor: '#f87171',
        icon: '🎖️',
        stageDirection: 'Smirking coldly as he signals his demolition squad to prime dynamite charges',
        text: 'I clear the land. A few explosions, a tragic landslide... no ruins, no heritage claim. Just open ground.',
        audioCue: 'tension',
      },
    ],
  },

  // Act III: The Jungle Lowlands — The Womb, Not the Tomb
  scene_act3_uku_pacha: {
    id: 'scene_act3_uku_pacha',
    title: 'THE WOMB, NOT THE TOMB',
    act: 3,
    onCompleteFlag: 'q_act3_amaru_navigated',
    nextObjective: {
      title: 'HOLD THE VANGUARD BARRICADE',
      task: 'Rally with Tayta Tomas at the subterranean chokepoint',
      targetPos: new THREE.Vector3(0, -12.0, -700),
    },
    lines: [
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Looking nervously at the cavern ceiling as subterranean dynamite blasts rattle the stalactites',
        text: 'Vargas is blasting the tunnels above us. The rock is completely unstable.',
        audioCue: 'tension',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Resting a weathered hand flat against the vibrating living stone wall',
        text: 'They blast because they are afraid of the dark. They think Uku Pacha is hell.',
        audioCue: 'quena',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Wiping wet condensation and cave silt from her cheek',
        text: 'It feels like a tomb.',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'Pointing to a subtle spiral carved into the floor, untouched by the falling debris',
        text: 'We are not buried, Naira. We are planted. The Amaru travels here because the earth is full of water. Do not walk like a conqueror. Walk softly. Let the mountain decide.',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Stepping into the spiral stream with deep breath and newfound focus',
        text: 'The Amaru isn\'t a trap. It\'s an irrigation canal. Follow the water.',
      },
    ],
  },

  // Act IV: Paititi — The Solar Alignment
  scene_act4_sanctuary: {
    id: 'scene_act4_sanctuary',
    title: 'THE SOLAR ALIGNMENT',
    act: 4,
    onCompleteFlag: 'q_act4_observatory_aligned',
    nextObjective: {
      title: 'COMMUNION WITH INTI',
      task: 'Paititi is secured and ancestral land rights are defended forever',
      targetPos: new THREE.Vector3(700, 30.0, 0),
    },
    lines: [
      {
        speaker: 'VARGAS',
        speakerName: 'VARGAS',
        speakerRole: 'Commander of Sol Negro',
        speakerColor: '#f87171',
        icon: '🎖️',
        stageDirection: 'Back pressed against the carved observatory pillar, clutching an electronic detonator',
        text: 'Look at the scale of it! I can\'t bury this. It\'s too big! But I can break it. Back away, or I blow the central pillars!',
        audioCue: 'tension',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Stepping fearlessly between Vargas\'s detonator and the massive golden Punchao disk',
        text: 'You still don\'t see it, do you? You look at this magnificent civilization and all you see is an obstacle to exploit.',
      },
      {
        speaker: 'VARGAS',
        speakerName: 'VARGAS',
        speakerRole: 'Commander of Sol Negro',
        speakerColor: '#f87171',
        icon: '🎖️',
        stageDirection: 'Finger hovering over the detonator toggle, sweating profusely',
        text: 'It\'s just rock in my way! MOVE!',
      },
      {
        speaker: 'NAIRA',
        speakerName: 'NAIRA QUISPE',
        speakerRole: 'Field Archaeologist',
        speakerColor: '#ffd777',
        icon: '🏹',
        stageDirection: 'Looking up through the stone aperture as the afternoon Andean solstice sun locks into place',
        text: 'The sun is setting, Vargas.',
      },
      {
        speaker: 'TOMAS',
        speakerName: 'TAYTA TOMAS',
        speakerRole: 'Quechua Community Elder',
        speakerColor: '#86efac',
        icon: '🧔',
        stageDirection: 'The light aligns through the window, striking the disk. A blinding, tonal resonance fills the sanctuary',
        text: 'The sun is awake. And you are trespassing.',
        audioCue: 'quena',
      },
    ],
  },
};

export class DialogueSystem {
  public isDialogueActive: boolean = false;
  public currentScene: DialogueScene | null = null;
  public currentLineIndex: number = 0;

  private container: HTMLDivElement;
  private speakerTag: HTMLDivElement;
  private speakerIcon: HTMLSpanElement;
  private speakerNameEl: HTMLSpanElement;
  private speakerRoleEl: HTMLSpanElement;
  private dialogueTextEl: HTMLParagraphElement;
  private stageDirectionEl: HTMLParagraphElement;
  private promptBar: HTMLDivElement;
  private letterboxTop: HTMLDivElement;
  private letterboxBottom: HTMLDivElement;

  private audioDirector: AudioDirector | null = null;
  private onSceneCompleteCallbacks: Array<(sceneId: string, nextFlag?: string) => void> = [];

  constructor(audioDirector?: AudioDirector) {
    this.audioDirector = audioDirector || null;

    // Root UI container
    this.container = document.createElement('div');
    this.container.id = 'cinematic-dialogue-root';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '9800';
    this.container.style.display = 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'space-between';
    this.container.style.boxSizing = 'border-box';
    this.container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

    // Cinematic Letterbox Bars
    this.letterboxTop = document.createElement('div');
    this.letterboxTop.style.width = '100%';
    this.letterboxTop.style.height = '64px';
    this.letterboxTop.style.background = '#080c0a';
    this.letterboxTop.style.boxShadow = '0 4px 20px rgba(0,0,0,0.8)';
    this.container.appendChild(this.letterboxTop);

    // Dialogue Overlay Plaque (Bottom 30%)
    const plaqueWrap = document.createElement('div');
    plaqueWrap.style.width = '100%';
    plaqueWrap.style.padding = '0 32px 32px 32px';
    plaqueWrap.style.boxSizing = 'border-box';
    plaqueWrap.style.display = 'flex';
    plaqueWrap.style.flexDirection = 'column';
    plaqueWrap.style.alignItems = 'center';
    plaqueWrap.style.pointerEvents = 'auto';

    const plaque = document.createElement('div');
    plaque.style.width = '100%';
    plaque.style.maxWidth = '880px';
    plaque.style.background = 'radial-gradient(ellipse at top, rgba(20, 26, 22, 0.96) 0%, rgba(10, 14, 12, 0.98) 100%)';
    plaque.style.border = '1px solid rgba(212, 175, 88, 0.45)';
    plaque.style.borderRadius = '8px';
    plaque.style.padding = '22px 28px';
    plaque.style.boxSizing = 'border-box';
    plaque.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    plaque.style.userSelect = 'none';

    // Header: Speaker tag & affiliation
    this.speakerTag = document.createElement('div');
    this.speakerTag.style.display = 'flex';
    this.speakerTag.style.alignItems = 'center';
    this.speakerTag.style.gap = '10px';
    this.speakerTag.style.marginBottom = '10px';

    this.speakerIcon = document.createElement('span');
    this.speakerIcon.style.fontSize = '20px';
    this.speakerTag.appendChild(this.speakerIcon);

    this.speakerNameEl = document.createElement('span');
    this.speakerNameEl.style.fontSize = '14px';
    this.speakerNameEl.style.fontWeight = '800';
    this.speakerNameEl.style.letterSpacing = '1.8px';
    this.speakerTag.appendChild(this.speakerNameEl);

    const divider = document.createElement('span');
    divider.textContent = '•';
    divider.style.color = 'rgba(212, 175, 88, 0.4)';
    this.speakerTag.appendChild(divider);

    this.speakerRoleEl = document.createElement('span');
    this.speakerRoleEl.style.fontSize = '12px';
    this.speakerRoleEl.style.fontWeight = '600';
    this.speakerRoleEl.style.color = '#9ab098';
    this.speakerRoleEl.style.letterSpacing = '1px';
    this.speakerTag.appendChild(this.speakerRoleEl);

    plaque.appendChild(this.speakerTag);

    // Stage Direction Sub-line (if applicable)
    this.stageDirectionEl = document.createElement('p');
    this.stageDirectionEl.style.margin = '0 0 10px 0';
    this.stageDirectionEl.style.fontSize = '12px';
    this.stageDirectionEl.style.fontStyle = 'italic';
    this.stageDirectionEl.style.color = '#a0af9f';
    this.stageDirectionEl.style.lineHeight = '1.4';
    plaque.appendChild(this.stageDirectionEl);

    // Dialogue Body Text
    this.dialogueTextEl = document.createElement('p');
    this.dialogueTextEl.style.margin = '0';
    this.dialogueTextEl.style.fontSize = '16px';
    this.dialogueTextEl.style.lineHeight = '1.6';
    this.dialogueTextEl.style.fontWeight = '500';
    this.dialogueTextEl.style.color = '#f5f3ec';
    this.dialogueTextEl.style.letterSpacing = '0.4px';
    plaque.appendChild(this.dialogueTextEl);

    // Footer Prompt
    this.promptBar = document.createElement('div');
    this.promptBar.style.display = 'flex';
    this.promptBar.style.justifyContent = 'flex-end';
    this.promptBar.style.gap = '16px';
    this.promptBar.style.marginTop = '16px';
    this.promptBar.style.fontSize = '11px';
    this.promptBar.style.fontWeight = '700';
    this.promptBar.style.color = '#ffd777';
    this.promptBar.style.letterSpacing = '1px';
    this.promptBar.innerHTML = `
      <span>[CLICK / SPACE] CONTINUE ▶</span>
      <span style="color: #88988a; cursor: pointer;">[ESC] SKIP</span>
    `;
    plaque.appendChild(this.promptBar);

    plaqueWrap.appendChild(plaque);
    this.container.appendChild(plaqueWrap);

    // Bottom Letterbox
    this.letterboxBottom = document.createElement('div');
    this.letterboxBottom.style.width = '100%';
    this.letterboxBottom.style.height = '64px';
    this.letterboxBottom.style.background = '#080c0a';
    this.letterboxBottom.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.8)';
    this.container.appendChild(this.letterboxBottom);

    document.body.appendChild(this.container);

    // Click to advance
    plaque.addEventListener('click', () => {
      this.advanceLine();
    });

    // Keyboard events
    window.addEventListener('keydown', (e) => {
      if (!this.isDialogueActive) return;
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        this.advanceLine();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.endDialogue();
      }
    });
  }

  public startScene(sceneId: string): boolean {
    const scene = DIALOGUE_SCENES[sceneId];
    if (!scene) {
      console.warn(`Dialogue scene not found: ${sceneId}`);
      return false;
    }

    this.currentScene = scene;
    this.currentLineIndex = 0;
    this.isDialogueActive = true;
    this.container.style.display = 'flex';

    this.presentLine();
    return true;
  }

  public advanceLine(): void {
    if (!this.currentScene) return;

    this.currentLineIndex++;
    if (this.currentLineIndex >= this.currentScene.lines.length) {
      this.endDialogue();
    } else {
      this.presentLine();
    }
  }

  private presentLine(): void {
    if (!this.currentScene) return;
    const line = this.currentScene.lines[this.currentLineIndex];
    if (!line) return;

    this.speakerIcon.textContent = line.icon || '💬';
    this.speakerNameEl.textContent = line.speakerName;
    this.speakerNameEl.style.color = line.speakerColor || '#ffd777';
    this.speakerRoleEl.textContent = line.speakerRole;

    if (line.stageDirection) {
      this.stageDirectionEl.style.display = 'block';
      this.stageDirectionEl.textContent = `(${line.stageDirection})`;
    } else {
      this.stageDirectionEl.style.display = 'none';
    }

    this.dialogueTextEl.textContent = `"${line.text}"`;

    if (line.audioCue && this.audioDirector) {
      if (line.audioCue === 'quena') {
        this.audioDirector.play('quena', { volume: 0.7 });
      } else if (line.audioCue === 'tension') {
        this.audioDirector.setIntensity('tension');
      }
    }
  }

  public endDialogue(): void {
    if (!this.isDialogueActive || !this.currentScene) return;

    const completedScene = this.currentScene;
    this.isDialogueActive = false;
    this.currentScene = null;
    this.container.style.display = 'none';

    for (const cb of this.onSceneCompleteCallbacks) {
      cb(completedScene.id, completedScene.onCompleteFlag);
    }
  }

  public onComplete(cb: (sceneId: string, nextFlag?: string) => void): () => void {
    this.onSceneCompleteCallbacks.push(cb);
    return () => {
      const idx = this.onSceneCompleteCallbacks.indexOf(cb);
      if (idx !== -1) this.onSceneCompleteCallbacks.splice(idx, 1);
    };
  }

  public dispose(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
