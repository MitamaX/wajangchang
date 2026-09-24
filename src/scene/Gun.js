import { radiate } from '../core/canvas.js';
import { TAU, clamp, lerp, polar, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RETICLE = Object.freeze({ width: 1.5, tick: 7, gap: 3, alpha: 0.8 });
const FLASH = Object.freeze({ reach: 0.03, rays: 6, rayLength: [0.4, 1], width: 1.6 });
const RETICLE_INK = '255,255,255';
const FLASH_CORE = '255,250,220';
const FLASH_FIRE = '255,190,90';

export class Gun extends Tool {
  constructor(room, config, { onFire }) {
    super(room);
    this.config = config;
    this.onFire = onFire;
    this.holding = false;
    this.heat = 0;
    this.rounds = new Pulse(1 / config.rate);
    this.flashes = [];
  }

  get busy() {
    return this.holding || this.flashes.length > 0;
  }

  get spread() {
    return lerp(...this.config.spread, this.heat);
  }

  windUp() {
    this.holding = true;
    this.rounds.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  update(dt) {
    const { flashSeconds, bloomSeconds, recovery, pellets } = this.config;
    this.flashes = this.flashes.filter((flash) => (flash.age += dt) < flashSeconds);
    const firing = this.holding && this.present;
    this.heat = clamp(this.heat + (firing ? dt / bloomSeconds : -dt * recovery), 0, 1);
    if (firing && this.rounds.tick(dt)) this.onFire(Array.from({ length: pellets }, () => this.round()));
  }

  round() {
    const [offsetX, offsetY] = polar(randomBetween(0, TAU), this.spread * Math.sqrt(Math.random()));
    const x = this.aimX + offsetX;
    const y = Math.min(0, this.aimY + offsetY);
    this.flashes.push({ x, y, age: 0, turn: randomBetween(0, TAU) });
    return { ...this.config.round, x, y };
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.flashes.forEach((flash) => this.drawFlash(context, pixel, flash));
    if (this.present) this.drawReticle(context, pixel);
  }

  drawReticle(context, pixel) {
    const { aimX: x, aimY: y } = this;
    const radius = this.spread + RETICLE.gap * pixel;
    context.save();
    context.strokeStyle = `rgba(${RETICLE_INK},${RETICLE.alpha})`;
    context.lineWidth = RETICLE.width * pixel;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    for (let arm = 0; arm < 4; arm++) {
      const [dx, dy] = polar((arm * TAU) / 4, 1);
      context.moveTo(x + dx * radius, y + dy * radius);
      context.lineTo(x + dx * (radius + RETICLE.tick * pixel), y + dy * (radius + RETICLE.tick * pixel));
    }
    context.stroke();
    context.restore();
  }

  drawFlash(context, pixel, { x, y, age, turn }) {
    const fading = 1 - age / this.config.flashSeconds;
    radiate(context, x, y, FLASH.reach * fading, [
      [0, `rgba(${FLASH_CORE},${fading})`],
      [0.4, `rgba(${FLASH_FIRE},${0.7 * fading})`],
      [1, `rgba(${FLASH_FIRE},0)`],
    ]);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${FLASH_CORE},${fading})`;
    context.lineWidth = FLASH.width * pixel;
    context.lineCap = 'round';
    context.beginPath();
    for (let ray = 0; ray < FLASH.rays; ray++) {
      const [dx, dy] = polar(turn + (ray * TAU) / FLASH.rays, FLASH.reach * lerp(...FLASH.rayLength, (ray % 2) * fading));
      context.moveTo(x, y);
      context.lineTo(x + dx, y + dy);
    }
    context.stroke();
    context.restore();
  }
}
