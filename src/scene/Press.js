import { PRESS } from '../config.js';
import { paintHazard, steel } from '../core/canvas.js';
import { lerp } from '../core/math.js';
import { Gantry } from './Gantry.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const HAZARD_BAND = Object.freeze({ offset: 0.3, share: 0.4, pitch: 0.03 });
const OUTLINE_WIDTH = 1.2;
const EDGE_WIDTH = 1.5;
const RAISED_TOLERANCE = 1e-4;
const OUTLINE = 'rgba(0,0,0,0.5)';
const EDGE = 'rgba(255,255,255,0.5)';

export class Press extends Tool {
  constructor(room, { onCrush, onLand, onHum }) {
    super(room);
    this.onCrush = onCrush;
    this.onLand = onLand;
    this.onHum = onHum;
    this.gantry = new Gantry(room);
    this.bottom = null;
    this.holding = false;
    this.landed = false;
    this.crushing = null;
    this.crushes = new Pulse(PRESS.crushSeconds);
    this.hums = new Pulse(PRESS.humSeconds);
  }

  get spills() {
    return false;
  }

  get rest() {
    return this.gantry.top + PRESS.plateHeight;
  }

  get floor() {
    return -PRESS.floorGap;
  }

  get raised() {
    return this.bottom === null || this.bottom <= this.rest + RAISED_TOLERANCE;
  }

  get busy() {
    return this.holding || !this.raised;
  }

  get shown() {
    return this.active || !this.raised;
  }

  get tempo() {
    return this.holding && !this.crushing && !this.landed ? PRESS.tempo : 1;
  }

  get focus() {
    if (!this.holding) return null;
    const charge = this.crushing ? PRESS.tension.crushing : PRESS.tension.moving;
    return { x: this.gantry.x, y: this.bottom, radius: PRESS.halfWidth, charge };
  }

  windUp() {
    this.holding = true;
    this.gantry.send(this.aimX);
    this.crushes.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    this.holding = false;
    this.present = false;
    this.bottom = null;
    this.crushing = null;
    this.landed = false;
  }

  update(dt) {
    const { rest } = this;
    this.bottom = Math.max(this.bottom ?? rest, rest);
    if (!this.holding && this.raised) this.gantry.follow(this.aimX);
    if (this.holding && this.gantry.arrived) this.descend(dt);
    else if (this.holding && this.raised) this.gantry.travel(dt);
    else this.ascend(dt);
    const moving = this.holding ? this.bottom < this.floor : !this.raised;
    if (moving && this.hums.tick(dt)) this.onHum();
  }

  descend(dt) {
    const { x } = this.gantry;
    const speed = this.crushing ? lerp(PRESS.drop, PRESS.speed * (1 - this.crushing.resistance), Math.sqrt(this.crushing.coverage)) : PRESS.drop;
    this.bottom = Math.min(this.bottom + speed * dt, this.floor);
    if (this.bottom >= this.floor && !this.landed) {
      this.landed = true;
      this.onLand(x);
    }
    if (!this.crushes.tick(dt)) return;
    this.crushing = this.onCrush({ x, halfWidth: PRESS.halfWidth, bottom: this.bottom });
  }

  ascend(dt) {
    this.bottom = Math.max(this.bottom - PRESS.lift * dt, this.rest);
    this.landed = false;
    this.crushing = null;
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    const bottom = this.bottom ?? this.rest;
    const top = bottom - PRESS.plateHeight;
    const { x, sky } = this.gantry;
    this.drawRod(context, pixel, x, sky, top);
    this.drawPlate(context, pixel, x, top, bottom);
  }

  drawRod(context, pixel, x, sky, top) {
    const half = PRESS.rodWidth / 2;
    context.fillStyle = steel(context, x - half, 0, x + half, 0);
    context.strokeStyle = OUTLINE;
    context.lineWidth = OUTLINE_WIDTH * pixel;
    context.fillRect(x - half, sky, PRESS.rodWidth, top - sky);
    context.strokeRect(x - half, sky, PRESS.rodWidth, top - sky);
  }

  drawPlate(context, pixel, x, top, bottom) {
    const left = x - PRESS.halfWidth;
    const width = PRESS.halfWidth * 2;
    const height = PRESS.plateHeight;
    context.fillStyle = steel(context, 0, top, 0, bottom);
    context.fillRect(left, top, width, height);
    paintHazard(context, left, top + height * HAZARD_BAND.offset, width, height * HAZARD_BAND.share, HAZARD_BAND.pitch);
    context.strokeStyle = OUTLINE;
    context.lineWidth = OUTLINE_WIDTH * pixel;
    context.strokeRect(left, top, width, height);
    context.strokeStyle = EDGE;
    context.lineWidth = EDGE_WIDTH * pixel;
    context.beginPath();
    context.moveTo(left, bottom);
    context.lineTo(left + width, bottom);
    context.stroke();
  }
}
