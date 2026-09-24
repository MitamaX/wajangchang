import { ORBITAL } from '../config.js';
import { paintReticle, radiate } from '../core/canvas.js';
import { TAU, easeOut } from '../core/math.js';
import { Tool } from './Tool.js';

const GUIDE = Object.freeze({ width: 1.2, dash: 6, alpha: 0.7 });
const TARGET = Object.freeze({ radius: 0.045, width: 1.6, blink: 10, shrink: 0.5 });
const BEAM = Object.freeze({ glow: 2.4, core: 0.45 });
const SPOT_REACH = 3;
const WARN = '255,70,60';
const RAY = '120,220,255';
const RAY_CORE = '245,252,255';

class Strike {
  constructor(x) {
    this.x = x;
    this.age = 0;
    this.burnt = 0;
    this.fired = false;
    this.landed = false;
  }

  get locking() {
    return this.age < ORBITAL.lockSeconds;
  }

  get progress() {
    return Math.min(1, (this.age - ORBITAL.lockSeconds) / ORBITAL.fireSeconds);
  }

  get brightness() {
    return 1 - Math.max(0, this.age - ORBITAL.lockSeconds - ORBITAL.fireSeconds) / ORBITAL.fadeSeconds;
  }

  get gone() {
    return this.brightness <= 0;
  }
}

export class Orbital extends Tool {
  constructor(room, { onLock, onFire, onBurn }) {
    super(room);
    this.onLock = onLock;
    this.onFire = onFire;
    this.onBurn = onBurn;
    this.strikes = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.strikes.length > 0;
  }

  get pending() {
    return this.strikes.some((strike) => strike.progress < 1);
  }

  windUp() {
    if (this.strikes.length >= ORBITAL.capacity) return;
    this.strikes.push(new Strike(this.aimX));
    this.onLock();
  }

  stow() {
    super.stow();
    this.strikes = [];
  }

  update(dt) {
    this.strikes.forEach((strike) => {
      strike.age += dt;
      if (strike.locking) return;
      if (!strike.fired) {
        strike.fired = true;
        this.onFire(strike.x);
      }
      if (strike.burnt < 1) this.burn(strike);
    });
    this.strikes = this.strikes.filter((strike) => !strike.gone);
  }

  burn(strike) {
    const { ceiling } = this.room;
    const { progress } = strike;
    const band = { x: strike.x, top: -ceiling * (1 - strike.burnt), bottom: -ceiling * (1 - progress), first: !strike.landed };
    strike.landed = this.onBurn(band) || strike.landed;
    strike.burnt = progress;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.strikes.forEach((strike) => (strike.locking ? this.drawLock(context, pixel, strike) : this.drawBeam(context, strike)));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawLock(context, pixel, { x, age }) {
    const lit = Math.sin(age * TARGET.blink * TAU) > 0;
    const radius = TARGET.radius * (1 - TARGET.shrink * (age / ORBITAL.lockSeconds));
    context.save();
    context.strokeStyle = `rgba(${WARN},${GUIDE.alpha})`;
    context.lineWidth = GUIDE.width * pixel;
    context.setLineDash([GUIDE.dash * pixel, GUIDE.dash * pixel]);
    context.beginPath();
    context.moveTo(x, -this.room.ceiling);
    context.lineTo(x, 0);
    context.stroke();
    context.setLineDash([]);
    context.lineWidth = TARGET.width * pixel;
    context.strokeStyle = `rgba(${WARN},${lit ? 1 : GUIDE.alpha})`;
    context.beginPath();
    context.arc(x, 0, radius, 0, TAU);
    context.stroke();
    context.restore();
  }

  drawBeam(context, strike) {
    const { x, brightness } = strike;
    const { halfWidth } = ORBITAL;
    const top = -this.room.ceiling * 2;
    const bottom = -this.room.ceiling * (1 - easeOut(strike.progress));
    const glow = context.createLinearGradient(x - halfWidth * BEAM.glow, 0, x + halfWidth * BEAM.glow, 0);
    glow.addColorStop(0, `rgba(${RAY},0)`);
    glow.addColorStop(0.5 - BEAM.core / BEAM.glow / 2, `rgba(${RAY},${0.7 * brightness})`);
    glow.addColorStop(0.5, `rgba(${RAY_CORE},${brightness})`);
    glow.addColorStop(0.5 + BEAM.core / BEAM.glow / 2, `rgba(${RAY},${0.7 * brightness})`);
    glow.addColorStop(1, `rgba(${RAY},0)`);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = glow;
    context.fillRect(x - halfWidth * BEAM.glow, top, halfWidth * BEAM.glow * 2, bottom - top);
    context.restore();
    radiate(context, x, bottom, halfWidth * SPOT_REACH, [[0, `rgba(${RAY_CORE},${brightness})`], [1, `rgba(${RAY},0)`]]);
  }
}
