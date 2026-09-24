import { GRAVITY, PENDULUM } from '../config.js';
import { inkOutline, steel } from '../core/canvas.js';
import { TAU, clamp, lerp } from '../core/math.js';
import { Layer } from '../physics/PhysicsWorld.js';
import { paintChain } from './Chain.js';
import { Tool } from './Tool.js';

const RADIUS = PENDULUM.radius;
const TROLLEY = Object.freeze({ width: 0.06, height: 0.022 });
const GUIDE = Object.freeze({ width: 1.2, dash: 5, alpha: 0.35 });
const SHINE = Object.freeze({ x: -0.35, y: -0.35, core: 0.1 });
const IRON = ['#7a7f86', '#16181b'];
const CHAIN_OUTLINE = 'rgba(0,0,0,0.5)';
const BODY_SURFACE = Object.freeze({ ...PENDULUM.surface, groups: Layer.tool });

function paintBall(context, pixel, x, y) {
  const shade = context.createRadialGradient(x + SHINE.x * RADIUS, y + SHINE.y * RADIUS, SHINE.core * RADIUS, x, y, RADIUS);
  shade.addColorStop(0, IRON[0]);
  shade.addColorStop(1, IRON[1]);
  context.fillStyle = shade;
  inkOutline(context, pixel);
  context.beginPath();
  context.arc(x, y, RADIUS, 0, TAU);
  context.fill();
  context.stroke();
}

export class Pendulum extends Tool {
  constructor(room, physics, surface, { onHit, onGrab }) {
    super(room);
    this.physics = physics;
    this.surface = surface;
    this.onHit = onHit;
    this.onGrab = onGrab;
    this.pivotX = 0;
    this.angle = 0;
    this.spin = 0;
    this.holding = false;
    this.body = null;
    this.clock = 0;
    this.lastHit = -Infinity;
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
    return -this.room.ceiling;
  }

  get length() {
    return this.room.ceiling - RADIUS - PENDULUM.clearance;
  }

  get ball() {
    return [this.pivotX + Math.sin(this.angle) * this.length, this.pivotY + Math.cos(this.angle) * this.length];
  }

  get speed() {
    return Math.abs(this.spin) * this.length;
  }

  get focus() {
    if (!this.holding) return null;
    const [x, y] = this.ball;
    return { x, y, radius: RADIUS, charge: PENDULUM.tension * Math.min(1, Math.abs(this.angle) / PENDULUM.reach) };
  }

  windUp() {
    this.holding = true;
    if (!this.body) this.hang();
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
  }

  update(dt) {
    this.clock += dt;
    if (this.holding) this.pull(dt);
    else if (this.swinging) this.swing(dt);
    else this.pivotX = clamp(this.aimX, -this.room.halfWidth, this.room.halfWidth);
    if (!this.swinging) return;
    const [x, y] = this.ball;
    this.body.setNextKinematicTranslation({ x, y });
    this.strike(x, y);
  }

  pull(dt) {
    const target = clamp(Math.atan2(this.aimX - this.pivotX, this.aimY - this.pivotY), -PENDULUM.reach, PENDULUM.reach);
    const next = lerp(this.angle, target, Math.min(1, PENDULUM.follow * dt * TAU));
    this.spin = dt ? (next - this.angle) / dt : 0;
    this.angle = next;
  }

  swing(dt) {
    this.spin += (-(GRAVITY / this.length) * Math.sin(this.angle) - PENDULUM.damping * this.spin) * dt;
    this.angle += this.spin * dt;
    if (Math.abs(this.angle) < PENDULUM.settle && Math.abs(this.spin) < PENDULUM.settle) this.settle();
  }

  strike(x, y) {
    const { impactSpeed, strength, blow, cooldown, contact } = PENDULUM;
    if (this.speed < impactSpeed[0] || this.clock - this.lastHit < cooldown) return;
    const hit = this.surface.contactAt(x, y, RADIUS * contact);
    if (!hit) return;
    this.lastHit = this.clock;
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
    });
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    this.drawTrolley(context, pixel);
    if (this.swinging) this.drawRig(context, pixel);
    else this.drawGuide(context, pixel);
  }

  drawTrolley(context, pixel) {
    const { pivotX, pivotY } = this;
    const left = pivotX - TROLLEY.width / 2;
    inkOutline(context, pixel);
    context.fillStyle = steel(context, left, 0, left + TROLLEY.width, 0);
    context.fillRect(left, pivotY, TROLLEY.width, TROLLEY.height);
    context.strokeRect(left, pivotY, TROLLEY.width, TROLLEY.height);
  }

  drawGuide(context, pixel) {
    context.save();
    context.strokeStyle = `rgba(255,255,255,${GUIDE.alpha})`;
    context.lineWidth = GUIDE.width * pixel;
    context.setLineDash([GUIDE.dash * pixel, GUIDE.dash * pixel]);
    context.beginPath();
    context.arc(this.pivotX, this.pivotY, this.length, Math.PI / 2 - PENDULUM.reach, Math.PI / 2 + PENDULUM.reach);
    context.stroke();
    context.restore();
  }

  drawRig(context, pixel) {
    context.save();
    context.translate(this.pivotX, this.pivotY);
    context.rotate(-this.angle);
    paintChain(context, pixel, 0, this.length - RADIUS, 0, CHAIN_OUTLINE);
    context.restore();
    paintBall(context, pixel, ...this.ball);
  }
}
