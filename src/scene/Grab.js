import { GRAB } from '../config.js';
import { radiate, strokeLayers } from '../core/canvas.js';
import { TAU, normalize } from '../core/math.js';
import { Tool } from './Tool.js';

const RING = Object.freeze({ radius: 0.022, width: 1.6, pulse: 6, depth: 0.2 });
const TETHER = Object.freeze({ points: 28, waves: 4, amplitude: 0.007, speed: 18, glow: 7, core: 1.8 });
const GRIP_REACH = 0.03;
const PSI = '170,120,255';
const PSI_CORE = '235,225,255';

export class Grab extends Tool {
  constructor(room, { onSeize, onTug }) {
    super(room);
    this.onSeize = onSeize;
    this.onTug = onTug;
    this.anchor = null;
    this.grip = null;
    this.time = 0;
  }

  get busy() {
    return this.anchor !== null;
  }

  get focus() {
    return this.grip ? { x: this.grip.x, y: this.grip.y, radius: GRIP_REACH, charge: GRAB.tension } : null;
  }

  windUp() {
    this.anchor = this.onSeize(this.aimX, this.aimY);
  }

  release() {
    this.letGo();
  }

  cancel() {
    this.letGo();
  }

  letGo() {
    this.anchor = null;
    this.grip = null;
  }

  update(dt) {
    this.time += dt;
    if (!this.anchor) return;
    this.grip = this.onTug(this.anchor, this.aimX, this.aimY, dt);
    if (!this.grip) this.letGo();
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    if (this.grip) this.drawTether(context, pixel);
    if (this.present) this.drawRing(context, pixel);
    context.restore();
  }

  drawRing(context, pixel) {
    const radius = RING.radius * (1 + RING.depth * Math.sin(this.time * RING.pulse));
    context.strokeStyle = `rgba(${PSI},0.8)`;
    context.lineWidth = RING.width * pixel;
    context.beginPath();
    context.arc(this.aimX, this.aimY, radius, 0, TAU);
    context.stroke();
  }

  drawTether(context, pixel) {
    const { x, y } = this.grip;
    const [normalX, normalY] = normalize(this.aimY - y, x - this.aimX);
    context.beginPath();
    for (let point = 0; point <= TETHER.points; point++) {
      const share = point / TETHER.points;
      const wave = Math.sin(share * TETHER.waves * TAU - this.time * TETHER.speed) * TETHER.amplitude * Math.sin(share * Math.PI);
      context.lineTo(x + (this.aimX - x) * share + normalX * wave, y + (this.aimY - y) * share + normalY * wave);
    }
    strokeLayers(context, pixel, [[TETHER.glow, `rgba(${PSI},0.35)`], [TETHER.core, `rgba(${PSI_CORE},0.9)`]]);
    radiate(context, x, y, GRIP_REACH, [[0, `rgba(${PSI_CORE},0.9)`], [1, `rgba(${PSI},0)`]]);
  }
}
