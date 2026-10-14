/**
 * Module: src/ui/journal.ts
 * Responsibility: Naira's leather-bound handwritten Field Journal (J) with
 * hand-drawn Cloud Forest valley map, chapter objectives, quipu fragments, and
 * field notes per Bible §3.7 and §3.11.
 * Depends on: src/core/save.ts, src/gameplay/quests.ts.
 * Exports: JournalOverlay.
 */

import { SaveManager } from '../core/save';
import { CHAPTER_TITLES, QuestManager } from '../gameplay/quests';

export class JournalOverlay {
  public isOpen: boolean = false;
  private rootEl: HTMLDivElement | null = null;
  private bodyEl: HTMLDivElement | null = null;

  public build(container: HTMLElement): void {
    if (typeof document === 'undefined') return;

    const root = document.createElement('div');
    root.id = 'juzu-journal-overlay';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(10, 12, 10, 0.78)',
      'z-index:30',
      'font-family:Georgia, "Times New Roman", serif',
      'color:#2b2118',
    ].join(';');

    const book = document.createElement('div');
    book.style.cssText = [
      'width:min(820px, 92vw)',
      'max-height:84vh',
      'overflow-y:auto',
      'background:#dfd3bc',
      'border:6px solid #4a321f',
      'border-radius:6px',
      'box-shadow:0 20px 55px rgba(0,0,0,0.75)',
      'padding:28px 34px',
      'line-height:1.55',
    ].join(';');

    root.appendChild(book);
    container.appendChild(root);
    this.rootEl = root;
    this.bodyEl = book;
  }

  public toggle(save: SaveManager, quests: QuestManager): void {
    this.isOpen = !this.isOpen;
    if (!this.rootEl || !this.bodyEl) return;

    if (this.isOpen) {
      quests.showObjectiveBanner();
      const state = save.getState();
      const chTitle = CHAPTER_TITLES[Math.max(0, state.chapter - 1)] || CHAPTER_TITLES[0];
      const notesHtml = state.journalEntries
        .map(n => `<li style="margin-bottom:8px;">${n}</li>`)
        .join('');

      this.bodyEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #8c6d46;padding-bottom:10px;margin-bottom:18px;">
          <h2 style="margin:0;font-size:22px;color:#3b2616;">Naira Quispe — Field Journal</h2>
          <span style="font-size:13px;color:#5c4328;">Press [J] or [Esc] to close</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <div>
            <h3 style="margin:0 0 8px 0;font-size:16px;color:#4a321f;">${chTitle}</h3>
            <p style="margin:0 0 14px 0;font-size:14px;font-style:italic;color:#3d2d1e;">
              Active Objective: ${quests.getActiveObjective()}
            </p>
            <h4 style="margin:14px 0 6px 0;font-size:14px;color:#4a321f;">Hand-Drawn Valley Sketch</h4>
            <div style="background:#cfc0a4;border:1px solid #8c6d46;padding:12px;font-size:12px;color:#38291b;">
              <div>▲ North Overlook — Condor Viewpoint (z = -24m)</div>
              <div>│  ├─ Carved Inca Water-Reckoning Stele &amp; Channel</div>
              <div>│  └─ Mossy Stone Trail Shelter</div>
              <div>══════ Ravine Hanging Bridge (Waterfall Gorge) ══════</div>
              <div>▼ South Trailhead — Sanctuary Stone Circle (z = +9m)</div>
            </div>
          </div>
          <div>
            <h3 style="margin:0 0 8px 0;font-size:16px;color:#4a321f;">Field Notes &amp; Quipu Records</h3>
            <ul style="margin:0;padding-left:18px;font-size:13.5px;">${notesHtml}</ul>
            <p style="margin-top:14px;font-size:12.5px;color:#5c4328;">
              Collected Quipu Fragments: ${state.collectedQuipus.length} &bull;
              Synchronized Viewpoints: ${state.unlockedViewpoints.length}
            </p>
          </div>
        </div>
      `;
      this.rootEl.style.display = 'flex';
    } else {
      this.rootEl.style.display = 'none';
    }
  }

  public update(_dt: number): void {
    // Event-driven on [J] toggle
  }

  public dispose(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
