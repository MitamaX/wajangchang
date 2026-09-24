import { GRAVITY, LEVITY } from '../config.js';
import { clamp, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RISE_RATE = 3;
const FALL_RATE = 4;
const STREAKS = 36;
const STREAK = Object.freeze({ length: [0.03, 0.09], speed: [0.6, 1.4], width: 1.4, alpha: 0.35 });
const SLAM_SPEED = 5;
const TINT = '150,110,255';
const TINT_ALPHA = 0.1;

export class Levity extends Tool {
  constructor(room, { onEngage, onSweep, onSlam, onHum }) {
    super(room);
    this.onEngage = onEngage;
    this.onSweep = onSweep;
    this.onSlam = onSlam;
    this.onHum = onHum;
    this.holding = false;
    this.lift = 0;
    this.direction = -1;
    this.streaks = [];
    this.hums = new Pulse(LEVITY.humSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.lift > 0;
  }

  get top() {
    return -this.room.ceiling * LEVITY.ceilingShare;
  }

  windUp() {
    this.holding = true;
    this.direction = -1;
    this.onEngage();
    if (!this.streaks.length) this.streaks = Array.from({ length: STREAKS }, () => this.streak(randomBetween(-this.room.ceiling, 0)));
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    this.direction = SLAM_SPEED;
    this.onSlam();
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.lift = 0;
    this.streaks = [];
  }

  streak(y) {
    const halfWidth = this.room.halfWidth;
    return { x: randomBetween(-halfWidth, halfWidth), y, length: randomBetween(...STREAK.length), speed: randomBetween(...STREAK.speed) };
  }

  update(dt) {
    this.lift = clamp(this.lift + (this.holding ? RISE_RATE : -FALL_RATE) * dt, 0, 1);
    this.drift(dt);
    if (!this.holding) return;
    this.onSweep((x, y, vx, vy) => this.float(y, vx, vy, dt));
    if (this.hums.tick(dt)) this.onHum(LEVITY.humSeconds);
  }

  float(y, vx, vy, dt) {
    const factor = clamp((y - this.top) / LEVITY.band, -1, 1);
    const hold = GRAVITY * (1 + (LEVITY.lift - 1) * factor);
    return [-vx * LEVITY.drag * dt, -(hold * this.lift + vy * LEVITY.drag) * dt];
  }

  drift(dt) {
    const { ceiling } = this.room;
    this.streaks = this.streaks.map((streak) => {
      const y = streak.y + streak.speed * this.direction * dt;
      return y < -ceiling || y > 0 ? this.streak(this.direction < 0 ? 0 : -ceiling) : { ...streak, y };
    });
  }

  draw(context, pixelsPerMeter) {
    if (!this.lift) return;
    const pixel = 1 / pixelsPerMeter;
    const { halfWidth, ceiling } = this.room;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = `rgba(${TINT},${TINT_ALPHA * this.lift})`;
    context.fillRect(-halfWidth, -ceiling, halfWidth * 2, ceiling);
    context.strokeStyle = `rgba(${TINT},${STREAK.alpha * this.lift})`;
    context.lineWidth = STREAK.width * pixel;
    context.lineCap = 'round';
    context.beginPath();
    this.streaks.forEach(({ x, y, length }) => {
      context.moveTo(x, y);
      context.lineTo(x, y - Math.sign(this.direction) * length);
    });
    context.stroke();
    context.restore();
  }
}
