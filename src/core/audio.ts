/**
 * Module: src/core/audio.ts
 * Responsibility: Adaptive Andean score (Quena, charango, cajón, panpipes) and
 * procedural SFX engine with 3 master buses (Master, Music, SFX), 0.5s cooldown
 * anti-spam gates, and inverse-square distance attenuation per Bible §4.1–§4.3.
 * Depends on: none.
 * Exports: MusicMood, SurfaceType, SfxId, AudioManager.
 */

export type MusicMood = 'exploration' | 'traversal' | 'puzzle' | 'combat' | 'story';
export type SurfaceType = 'stone' | 'dirt' | 'mud' | 'grass' | 'wood' | 'water' | 'snow';
export type SfxId =
  | 'footstep'
  | 'climb_grip'
  | 'cloth_rustle'
  | 'breath_idle'
  | 'breath_exert'
  | 'bow_draw'
  | 'bow_release'
  | 'arrow_impact'
  | 'arrow_whoosh'
  | 'condor_cry'
  | 'journal_turn'
  | 'checkpoint_chime'
  | 'collectible_chime'
  | 'whistle_lure'
  | 'poultice_heal'
  | 'zipline_slide'
  | 'stone_grind'
  | 'rope_creak'
  | 'water_stroke'
  | 'enemy_flinch'
  | 'takedown_grapple'
  | 'puzzle_solved';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private masterVolume: number = 0.85;
  private musicVolume: number = 0.55;
  private sfxVolume: number = 0.85;
  private currentMood: MusicMood = 'exploration';
  private stemTimer: number = 0;

  // Cooldown map: no sound repeats more than once per 0.5s (§4.3)
  private readonly lastPlayedSec: Record<string, number> = {
    footstep: -1,
    climb_grip: -1,
    cloth_rustle: -1,
    breath_idle: -1,
    breath_exert: -1,
    bow_draw: -1,
    bow_release: -1,
    arrow_impact: -1,
    arrow_whoosh: -1,
    condor_cry: -1,
    journal_turn: -1,
    checkpoint_chime: -1,
    collectible_chime: -1,
    whistle_lure: -1,
    poultice_heal: -1,
    zipline_slide: -1,
    stone_grind: -1,
    rope_creak: -1,
    water_stroke: -1,
    enemy_flinch: -1,
    takedown_grapple: -1,
    puzzle_solved: -1,
  };

  private elapsedSec: number = 0;

  public build(): void {
    // Lazy-init Web Audio on first user interaction to respect browser autoplay policies
  }

  private ensureContext(): boolean {
    if (this.ctx) return true;
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.masterVolume;
      this.musicGain.gain.value = this.musicVolume;
      this.sfxGain.gain.value = this.sfxVolume;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  public resumeAudioContext(): void {
    if (this.ensureContext() && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setVolumes(master: number, music: number, sfx: number): void {
    this.masterVolume = Math.max(0, Math.min(1, master));
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  public getVolumes(): { master: number; music: number; sfx: number } {
    return {
      master: this.masterVolume,
      music: this.musicVolume,
      sfx: this.sfxVolume,
    };
  }

  public setMood(mood: MusicMood): void {
    this.currentMood = mood;
  }

  public playSfx(id: SfxId, distanceMeters: number = 0, surface: SurfaceType = 'dirt'): void {
    const last = this.lastPlayedSec[id] ?? -1;
    if (this.elapsedSec - last < 0.5) return; // §4.3 0.5s minimum cooldown
    this.lastPlayedSec[id] = this.elapsedSec;

    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    // Inverse-square attenuation (§4.3)
    const atten = 1.0 / (1.0 + 0.04 * distanceMeters * distanceMeters);
    if (atten < 0.02) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Far sounds are muffled via low-pass (§4.3)
    filter.type = 'lowpass';
    filter.frequency.value = Math.max(350, 4800 - distanceMeters * 85);

    if (id === 'footstep') {
      osc.type = 'triangle';
      const baseFreq =
        surface === 'stone' ? 165 :
        surface === 'wood' ? 130 :
        surface === 'water' ? 240 :
        surface === 'mud' ? 95 : 115;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
      gain.gain.setValueAtTime(0.18 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.11);
      return;
    }

    if (id === 'checkpoint_chime' || id === 'collectible_chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, now);
      osc.frequency.exponentialRampToValueAtTime(792, now + 0.45);
      gain.gain.setValueAtTime(0.22 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.56);
      return;
    }

    if (id === 'condor_cry') {
      osc.type = 'sawtooth';
      filter.frequency.value = 1200;
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.65);
      gain.gain.setValueAtTime(0.14 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.72);
      return;
    }

    if (id === 'stone_grind') {
      osc.type = 'sawtooth';
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(280, now);
      filter.Q.value = 2.0;
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.exponentialRampToValueAtTime(54, now + 0.48);
      gain.gain.setValueAtTime(0.24 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.54);
      return;
    }

    if (id === 'rope_creak') {
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680, now);
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(240, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.34);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.19 * atten, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.38);
      return;
    }

    if (id === 'water_stroke') {
      osc.type = 'triangle';
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.3);
      filter.Q.value = 1.4;
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.3);
      gain.gain.setValueAtTime(0.22 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.34);
      return;
    }

    if (id === 'bow_draw') {
      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.55);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18 * atten, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.6);
      return;
    }

    if (id === 'arrow_whoosh') {
      osc.type = 'sine';
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(840, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 0.22);
      filter.Q.value = 2.8;
      osc.frequency.setValueAtTime(940, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);
      gain.gain.setValueAtTime(0.21 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (id === 'arrow_impact' || id === 'enemy_flinch') {
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
      gain.gain.setValueAtTime(0.28 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.24);
      return;
    }

    if (id === 'takedown_grapple') {
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.38);
      gain.gain.setValueAtTime(0.26 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.45);
      return;
    }

    if (id === 'puzzle_solved') {
      osc.type = 'sine';
      filter.frequency.value = 2200;
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);
      gain.gain.setValueAtTime(0.24 * atten, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.78);
      return;
    }

    // Default physical transient for bow, climb, journal, breath
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.14);
    gain.gain.setValueAtTime(0.15 * atten, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public update(dt: number): void {
    this.elapsedSec += dt;
    this.stemTimer += dt;
    // Sparse adaptive Andean Quena/Charango stem pulse every 9–14s when audio context is active
    if (this.stemTimer > 11.5 && this.ctx && this.ctx.state === 'running' && this.musicGain) {
      this.stemTimer = 0;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      // Pentatonic Andean D-minor scale notes (D4, F4, G4, A4, C5)
      const scale = [293.66, 349.23, 392.0, 440.0, 523.25];
      const idx = Math.floor(this.elapsedSec) % scale.length;
      osc.type = this.currentMood === 'combat' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(scale[idx], now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 4.2);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 4.3);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
