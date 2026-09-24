import { BOWLING } from '../config.js';
import { inkOutline, paintReticle } from '../core/canvas.js';
import { TAU, polar } from '../core/math.js';
import { Artillery } from './Artillery.js';

const DROP = 0.02;
const HOLES = Object.freeze({ radius: BOWLING.radius * 0.13, reach: BOWLING.radius * 0.45, spread: 0.45 });
const SHINE = Object.freeze({ x: -0.35, y: -0.4, core: 0.1 });
const RESIN = ['#6a4bd1', '#1c1240'];
const HOLE = '#0b0816';

export class Bowling extends Artillery {
  constructor(room, physics, surface, { onHit, onLand, onRoll }) {
    super(room, physics, surface, BOWLING, { onHit, onLand });
    this.onRoll = onRoll;
    this.life = BOWLING;
  }

  windUp() {
    if (!this.loaded) return;
    const side = this.aimX >= 0 ? -1 : 1;
    const x = side * (this.room.halfWidth - BOWLING.inset);
    this.launch({ x, y: -BOWLING.radius - DROP, angle: 0, vx: -side * BOWLING.speed, vy: 0, spin: -side * BOWLING.spin });
    this.onRoll();
  }

  shape(body) {
    this.physics.attachBall(body, BOWLING.radius, this.body);
  }

  probe(shot) {
    return this.surface.contactAt(shot.x, shot.y, BOWLING.radius * 1.3);
  }

  paint(context, pixel) {
    const { radius } = BOWLING;
    const shade = context.createRadialGradient(SHINE.x * radius, SHINE.y * radius, SHINE.core * radius, 0, 0, radius);
    shade.addColorStop(0, RESIN[0]);
    shade.addColorStop(1, RESIN[1]);
    context.fillStyle = shade;
    inkOutline(context, pixel);
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.fill();
    context.stroke();
    context.fillStyle = HOLE;
    [-1, 0, 1].forEach((offset) => {
      const [x, y] = polar(-Math.PI / 2 + offset * HOLES.spread, HOLES.reach);
      context.beginPath();
      context.arc(x, y, HOLES.radius, 0, TAU);
      context.fill();
    });
  }

  draw(context, pixelsPerMeter) {
    super.draw(context, pixelsPerMeter);
    if (this.present) paintReticle(context, this.aimX, this.aimY, 1 / pixelsPerMeter);
  }
}
