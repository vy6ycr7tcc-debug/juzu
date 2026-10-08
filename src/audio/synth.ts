import { Biome, Intensity } from './engine';

export type AudioType = 'wind' | 'water' | 'stone' | 'cloth' | 'breath' | 'footsteps' | 'quena' | 'charango' | 'cajon' | 'bow_twang' | 'arrow_hit' | 'alert_stinger' | 'takedown';

// Utility to create noise buffers
function createNoiseBuffer(ctx: BaseAudioContext, duration: number, type: 'white' | 'pink' | 'brown' = 'white'): AudioBuffer {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'white') {
            data[i] = white;
        } else if (type === 'brown') {
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Compensate gain
        } else if (type === 'pink') {
            // Very basic pink noise approx
            data[i] = (lastOut + white) * 0.5;
            lastOut = data[i];
        }
    }
    return buffer;
}

// Procedural SFX generation
export async function generateSfx(ctx: AudioContext, type: AudioType): Promise<AudioBuffer | null> {
    const duration = type === 'wind' ? 10 : type === 'water' ? 10 : 0.5;
    const offlineCtx = new OfflineAudioContext(1, ctx.sampleRate * duration, ctx.sampleRate);

    if (type === 'wind') {
        const noiseBuffer = createNoiseBuffer(offlineCtx, duration, 'pink');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        // Modulate frequency
        const lfo = offlineCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.2;
        const lfoGain = offlineCtx.createGain();
        lfoGain.gain.value = 300;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noiseSource.connect(filter);
        filter.connect(offlineCtx.destination);

        noiseSource.start();
        lfo.start();
    } else if (type === 'water') {
        const noiseBuffer = createNoiseBuffer(offlineCtx, duration, 'white');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 1.0;

        noiseSource.connect(filter);
        filter.connect(offlineCtx.destination);

        noiseSource.start();
    } else if (type === 'stone' || type === 'footsteps') {
        // Impact
        const noiseBuffer = createNoiseBuffer(offlineCtx, duration, 'brown');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(1, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.2);

        noiseSource.connect(filter);
        filter.connect(env);
        env.connect(offlineCtx.destination);

        // Low frequency thud
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, 0);
        osc.frequency.exponentialRampToValueAtTime(20, 0.1);

        const oscEnv = offlineCtx.createGain();
        oscEnv.gain.setValueAtTime(1, 0);
        oscEnv.gain.exponentialRampToValueAtTime(0.01, 0.15);

        osc.connect(oscEnv);
        oscEnv.connect(offlineCtx.destination);

        noiseSource.start();
        osc.start();
    } else if (type === 'cloth' || type === 'breath') {
        const noiseBuffer = createNoiseBuffer(offlineCtx, duration, 'white');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = type === 'cloth' ? 'highpass' : 'bandpass';
        filter.frequency.value = type === 'cloth' ? 2000 : 1000;
        if (type === 'breath') filter.Q.value = 0.5;

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(0.01, 0);
        env.gain.linearRampToValueAtTime(0.5, 0.2);
        env.gain.linearRampToValueAtTime(0.01, 0.5);

        noiseSource.connect(filter);
        filter.connect(env);
        env.connect(offlineCtx.destination);

        noiseSource.start();
    } else if (type === 'quena') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 880;

        const noiseBuffer = createNoiseBuffer(offlineCtx, duration, 'white');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const noiseFilter = offlineCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 880;
        noiseFilter.Q.value = 10;

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.value = 0.1;

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(offlineCtx.destination);

        osc.connect(offlineCtx.destination);

        osc.start();
        noiseSource.start();
    } else if (type === 'charango') {
        // Simple Karplus-Strong approximation
        const noiseBuffer = createNoiseBuffer(offlineCtx, 0.05, 'white');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(1, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.5);

        noiseSource.connect(filter);
        filter.connect(env);
        env.connect(offlineCtx.destination);

        noiseSource.start();
    } else if (type === 'cajon') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, 0);
        osc.frequency.exponentialRampToValueAtTime(20, 0.1);

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(1, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.2);

        osc.connect(env);
        env.connect(offlineCtx.destination);

        osc.start();
    } else if (type === 'bow_twang') {
        // High-tension bowstring release
        const osc = offlineCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, 0);
        osc.frequency.exponentialRampToValueAtTime(60, 0.15);

        const noiseBuffer = createNoiseBuffer(offlineCtx, 0.08, 'white');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const noiseFilter = offlineCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1200;

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(0.8, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.18);

        osc.connect(env);
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(env);
        env.connect(offlineCtx.destination);

        osc.start();
        noiseSource.start();
    } else if (type === 'arrow_hit') {
        // Heavy obsidian point impact thud
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, 0);
        osc.frequency.exponentialRampToValueAtTime(50, 0.12);

        const noiseBuffer = createNoiseBuffer(offlineCtx, 0.06, 'brown');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(1.0, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.15);

        osc.connect(env);
        noiseSource.connect(env);
        env.connect(offlineCtx.destination);

        osc.start();
        noiseSource.start();
    } else if (type === 'alert_stinger') {
        // Sudden high-tension minor second brass/string stinger
        const osc1 = offlineCtx.createOscillator();
        const osc2 = offlineCtx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(587.33, 0); // D5
        osc2.frequency.setValueAtTime(622.25, 0); // D#5 (dissonant semitone)

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, 0);
        filter.frequency.exponentialRampToValueAtTime(600, 0.45);

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(0.7, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.5);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(env);
        env.connect(offlineCtx.destination);

        osc1.start();
        osc2.start();
    } else if (type === 'takedown') {
        // Silent climbing axe strike and body takedown
        const osc = offlineCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, 0);
        osc.frequency.exponentialRampToValueAtTime(30, 0.25);

        const noiseBuffer = createNoiseBuffer(offlineCtx, 0.12, 'pink');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;

        const env = offlineCtx.createGain();
        env.gain.setValueAtTime(1.0, 0);
        env.gain.exponentialRampToValueAtTime(0.01, 0.3);

        osc.connect(env);
        noiseSource.connect(filter);
        filter.connect(env);
        env.connect(offlineCtx.destination);

        osc.start();
        noiseSource.start();
    }

    return await offlineCtx.startRendering();
}

// Adaptive music bed generation
export async function generateBed(ctx: AudioContext, biome: Biome, intensity: Intensity): Promise<AudioBuffer | null> {
    const duration = 16.0; // 16 seconds loop
    const offlineCtx = new OfflineAudioContext(2, ctx.sampleRate * duration, ctx.sampleRate);

    // Base drone
    const osc1 = offlineCtx.createOscillator();
    const osc2 = offlineCtx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Base frequencies based on biome
    let baseFreq = 55; // A1
    if (biome === 'jungle') baseFreq = 65.41; // C2
    if (biome === 'cave') baseFreq = 41.20; // E1
    if (biome === 'river') baseFreq = 73.42; // D2

    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq * 1.01; // Slight detune

    const droneGain = offlineCtx.createGain();
    droneGain.gain.value = intensity === 'calm' ? 0.3 : intensity === 'explore' ? 0.4 : 0.6;

    osc1.connect(droneGain);
    osc2.connect(droneGain);
    droneGain.connect(offlineCtx.destination);

    osc1.start();
    osc2.start();

    // Add rhythmic pulses for explore/tension
    if (intensity === 'explore' || intensity === 'tension') {
        const noiseBuffer = createNoiseBuffer(offlineCtx, duration, 'brown');
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = intensity === 'tension' ? 600 : 200;

        // Tremolo / LFO for rhythm
        const lfo = offlineCtx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = intensity === 'tension' ? 4 : 2; // Hz
        const lfoGain = offlineCtx.createGain();
        lfoGain.gain.value = 1.0;

        const rhythmGain = offlineCtx.createGain();
        rhythmGain.gain.value = 0.0;

        lfo.connect(lfoGain);
        lfoGain.connect(rhythmGain.gain);

        noiseSource.connect(filter);
        filter.connect(rhythmGain);
        rhythmGain.connect(offlineCtx.destination);

        noiseSource.start();
        lfo.start();
    }

    return await offlineCtx.startRendering();
}
