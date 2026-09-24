import { GRAVITY } from '../config.js';
import { TAU, clamp, randomBetween, randomInt } from '../core/math.js';

const MAX_FLYING = 2400;
const MAX_RESTING = 1600;
const SETTLE_SPEED = 0.25;
const FLOOR_SLIDE = 0.6;
const SPLINTER_STRETCH = 3.2;
const SPIN = 14;

const KINDS = Object.freeze({
  chip: { gravity: 1, drag: 0.1, bounce: 0.28, life: null, solid: true, glow: false },
  splinter: { gravity: 1, drag: 0.3, bounce: 0.2, life: null, solid: true, glow: false },
  dust: { gravity: 0.06, drag: 2.6, bounce: 0, life: [0.5, 1.3], solid: false, glow: false, grow: 0.9 },
  glint: { gravity: 0.5, drag: 1.1, bounce: 0.3, life: [0.2, 0.55], solid: false, glow: true },
  spark: { gravity: 0.6, drag: 1.3, bounce: 0.4, life: [0.12, 0.35], solid: false, glow: true },
  ember: { gravity: 1, drag: 0.5, bounce: 0.35, life: [0.5, 1.1], solid: false, glow: true },
  smoke: { gravity: -0.15, drag: 1.5, bounce: 0, life: [0.8, 1.6], solid: false, glow: false, grow: 1.2 },
  mist: { gravity: 0.08, drag: 2.2, bounce: 0, life: [0.6, 1.3], solid: false, glow: false, grow: 1.3 },
  flake: { gravity: -0.1, drag: 1.1, bounce: 0, life: [0.9, 1.9], solid: false, glow: false, grow: -0.35 },
});

function shardOutline(kind) {
  const corners = randomInt(3, 5);
  const stretch = kind === 'splinter' ? SPLINTER_STRETCH : 1;
  const outline = [];
  for (let i = 0; i < corners; i++) {
    const angle = (i / corners) * TAU + randomBetween(-0.4, 0.4);
    const reach = randomBetween(0.55, 1);
    outline.push(Math.cos(angle) * reach * stretch, Math.sin(angle) * reach);
  }
  return outline;
}

export class Debris {
  constructor() {
    this.flying = [];
    this.resting = [];
    this.settled = [];
    this.stirred = false;
  }

  stir(thrust) {
    this.flying.forEach((particle) => {
      const push = thrust(particle.x, particle.y, particle.vx, particle.vy);
      if (!push) return;
      particle.vx += push[0];
      particle.vy += push[1];
    });
    const lifted = [];
    this.resting = this.resting.filter((particle) => {
      const push = thrust(particle.x, particle.y, 0, 0);
      if (!push) return true;
      lifted.push(Object.assign(particle, { vx: push[0], vy: push[1], spin: randomBetween(-SPIN, SPIN) }));
      return false;
    });
    if (!lifted.length) return;
    this.flying.push(...lifted);
    this.settled = [];
    this.stirred = true;
  }

  swallow(x, y, radius) {
    this.flying = this.flying.filter((particle) => Math.hypot(particle.x - x, particle.y - y) > radius);
  }

  takeStirred() {
    const stirred = this.stirred;
    this.stirred = false;
    return stirred;
  }

  spray(kind, x, y, { count, speed, size, color, direction = null, spread = Math.PI, scatter = 0 }) {
    for (let i = 0; i < count; i++) {
      const angle = direction === null ? randomBetween(0, TAU) : direction + randomBetween(-spread, spread);
      const velocity = randomBetween(speed[0], speed[1]);
      this.add(kind, {
        x: x + randomBetween(-scatter, scatter),
        y: y + randomBetween(-scatter, scatter),
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: randomBetween(size[0], size[1]),
        color: typeof color === 'function' ? color() : color,
      });
    }
  }

  add(kind, { x, y, vx, vy, size, color }) {
    if (this.flying.length >= MAX_FLYING) return;
    const spec = KINDS[kind];
    this.flying.push({
      kind,
      spec,
      x,
      y,
      vx,
      vy,
      size,
      color,
      angle: randomBetween(0, TAU),
      spin: randomBetween(-SPIN, SPIN),
      age: 0,
      life: spec.life ? randomBetween(spec.life[0], spec.life[1]) : Infinity,
      outline: spec.solid ? shardOutline(kind) : null,
    });
  }

  update(dt, halfWidth) {
    const airborne = [];
    for (const particle of this.flying) {
      particle.age += dt;
      if (particle.age >= particle.life) continue;
      if (this.step(particle, dt, halfWidth)) airborne.push(particle);
    }
    this.flying = airborne;
  }

  step(particle, dt, halfWidth) {
    const { spec } = particle;
    const damping = Math.max(0, 1 - spec.drag * dt);
    particle.vy = (particle.vy + GRAVITY * spec.gravity * dt) * damping;
    particle.vx *= damping;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.angle += particle.spin * dt;
    if (spec.grow) particle.size *= 1 + spec.grow * dt;
    if (Math.abs(particle.x) > halfWidth) {
      particle.x = clamp(particle.x, -halfWidth, halfWidth);
      particle.vx *= -spec.bounce;
    }
    if (particle.y < 0 || !spec.bounce) return true;
    particle.y = 0;
    particle.vy *= -spec.bounce;
    particle.vx *= FLOOR_SLIDE;
    particle.spin *= 0.5;
    if (!spec.solid || Math.abs(particle.vy) > SETTLE_SPEED) return true;
    this.settle(particle);
    return false;
  }

  settle(particle) {
    particle.y = -particle.size * randomBetween(0.1, 0.4);
    this.resting.push(particle);
    this.settled.push(particle);
    if (this.resting.length > MAX_RESTING) this.resting.shift();
  }

  takeSettled() {
    const settled = this.settled;
    this.settled = [];
    return settled;
  }

  get busy() {
    return this.flying.length > 0;
  }
}
