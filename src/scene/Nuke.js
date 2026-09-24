import { NUKE } from '../config.js';
import { HAZARD, HAZARD_INK, inkOutline, paintReticle, radiate, traceRoundRect } from '../core/canvas.js';
import { TAU, clamp, easeOut, lerp, polar, randomBetween } from '../core/math.js';
import { Blasts } from './Blasts.js';
import { Tool } from './Tool.js';

const SKY_GAP = 0.1;
const SIZE = NUKE.size;
const BODY = Object.freeze({ width: SIZE, height: SIZE * 1.7 });
const TAIL = Object.freeze({ width: SIZE * 0.9, height: SIZE * 0.55, fin: SIZE * 0.35 });
const BAND = Object.freeze({ top: -SIZE * 0.25, height: SIZE * 0.3 });
const MUSHROOM = Object.freeze({ peak: 0.6, cap: 0.2, squash: 0.55, stem: 0.07, flare: 1.9, grow: 0.4, cool: 2.2, linger: 0.35, roll: 2.4, curl: 0.35, puff: 0.55, climb: 0.35, skirt: 0.55, whiteout: 0.22, white: 0.95 });
const PUFF = Object.freeze({ cap: 18, stem: 24, skirt: 12, stemSwell: 1.5, dust: 0.12, palette: [[70, 64, 60], [150, 60, 30], [240, 110, 40], [255, 190, 90], [255, 246, 220]] });
const TARGET = Object.freeze({ radius: 0.07, width: 2, dash: 6, spin: 30, blink: 18, color: '255,70,50' });
const CASING = ['#6f7a5c', '#3a4231'];
const FIN_PAINT = '#2d3327';
const HOT = '255,246,220';
const FIRE = '255,140,50';

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

function heatColor(heat) {
  const stops = PUFF.palette;
  const scaled = clamp(heat, 0, 1) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const share = scaled - index;
  return stops[index].map((channel, i) => Math.round(lerp(channel, stops[index + 1][i], share))).join(',');
}

function paintPuff(context, x, y, radius, heat, alpha) {
  const color = heatColor(heat);
  const gradient = context.createRadialGradient(x - radius * 0.25, y - radius * 0.35, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, `rgba(${color},${alpha})`);
  gradient.addColorStop(0.65, `rgba(${color},${alpha * 0.85})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fill();
}

class Cloud {
  constructor(x, y, peak) {
    this.x = x;
    this.y = y;
    this.peak = peak;
    this.age = 0;
    this.cap = Array.from({ length: PUFF.cap }, (_, i) => ({ angle: (i / PUFF.cap) * TAU, phase: randomBetween(0, TAU), size: randomBetween(0.7, 1.2) }));
    this.stem = Array.from({ length: PUFF.stem }, (_, i) => ({ share: i / PUFF.stem, sway: randomBetween(-1, 1), size: randomBetween(0.7, 1.2) }));
    this.skirt = Array.from({ length: PUFF.skirt }, (_, i) => ({ side: i % 2 ? 1 : -1, reach: randomBetween(0.3, 1), size: randomBetween(0.6, 1.1) }));
  }

  get t() {
    return this.age / NUKE.blastSeconds;
  }

  draw(context) {
    const { x, y, t } = this;
    const grow = easeOut(Math.min(1, t / MUSHROOM.grow));
    const fading = Math.min(1, (1 - t) / MUSHROOM.linger);
    const heat = Math.max(0, 1 - t * MUSHROOM.cool);
    const capY = lerp(Math.min(y, 0), this.peak, grow);
    const capRadius = MUSHROOM.cap * (0.35 + 0.65 * grow);
    const roll = this.age * MUSHROOM.roll;
    this.skirt.forEach(({ side, reach, size }) => {
      const spread = MUSHROOM.skirt * reach * easeOut(Math.min(1, t * 2));
      paintPuff(context, x + side * spread, -MUSHROOM.stem * size * 0.6, MUSHROOM.stem * size * (0.8 + grow), PUFF.dust, 0.6 * fading);
    });
    this.stem.forEach(({ share, sway, size }) => {
      const rise = (share + this.age * MUSHROOM.climb) % 1;
      const py = lerp(0, capY, rise);
      const width = MUSHROOM.stem * lerp(MUSHROOM.flare, 1, rise);
      paintPuff(context, x + sway * width * 0.5, py, width * size * PUFF.stemSwell, heat * (0.3 + 0.6 * rise), 0.5 * fading);
    });
    this.cap.forEach(({ angle, phase, size }) => {
      const [ringX, ringY] = polar(angle + roll * 0.2, capRadius);
      const [curlX, curlY] = polar(phase + roll, capRadius * MUSHROOM.curl);
      paintPuff(context, x + ringX + curlX * 0.5, capY + (ringY + curlY) * MUSHROOM.squash, capRadius * MUSHROOM.puff * size, heat * (0.75 + 0.25 * Math.sin(angle)), 0.8 * fading);
    });
    paintPuff(context, x, capY, capRadius * 0.9, heat, 0.9 * fading);
    if (heat > 0) radiate(context, x, capY, capRadius * 2.2, [[0, `rgba(${HOT},${0.8 * heat})`], [0.4, `rgba(${FIRE},${0.4 * heat})`], [1, `rgba(${FIRE},0)`]]);
  }
}

function paintTarget(context, pixel, { x, targetY, age }) {
  const blink = Math.sin(age * TARGET.blink) > 0 ? 1 : 0.4;
  context.save();
  context.strokeStyle = `rgba(${TARGET.color},${0.9 * blink})`;
  context.lineWidth = TARGET.width * pixel;
  context.setLineDash([TARGET.dash * pixel, TARGET.dash * pixel]);
  context.lineDashOffset = -age * TARGET.spin;
  context.beginPath();
  context.arc(x, targetY, TARGET.radius, 0, TAU);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
    context.moveTo(x + dx * TARGET.radius * 0.5, targetY + dy * TARGET.radius * 0.5);
    context.lineTo(x + dx * TARGET.radius * 1.4, targetY + dy * TARGET.radius * 1.4);
  });
  context.stroke();
  context.restore();
  radiate(context, x, targetY, TARGET.radius * 1.6, [[0, `rgba(${TARGET.color},${0.25 * blink})`], [1, `rgba(${TARGET.color},0)`]]);
}

class Warhead {
  constructor(x, y, targetY) {
    this.x = x;
    this.y = y;
    this.vy = NUKE.drop;
    this.targetY = targetY;
    this.age = 0;
  }

  fall(dt, surface) {
    this.age += dt;
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
    this.blasts = new Blasts(NUKE.ringSeconds);
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
    this.clouds.push(new Cloud(x, y, -this.room.ceiling * MUSHROOM.peak));
    this.onImpact(blow);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.clouds.forEach((cloud) => cloud.draw(context));
    this.blasts.draw(context, pixel);
    this.warheads.forEach((warhead) => {
      paintTarget(context, pixel, warhead);
      paintWarhead(context, pixel, warhead);
    });
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
