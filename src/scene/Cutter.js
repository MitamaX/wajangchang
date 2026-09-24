import { CUTTER } from '../config.js';
import { strokeLayers } from '../core/canvas.js';
import { TAU, clamp, easeIn, lerp, polar } from '../core/math.js';
import { Tool } from './Tool.js';

const STAR = Array.from({ length: 10 }, (_, corner) => polar(-Math.PI / 2 + (corner * Math.PI) / 5, corner % 2 ? 0.42 : 1));
const HEART = Array.from({ length: 32 }, (_, step) => {
  const t = (step / 32) * TAU;
  return [(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - 0.13];
});
const GINGER_SIDE = [
  [0.18, -0.93], [0.31, -0.8], [0.36, -0.62], [0.31, -0.44], [0.21, -0.33], [0.17, -0.3], [0.3, -0.26], [0.62, -0.3],
  [0.74, -0.26], [0.8, -0.16], [0.76, -0.06], [0.64, -0.03], [0.32, -0.02], [0.33, 0.28], [0.44, 0.72], [0.5, 0.86],
  [0.44, 0.97], [0.32, 0.98], [0.22, 0.72], [0.08, 0.44],
];
const GINGERBREAD = [[0, -0.98], ...GINGER_SIDE, [0, 0.42], ...GINGER_SIDE.map(([x, y]) => [-x, y]).reverse()];
const SHAPES = [STAR, HEART, GINGERBREAD];
const LIFT = 1.35;
const PREVIEW_ALPHA = 0.5;
const RIM = Object.freeze({ outline: 6.4, body: 4, shine: 1.2 });
const OUTLINE = 'rgba(0,0,0,0.5)';
const STEEL = '#c3c9ce';
const SHINE = 'rgba(255,255,255,0.85)';

function outlineAt(shape, x, y, scale) {
  const size = CUTTER.size * scale;
  return shape.map(([pointX, pointY]) => [x + pointX * size, y + pointY * size]);
}

function paintCutter(context, pixel, outline) {
  context.save();
  context.lineJoin = 'round';
  context.beginPath();
  outline.forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
  strokeLayers(context, pixel, [[RIM.outline, OUTLINE], [RIM.body, STEEL], [RIM.shine, SHINE]]);
  context.restore();
}

export class Cutter extends Tool {
  constructor(room, { onStamp }) {
    super(room);
    this.onStamp = onStamp;
    this.turn = 0;
    this.press = null;
  }

  get shape() {
    return SHAPES[this.turn % SHAPES.length];
  }

  get busy() {
    return this.press !== null;
  }

  get pending() {
    return this.busy && !this.press.stamped;
  }

  get lifetime() {
    return CUTTER.pressSeconds + CUTTER.holdSeconds + CUTTER.fadeSeconds;
  }

  windUp() {
    if (this.press) return;
    this.press = { x: this.aimX, y: this.aimY, shape: this.shape, age: 0, stamped: false };
  }

  stow() {
    super.stow();
    this.press = null;
  }

  update(dt) {
    const { press } = this;
    if (!press) return;
    press.age += dt;
    if (!press.stamped && press.age >= CUTTER.pressSeconds) {
      press.stamped = true;
      this.turn++;
      this.onStamp(outlineAt(press.shape, press.x, press.y, 1));
    }
    if (press.age >= this.lifetime) this.press = null;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    const { press } = this;
    if (press) {
      const scale = lerp(LIFT, 1, easeIn(Math.min(1, press.age / CUTTER.pressSeconds)));
      context.save();
      context.globalAlpha = clamp((this.lifetime - press.age) / CUTTER.fadeSeconds, 0, 1);
      paintCutter(context, pixel, outlineAt(press.shape, press.x, press.y, scale));
      context.restore();
      return;
    }
    if (!this.present) return;
    context.save();
    context.globalAlpha = PREVIEW_ALPHA;
    paintCutter(context, pixel, outlineAt(this.shape, this.aimX, this.aimY, 1));
    context.restore();
  }
}
