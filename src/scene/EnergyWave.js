import { WAVE } from '../config.js';
import { paintReticle, radiate, strokeLayers } from '../core/canvas.js';
import { lerp, normalize } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const GATHER_SECONDS = 0.15;
const BALL_SHARE = 1.4;
const CORE_SHARE = 0.35;
const ENERGY = '110,200,255';
const ENERGY_CORE = '240,250,255';

export class EnergyWave extends Tool {
  constructor(room, { onFire, onGather }) {
    super(room);
    this.onFire = onFire;
    this.onGather = onGather;
    this.charging = false;
    this.charge = 0;
    this.beam = null;
    this.gathers = new Pulse(GATHER_SECONDS);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.charging || this.beam !== null;
  }

  get pending() {
    return this.charging;
  }

  get shown() {
    return this.active || this.busy;
  }

  get radius() {
    return lerp(...WAVE.radius, this.charge);
  }

  get muzzle() {
    const side = this.aimX >= 0 ? -1 : 1;
    return [side * (this.room.halfWidth - WAVE.inset), -WAVE.height];
  }

  get focus() {
    if (!this.charging) return null;
    const [x, y] = this.muzzle;
    return { x, y, radius: this.radius, charge: lerp(...WAVE.tension, this.charge) };
  }

  windUp() {
    this.charging = true;
    this.charge = 0;
  }

  release() {
    if (this.charging) this.fire();
  }

  cancel() {
    this.charging = false;
  }

  stow() {
    super.stow();
    this.charging = false;
    this.beam = null;
  }

  update(dt) {
    if (this.beam && (this.beam.age += dt) >= WAVE.fireSeconds) this.beam = null;
    if (!this.charging) return;
    this.charge = Math.min(1, this.charge + dt / WAVE.chargeSeconds);
    if (this.gathers.tick(dt)) this.onGather(GATHER_SECONDS);
  }

  fire() {
    const [ax, ay] = this.muzzle;
    const [dx, dy] = normalize(this.aimX - ax, this.aimY - ay);
    const reach = this.room.reach(ax, ay, dx, dy);
    const line = { ax, ay, bx: ax + dx * reach, by: ay + dy * reach };
    const { charge, radius } = this;
    this.charging = false;
    this.beam = { ...line, radius, age: 0 };
    this.onFire(line, {
      radius,
      strength: lerp(...WAVE.strength, charge),
      push: lerp(...WAVE.push, charge),
      heft: WAVE.heft,
      spray: WAVE.spray,
      burst: WAVE.burst,
      cue: WAVE.cue,
      force: charge,
      shock: WAVE.shock,
    });
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    if (this.beam) this.drawBeam(context, this.beam);
    const [x, y] = this.muzzle;
    const glow = this.charging ? this.charge : 0.15;
    radiate(context, x, y, Math.max(WAVE.radius[0], this.radius) * BALL_SHARE * (0.6 + glow), [
      [0, `rgba(${ENERGY_CORE},${0.4 + 0.6 * glow})`],
      [CORE_SHARE, `rgba(${ENERGY},${0.7 * glow})`],
      [1, `rgba(${ENERGY},0)`],
    ]);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawBeam(context, { ax, ay, bx, by, radius, age }) {
    const fading = 1 - age / WAVE.fireSeconds;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(ax, ay);
    context.lineTo(bx, by);
    strokeLayers(context, 1, [[radius * 2.4 * fading, `rgba(${ENERGY},${0.45 * fading})`], [radius * fading, `rgba(${ENERGY_CORE},${fading})`]]);
    context.restore();
  }
}
