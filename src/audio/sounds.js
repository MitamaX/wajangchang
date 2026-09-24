import { clamp, lerp } from '../core/math.js';

const DISCHARGE_STRETCH = [0.4, 1];
const VOICE_LEVEL = [0.25, 1.3];
const COLLIDE_LEVEL = [0.1, 1];
const CRACK_CELLS = 160;
const COLLIDE_SPEED = 4;
const SHATTER_BASE = 0.4;
const SHATTER_STEP = 0.1;

const CHIME = Object.freeze({ base: 65, step: 1.12, rise: 1.06, seconds: 1.1, gain: 0.22, cutoff: 600, brighten: 0.25, q: 5, attack: 0.08 });

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
  ignite: [
    { voice: 'tone', duration: 0.35, frequency: 120, to: 40, gain: 0.8, attack: 0.004 },
    { voice: 'hiss', duration: 0.45, type: 'lowpass', frequency: 300, to: 2400, gain: 0.7, attack: 0.01 },
    { voice: 'hiss', duration: 0.12, type: 'highpass', frequency: 3000, gain: 0.25 },
  ],
  roar: [
    { voice: 'hiss', duration: 0.22, type: 'lowpass', frequency: 1400, to: 900, gain: 0.45, attack: 0.03 },
    { voice: 'hiss', duration: 0.22, type: 'bandpass', frequency: 320, q: 1.2, gain: 0.5, attack: 0.03 },
    { voice: 'tone', duration: 0.22, type: 'sawtooth', frequency: 48, gain: 0.06, attack: 0.03 },
  ],
  sizzle: [{ voice: 'hiss', duration: 0.18, type: 'highpass', frequency: 4000, gain: 0.18, attack: 0.02 }],
  explode: [
    { voice: 'tone', duration: 1.1, frequency: 75, to: 24, gain: 1, attack: 0.003 },
    { voice: 'hiss', duration: 1.3, type: 'lowpass', frequency: 3200, to: 90, gain: 0.9 },
    { voice: 'hiss', duration: 0.35, type: 'bandpass', frequency: 1400, q: 0.6, gain: 0.5 },
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
const SEAR_LEVEL = 0.4;

function bite(synth, t, material) {
  synth.cue(t, CUES.rip);
  VOICES[material].collide(synth, t, BITE_RING);
}

function crunch(synth, t, material) {
  synth.cue(t, CUES.grind);
  VOICES[material].crack(synth, t, CRUNCH_LEVEL);
}

function sear(synth, t, material) {
  synth.cue(t, CUES.sizzle);
  VOICES[material].crack(synth, t, SEAR_LEVEL);
}

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
  bite,
  whir: cue('whir'),
  slash: cue('slash'),
  crunch,
  sear,
  hum: cue('hum'),
  clank: cue('clank'),
  ignite: cue('ignite'),
  roar: cue('roar'),
  sever: cue('sever'),
  thud: cue('thud'),
  miss: cue('miss'),
  stamp: cue('stamp'),
  plant: cue('plant'),
  tick: cue('tick'),
  explode: cue('explode'),
});
