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

  // Grapple throw whoosh sound effect
  public playGrappleThrow(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }

  // Bronze ring latch & solid hemp cordage engagement
  public playGrappleLatch(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    // Resonant bronze bell chime
    const bell = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1180, this.ctx.currentTime);
    bell.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.35);

    bellGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    bellGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    bell.connect(bellGain);
    bellGain.connect(this.sfxGain);
    bell.start();
    bell.stop(this.ctx.currentTime + 0.35);

    // Deep rope snap clack
    const clack = this.ctx.createOscillator();
    const clackGain = this.ctx.createGain();
    clack.type = 'triangle';
    clack.frequency.setValueAtTime(220, this.ctx.currentTime);
    clack.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.15);

    clackGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    clackGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    clack.connect(clackGain);
    clackGain.connect(this.sfxGain);
    clack.start();
    clack.stop(this.ctx.currentTime + 0.15);
  }

  // Grapple release leap impulse
  public playGrappleRelease(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(560, this.ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.24, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  // Authentic vintage expedition sidearm gunshot report
  public playGunshot(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // 1. Initial supersonic explosive blast wave (filtered white noise pop)
    const bufLen = Math.floor(this.ctx.sampleRate * 0.18);
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.035));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(220, t + 0.15);
    noiseFilter.Q.value = 1.1;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);

    // 2. Heavy sub-bass chamber detonation punch
    const punch = this.ctx.createOscillator();
    punch.type = 'triangle';
    punch.frequency.setValueAtTime(195, t);
    punch.frequency.exponentialRampToValueAtTime(32, t + 0.25);

    const punchGain = this.ctx.createGain();
    punchGain.gain.setValueAtTime(0.65, t);
    punchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    punch.connect(punchGain);
    punchGain.connect(this.sfxGain);
    punch.start(t);
    punch.stop(t + 0.25);

    // 3. Metallic slide cycle & brass reverberation
    const slide = this.ctx.createOscillator();
    slide.type = 'sawtooth';
    slide.frequency.setValueAtTime(1850, t + 0.04);
    slide.frequency.exponentialRampToValueAtTime(620, t + 0.14);

    const slideGain = this.ctx.createGain();
    slideGain.gain.setValueAtTime(0, t);
    slideGain.gain.setValueAtTime(0.18, t + 0.04);
    slideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    slide.connect(slideGain);
    slideGain.connect(this.sfxGain);
    slide.start(t + 0.04);
    slide.stop(t + 0.16);
  }

  // Sidearm magazine insertion & slide release clack
  public playGunReload(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Mag latch click
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(740, t);
    osc1.frequency.exponentialRampToValueAtTime(280, t + 0.08);

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.3, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(g1);
    g1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.08);

    // Slide rack forward
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(450, t + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(880, t + 0.26);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.setValueAtTime(0.28, t + 0.15);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc2.connect(g2);
    g2.connect(this.sfxGain);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.28);
  }

  // Bullet impact crack & ricochet ping
  public playBulletImpact(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
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
