import { ACID } from '../config.js';
import { paintReticle, radiate } from '../core/canvas.js';
import { TAU, randomBetween } from '../core/math.js';
import { Perch } from './Perch.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const DRIP_DROP = 2;
const EVAPORATION = 0.5;
const WOBBLE = Object.freeze({ rate: 9, depth: 0.12 });
const SHINE = Object.freeze({ x: -0.35, y: -0.4, size: 0.35 });
const HALO_REACH = 2.2;
const BODY = 'rgba(128,214,40,0.92)';
const EDGE = 'rgba(40,90,10,0.8)';
const SHINE_INK = 'rgba(235,255,200,0.85)';
const HALO = '170,255,60';
const OUTLINE_WIDTH = 1;

class Glob extends Perch {
  constructor(x, y, potency) {
    super(x, y, null, ACID.size);
    this.potency = potency;
    this.eating = false;
    this.fade = 0;
    this.phase = randomBetween(0, TAU);
    this.bites = new Pulse(ACID.biteSeconds);
  }

  get radius() {
    return ACID.size * (0.55 + 0.45 * this.potency);
  }

  get spent() {
    return this.potency <= 0;
  }

  get gone() {
    return this.fade >= ACID.fadeSeconds;
  }
}

function paintGlob(context, pixel, glob, time) {
  const { x, y, radius } = glob;
  const squash = 1 + WOBBLE.depth * Math.sin(time * WOBBLE.rate + glob.phase);
  context.save();
  context.globalAlpha = 1 - glob.fade / ACID.fadeSeconds;
  radiate(context, x, y, radius * HALO_REACH, [[0, `rgba(${HALO},0.35)`], [1, `rgba(${HALO},0)`]]);
  context.translate(x, y);
  context.scale(squash, 1 / squash);
  context.fillStyle = BODY;
  context.strokeStyle = EDGE;
  context.lineWidth = OUTLINE_WIDTH * pixel;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.stroke();
  context.fillStyle = SHINE_INK;
  context.beginPath();
  context.arc(radius * SHINE.x, radius * SHINE.y, radius * SHINE.size, 0, TAU);
  context.fill();
  context.restore();
}

export class Acid extends Tool {
  constructor(room, surface, { onEat, onSplat, onHiss }) {
    super(room);
    this.surface = surface;
    this.onEat = onEat;
    this.onSplat = onSplat;
    this.onHiss = onHiss;
    this.globs = [];
    this.time = 0;
    this.hisses = new Pulse(ACID.bubbleSeconds);
  }

  get busy() {
    return this.globs.length > 0;
  }

  windUp() {
    if (this.globs.length >= ACID.capacity) return;
    this.globs.push(new Glob(this.aimX, this.aimY, 1));
    this.onSplat();
  }

  stow() {
    super.stow();
    this.globs = [];
  }

  update(dt) {
    this.time += dt;
    const drips = this.globs.flatMap((glob) => this.corrode(glob, dt));
    this.globs = [...this.globs.filter((glob) => !glob.gone), ...drips].slice(0, ACID.capacity);
    if (this.globs.some((glob) => glob.eating) && this.hisses.tick(dt)) this.onHiss(ACID.bubbleSeconds);
  }

  corrode(glob, dt) {
    glob.follow(dt, this.surface);
    if (glob.spent) {
      glob.eating = false;
      glob.fade += dt;
      return [];
    }
    if (!glob.bites.tick(dt)) return [];
    glob.eating = this.onEat({ x: glob.x, y: glob.y, radius: ACID.bite * Math.sqrt(glob.potency), first: !glob.eating });
    glob.potency -= ACID.cost * (glob.eating ? 1 : EVAPORATION);
    const dripping = glob.eating && glob.potency > ACID.dripMinimum && Math.random() < ACID.dripChance;
    return dripping ? [new Glob(glob.x, glob.y + glob.radius * DRIP_DROP, glob.potency * ACID.dripShare)] : [];
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.globs.forEach((glob) => paintGlob(context, pixel, glob, this.time));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
