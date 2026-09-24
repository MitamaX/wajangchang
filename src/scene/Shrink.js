import { SHRINK } from '../config.js';
import { radiate, steel, strokeLayers, traceRoundRect } from '../core/canvas.js';
import { TAU, lerp, normalize } from '../core/math.js';
import { Ray } from './Ray.js';

const GUN = Object.freeze({ length: 0.064, body: 0.052, width: 0.022, coils: 3, coil: 0.004, flare: 0.036, lens: 0.003, orb: 0.016 });
const WAVE = Object.freeze({ step: 0.004, count: 90, speed: 30, depth: 0.004 });
const RINGS = Object.freeze({ spacing: 0.05, speed: 0.4, size: [0.02, 0.006], squash: 0.35, width: 1.6 });
const BEAM = Object.freeze({ glow: 8, core: 1.4 });
const SPOT = Object.freeze({ reach: 0.03, rate: 2.5, width: 1.4 });
const RAY = '190,120,255';
const RAY_CORE = '246,236,255';
const COIL = '#d8342b';
const HORN = '#3a3f45';

export class Shrink extends Ray {
  constructor(room, surface, { onShrink, onHum }) {
    super(room, surface, SHRINK, SHRINK.zapSeconds, onHum);
    this.onShrink = onShrink;
    this.time = 0;
  }

  get base() {
    return [this.room.halfWidth - SHRINK.mount, -this.room.height + SHRINK.mount];
  }

  get barrel() {
    return GUN.length;
  }

  land({ x, y }, first) {
    return this.onShrink({ x, y, first });
  }

  update(dt) {
    this.time += dt;
    super.update(dt);
  }

  drawBeam(context, pixel) {
    const { power, time } = this;
    const [x, y] = this.muzzle;
    const { x: endX, y: endY } = this.end;
    const length = Math.hypot(endX - x, endY - y);
    const [dx, dy] = normalize(endX - x, endY - y);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.beginPath();
    for (let along = 0; along <= length; along += WAVE.step) {
      const sway = Math.sin(along * WAVE.count - time * WAVE.speed) * WAVE.depth * power;
      context.lineTo(x + dx * along - dy * sway, y + dy * along + dx * sway);
    }
    strokeLayers(context, pixel * power, [[BEAM.glow, `rgba(${RAY},0.35)`], [BEAM.core, `rgba(${RAY_CORE},0.9)`]]);
    context.strokeStyle = `rgba(${RAY},${0.8 * power})`;
    context.lineWidth = RINGS.width * pixel;
    for (let along = (time * RINGS.speed) % RINGS.spacing; along < length; along += RINGS.spacing) {
      const size = lerp(...RINGS.size, along / length);
      context.beginPath();
      context.ellipse(x + dx * along, y + dy * along, size * RINGS.squash, size, Math.atan2(dy, dx), 0, TAU);
      context.stroke();
    }
    context.restore();
    this.drawSpot(context, pixel, endX, endY);
  }

  drawSpot(context, pixel, x, y) {
    const { power } = this;
    radiate(context, x, y, SPOT.reach * power, [[0, `rgba(${RAY_CORE},${power})`], [0.4, `rgba(${RAY},${0.5 * power})`], [1, `rgba(${RAY},0)`]]);
    if (!this.landing) return;
    const closing = 1 - ((this.time * SPOT.rate) % 1);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${RAY_CORE},${(1 - closing) * power})`;
    context.lineWidth = SPOT.width * pixel;
    context.beginPath();
    context.arc(x, y, SPOT.reach * closing, 0, TAU);
    context.stroke();
    context.restore();
  }

  paintHead(context) {
    const { body, width, coils, coil, flare, lens, orb, length } = GUN;
    context.fillStyle = HORN;
    context.beginPath();
    context.moveTo(body, -width * 0.3);
    context.lineTo(length, -flare / 2);
    context.lineTo(length, flare / 2);
    context.lineTo(body, width * 0.3);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = steel(context, 0, -width / 2, 0, width / 2);
    traceRoundRect(context, -orb * 0.5, -width / 2, body + orb * 0.5, width, width / 2);
    context.fill();
    context.stroke();
    context.fillStyle = COIL;
    for (let ring = 1; ring <= coils; ring++) context.fillRect((body * ring) / (coils + 1) - coil / 2, -width / 2, coil, width);
    context.fillStyle = `rgba(${RAY_CORE},${0.4 + 0.6 * this.power})`;
    context.fillRect(length - lens, -flare / 2, lens, flare);
    context.fillStyle = steel(context, -orb, -orb, orb, orb);
    context.beginPath();
    context.arc(0, 0, orb, 0, TAU);
    context.fill();
    context.stroke();
  }
}
