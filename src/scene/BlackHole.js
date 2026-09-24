import { BLACKHOLE } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, easeOut, lerp, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const LENS = Object.freeze({ reach: 6, rings: 12, taper: 0.8, zoom: [0.25, 0.6], twist: 0.9, drift: 0.15 });
const SHADE = Object.freeze({ reach: 0.85, alpha: 0.55 });
const PHOTON = Object.freeze({ reach: 1.12, width: 2.2, glow: 1.6 });
const DISK = Object.freeze({ reach: [1.45, 3.8], squash: 0.26, tilt: -0.22, rings: 8, spin: 3.2, dash: [0.8, 0.35], width: 3, doppler: 0.65 });
const MOTE = Object.freeze({ rate: 110, reach: [0.3, 0.75], speed: [0.4, 1], swirl: 4, trail: 0.45, width: 1.6 });
const FLARE = Object.freeze({ zoom: 0.4, core: 0.35, ring: 6 });
const INK = '0,0,0';
const HOT = '255,244,214';
const DISK_INNER = '255,214,150';
const DISK_OUTER = '255,120,50';
const HALO = '150,110,255';

function lens(context, x, y, radius, zoom, twist) {
  const matrix = context.getTransform();
  const center = matrix.transformPoint(new DOMPoint(x, y));
  const reach = radius * Math.hypot(matrix.a, matrix.b);
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.clip();
  context.setTransform(1, 0, 0, 1, center.x, center.y);
  context.rotate(twist);
  context.scale(zoom, zoom);
  context.drawImage(context.canvas, center.x - reach, center.y - reach, reach * 2, reach * 2, -reach, -reach, reach * 2, reach * 2);
  context.restore();
}

function shade(context, x, y, radius, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${INK},${alpha})`);
  gradient.addColorStop(1, `rgba(${INK},0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fill();
}

export class BlackHole extends Tool {
  constructor(room, { onFeed, onSweep, onHum, onCollapse }) {
    super(room);
    this.onFeed = onFeed;
    this.onSweep = onSweep;
    this.onHum = onHum;
    this.onCollapse = onCollapse;
    this.holding = false;
    this.feeding = false;
    this.x = 0;
    this.y = 0;
    this.growth = 0;
    this.time = 0;
    this.spawned = 0;
    this.motes = [];
    this.flares = [];
    this.feeds = new Pulse(BLACKHOLE.feedSeconds);
    this.hums = new Pulse(BLACKHOLE.humSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.flares.length > 0;
  }

  get size() {
    return easeOut(this.growth);
  }

  get reach() {
    return lerp(...BLACKHOLE.reach, this.size);
  }

  get horizon() {
    return lerp(...BLACKHOLE.horizon, this.size);
  }

  get focus() {
    return this.holding ? { x: this.x, y: this.y, radius: this.horizon, charge: lerp(...BLACKHOLE.tension, this.size) } : null;
  }

  windUp() {
    this.holding = true;
    this.growth = 0;
    this.x = this.aimX;
    this.y = this.aimY;
    this.feeds.reset();
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    this.flares.push({ x: this.x, y: this.y, radius: this.reach, size: this.size, age: 0 });
    this.motes = [];
    this.onCollapse(this.blow());
  }

  cancel() {
    this.holding = false;
    this.motes = [];
  }

  stow() {
    super.stow();
    this.flares = [];
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

  update(dt) {
    this.time += dt;
    this.flares = this.flares.filter((flare) => (flare.age += dt) < BLACKHOLE.flareSeconds);
    if (!this.holding) return;
    this.growth = Math.min(1, this.growth + dt / BLACKHOLE.growSeconds);
    const follow = Math.min(1, BLACKHOLE.follow * dt);
    this.x += (this.aimX - this.x) * follow;
    this.y += (this.aimY - this.y) * follow;
    this.onSweep((x, y) => this.thrust(x, y, dt));
    if (this.hums.tick(dt)) this.onHum(BLACKHOLE.humSeconds, this.size);
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
    const { x, y, horizon, size } = this;
    this.warp(context, x, y, horizon, size);
    shade(context, x, y, this.reach * SHADE.reach, SHADE.alpha * size);
    radiate(context, x, y, horizon * LENS.reach, [[0, `rgba(${HALO},${0.35 * size})`], [1, `rgba(${HALO},0)`]]);
    context.save();
    context.translate(x, y);
    this.drawDisk(context, pixel, horizon, Math.PI, TAU);
    context.fillStyle = `rgb(${INK})`;
    context.beginPath();
    context.arc(0, 0, horizon, 0, TAU);
    context.fill();
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = PHOTON.width * pixel;
    context.strokeStyle = `rgba(${HOT},0.95)`;
    context.beginPath();
    context.arc(0, 0, horizon * PHOTON.reach, 0, TAU);
    context.stroke();
    this.drawDisk(context, pixel, horizon, 0, Math.PI);
    this.drawMotes(context, pixel);
    context.restore();
    radiate(context, x, y, horizon * PHOTON.reach * PHOTON.glow, [[0.55, `rgba(${HOT},0)`], [0.7, `rgba(${HOT},${0.5 * size})`], [1, `rgba(${DISK_OUTER},0)`]]);
  }

  warp(context, x, y, horizon, size) {
    const zoom = 1 + lerp(...LENS.zoom, size) / LENS.rings;
    const twist = (LENS.twist * size) / LENS.rings;
    for (let ring = 0; ring < LENS.rings; ring++) {
      lens(context, x, y, horizon * LENS.reach * (1 - (ring / LENS.rings) * LENS.taper), zoom, twist + Math.sin(this.time * LENS.drift) * twist);
    }
  }

  drawDisk(context, pixel, horizon, from, to) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.rotate(DISK.tilt);
    context.lineWidth = DISK.width * pixel;
    context.lineCap = 'round';
    for (let ring = 0; ring < DISK.rings; ring++) {
      const share = ring / (DISK.rings - 1);
      const radius = horizon * lerp(...DISK.reach, share);
      const heat = (1 - share) ** 0.7 * this.size;
      const tint = share < 0.35 ? DISK_INNER : DISK_OUTER;
      const doppler = context.createLinearGradient(-radius, 0, radius, 0);
      doppler.addColorStop(0, `rgba(${tint},${heat})`);
      doppler.addColorStop(1, `rgba(${tint},${heat * (1 - DISK.doppler)})`);
      context.strokeStyle = doppler;
      context.setLineDash([radius * DISK.dash[0], radius * DISK.dash[1]]);
      context.lineDashOffset = -this.time * DISK.spin * radius * (1.6 - share);
      context.beginPath();
      context.ellipse(0, 0, radius, radius * DISK.squash, 0, from, to);
      context.stroke();
    }
    context.restore();
  }

  drawMotes(context, pixel) {
    context.lineWidth = MOTE.width * pixel;
    context.lineCap = 'round';
    this.motes.forEach(({ angle, distance }) => {
      const heat = 1 - distance / this.reach;
      context.strokeStyle = `rgba(${heat > 0.6 ? DISK_INNER : DISK_OUTER},${0.35 + 0.6 * heat})`;
      context.beginPath();
      context.arc(0, 0, distance, angle - MOTE.trail * heat, angle);
      context.stroke();
    });
  }

  drawFlare(context, pixel, { x, y, radius, size, age }) {
    const t = age / BLACKHOLE.flareSeconds;
    const fading = 1 - t;
    const spread = radius * easeOut(t) * 1.4;
    lens(context, x, y, spread, 1 + FLARE.zoom * fading * size, 0);
    radiate(context, x, y, radius * clamp(t * 3, 0.15, 1) * FLARE.core * 3, [
      [0, `rgba(${HOT},${fading})`],
      [0.3, `rgba(${HALO},${0.7 * fading})`],
      [1, `rgba(${HALO},0)`],
    ]);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${HOT},${0.8 * fading})`;
    context.lineWidth = FLARE.ring * pixel * fading;
    context.beginPath();
    context.arc(x, y, spread, 0, TAU);
    context.stroke();
    context.restore();
  }
}
