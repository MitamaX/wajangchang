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
const PUNCH_GLASS = Object.freeze({ delay: 0.02, count: 12, spread: 0.4, gain: 0.07 });
const BLUB = Object.freeze({ pitch: [110, 240], rise: 3.4, seconds: 0.08, gain: 0.12 });
const PASS = Object.freeze({ pitch: [1320, 990], whoosh: Object.freeze({ attack: 0.04, seconds: 0.3, from: 1800, to: 500, gain: 0.35 }) });
const VORTEX = Object.freeze({ rumble: [34, 52], drone: [220, 420], whine: [320, 760], wind: [700, 1500] });
const STATIC = Object.freeze({ snaps: 14, spread: 0.24, duration: 0.012, frequency: [2400, 7000], gain: [0.05, 0.16] });

const SUSTAINS = Object.freeze({
  sizzle: [{ voice: 'wash', frequency: 5000, q: 0.6, gain: 0.1 }],
  motor: [
    { voice: 'swell', type: 'sawtooth', frequency: 118, gain: 0.03 },
    { voice: 'swell', type: 'square', frequency: 236, gain: 0.01 },
    { voice: 'wash', frequency: 1900, q: 3, gain: 0.05 },
  ],
  lava: [
    { voice: 'wash', type: 'lowpass', frequency: 220, q: 1.2, gain: 0.3 },
    { voice: 'swell', frequency: 46, gain: 0.16 },
    { voice: 'swell', type: 'triangle', frequency: 69, gain: 0.06 },
    { voice: 'wash', frequency: 520, q: 6, gain: 0.05 },
    { voice: 'wash', type: 'highpass', frequency: 5200, q: 0.5, gain: 0.025 },
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
    { voice: 'hiss', duration: 0.06, type: 'highpass', frequency: 2600, gain: 0.5, attack: 0.001 },
    { voice: 'tone', duration: 0.12, frequency: 180, to: 52, gain: 0.7, attack: 0.001 },
    { voice: 'hiss', duration: 0.14, type: 'lowpass', frequency: 1300, gain: 0.5, attack: 0.001 },
    { voice: 'tone', duration: 0.025, type: 'square', frequency: 950, to: 480, gain: 0.05, attack: 0.001 },
    { voice: 'bell', duration: 0.16, frequency: 3600, gain: 0.02, delay: 0.32 },
  ],
  spindown: [
    { voice: 'tone', duration: 0.8, type: 'sawtooth', frequency: 236, to: 46, gain: 0.05, attack: 0.01 },
    { voice: 'hiss', duration: 0.7, type: 'bandpass', frequency: 2200, to: 420, q: 3, gain: 0.07, attack: 0.01 },
  ],
  thunder: [
    { voice: 'hiss', duration: 0.07, type: 'highpass', frequency: 3200, gain: 0.95, attack: 0.0008 },
    { voice: 'tone', duration: 0.14, type: 'sawtooth', frequency: 1900, to: 140, gain: 0.1, attack: 0.001 },
    { voice: 'tone', duration: 0.6, frequency: 96, to: 30, gain: 1, attack: 0.002 },
    { voice: 'hiss', duration: 0.4, type: 'bandpass', frequency: 1900, to: 420, q: 0.7, gain: 0.75, attack: 0.002 },
    { voice: 'hiss', duration: 2.6, type: 'lowpass', frequency: 760, to: 60, gain: 0.8, attack: 0.05, delay: 0.1 },
    { voice: 'drone', duration: 2.6, frequency: 38, to: 26, cutoff: 280, q: 3, gain: 0.4, attack: 0.3, delay: 0.18 },
    { voice: 'hiss', duration: 1.9, type: 'lowpass', frequency: 420, to: 50, gain: 0.6, attack: 0.25, delay: 0.7 },
    { voice: 'tone', duration: 1.6, frequency: 44, to: 26, gain: 0.45, attack: 0.2, delay: 0.9 },
  ],
  nuke: [
    { voice: 'tone', duration: 1.2, frequency: 110, to: 26, gain: 1, attack: 0.004 },
    { voice: 'hiss', duration: 0.6, type: 'lowpass', frequency: 2600, to: 300, gain: 0.9, attack: 0.002 },
    { voice: 'tone', duration: 6, frequency: 42, to: 16, gain: 1, attack: 0.02 },
    { voice: 'hiss', duration: 6, type: 'lowpass', frequency: 1100, to: 35, gain: 1, attack: 0.04 },
    { voice: 'drone', duration: 6.5, frequency: 36, to: 20, cutoff: 300, q: 2, gain: 0.6, attack: 0.08 },
    { voice: 'hiss', duration: 4.5, type: 'bandpass', frequency: 480, to: 90, q: 0.6, gain: 0.6, attack: 0.9, delay: 0.4 },
    { voice: 'tone', duration: 3.2, frequency: 46, to: 20, gain: 0.7, attack: 0.35, delay: 1.2 },
    { voice: 'hiss', duration: 3.4, type: 'lowpass', frequency: 380, to: 40, gain: 0.6, attack: 0.4, delay: 1.6 },
    { voice: 'swell', duration: 5, type: 'sawtooth', frequency: 28, to: 17, gain: 0.25, delay: 0.3 },
  ],
  collapse: [
    { voice: 'tone', duration: 1.1, frequency: 110, to: 24, gain: 1, attack: 0.003 },
    { voice: 'drone', duration: 1.8, frequency: 46, to: 28, cutoff: 360, q: 4, gain: 0.45, attack: 0.01 },
    { voice: 'hiss', duration: 1.4, type: 'lowpass', frequency: 2400, to: 70, gain: 0.8 },
    { voice: 'hiss', duration: 0.5, type: 'bandpass', frequency: 4200, to: 700, q: 1.2, gain: 0.35 },
    { voice: 'bell', duration: 1.6, frequency: 61, gain: 0.22 },
    { voice: 'swell', duration: 1.2, type: 'sine', frequency: 880, to: 220, gain: 0.05 },
  ],
  descent: [
    { voice: 'drone', duration: 1.4, frequency: 62, to: 44, cutoff: 320, q: 3, gain: 0.35, attack: 0.9 },
    { voice: 'hiss', duration: 1.4, type: 'bandpass', frequency: 1400, to: 380, q: 0.9, gain: 0.3, attack: 1 },
  ],
  pop: [
    { voice: 'tone', duration: 0.07, frequency: 360, to: 140, gain: 0.4 },
    { voice: 'hiss', duration: 0.08, frequency: 1800, q: 1, gain: 0.3 },
    { voice: 'tone', duration: 0.09, type: 'triangle', frequency: 900, to: 1500, gain: 0.07, delay: 0.02 },
  ],
  punch: [
    { voice: 'tone', duration: 0.34, frequency: 120, to: 36, gain: 1, attack: 0.002 },
    { voice: 'hiss', duration: 0.08, type: 'lowpass', frequency: 2400, gain: 0.85, attack: 0.001 },
    { voice: 'hiss', duration: 0.5, type: 'bandpass', frequency: 5600, to: 2600, q: 0.9, gain: 0.45, attack: 0.001, delay: 0.012 },
    { voice: 'bell', duration: 0.5, frequency: 2100, gain: 0.05, delay: 0.02 },
    { voice: 'hiss', duration: 0.7, type: 'lowpass', frequency: 700, to: 90, gain: 0.35, delay: 0.03 },
  ],
  gong: [
    { voice: 'tone', duration: 0.5, frequency: 80, to: 32, gain: 1, attack: 0.002 },
    { voice: 'hiss', duration: 0.3, type: 'lowpass', frequency: 1600, gain: 0.7 },
    { voice: 'bell', duration: 2.4, frequency: 148, gain: 0.3 },
    { voice: 'bell', duration: 1.6, frequency: 391, gain: 0.1 },
    { voice: 'drone', duration: 2, frequency: 74, to: 70, cutoff: 700, q: 3, gain: 0.2, attack: 0.01 },
  ],
  latch: [
    { voice: 'tone', duration: 0.03, type: 'square', frequency: 900, to: 560, gain: 0.08, attack: 0.001 },
    { voice: 'hiss', duration: 0.04, type: 'highpass', frequency: 3000, gain: 0.25, attack: 0.001 },
    { voice: 'bell', duration: 0.35, frequency: 760, gain: 0.06 },
    { voice: 'tone', duration: 0.03, type: 'square', frequency: 820, to: 520, gain: 0.06, attack: 0.001, delay: 0.07 },
  ],
  explode: [
    { voice: 'tone', duration: 1.1, frequency: 75, to: 24, gain: 1, attack: 0.003 },
    { voice: 'hiss', duration: 1.3, type: 'lowpass', frequency: 3200, to: 90, gain: 0.9 },
    { voice: 'hiss', duration: 0.35, type: 'bandpass', frequency: 1400, q: 0.6, gain: 0.5 },
  ],
  cutter: [
    { voice: 'hiss', duration: 0.07, type: 'bandpass', frequency: 4800, to: 1600, q: 1.6, gain: 0.45, attack: 0.001 },
    { voice: 'tone', duration: 0.18, frequency: 210, to: 70, gain: 0.7, attack: 0.002 },
    { voice: 'hiss', duration: 0.12, type: 'lowpass', frequency: 900, gain: 0.35 },
    { voice: 'bell', duration: 0.6, frequency: 1250, gain: 0.07, delay: 0.005 },
    { voice: 'bell', duration: 0.45, frequency: 1870, gain: 0.04, delay: 0.005 },
  ],
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

function punch(synth, t, level) {
  synth.cue(t, CUES.punch, level);
  synth.tinkles(t + PUNCH_GLASS.delay, PUNCH_GLASS.count, PUNCH_GLASS.spread, PUNCH_GLASS.gain);
}

function vortex(synth, t, cadence, size) {
  const span = cadence * SUSTAIN_OVERLAP;
  const { rumble, drone, whine, wind } = VORTEX;
  synth.swell(t, span, { type: 'sawtooth', frequency: lerp(...rumble, size), gain: 0.07 });
  synth.wash(t, span, { type: 'lowpass', frequency: lerp(...drone, size), q: 4, gain: 0.12 });
  synth.swell(t, span, { frequency: lerp(...whine, size), gain: 0.012 + 0.02 * size });
  synth.wash(t, span, { frequency: lerp(...wind, size), q: 1.2, gain: 0.05 * size });
}

function sweep(synth, t, rush, beat) {
  const { pitch, whoosh } = PASS;
  synth.tone(t, 0.05, { type: 'triangle', frequency: pitch[beat], gain: 0.12, attack: 0.001 });
  synth.bell(t, 0.25, { frequency: pitch[beat] * 2, gain: 0.03 });
  if (rush > 0) synth.hiss(t, whoosh.seconds, { type: 'bandpass', frequency: whoosh.from, to: whoosh.to, q: 1.2, gain: whoosh.gain * rush, attack: whoosh.attack });
}

function blub(synth, t) {
  const { pitch, rise, seconds, gain } = BLUB;
  const frequency = synth.between(...pitch);
  synth.tone(t, seconds, { frequency, to: frequency * rise, gain, attack: 0.005 });
  synth.hiss(t + seconds * 0.6, seconds, { type: 'bandpass', frequency: frequency * 6, q: 3, gain: gain * 0.6 });
}

function crackle(synth, t) {
  const { snaps, spread, duration, frequency, gain } = STATIC;
  for (let snap = 0; snap < snaps; snap++) {
    const share = snap / snaps;
    synth.hiss(t + share * spread + synth.between(0, spread / snaps), duration, { type: 'highpass', frequency: synth.between(...frequency), gain: lerp(...gain, share), attack: 0.0008 });
  }
  synth.swell(t, spread, { type: 'sawtooth', frequency: 90, to: 180, gain: 0.03 });
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
  void: vortex,
  lava: sustain('lava'),
  gunshot: cue('gunshot'),
  spindown: cue('spindown'),
  motor: sustain('motor'),
  thunder: cue('thunder'),
  static: crackle,
  nuke: cue('nuke'),
  collapse: cue('collapse'),
  descent: cue('descent'),
  pop: cue('pop'),
  punch,
  gong: cue('gong'),
  latch: cue('latch'),
  pass: sweep,
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
  blub,
});
