import { GRAVITY, LAVA } from '../config.js';
import { TAU, clamp, randomBetween, wrap } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const STEP = 0.02;
const RIPPLE = Object.freeze({ stretch: 2.3, pace: 1.3, share: 0.5 });
const GLOW = Object.freeze({ height: 0.07, alpha: 0.35 });
const CRUST = Object.freeze({ count: 10, drift: 0.015, width: [0.03, 0.08], height: [0.004, 0.01], alpha: 0.4 });
const RIM_WIDTH = 2.4;
const POP_GROWTH = 2;
const HOT = '255,214,120';
const MAGMA = '240,96,24';
const DEEP = '120,22,10';
const CRUST_INK = '60,14,6';

export class Lava extends Tool {
  constructor(room, { onEngage, onSweep, onMelt, onChurn, onSizzle, onBlub }) {
    super(room);
    this.onEngage = onEngage;
    this.onSweep = onSweep;
    this.onMelt = onMelt;
    this.onChurn = onChurn;
    this.onSizzle = onSizzle;
    this.onBlub = onBlub;
    this.holding = false;
    this.melting = false;
    this.level = 0;
    this.time = 0;
    this.spawned = 0;
    this.bubbles = [];
    this.crusts = Array.from({ length: CRUST.count }, () => ({ share: Math.random(), width: randomBetween(...CRUST.width), height: randomBetween(...CRUST.height) }));
    this.melts = new Pulse(LAVA.meltSeconds);
    this.churns = new Pulse(LAVA.churnSeconds);
    this.sizzles = new Pulse(LAVA.sizzleSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.level > 0;
  }

  get focus() {
    return this.holding ? { x: this.aimX, y: -this.level, radius: this.room.halfWidth, charge: (LAVA.tension * this.level) / LAVA.depth } : null;
  }

  windUp() {
    this.holding = true;
    this.onEngage();
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
    this.level = 0;
    this.bubbles = [];
  }

  levelAt(x) {
    const { height, length, speed } = LAVA.wave;
    const swell = Math.sin(x * length + this.time * speed) + RIPPLE.share * Math.sin(x * length * RIPPLE.stretch - this.time * speed * RIPPLE.pace);
    return -this.level + swell * height * Math.min(1, this.level / LAVA.swell);
  }

  update(dt) {
    this.time += dt;
    this.level = clamp(this.level + (this.holding ? LAVA.rise : -LAVA.drain) * dt, 0, LAVA.depth);
    this.boil(dt);
    if (!this.level) {
      this.melting = false;
      return;
    }
    const levelAt = (x) => this.levelAt(x);
    this.onSweep((x, y, vx, vy) => (y < levelAt(x) ? null : [-vx * LAVA.drag * dt, (-GRAVITY * LAVA.buoyancy - vy * LAVA.drag) * dt]));
    if (this.churns.tick(dt)) this.onChurn(LAVA.churnSeconds);
    if (this.melts.tick(dt)) this.melting = this.onMelt(levelAt);
    if (this.melting && this.sizzles.tick(dt)) this.onSizzle(LAVA.sizzleSeconds);
  }

  boil(dt) {
    const { rate, size, speed, popSeconds } = LAVA.bubbles;
    const { halfWidth } = this.room;
    this.spawned += (rate * this.level * dt) / LAVA.depth;
    for (; this.spawned >= 1; this.spawned--) this.bubbles.push({ x: randomBetween(-halfWidth, halfWidth), y: 0, size: randomBetween(...size), speed: randomBetween(...speed), popped: 0 });
    this.bubbles = this.bubbles.filter((bubble) => {
      if (bubble.popped) return (bubble.popped += dt) < popSeconds;
      bubble.y -= bubble.speed * dt;
      if (bubble.y - bubble.size > this.levelAt(bubble.x)) return true;
      bubble.popped = dt;
      this.onBlub();
      return true;
    });
  }

  draw(context, pixelsPerMeter) {
    if (!this.level) return;
    const pixel = 1 / pixelsPerMeter;
    const { halfWidth } = this.room;
    const top = -this.level - LAVA.wave.height * 2;
    const points = [];
    for (let x = -halfWidth; x < halfWidth; x += STEP) points.push([x, this.levelAt(x)]);
    points.push([halfWidth, this.levelAt(halfWidth)]);
    context.save();
    context.globalCompositeOperation = 'lighter';
    const glow = context.createLinearGradient(0, top - GLOW.height, 0, top);
    glow.addColorStop(0, `rgba(${MAGMA},0)`);
    glow.addColorStop(1, `rgba(${MAGMA},${GLOW.alpha})`);
    context.fillStyle = glow;
    context.fillRect(-halfWidth, top - GLOW.height, halfWidth * 2, GLOW.height);
    context.restore();
    context.save();
    const body = context.createLinearGradient(0, top, 0, 0);
    body.addColorStop(0, `rgba(${HOT},0.95)`);
    body.addColorStop(0.18, `rgba(${MAGMA},0.95)`);
    body.addColorStop(1, `rgba(${DEEP},0.97)`);
    context.fillStyle = body;
    context.beginPath();
    context.moveTo(-halfWidth, 0);
    points.forEach(([x, y]) => context.lineTo(x, y));
    context.lineTo(halfWidth, 0);
    context.closePath();
    context.fill();
    context.clip();
    this.drawCrust(context, halfWidth);
    this.drawBubbles(context, pixel, false);
    context.restore();
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${HOT},0.9)`;
    context.lineWidth = RIM_WIDTH * pixel;
    context.lineJoin = 'round';
    context.beginPath();
    points.forEach(([x, y]) => context.lineTo(x, y));
    context.stroke();
    this.drawBubbles(context, pixel, true);
    context.restore();
  }

  drawCrust(context, halfWidth) {
    context.fillStyle = `rgba(${CRUST_INK},${CRUST.alpha})`;
    this.crusts.forEach(({ share, width, height }) => {
      const x = wrap(share * halfWidth * 2 + this.time * CRUST.drift, halfWidth * 2) - halfWidth;
      context.beginPath();
      context.ellipse(x, this.levelAt(x) + height, width / 2, height, 0, 0, TAU);
      context.fill();
    });
  }

  drawBubbles(context, pixel, bursting) {
    const { popSeconds } = LAVA.bubbles;
    context.lineWidth = pixel;
    context.fillStyle = `rgba(${HOT},0.35)`;
    this.bubbles.filter(({ popped }) => Boolean(popped) === bursting).forEach(({ x, y, size, popped }) => {
      const fading = bursting ? 1 - popped / popSeconds : 1;
      context.strokeStyle = `rgba(${HOT},${fading})`;
      context.beginPath();
      context.arc(x, bursting ? this.levelAt(x) : y, size * (1 + POP_GROWTH * (1 - fading)), 0, TAU);
      if (!bursting) context.fill();
      context.stroke();
    });
  }
}
