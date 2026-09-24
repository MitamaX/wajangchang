import { JACKHAMMER } from '../config.js';
import { steel, strokeOutline, traceRoundRect } from '../core/canvas.js';
import { TAU, randomBetween } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const CHISEL = Object.freeze({ length: 0.07, width: 0.008, tip: 0.012 });
const BODY = Object.freeze({ length: 0.1, width: 0.034, corner: 0.006 });
const COLLAR = Object.freeze({ height: 0.014, width: 0.024 });
const HANDLE = Object.freeze({ reach: 0.055, grip: 0.028, thickness: 0.011, rise: 0.02 });
const GRIP = '#26282b';
const PAINT = '#d9412b';

function paintChisel(context, pixel) {
  context.fillStyle = steel(context, -CHISEL.width / 2, 0, CHISEL.width / 2, 0);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(CHISEL.width / 2, -CHISEL.tip);
  context.lineTo(CHISEL.width / 2, -CHISEL.length);
  context.lineTo(-CHISEL.width / 2, -CHISEL.length);
  context.lineTo(-CHISEL.width / 2, -CHISEL.tip);
  context.closePath();
  context.fill();
  strokeOutline(context, pixel);
}

function paintHandle(context, top) {
  const bar = top + HANDLE.rise;
  const span = BODY.width / 2 + HANDLE.reach;
  context.fillStyle = GRIP;
  traceRoundRect(context, -span, bar, span * 2, HANDLE.thickness, HANDLE.thickness / 2);
  context.fill();
  [-span, span - HANDLE.thickness].forEach((x) => {
    traceRoundRect(context, x, bar - HANDLE.grip / 2, HANDLE.thickness, HANDLE.grip, HANDLE.thickness / 2);
    context.fill();
  });
}

function paintBody(context, pixel) {
  const collarTop = -CHISEL.length - COLLAR.height;
  const bodyTop = collarTop - BODY.length;
  paintHandle(context, bodyTop);
  context.fillStyle = steel(context, -COLLAR.width / 2, 0, COLLAR.width / 2, 0);
  context.beginPath();
  context.rect(-COLLAR.width / 2, collarTop, COLLAR.width, COLLAR.height);
  context.fill();
  strokeOutline(context, pixel);
  context.fillStyle = PAINT;
  traceRoundRect(context, -BODY.width / 2, bodyTop, BODY.width, BODY.length, BODY.corner);
  context.fill();
  strokeOutline(context, pixel);
}

export class Jackhammer extends Tool {
  constructor(room, { onPound }) {
    super(room);
    this.onPound = onPound;
    this.holding = false;
    this.phase = 0;
    this.strokes = new Pulse(1 / JACKHAMMER.rate);
  }

  get busy() {
    return this.holding;
  }

  get pounding() {
    return this.holding && this.present;
  }

  get focus() {
    return this.pounding ? { x: this.aimX, y: this.aimY, radius: JACKHAMMER.round.radius, charge: JACKHAMMER.tension } : null;
  }

  windUp() {
    this.holding = true;
    this.strokes.reset();
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  update(dt) {
    if (!this.pounding) return;
    this.phase = (this.phase + dt * JACKHAMMER.rate) % 1;
    if (this.strokes.tick(dt)) this.onPound([{ ...JACKHAMMER.round, x: this.aimX, y: this.aimY }]);
  }

  draw(context, pixelsPerMeter) {
    if (!this.present) return;
    const pixel = 1 / pixelsPerMeter;
    const pounding = this.pounding;
    const lift = pounding ? (1 - Math.cos(this.phase * TAU)) * JACKHAMMER.stroke * 0.5 : JACKHAMMER.stroke;
    const shake = pounding ? JACKHAMMER.shake : 0;
    context.save();
    context.translate(this.aimX + randomBetween(-shake, shake), this.aimY - lift);
    paintChisel(context, pixel);
    context.translate(0, randomBetween(-shake, shake));
    paintBody(context, pixel);
    context.restore();
  }
}
