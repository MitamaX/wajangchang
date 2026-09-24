import { FIST } from '../config.js';
import { inkOutline, paintReticle, traceRoundRect } from '../core/canvas.js';
import { easeIn, easeOut, lerp } from '../core/math.js';
import { Tool } from './Tool.js';

const SIZE = FIST.size;
const PALM = Object.freeze({ length: SIZE, height: SIZE * 0.85, corner: SIZE * 0.28 });
const KNUCKLES = 4;
const THUMB = Object.freeze({ length: SIZE * 0.55, height: SIZE * 0.26, drop: SIZE * 0.12 });
const SLEEVE = Object.freeze({ height: SIZE * 0.62, cuff: SIZE * 0.2 });
const LINES = Object.freeze({ count: 3, length: SIZE * 1.6, spread: SIZE * 0.3, width: 1.6, alpha: 0.55 });
const SKIN = '#f0c090';
const SKIN_SHADE = 'rgba(120,60,20,0.35)';
const CLOTH = '#3f6fb5';
const CUFF = '#e8e4da';

function paintFist(context, pixel) {
  inkOutline(context, pixel);
  context.fillStyle = SKIN;
  traceRoundRect(context, -PALM.length, -PALM.height / 2, PALM.length, PALM.height, PALM.corner);
  context.fill();
  context.stroke();
  context.strokeStyle = SKIN_SHADE;
  context.beginPath();
  for (let knuckle = 1; knuckle < KNUCKLES; knuckle++) {
    const y = -PALM.height / 2 + (knuckle / KNUCKLES) * PALM.height;
    context.moveTo(-PALM.length * 0.35, y);
    context.lineTo(0, y);
  }
  context.stroke();
  inkOutline(context, pixel);
  context.fillStyle = SKIN;
  traceRoundRect(context, -PALM.length * 0.9, PALM.height / 2 - THUMB.height - THUMB.drop, THUMB.length, THUMB.height, THUMB.height / 2);
  context.fill();
  context.stroke();
}

function paintSleeve(context, pixel, reach) {
  inkOutline(context, pixel);
  context.fillStyle = CLOTH;
  context.fillRect(-reach, -SLEEVE.height / 2, reach - PALM.length * 0.8, SLEEVE.height);
  context.strokeRect(-reach, -SLEEVE.height / 2, reach - PALM.length * 0.8, SLEEVE.height);
  context.fillStyle = CUFF;
  context.fillRect(-PALM.length * 0.8 - SLEEVE.cuff, -SLEEVE.height / 2, SLEEVE.cuff, SLEEVE.height);
  context.strokeRect(-PALM.length * 0.8 - SLEEVE.cuff, -SLEEVE.height / 2, SLEEVE.cuff, SLEEVE.height);
}

class Swing {
  constructor(side, fromX, toX, y) {
    Object.assign(this, { side, fromX, toX, y, age: 0, struck: false });
  }

  get strikeAt() {
    return FIST.windSeconds + FIST.punchSeconds;
  }

  get done() {
    return this.age >= this.strikeAt + FIST.holdSeconds + FIST.returnSeconds;
  }

  get x() {
    const { age, strikeAt, fromX, toX } = this;
    if (age < FIST.windSeconds) return fromX;
    if (age < strikeAt) return lerp(fromX, toX, easeIn((age - FIST.windSeconds) / FIST.punchSeconds));
    const back = Math.max(0, age - strikeAt - FIST.holdSeconds) / FIST.returnSeconds;
    return lerp(toX, fromX, easeOut(Math.min(1, back)));
  }

  get rushing() {
    return this.age >= FIST.windSeconds && this.age < this.strikeAt;
  }
}

export class Fist extends Tool {
  constructor(room, { onPunch, onSwing }) {
    super(room);
    this.onPunch = onPunch;
    this.onSwing = onSwing;
    this.swing = null;
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.swing !== null;
  }

  get pending() {
    return this.busy && !this.swing.struck;
  }

  windUp() {
    if (this.swing) return;
    const side = this.aimX >= 0 ? -1 : 1;
    this.swing = new Swing(side, side * (this.room.halfWidth + SIZE), this.aimX, this.aimY);
    this.onSwing();
  }

  stow() {
    super.stow();
    this.swing = null;
  }

  update(dt) {
    const { swing } = this;
    if (!swing) return;
    swing.age += dt;
    if (!swing.struck && swing.age >= swing.strikeAt) {
      swing.struck = true;
      const direction = -swing.side;
      this.onPunch({ ...FIST.blow, x: swing.toX, y: swing.y, normalX: direction, normalY: 0 }, [direction, 0]);
    }
    if (swing.done) this.swing = null;
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    if (this.swing) this.drawSwing(context, pixel, this.swing);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawSwing(context, pixel, swing) {
    const { x, y, side } = swing;
    const reach = Math.abs(x - side * (this.room.halfWidth + SIZE * 2));
    context.save();
    context.translate(x, y);
    context.scale(-side, 1);
    if (swing.rushing) {
      context.strokeStyle = `rgba(255,255,255,${LINES.alpha})`;
      context.lineWidth = LINES.width * pixel;
      context.beginPath();
      for (let line = 0; line < LINES.count; line++) {
        const offset = (line - (LINES.count - 1) / 2) * LINES.spread;
        context.moveTo(-PALM.length - LINES.length, offset);
        context.lineTo(-PALM.length * 1.2, offset);
      }
      context.stroke();
    }
    paintSleeve(context, pixel, reach);
    paintFist(context, pixel);
    context.restore();
  }
}
