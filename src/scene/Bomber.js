import { BOMB } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, easeOut, lerp } from '../core/math.js';
import { Bomb, drawBomb } from './Bomb.js';
import { Tool } from './Tool.js';

const PREVIEW_ALPHA = 0.55;
const BLAST_SECONDS = 0.45;
const FIREBALL_GROWTH = [0.5, 1.3];
const RING_WIDTH = 6;
const RING_ALPHA = 0.8;
const FIRE_CORE = '255,244,214';
const FIRE = '255,160,60';
const FIRE_EDGE = '190,60,20';

export class Bomber extends Tool {
  constructor(room, surface, { onStrike, onPlant, onTick }) {
    super(room);
    this.surface = surface;
    this.onStrike = onStrike;
    this.onPlant = onPlant;
    this.onTick = onTick;
    this.bombs = [];
    this.blasts = [];
  }

  get busy() {
    return this.bombs.length > 0 || this.blasts.length > 0;
  }

  get pending() {
    return this.bombs.length > 0;
  }

  get shown() {
    return this.present || this.busy;
  }

  windUp() {
    if (this.bombs.length >= BOMB.capacity) return;
    this.bombs.push(new Bomb(this.aimX, this.aimY, this.surface.grip(this.aimX, this.aimY, BOMB.size)));
    this.onPlant();
  }

  stow() {
    this.bombs = [];
    this.present = false;
  }

  update(dt) {
    this.blasts = this.blasts.filter((blast) => (blast.age += dt) < BLAST_SECONDS);
    this.bombs.forEach((bomb) => {
      if (bomb.update(dt, this.surface)) this.onTick();
    });
    const due = this.bombs.filter((bomb) => bomb.due);
    this.bombs = this.bombs.filter((bomb) => !bomb.due);
    due.forEach((bomb) => this.detonate(bomb));
  }

  detonate(bomb) {
    const blow = bomb.blow();
    this.blasts.push({ x: blow.x, y: blow.y, radius: blow.radius, reach: blow.blast.reach, age: 0 });
    this.onStrike(blow);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.forEach((blast) => this.drawBlast(context, pixel, blast));
    this.bombs.forEach((bomb) => bomb.draw(context, pixel));
    if (this.present) this.drawPreview(context, pixel);
  }

  drawPreview(context, pixel) {
    context.save();
    context.globalAlpha = PREVIEW_ALPHA;
    drawBomb(context, pixel, { x: this.aimX, y: this.aimY });
    context.restore();
  }

  drawBlast(context, pixel, { x, y, radius, reach, age }) {
    const fading = 1 - age / BLAST_SECONDS;
    const spread = easeOut(1 - fading);
    radiate(context, x, y, radius * lerp(...FIREBALL_GROWTH, spread), [
      [0, `rgba(${FIRE_CORE},${fading})`],
      [0.4, `rgba(${FIRE},${0.8 * fading * fading})`],
      [1, `rgba(${FIRE_EDGE},0)`],
    ]);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${FIRE_CORE},${RING_ALPHA * fading})`;
    context.lineWidth = RING_WIDTH * pixel * fading;
    context.beginPath();
    context.arc(x, y, reach * spread, 0, TAU);
    context.stroke();
    context.restore();
  }
}
