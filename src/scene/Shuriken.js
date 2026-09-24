import { GRAVITY, SHURIKEN } from '../config.js';
import { inkOutline, steel } from '../core/canvas.js';
import { TAU, normalize, polar, rotate } from '../core/math.js';
import { Shell } from './Shell.js';
import { Thrower } from './Thrower.js';

const POINTS = 4;
const TIP = SHURIKEN.size;
const WAIST = SHURIKEN.size * 0.32;
const HOLE = SHURIKEN.size * 0.14;
const DROOP = 0.25;
const HOLE_INK = '#15171a';

class Star extends Shell {
  constructor(options, spin) {
    super(options);
    this.spin = spin;
  }
}

function paintStar(context, pixel) {
  context.fillStyle = steel(context, -TIP, -TIP, TIP, TIP);
  inkOutline(context, pixel);
  context.beginPath();
  for (let point = 0; point < POINTS; point++) {
    const angle = (point / POINTS) * TAU;
    context.lineTo(...polar(angle, TIP));
    context.lineTo(...polar(angle + Math.PI / POINTS, WAIST));
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = HOLE_INK;
  context.beginPath();
  context.arc(0, 0, HOLE, 0, TAU);
  context.fill();
}

export class Shuriken extends Thrower {
  constructor(room, surface, handlers) {
    super(room, surface, SHURIKEN, handlers);
  }

  windUp() {
    const room = SHURIKEN.capacity - this.shells.length;
    if (room <= 0) return;
    const turns = Array.from({ length: SHURIKEN.volley }, (_, index) => (index - (SHURIKEN.volley - 1) / 2) * SHURIKEN.fan);
    this.shells.push(...turns.slice(0, room).map((turn) => this.launch(turn)));
    this.onLaunch();
  }

  launch(turn) {
    const side = this.aimX >= 0 ? -1 : 1;
    const x = side * (this.room.halfWidth - SHURIKEN.inset);
    const y = -SHURIKEN.height;
    const [dx, dy] = rotate(...normalize(this.aimX - x, this.aimY - y), turn);
    return new Star({ x, y, vx: dx * SHURIKEN.speed, vy: dy * SHURIKEN.speed, reach: SHURIKEN.reach, gravity: GRAVITY * DROOP }, -side * SHURIKEN.spin);
  }

  paint(context, pixel, shell) {
    context.save();
    context.translate(shell.x, shell.y);
    context.rotate(shell.age * shell.spin);
    paintStar(context, pixel);
    context.restore();
  }

  paintBlade(context, pixel) {
    paintStar(context, pixel);
  }
}
