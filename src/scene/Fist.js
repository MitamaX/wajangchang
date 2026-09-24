import { FIST } from '../config.js';
import { paintReticle, radiate } from '../core/canvas.js';
import { TAU, easeOut, lerp, polar, randomBetween } from '../core/math.js';
import { Crack } from './Glass.js';
import { Tool } from './Tool.js';

const SIZE = FIST.size;
const BURST = Object.freeze({ seconds: 0.11, points: 10, inner: 0.45, reach: [0.9, 1.9] });
const RING = Object.freeze({ seconds: 0.35, reach: 3.2, width: 5 });
const CRACK = Object.freeze({ spokes: [9, 13], reach: [0.22, 0.42], bends: 5, jitter: 0.16, rings: [0.3, 0.62], skip: 0.3, core: 0.02 });
const FLASH = '255,250,235';
const FLASH_EDGE = '255,210,120';

function paintBurst(context, { x, y, age, turn }) {
  const t = age / BURST.seconds;
  const radius = SIZE * lerp(...BURST.reach, easeOut(t));
  const fading = 1 - t;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.translate(x, y);
  context.rotate(turn);
  context.fillStyle = `rgba(${FLASH},${0.85 * fading})`;
  context.beginPath();
  for (let i = 0; i < BURST.points * 2; i++) context.lineTo(...polar((i / (BURST.points * 2)) * TAU, radius * (i % 2 ? BURST.inner : 1)));
  context.closePath();
  context.fill();
  context.restore();
  radiate(context, x, y, radius, [[0, `rgba(${FLASH},${fading})`], [0.5, `rgba(${FLASH_EDGE},${0.5 * fading})`], [1, `rgba(${FLASH_EDGE},0)`]]);
}

function paintRing(context, pixel, { x, y, age }) {
  const t = age / RING.seconds;
  context.save();
  context.strokeStyle = `rgba(${FLASH},${0.7 * (1 - t)})`;
  context.lineWidth = RING.width * pixel * (1 - t);
  context.beginPath();
  context.arc(x, y, SIZE * RING.reach * easeOut(t), 0, TAU);
  context.stroke();
  context.restore();
}

export class Fist extends Tool {
  constructor(room, { onPunch }) {
    super(room);
    this.onPunch = onPunch;
    this.cracks = [];
    this.bursts = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.cracks.length > 0 || this.bursts.length > 0;
  }

  windUp() {
    const { aimX: x, aimY: y } = this;
    this.cracks.push(new Crack(x, y, CRACK, FIST.crackSeconds));
    this.bursts.push({ x, y, age: 0, turn: randomBetween(0, TAU) });
    this.onPunch({ ...FIST.blow, x, y });
  }

  stow() {
    super.stow();
    this.cracks = [];
    this.bursts = [];
  }

  update(dt) {
    this.cracks = this.cracks.filter((crack) => crack.update(dt));
    this.bursts = this.bursts.filter((burst) => (burst.age += dt) < RING.seconds);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.cracks.forEach((crack) => crack.draw(context, pixel));
    this.bursts.forEach((burst) => {
      if (burst.age < BURST.seconds) paintBurst(context, burst);
      paintRing(context, pixel, burst);
    });
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
