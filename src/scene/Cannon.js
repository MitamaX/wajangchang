import { CANNON, GRAVITY } from '../config.js';
import { inkOutline, paintReticle } from '../core/canvas.js';
import { TAU, normalize } from '../core/math.js';
import { Artillery } from './Artillery.js';

const MIN_FLIGHT = 0.18;
const BARREL = Object.freeze({ length: 0.11, bore: 0.034, muzzle: 0.042, recoil: 0.025 });
const WHEEL = Object.freeze({ radius: 0.032, spokes: 6, hub: 0.008 });
const IRON = ['#5d6166', '#1d1f22'];
const WOOD = '#7a4d27';
const SHINE = 'rgba(255,255,255,0.35)';

function iron(context, radius) {
  const shade = context.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.1, 0, 0, radius);
  shade.addColorStop(0, IRON[0]);
  shade.addColorStop(1, IRON[1]);
  return shade;
}

export class Cannon extends Artillery {
  constructor(room, physics, surface, { onHit, onLand, onFire }) {
    super(room, physics, surface, CANNON, { onHit, onLand });
    this.onFire = onFire;
    this.life = CANNON;
    this.recoil = 0;
    this.reload = CANNON.reloadSeconds;
  }

  get shown() {
    return this.active || this.busy;
  }

  get side() {
    return this.aimX >= 0 ? -1 : 1;
  }

  get base() {
    return [this.side * (this.room.halfWidth - CANNON.inset), -WHEEL.radius];
  }

  get muzzle() {
    const [x, y] = this.base;
    const [dx, dy] = this.heading;
    return [x + dx * BARREL.length, y + dy * BARREL.length];
  }

  get heading() {
    return normalize(...this.velocity(...this.base));
  }

  velocity(fromX, fromY) {
    const time = Math.max(MIN_FLIGHT, Math.hypot(this.aimX - fromX, this.aimY - fromY) / CANNON.speed);
    return [(this.aimX - fromX) / time, (this.aimY - fromY) / time - (GRAVITY * time) / 2];
  }

  windUp() {
    if (!this.loaded || this.reload < CANNON.reloadSeconds) return;
    const [x, y] = this.muzzle;
    const [vx, vy] = this.velocity(x, y);
    this.launch({ x, y, angle: 0, vx, vy, spin: 0 });
    this.recoil = 1;
    this.reload = 0;
    this.onFire(x, y);
  }

  shape(body) {
    this.physics.attachBall(body, CANNON.radius, this.body);
  }

  probe(shot) {
    return this.surface.contactAt(shot.x, shot.y, CANNON.radius * 1.3);
  }

  update(dt) {
    super.update(dt);
    this.reload += dt;
    this.recoil = Math.max(0, this.recoil - dt / CANNON.recoilSeconds);
  }

  paint(context, pixel) {
    context.fillStyle = iron(context, CANNON.radius);
    inkOutline(context, pixel);
    context.beginPath();
    context.arc(0, 0, CANNON.radius, 0, TAU);
    context.fill();
    context.stroke();
  }

  draw(context, pixelsPerMeter) {
    super.draw(context, pixelsPerMeter);
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    this.drawGun(context, pixel);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawGun(context, pixel) {
    const [x, y] = this.base;
    const [dx, dy] = this.heading;
    context.save();
    context.translate(x, y);
    inkOutline(context, pixel);
    context.save();
    context.rotate(Math.atan2(dy, dx));
    context.translate(-BARREL.recoil * this.recoil, 0);
    context.fillStyle = iron(context, BARREL.length);
    context.beginPath();
    context.moveTo(-BARREL.bore * 0.3, -BARREL.bore / 2);
    context.lineTo(BARREL.length, -BARREL.muzzle / 2);
    context.lineTo(BARREL.length, BARREL.muzzle / 2);
    context.lineTo(-BARREL.bore * 0.3, BARREL.bore / 2);
    context.arc(-BARREL.bore * 0.3, 0, BARREL.bore / 2, TAU / 4, (TAU * 3) / 4);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = SHINE;
    context.beginPath();
    context.moveTo(0, -BARREL.bore * 0.3);
    context.lineTo(BARREL.length * 0.9, -BARREL.muzzle * 0.3);
    context.stroke();
    context.restore();
    context.fillStyle = WOOD;
    inkOutline(context, pixel);
    context.beginPath();
    context.arc(0, 0, WHEEL.radius, 0, TAU);
    context.fill();
    context.stroke();
    context.beginPath();
    for (let spoke = 0; spoke < WHEEL.spokes; spoke++) {
      const angle = (spoke / WHEEL.spokes) * TAU;
      context.moveTo(0, 0);
      context.lineTo(Math.cos(angle) * WHEEL.radius, Math.sin(angle) * WHEEL.radius);
    }
    context.stroke();
    context.fillStyle = IRON[1];
    context.beginPath();
    context.arc(0, 0, WHEEL.hub, 0, TAU);
    context.fill();
    context.restore();
  }
}
