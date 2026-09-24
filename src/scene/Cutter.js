import { CUTTER } from '../config.js';
import { strokeLayers } from '../core/canvas.js';
import { TAU, clamp, easeIn, easeOut, lerp, polar } from '../core/math.js';
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
const RISE = 1.18;
const HOVER = Object.freeze({ alpha: 0.55, bob: 0.025, rate: 3 });
const SQUASH = Object.freeze({ seconds: 0.09, depth: 0.04 });
const WALL = Object.freeze({ depth: 0.012, layers: 5 });
const RIM = Object.freeze({ outline: 6.4, body: 4, shine: 1.2 });
const SHADOW = Object.freeze({ x: 0.05, y: 0.09, width: 9, alpha: 0.35 });
const FLASH = Object.freeze({ seconds: 0.18, width: 16, alpha: 0.7 });
const OUTLINE = 'rgba(0,0,0,0.5)';
const WALL_DARK = [72, 79, 86];
const WALL_LIGHT = [150, 158, 165];
const RIM_STEEL = '#dfe4e8';
const SHINE = 'rgba(255,255,255,0.9)';
const GLINT = '235,245,255';

function outlineAt(shape, x, y, scale) {
  const size = CUTTER.size * scale;
  return shape.map(([pointX, pointY]) => [x + pointX * size, y + pointY * size]);
}

function trace(context, outline, offsetX = 0, offsetY = 0) {
  context.beginPath();
  outline.forEach(([x, y]) => context.lineTo(x + offsetX, y + offsetY));
  context.closePath();
}

function paintShadow(context, pixel, outline, lift) {
  trace(context, outline, SHADOW.x * lift * CUTTER.size, SHADOW.y * lift * CUTTER.size);
  context.strokeStyle = `rgba(0,0,0,${SHADOW.alpha * (1 - lift / 2)})`;
  context.lineWidth = SHADOW.width * pixel;
  context.stroke();
}

function paintCutter(context, pixel, outline) {
  context.save();
  context.lineJoin = 'round';
  trace(context, outline, 0, WALL.depth);
  strokeLayers(context, pixel, [[RIM.outline, OUTLINE]]);
  for (let layer = WALL.layers; layer > 0; layer--) {
    const share = layer / WALL.layers;
    const shade = WALL_DARK.map((dark, i) => Math.round(lerp(WALL_LIGHT[i], dark, share)));
    trace(context, outline, 0, WALL.depth * share);
    context.strokeStyle = `rgb(${shade.join(',')})`;
    context.lineWidth = RIM.body * pixel;
    context.stroke();
  }
  trace(context, outline);
  strokeLayers(context, pixel, [[RIM.outline, OUTLINE], [RIM.body, RIM_STEEL]]);
  trace(context, outline, 0, -pixel * 0.6);
  strokeLayers(context, pixel, [[RIM.shine, SHINE]]);
  context.restore();
}

function paintFlash(context, pixel, outline, age) {
  const fading = 1 - age / FLASH.seconds;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineJoin = 'round';
  trace(context, outline);
  strokeLayers(context, pixel, [[FLASH.width * (1 + age / FLASH.seconds), `rgba(${GLINT},${FLASH.alpha * fading * 0.4})`], [FLASH.width * 0.35, `rgba(${GLINT},${FLASH.alpha * fading})`]]);
  context.restore();
}

export class Cutter extends Tool {
  constructor(room, { onStamp }) {
    super(room);
    this.onStamp = onStamp;
    this.turn = 0;
    this.time = 0;
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
    this.time += dt;
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

  pose({ age }) {
    const since = age - CUTTER.pressSeconds;
    if (since < 0) return { scale: lerp(LIFT, 1, easeIn(age / CUTTER.pressSeconds)), lift: 1 - age / CUTTER.pressSeconds, alpha: 1 };
    const squash = SQUASH.depth * Math.max(0, 1 - since / SQUASH.seconds);
    const rising = clamp((since - CUTTER.holdSeconds) / CUTTER.fadeSeconds, 0, 1);
    return { scale: lerp(1, RISE, easeOut(rising)) - squash, lift: rising, alpha: 1 - rising };
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    const { press } = this;
    if (press) {
      const { scale, lift, alpha } = this.pose(press);
      const outline = outlineAt(press.shape, press.x, press.y, scale);
      context.save();
      context.globalAlpha = alpha;
      if (lift > 0) paintShadow(context, pixel, outline, lift);
      paintCutter(context, pixel, outline);
      context.restore();
      const since = press.age - CUTTER.pressSeconds;
      if (since >= 0 && since < FLASH.seconds) paintFlash(context, pixel, outlineAt(press.shape, press.x, press.y, 1), since);
      return;
    }
    if (!this.present) return;
    const outline = outlineAt(this.shape, this.aimX, this.aimY - HOVER.bob * CUTTER.size * (1 + Math.sin(this.time * HOVER.rate)), 1);
    context.save();
    context.globalAlpha = HOVER.alpha;
    paintShadow(context, pixel, outline, 1);
    paintCutter(context, pixel, outline);
    context.restore();
  }
}
