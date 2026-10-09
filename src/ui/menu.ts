export class MenuManager {
  private container: HTMLElement;
  private overlay: HTMLElement;
  public isOpen: boolean = false;

  // Callbacks
  public onResume?: () => void;
  public onPause?: () => void;  // P-MOBILE: touch pause button + input release hook
  public onQuit?: () => void;
  public onSensitivityChange?: (val: number) => void;
  public onInvertPitchChange?: (val: boolean) => void;

  constructor(parent: HTMLElement) {
    this.container = parent;

    this.overlay = document.createElement('div');
    this.overlay.id = 'pause-menu';
    this.overlay.className = 'hidden';

    this.overlay.innerHTML = `
      <h2>PAUSED</h2>
      <div class="pause-menu-list">
        <button id="btn-resume">Resume Journey</button>

        <div class="settings-panel">
          <div class="setting-row">
            <label>Quality Tier</label>
            <select id="select-quality">
              <option value="high">High (Adaptive)</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div class="setting-row">
            <label>Master Volume</label>
            <input type="range" id="range-volume" min="0" max="100" value="100">
          </div>
          <div class="setting-row">
            <label>Look Sensitivity</label>
            <input type="range" id="range-sensitivity" min="20" max="250" value="100">
          </div>
          <div class="setting-row">
            <label>Invert Pitch</label>
            <input type="checkbox" id="check-invert-pitch" style="width: 20px; height: 20px; accent-color: #ffd875; cursor: pointer;">
          </div>
        </div>

        <div class="controls-guide-card">
          <div class="controls-guide-header">EXPEDITION CONTROLS</div>
          <div class="controls-grid">
            <div class="control-item"><span class="key-badge">WASD</span> Move</div>
            <div class="control-item"><span class="key-badge">SHIFT</span> Sprint</div>
            <div class="control-item"><span class="key-badge">SPACE</span> Jump / Vault / Mantle</div>
            <div class="control-item"><span class="key-badge">C</span> Crouch / Roll / Dive</div>
            <div class="control-item"><span class="key-badge">MOUSE</span> Look / Orbit</div>
            <div class="control-item"><span class="key-badge">SCROLL</span> Camera Zoom</div>
            <div class="control-item"><span class="key-badge">RMB / F</span> Aim Recurve Bow</div>
            <div class="control-item"><span class="key-badge">LMB / ENTER</span> Fire Arrow</div>
            <div class="control-item"><span class="key-badge">E</span> Interact / Takedown</div>
            <div class="control-item"><span class="key-badge">Q</span> Survival Instinct</div>
            <div class="control-item"><span class="key-badge">T</span> Pine Torch</div>
            <div class="control-item"><span class="key-badge">V</span> Shoulder Flip</div>
            <div class="control-item"><span class="key-badge">M</span> Expedition Map</div>
            <div class="control-item"><span class="key-badge">ESC</span> Pause Menu</div>
          </div>
        </div>

        <button id="btn-quit" style="margin-top: 1rem;">Quit to Title</button>
      </div>
    `;

    this.container.appendChild(this.overlay);

    // Event Listeners
    this.overlay.querySelector('#btn-resume')?.addEventListener('click', () => {
      this.close();
    });

    this.overlay.querySelector('#btn-quit')?.addEventListener('click', () => {
      if (this.onQuit) this.onQuit();
    });

    this.overlay.querySelector('#select-quality')?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('Quality stub set to:', target.value);
    });

    this.overlay.querySelector('#range-volume')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      console.log('Volume stub set to:', target.value);
    });

    this.overlay.querySelector('#range-sensitivity')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (this.onSensitivityChange) this.onSensitivityChange(parseFloat(target.value));
    });

    this.overlay.querySelector('#check-invert-pitch')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (this.onInvertPitchChange) this.onInvertPitchChange(target.checked);
    });

    // We capture Escape globally at the capture phase so we can stop propagation if we consume it
    window.addEventListener('keydown', this.handleKeyDown.bind(this), true);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Escape') {
      // Toggle menu
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
      e.stopImmediatePropagation();
      e.preventDefault();
    } else if (this.isOpen) {
      // If menu is open, swallow all other keys to prevent gameplay
      e.stopImmediatePropagation();
    }
  }

  public open() {
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    this.overlay.classList.add('visible');
    if (this.onPause) this.onPause();
  }

  public close() {
    this.isOpen = false;
    this.overlay.classList.remove('visible');
    this.overlay.classList.add('hidden');
    if (this.onResume) this.onResume();
  }
}
