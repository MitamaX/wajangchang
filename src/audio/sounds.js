import { clamp, lerp } from '../core/math.js';

const DISCHARGE_STRETCH = [0.4, 1];
const VOICE_LEVEL = [0.25, 1.3];
const COLLIDE_LEVEL = [0.1, 1];
const CRACK_CELLS = 160;
const COLLIDE_SPEED = 4;
const SHATTER_BASE = 0.4;
const SHATTER_STEP = 0.1;

const CHIME = Object.freeze({ base: 65, step: 1.12, rise: 1.06, seconds: 1.1, gain: 0.22, cutoff: 600, brighten: 0.25, q: 5, attack: 0.08 });
const SUSTAIN_OVERLAP = 4;

const SUSTAINS = Object.freeze({
  sizzle: [{ voice: 'wash', frequency: 5000, q: 0.6, gain: 0.1 }],
  void: [
    { voice: 'swell', type: 'sawtooth', frequency: 41, gain: 0.07 },
    { voice: 'wash', type: 'lowpass', frequency: 300, q: 4, gain: 0.12 },
  ],
  lava: [
    { voice: 'wash', type: 'lowpass', frequency: 220, q: 1.2, gain: 0.3 },
    { voice: 'swell', frequency: 46, gain: 0.16 },
    { voice: 'wash', frequency: 520, q: 6, gain: 0.05 },
  ],
});

const CUES = Object.freeze({
  thud: [
    { voice: 'tone', duration: 0.2, frequency: 90, to: 38, gain: 0.5 },
    { voice: 'hiss', duration: 0.15, type: 'lowpass', frequency: 700, gain: 0.35 },
  ],
  miss: [
    { voice: 'tone', duration: 0.16, frequency: 95, to: 45, gain: 0.45, attack: 0.004 },
    { voice: 'hiss', duration: 0.12, type: 'lowpass', frequency: 420, gain: 0.4, attack: 0.004 },
  ],
  stamp: [
    { voice: 'tone', duration: 0.16, frequency: 130, to: 55, gain: 0.7 },
    { voice: 'hiss', duration: 0.07, type: 'lowpass', frequency: 1200, gain: 0.5 },
  ],
  seal: [
    { voice: 'tone', duration: 1.4, frequency: 58, to: 32, gain: 0.7, attack: 0.01 },
    { voice: 'bell', duration: 2.4, frequency: 73, gain: 0.22 },
    { voice: 'hiss', duration: 1.2, type: 'lowpass', frequency: 600, to: 80, gain: 0.35, attack: 0.02 },
  ],
  discharge: [
    { voice: 'tone', duration: 1.4, frequency: 68, to: 22, gain: 1, attack: 0.004 },
    { voice: 'drone', duration: 2.4, frequency: 55, to: 36, cutoff: 520, q: 6, gain: 0.55, attack: 0.01 },
    { voice: 'bell', duration: 3, frequency: 49, gain: 0.25 },
    { voice: 'hiss', duration: 1.6, type: 'lowpass', frequency: 1100, to: 70, gain: 0.7 },
  ],
  plant: [
    { voice: 'tone', duration: 0.06, frequency: 520, to: 260, gain: 0.35, attack: 0.002 },
    { voice: 'hiss', duration: 0.04, type: 'highpass', frequency: 2500, gain: 0.2 },
  ],
  tick: [{ voice: 'tone', duration: 0.05, frequency: 2100, gain: 0.1, attack: 0.001 }],
  rip: [
    { voice: 'hiss', duration: 0.12, type: 'bandpass', frequency: 3400, q: 2.5, gain: 0.35 },
    { voice: 'tone', duration: 0.12, type: 'sawtooth', frequency: 190, to: 150, gain: 0.08 },
  ],
  whir: [
    { voice: 'tone', duration: 0.24, type: 'sawtooth', frequency: 118, gain: 0.035, attack: 0.05 },
    { voice: 'hiss', duration: 0.24, type: 'bandpass', frequency: 1800, q: 4, gain: 0.04, attack: 0.05 },
  ],
  slash: [
    { voice: 'hiss', duration: 0.16, type: 'bandpass', frequency: 6000, to: 1500, q: 1.2, gain: 0.5, attack: 0.004 },
    { voice: 'tone', duration: 0.5, type: 'triangle', frequency: 2600, to: 3100, gain: 0.06 },
    { voice: 'bell', duration: 0.9, frequency: 1800, gain: 0.05 },
  ],
  sever: [
    { voice: 'tone', duration: 0.03, frequency: 3200, gain: 0.25, attack: 0.001 },
    { voice: 'tone', duration: 0.25, frequency: 140, to: 50, gain: 0.7 },
    { voice: 'hiss', duration: 0.3, type: 'highpass', frequency: 2500, gain: 0.4 },
  ],
  hum: [
    { voice: 'tone', duration: 0.26, type: 'sawtooth', frequency: 52, gain: 0.06, attack: 0.04 },
    { voice: 'hiss', duration: 0.26, type: 'lowpass', frequency: 300, gain: 0.05, attack: 0.04 },
  ],
  grind: [{ voice: 'hiss', duration: 0.14, type: 'lowpass', frequency: 800, gain: 0.3 }],
  clank: [
    { voice: 'tone', duration: 0.4, frequency: 70, to: 35, gain: 0.8, attack: 0.003 },
    { voice: 'bell', duration: 0.6, frequency: 220, gain: 0.12 },
    { voice: 'hiss', duration: 0.2, type: 'lowpass', frequency: 1200, gain: 0.5 },
  ],
  sear: [
    { voice: 'hiss', duration: 0.7, type: 'bandpass', frequency: 6200, to: 3200, q: 1.1, gain: 0.55, attack: 0.004 },
    { voice: 'hiss', duration: 0.22, type: 'highpass', frequency: 7500, gain: 0.3, attack: 0.002 },
  ],
  gunshot: [
    { voice: 'hiss', duration: 0.09, type: 'highpass', frequency: 1800, gain: 0.45, attack: 0.001 },
    { voice: 'tone', duration: 0.1, frequency: 160, to: 60, gain: 0.5, attack: 0.001 },
    { voice: 'hiss', duration: 0.05, type: 'bandpass', frequency: 4200, q: 1.2, gain: 0.25, attack: 0.001 },
  ],
  thunder: [
    { voice: 'hiss', duration: 0.12, type: 'highpass', frequency: 2500, gain: 0.7, attack: 0.001 },
    { voice: 'tone', duration: 1.6, frequency: 55, to: 28, gain: 0.9, attack: 0.01 },
    { voice: 'hiss', duration: 2.2, type: 'lowpass', frequency: 900, to: 60, gain: 0.8, attack: 0.02 },
  ],
  nuke: [
    { voice: 'hiss', duration: 0.3, type: 'highpass', frequency: 2000, gain: 0.8, attack: 0.001 },
    { voice: 'tone', duration: 3.5, frequency: 50, to: 18, gain: 1, attack: 0.01 },
    { voice: 'hiss', duration: 4, type: 'lowpass', frequency: 1800, to: 40, gain: 1, attack: 0.02 },
    { voice: 'drone', duration: 4, frequency: 40, to: 25, cutoff: 400, q: 2, gain: 0.5, attack: 0.05 },
  ],
  collapse: [
    { voice: 'hiss', duration: 0.35, type: 'bandpass', frequency: 300, to: 2400, q: 2, gain: 0.4, attack: 0.3 },
    { voice: 'tone', duration: 0.9, frequency: 90, to: 30, gain: 0.9, attack: 0.004 },
    { voice: 'bell', duration: 1.2, frequency: 61, gain: 0.2 },
  ],
  whistle: [{ voice: 'tone', duration: 1.2, frequency: 1800, to: 500, gain: 0.08, attack: 0.05 }],
  pop: [
    { voice: 'tone', duration: 0.06, frequency: 300, to: 120, gain: 0.4 },
    { voice: 'hiss', duration: 0.08, frequency: 1800, q: 1, gain: 0.3 },
  ],
  punch: [
    { voice: 'tone', duration: 0.25, frequency: 90, to: 40, gain: 0.9, attack: 0.002 },
    { voice: 'hiss', duration: 0.12, type: 'lowpass', frequency: 1500, gain: 0.6 },
  ],
  swing: [{ voice: 'hiss', duration: 0.25, type: 'bandpass', frequency: 600, to: 1600, q: 2, gain: 0.3, attack: 0.08 }],
  wrecking: [
    { voice: 'tone', duration: 0.5, frequency: 70, to: 30, gain: 1, attack: 0.002 },
    { voice: 'hiss', duration: 0.4, type: 'lowpass', frequency: 1400, gain: 0.7 },
    { voice: 'bell', duration: 0.8, frequency: 160, gain: 0.12 },
  ],
  creak: [
    { voice: 'tone', duration: 0.35, type: 'sawtooth', frequency: 180, to: 140, gain: 0.04, attack: 0.05 },
    { voice: 'hiss', duration: 0.3, frequency: 1200, q: 8, gain: 0.06, attack: 0.05 },
  ],
  explode: [
    { voice: 'tone', duration: 1.1, frequency: 75, to: 24, gain: 1, attack: 0.003 },
    { voice: 'hiss', duration: 1.3, type: 'lowpass', frequency: 3200, to: 90, gain: 0.9 },
    { voice: 'hiss', duration: 0.35, type: 'bandpass', frequency: 1400, q: 0.6, gain: 0.5 },
  ],
  cutter: [
    { voice: 'bell', duration: 0.5, frequency: 1250, gain: 0.08 },
    { voice: 'tone', duration: 0.14, frequency: 240, to: 90, gain: 0.55, attack: 0.002 },
    { voice: 'hiss', duration: 0.06, type: 'highpass', frequency: 3200, gain: 0.3 },
  ],
  blub: [{ voice: 'tone', duration: 0.07, frequency: 160, to: 520, gain: 0.1, attack: 0.005 }],
});

const VOICES = {
  glass: {
    strike(synth, t, level) {
      synth.tone(t, 0.08, { frequency: 1900, to: 900, gain: 0.22 * level });
      synth.hiss(t, 0.06, { type: 'highpass', frequency: 3000, gain: 0.3 * level });
      synth.tinkles(t, 3, 0.1, 0.06);
    },
    crack(synth, t, level) {
      synth.hiss(t, 0.25, { type: 'bandpass', frequency: 4200, q: 1.4, gain: 0.25 * level });
      synth.tinkles(t + 0.02, 4 + Math.round(level * 6), 0.35, 0.08);
    },
    shatter(synth, t, level) {
      synth.tone(t, 0.12, { frequency: 150, to: 48, gain: 0.4 * level });
      synth.hiss(t, 0.4, { type: 'bandpass', frequency: 5000, q: 0.8, gain: 0.3 * level });
      synth.tinkles(t + 0.02, 8 + Math.round(level * 10), 0.6, 0.08);
    },
    collide(synth, t, level) {
      synth.tone(t, synth.between(0.05, 0.12), { frequency: synth.between(2400, 6400), gain: 0.05 + 0.1 * level, attack: 0.001 });
    },
  },
  wood: {
    strike(synth, t, level) {
      synth.tone(t, 0.12, { frequency: 210, to: 110, gain: 0.5 * level });
      synth.hiss(t, 0.08, { type: 'bandpass', frequency: 900, q: 1.2, gain: 0.35 * level });
    },
    crack(synth, t, level) {
      for (let i = 0; i < 5; i++) {
        synth.hiss(t + synth.between(0, 0.12), synth.between(0.015, 0.03), { type: 'highpass', frequency: synth.between(1500, 3500), gain: 0.22 * level, attack: 0.001 });
      }
      synth.tone(t, 0.1, { frequency: 140, to: 90, gain: 0.25 * level });
    },
    shatter(synth, t, level) {
      synth.hiss(t, 0.05, { type: 'highpass', frequency: 1200, gain: 0.5 * level });
      synth.tone(t, 0.15, { frequency: 180, to: 70, gain: 0.45 * level });
    },
    collide(synth, t, level) {
      synth.tone(t, 0.06, { frequency: synth.between(280, 520), gain: 0.08 + 0.18 * level });
      synth.hiss(t, 0.04, { type: 'bandpass', frequency: 800, gain: 0.1 * level });
    },
  },
  stone: {
    strike(synth, t, level) {
      synth.tone(t, 0.16, { frequency: 120, to: 55, gain: 0.6 * level });
      synth.hiss(t, 0.14, { type: 'lowpass', frequency: 1100, gain: 0.45 * level });
      synth.hiss(t, 0.05, { type: 'bandpass', frequency: 2600, q: 0.9, gain: 0.2 * level });
    },
    crack(synth, t, level) {
      synth.hiss(t, 0.22, { type: 'bandpass', frequency: 1800, q: 0.7, gain: 0.35 * level });
      synth.tone(t, 0.18, { frequency: 80, to: 40, gain: 0.35 * level });
    },
    shatter(synth, t, level) {
      synth.hiss(t, 0.45, { type: 'lowpass', frequency: 900, gain: 0.5 * level });
      for (let i = 0; i < 6; i++) synth.hiss(t + synth.between(0, 0.3), 0.03, { type: 'bandpass', frequency: synth.between(1500, 3500), gain: 0.15 * level });
    },
    collide(synth, t, level) {
      synth.tone(t, 0.07, { frequency: synth.between(150, 220), gain: 0.1 + 0.2 * level });
      synth.hiss(t, 0.05, { type: 'lowpass', frequency: 900, gain: 0.12 * level });
    },
  },
  metal: {
    strike(synth, t, level) {
      synth.bell(t, 0.9, { frequency: synth.between(420, 520), gain: 0.18 * level });
      synth.hiss(t, 0.04, { type: 'highpass', frequency: 3000, gain: 0.3 * level });
    },
    crack(synth, t, level) {
      synth.hiss(t, 0.2, { type: 'bandpass', frequency: 2500, q: 4, gain: 0.2 * level });
      synth.tone(t, 0.18, { type: 'sawtooth', frequency: 900, to: 600, gain: 0.06 * level });
    },
    shatter(synth, t, level) {
      synth.bell(t, 0.5, { frequency: 300, gain: 0.2 * level });
    },
    collide(synth, t, level) {
      synth.bell(t, 0.25, { frequency: synth.between(800, 1400), gain: 0.04 + 0.06 * level });
    },
  },
};

const cue = (name) => (synth, t, level = 1) => synth.cue(t, CUES[name], level);
const voice = (part, level) => (synth, t, material, amount) => VOICES[material][part](synth, t, level(amount));
const voiceLevel = (amount) => clamp(amount, ...VOICE_LEVEL);
const BITE_RING = 0.6;
const CRUNCH_LEVEL = 0.8;

const chew = (name, part, level) => (synth, t, material) => {
  synth.cue(t, CUES[name]);
  VOICES[material][part](synth, t, level);
};

const sustain = (name) => (synth, t, cadence) => {
  SUSTAINS[name].forEach(({ voice, ...shape }) => synth[voice](t, cadence * SUSTAIN_OVERLAP, shape));
};

function chime(synth, t, tier, final) {
  const { base, step, rise, seconds, gain, cutoff, brighten, q, attack } = CHIME;
  const frequency = base * step ** tier;
  synth.drone(t, seconds, { frequency, to: frequency * rise, cutoff: cutoff * (1 + brighten * tier), q, gain, attack });
  synth.tone(t, seconds, { frequency: frequency / 2, gain, attack });
  if (final) synth.cue(t, CUES.seal);
}

export const SOUNDS = Object.freeze({
  strike: voice('strike', voiceLevel),
  crack: voice('crack', (cells) => voiceLevel(cells / CRACK_CELLS)),
  shatter: voice('shatter', (pieces) => voiceLevel(SHATTER_BASE + pieces * SHATTER_STEP)),
  collide: voice('collide', (speed) => clamp(speed / COLLIDE_SPEED, ...COLLIDE_LEVEL)),
  discharge: (synth, t, level) => synth.cue(t, CUES.discharge, level, lerp(...DISCHARGE_STRETCH, level)),
  chime,
  bite: chew('rip', 'collide', BITE_RING),
  whir: cue('whir'),
  slash: cue('slash'),
  crunch: chew('grind', 'crack', CRUNCH_LEVEL),
  sear: cue('sear'),
  sizzle: sustain('sizzle'),
  void: sustain('void'),
  lava: sustain('lava'),
  gunshot: cue('gunshot'),
  thunder: cue('thunder'),
  nuke: cue('nuke'),
  collapse: cue('collapse'),
  whistle: cue('whistle'),
  pop: cue('pop'),
  punch: cue('punch'),
  swing: cue('swing'),
  wrecking: cue('wrecking'),
  creak: cue('creak'),
  hum: cue('hum'),
  clank: cue('clank'),
  sever: cue('sever'),
  thud: cue('thud'),
  miss: cue('miss'),
  stamp: cue('stamp'),
  plant: cue('plant'),
  tick: cue('tick'),
  explode: cue('explode'),
  cutter: cue('cutter'),
  blub: cue('blub'),
});
