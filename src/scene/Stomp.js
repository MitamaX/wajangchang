import { STOMP } from '../config.js';
import { inkOutline, paintReticle } from '../core/canvas.js';
import { TAU, easeIn, easeOut, lerp } from '../core/math.js';
import { Tool } from './Tool.js';

const SIZE = STOMP.size;
const SOLE = Object.freeze({ heel: SIZE * 0.55, toe: SIZE * 0.75, thickness: SIZE * 0.22 });
const TOES = Object.freeze({ count: 4, radius: SIZE * 0.13 });
const LEG = Object.freeze({ width: SIZE * 0.55, offset: -SIZE * 0.2 });
const SKY_GAP = 0.1;
const SKIN = '#e8b48a';
const SOLE_INK = '#b98460';

function paintFoot(context, pixel, x, bottom, sky) {
  inkOutline(context, pixel);
  context.fillStyle = SKIN;
  const legLeft = x + LEG.offset - LEG.width / 2;
  context.fillRect(legLeft, sky, LEG.width, bottom - SOLE.thickness - sky);
  context.strokeRect(legLeft, sky, LEG.width, bottom - SOLE.thickness - sky);
  context.beginPath();
  context.moveTo(x - SOLE.heel, bottom);
  context.lineTo(x + SOLE.toe, bottom);
  context.quadraticCurveTo(x + SOLE.toe + TOES.radius, bottom - SOLE.thickness * 0.5, x + SOLE.toe - TOES.radius, bottom - SOLE.thickness * 1.4);
  context.lineTo(legLeft + LEG.width, bottom - SOLE.thickness * 1.6);
  context.lineTo(legLeft, bottom - SOLE.thickness * 1.6);
  context.quadraticCurveTo(x - SOLE.heel - TOES.radius, bottom - SOLE.thickness, x - SOLE.heel, bottom);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = SOLE_INK;
  for (let toe = 0; toe < TOES.count; toe++) {
    context.beginPath();
    context.arc(x + SOLE.toe - TOES.radius * (1 + toe * 1.7), bottom - SOLE.thickness * 1.25, TOES.radius * (1 - toe * 0.12), 0, TAU);
    context.fill();
    context.stroke();
  }
}

class Step {
  constructor(x, sky) {
    this.x = x;
    this.sky = sky;
    this.target = 0;
    this.age = 0;
    this.struck = false;
  }

  get bottom() {
    const { dropSeconds, holdSeconds, liftSeconds } = STOMP;
    if (this.age < dropSeconds) return lerp(this.sky, this.target, easeIn(this.age / dropSeconds));
    const lifted = Math.max(0, this.age - dropSeconds - holdSeconds) / liftSeconds;
    return lerp(this.target, this.sky, easeOut(Math.min(1, lifted)));
  }

  get due() {
    return !this.struck && this.age >= STOMP.dropSeconds;
  }

  get done() {
    return this.age >= STOMP.dropSeconds + STOMP.holdSeconds + STOMP.liftSeconds;
  }
}

export class Stomp extends Tool {
  constructor(room, surface, { onStomp }) {
    super(room);
    this.surface = surface;
    this.onStomp = onStomp;
    this.step = null;
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.step !== null;
  }

  get pending() {
    return this.busy && !this.step.struck;
  }

  windUp() {
    if (this.step) return;
    this.step = new Step(this.aimX, -this.room.ceiling - SKY_GAP);
    this.step.target = this.landing(this.aimX);
  }

  stow() {
    super.stow();
    this.step = null;
  }

  landing(x) {
    const hit = this.surface.raycast(x, -this.room.ceiling, x, 0);
    return hit ? hit.y : 0;
  }

  update(dt) {
    const { step } = this;
    if (!step) return;
    if (step.age < STOMP.dropSeconds) step.target = this.landing(step.x);
    step.age += dt;
    if (step.due) {
      step.struck = true;
      this.onStomp({ ...STOMP.blow, x: step.x, y: step.target });
    }
    if (step.done) this.step = null;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    if (this.step) paintFoot(context, pixel, this.step.x, this.step.bottom, -this.room.ceiling * 2);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
