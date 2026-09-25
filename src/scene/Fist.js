import { FIST } from '../config.js';
import { paintReticle, radiate } from '../core/canvas.js';
import { fidelity } from '../core/fidelity.js';
import { TAU, easeOut, lerp, polar, randomBetween } from '../core/math.js';
import { Cooldown } from './Cooldown.js';
import { Crack } from './Glass.js';
import { Tool } from './Tool.js';

const SIZE = FIST.size;
const BURST = Object.freeze({ seconds: 0.11, points: 10, inner: 0.45, reach: [0.9, 1.9] });
const RING = Object.freeze({ seconds: 0.35, reach: 3.2, width: 5 });
const KNUCKLES = Object.freeze({ gap: 0.021, arch: 0.006, size: [0.0095, 0.0075], scale: [0.95, 1.05, 1, 0.82], tilt: 0.25 });
const CRACK = Object.freeze({ spokes: [5, 7], reach: [0.07, 0.13], bends: 4, jitter: 0.18, rings: [0.55], skip: 0.55, core: 0.03, knuckles: KNUCKLES });
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
    this.gap = new Cooldown(FIST.cooldown);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.cracks.length > 0 || this.bursts.length > 0;
  }

  windUp() {
    if (!this.gap.ready) return;
    this.gap.trigger();
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
    this.gap.tick(dt);
    this.cracks = this.cracks.filter((crack) => crack.update(dt));
    this.bursts = this.bursts.filter((burst) => (burst.age += dt) < RING.seconds);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    if (fidelity.profile.effects) this.drawImpacts(context, pixel);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawImpacts(context, pixel) {
    this.cracks.forEach((crack) => crack.draw(context, pixel));
    this.bursts.forEach((burst) => {
      if (burst.age < BURST.seconds) paintBurst(context, burst);
      paintRing(context, pixel, burst);
    });
  }
}
