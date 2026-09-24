import { PRESS } from '../config.js';
import { paintHazard, steel } from '../core/canvas.js';
import { lerp } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const ROD_OVERHANG = 0.2;
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
    this.x = 0;
    this.bottom = null;
    this.holding = false;
    this.touching = false;
    this.landed = false;
    this.crushing = null;
    this.crushes = new Pulse(PRESS.crushSeconds);
    this.hums = new Pulse(PRESS.humSeconds);
  }

  get spills() {
    return false;
  }

  get rest() {
    return -this.room.height + PRESS.restGap + PRESS.plateHeight;
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

  get focus() {
    if (!this.holding) return null;
    const charge = this.crushing ? PRESS.tension.crushing : PRESS.tension.moving;
    return { x: this.x, y: this.bottom, radius: PRESS.halfWidth, charge };
  }

  windUp() {
    this.holding = true;
    this.touching = false;
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
    if (!this.holding && this.raised) this.x = this.aimX;
    if (this.holding) this.descend(dt);
    else this.ascend(dt);
    const moving = this.holding ? this.bottom < this.floor : !this.raised;
    if (moving && this.hums.tick(dt)) this.onHum();
  }

  descend(dt) {
    const speed = this.crushing ? lerp(PRESS.drop, PRESS.speed * (1 - this.crushing.resistance), Math.sqrt(this.crushing.coverage)) : PRESS.drop;
    this.bottom = Math.min(this.bottom + speed * dt, this.floor);
    if (this.bottom >= this.floor && !this.landed) {
      this.landed = true;
      this.onLand(this.x);
    }
    if (!this.crushes.tick(dt)) return;
    this.crushing = this.onCrush({ x: this.x, halfWidth: PRESS.halfWidth, bottom: this.bottom, first: !this.touching });
    this.touching = this.touching || Boolean(this.crushing?.crushed);
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
    this.drawRod(context, pixel, top);
    this.drawPlate(context, pixel, top, bottom);
  }

  drawRod(context, pixel, top) {
    const half = PRESS.rodWidth / 2;
    const sky = -this.room.ceiling - ROD_OVERHANG;
    context.fillStyle = steel(context, this.x - half, 0, this.x + half, 0);
    context.strokeStyle = OUTLINE;
    context.lineWidth = OUTLINE_WIDTH * pixel;
    context.fillRect(this.x - half, sky, PRESS.rodWidth, top - sky);
    context.strokeRect(this.x - half, sky, PRESS.rodWidth, top - sky);
  }

  drawPlate(context, pixel, top, bottom) {
    const left = this.x - PRESS.halfWidth;
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
