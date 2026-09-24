import { STORM } from '../config.js';
import { clamp, randomBetween } from '../core/math.js';
import { Lightning } from './Lightning.js';
import { Pulse } from './Pulse.js';

const COVER_RATE = 2.5;
const RAIN = Object.freeze({ width: 1.2, alpha: 0.3, slant: 0.18 });
const CLOUD = '14,16,24';
const DROP = '190,210,235';

export class Storm extends Lightning {
  constructor(room, handlers) {
    super(room, handlers);
    this.holding = false;
    this.cover = 0;
    this.drops = [];
    this.strikes = new Pulse(STORM.strikeSeconds);
  }

  get busy() {
    return super.busy || this.holding || this.cover > 0;
  }

  windUp() {
    this.holding = true;
    this.strikes.reset();
    if (!this.drops.length) this.drops = Array.from({ length: STORM.rain }, () => this.drop(randomBetween(-this.room.ceiling, 0)));
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.holding = false;
    this.cover = 0;
    this.drops = [];
  }

  drop(y) {
    return { x: randomBetween(-this.room.halfWidth, this.room.halfWidth), y };
  }

  update(dt) {
    super.update(dt);
    this.cover = clamp(this.cover + (this.holding ? COVER_RATE : -COVER_RATE) * dt, 0, 1);
    this.drops = this.drops.map(({ x, y }) => (y > 0 ? this.drop(-this.room.ceiling) : { x: x + RAIN.slant * STORM.rainSpeed * dt, y: y + STORM.rainSpeed * dt }));
    if (!this.holding || !this.present || !this.strikes.tick(dt)) return;
    const spread = () => randomBetween(-STORM.spread, STORM.spread);
    this.spawn(clamp(this.aimX + spread(), -this.room.halfWidth, this.room.halfWidth), clamp(this.aimY + spread(), -this.room.ceiling, 0));
  }

  draw(context, pixelsPerMeter) {
    if (this.cover) this.drawWeather(context, 1 / pixelsPerMeter);
    super.draw(context, pixelsPerMeter);
  }

  drawWeather(context, pixel) {
    const { halfWidth, ceiling } = this.room;
    const top = -ceiling;
    const cloud = context.createLinearGradient(0, top, 0, top + ceiling * STORM.cloud * 2);
    cloud.addColorStop(0, `rgba(${CLOUD},${STORM.darkness * this.cover})`);
    cloud.addColorStop(1, `rgba(${CLOUD},0)`);
    context.fillStyle = cloud;
    context.fillRect(-halfWidth, top, halfWidth * 2, ceiling * STORM.cloud * 2);
    context.strokeStyle = `rgba(${DROP},${RAIN.alpha * this.cover})`;
    context.lineWidth = RAIN.width * pixel;
    context.beginPath();
    this.drops.forEach(({ x, y }) => {
      context.moveTo(x, y);
      context.lineTo(x - RAIN.slant * STORM.rainLength, y - STORM.rainLength);
    });
    context.stroke();
  }
}
