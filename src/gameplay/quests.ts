/**
 * Module: src/gameplay/quests.ts
 * Responsibility: 12-chapter story spine (§1.6), Phase 1 Cloud Forest vertical slice
 * quest objectives (cross the hanging bridge, read the water-reckoning stele,
 * synchronize at the Condor Viewpoint), and quest flag tracking per Bible §3.6.
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

  public build(save: SaveManager): void {
    this.refreshObjectiveFromFlags(save);
    this.objectiveBannerTimer = 5.0;
  }

  public refreshObjectiveFromFlags(save: SaveManager): void {
    const flags = save.getState().questFlags;
    if (!flags.q_cf_stele_read) {
      this.activeObjectiveText =
        'Cross the hanging bridge and read the carved Inca stele by the running water channel.';
    } else if (!flags.q_cf_viewpoint_synced) {
      this.activeObjectiveText =
        'Ascend the stone terrace steps to synchronize at the Cloud Forest Condor Viewpoint.';
    } else {
      this.activeObjectiveText =
        'Cloud Forest vertical slice complete — explore the valley or review Naira’s journal [J].';
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
