import * as THREE from 'three';
import type { QuestFlagAPI } from '../save/questFlags.js';
import type { SOTTRHUD } from '../hud.js';
import { DialogueSystem } from './dialogueSystem.js';
import { NPCManager, type NPCCharacter } from './characters.js';

export interface FieldJournalEntry {
  id: string;
  act: number;
  entryNumber: string;
  title: string;
  unlockedFlag?: string;
  date: string;
  audioDuration: string;
  transcript: string;
}

export const FIELD_JOURNAL_ENTRIES: FieldJournalEntry[] = [
  {
    id: 'entry_01',
    act: 1,
    entryNumber: 'ENTRY 01',
    title: 'THE LÓPEZ LETTER',
    date: '14 OCT — EXPEDITION DAY 03',
    audioDuration: '0:42',
    transcript: 'I’ve read the López letter a hundred times. A Jesuit priest in Rome, sixteen-hundred, writing about a golden king deep in the Amazon. He never even saw it. But Vargas... he\'s treating it like a geological survey. Sol Negro is tearing apart the cloud forest. They don’t care about Paititi as history, they just want the land cleared and the artifacts fenced before the local community can file a heritage injunction. I have to find the trail first, to give the people here the proof they need to stop the bulldozers.',
  },
  {
    id: 'entry_03',
    act: 1,
    entryNumber: 'ENTRY 03',
    title: 'THE ROYAL KHIPU',
    unlockedFlag: 'q_act1_quipu_solved',
    date: '16 OCT — EXPEDITION DAY 05',
    audioDuration: '0:38',
    transcript: 'The artifacts in this ruin... they\'re pointing deeper into the Antisuyu. It’s a khipu. A massive one. I found hair braided into the primary cord. It’s a signature. Someone from a royal panaca made this. They were recording a massive relocation. Moving thousands of people, moving the stones themselves, away from Cusco. Away from the Spanish. They were building the refuge. Paititi is real.',
  },
  {
    id: 'entry_07',
    act: 2,
    entryNumber: 'ENTRY 07',
    title: 'THE CEQUE LINES',
    unlockedFlag: 'q_act2_chakana_reached',
    date: '19 OCT — EXPEDITION DAY 08',
    audioDuration: '0:35',
    transcript: 'The coordinates track back to the Coricancha. The navel of the world. But it\'s not a straight line into the jungle. It follows the ceques. The ritual lines. I\'m starting to think this wasn\'t just an evacuation. It was a pilgrimage. They moved along the sacred geometry of the empire to find the exact place to rebuild.',
  },
  {
    id: 'entry_12',
    act: 2,
    entryNumber: 'ENTRY 12',
    title: 'THE CHAKANA BRIDGE',
    unlockedFlag: 'q_act2_chakana_solved',
    date: '21 OCT — EXPEDITION DAY 10',
    audioDuration: '0:44',
    transcript: 'Ran into Vargas\'s academic consultant today. He was confidently explaining to the community elders that the Chakana represents the "three worlds". I didn\'t have the heart to tell him that’s a modern invention. The Inca didn’t map it like that. It’s a bridge. An astronomical tool. When you look at the stones... when you really look at them... they aren\'t telling stories. They\'re doing math with the stars.',
  },
  {
    id: 'entry_15',
    act: 2,
    entryNumber: 'ENTRY 15',
    title: 'THE ESCALATION',
    unlockedFlag: 'q_act2_outpost_confrontation',
    date: '23 OCT — EXPEDITION DAY 12',
    audioDuration: '0:50',
    transcript: 'Vargas doesn\'t even want the city. We found his survey maps. The ruins sit on one of the largest rare-earth deposits in the hemisphere. He wants to obliterate Paititi so there\'s nothing left to protect. If he destroys the ruins, the community loses their ancestral claim to the land, and the mining conglomerate moves in. This isn\'t just about archaeology anymore. It\'s about their home.',
  },
  {
    id: 'entry_19',
    act: 3,
    entryNumber: 'ENTRY 19',
    title: 'UKU PACHA',
    unlockedFlag: 'q_act3_amaru_navigated',
    date: '26 OCT — EXPEDITION DAY 15',
    audioDuration: '0:39',
    transcript: 'We are going down. Deep into the cave systems. Vargas is using explosives, brute-forcing his way through. Every blast brings down half the ceiling. The geology here is so fragile... or maybe it\'s Pachamama reacting. The locals call this Uku Pacha. The womb. It feels... fertile. We have to tread lightly, or the mountain will swallow us all.',
  },
  {
    id: 'entry_22',
    act: 3,
    entryNumber: 'ENTRY 22',
    title: 'THE AMARU GUIDE',
    unlockedFlag: 'q_act3_tunnels_survived',
    date: '28 OCT — EXPEDITION DAY 17',
    audioDuration: '0:36',
    transcript: 'Serpent carvings everywhere. The Amaru. The mercenaries shoot at them, thinking they mark traps. They don\'t understand. The serpent isn\'t a monster. It’s a guide. I followed the water flow, the path of the serpent, and the way just... opened. You don\'t fight the Amaru. You learn from it.',
  },
  {
    id: 'entry_25',
    act: 3,
    entryNumber: 'ENTRY 25',
    title: 'THE VANGUARD',
    unlockedFlag: 'q_act3_vanguard_secured',
    date: '30 OCT — EXPEDITION DAY 19',
    audioDuration: '0:37',
    transcript: 'I\'m not alone down here. The community leaders, Tomas and the others, they know these caves better than Vargas ever could. They\'ve secured the upper tunnels, cutting off his reinforcements. I just need to reach the final doors before Vargas sets his main charges. We do this together.',
  },
  {
    id: 'entry_28',
    act: 4,
    entryNumber: 'ENTRY 28',
    title: 'THE ALIGNMENT APERTURE',
    unlockedFlag: 'q_act4_paititi_entered',
    date: '02 NOV — EXPEDITION DAY 22',
    audioDuration: '0:34',
    transcript: 'I found it. Paititi. Untouched. The Spanish never made it here. The scale of it... it’s not just a city, it\'s a massive observatory. Waiting for the sun. The stonework is pristine. And Vargas is rigging it to blow.',
  },
  {
    id: 'entry_31',
    act: 4,
    entryNumber: 'ENTRY 31',
    title: 'COMMUNION',
    unlockedFlag: 'q_act4_observatory_aligned',
    date: '03 NOV — EXPEDITION DAY 23',
    audioDuration: '0:56',
    transcript: 'The light hit the central disk. I thought it was just a mechanism. A puzzle. But when the alignment completed... the light flooded the valley. The resonance... it felt like the sun itself was looking at us. Vargas panicked. The mountain came down on his detonators, and the earth took him. Now... I\'m looking out over the plaza with Tomas. The city is safe. The land belongs to the people who never left. History missed so much, but it\'s still here. And they are still here.',
  },
];

export class StoryManager {
  private flags: QuestFlagAPI;
  private hud: SOTTRHUD;
  public dialogueSystem: DialogueSystem;
  public npcManager: NPCManager;

  constructor(flags: QuestFlagAPI, hud: SOTTRHUD, dialogueSystem: DialogueSystem, npcManager: NPCManager) {
    this.flags = flags;
    this.hud = hud;
    this.dialogueSystem = dialogueSystem;
    this.npcManager = npcManager;

    // Listen for dialogue completions to trigger quest stage advancements
    this.dialogueSystem.onComplete((sceneId, flag) => {
      if (flag) {
        this.flags.set(flag);
      }
      this.syncActiveObjective();
    });

    // Sync initial objective
    this.syncActiveObjective();
  }

  public syncActiveObjective(): void {
    if (!this.flags.has('q_act1_met_tomas')) {
      this.hud.setObjective(
        'THE LOWER BLOCKADE',
        'Speak with Tayta Tomas at the Quechua community barricade',
        new THREE.Vector3(-100, 24.8, -500)
      );
    } else if (!this.flags.has('q_act1_ruin_infiltrated')) {
      this.hud.setObjective(
        'INFILTRATE EXCAVATION',
        'Bypass Sol Negro patrols and breach the excavated ruin perimeter',
        new THREE.Vector3(150, 21.0, -300)
      );
    } else if (!this.flags.has('q_act1_quipu_solved')) {
      this.hud.setObjective(
        'THE QUIPU CIPHER',
        'Examine the braided royal panaca khipu in the subterranean archive',
        new THREE.Vector3(150, 2.2, -350)
      );
    } else if (!this.flags.has('q_act2_chakana_reached')) {
      this.hud.setObjective(
        'ASCEND CLIFF STAIRCASE',
        'Climb the ancient cliff staircase into the high Andean sierra',
        new THREE.Vector3(200, 22.0, 80)
      );
    } else if (!this.flags.has('q_act2_chakana_solved')) {
      this.hud.setObjective(
        'THE CONTESTED CHAKANA',
        'Align the Southern Cross celestial bridge on the monolithic gate',
        new THREE.Vector3(-80, 48.0, 450)
      );
    } else if (!this.flags.has('q_act2_outpost_confrontation')) {
      this.hud.setObjective(
        'CONFRONT VARGAS',
        'Halt Sol Negro demolition squad at the high mountain mining outpost',
        new THREE.Vector3(120, 68.0, 650)
      );
    } else if (!this.flags.has('q_act3_amaru_navigated')) {
      this.hud.setObjective(
        'DESCENT INTO UKU PACHA',
        'Follow the Amaru water canals deep into the subterranean caverns',
        new THREE.Vector3(-100, -12.0, -550)
      );
    } else if (!this.flags.has('q_act3_vanguard_secured')) {
      this.hud.setObjective(
        'HOLD THE VANGUARD',
        'Reinforce Tayta Tomas and the community defenders at the cavern choke',
        new THREE.Vector3(0, -12.0, -700)
      );
    } else if (!this.flags.has('q_act4_paititi_entered')) {
      this.hud.setObjective(
        'THE LOST CITY',
        'Navigate the submerged passage and emerge into the Sanctuary of Inti',
        new THREE.Vector3(700, 30.0, 0)
      );
    } else if (!this.flags.has('q_act4_observatory_aligned')) {
      this.hud.setObjective(
        'SOLAR ALIGNMENT',
        'Align the golden Punchao disk before Vargas detonates the sanctuary',
        new THREE.Vector3(800, 32.0, 0)
      );
    } else {
      this.hud.setObjective(
        'COMMUNION WITH INTI',
        'Paititi is secured and ancestral Andean heritage is preserved forever',
        new THREE.Vector3(700, 30.0, 0)
      );
    }
  }

  public getUnlockedJournalEntries(): FieldJournalEntry[] {
    return FIELD_JOURNAL_ENTRIES.filter((entry) => {
      if (!entry.unlockedFlag) return true; // Entry 01 unlocked at boot
      return this.flags.has(entry.unlockedFlag);
    });
  }

  public checkPlayerInteraction(playerPos: THREE.Vector3): NPCCharacter | null {
    if (this.dialogueSystem.isDialogueActive) return null;
    return this.npcManager.getNearbyInteractable(playerPos);
  }

  public triggerInteraction(npc: NPCCharacter): void {
    if (this.dialogueSystem.isDialogueActive) return;
    this.dialogueSystem.startScene(npc.config.dialogueSceneId);
  }
}
