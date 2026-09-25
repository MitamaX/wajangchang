import { CHARGE, HAMMER, SHATTER } from '../config.js';
import { steel, traceRoundRect } from '../core/canvas.js';
import { clamp, easeOut, lerp, randomBetween, rotate } from '../core/math.js';
import { MagicCircle, glow } from './MagicCircle.js';
import { Tool } from './Tool.js';

const FACE_SHARE = 0.56;
const GRIP_SHARE = 0.84;
const GLOW_REACH = 1.6;
const TRAIL_FRAMES = 5;
const SWOOSH_FROM_SPEED = 3;
const SWOOSH_FULL_SPEED = 9;
const SWOOSH_ALPHA = 0.35;
const SWOOSH_SPACING = 0.35;
const SWOOSH_WIDTHS = [4.2, 2.8, 1.4];
const OUTLINE_WIDTH = 1.2;
const RIDGE_WIDTH = 2;
const RIDGES = 6;

const Stance = Object.freeze({ REST: 'rest', CHARGE: 'charge', SWING: 'swing', RECOIL: 'recoil' });

const box = (left, top, right, bottom) => Object.freeze({ left, top, right, bottom });

const HEAD = box(-HAMMER.headWidth / 2, -HAMMER.headLength * (1 - FACE_SHARE), HAMMER.headWidth / 2, HAMMER.headLength * FACE_SHARE);
const HEAD_CENTER = (HEAD.top + HEAD.bottom) / 2;
const GRIP = HAMMER.length * GRIP_SHARE;
const SWOOSH_POINTS = SWOOSH_WIDTHS.map((_, streak) => [HEAD.left + streak * SWOOSH_SPACING * HAMMER.headWidth - GRIP, 0]);

function drawHandle(context, pixel) {
  const { length, handleWidth: thickness } = HAMMER;
  const wood = context.createLinearGradient(0, -thickness / 2, 0, thickness / 2);
  wood.addColorStop(0, '#dca56a');
  wood.addColorStop(1, '#8a5a2b');
  context.fillStyle = wood;
  traceRoundRect(context, 0, -thickness / 2, length, thickness, thickness / 2);
  context.fill();
  context.fillStyle = '#26282b';
  traceRoundRect(context, length * 0.66, -thickness * 0.62, length * 0.34, thickness * 1.24, thickness * 0.6);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < RIDGES; i++) context.fillRect(length * (0.69 + i * 0.05), -thickness * 0.62, RIDGE_WIDTH * pixel, thickness * 1.24);
}

function drawHead(context, pixel) {
  const { headWidth: width, headLength: length } = HAMMER;
  const corner = width * 0.18;
  context.fillStyle = steel(context, HEAD.left, 0, HEAD.right, 0);
  traceRoundRect(context, HEAD.left, HEAD.top, width, length, corner);
  context.fill();
  context.fillStyle = '#50565b';
  context.fillRect(HEAD.left, HEAD.bottom - width * 0.28, width, width * 0.28);
  context.strokeStyle = 'rgba(0,0,0,0.45)';
  context.lineWidth = OUTLINE_WIDTH * pixel;
  traceRoundRect(context, HEAD.left, HEAD.top, width, length, corner);
  context.stroke();
}

export class Hammer extends Tool {
  constructor(room, { onStrike, onTier }) {
    super(room);
    this.onStrike = onStrike;
    this.onTier = onTier;
    this.stance = Stance.REST;
    this.charge = 0;
    this.tier = 0;
    this.lift = HAMMER.restLift;
    this.from = HAMMER.restLift;
    this.elapsed = 0;
    this.spin = 0;
    this.trail = [];
    this.circle = new MagicCircle();
  }

  get visible() {
    return this.present || this.stance !== Stance.REST;
  }

  get busy() {
    return this.stance !== Stance.REST || this.circle.busy;
  }

  get charging() {
    return this.stance === Stance.CHARGE || this.stance === Stance.SWING;
  }

  get radius() {
    return lerp(CHARGE.minRadius, CHARGE.maxRadius, this.charge);
  }

  get focus() {
    return this.charging ? { x: this.aimX, y: this.aimY, radius: this.radius, charge: this.charge } : null;
  }

  aim(x, y) {
    if (this.stance === Stance.SWING) this.present = true;
    else super.aim(x, y);
  }

  windUp() {
    if (this.stance === Stance.SWING) return;
    this.enter(Stance.CHARGE);
    this.charge = 0;
    this.tier = 0;
  }

  release() {
    if (this.stance === Stance.CHARGE) this.enter(Stance.SWING);
  }

  cancel() {
    if (this.stance === Stance.CHARGE) this.enter(Stance.RECOIL);
  }

  stow() {
    this.enter(Stance.REST);
    this.lift = HAMMER.restLift;
    this.present = false;
  }

  enter(stance) {
    this.stance = stance;
    this.from = this.lift;
    this.elapsed = 0;
  }

  update(dt) {
    const previous = this.lift;
    this.elapsed += dt;
    if (this.stance === Stance.CHARGE) this.gather();
    else if (this.stance === Stance.SWING) this.swing();
    else if (this.stance === Stance.RECOIL) this.settle();
    this.spin = dt ? (this.lift - previous) / dt : 0;
    this.track();
    this.circle.update(dt, this.focus);
  }

  gather() {
    this.charge = Math.min(1, this.elapsed / CHARGE.seconds);
    const raise = easeOut(Math.min(1, this.elapsed / HAMMER.raiseSeconds));
    const quiver = randomBetween(-1, 1) * HAMMER.tremble * this.charge * this.charge;
    const drawBack = lerp(HAMMER.windUpLift, HAMMER.fullLift, this.charge);
    this.lift = lerp(this.from, drawBack, raise) + quiver;
    this.climb();
  }

  climb() {
    const tier = CHARGE.tiers.filter((threshold) => this.charge >= threshold).length;
    if (tier > this.tier) this.onTier(tier);
    this.tier = tier;
  }

  swing() {
    const progress = Math.min(1, this.elapsed / lerp(...HAMMER.swingSeconds, this.charge));
    this.lift = this.from * (1 - progress ** lerp(...HAMMER.swingWeight, this.charge));
    if (progress < 1) return;
    const blow = this.blow();
    this.circle.discharge();
    this.enter(Stance.RECOIL);
    this.onStrike(blow);
  }

  settle() {
    const progress = Math.min(1, this.elapsed / HAMMER.recoilSeconds);
    this.lift = lerp(this.from, HAMMER.restLift, easeOut(progress));
    if (progress === 1) this.stance = Stance.REST;
  }

  blow() {
    const { aimX: x, aimY: y, charge, radius } = this;
    return {
      x,
      y,
      normalX: 0,
      normalY: 1,
      radius,
      strength: lerp(CHARGE.minStrength, CHARGE.maxStrength, charge),
      hits: 1 + Math.round((CHARGE.hits - 1) * charge),
      falloff: CHARGE.falloff,
      shatter: charge >= 1 && SHATTER,
      spray: lerp(1, CHARGE.spray, charge),
      burst: lerp(1, CHARGE.burst, charge),
      contact: HAMMER.headWidth / 2,
      blast: { reach: radius * CHARGE.blastReach, speed: CHARGE.blastSpeed * charge, heft: CHARGE.blastHeft },
      force: charge,
      newtons: lerp(...CHARGE.newtons, charge),
      cue: 'discharge',
    };
  }

  track() {
    this.trail.unshift(SWOOSH_POINTS.flatMap(([x, y]) => rotate(x, y, this.lift)));
    if (this.trail.length > TRAIL_FRAMES) this.trail.pop();
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.circle.draw(context, pixel);
    if (!this.visible) return;
    context.save();
    context.translate(this.aimX + GRIP, this.aimY - HEAD.bottom);
    this.drawSwoosh(context, pixel);
    context.rotate(this.lift);
    context.translate(-GRIP, 0);
    drawHandle(context, pixel);
    drawHead(context, pixel);
    if (this.charging) glow(context, 0, HEAD_CENTER, HAMMER.headLength * GLOW_REACH, this.charge);
    context.restore();
  }

  drawSwoosh(context, pixel) {
    const strength = clamp((Math.abs(this.spin) * GRIP - SWOOSH_FROM_SPEED) / (SWOOSH_FULL_SPEED - SWOOSH_FROM_SPEED), 0, 1);
    if (!strength) return;
    context.save();
    context.lineCap = 'round';
    SWOOSH_WIDTHS.forEach((width, streak) => {
      context.lineWidth = width * pixel;
      for (let age = 1; age < this.trail.length; age++) {
        const newer = this.trail[age - 1];
        const older = this.trail[age];
        context.strokeStyle = `rgba(255,255,255,${SWOOSH_ALPHA * strength * (1 - age / this.trail.length)})`;
        context.beginPath();
        context.moveTo(newer[streak * 2], newer[streak * 2 + 1]);
        context.lineTo(older[streak * 2], older[streak * 2 + 1]);
        context.stroke();
      }
    });
    context.restore();
  }
}
