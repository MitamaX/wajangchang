import { GRAVITY, HAIL } from '../config.js';
import { TAU, randomBetween } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Pulse } from './Pulse.js';
import { Shell } from './Shell.js';

const SKY_GAP = 0.04;
const SKY_SPREAD = 0.15;
const DRIFT = 0.25;
const STREAK = Object.freeze({ length: 0.025, width: 1.4 });
const STONE = 'rgba(235,246,255,0.95)';
const STREAK_INK = 'rgba(210,235,255,0.45)';

export class Hail extends Launcher {
  constructor(room, surface, { onHit }) {
    super(room, surface, HAIL);
    this.onHit = onHit;
    this.holding = false;
    this.stones = new Pulse(1 / HAIL.rate);
  }

  get busy() {
    return this.holding || super.busy;
  }

  windUp() {
    this.holding = true;
    this.stones.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  launch() {
    const x = this.aimX + randomBetween(-HAIL.spread, HAIL.spread);
    const y = -this.room.ceiling - SKY_GAP - randomBetween(0, SKY_SPREAD);
    return new Shell({ x, y, vx: randomBetween(-DRIFT, DRIFT), vy: HAIL.speed, reach: HAIL.reach, gravity: GRAVITY });
  }

  update(dt) {
    super.update(dt);
    if (this.holding && this.present && this.stones.tick(dt) && this.shells.length < HAIL.capacity) this.shells.push(this.launch());
  }

  impact(shell, { x, y }) {
    this.onHit([{ ...HAIL.round, x, y }]);
  }

  paint(context, pixel, { x, y, vx, vy, speed }) {
    context.strokeStyle = STREAK_INK;
    context.lineWidth = STREAK.width * pixel;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - (vx / speed) * STREAK.length, y - (vy / speed) * STREAK.length);
    context.stroke();
    context.fillStyle = STONE;
    context.beginPath();
    context.arc(x, y, HAIL.size, 0, TAU);
    context.fill();
  }
}
