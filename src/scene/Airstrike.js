import { BOMBER, GRAVITY } from '../config.js';
import { inkOutline } from '../core/canvas.js';
import { TAU } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Shell } from './Shell.js';

const PLANE = Object.freeze({ length: BOMBER.size, height: BOMBER.size * 0.22, wing: BOMBER.size * 0.45, tail: BOMBER.size * 0.28 });
const BOMB = Object.freeze({ length: 0.026, width: 0.009, fin: 0.007 });
const DROP_SHARE = 0.6;
const HULL = '#5e6a74';
const BOMB_INK = '#2d3238';

function paintPlane(context, pixel, x, y, direction) {
  const { length, height, wing, tail } = PLANE;
  context.save();
  context.translate(x, y);
  context.scale(direction, 1);
  inkOutline(context, pixel);
  context.fillStyle = HULL;
  context.beginPath();
  context.moveTo(length / 2, 0);
  context.quadraticCurveTo(length / 2, -height, length / 4, -height);
  context.lineTo(-length / 2, -height * 0.6);
  context.lineTo(-length / 2 - tail * 0.2, -height - tail);
  context.lineTo(-length / 2 + tail * 0.4, -height - tail);
  context.lineTo(-length / 4, -height * 0.9);
  context.lineTo(-length / 2, height * 0.3);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(length * 0.1, -height * 0.3);
  context.lineTo(-length * 0.15, wing * 0.35);
  context.lineTo(-length * 0.25, wing * 0.35);
  context.lineTo(-length * 0.1, -height * 0.3);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function paintBomb(context, pixel, { x, y, heading }) {
  context.save();
  context.translate(x, y);
  context.rotate(heading);
  inkOutline(context, pixel);
  context.fillStyle = BOMB_INK;
  context.beginPath();
  context.ellipse(0, 0, BOMB.length / 2, BOMB.width / 2, 0, 0, TAU);
  context.moveTo(-BOMB.length / 2, 0);
  context.lineTo(-BOMB.length / 2 - BOMB.fin, -BOMB.width);
  context.lineTo(-BOMB.length / 2 - BOMB.fin, BOMB.width);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

export class Airstrike extends Launcher {
  constructor(room, surface, { onImpact, onLaunch }) {
    super(room, surface, BOMBER, onLaunch);
    this.onImpact = onImpact;
    this.planes = [];
  }

  get busy() {
    return super.busy || this.planes.length > 0;
  }

  get pending() {
    return super.pending || this.planes.length > 0;
  }

  windUp() {
    if (this.planes.length >= BOMBER.capacity) return;
    const direction = this.aimX >= 0 ? 1 : -1;
    const drops = Array.from({ length: BOMBER.bombs }, (_, index) => this.aimX + BOMBER.spread * (index / (BOMBER.bombs - 1) - 0.5));
    this.planes.push({ x: -direction * (this.room.halfWidth + BOMBER.size), y: -this.room.ceiling * BOMBER.altitude, direction, drops });
    this.onLaunch();
  }

  stow() {
    super.stow();
    this.planes = [];
  }

  update(dt) {
    super.update(dt);
    this.planes.forEach((plane) => this.cruise(plane, dt));
    this.planes = this.planes.filter((plane) => Math.abs(plane.x) < this.room.halfWidth + BOMBER.size * 2);
  }

  cruise(plane, dt) {
    const from = plane.x;
    plane.x += plane.direction * BOMBER.speed * dt;
    const released = plane.drops.filter((dropX) => (dropX - from) * plane.direction >= 0 && (dropX - plane.x) * plane.direction < 0);
    plane.drops = plane.drops.filter((dropX) => !released.includes(dropX));
    released.forEach((dropX) => {
      this.shells.push(new Shell({ x: dropX, y: plane.y, vx: plane.direction * BOMBER.speed * DROP_SHARE, vy: 0, reach: BOMBER.reach, gravity: GRAVITY }));
    });
  }

  impact(shell, { x, y }) {
    const blow = { ...BOMBER.blow, x, y };
    this.blasts.add(blow);
    this.onImpact(blow);
  }

  draw(context, pixelsPerMeter) {
    super.draw(context, pixelsPerMeter);
    const pixel = 1 / pixelsPerMeter;
    this.planes.forEach(({ x, y, direction }) => paintPlane(context, pixel, x, y, direction));
  }

  paint(context, pixel, shell) {
    paintBomb(context, pixel, shell);
  }
}
