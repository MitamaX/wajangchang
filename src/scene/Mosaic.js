import { CELL_METERS, MOSAIC } from '../config.js';
import { easeOut, lerp, seededRandom } from '../core/math.js';
import { Tool } from './Tool.js';

const BLOCK = MOSAIC.block * CELL_METERS;
const NOISE = Object.freeze({ rate: 12, alpha: [0.15, 0.5], dark: '30,30,34', light: '220,220,226' });
const FRAME_WIDTH = 1.6;
const FLASH = Object.freeze({ growth: 0.15, fill: 0.35 });
const FRAME_INK = 'rgba(255,255,255,0.85)';
const GRID_INK = 'rgba(255,255,255,0.3)';
const FLASH_INK = '255,255,255';

export class Mosaic extends Tool {
  constructor(room, { onCensor, onGrow }) {
    super(room);
    this.onCensor = onCensor;
    this.onGrow = onGrow;
    this.holding = false;
    this.growth = 0;
    this.time = 0;
    this.flashes = [];
  }

  get busy() {
    return this.holding || this.flashes.length > 0;
  }

  get pending() {
    return this.holding;
  }

  get half() {
    return lerp(...MOSAIC.half, easeOut(this.growth));
  }

  get span() {
    return Math.ceil((this.half * 2) / BLOCK);
  }

  get focus() {
    return this.holding ? { x: this.aimX, y: this.aimY, radius: this.half, charge: lerp(...MOSAIC.tension, this.growth) } : null;
  }

  windUp() {
    this.holding = true;
    this.growth = 0;
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    const { aimX: x, aimY: y, half } = this;
    this.flashes.push({ x, y, half, age: 0 });
    this.onCensor({ x, y, half });
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.holding = false;
    this.flashes = [];
  }

  update(dt) {
    this.time += dt;
    this.flashes = this.flashes.filter((flash) => (flash.age += dt) < MOSAIC.flashSeconds);
    if (!this.holding) return;
    const { span } = this;
    this.growth = Math.min(1, this.growth + dt / MOSAIC.growSeconds);
    if (this.span > span) this.onGrow();
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.flashes.forEach((flash) => this.drawFlash(context, pixel, flash));
    if (this.present) this.drawCensor(context, pixel, this.holding ? this.half : MOSAIC.half[0]);
  }

  drawCensor(context, pixel, half) {
    const { aimX: x, aimY: y } = this;
    const count = Math.ceil((half * 2) / BLOCK);
    const size = (half * 2) / count;
    const left = x - half;
    const top = y - half;
    const random = seededRandom(Math.floor(this.time * NOISE.rate));
    context.save();
    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        context.fillStyle = `rgba(${random() < 0.5 ? NOISE.dark : NOISE.light},${lerp(...NOISE.alpha, random())})`;
        context.fillRect(left + column * size, top + row * size, size, size);
      }
    }
    context.strokeStyle = GRID_INK;
    context.lineWidth = pixel;
    context.beginPath();
    for (let line = 1; line < count; line++) {
      context.moveTo(left + line * size, top);
      context.lineTo(left + line * size, top + half * 2);
      context.moveTo(left, top + line * size);
      context.lineTo(left + half * 2, top + line * size);
    }
    context.stroke();
    context.strokeStyle = FRAME_INK;
    context.lineWidth = FRAME_WIDTH * pixel;
    context.strokeRect(left, top, half * 2, half * 2);
    context.restore();
  }

  drawFlash(context, pixel, { x, y, half, age }) {
    const fading = 1 - age / MOSAIC.flashSeconds;
    const reach = half * (1 + FLASH.growth * (1 - fading));
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = `rgba(${FLASH_INK},${FLASH.fill * fading})`;
    context.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    context.strokeStyle = `rgba(${FLASH_INK},${fading})`;
    context.lineWidth = FRAME_WIDTH * pixel;
    context.strokeRect(x - reach, y - reach, reach * 2, reach * 2);
    context.restore();
  }
}
