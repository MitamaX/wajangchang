import { FIREWORK, GRAVITY } from '../config.js';
import { TAU, polar, randomBetween, randomInt } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Shell } from './Shell.js';

const HUES = ['255,90,90', '255,210,80', '120,220,255', '170,255,120', '230,130,255'];
const WOBBLE_RATE = 20;
const STICK = Object.freeze({ length: 0.05, width: 1.6 });
const SPARK = Object.freeze({ width: 2.2, trail: 0.035, core: '255,250,235' });
const STICK_INK = 'rgba(140,110,80,0.9)';

class Starshell extends Shell {
  constructor(options) {
    super(options);
    this.hue = HUES[randomInt(0, HUES.length - 1)];
  }
}

class Spark {
  constructor(x, y, hue) {
    const [vx, vy] = polar(randomBetween(0, TAU), randomBetween(...FIREWORK.sparkSpeed));
    Object.assign(this, { x, y, vx, vy, hue, age: 0, life: randomBetween(...FIREWORK.sparkLife), spent: false });
  }

  get gone() {
    return this.spent || this.age >= this.life;
  }

  get armed() {
    return this.age >= FIREWORK.armSeconds;
  }

  update(dt) {
    const drag = Math.max(0, 1 - FIREWORK.sparkDrag * dt);
    this.age += dt;
    this.vy = (this.vy + GRAVITY * FIREWORK.sparkGravity * dt) * drag;
    this.vx *= drag;
    this.x += this.vx * dt;
    this.y = Math.min(0, this.y + this.vy * dt);
  }
}

export class Fireworks extends Launcher {
  constructor(room, surface, { onBurst, onEmber, onLaunch }) {
    super(room, surface, FIREWORK, onLaunch);
    this.onBurst = onBurst;
    this.onEmber = onEmber;
    this.sparks = [];
  }

  get busy() {
    return super.busy || this.sparks.length > 0;
  }

  launch() {
    const target = { x: this.aimX, y: this.aimY };
    return new Starshell({ x: this.aimX, y: -FIREWORK.reach * 2, vx: 0, vy: -FIREWORK.speed, reach: FIREWORK.reach, target });
  }

  steer(shell) {
    shell.vx = Math.sin(shell.age * WOBBLE_RATE) * FIREWORK.wobble;
  }

  impact(shell, { x, y }) {
    this.sparks.push(...Array.from({ length: FIREWORK.sparks }, () => new Spark(x, y, shell.hue)));
    this.onBurst({ ...FIREWORK.blow, x, y });
  }

  stow() {
    super.stow();
    this.sparks = [];
  }

  update(dt) {
    super.update(dt);
    this.sparks.forEach((spark) => {
      spark.update(dt);
      if (!spark.armed || !this.surface.contactAt(spark.x, spark.y, FIREWORK.sparkReach)) return;
      spark.spent = true;
      this.onEmber([{ ...FIREWORK.ember, x: spark.x, y: spark.y }]);
    });
    this.sparks = this.sparks.filter((spark) => !spark.gone);
  }

  draw(context, pixelsPerMeter) {
    super.draw(context, pixelsPerMeter);
    const pixel = 1 / pixelsPerMeter;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineWidth = SPARK.width * pixel;
    this.sparks.forEach(({ x, y, vx, vy, hue, age, life }) => {
      const fading = 1 - age / life;
      const speed = Math.hypot(vx, vy) || 1;
      context.strokeStyle = `rgba(${hue},${fading})`;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - (vx / speed) * SPARK.trail, y - (vy / speed) * SPARK.trail);
      context.stroke();
    });
    context.restore();
  }

  paint(context, pixel, { x, y, hue }) {
    context.save();
    context.strokeStyle = STICK_INK;
    context.lineWidth = STICK.width * pixel;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y + STICK.length);
    context.stroke();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(${SPARK.core},0.9)`;
    context.lineWidth = SPARK.width * 2 * pixel;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y - SPARK.trail / 3);
    context.stroke();
    context.strokeStyle = `rgba(${hue},0.6)`;
    context.beginPath();
    context.moveTo(x, y + STICK.length);
    context.lineTo(x, y + STICK.length * 2);
    context.stroke();
    context.restore();
  }
}
