import { SOUNDS } from './sounds.js';
import { Synth } from './Synth.js';

const COLLISION_WINDOW = 0.05;
const COLLISIONS_PER_WINDOW = 3;
const UNRECORDED = new Set(['hum', 'whir']);

export class SoundBoard {
  constructor() {
    this.synth = null;
    this.enabled = true;
    this.listener = null;
    this.windowStart = 0;
    this.windowCount = 0;
  }

  get on() {
    return this.enabled;
  }

  set on(value) {
    this.enabled = value;
  }

  unlock() {
    this.clock();
  }

  listen(listener) {
    this.listener = listener;
  }

  clock() {
    if (!this.enabled) return null;
    if (!this.synth) this.boot();
    if (!this.synth) return null;
    const { context } = this.synth;
    if (context.state === 'suspended') context.resume();
    return context.currentTime;
  }

  boot() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) this.synth = new Synth(new AudioContextClass());
  }

  cue(name, ...args) {
    if (this.listener && !UNRECORDED.has(name)) this.listener(name, args);
    const now = this.clock();
    if (now !== null) SOUNDS[name](this.synth, now, ...args);
  }

  collide(material, speed) {
    const now = performance.now() / 1000;
    if (now - this.windowStart > COLLISION_WINDOW) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    if (++this.windowCount > COLLISIONS_PER_WINDOW) return;
    this.cue('collide', material, speed);
  }
}
