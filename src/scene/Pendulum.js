import { GRAVITY, PENDULUM } from '../config.js';
import { inkOutline, radiate, steel } from '../core/canvas.js';
import { TAU, clamp, lerp, polar } from '../core/math.js';
import { Layer } from '../physics/PhysicsWorld.js';
import { Cooldown } from './Cooldown.js';
import { Tool } from './Tool.js';

const RADIUS = PENDULUM.radius;
const MOUNT = Object.freeze({ width: 0.12, height: 0.022, drop: 0.062, strap: 0.014, gap: 0.03 });
const GEAR = Object.freeze({ radius: 0.034, teeth: 14, depth: 0.007, hub: 0.011, ratio: 3, spokes: 5 });
const ROD = Object.freeze({ width: 0.011, nut: 0.02, nutHeight: 0.016 });
const BOB = Object.freeze({ face: 0.8, rings: [0.58, 0.36], boss: 0.15, shine: Object.freeze({ x: -0.36, y: -0.4, width: 0.42, height: 0.2, tilt: -0.6 }) });
const GUIDE = Object.freeze({ width: 1.2, dash: 5, alpha: 0.35 });
const TRAIL = Object.freeze({ frames: 7, ghosts: [3, 5], alpha: 0.18, swoosh: 0.3, from: 1.2, full: 4 });
const BRASS = ['#fff1b8', '#e3b24c', '#9a6a1c', '#5c3a0c'];
const ENGRAVE = 'rgba(70,42,8,0.45)';
const SHINE = 'rgba(255,255,255,0.55)';
const SWOOSH = '255,236,190';
const BODY_SURFACE = Object.freeze({ ...PENDULUM.surface, groups: Layer.tool });

function brass(context, x, y, radius, reverse = false) {
  const [light, middle, dark] = reverse ? [BRASS[2], BRASS[1], BRASS[0]] : BRASS;
  const gradient = context.createRadialGradient(x - radius * 0.4, y - radius * 0.45, radius * 0.05, x, y, radius);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.5, middle);
  gradient.addColorStop(1, dark);
  return gradient;
}

function disc(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
}

function paintBob(context, pixel, x, y) {
  inkOutline(context, pixel);
  context.fillStyle = brass(context, x, y, RADIUS);
  disc(context, x, y, RADIUS);
  context.fill();
  context.stroke();
  context.fillStyle = brass(context, x, y, RADIUS * BOB.face, true);
  disc(context, x, y, RADIUS * BOB.face);
  context.fill();
  context.strokeStyle = ENGRAVE;
  context.lineWidth = pixel;
  BOB.rings.forEach((share) => {
    disc(context, x, y, RADIUS * share);
    context.stroke();
  });
  inkOutline(context, pixel);
  context.fillStyle = brass(context, x, y, RADIUS * BOB.boss);
  disc(context, x, y, RADIUS * BOB.boss);
  context.fill();
  context.stroke();
  const { shine } = BOB;
  context.fillStyle = SHINE;
  context.beginPath();
  context.ellipse(x + shine.x * RADIUS, y + shine.y * RADIUS, shine.width * RADIUS, shine.height * RADIUS, shine.tilt, 0, TAU);
  context.fill();
}

function paintRod(context, pixel, length) {
  const bottom = length - RADIUS;
  inkOutline(context, pixel);
  context.fillStyle = steel(context, -ROD.width / 2, 0, ROD.width / 2, 0);
  context.fillRect(-ROD.width / 2, 0, ROD.width, bottom);
  context.strokeRect(-ROD.width / 2, 0, ROD.width, bottom);
  context.fillStyle = brass(context, 0, bottom - ROD.nutHeight, ROD.nut);
  context.fillRect(-ROD.nut / 2, bottom - ROD.nutHeight * 1.2, ROD.nut, ROD.nutHeight);
  context.strokeRect(-ROD.nut / 2, bottom - ROD.nutHeight * 1.2, ROD.nut, ROD.nutHeight);
}

function paintGear(context, pixel, turn) {
  const { radius, teeth, depth, hub, spokes } = GEAR;
  context.save();
  context.rotate(turn);
  inkOutline(context, pixel);
  context.fillStyle = brass(context, 0, 0, radius + depth);
  context.beginPath();
  for (let i = 0; i < teeth * 4; i++) {
    const angle = (i / (teeth * 4)) * TAU;
    context.lineTo(...polar(angle, radius + (i % 4 < 2 ? depth : 0)));
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = 'rgba(40,24,4,0.55)';
  for (let spoke = 0; spoke < spokes; spoke++) {
    const angle = (spoke / spokes) * TAU;
    context.beginPath();
    context.arc(...polar(angle + Math.PI / spokes, radius * 0.58), radius * 0.2, 0, TAU);
    context.fill();
  }
  context.fillStyle = steel(context, -hub, 0, hub, 0);
  disc(context, 0, 0, hub);
  context.fill();
  context.stroke();
  context.restore();
}

export class Pendulum extends Tool {
  constructor(room, physics, surface, { onHit, onGrab, onPass }) {
    super(room);
    this.physics = physics;
    this.surface = surface;
    this.onHit = onHit;
    this.onGrab = onGrab;
    this.onPass = onPass;
    this.angle = 0;
    this.spin = 0;
    this.holding = false;
    this.grab = { angle: 0, x: 0 };
    this.body = null;
    this.gap = new Cooldown(PENDULUM.cooldown);
    this.beat = 0;
    this.trail = [];
  }

  get spills() {
    return false;
  }

  get swinging() {
    return this.body !== null;
  }

  get busy() {
    return this.swinging;
  }

  get shown() {
    return this.active || this.swinging;
  }

  get pivotY() {
    return -this.room.ceiling + MOUNT.drop;
  }

  get length() {
    return this.room.ceiling - MOUNT.drop - RADIUS - PENDULUM.clearance;
  }

  get ball() {
    return this.bobAt(this.angle);
  }

  get speed() {
    return Math.abs(this.spin) * this.length;
  }

  get focus() {
    if (!this.holding) return null;
    const [x, y] = this.ball;
    return { x, y, radius: RADIUS, charge: PENDULUM.tension * Math.min(1, Math.abs(this.angle) / PENDULUM.reach) };
  }

  get limit() {
    return Math.min(PENDULUM.reach, Math.asin(Math.min(1, (this.room.halfWidth - RADIUS) / this.length)));
  }

  bobAt(angle) {
    return [Math.sin(angle) * this.length, this.pivotY + Math.cos(angle) * this.length];
  }

  windUp() {
    this.holding = true;
    if (!this.body) this.hang();
    this.grab = { angle: this.angle, x: this.aimX };
    this.onGrab();
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
    this.settle();
  }

  hang() {
    const [x, y] = this.ball;
    this.body = this.physics.createKinematicBody({ x, y });
    this.physics.attachBall(this.body, RADIUS, BODY_SURFACE);
  }

  settle() {
    if (this.body) this.physics.removeBody(this.body);
    this.body = null;
    this.angle = 0;
    this.spin = 0;
    this.trail = [];
  }

  update(dt) {
    this.gap.tick(dt);
    const previous = this.angle;
    if (this.holding) this.pull(dt);
    else if (this.swinging) this.sway(dt);
    if (!this.swinging) return;
    this.trail.unshift(this.angle);
    if (this.trail.length > TRAIL.frames) this.trail.pop();
    if (!this.holding && Math.sign(previous) !== Math.sign(this.angle)) this.pass();
    const [x, y] = this.ball;
    this.body.setNextKinematicTranslation({ x, y });
    this.strike(x, y);
  }

  pull(dt) {
    const { grab, limit } = this;
    const target = clamp(grab.angle + (this.aimX - grab.x) / this.length, -limit, limit);
    const next = lerp(this.angle, target, Math.min(1, PENDULUM.follow * dt * TAU));
    this.spin = dt ? (next - this.angle) / dt : 0;
    this.angle = next;
  }

  sway(dt) {
    this.spin += (-(GRAVITY / this.length) * Math.sin(this.angle) - PENDULUM.damping * this.spin) * dt;
    this.angle += this.spin * dt;
    if (Math.abs(this.angle) < PENDULUM.settle && Math.abs(this.spin) < PENDULUM.settle) this.settle();
  }

  pass() {
    this.beat = 1 - this.beat;
    this.onPass(clamp(this.speed / PENDULUM.impactSpeed[1], 0, 1), this.beat);
  }

  strike(x, y) {
    const { impactSpeed, strength, blow, contact } = PENDULUM;
    if (this.speed < impactSpeed[0] || !this.gap.ready) return;
    const hit = this.surface.contactAt(x, y, RADIUS * contact);
    if (!hit) return;
    this.gap.trigger();
    const force = clamp((this.speed - impactSpeed[0]) / (impactSpeed[1] - impactSpeed[0]), 0, 1);
    const direction = Math.sign(this.spin);
    this.onHit({
      ...blow,
      x: hit.point.x,
      y: hit.point.y,
      normalX: Math.cos(this.angle) * direction,
      normalY: -Math.sin(this.angle) * direction,
      radius: RADIUS,
      contact: RADIUS,
      strength: lerp(...strength, force),
      force,
      newtons: lerp(...PENDULUM.newtons, force),
    });
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    if (this.swinging) this.drawSwing(context, pixel);
    else this.drawGuide(context, pixel);
    this.drawMount(context, pixel);
  }

  drawMount(context, pixel) {
    const { pivotY } = this;
    const top = -this.room.ceiling;
    inkOutline(context, pixel);
    context.fillStyle = steel(context, -MOUNT.gap, 0, MOUNT.gap, 0);
    [-1, 1].forEach((side) => {
      const x = side * MOUNT.gap - MOUNT.strap / 2;
      context.fillRect(x, top, MOUNT.strap, pivotY - top);
      context.strokeRect(x, top, MOUNT.strap, pivotY - top);
    });
    context.fillStyle = steel(context, 0, top, 0, top + MOUNT.height);
    context.fillRect(-MOUNT.width / 2, top - MOUNT.height, MOUNT.width, MOUNT.height * 2);
    context.strokeRect(-MOUNT.width / 2, top - MOUNT.height, MOUNT.width, MOUNT.height * 2);
    context.save();
    context.translate(0, pivotY);
    paintGear(context, pixel, -this.angle * GEAR.ratio);
    context.restore();
  }

  drawGuide(context, pixel) {
    const { limit } = this;
    context.save();
    context.strokeStyle = `rgba(255,255,255,${GUIDE.alpha})`;
    context.lineWidth = GUIDE.width * pixel;
    context.setLineDash([GUIDE.dash * pixel, GUIDE.dash * pixel]);
    context.beginPath();
    context.arc(0, this.pivotY, this.length, Math.PI / 2 - limit, Math.PI / 2 + limit);
    context.stroke();
    context.restore();
  }

  drawSwing(context, pixel) {
    const rush = clamp((this.speed - TRAIL.from) / (TRAIL.full - TRAIL.from), 0, 1);
    if (rush > 0) this.drawBlur(context, pixel, rush);
    context.save();
    context.translate(0, this.pivotY);
    context.rotate(-this.angle);
    paintRod(context, pixel, this.length);
    context.restore();
    const [x, y] = this.ball;
    paintBob(context, pixel, x, y);
    if (this.holding) radiate(context, x, y, RADIUS * 1.6, [[0.6, 'rgba(255,220,140,0)'], [0.75, `rgba(255,220,140,${0.4 * this.focus.charge})`], [1, 'rgba(255,220,140,0)']]);
  }

  drawBlur(context, pixel, rush) {
    const oldest = this.trail.at(-1);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${SWOOSH},${TRAIL.swoosh * rush})`;
    context.lineWidth = RADIUS * 1.4;
    context.lineCap = 'round';
    context.beginPath();
    const [from, to] = [Math.PI / 2 - oldest, Math.PI / 2 - this.angle];
    context.arc(0, this.pivotY, this.length, Math.min(from, to), Math.max(from, to));
    context.stroke();
    context.restore();
    context.save();
    TRAIL.ghosts.forEach((index, i) => {
      const angle = this.trail[index];
      if (angle === undefined) return;
      context.globalAlpha = TRAIL.alpha * rush * (TRAIL.ghosts.length - i);
      paintBob(context, pixel, ...this.bobAt(angle));
    });
    context.restore();
  }
}
