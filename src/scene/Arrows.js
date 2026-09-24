import { ARROWS, GRAVITY } from '../config.js';
import { inkOutline, steel } from '../core/canvas.js';
import { normalize, randomBetween } from '../core/math.js';
import { Shell } from './Shell.js';
import { Thrower } from './Thrower.js';

const SKY_GAP = 0.05;
const SHAFT = Object.freeze({ length: 0.075, width: 1.8 });
const HEAD = Object.freeze({ length: 0.012, width: 0.0045 });
const FLETCH = Object.freeze({ length: 0.016, width: 0.0055, sweep: 0.006 });
const SHAFT_INK = '#6b4526';
const FEATHER = '#d8423a';

function paintArrow(context, pixel) {
  context.strokeStyle = SHAFT_INK;
  context.lineWidth = SHAFT.width * pixel;
  context.beginPath();
  context.moveTo(-SHAFT.length, 0);
  context.lineTo(-HEAD.length, 0);
  context.stroke();
  context.fillStyle = FEATHER;
  [-1, 1].forEach((side) => {
    context.beginPath();
    context.moveTo(-SHAFT.length, 0);
    context.lineTo(-SHAFT.length - FLETCH.sweep, side * FLETCH.width);
    context.lineTo(-SHAFT.length + FLETCH.length, 0);
    context.closePath();
    context.fill();
  });
  context.fillStyle = steel(context, -HEAD.length, -HEAD.width, 0, HEAD.width);
  inkOutline(context, pixel);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-HEAD.length, -HEAD.width);
  context.lineTo(-HEAD.length, HEAD.width);
  context.closePath();
  context.fill();
  context.stroke();
}

export class Arrows extends Thrower {
  constructor(room, surface, handlers) {
    super(room, surface, ARROWS, handlers);
  }

  windUp() {
    const room = ARROWS.capacity - this.shells.length;
    if (room <= 0) return;
    this.shells.push(...Array.from({ length: Math.min(room, ARROWS.volley) }, () => this.launch()));
    this.onLaunch();
  }

  launch() {
    const x = this.aimX + randomBetween(-ARROWS.spread, ARROWS.spread);
    const skyY = -this.room.ceiling - SKY_GAP - randomBetween(0, ARROWS.lag);
    const fromX = x - ARROWS.slant * (this.aimY - skyY);
    const [dx, dy] = normalize(x - fromX, this.aimY - skyY);
    return new Shell({ x: fromX, y: skyY, vx: dx * ARROWS.speed, vy: dy * ARROWS.speed, reach: ARROWS.reach, gravity: GRAVITY });
  }

  paint(context, pixel, shell) {
    context.save();
    context.translate(shell.x, shell.y);
    context.rotate(shell.heading);
    paintArrow(context, pixel);
    context.restore();
  }

  paintBlade(context, pixel) {
    paintArrow(context, pixel);
  }
}
