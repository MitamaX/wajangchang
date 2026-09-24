import { SOUNDS } from './sounds.js';
import { Synth } from './Synth.js';

const COLLISION_WINDOW = 0.05;
const COLLISIONS_PER_WINDOW = 3;

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

  emit(name, ...args) {
    if (this.listener) this.listener(name, args);
    this.play(name, ...args);
  }

  play(name, ...args) {
    const now = this.clock();
    if (now !== null) SOUNDS[name](this.synth, now, ...args);
  }

  strike(material, strength) {
    this.emit('strike', material, strength);
  }

  crack(material, cells) {
    this.emit('crack', material, cells);
  }

  shatter(material, pieces) {
    this.emit('shatter', material, pieces);
  }

  collide(material, speed) {
    const now = performance.now() / 1000;
    if (now - this.windowStart > COLLISION_WINDOW) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    if (++this.windowCount > COLLISIONS_PER_WINDOW) return;
    this.emit('collide', material, speed);
  }

  thud() {
    this.emit('thud');
  }

  miss() {
    this.emit('miss');
  }

  discharge(level) {
    this.emit('discharge', level);
  }

  plant() {
    this.emit('plant');
  }

  tick() {
    this.emit('tick');
  }

  explode(level) {
    this.emit('explode', level);
  }

  bite(material) {
    this.emit('bite', material);
  }

  slash() {
    this.emit('slash');
  }

  sever() {
    this.emit('sever');
  }

  crunch(material) {
    this.emit('crunch', material);
  }

  clank() {
    this.emit('clank');
  }

  roar() {
    this.emit('roar');
  }

  hum() {
    this.play('hum');
  }

  whir() {
    this.play('whir');
  }

  chime(tier, final) {
    this.emit('chime', tier, final);
  }

  stamp() {
    this.emit('stamp');
  }
}
