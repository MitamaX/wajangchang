import { BALL } from '../config.js';
import { steel } from '../core/canvas.js';
import { TAU, clamp, easeIn, easeOut, lerp, normalize } from '../core/math.js';
import { Layer } from '../physics/PhysicsWorld.js';
import { Gantry } from './Gantry.js';
import { Tool } from './Tool.js';

const GROUND_TOLERANCE = 0.004;
const LUG = Object.freeze({ radius: BALL.radius * 0.24, width: BALL.radius * 0.1, center: -BALL.radius * 1.14 });
const HANG = LUG.radius - LUG.center;
const LINK = Object.freeze({ pitch: 0.017, length: 0.024, width: 0.013, thickness: 0.0035 });
const SHELL = [[0, '#a7aeb5'], [0.35, '#4d535a'], [1, '#121416']];
const SHINE = Object.freeze({ x: -0.35, y: -0.4, core: 0.05 });
const OUTLINE = 'rgba(0,0,0,0.5)';
const OUTLINE_WIDTH = 1.2;
const BODY_SURFACE = Object.freeze({ ...BALL.surface, groups: Layer.tool });

function strokeMetal(context, pixel, x, span, thickness) {
  context.lineWidth = thickness + OUTLINE_WIDTH * 2 * pixel;
  context.strokeStyle = OUTLINE;
  context.stroke();
  context.lineWidth = thickness;
  context.strokeStyle = steel(context, x - span, 0, x + span, 0);
  context.stroke();
}

function traceChain(context, x, bottom, top) {
  context.beginPath();
  for (let y = bottom, index = 0; y > top; y -= LINK.pitch, index++) {
    if (index % 2) {
      context.moveTo(x, y);
      context.lineTo(x, y - LINK.length);
    } else {
      context.moveTo(x + LINK.width / 2, y - LINK.length / 2);
      context.ellipse(x, y - LINK.length / 2, LINK.width / 2, LINK.length / 2, 0, 0, TAU);
    }
  }
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
  context.rotate(angle);
  context.beginPath();
  context.arc(0, LUG.center, LUG.radius, 0, TAU);
  strokeMetal(context, pixel, 0, LUG.radius, LUG.width);
  context.rotate(-angle);
  drawShell(context, pixel);
  context.restore();
}

class Ball {
  constructor(body) {
    this.body = body;
    this.speed = 0;
    this.age = 0;
    this.still = 0;
    this.fade = 0;
    this.cooldown = 0;
    this.grounded = false;
    this.sync();
  }

  get alpha() {
    return 1 - this.fade / BALL.fadeSeconds;
  }

  get gone() {
    return this.fade >= BALL.fadeSeconds;
  }

  get live() {
    return this.surge >= BALL.smashSpeed;
  }

  get floored() {
    return this.y + BALL.radius >= -GROUND_TOLERANCE;
  }

  sync() {
    const { x, y } = this.body.translation();
    const velocity = this.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.y);
    this.surge = Math.max(this.speed, speed);
    Object.assign(this, { x, y, speed, angle: this.body.rotation() });
  }

  update(dt) {
    this.sync();
    this.age += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.still = this.grounded && this.speed < BALL.restSpeed ? this.still + dt : 0;
    if (this.fade > 0 || this.still >= BALL.restSeconds || this.age >= BALL.lifeSeconds) this.fade += dt;
  }
}

export class WreckingBall extends Tool {
  constructor(room, surface, { onSmash }) {
    super(room);
    this.surface = surface;
    this.onSmash = onSmash;
    this.gantry = new Gantry(room, BALL.radius);
    this.armed = false;
    this.reload = BALL.reloadSeconds;
    this.balls = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.armed || this.balls.length > 0;
  }

  get pending() {
    return this.armed || this.balls.some((ball) => !ball.grounded || ball.live);
  }

  get shown() {
    return this.active || this.balls.length > 0;
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
    this.armed = true;
    this.gantry.send(this.aimX);
  }

  cancel() {
    this.armed = false;
  }

  stow() {
    this.armed = false;
    this.present = false;
  }

  update(dt) {
    this.reload += dt;
    this.steer(dt);
    this.balls.forEach((ball) => this.roll(ball, dt));
    this.balls.filter((ball) => ball.gone).forEach((ball) => this.surface.physics.removeBody(ball.body));
    this.balls = this.balls.filter((ball) => !ball.gone);
  }

  steer(dt) {
    if (!this.armed) this.gantry.follow(this.aimX);
    else if (!this.gantry.arrived) this.gantry.travel(dt);
    else if (this.loaded) this.drop();
  }

  drop() {
    const { physics } = this.surface;
    const body = physics.createBody({ x: this.gantry.x, y: this.hold, angle: 0, vx: 0, vy: 0, spin: 0 }, true);
    physics.attachBall(body, BALL.radius, BODY_SURFACE);
    this.balls.push(new Ball(body));
    this.armed = false;
    this.reload = 0;
  }

  roll(ball, dt) {
    ball.update(dt);
    if (ball.cooldown > 0) return;
    if (!ball.grounded && ball.floored) this.land(ball);
    else if (!ball.grounded || ball.live) this.crush(ball);
  }

  land(ball) {
    ball.grounded = true;
    if (ball.live) this.smash(ball, { x: ball.x, y: 0 }, 0);
  }

  crush(ball) {
    const contact = this.surface.contactAt(ball.x, ball.y, BALL.radius + BALL.contact);
    if (contact) this.smash(ball, contact.point, ball.grounded ? 0 : BALL.weight);
  }

  smash(ball, point, weight) {
    ball.cooldown = BALL.smashCooldown;
    this.onSmash(this.blow(ball, point, Math.max(weight, clamp(ball.surge / BALL.fullSpeed, 0, 1))));
  }

  blow(ball, { x, y }, impact) {
    const [normalX, normalY] = normalize(x - ball.x, y - ball.y);
    return {
      x,
      y,
      normalX,
      normalY,
      radius: BALL.radius * BALL.reach,
      strength: lerp(...BALL.strength, impact),
      hits: BALL.hits,
      falloff: BALL.falloff,
      shatter: true,
      spray: BALL.spray,
      burst: BALL.burst,
      contact: BALL.contact,
      blast: BALL.blast,
      force: impact,
      cue: 'clank',
    };
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.balls.forEach((ball) => drawBall(context, pixel, ball));
    if (this.active) this.drawRig(context, pixel);
  }

  drawRig(context, pixel) {
    const { x, sky } = this.gantry;
    const center = this.hold - this.hoist;
    traceChain(context, x, center - HANG, sky);
    strokeMetal(context, pixel, x, LINK.width / 2, LINK.thickness);
    if (this.hooked) drawBall(context, pixel, { x, y: center, angle: 0, alpha: 1 });
  }
}
