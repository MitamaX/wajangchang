import { PUMP } from '../config.js';
import { inkOutline, radiate, steel, traceRoundRect } from '../core/canvas.js';
import { TAU, easeOut, lerp, normalize, polar } from '../core/math.js';
import { strokeOutlined } from './Chain.js';
import { Tool } from './Tool.js';

const FIRST_STROKE = 0.5;
const NEEDLE = Object.freeze({ length: 0.04, width: 0.0035, hub: 0.011, hubWidth: 0.008, tilt: 0.45 });
const BARREL = Object.freeze({ width: 0.03, height: 0.15, base: 0.09, foot: 0.008 });
const PLUNGER = Object.freeze({ travel: 0.06, rest: 0.008, rod: 0.006, grip: 0.07, thickness: 0.012 });
const GAUGE = Object.freeze({ radius: 0.012, drop: 0.035, start: Math.PI * 0.75, sweep: Math.PI * 1.5, needle: 0.8 });
const HOSE = Object.freeze({ thickness: 0.006, sag: 0.1, outlet: 0.02 });
const SHINE = Object.freeze({ offset: 0.35, reach: 0.8, alpha: 0.3 });
const POP = Object.freeze({ seconds: 0.3, rays: 12, inner: [0.6, 1.4], outer: [0.9, 2.4], width: 3 });
const PREVIEW_ALPHA = 0.55;
const RUBBER = '#26282c';
const OUTLINE = 'rgba(0,0,0,0.5)';
const PAINT = ['#e8453a', '#9e2019'];
const DIAL = '#f4f1e8';
const DIAL_NEEDLE = '#d8342b';
const SHINE_INK = '255,255,255';
const POP_INK = '255,250,235';

function paintNeedle(context, pixel, { x, y }, [dx, dy]) {
  context.save();
  context.translate(x, y);
  context.rotate(Math.atan2(dy, dx));
  inkOutline(context, pixel);
  context.fillStyle = steel(context, 0, -NEEDLE.width, 0, NEEDLE.width);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-NEEDLE.length, -NEEDLE.width / 2);
  context.lineTo(-NEEDLE.length, NEEDLE.width / 2);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = RUBBER;
  context.fillRect(-NEEDLE.length - NEEDLE.hub, -NEEDLE.hubWidth / 2, NEEDLE.hub, NEEDLE.hubWidth);
  context.strokeRect(-NEEDLE.length - NEEDLE.hub, -NEEDLE.hubWidth / 2, NEEDLE.hub, NEEDLE.hubWidth);
  context.restore();
}

function paintHose(context, pixel, [fromX, fromY], [toX, toY]) {
  context.save();
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.quadraticCurveTo((fromX + toX) / 2, Math.min(0, Math.max(fromY, toY) + HOSE.sag), toX, toY);
  strokeOutlined(context, pixel, HOSE.thickness, RUBBER, OUTLINE);
  context.restore();
}

function paintGauge(context, x, y, pressure) {
  context.fillStyle = DIAL;
  context.beginPath();
  context.arc(x, y, GAUGE.radius, 0, TAU);
  context.fill();
  context.stroke();
  const [dx, dy] = polar(GAUGE.start + GAUGE.sweep * pressure, GAUGE.radius * GAUGE.needle);
  context.save();
  context.strokeStyle = DIAL_NEEDLE;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + dx, y + dy);
  context.stroke();
  context.restore();
}

function paintPump(context, pixel, x, lift, pressure) {
  const { width, height, base, foot } = BARREL;
  const top = -foot - height;
  const grip = top - PLUNGER.rest - lift;
  inkOutline(context, pixel);
  context.fillStyle = RUBBER;
  traceRoundRect(context, x - base / 2, -foot, base, foot, foot / 2);
  context.fill();
  context.stroke();
  context.fillStyle = steel(context, x - PLUNGER.rod / 2, 0, x + PLUNGER.rod / 2, 0);
  context.fillRect(x - PLUNGER.rod / 2, grip, PLUNGER.rod, top - grip);
  context.strokeRect(x - PLUNGER.rod / 2, grip, PLUNGER.rod, top - grip);
  context.fillStyle = RUBBER;
  traceRoundRect(context, x - PLUNGER.grip / 2, grip - PLUNGER.thickness, PLUNGER.grip, PLUNGER.thickness, PLUNGER.thickness / 2);
  context.fill();
  context.stroke();
  const paint = context.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  paint.addColorStop(0, PAINT[0]);
  paint.addColorStop(1, PAINT[1]);
  context.fillStyle = paint;
  traceRoundRect(context, x - width / 2, top, width, height, width * 0.2);
  context.fill();
  context.stroke();
  paintGauge(context, x, top + GAUGE.drop, pressure);
}

function paintSwell(context, { x, y }, pressure) {
  const reach = PUMP.radius * SHINE.reach * pressure;
  if (reach <= 0) return;
  radiate(context, x - reach * SHINE.offset, y - reach * SHINE.offset, reach, [[0, `rgba(${SHINE_INK},${SHINE.alpha * pressure})`], [1, `rgba(${SHINE_INK},0)`]]);
}

function paintPop(context, pixel, { x, y, radius, age }) {
  const t = age / POP.seconds;
  const fading = 1 - t;
  const spread = easeOut(t);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = `rgba(${POP_INK},${fading})`;
  context.lineWidth = POP.width * pixel * fading;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(x, y, radius * spread, 0, TAU);
  for (let ray = 0; ray < POP.rays; ray++) {
    const [dx, dy] = polar((ray / POP.rays) * TAU, radius);
    context.moveTo(x + dx * lerp(...POP.inner, spread), y + dy * lerp(...POP.inner, spread));
    context.lineTo(x + dx * lerp(...POP.outer, spread), y + dy * lerp(...POP.outer, spread));
  }
  context.stroke();
  context.restore();
}

export class Pump extends Tool {
  constructor(room, surface, { onPlug, onInflate, onStroke, onPop }) {
    super(room);
    this.surface = surface;
    this.onPlug = onPlug;
    this.onInflate = onInflate;
    this.onStroke = onStroke;
    this.onPop = onPop;
    this.anchor = null;
    this.needle = null;
    this.strokes = 0;
    this.phase = 0;
    this.pops = [];
  }

  get spills() {
    return false;
  }

  get shown() {
    return this.active || this.busy;
  }

  get busy() {
    return this.anchor !== null || this.pops.length > 0;
  }

  get pending() {
    return this.anchor !== null;
  }

  get pressure() {
    return this.strokes / PUMP.strokes;
  }

  get side() {
    return (this.needle ? this.needle.x : this.aimX) >= 0 ? 1 : -1;
  }

  get direction() {
    return normalize(-this.side, NEEDLE.tilt);
  }

  get focus() {
    const { needle, pressure } = this;
    return needle ? { ...needle, radius: PUMP.radius * pressure, charge: lerp(...PUMP.tension, pressure) } : null;
  }

  windUp() {
    if (this.anchor) return;
    this.anchor = this.onPlug(this.aimX, this.aimY);
    this.phase = FIRST_STROKE;
    this.track();
  }

  release() {
    this.burst();
  }

  cancel() {
    this.unplug();
  }

  stow() {
    super.stow();
    this.unplug();
    this.pops = [];
  }

  unplug() {
    this.anchor = null;
    this.needle = null;
    this.strokes = 0;
  }

  track() {
    const pose = this.anchor && this.surface.hold(this.anchor);
    if (pose) this.needle = { x: pose.x, y: pose.y };
    else this.unplug();
  }

  burst() {
    const { needle, pressure } = this;
    this.unplug();
    if (!needle) return;
    const radius = lerp(...PUMP.radii, pressure);
    this.pops.push({ ...needle, radius, age: 0 });
    this.onPop({
      ...PUMP.pop,
      ...needle,
      radius,
      strength: lerp(...PUMP.strength, pressure),
      blast: { reach: radius * 3, speed: lerp(...PUMP.speed, pressure), heft: PUMP.heft },
      force: pressure,
    });
  }

  update(dt) {
    this.pops = this.pops.filter((pop) => (pop.age += dt) < POP.seconds);
    this.track();
    if (!this.anchor) return;
    this.phase += dt / PUMP.strokeSeconds;
    if (this.phase < 1) return;
    this.phase -= 1;
    this.strokes++;
    this.onStroke(this.pressure);
    if (!this.onInflate(this.anchor)) this.unplug();
    else if (this.strokes >= PUMP.strokes) this.burst();
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.pops.forEach((pop) => paintPop(context, pixel, pop));
    if (!this.shown) return;
    const { side, direction, needle } = this;
    const x = side * (this.room.halfWidth - PUMP.inset);
    const lift = needle ? PLUNGER.travel * (0.5 - 0.5 * Math.cos(this.phase * TAU)) : PLUNGER.travel;
    paintPump(context, pixel, x, lift, this.pressure);
    if (needle) {
      const reach = NEEDLE.length + NEEDLE.hub;
      paintSwell(context, needle, this.pressure);
      paintHose(context, pixel, [x - (side * BARREL.width) / 2, -BARREL.foot - HOSE.outlet], [needle.x - direction[0] * reach, needle.y - direction[1] * reach]);
      paintNeedle(context, pixel, needle, direction);
      return;
    }
    if (!this.present) return;
    context.save();
    context.globalAlpha = PREVIEW_ALPHA;
    paintNeedle(context, pixel, { x: this.aimX, y: this.aimY }, direction);
    context.restore();
  }
}
