import { FREEZE } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, lerp, polar } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const FLAKE = Object.freeze({ arms: 6, reach: [0.35, 0.8], twig: 0.35, twigAt: 0.55, twigTurn: 0.6, spin: 0.8, width: 1.6 });
const RING = Object.freeze({ width: 1.2, dash: 5, spin: 12, alpha: 0.6 });
const HALO_ALPHA = 0.35;
const ICE = '205,236,255';
const ICE_CORE = '245,252,255';

function traceFlake(context, radius) {
  context.beginPath();
  for (let arm = 0; arm < FLAKE.arms; arm++) {
    const angle = (arm / FLAKE.arms) * TAU;
    const [tipX, tipY] = polar(angle, radius);
    const [forkX, forkY] = polar(angle, radius * FLAKE.twigAt);
    context.moveTo(0, 0);
    context.lineTo(tipX, tipY);
    [-1, 1].forEach((side) => {
      const [twigX, twigY] = polar(angle + side * FLAKE.twigTurn, radius * FLAKE.twig);
      context.moveTo(forkX, forkY);
      context.lineTo(forkX + twigX, forkY + twigY);
    });
  }
}

export class Freeze extends Tool {
  constructor(room, { onChill, onBurst, onHiss }) {
    super(room);
    this.onChill = onChill;
    this.onBurst = onBurst;
    this.onHiss = onHiss;
    this.holding = false;
    this.chilling = false;
    this.cold = 0;
    this.time = 0;
    this.chills = new Pulse(FREEZE.chillSeconds);
    this.hisses = new Pulse(FREEZE.hissSeconds);
  }

  get busy() {
    return this.holding;
  }

  get focus() {
    return this.holding ? { x: this.aimX, y: this.aimY, radius: FREEZE.radius, charge: lerp(...FREEZE.tension, this.cold) } : null;
  }

  windUp() {
    this.holding = true;
    this.cold = 0;
    this.chills.reset();
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    this.onBurst(this.burst());
  }

  cancel() {
    this.holding = false;
  }

  burst() {
    const { cold } = this;
    return {
      ...FREEZE.burst,
      x: this.aimX,
      y: this.aimY,
      radius: FREEZE.radius,
      strength: lerp(...FREEZE.strength, cold),
      hits: Math.round(lerp(...FREEZE.hits, cold)),
      shatter: cold >= FREEZE.shatterAt,
      burst: lerp(...FREEZE.spread, cold),
      blast: { reach: FREEZE.radius * 2.5, speed: lerp(...FREEZE.speed, cold), heft: 0.3 },
      force: cold * 0.8,
    };
  }

  update(dt) {
    this.time += dt;
    if (!this.holding || !this.present) return;
    this.cold = Math.min(1, this.cold + dt / FREEZE.coldSeconds);
    if (this.hisses.tick(dt)) this.onHiss(FREEZE.hissSeconds);
    if (this.chills.tick(dt)) this.chilling = this.onChill({ x: this.aimX, y: this.aimY, radius: FREEZE.radius, first: !this.chilling, cold: this.cold });
  }

  draw(context, pixelsPerMeter) {
    if (!this.present) return;
    const pixel = 1 / pixelsPerMeter;
    const { aimX: x, aimY: y, cold } = this;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    if (this.holding) radiate(context, x, y, FREEZE.radius, [[0, `rgba(${ICE_CORE},${HALO_ALPHA * cold})`], [1, `rgba(${ICE},0)`]]);
    context.strokeStyle = `rgba(${ICE},${RING.alpha})`;
    context.lineWidth = RING.width * pixel;
    context.setLineDash([RING.dash * pixel, RING.dash * pixel]);
    context.lineDashOffset = this.time * RING.spin * pixel;
    context.beginPath();
    context.arc(x, y, FREEZE.radius, 0, TAU);
    context.stroke();
    context.setLineDash([]);
    context.translate(x, y);
    context.rotate(this.time * FLAKE.spin);
    context.strokeStyle = `rgba(${ICE_CORE},${0.5 + 0.5 * cold})`;
    context.lineWidth = FLAKE.width * pixel;
    traceFlake(context, FREEZE.radius * lerp(...FLAKE.reach, cold));
    context.stroke();
    context.restore();
  }
}
