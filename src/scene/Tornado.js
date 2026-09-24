import { TORNADO } from '../config.js';
import { TAU, clamp, lerp } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RINGS = 18;
const STRANDS = 5;
const STRAND_POINTS = 24;
const STRAND_TWIST = 18;
const STRAND_SPIN = 9;
const SWAY_REACH = 0.035;
const SWAY_WAVE = 7;
const RING_SPIN = 1.4;
const RING_SQUASH = 0.22;
const RING_DASH = [0.6, 0.4];
const REACH = 1.8;
const CHURN_RATE = 7;
const CHURN_WAVE = 20;
const CHURN_SHARE = 0.6;
const LINE_WIDTH = 1.6;
const DUST = '206,200,190';

export class Tornado extends Tool {
  constructor(room, { onEngage, onSweep, onDust, onGale }) {
    super(room);
    this.onEngage = onEngage;
    this.onSweep = onSweep;
    this.onDust = onDust;
    this.onGale = onGale;
    this.holding = false;
    this.power = 0;
    this.x = 0;
    this.time = 0;
    this.dusts = new Pulse(TORNADO.dustSeconds);
    this.gales = new Pulse(TORNADO.galeSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.power > 0;
  }

  get top() {
    return -this.room.ceiling * TORNADO.topShare;
  }

  get focus() {
    return this.holding ? { x: this.x, y: this.top / 2, radius: TORNADO.radius[1], charge: TORNADO.tension * this.power } : null;
  }

  windUp() {
    if (!this.power) this.x = this.aimX;
    this.holding = true;
    this.onEngage();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.power = 0;
  }

  heightShare(y) {
    return clamp(y / this.top, 0, 1);
  }

  radiusAt(y) {
    return lerp(...TORNADO.radius, this.heightShare(y));
  }

  axisAt(y) {
    return this.x + Math.sin(this.time * TORNADO.sway + y * SWAY_WAVE) * SWAY_REACH * this.heightShare(y);
  }

  update(dt) {
    this.time += dt;
    this.power = clamp(this.power + (this.holding ? dt : -2 * dt) / TORNADO.spinUp, 0, 1);
    if (!this.power) return;
    const step = TORNADO.travel * dt;
    this.x = clamp(this.aimX, this.x - step, this.x + step);
    this.onSweep((x, y, vx) => this.drive(x, y, vx, dt));
    if (this.dusts.tick(dt)) this.onDust(this.x);
    if (this.holding && this.gales.tick(dt)) this.onGale(TORNADO.galeSeconds);
  }

  drive(x, y, vx, dt) {
    const radius = this.radiusAt(y);
    const offset = x - this.axisAt(y);
    const within = 1 - Math.abs(offset) / (radius * REACH);
    if (within <= 0) return null;
    const strength = this.power * within * dt;
    const share = this.heightShare(y);
    const outward = Math.max(0, share - TORNADO.flingShare) / (1 - TORNADO.flingShare);
    const churn = Math.sin(this.time * CHURN_RATE + y * CHURN_WAVE) * CHURN_SHARE;
    const sideways = (churn - offset / radius) * TORNADO.inward - vx + Math.sign(offset || 1) * TORNADO.fling * outward;
    return [sideways * strength, -TORNADO.lift * (1 - share * share) * strength];
  }

  draw(context, pixelsPerMeter) {
    if (!this.power) return;
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.lineWidth = LINE_WIDTH * pixel;
    context.lineCap = 'round';
    this.drawRings(context);
    this.drawStrands(context);
    context.restore();
  }

  drawRings(context) {
    for (let ring = 0; ring < RINGS; ring++) {
      const share = ring / (RINGS - 1);
      const y = this.top * share;
      const radius = this.radiusAt(y);
      context.strokeStyle = `rgba(${DUST},${this.power * (0.12 + 0.3 * share)})`;
      context.setLineDash([radius * RING_DASH[0], radius * RING_DASH[1]]);
      context.lineDashOffset = -this.time * RING_SPIN * radius * TAU;
      context.beginPath();
      context.ellipse(this.axisAt(y), y, radius, radius * RING_SQUASH, 0, 0, TAU);
      context.stroke();
    }
    context.setLineDash([]);
  }

  drawStrands(context) {
    for (let strand = 0; strand < STRANDS; strand++) {
      const phase = (strand / STRANDS) * TAU + this.time * STRAND_SPIN;
      context.strokeStyle = `rgba(${DUST},${0.35 * this.power})`;
      context.beginPath();
      for (let point = 0; point <= STRAND_POINTS; point++) {
        const y = (this.top * point) / STRAND_POINTS;
        context.lineTo(this.axisAt(y) + Math.sin(phase + (y * STRAND_TWIST) / this.top) * this.radiusAt(y), y);
      }
      context.stroke();
    }
  }
}
