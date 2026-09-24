import { GRAVITY, LAVA } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, randomBetween, wrap } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const STEP = 0.02;
const RIPPLE = Object.freeze({ stretch: 2.3, pace: 1.3, share: 0.5 });
const GLOW = Object.freeze({ height: 0.3, alpha: 0.32 });
const CRUST = Object.freeze({ count: 12, drift: 0.02, width: [0.04, 0.11], height: [0.006, 0.014], corners: 7, sink: 0.35 });
const VEINS = Object.freeze({ count: 3, depth: [0.25, 0.75], length: 5, speed: 0.6, width: 2, alpha: 0.22, warp: 0.6 });
const EMBER = Object.freeze({ rate: 26, rise: [0.25, 0.7], sway: 0.15, life: [0.5, 1.1], size: 2.2 });
const SPATTER = Object.freeze({ count: [2, 4], speed: [0.4, 0.9], size: [0.002, 0.004], gravity: 0.7 });
const RIM = Object.freeze({ core: 2.4, glow: 10 });
const POP_GROWTH = 2;
const HOT = '255,226,140';
const MAGMA = '240,96,24';
const DEEP = '110,18,8';
const CRUST_INK = '46,12,6';
const CRACK_GLOW = '255,170,60';
const BUBBLE_SHINE = 'rgba(255,245,210,0.7)';

function plate() {
  const width = randomBetween(...CRUST.width);
  const height = randomBetween(...CRUST.height);
  const outline = Array.from({ length: CRUST.corners }, (_, i) => {
    const angle = (i / CRUST.corners) * TAU;
    const reach = randomBetween(0.7, 1);
    return [Math.cos(angle) * width * reach / 2, Math.sin(angle) * height * reach];
  });
  return { share: Math.random(), width, height, outline, pace: randomBetween(0.6, 1.4) };
}

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
    this.sparked = 0;
    this.bubbles = [];
    this.embers = [];
    this.spatters = [];
    this.crusts = Array.from({ length: CRUST.count }, plate);
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
    this.embers = [];
    this.spatters = [];
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
    this.spark(dt);
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
      this.splash(bubble.x, this.levelAt(bubble.x));
      this.onBlub();
      return true;
    });
  }

  splash(x, y) {
    const count = Math.round(randomBetween(...SPATTER.count));
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + randomBetween(-0.9, 0.9);
      const speed = randomBetween(...SPATTER.speed);
      this.spatters.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: randomBetween(...SPATTER.size) });
    }
  }

  spark(dt) {
    const { halfWidth } = this.room;
    this.sparked += (EMBER.rate * this.level * dt) / LAVA.depth;
    for (; this.sparked >= 1; this.sparked--) {
      const x = randomBetween(-halfWidth, halfWidth);
      this.embers.push({ x, y: this.levelAt(x), rise: randomBetween(...EMBER.rise), phase: randomBetween(0, TAU), age: 0, life: randomBetween(...EMBER.life) });
    }
    this.embers = this.embers.filter((ember) => {
      ember.age += dt;
      ember.y -= ember.rise * dt;
      ember.x += Math.sin(ember.phase + ember.age * 6) * EMBER.sway * dt;
      return ember.age < ember.life;
    });
    this.spatters = this.spatters.filter((drop) => {
      drop.vy += GRAVITY * SPATTER.gravity * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      return drop.vy < 0 || drop.y < this.levelAt(drop.x);
    });
  }

  draw(context, pixelsPerMeter) {
    if (!this.level && !this.embers.length) return;
    const pixel = 1 / pixelsPerMeter;
    const { halfWidth } = this.room;
    if (this.level) this.drawPool(context, pixel, halfWidth);
    this.drawSparks(context, pixel);
  }

  drawPool(context, pixel, halfWidth) {
    const top = -this.level - LAVA.wave.height * 2;
    const points = [];
    for (let x = -halfWidth; x < halfWidth; x += STEP) points.push([x, this.levelAt(x)]);
    points.push([halfWidth, this.levelAt(halfWidth)]);
    context.save();
    context.globalCompositeOperation = 'lighter';
    const glow = context.createLinearGradient(0, top - GLOW.height, 0, top);
    glow.addColorStop(0, `rgba(${MAGMA},0)`);
    glow.addColorStop(1, `rgba(${MAGMA},${GLOW.alpha * Math.min(1, this.level / LAVA.swell)})`);
    context.fillStyle = glow;
    context.fillRect(-halfWidth, top - GLOW.height, halfWidth * 2, GLOW.height);
    context.restore();
    context.save();
    const body = context.createLinearGradient(0, top, 0, 0);
    body.addColorStop(0, `rgba(${HOT},0.97)`);
    body.addColorStop(0.2, `rgba(${MAGMA},0.97)`);
    body.addColorStop(1, `rgba(${DEEP},0.98)`);
    context.fillStyle = body;
    context.beginPath();
    context.moveTo(-halfWidth, 0);
    points.forEach(([x, y]) => context.lineTo(x, y));
    context.lineTo(halfWidth, 0);
    context.closePath();
    context.fill();
    context.clip();
    this.drawVeins(context, pixel, halfWidth);
    this.drawCrust(context, pixel, halfWidth);
    this.drawBubbles(context, pixel, false);
    context.restore();
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineJoin = 'round';
    context.beginPath();
    points.forEach(([x, y]) => context.lineTo(x, y));
    context.strokeStyle = `rgba(${HOT},0.35)`;
    context.lineWidth = RIM.glow * pixel;
    context.stroke();
    context.strokeStyle = `rgba(${HOT},0.95)`;
    context.lineWidth = RIM.core * pixel;
    context.stroke();
    this.drawBubbles(context, pixel, true);
    context.restore();
  }

  drawVeins(context, pixel, halfWidth) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${HOT},${VEINS.alpha})`;
    context.lineWidth = VEINS.width * pixel;
    context.beginPath();
    for (let vein = 0; vein < VEINS.count; vein++) {
      const depth = this.level * (VEINS.depth[0] + ((VEINS.depth[1] - VEINS.depth[0]) * vein) / (VEINS.count - 1));
      for (let x = -halfWidth; x <= halfWidth; x += STEP) {
        const phase = x * VEINS.length * (vein + 1) + this.time * VEINS.speed * (vein % 2 ? -1 : 1);
        const y = -this.level + depth + (Math.sin(phase) + VEINS.warp * Math.sin(phase * 2.7 + vein)) * depth * 0.15;
        if (x === -halfWidth) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
    }
    context.stroke();
    context.restore();
  }

  drawCrust(context, pixel, halfWidth) {
    this.crusts.forEach(({ share, height, outline, pace }) => {
      const x = wrap(share * halfWidth * 2 + this.time * CRUST.drift * pace, halfWidth * 2) - halfWidth;
      const y = this.levelAt(x) + height * CRUST.sink;
      context.beginPath();
      outline.forEach(([dx, dy]) => context.lineTo(x + dx, y + dy));
      context.closePath();
      context.fillStyle = `rgba(${CRUST_INK},0.85)`;
      context.fill();
      context.strokeStyle = `rgba(${CRACK_GLOW},0.8)`;
      context.lineWidth = 1.4 * pixel;
      context.stroke();
    });
  }

  drawBubbles(context, pixel, bursting) {
    const { popSeconds } = LAVA.bubbles;
    context.lineWidth = pixel;
    this.bubbles.filter(({ popped }) => Boolean(popped) === bursting).forEach(({ x, y, size, popped }) => {
      const fading = bursting ? 1 - popped / popSeconds : 1;
      const radius = size * (1 + POP_GROWTH * (1 - fading));
      const centerY = bursting ? this.levelAt(x) : y;
      context.strokeStyle = `rgba(${HOT},${fading})`;
      context.fillStyle = `rgba(${HOT},0.3)`;
      context.beginPath();
      context.arc(x, centerY, radius, 0, TAU);
      if (!bursting) context.fill();
      context.stroke();
      if (bursting) return;
      context.fillStyle = BUBBLE_SHINE;
      context.beginPath();
      context.arc(x - radius * 0.35, centerY - radius * 0.35, radius * 0.25, 0, TAU);
      context.fill();
    });
  }

  drawSparks(context, pixel) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    this.embers.forEach(({ x, y, age, life }) => {
      const fading = 1 - age / life;
      radiate(context, x, y, EMBER.size * pixel * 2, [[0, `rgba(${HOT},${fading})`], [1, `rgba(${MAGMA},0)`]]);
    });
    context.fillStyle = `rgba(${HOT},0.95)`;
    this.spatters.forEach(({ x, y, size }) => {
      context.beginPath();
      context.arc(x, y, size, 0, TAU);
      context.fill();
    });
    context.restore();
  }
}
