import { BALL } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, easeIn, easeOut, randomBetween } from '../core/math.js';
import { Layer } from '../physics/PhysicsWorld.js';
import { paintChain, strokeOutlined } from './Chain.js';
import { Gantry } from './Gantry.js';
import { Projectile, retire } from './Projectile.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const LUG = Object.freeze({ radius: BALL.radius * 0.24, width: BALL.radius * 0.1, center: -BALL.radius * 1.14 });
const HANG = LUG.radius - LUG.center;
const SHELL = [[0, '#fff3c4'], [0.22, '#ffb347'], [0.58, '#e8430e'], [1, '#6b1005']];
const SHINE = Object.freeze({ x: -0.3, y: -0.35, core: 0.08 });
const HALO = Object.freeze({ reach: 1.9, flicker: [0.94, 1.06], inner: '255,150,60', outer: '255,70,20', alpha: 0.5 });
const LUG_GLOW = '#e0561c';
const OUTLINE = 'rgba(40,6,2,0.6)';
const OUTLINE_WIDTH = 1.2;
const BODY_SURFACE = Object.freeze({ ...BALL.surface, groups: Layer.tool });

function drawHalo(context) {
  radiate(context, 0, 0, BALL.radius * HALO.reach * randomBetween(...HALO.flicker), [
    [0.45, `rgba(${HALO.inner},${HALO.alpha})`],
    [1, `rgba(${HALO.outer},0)`],
  ]);
}

function drawShell(context, pixel) {
  const { radius } = BALL;
  const shade = context.createRadialGradient(SHINE.x * radius, SHINE.y * radius, SHINE.core * radius, 0, 0, radius);
  SHELL.forEach(([offset, color]) => shade.addColorStop(offset, color));
  context.fillStyle = shade;
  context.strokeStyle = OUTLINE;
  context.lineWidth = OUTLINE_WIDTH * pixel;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.stroke();
}

function drawBall(context, pixel, { x, y, angle, alpha }) {
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  drawHalo(context);
  context.rotate(angle);
  context.beginPath();
  context.arc(0, LUG.center, LUG.radius, 0, TAU);
  strokeOutlined(context, pixel, LUG.width, LUG_GLOW, OUTLINE);
  context.rotate(-angle);
  drawShell(context, pixel);
  context.restore();
}

class Ball extends Projectile {
  constructor(body) {
    super(body, BALL);
    this.sears = new Pulse(BALL.searSeconds);
    this.touched = false;
    this.searing = false;
  }
}

export class WreckingBall extends Tool {
  constructor(room, physics, { onSear, onContact, onSizzle, onLand }) {
    super(room);
    this.physics = physics;
    this.onSear = onSear;
    this.onContact = onContact;
    this.onSizzle = onSizzle;
    this.onLand = onLand;
    this.gantry = new Gantry(room, BALL.radius);
    this.sizzles = new Pulse(BALL.sizzleSeconds);
    this.holding = false;
    this.armed = false;
    this.reload = BALL.reloadSeconds;
    this.balls = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.armed || this.balls.length > 0;
  }

  get pending() {
    return this.armed || this.balls.some((ball) => !ball.grounded);
  }

  get shown() {
    return this.active || this.balls.length > 0;
  }

  get focus() {
    const ball = this.balls.find((candidate) => candidate.searing && !candidate.grounded);
    return ball ? { x: ball.x, y: ball.y, radius: BALL.radius, charge: BALL.tension } : null;
  }

  get loaded() {
    return this.reload >= BALL.reloadSeconds;
  }

  get hooked() {
    return this.reload >= BALL.reloadSeconds / 2;
  }

  get hold() {
    return this.gantry.top + BALL.radius;
  }

  get hoist() {
    const phase = Math.min(1, this.reload / BALL.reloadSeconds) * 2;
    const lift = phase < 1 ? easeIn(phase) : 1 - easeOut(phase - 1);
    return (this.hold + BALL.radius - this.gantry.sky) * lift;
  }

  windUp() {
    this.holding = true;
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    this.armed = true;
    this.gantry.send(this.aimX);
  }

  cancel() {
    this.holding = false;
    this.armed = false;
  }

  update(dt) {
    this.reload += dt;
    this.steer(dt);
    this.balls.forEach((ball) => this.roll(ball, dt));
    if (this.balls.some((ball) => ball.searing) && this.sizzles.tick(dt)) this.onSizzle(BALL.sizzleSeconds);
    this.balls = retire(this.balls, this.physics);
  }

  steer(dt) {
    if (this.holding) this.gantry.send(this.aimX);
    if (!this.holding && !this.armed) this.gantry.follow(this.aimX);
    else if (!this.gantry.arrived) this.gantry.travel(dt);
    else if (this.armed && this.loaded) this.drop();
  }

  drop() {
    const body = this.physics.createBody({ x: this.gantry.x, y: this.hold, angle: 0, vx: 0, vy: 0, spin: 0 }, true);
    this.physics.attachBall(body, BALL.radius, BODY_SURFACE);
    this.balls.push(new Ball(body));
    this.armed = false;
    this.reload = 0;
  }

  roll(ball, dt) {
    ball.update(dt);
    if (ball.touchdown(BALL.landSpeed)) this.onLand(ball.x);
    if (!ball.cooling && ball.sears.tick(dt)) this.sear(ball);
  }

  sear(ball) {
    ball.searing = this.onSear({ x: ball.x, y: ball.y, radius: BALL.radius, first: !ball.touched });
    if (ball.searing && !ball.touched) this.onContact();
    ball.touched = ball.touched || ball.searing;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.balls.forEach((ball) => drawBall(context, pixel, ball));
    if (this.active) this.drawRig(context, pixel);
  }

  drawRig(context, pixel) {
    const { x, sky } = this.gantry;
    const center = this.hold - this.hoist;
    paintChain(context, pixel, x, center - HANG, sky, OUTLINE);
    if (this.hooked) drawBall(context, pixel, { x, y: center, angle: 0, alpha: 1 });
  }
}
