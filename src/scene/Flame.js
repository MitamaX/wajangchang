import { FLAME } from '../config.js';
import { createCanvas, paintReticle, radiate } from '../core/canvas.js';
import { clamp, lerp, normalize, randomBetween, randomSign } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const [AIM_X, AIM_Y] = normalize(...FLAME.heading);
const [SIDE_X, SIDE_Y] = [-AIM_Y, AIM_X];
const HEADING = Math.atan2(AIM_Y, AIM_X);
const NOZZLE = Object.freeze({ length: 0.09, width: 0.022, pilot: 0.008, muzzle: 0.03 });
const OUTLINE_WIDTH = 1.2;
const OUTLINE = 'rgba(0,0,0,0.5)';
const BARREL = '#3a3d41';
const PILOT = '120,190,255';
const SPRITE_SIZE = 64;
const SPRITE_STEPS = 16;
const HEAT_RAMP = [
  { at: 0, core: [255, 255, 240], rim: [255, 214, 120] },
  { at: 0.3, core: [255, 226, 130], rim: [255, 140, 40] },
  { at: 0.6, core: [255, 150, 50], rim: [210, 70, 20] },
  { at: 1, core: [150, 50, 20], rim: [60, 16, 6] },
];
const CORE_STOPS = [
  [0, 'rgba(255,255,250,1)'],
  [0.5, 'rgba(255,230,150,0.8)'],
  [1, 'rgba(255,150,50,0)'],
];

const mix = (from, to, share) => from.map((value, i) => Math.round(lerp(value, to[i], share)));

function heatAt(cooled) {
  const upper = Math.max(1, HEAT_RAMP.findIndex(({ at }) => at >= cooled));
  const from = HEAT_RAMP[upper - 1];
  const to = HEAT_RAMP[upper];
  const share = (cooled - from.at) / (to.at - from.at);
  return { core: mix(from.core, to.core, share), rim: mix(from.rim, to.rim, share) };
}

function paintSprite({ core, rim }) {
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const context = canvas.getContext('2d');
  const half = SPRITE_SIZE / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, `rgba(${core.join(',')},1)`);
  gradient.addColorStop(0.4, `rgba(${rim.join(',')},0.55)`);
  gradient.addColorStop(1, `rgba(${rim.join(',')},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

let sprites = null;

function heatSprites() {
  sprites ??= Array.from({ length: SPRITE_STEPS }, (_, i) => paintSprite(heatAt(i / (SPRITE_STEPS - 1))));
  return sprites;
}

const flicker = () => 1 + randomBetween(-FLAME.flicker, FLAME.flicker);

export class Flame extends Tool {
  constructor(room, { onIgnite, onScorch, onRoar }) {
    super(room);
    this.onIgnite = onIgnite;
    this.onScorch = onScorch;
    this.onRoar = onRoar;
    this.holding = false;
    this.touching = false;
    this.ignition = 0;
    this.contact = null;
    this.flames = [];
    this.glows = [];
    this.backlog = 0;
    this.reach = Infinity;
    this.scorches = new Pulse(FLAME.scorchSeconds);
    this.roars = new Pulse(FLAME.roarSeconds);
  }

  get nozzleX() {
    return this.aimX - AIM_X * FLAME.lead;
  }

  get nozzleY() {
    return this.aimY - AIM_Y * FLAME.lead;
  }

  get busy() {
    return this.holding || this.flames.length > 0 || this.glows.length > 0;
  }

  get shown() {
    return this.present || this.busy;
  }

  get focus() {
    if (!this.holding) return null;
    const { x, y } = this.contact ?? { x: this.aimX, y: this.aimY };
    return { x, y, radius: 0, charge: this.contact ? FLAME.tension.burning : FLAME.tension.idle };
  }

  windUp() {
    this.holding = true;
    this.touching = false;
    this.scorches.reset();
    this.roars.reset();
    this.onIgnite();
    for (let i = 0; i < FLAME.puff; i++) this.flames.push(this.spawn(FLAME.puffSpread));
  }

  release() {
    this.holding = false;
    this.contact = null;
    this.reach = Infinity;
  }

  cancel() {
    this.release();
  }

  stow() {
    this.release();
    this.present = false;
    this.ignition = 0;
    this.flames = [];
    this.glows = [];
  }

  update(dt) {
    this.ignition = clamp(this.ignition + (this.holding ? dt : -dt) / FLAME.igniteSeconds, 0, 1);
    if (this.holding) this.fire(dt);
    this.flames = this.flames.filter((flame) => this.burn(flame, dt));
    this.glows = this.glows.filter((glow) => this.cool(glow, dt));
  }

  fire(dt) {
    if (this.roars.tick(dt)) this.onRoar(this.contact !== null);
    this.backlog += FLAME.rate * dt;
    for (; this.backlog >= 1; this.backlog--) this.flames.push(this.spawn(FLAME.spread));
    if (this.scorches.tick(dt)) this.scorch();
  }

  scorch() {
    const { nozzleX: ax, nozzleY: ay } = this;
    const length = (FLAME.lead + FLAME.reach) * this.ignition;
    this.contact = this.onScorch({ ax, ay, bx: ax + AIM_X * length, by: ay + AIM_Y * length, first: !this.touching });
    this.touching = this.touching || this.contact !== null;
    this.reach = this.contact ? Math.hypot(this.contact.x - ax, this.contact.y - ay) : Infinity;
    if (this.contact) this.glows.push({ x: this.contact.x, y: this.contact.y, heat: 1 });
  }

  spawn(spread) {
    const speed = randomBetween(...FLAME.speed);
    const bend = randomBetween(-spread, spread);
    return {
      x: this.nozzleX,
      y: this.nozzleY,
      vx: (AIM_X + SIDE_X * bend) * speed,
      vy: (AIM_Y + SIDE_Y * bend) * speed,
      travelled: 0,
      splashed: false,
      scale: randomBetween(...FLAME.swell),
      age: 0,
      life: randomBetween(...FLAME.life),
    };
  }

  burn(flame, dt) {
    flame.age += dt;
    if (flame.age >= flame.life) return false;
    const drag = Math.max(0, 1 - FLAME.drag * dt);
    flame.vx *= drag;
    flame.vy = flame.vy * drag - FLAME.buoyancy * dt;
    flame.x += flame.vx * dt;
    flame.y += flame.vy * dt;
    flame.travelled += Math.hypot(flame.vx, flame.vy) * dt;
    if (!flame.splashed && flame.travelled >= this.reach) this.splash(flame);
    return true;
  }

  splash(flame) {
    const speed = Math.hypot(flame.vx, flame.vy) * FLAME.splash;
    const side = randomSign() * randomBetween(0.3, 1);
    flame.splashed = true;
    flame.scale *= FLAME.billow;
    flame.vx = (SIDE_X * side - AIM_X * FLAME.rebound) * speed;
    flame.vy = (SIDE_Y * side - AIM_Y * FLAME.rebound) * speed;
  }

  cool(glow, dt) {
    glow.heat -= FLAME.glow.cooling * dt;
    return glow.heat > 0;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.globalCompositeOperation = 'lighter';
    this.glows.forEach(({ x, y, heat }) => this.blit(context, 1 - heat, x, y, FLAME.glow.radius, heat));
    this.flames.forEach((flame) => this.drawFlame(context, flame));
    if (this.ignition > 0) this.drawCore(context);
    if (this.contact) this.blit(context, 0, this.contact.x, this.contact.y, FLAME.flare * flicker(), this.ignition);
    context.restore();
    if (!this.present) return;
    this.drawNozzle(context, pixel);
    if (!this.holding) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  blit(context, cooled, x, y, radius, alpha) {
    const steps = heatSprites();
    context.globalAlpha = alpha;
    context.drawImage(steps[Math.min(SPRITE_STEPS - 1, Math.floor(cooled * SPRITE_STEPS))], x - radius, y - radius, radius * 2, radius * 2);
  }

  drawFlame(context, { x, y, age, life, scale }) {
    const t = age / life;
    this.blit(context, t, x, y, lerp(...FLAME.size, t) * scale, 1 - t);
  }

  drawCore(context) {
    const length = FLAME.core * this.ignition * flicker();
    const [near, far] = FLAME.coreWidth;
    const gradient = context.createLinearGradient(0, 0, length, 0);
    CORE_STOPS.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    context.save();
    context.translate(this.nozzleX, this.nozzleY);
    context.rotate(HEADING);
    context.globalAlpha = this.ignition;
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(0, -near / 2);
    context.quadraticCurveTo(length / 2, -far / 2, length, 0);
    context.quadraticCurveTo(length / 2, far / 2, 0, near / 2);
    context.closePath();
    context.fill();
    context.restore();
    this.blit(context, 0, this.nozzleX, this.nozzleY, NOZZLE.muzzle * flicker(), this.ignition);
  }

  drawNozzle(context, pixel) {
    context.save();
    context.translate(this.nozzleX, this.nozzleY);
    context.rotate(HEADING);
    context.fillStyle = BARREL;
    context.strokeStyle = OUTLINE;
    context.lineWidth = OUTLINE_WIDTH * pixel;
    context.fillRect(-NOZZLE.length, -NOZZLE.width / 2, NOZZLE.length, NOZZLE.width);
    context.strokeRect(-NOZZLE.length, -NOZZLE.width / 2, NOZZLE.length, NOZZLE.width);
    context.restore();
    if (!this.holding) radiate(context, this.nozzleX, this.nozzleY, NOZZLE.pilot, [[0, `rgba(${PILOT},0.9)`], [1, `rgba(${PILOT},0)`]]);
  }
}
