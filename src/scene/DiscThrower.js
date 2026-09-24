import { DISC, GRAVITY, SAW } from '../config.js';
import { paintReticle } from '../core/canvas.js';
import { normalize } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { paintBlade } from './Saw.js';
import { Tool } from './Tool.js';

const SCALE = DISC.radius / SAW.radius;

class Disc {
  constructor(x, y, vx, vy) {
    Object.assign(this, { x, y, vx, vy, age: 0, angle: 0, bounces: 0, biting: false, falling: false });
    this.bites = new Pulse(SAW.biteSeconds);
  }

  get gone() {
    return this.falling && this.y >= -DISC.radius;
  }

  advance(dt, room) {
    this.age += dt;
    this.angle += DISC.spin * dt;
    if (this.falling) this.vy += GRAVITY * DISC.fall * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.falling) return;
    this.rebound(room);
    if (this.bounces > DISC.bounces || this.age >= DISC.lifeSeconds) this.falling = true;
  }

  rebound({ halfWidth, ceiling }) {
    const reach = halfWidth - DISC.radius;
    if (Math.abs(this.x) > reach && this.x * this.vx > 0) this.bounce('vx');
    if ((this.y > -DISC.radius && this.vy > 0) || (this.y < -ceiling + DISC.radius && this.vy < 0)) this.bounce('vy');
  }

  bounce(axis) {
    this[axis] = -this[axis];
    this.bounces++;
  }
}

export class DiscThrower extends Tool {
  constructor(room, { onGrind, onThrow }) {
    super(room);
    this.onGrind = onGrind;
    this.onThrow = onThrow;
    this.discs = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.discs.length > 0;
  }

  get pending() {
    return this.busy;
  }

  windUp() {
    if (this.discs.length >= DISC.capacity) return;
    const side = this.aimX >= 0 ? -1 : 1;
    const x = side * (this.room.halfWidth - DISC.inset);
    const y = -DISC.height;
    const [dx, dy] = normalize(this.aimX - x, this.aimY - y);
    this.discs.push(new Disc(x, y, dx * DISC.speed, dy * DISC.speed));
    this.onThrow();
  }

  stow() {
    super.stow();
    this.discs = [];
  }

  update(dt) {
    this.discs.forEach((disc) => {
      disc.advance(dt, this.room);
      if (disc.bites.tick(dt)) disc.biting = this.onGrind({ x: disc.x, y: disc.y, radius: DISC.radius, first: !disc.biting });
    });
    this.discs = this.discs.filter((disc) => !disc.gone);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.discs.forEach((disc) => {
      context.save();
      context.translate(disc.x, disc.y);
      context.scale(SCALE, SCALE);
      paintBlade(context, pixel / SCALE, disc.angle, DISC.spin);
      context.restore();
    });
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
