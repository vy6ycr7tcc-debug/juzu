export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted = false;
  private windNode: AudioNode | null = null;
  private echoDelay: DelayNode | null = null;
  private echoGain: GainNode | null = null;
  private echoFilter: BiquadFilterNode | null = null;

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

      // Andean Mountain Canyon Slapback Echo Loop (damped multi-tap reflection)
      this.echoDelay = this.ctx.createDelay(1.0);
      this.echoDelay.delayTime.value = 0.28; // 280ms canyon rock face reflection
      this.echoGain = this.ctx.createGain();
      this.echoGain.gain.value = 0.32; // Natural acoustic falloff
      this.echoFilter = this.ctx.createBiquadFilter();
      this.echoFilter.type = 'lowpass';
      this.echoFilter.frequency.value = 1800; // High-frequency mountain absorption

      this.echoDelay.connect(this.echoFilter);
      this.echoFilter.connect(this.echoGain);
      this.echoGain.connect(this.echoDelay); // Feedback loop
      this.echoGain.connect(this.masterGain);

      this.startAmbientMountainBreeze();
      return true;
    } catch {
      return false;
    }
  }

  public resume(): void {
    try {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      } else {
        this.initCtx();
      }
    } catch (e) {
      console.warn('Audio resume error:', e);
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

  // Route an audio transient burst into the Andean canyon echo line
  public triggerCanyonEcho(sourceNode: AudioNode, gainLevel = 0.38): void {
    if (!this.ctx || !this.echoDelay) return;
    try {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = gainLevel;
      sourceNode.connect(sendGain);
      sendGain.connect(this.echoDelay);
    } catch {}
  }

  // Realistic surface-acoustic footsteps (stone mineral grit, hollow timber cavity, water splash, soft soil)
  public playFootstep(material: 'grass' | 'stone' | 'wood' | 'water' = 'grass'): void {
    try {
      if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
      if (this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;

      if (material === 'stone') {
        // 1. Solid heel-strike impact thud
        const thud = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(145, now);
        thud.frequency.exponentialRampToValueAtTime(42, now + 0.055);
        thudGain.gain.setValueAtTime(0.18, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        thud.connect(thudGain);
        thudGain.connect(this.sfxGain);
        thud.start(now);
        thud.stop(now + 0.06);

        // 2. High-frequency mineral grit & gravel crunch
        const bufLen = Math.floor(this.ctx.sampleRate * 0.05);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.4));
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 2.2;
        const gritGain = this.ctx.createGain();
        gritGain.gain.setValueAtTime(0.14, now);
        gritGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(filter);
        filter.connect(gritGain);
        gritGain.connect(this.sfxGain);
        noise.start(now);
      } else if (material === 'wood') {
        // Hollow timber plank acoustic resonance (hanging bridge plank)
        const timber = this.ctx.createOscillator();
        const timberGain = this.ctx.createGain();
        timber.type = 'sine';
        timber.frequency.setValueAtTime(125, now);
        timber.frequency.exponentialRampToValueAtTime(75, now + 0.08);
        timberGain.gain.setValueAtTime(0.24, now);
        timberGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        timber.connect(timberGain);
        timberGain.connect(this.sfxGain);
        timber.start(now);
        timber.stop(now + 0.085);

        // Timber creak click
        const bufLen = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 720;
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.16, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        noise.connect(filter);
        filter.connect(clickGain);
        clickGain.connect(this.sfxGain);
        noise.start(now);
      } else if (material === 'water') {
        // Aquatic splash & bubbling wake
        const splosh = this.ctx.createOscillator();
        const sploshGain = this.ctx.createGain();
        splosh.type = 'sine';
        splosh.frequency.setValueAtTime(210, now);
        splosh.frequency.exponentialRampToValueAtTime(65, now + 0.09);
        sploshGain.gain.setValueAtTime(0.22, now);
        sploshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        splosh.connect(sploshGain);
        sploshGain.connect(this.sfxGain);
        splosh.start(now);
        splosh.stop(now + 0.095);

        const bufLen = Math.floor(this.ctx.sampleRate * 0.11);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1600;
        const sprayGain = this.ctx.createGain();
        sprayGain.gain.setValueAtTime(0.20, now);
        sprayGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        noise.connect(filter);
        filter.connect(sprayGain);
        sprayGain.connect(this.sfxGain);
        noise.start(now);
      } else {
        // Soil / turf / moss damp scuff
        const bufLen = Math.floor(this.ctx.sampleRate * 0.045);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 380;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noise.start(now);
      }
    } catch {
      // Defensive: ignore audio glitches on interrupted mobile contexts
    }
  }

  // Ethereal Survival Instinct / Eagle Vision Sonar Chime
  public playSurvivalInstinctSonar(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Inca pentatonic celestial chord)

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.04 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 1.25);
    });
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
    this.triggerCanyonEcho(noiseGain, 0.40);
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
    this.triggerCanyonEcho(punchGain, 0.45);
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

  // Bullet impact crack & ricochet ping with surface differentiation
  public playBulletImpact(material: 'stone' | 'wood' | 'water' = 'stone'): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    try {
      if (material === 'stone') {
        // High supersonic ricochet ping
        const ping = this.ctx.createOscillator();
        ping.type = 'sine';
        ping.frequency.setValueAtTime(2800, t);
        ping.frequency.exponentialRampToValueAtTime(820, t + 0.14);

        const pingGain = this.ctx.createGain();
        pingGain.gain.setValueAtTime(0.38, t);
        pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        ping.connect(pingGain);
        pingGain.connect(this.sfxGain);
        this.triggerCanyonEcho(pingGain, 0.25);
        ping.start(t);
        ping.stop(t + 0.14);

        // Mineral crack noise burst
        const bufLen = Math.floor(this.ctx.sampleRate * 0.06);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.3));
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1800;
        const crackGain = this.ctx.createGain();
        crackGain.gain.setValueAtTime(0.30, t);
        crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        noise.connect(filter);
        filter.connect(crackGain);
        crackGain.connect(this.sfxGain);
        noise.start(t);
      } else if (material === 'wood') {
        // Solid timber impact thud
        const thunk = this.ctx.createOscillator();
        thunk.type = 'triangle';
        thunk.frequency.setValueAtTime(190, t);
        thunk.frequency.exponentialRampToValueAtTime(55, t + 0.09);

        const thunkGain = this.ctx.createGain();
        thunkGain.gain.setValueAtTime(0.42, t);
        thunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        thunk.connect(thunkGain);
        thunkGain.connect(this.sfxGain);
        thunk.start(t);
        thunk.stop(t + 0.095);

        // Splinter crack
        const bufLen = Math.floor(this.ctx.sampleRate * 0.05);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        const splinterGain = this.ctx.createGain();
        splinterGain.gain.setValueAtTime(0.24, t);
        splinterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(filter);
        filter.connect(splinterGain);
        splinterGain.connect(this.sfxGain);
        noise.start(t);
      } else if (material === 'water') {
        // Liquid cavitation plop
        const plop = this.ctx.createOscillator();
        plop.type = 'sine';
        plop.frequency.setValueAtTime(340, t);
        plop.frequency.exponentialRampToValueAtTime(80, t + 0.12);

        const plopGain = this.ctx.createGain();
        plopGain.gain.setValueAtTime(0.45, t);
        plopGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        plop.connect(plopGain);
        plopGain.connect(this.sfxGain);
        plop.start(t);
        plop.stop(t + 0.125);

        // Water splash spray
        const bufLen = Math.floor(this.ctx.sampleRate * 0.15);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2100;
        const sprayGain = this.ctx.createGain();
        sprayGain.gain.setValueAtTime(0.28, t);
        sprayGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        noise.connect(filter);
        filter.connect(sprayGain);
        sprayGain.connect(this.sfxGain);
        noise.start(t);
      }
    } catch {
      // Defensive
    }
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
