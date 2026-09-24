import { seededRandom } from '../core/math.js';

const NOISE_SECONDS = 2;
const NOISE_SEED = 7;
const BELL_RATIOS = [1, 2.76, 5.4, 8.9];
const DRONE_SPREAD = [0, 3.5, -4.5, 7];
const MASTER_GAIN = 0.85;
const COMPRESSOR = Object.freeze({ threshold: -16, knee: 12, ratio: 6, attack: 0.002, release: 0.25 });
const WINDOW_POINTS = 64;
const HANN_WINDOW = Float32Array.from({ length: WINDOW_POINTS }, (_, i) => Math.sin((Math.PI * i) / (WINDOW_POINTS - 1)) ** 2);

function noiseBuffer(context) {
  const random = seededRandom(NOISE_SEED);
  const length = context.sampleRate * NOISE_SECONDS;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = random() * 2 - 1;
  return buffer;
}

export class Synth {
  constructor(context) {
    this.context = context;
    this.random = Math.random;
    const compressor = context.createDynamicsCompressor();
    Object.entries(COMPRESSOR).forEach(([key, value]) => {
      compressor[key].value = value;
    });
    this.master = context.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(compressor);
    compressor.connect(context.destination);
    this.noise = noiseBuffer(context);
  }

  between(min, max) {
    return min + (max - min) * this.random();
  }

  envelope(gain, start, peak, attack, duration) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  }

  filteredNoise(start, duration, { type, frequency, to, q }) {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    filter.Q.value = q;
    const amplifier = this.context.createGain();
    source.connect(filter);
    filter.connect(amplifier);
    amplifier.connect(this.master);
    source.start(start, this.random() * (NOISE_SECONDS - 0.5));
    source.stop(start + duration + 0.05);
    return amplifier;
  }

  hiss(start, duration, { type = 'bandpass', frequency = 1000, to = 0, q = 0.8, gain = 0.4, attack = 0.002 }) {
    this.envelope(this.filteredNoise(start, duration, { type, frequency, to, q }), start, gain, attack, duration);
  }

  fade(amplifier, start, duration, gain) {
    amplifier.gain.setValueCurveAtTime(HANN_WINDOW.map((level) => level * gain), start, duration);
  }

  wash(start, duration, { type = 'bandpass', frequency = 1000, q = 0.8, gain = 0.2 }) {
    this.fade(this.filteredNoise(start, duration, { type, frequency, to: 0, q }), start, duration, gain);
  }

  oscillator(start, duration, { type, frequency, to }) {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    const amplifier = this.context.createGain();
    oscillator.connect(amplifier);
    amplifier.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
    return amplifier;
  }

  tone(start, duration, { type = 'sine', frequency = 440, to = 0, gain = 0.3, attack = 0.003 }) {
    this.envelope(this.oscillator(start, duration, { type, frequency, to }), start, gain, attack, duration);
  }

  swell(start, duration, { type = 'sine', frequency = 440, to = 0, gain = 0.1 }) {
    this.fade(this.oscillator(start, duration, { type, frequency, to }), start, duration, gain);
  }

  tinkles(start, count, spread, gain) {
    for (let i = 0; i < count; i++) {
      this.tone(start + this.random() * spread, this.between(0.05, 0.16), { frequency: this.between(2600, 7400), gain: gain * this.between(0.3, 1), attack: 0.001 });
    }
  }

  bell(start, duration, { frequency, gain }) {
    BELL_RATIOS.forEach((ratio, i) => {
      this.tone(start, duration / (i + 1), { type: 'triangle', frequency: frequency * ratio, gain: gain / (i + 1) });
    });
  }

  drone(start, duration, { frequency, to = 0, cutoff, q, gain, attack }) {
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(cutoff / 3, start + duration);
    const amplifier = this.context.createGain();
    this.envelope(amplifier, start, gain, attack, duration);
    filter.connect(amplifier);
    amplifier.connect(this.master);
    DRONE_SPREAD.forEach((offset) => {
      const oscillator = this.context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency + offset, start);
      if (to) oscillator.frequency.exponentialRampToValueAtTime(to + offset, start + duration);
      oscillator.connect(filter);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    });
  }

  cue(start, parts, level = 1, stretch = 1) {
    parts.forEach(({ voice, duration, gain, delay = 0, ...shape }) => this[voice](start + delay * stretch, duration * stretch, { ...shape, gain: gain * level }));
  }
}
