import { AXE, GRAVITY } from '../config.js';
import { inkOutline, steel } from '../core/canvas.js';
import { Shell } from './Shell.js';
import { Thrower } from './Thrower.js';

const HEAD = Object.freeze({ depth: 0.042, blade: 0.028, heel: 0.014, eye: 0.03 });
const HANDLE = Object.freeze({ length: 0.15, width: 0.012 });
const CENTER = Object.freeze({ x: -HEAD.eye, y: HANDLE.length * 0.35 });
const EDGE_CURVE = [HEAD.depth * 0.12, 0, 0, HEAD.blade];
const EDGE_WIDTH = 1.4;
const EDGE = 'rgba(255,255,255,0.8)';
const WOOD = ['#d49a5c', '#8a5a2b'];

class Hatchet extends Shell {
  constructor(options, spin) {
    super(options);
    this.spin = spin;
  }

  get angle() {
    return this.age * this.spin;
  }
}

function paintHandle(context) {
  const left = -HEAD.eye - HANDLE.width / 2;
  const wood = context.createLinearGradient(left, 0, left + HANDLE.width, 0);
  wood.addColorStop(0, WOOD[0]);
  wood.addColorStop(1, WOOD[1]);
  context.fillStyle = wood;
  context.fillRect(left, -HEAD.heel, HANDLE.width, HANDLE.length + HEAD.heel);
  context.strokeRect(left, -HEAD.heel, HANDLE.width, HANDLE.length + HEAD.heel);
}

function traceEdge(context) {
  context.moveTo(0, -HEAD.blade);
  context.quadraticCurveTo(...EDGE_CURVE);
}

function paintHead(context, pixel) {
  context.fillStyle = steel(context, -HEAD.depth, 0, 0, 0);
  context.beginPath();
  context.moveTo(-HEAD.depth, -HEAD.heel);
  context.lineTo(-HEAD.depth * 0.45, -HEAD.heel);
  context.quadraticCurveTo(-HEAD.depth * 0.1, -HEAD.blade, 0, -HEAD.blade);
  context.quadraticCurveTo(...EDGE_CURVE);
  context.quadraticCurveTo(-HEAD.depth * 0.2, HEAD.blade * 0.8, -HEAD.depth * 0.45, HEAD.heel);
  context.lineTo(-HEAD.depth, HEAD.heel);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = EDGE;
  context.lineWidth = EDGE_WIDTH * pixel;
  context.beginPath();
  traceEdge(context);
  context.stroke();
}

function paintAxe(context, pixel) {
  inkOutline(context, pixel);
  paintHandle(context);
  paintHead(context, pixel);
}

export class Axe extends Thrower {
  constructor(room, surface, handlers) {
    super(room, surface, AXE, handlers);
  }

  launch() {
    const side = this.aimX >= 0 ? -1 : 1;
    const x = side * (this.room.halfWidth - AXE.inset);
    const y = -AXE.height;
    const time = AXE.flightSeconds;
    const vx = (this.aimX - x) / time;
    const vy = (this.aimY - y) / time - (GRAVITY * time) / 2;
    return new Hatchet({ x, y, vx, vy, reach: AXE.reach, gravity: GRAVITY }, -side * AXE.spin);
  }

  paint(context, pixel, shell) {
    context.save();
    context.translate(shell.x, shell.y);
    context.rotate(shell.angle + shell.heading);
    context.translate(-CENTER.x, -CENTER.y);
    paintAxe(context, pixel);
    context.restore();
  }

  paintBlade(context, pixel) {
    paintAxe(context, pixel);
  }
}
