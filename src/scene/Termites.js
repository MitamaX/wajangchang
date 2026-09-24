import { GRAVITY, TERMITE } from '../config.js';
import { paintReticle } from '../core/canvas.js';
import { TAU, clamp, polar, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const SIZE = TERMITE.size;
const SEGMENTS = Object.freeze([
  { offset: 0.42, radius: 0.2 },
  { offset: 0.12, radius: 0.17 },
  { offset: -0.28, radius: 0.28 },
]);
const LEGS = Object.freeze({ pairs: 3, reach: 0.38, spread: 0.18, swing: 0.6, stride: 28, width: 1 });
const BITE_REACH = 1.6;
const WANDER = 2.5;
const FLOOR_TURN_CHANCE = 0.02;
const HEAD = '#6b3a1c';
const BODY = '#a86a3c';
const LEG = 'rgba(60,32,14,0.9)';

class Bug {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.heading = randomBetween(0, TAU);
    this.fall = 0;
    this.age = 0;
    this.fade = 0;
    this.stride = randomBetween(0, TAU);
    this.eating = false;
    this.bites = new Pulse(TERMITE.biteSeconds);
  }

  get gone() {
    return this.fade >= TERMITE.fadeSeconds;
  }

  turnToward(angle, dt) {
    const delta = Math.atan2(Math.sin(angle - this.heading), Math.cos(angle - this.heading));
    this.heading += clamp(delta, -TERMITE.turn * dt, TERMITE.turn * dt) + randomBetween(-WANDER, WANDER) * dt;
  }

  walk(distance) {
    const [dx, dy] = polar(this.heading, distance);
    this.x += dx;
    this.y = Math.min(0, this.y + dy);
    this.stride += distance * LEGS.stride / SIZE;
  }
}

function paintBug(context, pixel, bug) {
  context.save();
  context.globalAlpha = 1 - bug.fade / TERMITE.fadeSeconds;
  context.translate(bug.x, bug.y);
  context.rotate(bug.heading);
  context.strokeStyle = LEG;
  context.lineWidth = LEGS.width * pixel;
  context.beginPath();
  for (let pair = 0; pair < LEGS.pairs; pair++) {
    const base = (pair - 1) * LEGS.spread * SIZE;
    const swing = Math.sin(bug.stride + pair * Math.PI) * LEGS.swing * LEGS.spread * SIZE;
    [-1, 1].forEach((side) => {
      context.moveTo(base, 0);
      context.lineTo(base + swing * side, side * LEGS.reach * SIZE);
    });
  }
  context.stroke();
  SEGMENTS.forEach(({ offset, radius }, index) => {
    context.fillStyle = index === 0 ? HEAD : BODY;
    context.beginPath();
    context.arc(offset * SIZE, 0, radius * SIZE, 0, TAU);
    context.fill();
  });
  context.restore();
}

export class Termites extends Tool {
  constructor(room, surface, { onNibble, onHatch }) {
    super(room);
    this.surface = surface;
    this.onNibble = onNibble;
    this.onHatch = onHatch;
    this.bugs = [];
  }

  get busy() {
    return this.bugs.length > 0;
  }

  windUp() {
    const room = TERMITE.capacity - this.bugs.length;
    if (room <= 0) return;
    const spread = () => randomBetween(-TERMITE.scatter, TERMITE.scatter);
    this.bugs.push(...Array.from({ length: Math.min(room, TERMITE.colony) }, () => new Bug(this.aimX + spread(), Math.min(0, this.aimY + spread()))));
    this.onHatch();
  }

  stow() {
    super.stow();
    this.bugs = [];
  }

  update(dt) {
    this.bugs.forEach((bug) => this.crawl(bug, dt));
    this.bugs = this.bugs.filter((bug) => !bug.gone);
  }

  crawl(bug, dt) {
    bug.age += dt;
    if (bug.age >= TERMITE.lifeSeconds) {
      bug.fade += dt;
      return;
    }
    const contact = this.surface.contactAt(bug.x, bug.y, TERMITE.sense);
    if (!contact) {
      this.roam(bug, dt);
      return;
    }
    bug.fall = 0;
    const { x, y } = contact.point;
    const distance = Math.hypot(x - bug.x, y - bug.y);
    bug.turnToward(Math.atan2(y - bug.y, x - bug.x), dt);
    if (distance > TERMITE.bite) bug.walk(Math.min(distance, TERMITE.speed * dt));
    if (distance <= TERMITE.bite * BITE_REACH && bug.bites.tick(dt)) {
      bug.eating = this.onNibble({ x, y, radius: TERMITE.bite, first: !bug.eating });
    }
  }

  roam(bug, dt) {
    bug.eating = false;
    if (bug.y < 0) {
      bug.fall += GRAVITY * dt;
      bug.y = Math.min(0, bug.y + bug.fall * dt);
      return;
    }
    bug.fall = 0;
    if (Math.random() < FLOOR_TURN_CHANCE) bug.heading = Math.random() < 0.5 ? 0 : Math.PI;
    bug.heading = Math.cos(bug.heading) >= 0 ? 0 : Math.PI;
    bug.walk(TERMITE.speed * dt);
    bug.x = clamp(bug.x, -this.room.halfWidth, this.room.halfWidth);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.bugs.forEach((bug) => paintBug(context, pixel, bug));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
