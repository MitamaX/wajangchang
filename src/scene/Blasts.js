import { radiate } from '../core/canvas.js';
import { fidelity } from '../core/fidelity.js';
import { TAU, easeOut, lerp } from '../core/math.js';

const FIREBALL_GROWTH = [0.5, 1.3];
const RING_WIDTH = 6;
const RING_ALPHA = 0.8;
const FIRE_CORE = '255,244,214';
const FIRE = '255,160,60';
const FIRE_EDGE = '190,60,20';

function paintBlast(context, pixel, { x, y, radius, reach, age }, seconds) {
  const fading = 1 - age / seconds;
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

export class Blasts {
  constructor(seconds) {
    this.seconds = seconds;
    this.list = [];
  }

  get busy() {
    return this.list.length > 0;
  }

  add({ x, y, radius, blast }) {
    this.list.push({ x, y, radius, reach: blast.reach, age: 0 });
  }

  update(dt) {
    this.list = this.list.filter((blast) => (blast.age += dt) < this.seconds);
  }

  draw(context, pixel) {
    if (!fidelity.profile.effects) return;
    this.list.forEach((blast) => paintBlast(context, pixel, blast, this.seconds));
  }
}
