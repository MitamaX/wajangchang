import { GRAVITY, VOLCANO } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, polar, randomBetween } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Shell } from './Shell.js';

const FADE_SECONDS = 0.6;
const MOUND = Object.freeze({ width: VOLCANO.crater * 1.8, height: VOLCANO.crater * 0.55 });
const GLOW_REACH = 3;
const TRAIL = Object.freeze({ width: 2.2, points: 5 });
const ROCK = '#3b2a22';
const CRUST = '#1c120d';
const MAGMA = '255,120,30';
const MAGMA_CORE = '255,230,150';

function paintVent(context, x, heat) {
  context.fillStyle = ROCK;
  context.beginPath();
  context.moveTo(x - MOUND.width, 0);
  context.quadraticCurveTo(x - VOLCANO.crater * 0.6, -MOUND.height, x - VOLCANO.crater * 0.35, -MOUND.height);
  context.lineTo(x + VOLCANO.crater * 0.35, -MOUND.height);
  context.quadraticCurveTo(x + VOLCANO.crater * 0.6, -MOUND.height, x + MOUND.width, 0);
  context.closePath();
  context.fill();
  radiate(context, x, -MOUND.height, VOLCANO.crater * GLOW_REACH * heat, [
    [0, `rgba(${MAGMA_CORE},${heat})`],
    [0.3, `rgba(${MAGMA},${0.6 * heat})`],
    [1, `rgba(${MAGMA},0)`],
  ]);
}

export class Volcano extends Launcher {
  constructor(room, surface, { onImpact, onSmoke, onErupt }) {
    super(room, surface, VOLCANO, onErupt);
    this.onImpact = onImpact;
    this.onSmoke = onSmoke;
    this.vents = [];
  }

  get busy() {
    return super.busy || this.vents.length > 0;
  }

  get pending() {
    return super.pending || this.vents.some((vent) => vent.age < VOLCANO.eruptSeconds);
  }

  windUp() {
    this.vents.push({ x: this.aimX, age: 0, spawned: 0 });
    this.onLaunch();
  }

  stow() {
    super.stow();
    this.vents = [];
  }

  launch(x) {
    const [vx, vy] = polar(-Math.PI / 2 + randomBetween(-VOLCANO.cone, VOLCANO.cone) / 2, randomBetween(...VOLCANO.speed));
    return new Shell({ x, y: -MOUND.height, vx, vy, reach: VOLCANO.reach, gravity: GRAVITY, arm: VOLCANO.arm });
  }

  update(dt) {
    super.update(dt);
    this.vents.forEach((vent) => this.erupt(vent, dt));
    this.vents = this.vents.filter((vent) => vent.age < VOLCANO.eruptSeconds + FADE_SECONDS);
  }

  erupt(vent, dt) {
    vent.age += dt;
    if (vent.age >= VOLCANO.eruptSeconds) return;
    this.onSmoke(vent.x, -MOUND.height);
    const due = Math.floor(vent.age * VOLCANO.rate) - vent.spawned;
    for (let bomb = 0; bomb < due && this.shells.length < VOLCANO.capacity; bomb++) this.shells.push(this.launch(vent.x));
    vent.spawned += due;
  }

  impact(shell, { x, y }) {
    const blow = { ...VOLCANO.blow, x, y };
    this.blasts.add(blow);
    this.onImpact(blow);
  }

  draw(context, pixelsPerMeter) {
    this.vents.forEach(({ x, age }) => paintVent(context, x, clamp((VOLCANO.eruptSeconds + FADE_SECONDS - age) / FADE_SECONDS, 0, 1)));
    super.draw(context, pixelsPerMeter);
  }

  paint(context, pixel, { x, y, trail }) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineWidth = TRAIL.width * pixel;
    context.strokeStyle = `rgba(${MAGMA},0.6)`;
    context.beginPath();
    context.moveTo(x, y);
    trail.slice(0, TRAIL.points).forEach(([pointX, pointY]) => context.lineTo(pointX, pointY));
    context.stroke();
    context.restore();
    radiate(context, x, y, VOLCANO.size * 2.2, [[0, `rgba(${MAGMA_CORE},0.9)`], [1, `rgba(${MAGMA},0)`]]);
    context.fillStyle = CRUST;
    context.beginPath();
    context.arc(x, y, VOLCANO.size * 0.6, 0, TAU);
    context.fill();
  }
}
