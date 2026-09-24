import { KATANA } from '../config.js';
import { paintReticle } from '../core/canvas.js';
import { easeOut, lerp, normalize, randomBetween } from '../core/math.js';
import { Tool } from './Tool.js';

const TRAIL_WIDTH = 1.5;
const TRAIL_DASH = 6;
const SETTLED_WIDTH = 0.35;
const FLICKER = [0.8, 1];
const AFTERGLOW_SWELL = 1.6;
const SLASH_GLOW_BLUR = 12;
const TRAIL = 'rgba(255,255,255,0.45)';
const SLASH_GLOW = 'rgba(180,220,255,0.9)';

function paintSlash(context, { ax, ay, bx, by }, reach, width, alpha) {
  const endX = lerp(ax, bx, reach);
  const endY = lerp(ay, by, reach);
  const [normalX, normalY] = normalize(ay - by, bx - ax);
  const middleX = (ax + endX) / 2;
  const middleY = (ay + endY) / 2;
  context.fillStyle = `rgba(255,255,255,${alpha})`;
  context.beginPath();
  context.moveTo(ax, ay);
  context.lineTo(middleX + normalX * width, middleY + normalY * width);
  context.lineTo(endX, endY);
  context.lineTo(middleX - normalX * width, middleY - normalY * width);
  context.closePath();
  context.fill();
}

export class Katana extends Tool {
  constructor(room, { onSlash, onSever }) {
    super(room);
    this.onSlash = onSlash;
    this.onSever = onSever;
    this.from = null;
    this.slashes = [];
    this.queue = [];
    this.glows = [];
    this.wait = 0;
    this.beat = 0;
    this.severed = 0;
  }

  get drawing() {
    return this.from !== null;
  }

  get pending() {
    return this.slashes.length > 0 || this.queue.length > 0;
  }

  get freezing() {
    return this.pending;
  }

  get busy() {
    return this.drawing || this.pending || this.glows.length > 0;
  }

  get tempo() {
    const composing = this.drawing || (this.slashes.length > 0 && this.wait > KATANA.pause);
    return composing ? KATANA.tempo : 1;
  }

  get focus() {
    const last = this.slashes.at(-1) || this.queue.at(-1);
    return last ? { x: (last.ax + last.bx) / 2, y: (last.ay + last.by) / 2, radius: 0, charge: KATANA.tension } : null;
  }

  windUp() {
    this.from = [this.aimX, this.aimY];
  }

  release() {
    if (!this.drawing) return;
    const [ax, ay] = this.from;
    const { aimX: bx, aimY: by } = this;
    this.from = null;
    if (Math.hypot(bx - ax, by - ay) < KATANA.minLength) return;
    const line = { ax, ay, bx, by };
    this.slashes.push({ ...line, age: 0, marks: this.onSlash(line) });
    this.wait = KATANA.delay;
  }

  cancel() {
    this.from = null;
  }

  stow() {
    this.from = null;
    this.slashes = [];
    this.queue = [];
    this.glows = [];
    this.present = false;
  }

  update(dt) {
    [...this.slashes, ...this.queue].forEach((slash) => {
      slash.age += dt;
    });
    this.glows = this.glows.filter((glow) => (glow.age += dt) < KATANA.afterglow);
    if (this.queue.length) this.cascade(dt);
    else if (this.slashes.length && !this.drawing) this.countdown(dt);
  }

  countdown(dt) {
    this.wait -= dt;
    if (this.wait > 0) return;
    this.queue = this.slashes;
    this.slashes = [];
    this.beat = 0;
    this.severed = 0;
    this.cascade(0);
  }

  cascade(dt) {
    this.beat -= dt;
    if (this.beat > 0) return;
    const slash = this.queue.shift();
    this.glows.push({ ...slash, age: 0 });
    this.onSever(slash.marks);
    this.beat = Math.max(0, this.beat + KATANA.cadence * KATANA.quickening ** Math.max(0, this.severed - KATANA.steadyCuts));
    this.severed++;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.drawSlashes(context);
    if (this.drawing) this.drawTrail(context, pixel);
    if (this.present && !this.drawing) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawSlashes(context) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.shadowColor = SLASH_GLOW;
    context.shadowBlur = SLASH_GLOW_BLUR;
    this.glows.forEach((glow) => {
      const fading = 1 - glow.age / KATANA.afterglow;
      paintSlash(context, glow, 1, KATANA.width * AFTERGLOW_SWELL * fading, fading);
    });
    [...this.slashes, ...this.queue].forEach((slash) => {
      const drawn = slash.age / KATANA.drawIn;
      const width = drawn < 1 ? 1 : SETTLED_WIDTH * randomBetween(...FLICKER);
      paintSlash(context, slash, easeOut(Math.min(1, drawn)), KATANA.width * width, 1);
    });
    context.restore();
  }

  drawTrail(context, pixel) {
    const [fromX, fromY] = this.from;
    context.save();
    context.strokeStyle = TRAIL;
    context.lineWidth = TRAIL_WIDTH * pixel;
    context.setLineDash([TRAIL_DASH * pixel, TRAIL_DASH * pixel]);
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(this.aimX, this.aimY);
    context.stroke();
    context.restore();
  }
}
