import { RAIL } from '../config.js';
import { inkOutline, paintReticle, radiate, steel, strokeLayers } from '../core/canvas.js';
import { TAU, easeOut, normalize } from '../core/math.js';
import { Tool } from './Tool.js';

const RAILS = Object.freeze({ length: 0.09, gap: 0.014, thickness: 0.006, coils: 4 });
const TRACE = Object.freeze({ glow: 10, core: 2.2, rings: 7, ring: 0.012 });
const CHARGE_REACH = 0.05;
const RAY = '150,120,255';
const RAY_CORE = '240,236,255';

export class Railgun extends Tool {
  constructor(room, { onCharge, onFire }) {
    super(room);
    this.onCharge = onCharge;
    this.onFire = onFire;
    this.charge = null;
    this.traces = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.charge !== null || this.traces.length > 0;
  }

  get pending() {
    return this.charge !== null;
  }

  get shown() {
    return this.active || this.busy;
  }

  get muzzle() {
    const side = this.aimX >= 0 ? -1 : 1;
    return [side * (this.room.halfWidth - RAIL.inset), -RAIL.height];
  }

  get heading() {
    const [x, y] = this.muzzle;
    return normalize(this.aimX - x, this.aimY - y);
  }

  windUp() {
    if (this.charge !== null) return;
    this.charge = 0;
    this.onCharge();
  }

  stow() {
    super.stow();
    this.charge = null;
    this.traces = [];
  }

  update(dt) {
    this.traces = this.traces.filter((trace) => (trace.age += dt) < RAIL.traceSeconds);
    if (this.charge === null) return;
    this.charge += dt;
    if (this.charge >= RAIL.chargeSeconds) this.fire();
  }

  fire() {
    const [ax, ay] = this.muzzle;
    const [dx, dy] = this.heading;
    const reach = this.room.reach(ax, ay, dx, dy);
    const line = { ax, ay, bx: ax + dx * reach, by: ay + dy * reach };
    this.charge = null;
    this.traces.push({ ...line, age: 0 });
    this.onFire(line);
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    this.traces.forEach((trace) => this.drawTrace(context, pixel, trace));
    this.drawEmitter(context, pixel);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawTrace(context, pixel, { ax, ay, bx, by, age }) {
    const fading = 1 - age / RAIL.traceSeconds;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(ax, ay);
    context.lineTo(bx, by);
    strokeLayers(context, pixel * fading, [[TRACE.glow, `rgba(${RAY},0.45)`], [TRACE.core, `rgba(${RAY_CORE},1)`]]);
    const spread = easeOut(1 - fading);
    context.strokeStyle = `rgba(${RAY},${0.6 * fading})`;
    context.lineWidth = pixel;
    context.beginPath();
    for (let ring = 1; ring <= TRACE.rings; ring++) {
      const share = ring / (TRACE.rings + 1);
      const x = ax + (bx - ax) * share;
      const y = ay + (by - ay) * share;
      context.moveTo(x + TRACE.ring * (1 + spread * 2), y);
      context.arc(x, y, TRACE.ring * (1 + spread * 2), 0, TAU);
    }
    context.stroke();
    context.restore();
  }

  drawEmitter(context, pixel) {
    const [x, y] = this.muzzle;
    const [dx, dy] = this.heading;
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(dy, dx));
    inkOutline(context, pixel);
    context.fillStyle = steel(context, 0, -RAILS.gap, 0, RAILS.gap);
    [-1, 1].forEach((side) => {
      const top = side * RAILS.gap - (side < 0 ? RAILS.thickness : 0);
      context.fillRect(-RAILS.length / 2, top, RAILS.length, RAILS.thickness);
      context.strokeRect(-RAILS.length / 2, top, RAILS.length, RAILS.thickness);
    });
    context.fillStyle = `rgba(${RAY},0.8)`;
    for (let coil = 0; coil < RAILS.coils; coil++) {
      const along = -RAILS.length / 2 + (coil + 0.5) * (RAILS.length / RAILS.coils) - RAILS.thickness / 2;
      context.fillRect(along, -RAILS.gap, RAILS.thickness, RAILS.gap * 2);
    }
    context.restore();
    if (this.charge !== null) {
      const level = this.charge / RAIL.chargeSeconds;
      radiate(context, x, y, CHARGE_REACH * level, [[0, `rgba(${RAY_CORE},${level})`], [1, `rgba(${RAY},0)`]]);
    }
  }
}
