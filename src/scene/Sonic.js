import { SONIC } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, easeOut } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RING_WIDTH = 2;
const CORE_REACH = 0.02;
const WAVE = '190,225,255';

export class Sonic extends Tool {
  constructor(room, { onPulse, onTone }) {
    super(room);
    this.onPulse = onPulse;
    this.onTone = onTone;
    this.holding = false;
    this.resonating = false;
    this.elapsed = 0;
    this.rings = [];
    this.pulses = new Pulse(SONIC.pulseSeconds);
    this.tones = new Pulse(SONIC.toneSeconds);
  }

  get busy() {
    return this.holding || this.rings.length > 0;
  }

  get power() {
    return Math.min(1, this.elapsed / SONIC.rampSeconds);
  }

  get emitting() {
    return this.holding && this.present;
  }

  get focus() {
    return this.emitting ? { x: this.aimX, y: this.aimY, radius: CORE_REACH, charge: SONIC.tension * this.power } : null;
  }

  windUp() {
    this.holding = true;
    this.elapsed = 0;
    this.pulses.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  update(dt) {
    this.rings = this.rings.filter((ring) => (ring.age += dt) < SONIC.ringSeconds);
    if (!this.emitting) return;
    this.elapsed += dt;
    if (this.tones.tick(dt)) this.onTone(SONIC.toneSeconds);
    if (!this.pulses.tick(dt)) return;
    const { aimX: x, aimY: y, power } = this;
    this.rings.push({ x, y, power, age: 0 });
    this.resonating = this.onPulse({ x, y, power, first: !this.resonating });
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = RING_WIDTH * pixel;
    this.rings.forEach(({ x, y, power, age }) => {
      const t = age / SONIC.ringSeconds;
      context.strokeStyle = `rgba(${WAVE},${(1 - t) * (0.3 + 0.5 * power)})`;
      context.beginPath();
      context.arc(x, y, SONIC.reach * easeOut(t), 0, TAU);
      context.stroke();
    });
    context.restore();
    if (this.present) radiate(context, this.aimX, this.aimY, CORE_REACH, [[0, `rgba(${WAVE},${0.5 + 0.5 * this.power})`], [1, `rgba(${WAVE},0)`]]);
  }
}
