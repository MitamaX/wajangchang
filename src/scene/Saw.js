import { SAW } from '../config.js';
import { steel } from '../core/canvas.js';
import { TAU, polar, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RADIUS = SAW.radius;
const TEETH = 10;
const TOOTH_SPACING = TAU / TEETH;
const TIP_SHARE = 0.8;
const GULLET = RADIUS * 0.7;
const PLATE = GULLET * 0.96;
const HUB = RADIUS * 0.26;
const ARBOR = RADIUS * 0.08;
const VENTS = 4;
const VENT_RADIUS = RADIUS * 0.07;
const VENT_DISTANCE = RADIUS * 0.46;
const GHOST_LAG = 0.012;
const GHOSTS = [{ lag: 2, alpha: 0.15 }, { lag: 1, alpha: 0.35 }, { lag: 0, alpha: 1 }];
const WHIR_SPEED = 0.3;
const OUTLINE_WIDTH = 1.2;
const OUTLINE = 'rgba(0,0,0,0.45)';
const TOOTH_STEEL = '#cfd4d8';
const HUB_STEEL = '#4f5559';
const HOLE = '#141517';
const REST = Object.freeze([0, 0]);

class Recoil {
  constructor() {
    this.settle();
  }

  settle() {
    this.offset = REST;
    this.drift = REST;
  }

  kick(impulse) {
    this.drift = this.drift.map((speed, axis) => speed + impulse[axis]);
  }

  update(dt) {
    const { stiffness, damping } = SAW.recoil;
    this.drift = this.drift.map((speed, axis) => speed - (stiffness * this.offset[axis] + damping * speed) * dt);
    this.offset = this.offset.map((shift, axis) => shift + this.drift[axis] * dt);
  }
}

function traceBlade(context) {
  context.beginPath();
  for (let i = 0; i < TEETH; i++) {
    const angle = i * TOOTH_SPACING;
    context.lineTo(...polar(angle, GULLET));
    context.lineTo(...polar(angle + TIP_SHARE * TOOTH_SPACING, RADIUS));
  }
  context.closePath();
}

function disc(context, radius) {
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
}

function paintTeeth(context, pixel, angle, speed) {
  context.fillStyle = TOOTH_STEEL;
  context.strokeStyle = OUTLINE;
  context.lineWidth = OUTLINE_WIDTH * pixel;
  GHOSTS.forEach(({ lag, alpha }) => {
    context.save();
    context.globalAlpha *= alpha;
    context.rotate(angle - lag * speed * GHOST_LAG);
    traceBlade(context);
    context.fill();
    if (!lag) context.stroke();
    context.restore();
  });
}

export function paintBlade(context, pixel, angle, speed) {
  paintTeeth(context, pixel, angle, speed);
  paintPlate(context, pixel, angle);
}

function paintPlate(context, pixel, angle) {
  context.save();
  context.rotate(angle);
  context.fillStyle = steel(context, -PLATE, -PLATE, PLATE, PLATE);
  context.strokeStyle = OUTLINE;
  context.lineWidth = OUTLINE_WIDTH * pixel;
  disc(context, PLATE);
  context.fill();
  context.fillStyle = HOLE;
  for (let i = 0; i < VENTS; i++) {
    context.beginPath();
    context.arc(...polar((i / VENTS) * TAU, VENT_DISTANCE), VENT_RADIUS, 0, TAU);
    context.fill();
  }
  context.fillStyle = HUB_STEEL;
  disc(context, HUB);
  context.fill();
  context.stroke();
  context.fillStyle = HOLE;
  disc(context, ARBOR);
  context.fill();
  context.restore();
}

export class Saw extends Tool {
  constructor(room, { onGrind, onWhir }) {
    super(room);
    this.onGrind = onGrind;
    this.onWhir = onWhir;
    this.angle = 0;
    this.speed = 0;
    this.holding = false;
    this.biting = false;
    this.bites = new Pulse(SAW.biteSeconds);
    this.whirs = new Pulse(SAW.whirSeconds);
    this.recoil = new Recoil();
  }

  get bladeX() {
    return this.aimX + this.recoil.offset[0];
  }

  get bladeY() {
    return this.aimY + this.recoil.offset[1];
  }

  get busy() {
    return this.biting;
  }

  get shown() {
    return this.present;
  }

  windUp() {
    this.holding = true;
    this.bites.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    this.present = false;
    this.holding = false;
    this.biting = false;
    this.speed = 0;
    this.recoil.settle();
  }

  update(dt) {
    const target = this.holding && this.present ? SAW.spin : 0;
    this.speed += (target - this.speed) * Math.min(1, SAW.spool * dt);
    this.angle = (this.angle + this.speed * dt) % TAU;
    this.recoil.update(dt);
    if (this.speed > SAW.spin * WHIR_SPEED && this.whirs.tick(dt)) this.onWhir();
    if (!target) {
      this.biting = false;
      return;
    }
    if (!this.bites.tick(dt)) return;
    const bite = this.onGrind({ x: this.bladeX, y: this.bladeY, radius: RADIUS, first: !this.biting });
    this.biting = Boolean(bite);
    if (bite) this.recoil.kick(bite.recoil);
  }

  draw(context, pixelsPerMeter) {
    if (!this.present) return;
    const pixel = 1 / pixelsPerMeter;
    const shake = this.biting ? SAW.shake : 0;
    context.save();
    context.translate(this.bladeX + randomBetween(-shake, shake), this.bladeY + randomBetween(-shake, shake));
    paintBlade(context, pixel, this.angle, this.speed);
    context.restore();
  }
}
