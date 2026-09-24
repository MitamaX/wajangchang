import { BOOMERANG } from '../config.js';
import { inkOutline, paintReticle } from '../core/canvas.js';
import { TAU, normalize } from '../core/math.js';
import { Tool } from './Tool.js';

const ARM = Object.freeze({ length: BOOMERANG.size, width: BOOMERANG.size * 0.34, bend: 0.95 });
const TRAIL = Object.freeze({ width: 5, alpha: 0.3 });
const WOOD = ['#e2b071', '#9a6431'];
const TRAIL_INK = '255,255,255';
const RETURN_SQUASH = 0.3;
const FLOOR_CLEARANCE = 0.01;

function paintBoomerang(context, pixel) {
  const wood = context.createLinearGradient(-ARM.length, 0, ARM.length, 0);
  wood.addColorStop(0, WOOD[0]);
  wood.addColorStop(1, WOOD[1]);
  context.fillStyle = wood;
  inkOutline(context, pixel);
  context.beginPath();
  [-1, 1].forEach((side) => {
    const tipX = Math.cos(ARM.bend) * ARM.length * side;
    const tipY = Math.sin(ARM.bend) * ARM.length;
    context.moveTo(0, -ARM.width / 2);
    context.quadraticCurveTo(tipX * 0.5, tipY * 0.2 - ARM.width, tipX, tipY);
    context.quadraticCurveTo(tipX * 0.5, tipY * 0.2 + ARM.width * 0.4, 0, ARM.width / 2);
    context.closePath();
  });
  context.fill();
  context.stroke();
}

class Flight {
  constructor(fromX, fromY, toX, toY) {
    const span = Math.hypot(toX - fromX, toY - fromY);
    const [alongX, alongY] = normalize(toX - fromX, toY - fromY);
    const lift = (alongX >= 0 ? -1 : 1) * BOOMERANG.bow * span;
    this.middle = [(fromX + toX) / 2, (fromY + toY) / 2];
    this.major = [(alongX * span) / 2, (alongY * span) / 2];
    this.minor = [-alongY * lift, alongX * lift];
    this.age = 0;
    this.trail = [];
    this.biting = false;
    [this.x, this.y] = this.at(0);
  }

  at(share) {
    const angle = Math.PI - share * TAU;
    const [middleX, middleY] = this.middle;
    const sway = Math.sin(angle) * (angle < 0 ? RETURN_SQUASH : 1);
    return [
      middleX + this.major[0] * Math.cos(angle) + this.minor[0] * sway,
      Math.min(-FLOOR_CLEARANCE, middleY + this.major[1] * Math.cos(angle) + this.minor[1] * sway),
    ];
  }

  get share() {
    return Math.min(1, this.age / BOOMERANG.flightSeconds);
  }

  get home() {
    return this.share >= 1;
  }

  advance(dt) {
    this.trail.unshift([this.x, this.y]);
    if (this.trail.length > BOOMERANG.trail) this.trail.pop();
    this.age += dt;
    const [fromX, fromY] = [this.x, this.y];
    [this.x, this.y] = this.at(this.share);
    return { ax: fromX, ay: fromY, bx: this.x, by: this.y };
  }
}

export class Boomerang extends Tool {
  constructor(room, { onSlice, onThrow }) {
    super(room);
    this.onSlice = onSlice;
    this.onThrow = onThrow;
    this.flights = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.flights.length > 0;
  }

  get pending() {
    return this.busy;
  }

  windUp() {
    if (this.flights.length >= BOOMERANG.capacity) return;
    const side = this.aimX >= 0 ? -1 : 1;
    this.flights.push(new Flight(side * (this.room.halfWidth - BOOMERANG.inset), -BOOMERANG.height, this.aimX, this.aimY));
    this.onThrow();
  }

  stow() {
    super.stow();
    this.flights = [];
  }

  update(dt) {
    this.flights.forEach((flight) => {
      const line = flight.advance(dt);
      flight.biting = this.onSlice(line, !flight.biting);
    });
    this.flights = this.flights.filter((flight) => !flight.home);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.flights.forEach((flight) => this.drawFlight(context, pixel, flight));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawFlight(context, pixel, flight) {
    context.save();
    context.lineCap = 'round';
    context.lineWidth = TRAIL.width * pixel;
    flight.trail.reduce(([fromX, fromY], [toX, toY], index) => {
      context.strokeStyle = `rgba(${TRAIL_INK},${TRAIL.alpha * (1 - index / flight.trail.length)})`;
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.stroke();
      return [toX, toY];
    }, [flight.x, flight.y]);
    context.translate(flight.x, flight.y);
    context.rotate(flight.age * BOOMERANG.spin);
    paintBoomerang(context, pixel);
    context.restore();
  }
}
