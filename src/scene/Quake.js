import { QUAKE } from '../config.js';
import { strokeLayers } from '../core/canvas.js';
import { clamp, lerp, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const FISSURE = Object.freeze({ step: 0.03, depth: [0.006, 0.05], wander: 0.012, width: 7, rim: 1.4 });
const OPEN_RATE = 1.5;
const CLOSE_RATE = 0.6;
const CHASM = 'rgba(12,10,9,0.85)';
const RIM = 'rgba(255,255,255,0.18)';

function fissureFrom(x, halfWidth, direction) {
  const path = [x, FISSURE.depth[0]];
  for (let at = x; Math.abs(at) < halfWidth; at += direction * FISSURE.step) {
    const depth = clamp(path.at(-1) + randomBetween(-FISSURE.wander, FISSURE.wander), ...FISSURE.depth);
    path.push(at + direction * FISSURE.step, depth);
  }
  return path;
}

export class Quake extends Tool {
  constructor(room, { onEngage, onQuake, onRumble }) {
    super(room);
    this.onEngage = onEngage;
    this.onQuake = onQuake;
    this.onRumble = onRumble;
    this.holding = false;
    this.elapsed = 0;
    this.wait = 0;
    this.opening = 0;
    this.fissures = [];
    this.rumbles = new Pulse(QUAKE.rumbleSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.opening > 0;
  }

  get ramp() {
    return Math.min(1, this.elapsed / QUAKE.rampSeconds);
  }

  get focus() {
    return this.holding ? { x: this.aimX, y: 0, radius: this.room.halfWidth, charge: QUAKE.tension * this.ramp } : null;
  }

  windUp() {
    this.holding = true;
    this.elapsed = 0;
    this.wait = 0;
    this.onEngage();
    if (!this.opening) this.fissures = [-1, 1].map((direction) => fissureFrom(this.aimX, this.room.halfWidth, direction));
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.opening = 0;
  }

  update(dt) {
    this.opening = clamp(this.opening + (this.holding ? OPEN_RATE * this.ramp : -CLOSE_RATE) * dt, 0, 1);
    if (!this.holding) return;
    this.elapsed += dt;
    this.wait -= dt;
    if (this.rumbles.tick(dt)) this.onRumble(QUAKE.rumbleSeconds);
    if (this.wait > 0) return;
    this.wait = lerp(...QUAKE.pulseSeconds, this.ramp);
    this.onQuake(lerp(...QUAKE.power, this.ramp));
  }

  draw(context, pixelsPerMeter) {
    if (!this.opening) return;
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    this.fissures.forEach((path) => {
      const shown = Math.min(path.length, Math.max(4, Math.round((path.length / 2) * this.opening) * 2));
      context.beginPath();
      for (let i = 0; i < shown; i += 2) context.lineTo(path[i], path[i + 1]);
      strokeLayers(context, pixel, [[FISSURE.width * this.opening + FISSURE.rim * 2, RIM], [FISSURE.width * this.opening, CHASM]]);
    });
    context.restore();
  }
}
