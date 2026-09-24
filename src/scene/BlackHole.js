import { BLACKHOLE } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, lerp, polar, randomBetween } from '../core/math.js';
import { Field } from './Field.js';
import { Pulse } from './Pulse.js';

const LENS = Object.freeze({ reach: 4, alpha: 0.55 });
const PHOTON = Object.freeze({ reach: 1.18, width: 1.6 });
const DISK = Object.freeze({ reach: [1.5, 3.4], squash: 0.28, tilt: -0.22, rings: 5, spin: 3.2, dash: [0.9, 0.5], width: 2.2 });
const MOTE = Object.freeze({ rate: 90, reach: [0.4, 0.8], speed: [0.5, 1.2], swirl: 4, trail: 0.25, width: 1.3 });
const INK = '0,0,0';
const HOT = '255,236,200';
const DISK_TINT = '255,150,70';
const HALO = '150,110,255';

export class BlackHole extends Field {
  constructor(room, { onFeed, onSweep, onHum, onCollapse }) {
    super(room, BLACKHOLE, { onSweep, onHum, onRelease: onCollapse });
    this.onFeed = onFeed;
    this.feeding = false;
    this.spawned = 0;
    this.motes = [];
    this.feeds = new Pulse(BLACKHOLE.feedSeconds);
  }

  get horizon() {
    return lerp(...BLACKHOLE.horizon, this.size);
  }

  get focus() {
    return this.holding ? { x: this.x, y: this.y, radius: this.horizon, charge: lerp(...BLACKHOLE.tension, this.size) } : null;
  }

  begin() {
    this.feeds.reset();
  }

  end() {
    this.motes = [];
  }

  blow() {
    const { size, reach } = this;
    return {
      ...BLACKHOLE.collapse,
      x: this.x,
      y: this.y,
      radius: this.horizon * BLACKHOLE.collapseRadius,
      strength: lerp(...BLACKHOLE.collapseStrength, size),
      blast: { reach, speed: lerp(...BLACKHOLE.collapseSpeed, size), heft: BLACKHOLE.heft },
      force: size,
    };
  }

  tick(dt) {
    this.gather(dt);
    if (this.feeds.tick(dt)) this.feeding = this.onFeed({ x: this.x, y: this.y, radius: this.horizon, first: !this.feeding });
  }

  thrust(x, y, dt) {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.hypot(dx, dy);
    const { reach } = this;
    if (distance > reach || distance < 1e-6) return null;
    const strength = lerp(...BLACKHOLE.pull, this.size) * (1 - distance / reach) * dt / distance;
    return [(dx + dy * BLACKHOLE.swirl) * strength, (dy - dx * BLACKHOLE.swirl) * strength];
  }

  gather(dt) {
    this.spawned += MOTE.rate * this.size * dt;
    for (; this.spawned >= 1; this.spawned--) {
      this.motes.push({ angle: randomBetween(0, TAU), distance: this.reach * randomBetween(...MOTE.reach), speed: this.reach * randomBetween(...MOTE.speed) });
    }
    this.motes = this.motes.filter((mote) => {
      mote.distance -= mote.speed * dt;
      mote.angle += MOTE.swirl * dt * Math.sqrt(this.reach / Math.max(mote.distance, this.horizon));
      return mote.distance > this.horizon;
    });
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.flares.forEach((flare) => this.drawFlare(context, pixel, flare));
    if (!this.holding) return;
    const { x, y, horizon } = this;
    radiate(context, x, y, horizon * LENS.reach, [[0, `rgba(${HALO},${LENS.alpha * this.size})`], [1, `rgba(${HALO},0)`]]);
    context.save();
    context.translate(x, y);
    this.drawDisk(context, pixel, horizon, Math.PI, 0);
    context.fillStyle = `rgb(${INK})`;
    context.beginPath();
    context.arc(0, 0, horizon, 0, TAU);
    context.fill();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${HOT},0.9)`;
    context.lineWidth = PHOTON.width * pixel;
    context.beginPath();
    context.arc(0, 0, horizon * PHOTON.reach, 0, TAU);
    context.stroke();
    this.drawDisk(context, pixel, horizon, 0, Math.PI);
    this.drawMotes(context, pixel);
    context.restore();
  }

  drawDisk(context, pixel, horizon, from, to) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.rotate(DISK.tilt);
    context.lineWidth = DISK.width * pixel;
    for (let ring = 0; ring < DISK.rings; ring++) {
      const share = ring / (DISK.rings - 1);
      const radius = horizon * lerp(...DISK.reach, share);
      const alpha = (1 - share) * 0.8 * this.size;
      context.strokeStyle = `rgba(${share < 0.3 ? HOT : DISK_TINT},${alpha})`;
      context.setLineDash([radius * DISK.dash[0], radius * DISK.dash[1]]);
      context.lineDashOffset = -this.time * DISK.spin * radius * (1.5 - share);
      context.beginPath();
      context.ellipse(0, 0, radius, radius * DISK.squash, 0, from, to);
      context.stroke();
    }
    context.restore();
  }

  drawMotes(context, pixel) {
    context.strokeStyle = `rgba(${DISK_TINT},0.8)`;
    context.lineWidth = MOTE.width * pixel;
    context.beginPath();
    this.motes.forEach(({ angle, distance }) => {
      context.moveTo(...polar(angle, distance));
      context.lineTo(...polar(angle - MOTE.trail, distance * 1.08));
    });
    context.stroke();
  }

  drawFlare(context, pixel, { x, y, radius, age }) {
    const t = age / BLACKHOLE.flareSeconds;
    const fading = 1 - t;
    radiate(context, x, y, radius * clamp(t * 2, 0.2, 1), [
      [0, `rgba(${HOT},${fading})`],
      [0.3, `rgba(${HALO},${0.6 * fading})`],
      [1, `rgba(${HALO},0)`],
    ]);
  }
}
