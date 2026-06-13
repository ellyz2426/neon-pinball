// Neon Pinball VR - Procedural Audio
// Round 3: Wizard mode, extra ball, achievement sounds, dynamic intensity music

import { IntensityLevel } from './game';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private multiballOsc: OscillatorNode | null = null;
  private intensityNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  sfxVolume = 0.7;
  musicVolume = 0.3;
  masterVolume = 0.8;
  private currentIntensity: IntensityLevel = 'calm';

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  startAmbient(themeId?: string): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopAmbient();

    // Theme-reactive base frequencies
    const themeFreqs: Record<string, { bass: number; pad: number; padType: OscillatorType }> = {
      'neon-classic': { bass: 55, pad: 82.5, padType: 'triangle' },
      'cyber-red': { bass: 65.41, pad: 98, padType: 'sawtooth' },
      'ocean-blue': { bass: 49, pad: 73.5, padType: 'sine' },
      'solar-flare': { bass: 61.74, pad: 92.5, padType: 'square' },
      'toxic-green': { bass: 51.91, pad: 77.78, padType: 'triangle' },
    };
    const tf = themeFreqs[themeId || 'neon-classic'] || themeFreqs['neon-classic'];

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.15;
    this.ambientGain.connect(this.musicGain);

    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = tf.bass;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientOsc.frequency);
    lfo.start();

    const pad = this.ctx.createOscillator();
    pad.type = tf.padType;
    pad.frequency.value = tf.pad;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.08;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 200;
    pad.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.musicGain);
    pad.start();

    // Secondary harmony note for richer theme sound
    const harmony = this.ctx.createOscillator();
    harmony.type = 'sine';
    harmony.frequency.value = tf.bass * 1.5; // fifth above
    const harmGain = this.ctx.createGain();
    harmGain.gain.value = 0.04;
    harmony.connect(harmGain);
    harmGain.connect(this.musicGain);
    harmony.start();

    this.ambientOsc.connect(this.ambientGain);
    this.ambientOsc.start();
  }

  stopAmbient(): void {
    try {
      this.ambientOsc?.stop();
      this.ambientOsc?.disconnect();
    } catch {}
    this.ambientOsc = null;
    this.ambientGain = null;
    this.stopMultiballMusic();
    this.stopIntensityLayers();
  }

  // === Dynamic intensity music layers ===

  setIntensity(level: IntensityLevel): void {
    if (level === this.currentIntensity) return;
    this.currentIntensity = level;
    this.updateIntensityLayers();
  }

  private updateIntensityLayers(): void {
    if (!this.ctx || !this.musicGain) return;

    this.stopIntensityLayers();

    if (this.currentIntensity === 'calm') return;

    // Add layers based on intensity
    if (this.currentIntensity === 'normal' || this.currentIntensity === 'heated' || this.currentIntensity === 'frenzy') {
      // Rhythmic pulse layer
      const pulseOsc = this.ctx.createOscillator();
      pulseOsc.type = 'sine';
      pulseOsc.frequency.value = 110;
      const pulseGain = this.ctx.createGain();
      pulseGain.gain.value = this.currentIntensity === 'normal' ? 0.04 : 0.06;
      const pulseLfo = this.ctx.createOscillator();
      pulseLfo.type = 'square';
      pulseLfo.frequency.value = this.currentIntensity === 'frenzy' ? 6 : 3;
      const pulseLfoGain = this.ctx.createGain();
      pulseLfoGain.gain.value = pulseGain.gain.value;
      pulseLfo.connect(pulseLfoGain);
      pulseLfoGain.connect(pulseGain.gain);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(this.musicGain);
      pulseOsc.start();
      pulseLfo.start();
      this.intensityNodes.push({ osc: pulseOsc, gain: pulseGain });
    }

    if (this.currentIntensity === 'heated' || this.currentIntensity === 'frenzy') {
      // Higher harmonic layer
      const harmOsc = this.ctx.createOscillator();
      harmOsc.type = 'triangle';
      harmOsc.frequency.value = 165;
      const harmGain = this.ctx.createGain();
      harmGain.gain.value = 0.03;
      const harmFilter = this.ctx.createBiquadFilter();
      harmFilter.type = 'bandpass';
      harmFilter.frequency.value = 200;
      harmOsc.connect(harmFilter);
      harmFilter.connect(harmGain);
      harmGain.connect(this.musicGain);
      harmOsc.start();
      this.intensityNodes.push({ osc: harmOsc, gain: harmGain });
    }

    if (this.currentIntensity === 'frenzy') {
      // Aggressive bass pulse
      const bassOsc = this.ctx.createOscillator();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.value = 55;
      const bassGain = this.ctx.createGain();
      bassGain.gain.value = 0.05;
      const bassFilter = this.ctx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.value = 120;
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start();
      this.intensityNodes.push({ osc: bassOsc, gain: bassGain });
    }
  }

  private stopIntensityLayers(): void {
    for (const node of this.intensityNodes) {
      try {
        node.osc.stop();
        node.osc.disconnect();
        node.gain.disconnect();
      } catch {}
    }
    this.intensityNodes = [];
  }

  // === Standard SFX ===

  playBumperHit(bumperId?: string): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Different pitch per bumper for variety
    const baseFreq = bumperId === 'pop-center' ? 900 :
                     bumperId === 'pop-left' ? 700 :
                     bumperId === 'pop-right' ? 1100 : 800;
    const bellFreq = bumperId === 'pop-center' ? 1400 :
                     bumperId === 'pop-left' ? 1000 :
                     bumperId === 'pop-right' ? 1600 : 1200;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);

    const bell = this.ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.value = bellFreq;
    const bellGain = this.ctx.createGain();
    bellGain.gain.setValueAtTime(0.2, t);
    bellGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    bell.connect(bellGain);
    bellGain.connect(this.sfxGain);
    bell.start(t);
    bell.stop(t + 0.3);
  }

  playSlingshotHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playTargetHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [523, 659, 784];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.2);
    }
  }

  playFlipperClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 150;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  playDrain(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playLaunch(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const noise = this.ctx.createOscillator();
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(200, t);
    noise.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  playWallBounce(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 250;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playJackpot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [523, 659, 784, 1047, 1319, 1568];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i < 3 ? 'square' : 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.4);
    }
  }

  playBallSaved(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  playCombo(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1100, t + 0.05);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playGameOver(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [392, 349, 330, 262];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.25);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.25 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.25 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.25);
      osc.stop(t + i * 0.25 + 0.5);
    }
  }

  // === Round 2 SFX ===

  playSpinnerHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(1800, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 4;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playRampEnter(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(450, t);
    osc2.frequency.exponentialRampToValueAtTime(2000, t + 0.25);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.12, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t);
    osc2.stop(t + 0.3);
  }

  playRampExit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  playKickback(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playMultiballStart(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [262, 330, 392, 523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i < 4 ? 'square' : 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.07);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.07 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.3);
    }

    this.startMultiballMusic();
  }

  private startMultiballMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMultiballMusic();

    this.multiballOsc = this.ctx.createOscillator();
    this.multiballOsc.type = 'square';
    this.multiballOsc.frequency.value = 110;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 4;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain);
    lfoGain.connect(this.musicGain);
    lfo.start();

    const mbGain = this.ctx.createGain();
    mbGain.gain.value = 0.1;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    this.multiballOsc.connect(filter);
    filter.connect(mbGain);
    mbGain.connect(this.musicGain);
    this.multiballOsc.start();
  }

  stopMultiballMusic(): void {
    try {
      this.multiballOsc?.stop();
      this.multiballOsc?.disconnect();
    } catch {}
    this.multiballOsc = null;
  }

  playMissionComplete(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [392, 494, 587, 784];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.5);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.5);
    }
  }

  playBallLock(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const clunk = this.ctx.createOscillator();
    clunk.type = 'square';
    clunk.frequency.value = 80;
    const clunkGain = this.ctx.createGain();
    clunkGain.gain.setValueAtTime(0.3, t);
    clunkGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    clunk.connect(clunkGain);
    clunkGain.connect(this.sfxGain);
    clunk.start(t);
    clunk.stop(t + 0.1);

    const chime = this.ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.value = 1047;
    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0, t + 0.1);
    chimeGain.gain.linearRampToValueAtTime(0.2, t + 0.12);
    chimeGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    chime.connect(chimeGain);
    chimeGain.connect(this.sfxGain);
    chime.start(t + 0.1);
    chime.stop(t + 0.4);
  }

  // === Round 3 SFX ===

  playWizardModeStart(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Epic ascending power chord
    const notes = [196, 247, 294, 392, 494, 587, 784, 988, 1175, 1568];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i < 5 ? 'sawtooth' : 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.22, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.06 + 0.6);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.6);
    }
  }

  playWizardModeEnd(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Descending resolution
    const notes = [784, 587, 494, 392, 294];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.15 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.5);
    }
  }

  playExtraBall(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Sparkly ascending chime
    const notes = [523, 784, 1047, 1319, 1568];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.09 + 0.35);

      // Add shimmer with slight detune
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = notes[i] * 1.005;
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0, t + i * 0.09);
      gain2.gain.linearRampToValueAtTime(0.1, t + i * 0.09 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + i * 0.09 + 0.35);

      osc.connect(gain);
      osc2.connect(gain2);
      gain.connect(this.sfxGain);
      gain2.connect(this.sfxGain);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.35);
      osc2.start(t + i * 0.09);
      osc2.stop(t + i * 0.09 + 0.35);
    }
  }

  playAchievementUnlock(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Short triumphant sting
    const notes = [659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.4);
    }

    // Golden shimmer overlay
    const shimmer = this.ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 2093;
    const shimGain = this.ctx.createGain();
    shimGain.gain.setValueAtTime(0, t + 0.2);
    shimGain.gain.linearRampToValueAtTime(0.08, t + 0.25);
    shimGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    shimmer.connect(shimGain);
    shimGain.connect(this.sfxGain);
    shimmer.start(t + 0.2);
    shimmer.stop(t + 0.6);
  }

  setMasterVolume(v: number): void {
    this.masterVolume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  // === Round 4 SFX ===

  playSkillShot(tier: 'GOOD' | 'GREAT' | 'PERFECT'): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const base = tier === 'PERFECT' ? 523 : tier === 'GREAT' ? 440 : 392;
    const count = tier === 'PERFECT' ? 8 : tier === 'GREAT' ? 5 : 3;

    for (let i = 0; i < count; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = tier === 'PERFECT' ? 'sine' : 'triangle';
      osc.frequency.value = base * (1 + i * 0.2);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.06 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.3);
    }

    // Perfect gets shimmer overlay
    if (tier === 'PERFECT') {
      const shimmer = this.ctx.createOscillator();
      shimmer.type = 'sine';
      shimmer.frequency.value = 2093;
      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0, t + 0.3);
      sGain.gain.linearRampToValueAtTime(0.12, t + 0.35);
      sGain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      shimmer.connect(sGain);
      sGain.connect(this.sfxGain);
      shimmer.start(t + 0.3);
      shimmer.stop(t + 0.8);
    }
  }

  playBonusTick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playBonusTotal(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.35);
    }
  }

  playMatchTick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300 + Math.random() * 400, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playMatchWin(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [523, 659, 784, 1047, 1319];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.5);
    }
  }

  playSuperJackpot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Massive power chord crescendo
    const notes = [196, 247, 294, 392, 494, 587, 784, 988, 1175, 1568, 2093];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i < 6 ? 'sawtooth' : 'sine';
      osc.frequency.value = notes[i];
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.05 + 0.8);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4000;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.8);
    }
  }

  playCaptiveBall(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Deep thud + ring
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, t);
    thud.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(0.35, t);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    thud.connect(thudGain);
    thudGain.connect(this.sfxGain);
    thud.start(t);
    thud.stop(t + 0.15);

    const ring = this.ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.value = 660;
    const ringGain = this.ctx.createGain();
    ringGain.gain.setValueAtTime(0, t + 0.05);
    ringGain.gain.linearRampToValueAtTime(0.15, t + 0.08);
    ringGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    ring.connect(ringGain);
    ringGain.connect(this.sfxGain);
    ring.start(t + 0.05);
    ring.stop(t + 0.4);
  }

  playMagnaSave(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Magnetic hum: rising low-frequency oscillator
    const hum = this.ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.setValueAtTime(60, t);
    hum.frequency.linearRampToValueAtTime(200, t + 0.3);
    hum.frequency.linearRampToValueAtTime(120, t + 1.0);
    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0, t);
    humGain.gain.linearRampToValueAtTime(0.25, t + 0.1);
    humGain.gain.linearRampToValueAtTime(0.15, t + 0.5);
    humGain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
    hum.connect(humGain);
    humGain.connect(this.sfxGain);
    hum.start(t);
    hum.stop(t + 1.2);

    // High "zap" accent
    const zap = this.ctx.createOscillator();
    zap.type = 'sine';
    zap.frequency.setValueAtTime(1200, t);
    zap.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const zapGain = this.ctx.createGain();
    zapGain.gain.setValueAtTime(0.2, t);
    zapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    zap.connect(zapGain);
    zapGain.connect(this.sfxGain);
    zap.start(t);
    zap.stop(t + 0.25);
  }

  playFrenzyStart(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Epic ascending power chord
    const freqs = [220, 330, 440, 660, 880];
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const delay = i * 0.06;
      osc.frequency.setValueAtTime(freqs[i], t + delay);
      osc.frequency.exponentialRampToValueAtTime(freqs[i] * 1.5, t + delay + 0.4);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.18, t + delay + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.5);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t + delay);
      osc.stop(t + delay + 0.5);
    }
  }

  playFrenzyEnd(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Descending whoosh
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playMilestone(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Triumphant 3-note chime with shimmer
    const notes = [523, 659, 784]; // C5, E5, G5
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const delay = i * 0.12;
      osc.frequency.value = notes[i];
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.25, t + delay + 0.03);
      g.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.8);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t + delay);
      osc.stop(t + delay + 0.8);
    }

    // High shimmer
    const shimmer = this.ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1568; // G6
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0, t + 0.3);
    sg.gain.linearRampToValueAtTime(0.12, t + 0.35);
    sg.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
    shimmer.connect(sg);
    sg.connect(this.sfxGain);
    shimmer.start(t + 0.3);
    shimmer.stop(t + 1.2);
  }

  playOrbitComplete(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Whooshing sweep + chime
    const sweep = this.ctx.createOscillator();
    sweep.type = 'triangle';
    sweep.frequency.setValueAtTime(200, t);
    sweep.frequency.linearRampToValueAtTime(800, t + 0.2);
    sweep.frequency.linearRampToValueAtTime(400, t + 0.4);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.2, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    sweep.connect(sg);
    sg.connect(this.sfxGain);
    sweep.start(t);
    sweep.stop(t + 0.4);

    // Completion chime
    const chime = this.ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.value = 1047; // C6
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0, t + 0.15);
    cg.gain.linearRampToValueAtTime(0.2, t + 0.18);
    cg.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
    chime.connect(cg);
    cg.connect(this.sfxGain);
    chime.start(t + 0.15);
    chime.stop(t + 0.7);
  }

  playTimeAttackWarning(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Urgent beep
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 880;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.setValueAtTime(0, t + 0.08);
    g.gain.setValueAtTime(0.15, t + 0.12);
    g.gain.setValueAtTime(0, t + 0.2);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Lane completion: ascending 3-note arpeggio
  playLaneComplete(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      const g = this.ctx.createGain();
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  // Tilt warning: harsh buzzer descending
  playTiltWarning(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.linearRampToValueAtTime(0, t + 0.3);

    // Simple distortion via clipping filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Full tilt: longer, more aggressive
  playTiltFull(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const start = t + i * 0.15;
      osc.frequency.setValueAtTime(300 - i * 80, start);
      osc.frequency.linearRampToValueAtTime(60, start + 0.12);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, start);
      g.gain.linearRampToValueAtTime(0, start + 0.12);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.12);
    }
  }

  // Score popup chime: quick tone scaled by score magnitude
  playScoreChime(score: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Higher pitch for bigger scores
    const magnitude = Math.log10(Math.max(100, score));
    const freq = 400 + magnitude * 150;
    const vol = Math.min(0.12, 0.04 + magnitude * 0.02);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}
