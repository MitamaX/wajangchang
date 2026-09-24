import { BOMB, GRAVITY } from '../config.js';
import { radiate, traceRoundRect } from '../core/canvas.js';
import { TAU, lerp, randomBetween } from '../core/math.js';

const SIZE = BOMB.size;
const BLINK_DUTY = 0.5;
const OUTLINE_WIDTH = 1.2;
const FUSE_WIDTH = 2.2;
const FUSE_STEPS = 12;
const FUSE = [[0, -1.15], [0.05, -1.75], [0.7, -1.8]].map(([x, y]) => [x * SIZE, y * SIZE]);
const COLLAR = Object.freeze({ width: SIZE * 0.52, height: SIZE * 0.32, top: -SIZE * 1.18 });
const LAMP = Object.freeze({ x: 0, y: SIZE * 0.12, radius: SIZE * 0.17, halo: SIZE * 0.9 });
const SPARK = Object.freeze({ reach: SIZE * 0.7, rays: 5, rayLength: [0.2, 0.55], flicker: [0.7, 1.1], width: 1.2 });
const OUTLINE = 'rgba(0,0,0,0.5)';
const CORD = '#c9a46b';
const COLLAR_METAL = '#5b6166';
const LAMP_ON = '#ff4b3a';
const LAMP_OFF = '#4a1814';
const LAMP_GLOW = '255,80,60';
const EMBER = '255,190,90';
const FLAME = '255,120,40';
const WHITE_HOT = '255,245,200';

function fusePoint(t) {
  const [[ax, ay], [bx, by], [cx, cy]] = FUSE;
  const u = 1 - t;
  return [u * u * ax + 2 * u * t * bx + t * t * cx, u * u * ay + 2 * u * t * by + t * t * cy];
}

function paintShell(context, pixel) {
  const shade = context.createRadialGradient(-SIZE * 0.35, -SIZE * 0.4, SIZE * 0.05, 0, 0, SIZE);
  shade.addColorStop(0, '#6b7178');
  shade.addColorStop(0.35, '#2a2d32');
  shade.addColorStop(1, '#0c0d0f');
  context.fillStyle = shade;
  context.strokeStyle = OUTLINE;
  context.lineWidth = OUTLINE_WIDTH * pixel;
  context.beginPath();
  context.arc(0, 0, SIZE, 0, TAU);
  context.fill();
  context.stroke();
  context.fillStyle = COLLAR_METAL;
  traceRoundRect(context, -COLLAR.width / 2, COLLAR.top, COLLAR.width, COLLAR.height, COLLAR.height * 0.3);
  context.fill();
  context.stroke();
}

function paintLamp(context, lit) {
  context.fillStyle = lit ? LAMP_ON : LAMP_OFF;
  context.beginPath();
  context.arc(LAMP.x, LAMP.y, LAMP.radius, 0, TAU);
  context.fill();
  if (lit) radiate(context, LAMP.x, LAMP.y, LAMP.halo, [[0, `rgba(${LAMP_GLOW},0.9)`], [1, `rgba(${LAMP_GLOW},0)`]]);
}

function paintFuse(context, pixel, remaining) {
  context.strokeStyle = CORD;
  context.lineWidth = FUSE_WIDTH * pixel;
  context.lineCap = 'round';
  context.beginPath();
  for (let i = 0; i <= FUSE_STEPS; i++) context.lineTo(...fusePoint((remaining * i) / FUSE_STEPS));
  context.stroke();
  return fusePoint(remaining);
}

function paintSpark(context, pixel, x, y) {
  radiate(context, x, y, SPARK.reach * randomBetween(...SPARK.flicker), [
    [0, `rgba(${WHITE_HOT},0.95)`],
    [0.3, `rgba(${EMBER},0.7)`],
    [1, `rgba(${FLAME},0)`],
  ]);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = `rgba(${EMBER},0.9)`;
  context.lineWidth = SPARK.width * pixel;
  context.beginPath();
  for (let i = 0; i < SPARK.rays; i++) {
    const angle = randomBetween(0, TAU);
    const length = SIZE * randomBetween(...SPARK.rayLength);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
  }
  context.stroke();
  context.restore();
}

export function drawBomb(context, pixel, { x, y, angle = 0, remaining = 1, lit = false, burning = false }) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  paintShell(context, pixel);
  paintLamp(context, lit);
  const tip = paintFuse(context, pixel, remaining);
  if (burning) paintSpark(context, pixel, ...tip);
  context.restore();
}

export class Bomb {
  constructor(x, y, anchor) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.fall = 0;
    this.anchor = anchor;
    this.age = 0;
    this.phase = BLINK_DUTY;
    this.lit = false;
  }

  get remaining() {
    return Math.max(0, 1 - this.age / BOMB.fuseSeconds);
  }

  get due() {
    return this.age >= BOMB.fuseSeconds;
  }

  update(dt, surface) {
    this.age += dt;
    this.follow(dt, surface);
    return this.blink(dt);
  }

  follow(dt, surface) {
    const pose = this.anchor && surface.hold(this.anchor);
    if (pose) {
      Object.assign(this, pose);
      this.fall = 0;
      return;
    }
    this.anchor = surface.grip(this.x, this.y, SIZE);
    if (this.anchor) return;
    this.fall += GRAVITY * dt;
    this.y = Math.min(this.y + this.fall * dt, -SIZE);
    if (this.y === -SIZE) this.fall = 0;
  }

  blink(dt) {
    const wasLit = this.lit;
    this.phase += dt * lerp(...BOMB.blinkRate, 1 - this.remaining);
    this.lit = this.phase % 1 < BLINK_DUTY;
    return this.lit && !wasLit;
  }

  blow() {
    return { ...BOMB.blow, x: this.x, y: this.y, contact: SIZE };
  }

  draw(context, pixel) {
    const { x, y, angle, remaining, lit } = this;
    drawBomb(context, pixel, { x, y, angle, remaining, lit, burning: true });
  }
}
