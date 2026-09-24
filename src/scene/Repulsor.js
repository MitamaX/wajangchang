import { REPULSOR } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, lerp } from '../core/math.js';
import { Field } from './Field.js';

const SHELLS = Object.freeze({ count: 3, spin: 1.5, dash: [0.35, 0.2], width: 2, ripple: 6, depth: 0.05 });
const CORE_SHARE = 0.18;
const FIELD = '120,230,255';
const FIELD_CORE = '235,252,255';

export class Repulsor extends Field {
  constructor(room, handlers) {
    super(room, REPULSOR, handlers);
  }

  get focus() {
    return this.holding ? { x: this.x, y: this.y, radius: this.reach * CORE_SHARE, charge: lerp(...REPULSOR.tension, this.size) } : null;
  }

  thrust(x, y, dt) {
    const dx = x - this.x;
    const dy = y - this.y;
    const distance = Math.hypot(dx, dy);
    const { reach } = this;
    if (distance > reach || distance < 1e-6) return null;
    const strength = (lerp(...REPULSOR.push, this.size) * (1 - distance / reach) * dt) / distance;
    return [dx * strength, dy * strength];
  }

  blow() {
    const { size, reach } = this;
    return {
      ...REPULSOR.burst,
      x: this.x,
      y: this.y,
      strength: lerp(...REPULSOR.strength, size),
      blast: { reach: reach * 1.5, speed: lerp(...REPULSOR.speed, size), heft: REPULSOR.heft },
      force: size,
    };
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.flares.forEach((flare) => this.drawFlare(context, pixel, flare));
    if (!this.holding) return;
    const { x, y, reach, size, time } = this;
    radiate(context, x, y, reach * CORE_SHARE, [[0, `rgba(${FIELD_CORE},${0.8 * size})`], [1, `rgba(${FIELD},0)`]]);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = SHELLS.width * pixel;
    for (let shell = 1; shell <= SHELLS.count; shell++) {
      const radius = (reach * shell) / SHELLS.count;
      const ripple = 1 + Math.sin(time * SHELLS.ripple - shell) * SHELLS.depth;
      context.strokeStyle = `rgba(${FIELD},${(0.55 - shell * 0.12) * (0.4 + 0.6 * size)})`;
      context.setLineDash([radius * SHELLS.dash[0], radius * SHELLS.dash[1]]);
      context.lineDashOffset = time * SHELLS.spin * radius * (shell % 2 ? 1 : -1);
      context.beginPath();
      context.arc(x, y, radius * ripple, 0, TAU);
      context.stroke();
    }
    context.restore();
  }

  drawFlare(context, pixel, { x, y, radius, age }) {
    const t = age / REPULSOR.flareSeconds;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${FIELD_CORE},${1 - t})`;
    context.lineWidth = SHELLS.width * 3 * pixel * (1 - t);
    context.beginPath();
    context.arc(x, y, radius * clamp(0.3 + t * 1.5, 0, 2), 0, TAU);
    context.stroke();
    context.restore();
  }
}
