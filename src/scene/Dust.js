import { DUST } from '../config.js';
import { paintReticle } from '../core/canvas.js';
import { lerp } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

export class Dust extends Tool {
  constructor(room, { onTouch, onDisperse, onHush }) {
    super(room);
    this.onTouch = onTouch;
    this.onDisperse = onDisperse;
    this.onHush = onHush;
    this.front = null;
    this.origin = null;
    this.crumbles = new Pulse(DUST.crumbleSeconds);
    this.hushes = new Pulse(DUST.hushSeconds);
  }

  get busy() {
    return this.front !== null;
  }

  get focus() {
    const { front } = this;
    return front ? { ...this.origin, radius: front.radius, charge: lerp(...DUST.tension, front.radius / DUST.limit) } : null;
  }

  windUp() {
    const anchor = this.onTouch(this.aimX, this.aimY);
    if (!anchor) return;
    this.front = { ...anchor, radius: 0 };
    this.origin = { x: this.aimX, y: this.aimY };
    this.crumbles.reset();
  }

  release() {
    this.front = null;
  }

  cancel() {
    this.front = null;
  }

  stow() {
    super.stow();
    this.front = null;
  }

  update(dt) {
    const { front } = this;
    if (!front) return;
    front.radius = Math.min(DUST.limit, front.radius + DUST.spread * dt);
    if (this.hushes.tick(dt)) this.onHush(DUST.hushSeconds);
    if (this.crumbles.tick(dt)) this.onDisperse(front);
  }

  draw(context, pixelsPerMeter) {
    if (this.present) paintReticle(context, this.aimX, this.aimY, 1 / pixelsPerMeter);
  }
}
