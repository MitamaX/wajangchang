import { inkOutline, steel } from '../core/canvas.js';
import { clamp, normalize } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const POWER_RATE = 12;
const BRACKET_WIDTH = 0.05;

export class Ray extends Tool {
  constructor(room, surface, config, tickSeconds, onHum) {
    super(room);
    this.surface = surface;
    this.config = config;
    this.onHum = onHum;
    this.holding = false;
    this.landing = false;
    this.power = 0;
    this.end = null;
    this.ticks = new Pulse(tickSeconds);
    this.hums = new Pulse(config.humSeconds);
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
    const { end, config } = this;
    return this.landing ? { x: end.x, y: end.y, radius: config.radius, charge: config.tension } : null;
  }

  get heading() {
    const [baseX, baseY] = this.base;
    return normalize(this.aimX - baseX, this.aimY - baseY);
  }

  get muzzle() {
    const [baseX, baseY] = this.base;
    const [dx, dy] = this.heading;
    return [baseX + dx * this.barrel, baseY + dy * this.barrel];
  }

  windUp() {
    this.holding = true;
    this.ticks.reset();
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
    this.landing = false;
  }

  update(dt) {
    const firing = this.holding && this.present;
    this.power = clamp(this.power + (firing ? dt : -dt) * POWER_RATE, 0, 1);
    if (!firing) {
      this.landing = false;
      return;
    }
    const [x, y] = this.muzzle;
    const [dx, dy] = this.heading;
    const reach = this.room.reach(x, y, dx, dy);
    const hit = this.surface.raycast(x, y, x + dx * reach, y + dy * reach);
    this.end = hit ?? { x: x + dx * reach, y: y + dy * reach };
    if (this.hums.tick(dt)) this.onHum(this.config.humSeconds);
    if (!this.ticks.tick(dt)) return;
    this.landing = hit ? this.land(hit, !this.landing) : false;
    if (!hit) this.miss(this.end);
  }

  miss() {}

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    if (this.power > 0 && this.end) this.drawBeam(context, pixel);
    this.drawTurret(context, pixel);
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
    this.paintHead(context);
    context.restore();
  }
}
