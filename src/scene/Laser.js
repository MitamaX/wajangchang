import { LASER } from '../config.js';
import { radiate, steel, strokeLayers, traceRoundRect } from '../core/canvas.js';
import { TAU, randomBetween } from '../core/math.js';
import { Ray } from './Ray.js';

const BARREL = Object.freeze({ length: 0.07, width: 0.018 });
const HOUSING_RADIUS = 0.026;
const FLICKER = [0.8, 1.15];
const GLOW = Object.freeze({ width: 9, alpha: 0.4 });
const CORE_WIDTH = 2;
const SPOT_REACH = 0.028;
const LENS = '#ff3b30';
const RAY = '255,60,40';
const RAY_CORE = '255,236,230';

export class Laser extends Ray {
  constructor(room, surface, { onSear, onGlance, onHum }) {
    super(room, surface, LASER, LASER.searSeconds, onHum);
    this.onSear = onSear;
    this.onGlance = onGlance;
  }

  get base() {
    return [-this.room.halfWidth + LASER.mount, -this.room.height + LASER.mount];
  }

  get barrel() {
    return BARREL.length;
  }

  land({ x, y }, first) {
    return this.onSear({ x, y, radius: LASER.radius, first });
  }

  miss({ x, y }) {
    this.onGlance(x, y);
  }

  drawBeam(context, pixel) {
    const [x, y] = this.muzzle;
    const { x: endX, y: endY } = this.end;
    const flicker = this.power * randomBetween(...FLICKER);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    strokeLayers(context, pixel * flicker, [[GLOW.width, `rgba(${RAY},${GLOW.alpha * this.power})`], [CORE_WIDTH, `rgba(${RAY_CORE},${this.power})`]]);
    context.restore();
    radiate(context, endX, endY, SPOT_REACH * flicker, [
      [0, `rgba(${RAY_CORE},${this.power})`],
      [0.35, `rgba(${RAY},${0.6 * this.power})`],
      [1, `rgba(${RAY},0)`],
    ]);
  }

  paintHead(context) {
    context.fillStyle = steel(context, 0, -BARREL.width / 2, 0, BARREL.width / 2);
    traceRoundRect(context, 0, -BARREL.width / 2, BARREL.length, BARREL.width, BARREL.width * 0.3);
    context.fill();
    context.stroke();
    context.fillStyle = LENS;
    context.fillRect(BARREL.length - BARREL.width * 0.3, -BARREL.width * 0.3, BARREL.width * 0.3, BARREL.width * 0.6);
    context.fillStyle = steel(context, -HOUSING_RADIUS, -HOUSING_RADIUS, HOUSING_RADIUS, HOUSING_RADIUS);
    context.beginPath();
    context.arc(0, 0, HOUSING_RADIUS, 0, TAU);
    context.fill();
    context.stroke();
  }
}
