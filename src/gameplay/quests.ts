/**
 * Module: src/gameplay/quests.ts
 * Responsibility: 12-chapter story spine (§1.6), multi-region quest objectives
 * (Cloud Forest, High Sierra, Jungle Lowlands, Paititi), and quest flag tracking per Bible §3.6.
 * Depends on: src/core/save.ts.
 * Exports: ChapterTitle, QuestManager.
 */

import { SaveManager } from '../core/save';

export const CHAPTER_TITLES: readonly string[] = [
  '1. The Quipu Fragment',
  '2. The Dig',
  '3. The Valley Speaks',
  '4. The High Pass',
  '5. The Terraces',
  '6. The Descent',
  '7. The Green Ruins',
  '8. The River Road',
  '9. The Keepers',
  '10. The City That Was Never Lost',
  '11. The Decision',
  '12. Home',
];

export class QuestManager {
  private activeObjectiveText: string =
    'Cross the cloud-forest hanging bridge and examine the carved Inca water stele.';
  private objectiveBannerTimer: number = 5.0; // §3.11 fades after 5 seconds

  public build(save: SaveManager, activeRegion?: string): void {
    this.refreshObjectiveFromFlags(save, activeRegion);
    this.objectiveBannerTimer = 5.0;
  }

  public refreshObjectiveFromFlags(save: SaveManager, activeRegion?: string): void {
    const flags = save.getState().questFlags;
    const region = activeRegion || save.getState().regionId;

    if (region === 'highSierra') {
      if (!flags.q_hs_solar_aligned) {
        this.activeObjectiveText =
          'Follow the Apacheta stone road and align the bronze solar mirror with the Intihuatana gnomon [E].';
      } else {
        this.activeObjectiveText =
          'Solar alignment complete — the eastern pass into the Antisuyu jungle is revealed.';
      }
    } else if (region === 'jungleLowlands') {
      if (!flags.q_jl_sluice_opened) {
        this.activeObjectiveText =
          'Descend into the sunken stepped cenote and open the Antisuyu hydraulic sluice gate [E].';
      } else {
        this.activeObjectiveText =
          'Cenote drained — enter the revealed submerged serpent tunnel leading to Paititi.';
      }
    } else if (region === 'paititi') {
      if (!flags.q_exp_sanctum_claimed) {
        this.activeObjectiveText =
          'Ascend the Coricancha terraces to the Grand Quipu Archive and claim the sanctuary [E].';
      } else {
        this.activeObjectiveText =
          'Paititi secured (Chapter 12 — Home). The living heritage of the Andes remains protected.';
      }
    } else {
      // Cloud Forest (default)
      if (!flags.q_cf_stele_read) {
        this.activeObjectiveText =
          'Cross the hanging bridge and read the carved Inca stele by the running water channel [E].';
      } else if (!flags.q_cf_viewpoint_synced) {
        this.activeObjectiveText =
          'Ascend the stone terrace steps to synchronize at the Cloud Forest Condor Viewpoint [C].';
      } else {
        this.activeObjectiveText =
          'Cloud Forest vertical slice complete — journey forward through the mountain pass [E].';
      }
    }
    this.objectiveBannerTimer = 5.0;
  }

  public getActiveObjective(): string {
    return this.activeObjectiveText;
  }

  public isObjectiveBannerVisible(): boolean {
    return this.objectiveBannerTimer > 0;
  }

  public showObjectiveBanner(): void {
    this.objectiveBannerTimer = 5.0;
  }

  public update(dt: number): void {
    if (this.objectiveBannerTimer > 0) {
      this.objectiveBannerTimer = Math.max(0, this.objectiveBannerTimer - dt);
    }
  }

  public dispose(): void {
    this.objectiveBannerTimer = 0;
  }
}
