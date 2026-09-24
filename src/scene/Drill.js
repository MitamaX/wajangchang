import { DRILL } from '../config.js';
import { HAZARD, HAZARD_INK, steel, strokeOutline, traceRoundRect } from '../core/canvas.js';
import { TAU, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RADIUS = DRILL.radius;
const TIP = RADIUS * 1.5;
const SHANK = 0.13;
const FLUTES = 5;
const FLUTE_PITCH = (SHANK - TIP) / FLUTES;
const FLUTE_SLANT = RADIUS * 1.4;
const FLUTE_SHARE = 0.45;
const CHUCK = Object.freeze({ top: RADIUS * 1.9, bottom: RADIUS * 1.25, height: 0.045, ridges: 4 });
const HOUSING = Object.freeze({ width: 0.075, height: 0.12, corner: 0.012, band: 0.3, vents: 3, ventWidth: 0.006 });
const WHINE_SPEED = 0.3;
const RIDGE_WIDTH = 1.5;
const FLUTE = 'rgba(28,31,34,0.55)';
const RIDGE = 'rgba(0,0,0,0.35)';

function traceBit(context) {
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(RADIUS, -TIP);
  context.lineTo(RADIUS, -SHANK);
  context.lineTo(-RADIUS, -SHANK);
  context.lineTo(-RADIUS, -TIP);
  context.closePath();
}

function paintBit(context, pixel, turn) {
  context.fillStyle = steel(context, -RADIUS, 0, RADIUS, 0);
  traceBit(context);
  context.fill();
  context.save();
  context.clip();
  context.fillStyle = FLUTE;
  for (let flute = -1; flute <= FLUTES; flute++) {
    const bottom = -TIP - (flute + turn) * FLUTE_PITCH;
    const top = bottom - FLUTE_PITCH * FLUTE_SHARE;
    context.beginPath();
    context.moveTo(-RADIUS, bottom);
    context.lineTo(RADIUS, bottom - FLUTE_SLANT);
    context.lineTo(RADIUS, top - FLUTE_SLANT);
    context.lineTo(-RADIUS, top);
    context.closePath();
    context.fill();
  }
  context.restore();
  traceBit(context);
  strokeOutline(context, pixel);
}

function paintChuck(context, pixel) {
  const top = -SHANK - CHUCK.height;
  context.fillStyle = steel(context, -CHUCK.top, 0, CHUCK.top, 0);
  context.beginPath();
  context.moveTo(-CHUCK.bottom, -SHANK);
  context.lineTo(CHUCK.bottom, -SHANK);
  context.lineTo(CHUCK.top, top);
  context.lineTo(-CHUCK.top, top);
  context.closePath();
  context.fill();
  strokeOutline(context, pixel);
  context.strokeStyle = RIDGE;
  context.lineWidth = RIDGE_WIDTH * pixel;
  context.beginPath();
  for (let ridge = 1; ridge <= CHUCK.ridges; ridge++) {
    const share = ridge / (CHUCK.ridges + 1) - 0.5;
    context.moveTo(share * CHUCK.bottom * 2, -SHANK);
    context.lineTo(share * CHUCK.top * 2, top);
  }
  context.stroke();
}

function paintHousing(context, pixel) {
  const { width, height, corner, band, vents, ventWidth } = HOUSING;
  const top = -SHANK - CHUCK.height - height;
  context.fillStyle = HAZARD;
  traceRoundRect(context, -width / 2, top, width, height, corner);
  context.fill();
  strokeOutline(context, pixel);
  context.fillStyle = HAZARD_INK;
  context.fillRect(-width / 2, top + height * (1 - band), width, height * band);
  for (let vent = 0; vent < vents; vent++) {
    const x = ((vent + 1) / (vents + 1) - 0.5) * width;
    traceRoundRect(context, x - ventWidth / 2, top + height * 0.15, ventWidth, height * 0.35, ventWidth / 2);
    context.fill();
  }
}

export class Drill extends Tool {
  constructor(room, { onBore, onWhine }) {
    super(room);
    this.onBore = onBore;
    this.onWhine = onWhine;
    this.holding = false;
    this.biting = false;
    this.speed = 0;
    this.angle = 0;
    this.feed = 0;
    this.pressure = 0;
    this.bites = new Pulse(DRILL.biteSeconds);
    this.whines = new Pulse(DRILL.whineSeconds);
    this.cracks = new Pulse(DRILL.crackSeconds);
  }

  get busy() {
    return this.biting || this.feed > 0;
  }

  get tipY() {
    return this.aimY + this.feed;
  }

  get focus() {
    return this.biting ? { x: this.aimX, y: this.tipY, radius: RADIUS, charge: DRILL.tension * this.pressure } : null;
  }

  windUp() {
    this.holding = true;
    this.bites.reset();
    this.cracks.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.biting = false;
    this.speed = 0;
    this.feed = 0;
    this.pressure = 0;
  }

  update(dt) {
    const spinning = this.holding && this.present;
    this.speed += ((spinning ? DRILL.spin : 0) - this.speed) * Math.min(1, DRILL.spool * dt);
    this.angle = (this.angle + this.speed * dt) % TAU;
    if (this.speed > DRILL.spin * WHINE_SPEED && this.whines.tick(dt)) this.onWhine();
    if (!spinning) {
      this.retract(dt);
      return;
    }
    if (this.biting) this.sink(dt);
    if (this.bites.tick(dt)) this.bite();
  }

  sink(dt) {
    this.feed = Math.min(DRILL.depth, -this.aimY, this.feed + DRILL.feed * dt);
    this.pressure = Math.min(1, this.pressure + dt / DRILL.pressureSeconds);
  }

  retract(dt) {
    this.biting = false;
    this.pressure = 0;
    this.feed = Math.max(0, this.feed - DRILL.retract * dt);
  }

  bite() {
    const crack = this.cracks.tick(DRILL.biteSeconds);
    this.biting = this.onBore({ x: this.aimX, y: this.tipY, radius: RADIUS, first: !this.biting, crack, pressure: this.pressure });
    if (!this.biting) this.pressure = 0;
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    const shake = this.biting ? DRILL.shake : 0;
    context.save();
    context.translate(this.aimX + randomBetween(-shake, shake), this.tipY);
    paintBit(context, pixel, this.angle / TAU);
    paintChuck(context, pixel);
    paintHousing(context, pixel);
    context.restore();
  }
}
