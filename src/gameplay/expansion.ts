/**
 * Module: src/gameplay/expansion.ts
 * Responsibility: "Echoes of Vilcabamba" mid-game mission flags, Condor Viewpoint
 * synchronization, and Rest-Until-Time-of-Day camp transitions per Bible §3.6 & §3.9.
 * Depends on: src/core/save.ts, src/gpu/lightRig.ts.
 * Exports: ExpansionSystem.
 */

import { SaveManager } from '../core/save';
import { LightRig, TimeOfDayGrade } from '../gpu/lightRig';

export class ExpansionSystem {
  public readonly viewpointIds: readonly string[] = [
    'viewpoint_cloud_forest',
    'viewpoint_high_sierra',
    'viewpoint_vilcabamba_river',
    'viewpoint_paititi_gate',
  ];

  public build(): void {
    // Viewpoint registry initialized
  }

  public synchronizeViewpoint(id: string, save: SaveManager): void {
    const state = save.getState();
    if (!state.unlockedViewpoints.includes(id)) {
      state.unlockedViewpoints.push(id);
    }
    save.setQuestFlag('q_cf_viewpoint_synced', true);
    save.setQuestFlag('q_exp_condor_synced', true);
    save.addJournalEntry(
      'Cloud Forest Ridge: From the condor perch above the waterfall gorge, the old stone road traces north toward the high sierra passes.'
    );
  }

  public restUntilTimeOfDay(
    grade: TimeOfDayGrade,
    lightRig: LightRig,
    save: SaveManager
  ): void {
    lightRig.applyGrade(grade);
    save.getState().timeOfDay = grade;
    save.persist();
  }

  public update(_dt: number): void {
    // Triggered by viewpoint synchronization and camp rest actions
  }

  public dispose(): void {
    // Stateless coordinator
  }
}
