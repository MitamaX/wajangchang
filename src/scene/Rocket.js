import { ROCKET } from '../config.js';
import { inkOutline, radiate } from '../core/canvas.js';
import { TAU, normalize, randomBetween } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Shell } from './Shell.js';

const HALF_LENGTH = ROCKET.length / 2;
const HALF_WIDTH = ROCKET.width / 2;
const NOSE = ROCKET.length * 0.28;
const FIN = Object.freeze({ reach: ROCKET.width * 0.9, length: ROCKET.length * 0.26 });
const FLAME = Object.freeze({ length: [0.7, 1.2], reach: 0.05 });
const HULL = ['#f3f4f2', '#a9adb0'];
const NOSE_PAINT = '#e0402f';
const FIN_PAINT = '#3b3f44';
const FLAME_CORE = '255,246,210';
const FLAME_EDGE = '255,140,40';

class Missile extends Shell {
  constructor(options) {
    super(options);
    this.phase = randomBetween(0, TAU);
  }
}

function paintFlame(context) {
  const length = ROCKET.length * randomBetween(...FLAME.length);
  radiate(context, -HALF_LENGTH, 0, FLAME.reach, [
    [0, `rgba(${FLAME_CORE},0.9)`],
    [0.4, `rgba(${FLAME_EDGE},0.5)`],
    [1, `rgba(${FLAME_EDGE},0)`],
  ]);
  context.fillStyle = `rgba(${FLAME_CORE},0.9)`;
  context.beginPath();
  context.moveTo(-HALF_LENGTH, -HALF_WIDTH * 0.7);
  context.lineTo(-HALF_LENGTH - length, 0);
  context.lineTo(-HALF_LENGTH, HALF_WIDTH * 0.7);
  context.closePath();
  context.fill();
}

function paintHull(context, pixel) {
  const hull = context.createLinearGradient(0, -HALF_WIDTH, 0, HALF_WIDTH);
  hull.addColorStop(0, HULL[0]);
  hull.addColorStop(1, HULL[1]);
  inkOutline(context, pixel);
  context.fillStyle = FIN_PAINT;
  [-1, 1].forEach((side) => {
    context.beginPath();
    context.moveTo(-HALF_LENGTH + FIN.length, side * HALF_WIDTH);
    context.lineTo(-HALF_LENGTH, side * (HALF_WIDTH + FIN.reach));
    context.lineTo(-HALF_LENGTH, side * HALF_WIDTH);
    context.closePath();
    context.fill();
    context.stroke();
  });
  context.fillStyle = hull;
  context.fillRect(-HALF_LENGTH, -HALF_WIDTH, ROCKET.length - NOSE, ROCKET.width);
  context.strokeRect(-HALF_LENGTH, -HALF_WIDTH, ROCKET.length - NOSE, ROCKET.width);
  context.fillStyle = NOSE_PAINT;
  context.beginPath();
  context.moveTo(HALF_LENGTH - NOSE, -HALF_WIDTH);
  context.quadraticCurveTo(HALF_LENGTH, -HALF_WIDTH * 0.4, HALF_LENGTH, 0);
  context.quadraticCurveTo(HALF_LENGTH, HALF_WIDTH * 0.4, HALF_LENGTH - NOSE, HALF_WIDTH);
  context.closePath();
  context.fill();
  context.stroke();
}

export class Rocket extends Launcher {
  constructor(room, surface, { onImpact, onTrail, onLaunch }) {
    super(room, surface, ROCKET, onLaunch);
    this.onImpact = onImpact;
    this.onTrail = onTrail;
  }

  launch() {
    const side = this.aimX >= 0 ? -1 : 1;
    const x = side * (this.room.halfWidth - ROCKET.inset);
    const y = -ROCKET.height;
    const [dx, dy] = normalize(this.aimX - x, this.aimY - y);
    const target = { x: this.aimX, y: this.aimY };
    return new Missile({ x, y, vx: dx * ROCKET.launchSpeed, vy: dy * ROCKET.launchSpeed, reach: ROCKET.reach, target });
  }

  steer(shell, dt) {
    const speed = Math.min(ROCKET.maxSpeed, shell.speed + ROCKET.thrust * dt);
    const wobble = ROCKET.wobble * Math.sin(shell.age * ROCKET.wobbleRate + shell.phase) * Math.exp(-shell.age * ROCKET.settle);
    const heading = Math.atan2(shell.target.y - shell.y, shell.target.x - shell.x) + wobble;
    shell.vx = Math.cos(heading) * speed;
    shell.vy = Math.sin(heading) * speed;
  }

  fly(shell) {
    const [dx, dy] = normalize(shell.vx, shell.vy);
    this.onTrail(shell.x - dx * HALF_LENGTH, shell.y - dy * HALF_LENGTH);
  }

  impact(shell, { x, y }) {
    const blow = { ...ROCKET.blow, x, y };
    this.blasts.add(blow);
    this.onImpact(blow);
  }

  paint(context, pixel, shell) {
    context.save();
    context.translate(shell.x, shell.y);
    context.rotate(shell.heading);
    paintFlame(context);
    paintHull(context, pixel);
    context.restore();
  }
}
