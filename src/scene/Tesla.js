import { TESLA } from '../config.js';
import { inkOutline, radiate, steel } from '../core/canvas.js';
import { TAU, polar, randomBetween } from '../core/math.js';
import { jagged, paintArc, paintSpark } from './Arc.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const ORB = Object.freeze({ radius: 0.017, halo: 3.2, swell: 1.08 });
const JAG = Object.freeze({ depth: 3, share: 0.32 });
const MISS_REACH = [0.3, 0.7];
const MISS_BRIGHTNESS = 0.45;
const FLICKER = [0.6, 1];
const SPARK_REACH = 0.02;
const ARC_WIDTH = 0.6;
const HALO = '150,190,255';

export class Tesla extends Tool {
  constructor(room, surface, { onZap, onBuzz }) {
    super(room);
    this.surface = surface;
    this.onZap = onZap;
    this.onBuzz = onBuzz;
    this.holding = false;
    this.zapping = false;
    this.arcs = [];
    this.zaps = new Pulse(TESLA.zapSeconds);
    this.buzzes = new Pulse(TESLA.buzzSeconds);
  }

  get busy() {
    return this.holding;
  }

  get focus() {
    return this.zapping ? { x: this.aimX, y: this.aimY, radius: ORB.radius, charge: TESLA.tension } : null;
  }

  windUp() {
    this.holding = true;
    this.zaps.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  update(dt) {
    if (!this.holding || !this.present) {
      this.arcs = [];
      this.zapping = false;
      return;
    }
    if (this.buzzes.tick(dt)) this.onBuzz(TESLA.buzzSeconds);
    if (!this.zaps.tick(dt)) return;
    this.arcs = Array.from({ length: TESLA.arcs }, () => this.discharge());
    this.zapping = this.arcs.some((arc) => arc.hit);
  }

  discharge() {
    const { aimX: x, aimY: y } = this;
    const [dx, dy] = polar(randomBetween(0, TAU), 1);
    const hit = this.surface.raycast(x, y, x + dx * TESLA.reach, y + dy * TESLA.reach);
    if (hit) this.onZap({ x: hit.x, y: hit.y, normalX: dx, normalY: dy, first: !this.zapping });
    const miss = TESLA.reach * randomBetween(...MISS_REACH);
    const end = hit ?? { x: x + dx * miss, y: y + dy * miss };
    return { path: jagged(x, y, end.x, end.y, JAG.depth, JAG.share), end, hit: Boolean(hit) };
  }

  draw(context, pixelsPerMeter) {
    if (!this.present) return;
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    this.arcs.forEach(({ path, end, hit }) => {
      const brightness = randomBetween(...FLICKER) * (hit ? 1 : MISS_BRIGHTNESS);
      paintArc(context, pixel, path, brightness, ARC_WIDTH);
      if (hit) paintSpark(context, end.x, end.y, SPARK_REACH, brightness);
    });
    context.restore();
    this.drawOrb(context, pixel);
  }

  drawOrb(context, pixel) {
    const { aimX: x, aimY: y } = this;
    if (this.holding) radiate(context, x, y, ORB.radius * ORB.halo, [[0, `rgba(${HALO},0.6)`], [1, `rgba(${HALO},0)`]]);
    context.save();
    context.fillStyle = steel(context, x - ORB.radius, y - ORB.radius, x + ORB.radius, y + ORB.radius);
    inkOutline(context, pixel);
    context.beginPath();
    context.arc(x, y, ORB.radius * (this.holding ? ORB.swell : 1), 0, TAU);
    context.fill();
    context.stroke();
    context.restore();
  }
}
