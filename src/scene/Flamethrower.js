import { FLAME } from '../config.js';
import { paintReticle, radiate } from '../core/canvas.js';
import { lerp, normalize, randomBetween, randomSign } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const [AIM_X, AIM_Y] = normalize(...FLAME.heading);
const [SIDE_X, SIDE_Y] = [-AIM_Y, AIM_X];
const NOZZLE = Object.freeze({ length: 0.07, width: 0.016, pilot: 0.008 });
const OUTLINE_WIDTH = 1.2;
const OUTLINE = 'rgba(0,0,0,0.5)';
const BARREL = '#3a3d41';
const PILOT = '120,190,255';
const FLAME_TIERS = [
  { until: 0.2, core: '255,246,200', rim: '255,190,80' },
  { until: 0.55, core: '255,190,70', rim: '255,110,30' },
  { until: 1, core: '230,90,30', rim: '120,30,10' },
];

export class Flamethrower extends Tool {
  constructor(room, { onScorch, onRoar }) {
    super(room);
    this.onScorch = onScorch;
    this.onRoar = onRoar;
    this.holding = false;
    this.touching = false;
    this.flames = [];
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
    return this.holding || this.flames.length > 0;
  }

  get shown() {
    return this.present || this.busy;
  }

  get focus() {
    return this.holding ? { x: this.aimX, y: this.aimY, radius: 0, charge: FLAME.tension } : null;
  }

  windUp() {
    this.holding = true;
    this.touching = false;
    this.scorches.reset();
    this.roars.reset();
  }

  release() {
    this.holding = false;
    this.reach = Infinity;
  }

  cancel() {
    this.release();
  }

  stow() {
    this.release();
    this.present = false;
    this.flames = [];
  }

  update(dt) {
    if (this.holding) this.fire(dt);
    this.flames = this.flames.filter((flame) => this.burn(flame, dt));
  }

  fire(dt) {
    if (this.roars.tick(dt)) this.onRoar();
    this.backlog += FLAME.rate * dt;
    for (; this.backlog >= 1; this.backlog--) this.flames.push(this.spawn());
    if (!this.scorches.tick(dt)) return;
    const length = FLAME.lead + FLAME.reach;
    const hit = this.onScorch({
      ax: this.nozzleX,
      ay: this.nozzleY,
      bx: this.nozzleX + AIM_X * length,
      by: this.nozzleY + AIM_Y * length,
      first: !this.touching,
    });
    this.touching = this.touching || Boolean(hit);
    this.reach = hit ? Math.hypot(hit.x - this.nozzleX, hit.y - this.nozzleY) : Infinity;
  }

  spawn() {
    const speed = randomBetween(...FLAME.speed);
    const spread = randomBetween(-FLAME.spread, FLAME.spread);
    return {
      x: this.nozzleX,
      y: this.nozzleY,
      vx: (AIM_X + SIDE_X * spread) * speed,
      vy: (AIM_Y + SIDE_Y * spread) * speed,
      travelled: 0,
      splashed: false,
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
    const side = randomSign();
    flame.splashed = true;
    flame.vx = (SIDE_X * side - AIM_X * FLAME.rebound) * speed;
    flame.vy = (SIDE_Y * side - AIM_Y * FLAME.rebound) * speed;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.flames.forEach((flame) => this.drawFlame(context, flame));
    if (!this.present) return;
    this.drawNozzle(context, pixel);
    if (!this.holding) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawFlame(context, { x, y, age, life }) {
    const t = age / life;
    const tier = FLAME_TIERS.find(({ until }) => t <= until);
    const alpha = 1 - t;
    radiate(context, x, y, lerp(...FLAME.size, t), [
      [0, `rgba(${tier.core},${alpha})`],
      [0.45, `rgba(${tier.rim},${alpha * 0.55})`],
      [1, `rgba(${tier.rim},0)`],
    ]);
  }

  drawNozzle(context, pixel) {
    context.save();
    context.translate(this.nozzleX, this.nozzleY);
    context.rotate(Math.atan2(AIM_Y, AIM_X));
    context.fillStyle = BARREL;
    context.strokeStyle = OUTLINE;
    context.lineWidth = OUTLINE_WIDTH * pixel;
    context.fillRect(-NOZZLE.length, -NOZZLE.width / 2, NOZZLE.length, NOZZLE.width);
    context.strokeRect(-NOZZLE.length, -NOZZLE.width / 2, NOZZLE.length, NOZZLE.width);
    context.restore();
    if (!this.holding) radiate(context, this.nozzleX, this.nozzleY, NOZZLE.pilot, [[0, `rgba(${PILOT},0.9)`], [1, `rgba(${PILOT},0)`]]);
  }
}
