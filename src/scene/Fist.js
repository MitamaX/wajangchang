import { FIST } from '../config.js';
import { inkOutline, paintReticle, radiate, traceRoundRect } from '../core/canvas.js';
import { TAU, clamp, easeIn, easeOut, lerp, polar, randomBetween } from '../core/math.js';
import { Crack } from './Glass.js';
import { Tool } from './Tool.js';

const SIZE = FIST.size;
const BEHIND = 1.5;
const DRIFT = Object.freeze({ x: 0.16, y: 0.2 });
const ARM_ANGLE = Math.atan2(1, 0.45) - Math.PI / 2;
const FINGERS = [
  { left: -0.95, width: 0.5, top: -0.98 },
  { left: -0.46, width: 0.5, top: -1.04 },
  { left: 0.03, width: 0.47, top: -0.98 },
  { left: 0.49, width: 0.42, top: -0.86 },
];
const PALM = Object.freeze({ left: -0.94, top: -0.64, width: 1.86, height: 1.3, corner: 0.42 });
const THUMB = Object.freeze({ x: -0.86, y: 0.08, width: 0.32, height: 0.5, tilt: -0.35 });
const ARM = Object.freeze({ wrist: 0.62, length: 14, flare: 0.1, cuff: 1.25, band: 0.32 });
const SQUASH = Object.freeze({ wide: 1.08, tall: 0.93 });
const RUSH_LINES = Object.freeze({ count: 16, inner: 1.4, outer: [3.2, 5.2], width: 2.2, alpha: 0.55 });
const BURST = Object.freeze({ seconds: 0.11, points: 10, inner: 0.45, reach: [0.9, 1.9] });
const RING = Object.freeze({ seconds: 0.35, reach: 3.2, width: 5 });
const CRACK = Object.freeze({ spokes: [9, 13], reach: [0.22, 0.42], bends: 5, jitter: 0.16, rings: [0.3, 0.62], skip: 0.3, core: 0.02 });
const SKIN = ['#f6cfaa', '#e0a47c', '#b9765a'];
const KNUCKLE_SHINE = 'rgba(255,240,225,0.55)';
const CREASE = 'rgba(120,60,40,0.22)';
const SLEEVE = ['#394a6b', '#1c2438'];
const CUFF = '#d9d4c8';
const FLASH = '255,250,235';
const FLASH_EDGE = '255,210,120';

function shade(context, x0, y0, x1, y1, [light, middle, dark]) {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.55, middle);
  gradient.addColorStop(1, dark);
  return gradient;
}

function paintArm(context, pixel) {
  const far = ARM.wrist * (1 + ARM.flare * ARM.length);
  const cuffWidth = ARM.wrist * (1 + ARM.flare * ARM.cuff);
  const bandWidth = ARM.wrist * (1 + ARM.flare * (ARM.cuff + ARM.band));
  inkOutline(context, pixel);
  context.fillStyle = shade(context, -ARM.wrist, 0, ARM.wrist, 0, SKIN);
  context.beginPath();
  context.moveTo(-ARM.wrist, 0.4);
  context.lineTo(-cuffWidth, ARM.cuff);
  context.lineTo(cuffWidth, ARM.cuff);
  context.lineTo(ARM.wrist, 0.4);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = shade(context, -far, 0, far, 0, [SLEEVE[0], SLEEVE[0], SLEEVE[1]]);
  context.beginPath();
  context.moveTo(-cuffWidth, ARM.cuff);
  context.lineTo(-far, ARM.length);
  context.lineTo(far, ARM.length);
  context.lineTo(cuffWidth, ARM.cuff);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = CUFF;
  context.beginPath();
  context.moveTo(-cuffWidth, ARM.cuff);
  context.lineTo(-bandWidth, ARM.cuff + ARM.band);
  context.lineTo(bandWidth, ARM.cuff + ARM.band);
  context.lineTo(cuffWidth, ARM.cuff);
  context.closePath();
  context.fill();
  context.stroke();
}

function paintHand(context, pixel) {
  inkOutline(context, pixel);
  context.fillStyle = shade(context, 0, THUMB.y - THUMB.height, 0, THUMB.y + THUMB.height, SKIN);
  context.beginPath();
  context.ellipse(THUMB.x, THUMB.y, THUMB.width, THUMB.height, THUMB.tilt, 0, TAU);
  context.fill();
  context.stroke();
  FINGERS.forEach(({ left, width, top }) => {
    context.fillStyle = shade(context, 0, top, 0, PALM.top + 0.3, SKIN);
    traceRoundRect(context, left, top, width, PALM.top + 0.4 - top, width * 0.42);
    context.fill();
    context.stroke();
  });
  context.fillStyle = shade(context, PALM.left, PALM.top, PALM.left + PALM.width, PALM.top + PALM.height, SKIN);
  traceRoundRect(context, PALM.left, PALM.top, PALM.width, PALM.height, PALM.corner);
  context.fill();
  context.stroke();
  context.fillStyle = KNUCKLE_SHINE;
  FINGERS.forEach(({ left, width }) => {
    context.beginPath();
    context.ellipse(left + width / 2, PALM.top + 0.14, width * 0.3, 0.08, 0, 0, TAU);
    context.fill();
  });
  context.strokeStyle = CREASE;
  context.beginPath();
  FINGERS.forEach(({ left, width }) => {
    const x = left + width / 2;
    context.moveTo(x, PALM.top + 0.3);
    context.quadraticCurveTo(x * 0.7, PALM.top + 0.75, x * 0.35, PALM.top + PALM.height - 0.1);
  });
  context.stroke();
}

function paintBurst(context, { x, y, age, turn }) {
  const t = age / BURST.seconds;
  const radius = SIZE * lerp(...BURST.reach, easeOut(t));
  const fading = 1 - t;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.translate(x, y);
  context.rotate(turn);
  context.fillStyle = `rgba(${FLASH},${0.85 * fading})`;
  context.beginPath();
  for (let i = 0; i < BURST.points * 2; i++) context.lineTo(...polar((i / (BURST.points * 2)) * TAU, radius * (i % 2 ? BURST.inner : 1)));
  context.closePath();
  context.fill();
  context.restore();
  radiate(context, x, y, radius, [[0, `rgba(${FLASH},${fading})`], [0.5, `rgba(${FLASH_EDGE},${0.5 * fading})`], [1, `rgba(${FLASH_EDGE},0)`]]);
}

function paintRing(context, pixel, { x, y, age }) {
  const t = age / RING.seconds;
  context.save();
  context.strokeStyle = `rgba(${FLASH},${0.7 * (1 - t)})`;
  context.lineWidth = RING.width * pixel * (1 - t);
  context.beginPath();
  context.arc(x, y, SIZE * RING.reach * easeOut(t), 0, TAU);
  context.stroke();
  context.restore();
}

class Punch {
  constructor(x, y) {
    Object.assign(this, { x, y, age: 0, struck: false, turn: randomBetween(0, TAU) });
    this.rays = Array.from({ length: RUSH_LINES.count }, () => randomBetween(...RUSH_LINES.outer));
  }

  get strikeAt() {
    return FIST.windSeconds + FIST.punchSeconds;
  }

  get done() {
    return this.age >= this.strikeAt + FIST.holdSeconds + FIST.returnSeconds;
  }

  get rush() {
    const { age } = this;
    return age >= FIST.windSeconds && age < this.strikeAt ? (age - FIST.windSeconds) / FIST.punchSeconds : 0;
  }

  get depth() {
    const { age, strikeAt } = this;
    if (age < FIST.windSeconds) return lerp(BEHIND, 1, easeOut(age / FIST.windSeconds));
    if (age < strikeAt) return 1 - easeIn(this.rush);
    return BEHIND * easeIn(this.retreat);
  }

  get retreat() {
    return clamp((this.age - this.strikeAt - FIST.holdSeconds) / FIST.returnSeconds, 0, 1);
  }

  get alpha() {
    return this.age < FIST.windSeconds ? this.age / FIST.windSeconds : 1 - this.retreat;
  }

  get squash() {
    const since = this.age - this.strikeAt;
    return since >= 0 && since < FIST.holdSeconds ? 1 - since / FIST.holdSeconds : 0;
  }

  pose() {
    const { depth } = this;
    return { x: this.x + DRIFT.x * depth, y: this.y + DRIFT.y * depth, scale: SIZE * lerp(1, FIST.approach, depth) };
  }
}

export class Fist extends Tool {
  constructor(room, { onPunch, onSwing }) {
    super(room);
    this.onPunch = onPunch;
    this.onSwing = onSwing;
    this.punch = null;
    this.cracks = [];
    this.bursts = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.punch !== null || this.cracks.length > 0;
  }

  get pending() {
    return this.punch !== null && !this.punch.struck;
  }

  windUp() {
    if (this.punch) return;
    this.punch = new Punch(this.aimX, this.aimY);
    this.onSwing();
  }

  stow() {
    super.stow();
    this.punch = null;
    this.cracks = [];
    this.bursts = [];
  }

  update(dt) {
    this.cracks = this.cracks.filter((crack) => crack.update(dt));
    this.bursts = this.bursts.filter((burst) => (burst.age += dt) < RING.seconds);
    const { punch } = this;
    if (!punch) return;
    punch.age += dt;
    if (!punch.struck && punch.age >= punch.strikeAt) this.land(punch);
    if (punch.done) this.punch = null;
  }

  land(punch) {
    punch.struck = true;
    const { x, y, turn } = punch;
    this.cracks.push(new Crack(x, y, CRACK, FIST.crackSeconds));
    this.bursts.push({ x, y, age: 0, turn });
    this.onPunch({ ...FIST.blow, x, y });
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.cracks.forEach((crack) => crack.draw(context, pixel));
    this.bursts.forEach((burst) => {
      if (burst.age < BURST.seconds) paintBurst(context, burst);
      paintRing(context, pixel, burst);
    });
    if (this.punch) this.drawPunch(context, pixel, this.punch);
    else if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawPunch(context, pixel, punch) {
    const { x, y, scale } = punch.pose();
    if (punch.rush) this.drawRush(context, pixel, punch);
    const squash = punch.squash;
    context.save();
    context.globalAlpha = punch.alpha;
    context.translate(x, y);
    context.rotate(ARM_ANGLE);
    context.scale(scale * lerp(1, SQUASH.wide, squash), scale * lerp(1, SQUASH.tall, squash));
    paintArm(context, pixel / scale);
    paintHand(context, pixel / scale);
    context.restore();
  }

  drawRush(context, pixel, { x, y, rush, turn, rays }) {
    context.save();
    context.strokeStyle = `rgba(255,255,255,${RUSH_LINES.alpha * rush})`;
    context.lineWidth = RUSH_LINES.width * pixel;
    context.lineCap = 'round';
    context.beginPath();
    rays.forEach((outer, i) => {
      const heading = turn + (i / rays.length) * TAU;
      context.moveTo(x + Math.cos(heading) * SIZE * RUSH_LINES.inner, y + Math.sin(heading) * SIZE * RUSH_LINES.inner);
      context.lineTo(x + Math.cos(heading) * SIZE * outer, y + Math.sin(heading) * SIZE * outer);
    });
    context.stroke();
    context.restore();
  }
}
