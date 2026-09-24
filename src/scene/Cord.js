import { CORD } from '../config.js';
import { inkOutline, paintReticle, steel, traceRoundRect } from '../core/canvas.js';
import { lerp, normalize } from '../core/math.js';
import { Blasts } from './Blasts.js';
import { paintFuseSpark } from './Bomb.js';
import { strokeOutlined } from './Chain.js';
import { Perch } from './Perch.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const SHEATH = Object.freeze({ thickness: 0.005, stripe: 0.0018, dash: [0.006, 0.01] });
const CAP = Object.freeze({ length: 0.022, width: 0.009 });
const SHEATH_INK = '#f07a1a';
const STRIPE_INK = 'rgba(255,238,180,0.9)';
const OUTLINE = 'rgba(40,16,0,0.7)';

function paintCap(context, pixel, [head, next]) {
  context.save();
  context.translate(head.x, head.y);
  context.rotate(next ? Math.atan2(head.y - next.y, head.x - next.x) : Math.PI);
  inkOutline(context, pixel);
  context.fillStyle = steel(context, 0, -CAP.width / 2, 0, CAP.width / 2);
  traceRoundRect(context, 0, -CAP.width / 2, CAP.length, CAP.width, CAP.width * 0.3);
  context.fill();
  context.stroke();
  context.restore();
}

class Fuse {
  constructor() {
    this.knots = [];
    this.lit = false;
    this.burnt = 0;
    this.severed = 1;
    this.fired = 0;
  }

  get tail() {
    return this.knots.at(-1);
  }

  measure() {
    const marks = [0];
    this.knots.slice(1).forEach((knot, i) => marks.push(marks[i] + Math.hypot(knot.x - this.knots[i].x, knot.y - this.knots[i].y)));
    return marks;
  }

  at(distance, marks) {
    const index = Math.max(1, marks.findIndex((mark) => mark >= distance));
    const from = this.knots[index - 1];
    const to = this.knots[index];
    const share = (distance - marks[index - 1]) / (marks[index] - marks[index - 1] || 1);
    return [lerp(from.x, to.x, share), lerp(from.y, to.y, share)];
  }

  tie(x, y, surface) {
    this.knots.push(new Perch(x, y, surface.grip(x, y, CORD.grip), CORD.grip));
  }
}

export class Cord extends Tool {
  constructor(room, surface, { onIgnite, onPop, onSever, onCharge, onSmoke, onHiss }) {
    super(room);
    this.surface = surface;
    this.onIgnite = onIgnite;
    this.onPop = onPop;
    this.onSever = onSever;
    this.onCharge = onCharge;
    this.onSmoke = onSmoke;
    this.onHiss = onHiss;
    this.fuses = [];
    this.laying = null;
    this.blasts = new Blasts(CORD.blastSeconds);
    this.hisses = new Pulse(CORD.hissSeconds);
  }

  get busy() {
    return this.fuses.length > 0 || this.blasts.busy;
  }

  get pending() {
    return this.fuses.some((fuse) => fuse.lit);
  }

  windUp() {
    if (this.laying || this.fuses.length >= CORD.capacity) return;
    this.laying = new Fuse();
    this.laying.tie(this.aimX, this.aimY, this.surface);
    this.fuses.push(this.laying);
  }

  release() {
    if (!this.laying) return;
    this.laying.lit = true;
    this.laying = null;
    this.onIgnite();
  }

  cancel() {
    this.fuses = this.fuses.filter((fuse) => fuse !== this.laying);
    this.laying = null;
  }

  stow() {
    super.stow();
    this.fuses = [];
    this.laying = null;
  }

  update(dt) {
    this.blasts.update(dt);
    if (this.laying) this.lay(this.laying);
    this.fuses.forEach((fuse) => fuse.knots.forEach((knot) => knot.follow(dt, this.surface)));
    const spent = this.fuses.filter((fuse) => fuse.lit && this.burn(fuse, dt));
    this.fuses = this.fuses.filter((fuse) => !spent.includes(fuse));
    spent.forEach((fuse) => this.detonate(fuse.tail));
    if (this.pending && this.hisses.tick(dt)) this.onHiss(CORD.hissSeconds);
  }

  lay(fuse) {
    const { tail } = fuse;
    const distance = Math.hypot(this.aimX - tail.x, this.aimY - tail.y);
    const steps = Math.floor(Math.min(distance, CORD.length - fuse.measure().at(-1)) / CORD.spacing);
    const [dx, dy] = normalize(this.aimX - tail.x, this.aimY - tail.y);
    for (let step = 1; step <= steps; step++) fuse.tie(tail.x + dx * CORD.spacing * step, tail.y + dy * CORD.spacing * step, this.surface);
  }

  burn(fuse, dt) {
    fuse.burnt += CORD.burn * dt;
    const marks = fuse.measure();
    const total = marks.at(-1);
    while (fuse.severed < marks.length && marks[fuse.severed] <= fuse.burnt) {
      const [from, to] = fuse.knots.slice(fuse.severed - 1, fuse.severed + 1);
      this.onSever({ ax: from.x, ay: from.y, bx: to.x, by: to.y });
      fuse.severed++;
    }
    while ((fuse.fired + 1) * CORD.pitch <= Math.min(fuse.burnt, total)) {
      fuse.fired++;
      this.pop(fuse.at(fuse.fired * CORD.pitch, marks));
    }
    if (fuse.burnt < total) this.onSmoke(...fuse.at(fuse.burnt, marks));
    return fuse.burnt >= total;
  }

  pop([x, y]) {
    const round = { ...CORD.round, x, y };
    this.blasts.add(round);
    this.onPop([round]);
  }

  detonate({ x, y }) {
    const blow = { ...CORD.charge, x, y };
    this.blasts.add(blow);
    this.onCharge(blow);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.draw(context, pixel);
    this.fuses.forEach((fuse) => this.drawFuse(context, pixel, fuse));
    if (this.present && !this.laying) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawFuse(context, pixel, fuse) {
    const { knots, lit } = fuse;
    const marks = fuse.measure();
    const burnt = lit ? Math.min(fuse.burnt, marks.at(-1)) : 0;
    const start = lit && knots.length > 1 ? fuse.at(burnt, marks) : [knots[0].x, knots[0].y];
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(...start);
    knots.filter((_, i) => marks[i] > burnt).forEach(({ x, y }) => context.lineTo(x, y));
    strokeOutlined(context, pixel, SHEATH.thickness, SHEATH_INK, OUTLINE);
    context.setLineDash(SHEATH.dash);
    context.lineWidth = SHEATH.stripe;
    context.strokeStyle = STRIPE_INK;
    context.stroke();
    context.restore();
    if (lit) paintFuseSpark(context, pixel, ...start);
    else paintCap(context, pixel, knots);
  }
}
