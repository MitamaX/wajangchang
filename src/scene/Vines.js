import { CELL_METERS, VINE } from '../config.js';
import { paintReticle, radiate } from '../core/canvas.js';
import { TAU, polar, randomBetween, randomSign } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const STEPS_PER_SECOND = VINE.speed / (VINE.step * CELL_METERS);
const BUD = Object.freeze({ radius: 0.004, glow: 0.016 });
const BUD_GLOW = '200,255,130';
const BUD_INK = '#6fbf3e';

class Shoot {
  constructor(x, y, heading) {
    Object.assign(this, { x, y, heading, curl: randomBetween(-VINE.curl, VINE.curl), steps: 0 });
  }
}

class Seed {
  constructor({ x, y }) {
    const turn = randomBetween(0, TAU);
    this.shoots = Array.from({ length: VINE.shoots }, (_, i) => new Shoot(x, y, turn + (i / VINE.shoots) * TAU));
    this.grown = 0;
    this.due = 0;
  }

  get spent() {
    return this.grown >= VINE.budget || !this.shoots.length;
  }
}

export class Vines extends Tool {
  constructor(room, surface, { onSow, onCreep, onRustle }) {
    super(room);
    this.surface = surface;
    this.onSow = onSow;
    this.onCreep = onCreep;
    this.onRustle = onRustle;
    this.seeds = [];
    this.rustles = new Pulse(VINE.rustleSeconds);
  }

  get busy() {
    return this.seeds.length > 0;
  }

  get pending() {
    return this.busy;
  }

  windUp() {
    if (this.seeds.length >= VINE.capacity) return;
    const anchor = this.onSow(this.aimX, this.aimY);
    if (anchor) this.seeds.push(new Seed(anchor));
  }

  stow() {
    super.stow();
    this.seeds = [];
  }

  update(dt) {
    if (this.busy && this.rustles.tick(dt)) this.onRustle(VINE.rustleSeconds);
    this.seeds.forEach((seed) => this.grow(seed, dt));
    this.seeds = this.seeds.filter((seed) => !seed.spent);
  }

  grow(seed, dt) {
    seed.due += STEPS_PER_SECOND * dt;
    for (; seed.due >= 1 && !seed.spent; seed.due--) seed.shoots = seed.shoots.flatMap((shoot) => this.extend(seed, shoot));
  }

  extend(seed, shoot) {
    shoot.heading += shoot.curl + randomBetween(-VINE.wander, VINE.wander);
    shoot.steps++;
    const [dx, dy] = polar(shoot.heading, VINE.step);
    const to = { x: shoot.x + dx, y: shoot.y + dy };
    const growth = this.onCreep({ from: { x: shoot.x, y: shoot.y }, to, leaf: shoot.steps % VINE.leafEvery ? 0 : randomSign(), rooted: shoot.steps > VINE.sprout });
    if (!growth) return [];
    seed.grown += VINE.step * CELL_METERS;
    if (growth.ended) return [];
    Object.assign(shoot, to);
    return Math.random() < VINE.branch ? [shoot, new Shoot(to.x, to.y, shoot.heading + randomSign() * VINE.branchAngle)] : [shoot];
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.seeds.forEach((seed) => seed.shoots.forEach((shoot) => this.drawBud(context, shoot)));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawBud(context, shoot) {
    const pose = this.surface.hold(shoot);
    if (!pose) return;
    radiate(context, pose.x, pose.y, BUD.glow, [[0, `rgba(${BUD_GLOW},0.7)`], [1, `rgba(${BUD_GLOW},0)`]]);
    context.fillStyle = BUD_INK;
    context.beginPath();
    context.arc(pose.x, pose.y, BUD.radius, 0, TAU);
    context.fill();
  }
}
