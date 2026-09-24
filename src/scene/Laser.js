import { LASER } from '../config.js';
import { inkOutline, radiate, steel, strokeLayers, traceRoundRect } from '../core/canvas.js';
import { TAU, clamp, normalize, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const BARREL = Object.freeze({ length: 0.07, width: 0.018 });
const HOUSING_RADIUS = 0.026;
const BRACKET_WIDTH = 0.05;
const POWER_RATE = 12;
const FLICKER = [0.8, 1.15];
const GLOW = Object.freeze({ width: 9, alpha: 0.4 });
const CORE_WIDTH = 2;
const SPOT_REACH = 0.028;
const LENS = '#ff3b30';
const RAY = '255,60,40';
const RAY_CORE = '255,236,230';

export class Laser extends Tool {
  constructor(room, surface, { onSear, onGlance, onHum }) {
    super(room);
    this.surface = surface;
    this.onSear = onSear;
    this.onGlance = onGlance;
    this.onHum = onHum;
    this.holding = false;
    this.searing = false;
    this.power = 0;
    this.end = null;
    this.sears = new Pulse(LASER.searSeconds);
    this.hums = new Pulse(LASER.humSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.power > 0;
  }

  get shown() {
    return this.active || this.busy;
  }

  get focus() {
    return this.searing ? { x: this.end.x, y: this.end.y, radius: LASER.radius, charge: LASER.tension } : null;
  }

  get base() {
    return [-this.room.halfWidth + LASER.mount, -this.room.height + LASER.mount];
  }

  get heading() {
    const [baseX, baseY] = this.base;
    return normalize(this.aimX - baseX, this.aimY - baseY);
  }

  get muzzle() {
    const [baseX, baseY] = this.base;
    const [dx, dy] = this.heading;
    return [baseX + dx * BARREL.length, baseY + dy * BARREL.length];
  }

  windUp() {
    this.holding = true;
    this.sears.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.power = 0;
    this.searing = false;
  }

  update(dt) {
    const firing = this.holding && this.present;
    this.power = clamp(this.power + (firing ? dt : -dt) * POWER_RATE, 0, 1);
    if (!firing) {
      this.searing = false;
      return;
    }
    const [x, y] = this.muzzle;
    const [dx, dy] = this.heading;
    const reach = this.room.reach(x, y, dx, dy);
    const hit = this.surface.raycast(x, y, x + dx * reach, y + dy * reach);
    this.end = hit ?? { x: x + dx * reach, y: y + dy * reach };
    if (this.hums.tick(dt)) this.onHum(LASER.humSeconds);
    if (!this.sears.tick(dt)) return;
    this.searing = hit ? this.onSear({ x: hit.x, y: hit.y, radius: LASER.radius, first: !this.searing }) : false;
    if (!hit) this.onGlance(this.end.x, this.end.y);
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    if (this.power > 0 && this.end) this.drawBeam(context, pixel);
    this.drawTurret(context, pixel);
  }

  drawBeam(context, pixel) {
    const [x, y] = this.muzzle;
    const { x: endX, y: endY } = this.end;
    const flicker = this.power * randomBetween(...FLICKER);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    strokeLayers(context, pixel * flicker, [[GLOW.width, `rgba(${RAY},${GLOW.alpha * this.power})`], [CORE_WIDTH, `rgba(${RAY_CORE},${this.power})`]]);
    context.restore();
    radiate(context, endX, endY, SPOT_REACH * flicker, [
      [0, `rgba(${RAY_CORE},${this.power})`],
      [0.35, `rgba(${RAY},${0.6 * this.power})`],
      [1, `rgba(${RAY},0)`],
    ]);
  }

  drawTurret(context, pixel) {
    const [baseX, baseY] = this.base;
    const [dx, dy] = this.heading;
    const drop = baseY + this.room.ceiling;
    context.save();
    context.translate(baseX, baseY);
    inkOutline(context, pixel);
    context.fillStyle = steel(context, -BRACKET_WIDTH / 2, 0, BRACKET_WIDTH / 2, 0);
    context.fillRect(-BRACKET_WIDTH / 2, -drop, BRACKET_WIDTH, drop);
    context.strokeRect(-BRACKET_WIDTH / 2, -drop, BRACKET_WIDTH, drop);
    context.rotate(Math.atan2(dy, dx));
    context.fillStyle = steel(context, 0, -BARREL.width / 2, 0, BARREL.width / 2);
    traceRoundRect(context, 0, -BARREL.width / 2, BARREL.length, BARREL.width, BARREL.width * 0.3);
    context.fill();
    context.stroke();
    context.fillStyle = LENS;
    context.fillRect(BARREL.length - BARREL.width * 0.3, -BARREL.width * 0.3, BARREL.width * 0.3, BARREL.width * 0.6);
    context.fillStyle = steel(context, -HOUSING_RADIUS, -HOUSING_RADIUS, HOUSING_RADIUS, HOUSING_RADIUS);
    context.beginPath();
    context.arc(0, 0, HOUSING_RADIUS, 0, TAU);
    context.fill();
    context.stroke();
    context.restore();
  }
}
