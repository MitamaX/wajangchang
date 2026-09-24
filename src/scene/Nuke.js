import { NUKE } from '../config.js';
import { HAZARD, HAZARD_INK, inkOutline, paintReticle, traceRoundRect } from '../core/canvas.js';
import { TAU, easeOut } from '../core/math.js';
import { Blasts } from './Blasts.js';
import { Tool } from './Tool.js';

const SKY_GAP = 0.1;
const SIZE = NUKE.size;
const BODY = Object.freeze({ width: SIZE, height: SIZE * 1.7 });
const TAIL = Object.freeze({ width: SIZE * 0.9, height: SIZE * 0.55, fin: SIZE * 0.35 });
const BAND = Object.freeze({ top: -SIZE * 0.25, height: SIZE * 0.3 });
const MUSHROOM = Object.freeze({ rise: 0.5, cap: 0.24, squash: 0.62, stem: 0.06, flare: 1.8, grow: 0.45, cool: 2.5, whiteout: 0.2, white: 0.95 });
const CASING = ['#6f7a5c', '#3a4231'];
const FIN_PAINT = '#2d3327';
const HOT = '255,246,220';
const FIRE = '255,140,50';
const SMOKE = '86,78,72';

function paintTail(context) {
  const top = -BODY.height / 2 - TAIL.height;
  context.fillStyle = FIN_PAINT;
  context.beginPath();
  context.moveTo(-TAIL.width / 2 - TAIL.fin, top);
  context.lineTo(TAIL.width / 2 + TAIL.fin, top);
  context.lineTo(TAIL.width / 2, -BODY.height / 2);
  context.lineTo(-TAIL.width / 2, -BODY.height / 2);
  context.closePath();
  context.fill();
  context.stroke();
}

function paintCasing(context) {
  const casing = context.createLinearGradient(-BODY.width / 2, 0, BODY.width / 2, 0);
  casing.addColorStop(0, CASING[0]);
  casing.addColorStop(1, CASING[1]);
  context.fillStyle = casing;
  context.beginPath();
  context.ellipse(0, 0, BODY.width / 2, BODY.height / 2, 0, 0, TAU);
  context.fill();
  context.stroke();
  context.save();
  context.clip();
  context.fillStyle = HAZARD;
  context.fillRect(-BODY.width / 2, BAND.top, BODY.width, BAND.height);
  context.fillStyle = HAZARD_INK;
  traceRoundRect(context, -BODY.width * 0.12, BAND.top + BAND.height * 0.2, BODY.width * 0.24, BAND.height * 0.6, BAND.height * 0.2);
  context.fill();
  context.restore();
}

function paintWarhead(context, pixel, { x, y }) {
  context.save();
  context.translate(x, y);
  inkOutline(context, pixel);
  paintTail(context);
  paintCasing(context);
  context.restore();
}

function paintStem(context, x, y, capY, fading) {
  const stem = context.createLinearGradient(0, y, 0, capY);
  stem.addColorStop(0, `rgba(${SMOKE},${0.75 * fading})`);
  stem.addColorStop(1, `rgba(${FIRE},${0.85 * fading})`);
  context.fillStyle = stem;
  context.beginPath();
  context.moveTo(x - MUSHROOM.stem * MUSHROOM.flare, y);
  context.quadraticCurveTo(x - MUSHROOM.stem * 0.5, (y + capY) / 2, x - MUSHROOM.stem, capY);
  context.lineTo(x + MUSHROOM.stem, capY);
  context.quadraticCurveTo(x + MUSHROOM.stem * 0.5, (y + capY) / 2, x + MUSHROOM.stem * MUSHROOM.flare, y);
  context.closePath();
  context.fill();
}

function paintCap(context, x, capY, radius, heat, fading) {
  context.save();
  context.translate(x, capY);
  context.scale(1, MUSHROOM.squash);
  const cap = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  cap.addColorStop(0, `rgba(${HOT},${heat})`);
  cap.addColorStop(0.45, `rgba(${FIRE},${0.9 * fading})`);
  cap.addColorStop(0.8, `rgba(${SMOKE},${0.7 * fading})`);
  cap.addColorStop(1, `rgba(${SMOKE},0)`);
  context.fillStyle = cap;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.restore();
}

function paintCloud(context, { x, y, age }) {
  const t = age / NUKE.blastSeconds;
  const fading = 1 - t;
  const grow = easeOut(Math.min(1, t / MUSHROOM.grow));
  const capY = y - MUSHROOM.rise * grow;
  paintStem(context, x, y, capY, fading);
  paintCap(context, x, capY, MUSHROOM.cap * (0.35 + 0.65 * grow), Math.max(0, 1 - t * MUSHROOM.cool), fading);
}

class Warhead {
  constructor(x, y, targetY) {
    this.x = x;
    this.y = y;
    this.vy = NUKE.drop;
    this.targetY = targetY;
  }

  fall(dt, surface) {
    const steps = Math.max(1, Math.ceil((this.vy * dt) / NUKE.reach));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vy += NUKE.gravity * step;
      this.y += this.vy * step;
      const hit = this.landing(surface);
      if (hit) return hit;
    }
    return null;
  }

  landing(surface) {
    if (this.y >= 0) return { x: this.x, y: 0 };
    const contact = surface.contactAt(this.x, this.y, NUKE.reach);
    if (contact) return contact.point;
    return this.y >= this.targetY ? { x: this.x, y: this.targetY } : null;
  }
}

export class Nuke extends Tool {
  constructor(room, surface, { onImpact, onLaunch }) {
    super(room);
    this.surface = surface;
    this.onImpact = onImpact;
    this.onLaunch = onLaunch;
    this.warheads = [];
    this.blasts = new Blasts(NUKE.blastSeconds);
    this.clouds = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.warheads.length > 0 || this.blasts.busy || this.clouds.length > 0;
  }

  get pending() {
    return this.warheads.length > 0;
  }

  windUp() {
    if (this.warheads.length >= NUKE.capacity) return;
    this.warheads.push(new Warhead(this.aimX, -this.room.ceiling - SKY_GAP, this.aimY));
    this.onLaunch();
  }

  stow() {
    super.stow();
    this.warheads = [];
  }

  update(dt) {
    this.blasts.update(dt);
    this.warheads = this.warheads.filter((warhead) => {
      const hit = warhead.fall(dt, this.surface);
      if (hit) this.detonate(hit);
      return !hit;
    });
    this.clouds = this.clouds.filter((cloud) => (cloud.age += dt) < NUKE.blastSeconds);
  }

  detonate({ x, y }) {
    const blow = { ...NUKE.blow, x, y };
    this.blasts.add(blow);
    this.clouds.push({ x, y, age: 0 });
    this.onImpact(blow);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.clouds.forEach((cloud) => paintCloud(context, cloud));
    this.blasts.draw(context, pixel);
    this.warheads.forEach((warhead) => paintWarhead(context, pixel, warhead));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
    this.clouds.forEach((cloud) => this.paintWhiteout(context, cloud));
  }

  paintWhiteout(context, { age }) {
    if (age >= MUSHROOM.whiteout) return;
    const { halfWidth, ceiling } = this.room;
    context.fillStyle = `rgba(255,255,255,${MUSHROOM.white * (1 - age / MUSHROOM.whiteout)})`;
    context.fillRect(-halfWidth * 2, -ceiling * 2, halfWidth * 4, ceiling * 3);
  }
}
