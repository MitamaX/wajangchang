import { GRAVITY, WHIP } from '../config.js';
import { TAU, clamp, easeOut, lerp, normalize, polar } from '../core/math.js';
import { strokeOutlined } from './Chain.js';
import { Tool } from './Tool.js';

const THONG = Object.freeze({ thickness: [0.0055, 0.0014] });
const HANDLE = Object.freeze({ thickness: 0.009, pommel: 0.0075 });
const CRACKER = Object.freeze({ strands: 3, length: 0.018, spread: 0.35, width: 1.1 });
const CRACK = Object.freeze({ seconds: 0.18, reach: 0.05, rays: 8, width: 2.2 });
const OUTLINE_WIDTH = 1.2;
const LEATHER = '#7a4524';
const GRIP = '#2c1d14';
const OUTLINE = 'rgba(0,0,0,0.5)';
const CRACKER_INK = 'rgba(236,220,190,0.9)';
const CRACK_INK = '255,255,255';

class Knot {
  constructor(x, y, give) {
    Object.assign(this, { x, y, lastX: x, lastY: y, give });
  }

  speed(step) {
    return Math.hypot(this.x - this.lastX, this.y - this.lastY) / step;
  }
}

function bind(a, b, rest) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1e-9;
  const shift = (distance - rest) / distance / (a.give + b.give);
  a.x += dx * shift * a.give;
  a.y += dy * shift * a.give;
  b.x -= dx * shift * b.give;
  b.y -= dy * shift * b.give;
}

class Lash {
  constructor(x, y) {
    this.link = WHIP.length / WHIP.links;
    this.knots = Array.from({ length: WHIP.links + 1 }, (_, i) => new Knot(x, Math.min(0, y + i * this.link), i ? 1 / lerp(1, WHIP.taper, i / WHIP.links) : 0));
  }

  get tip() {
    return this.knots.slice(-WHIP.tip);
  }

  step(step, handX, handY, halfWidth) {
    const [hand, ...rest] = this.knots;
    Object.assign(hand, { lastX: hand.x, lastY: hand.y, x: handX, y: handY });
    const keep = Math.max(0, 1 - WHIP.drag * step);
    const fall = GRAVITY * WHIP.gravity * step * step;
    rest.forEach((knot) => {
      const driftX = (knot.x - knot.lastX) * keep;
      const driftY = (knot.y - knot.lastY) * keep + fall;
      Object.assign(knot, { lastX: knot.x, lastY: knot.y, x: knot.x + driftX, y: knot.y + driftY });
    });
    for (let pass = 0; pass < WHIP.iterations; pass++) {
      for (let i = 1; i < this.knots.length; i++) bind(this.knots[i - 1], this.knots[i], this.link);
      for (let i = 2; i <= WHIP.grip; i++) bind(this.knots[i - 2], this.knots[i], this.link * 2);
    }
    rest.forEach((knot) => {
      knot.x = clamp(knot.x, -halfWidth, halfWidth);
      knot.y = Math.min(knot.y, 0);
    });
  }
}

function paintCrack(context, pixel, { x, y, age }) {
  const t = age / CRACK.seconds;
  const spread = easeOut(t);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = `rgba(${CRACK_INK},${1 - t})`;
  context.lineWidth = CRACK.width * pixel * (1 - t);
  context.lineCap = 'round';
  context.beginPath();
  context.arc(x, y, CRACK.reach * spread, 0, TAU);
  for (let ray = 0; ray < CRACK.rays; ray++) {
    const [dx, dy] = polar((ray / CRACK.rays) * TAU, CRACK.reach);
    context.moveTo(x + dx * spread * 0.5, y + dy * spread * 0.5);
    context.lineTo(x + dx * spread * 1.3, y + dy * spread * 1.3);
  }
  context.stroke();
  context.restore();
}

export class Whip extends Tool {
  constructor(room, surface, { onLash, onCrack }) {
    super(room);
    this.surface = surface;
    this.onLash = onLash;
    this.onCrack = onCrack;
    this.lash = null;
    this.hand = null;
    this.holding = false;
    this.step = WHIP.substep;
    this.cooldown = 0;
    this.crackWait = 0;
    this.cracks = [];
  }

  get busy() {
    return this.holding || this.cracks.length > 0;
  }

  windUp() {
    this.holding = true;
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.holding = false;
    this.lash = null;
    this.cracks = [];
  }

  update(dt) {
    this.cooldown -= dt;
    this.crackWait -= dt;
    this.cracks = this.cracks.filter((crack) => (crack.age += dt) < CRACK.seconds);
    if (!this.present) {
      this.lash = null;
      return;
    }
    if (!this.lash) {
      this.lash = new Lash(this.aimX, this.aimY);
      this.hand = [this.aimX, this.aimY];
    }
    if (!dt) return;
    this.swing(dt);
    if (this.holding) this.strike();
  }

  swing(dt) {
    const steps = Math.ceil(dt / WHIP.substep);
    const [fromX, fromY] = this.hand;
    this.step = dt / steps;
    for (let step = 1; step <= steps; step++) this.lash.step(this.step, lerp(fromX, this.aimX, step / steps), lerp(fromY, this.aimY, step / steps), this.room.halfWidth);
    this.hand = [this.aimX, this.aimY];
  }

  strike() {
    const { tip } = this.lash;
    const [end] = tip.slice(-1);
    if (end.speed(this.step) >= WHIP.crack && this.crackWait <= 0) {
      this.crackWait = WHIP.crackCooldown;
      this.cracks.push({ x: end.x, y: end.y, age: 0 });
      this.onCrack();
    }
    if (this.cooldown > 0) return;
    const hit = tip
      .filter((knot) => knot.speed(this.step) >= WHIP.speed[0] && this.surface.contactAt(knot.x, knot.y, WHIP.reach))
      .reduce((fastest, knot) => (!fastest || knot.speed(this.step) > fastest.speed(this.step) ? knot : fastest), null);
    if (!hit) return;
    this.cooldown = WHIP.cooldown;
    const [dirX, dirY] = normalize(hit.x - hit.lastX, hit.y - hit.lastY);
    const power = clamp((hit.speed(this.step) - WHIP.speed[0]) / (WHIP.speed[1] - WHIP.speed[0]), 0, 1);
    this.onLash({ x: hit.x, y: hit.y, dirX, dirY }, { reach: WHIP.reach, strength: lerp(...WHIP.strength, power), size: WHIP.size, depth: WHIP.depth, shock: WHIP.shock, cue: 'lash' });
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.cracks.forEach((crack) => paintCrack(context, pixel, crack));
    if (!this.lash) return;
    const { knots } = this.lash;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    [[OUTLINE, OUTLINE_WIDTH * 2 * pixel], [LEATHER, 0]].forEach(([ink, rim]) => {
      context.strokeStyle = ink;
      for (let i = WHIP.grip + 1; i < knots.length; i++) {
        context.lineWidth = lerp(...THONG.thickness, (i - WHIP.grip) / (knots.length - WHIP.grip)) + rim;
        context.beginPath();
        context.moveTo(knots[i - 1].x, knots[i - 1].y);
        context.lineTo(knots[i].x, knots[i].y);
        context.stroke();
      }
    });
    this.drawCracker(context, pixel, knots);
    context.beginPath();
    knots.slice(0, WHIP.grip + 1).forEach(({ x, y }) => context.lineTo(x, y));
    strokeOutlined(context, pixel, HANDLE.thickness, GRIP, OUTLINE);
    context.fillStyle = GRIP;
    context.beginPath();
    context.arc(knots[0].x, knots[0].y, HANDLE.pommel, 0, TAU);
    context.fill();
    context.restore();
  }

  drawCracker(context, pixel, knots) {
    const [before, end] = knots.slice(-2);
    const heading = Math.atan2(end.y - before.y, end.x - before.x);
    context.strokeStyle = CRACKER_INK;
    context.lineWidth = CRACKER.width * pixel;
    context.beginPath();
    for (let strand = 0; strand < CRACKER.strands; strand++) {
      const [dx, dy] = polar(heading + (strand / (CRACKER.strands - 1) - 0.5) * CRACKER.spread, CRACKER.length);
      context.moveTo(end.x, end.y);
      context.lineTo(end.x + dx, end.y + dy);
    }
    context.stroke();
  }
}
