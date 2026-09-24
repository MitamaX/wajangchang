import { MICROWAVE } from '../config.js';
import { TAU, clamp, polar, randomBetween } from '../core/math.js';
import { jagged, paintArc } from './Arc.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const GLOW_RATE = 3;
const TINT = Object.freeze({ ink: '255,140,50', alpha: 0.14 });
const BANDS = Object.freeze({ count: 7, amplitude: 0.02, wave: 9, speed: 2.5, width: 3, alpha: 0.18, step: 0.03 });
const ARC = Object.freeze({ seconds: 0.12, reach: 0.035, depth: 3, jag: 0.4, width: 0.5 });

export class Microwave extends Tool {
  constructor(room, { onPulse, onHum }) {
    super(room);
    this.onPulse = onPulse;
    this.onHum = onHum;
    this.holding = false;
    this.cooking = false;
    this.elapsed = 0;
    this.glow = 0;
    this.time = 0;
    this.arcs = [];
    this.pulses = new Pulse(MICROWAVE.pulseSeconds);
    this.hums = new Pulse(MICROWAVE.humSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.glow > 0 || this.arcs.length > 0;
  }

  get power() {
    return Math.min(1, this.elapsed / MICROWAVE.rampSeconds);
  }

  get focus() {
    return this.holding ? { x: 0, y: -this.room.ceiling / 2, radius: this.room.halfWidth, charge: MICROWAVE.tension * this.power } : null;
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

  stow() {
    super.stow();
    this.glow = 0;
    this.arcs = [];
  }

  update(dt) {
    this.time += dt;
    this.glow = clamp(this.glow + (this.holding ? GLOW_RATE : -GLOW_RATE) * dt, 0, 1);
    this.arcs = this.arcs.filter((arc) => (arc.age += dt) < ARC.seconds);
    if (!this.holding) return;
    this.elapsed += dt;
    if (this.hums.tick(dt)) this.onHum(MICROWAVE.humSeconds);
    if (!this.pulses.tick(dt)) return;
    const sparks = this.onPulse({ power: this.power, first: !this.cooking });
    this.cooking = true;
    this.arcs.push(...sparks.map(({ x, y }) => {
      const [dx, dy] = polar(randomBetween(0, TAU), ARC.reach);
      return { path: jagged(x, y, x + dx, y + dy, ARC.depth, ARC.jag), age: 0 };
    }));
  }

  draw(context, pixelsPerMeter) {
    if (!this.glow && !this.arcs.length) return;
    const pixel = 1 / pixelsPerMeter;
    const { halfWidth, ceiling } = this.room;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = `rgba(${TINT.ink},${TINT.alpha * this.glow})`;
    context.fillRect(-halfWidth, -ceiling, halfWidth * 2, ceiling);
    context.strokeStyle = `rgba(${TINT.ink},${BANDS.alpha * this.glow})`;
    context.lineWidth = BANDS.width * pixel;
    for (let band = 1; band <= BANDS.count; band++) {
      const baseline = (-ceiling * band) / (BANDS.count + 1);
      context.beginPath();
      for (let x = -halfWidth; x <= halfWidth; x += BANDS.step) {
        context.lineTo(x, baseline + Math.sin(x * BANDS.wave + this.time * BANDS.speed + band) * BANDS.amplitude);
      }
      context.stroke();
    }
    context.lineCap = 'round';
    this.arcs.forEach(({ path, age }) => paintArc(context, pixel, path, 1 - age / ARC.seconds, ARC.width));
    context.restore();
  }
}
