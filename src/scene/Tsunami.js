import { GRAVITY, TSUNAMI } from '../config.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const CREST_SHARE = 0.35;
const TAIL_HEIGHT = 0.8;
const CURL = Object.freeze({ reach: 0.07, drop: 0.35 });
const RIPPLE = Object.freeze({ step: 0.02, depth: 0.012, wave: 30, speed: 9 });
const FOAM_WIDTH = 2.4;
const DEEP = '30,90,170';
const SHALLOW = '110,185,245';
const FOAM = 'rgba(240,250,255,0.9)';
const WATER_ALPHA = 0.6;

function traceCrest(context, points, { front, direction }) {
  const [, crestY] = points.at(-1);
  points.forEach(([x, y]) => context.lineTo(x, y));
  context.quadraticCurveTo(front + direction * CURL.reach, crestY, front + direction * CURL.reach * 0.6, crestY * (1 - CURL.drop));
}

class Wave {
  constructor(direction, halfWidth) {
    this.direction = direction;
    this.start = -direction * halfWidth;
    this.end = direction * halfWidth;
    this.front = this.start;
    this.fade = 1;
    this.slam = TSUNAMI.slamSeconds;
    this.age = 0;
  }

  get arrived() {
    return this.front === this.end;
  }

  get flowing() {
    return this.slam > 0;
  }

  get travelled() {
    return Math.abs(this.front - this.start);
  }

  heightBehind(behind) {
    const crest = CREST_SHARE * TSUNAMI.band;
    if (behind <= crest) return TSUNAMI.height * (0.6 + (0.4 * behind) / crest);
    const share = Math.min(1, (behind - crest) / TSUNAMI.band);
    return TSUNAMI.height * (1 - (1 - TAIL_HEIGHT) * share);
  }

  surface(x) {
    const behind = (this.front - x) * this.direction;
    if (behind < 0 || behind > this.travelled) return null;
    return -this.heightBehind(behind) * this.fade + Math.sin(x * RIPPLE.wave - this.age * RIPPLE.speed) * RIPPLE.depth * this.fade;
  }
}

export class Tsunami extends Tool {
  constructor(room, { onEngage, onSweep, onBatter, onSplash, onSurf, onCrash }) {
    super(room);
    this.onEngage = onEngage;
    this.onSweep = onSweep;
    this.onBatter = onBatter;
    this.onSplash = onSplash;
    this.onSurf = onSurf;
    this.onCrash = onCrash;
    this.wave = null;
    this.surfs = new Pulse(TSUNAMI.surfSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.wave !== null;
  }

  get pending() {
    return this.busy && this.wave.flowing;
  }

  windUp() {
    if (this.wave) return;
    this.wave = new Wave(this.aimX >= 0 ? 1 : -1, this.room.halfWidth);
    this.onEngage();
    this.onCrash();
  }

  stow() {
    super.stow();
    this.wave = null;
  }

  update(dt) {
    const { wave } = this;
    if (!wave) return;
    wave.age += dt;
    if (!wave.arrived) this.surge(wave, dt);
    else if (wave.flowing) wave.slam -= dt;
    else wave.fade -= dt / TSUNAMI.recedeSeconds;
    if (wave.fade <= 0) {
      this.wave = null;
      return;
    }
    this.onSweep((x, y, vx) => this.carry(wave, x, y, vx, dt));
    if (this.surfs.tick(dt)) this.onSurf(TSUNAMI.surfSeconds);
  }

  surge(wave, dt) {
    const from = wave.front;
    const front = from + wave.direction * TSUNAMI.speed * dt;
    wave.front = wave.direction * front >= wave.direction * wave.end ? wave.end : front;
    this.onBatter({ from, to: wave.front, direction: wave.direction, height: TSUNAMI.height });
    this.onSplash(wave.front, -TSUNAMI.height);
  }

  carry(wave, x, y, vx, dt) {
    const level = wave.surface(x);
    if (level === null || y < level) return null;
    const flow = wave.flowing ? wave.direction * TSUNAMI.speed : 0;
    return [(flow - vx) * TSUNAMI.grip * wave.fade * dt, -GRAVITY * TSUNAMI.buoyancy * wave.fade * dt];
  }

  draw(context, pixelsPerMeter) {
    const { wave } = this;
    if (!wave) return;
    const pixel = 1 / pixelsPerMeter;
    const { direction, front, start } = wave;
    const points = [];
    for (let x = start; (front - x) * direction >= 0; x += direction * RIPPLE.step) points.push([x, wave.surface(x)]);
    points.push([front, wave.surface(front)]);
    const water = context.createLinearGradient(0, -TSUNAMI.height, 0, 0);
    water.addColorStop(0, `rgba(${SHALLOW},${WATER_ALPHA * wave.fade})`);
    water.addColorStop(1, `rgba(${DEEP},${WATER_ALPHA * wave.fade})`);
    context.save();
    context.fillStyle = water;
    context.beginPath();
    context.moveTo(start, 0);
    traceCrest(context, points, wave);
    context.lineTo(front, 0);
    context.closePath();
    context.fill();
    context.strokeStyle = FOAM;
    context.lineWidth = FOAM_WIDTH * pixel;
    context.lineJoin = 'round';
    context.beginPath();
    traceCrest(context, points, wave);
    context.stroke();
    context.restore();
  }
}
