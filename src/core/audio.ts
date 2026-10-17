export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted = false;
  private windNode: AudioNode | null = null;

  constructor() {
    // Initialized on first user interaction
  }

  private initCtx(): boolean {
    if (this.ctx) return true;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = 0.85;
      this.musicGain.gain.value = 0.55;
      this.sfxGain.gain.value = 0.8;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientMountainBreeze();
      return true;
    } catch {
      return false;
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    } else {
      this.initCtx();
    }
  }

  public setMasterVolume(v: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
    }
  }

  public setMusicVolume(v: number): void {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
    }
  }

  public setSfxVolume(v: number): void {
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
    }
  }

  // Andean Quena flute chime
  public playQuenaNote(freq: number = 440, duration: number = 1.2): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    // Breath vibrato
    osc.frequency.setTargetAtTime(freq * 1.015, this.ctx.currentTime + 0.1, 0.2);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Andean Bombo / Cajón deep resonance
  public playCajon(duration: number = 0.45): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Footstep foley (grass / stone / wood)
  public playFootstep(material: 'grass' | 'stone' | 'wood' | 'water' = 'grass'): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = material === 'stone' ? 'highpass' : 'lowpass';
    filter.frequency.value = material === 'stone' ? 800 : material === 'water' ? 1200 : 400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    whiteNoise.start();
  }

  private startAmbientMountainBreeze(): void {
    if (!this.ctx || !this.musicGain) return;
    // Continuous filtered noise simulating high mountain valley wind
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 350;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start();
    this.windNode = noise;
  }
}
