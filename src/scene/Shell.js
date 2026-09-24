import { clamp } from '../core/math.js';

const TRAIL_LENGTH = 14;

export class Shell {
  constructor({ x, y, vx, vy, reach, target = null, gravity = 0, arm = 0 }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.reach = reach;
    this.target = target;
    this.gravity = gravity;
    this.arm = arm;
    this.age = 0;
    this.trail = [];
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get heading() {
    return Math.atan2(this.vy, this.vx);
  }

  advance(dt, surface, halfWidth) {
    this.age += dt;
    this.trail.unshift([this.x, this.y]);
    if (this.trail.length > TRAIL_LENGTH) this.trail.pop();
    const steps = Math.max(1, Math.ceil((this.speed * dt) / this.reach));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vy += this.gravity * step;
      this.x += this.vx * step;
      this.y += this.vy * step;
      const hit = this.landing(surface, halfWidth);
      if (hit) return hit;
    }
    return null;
  }

  landing(surface, halfWidth) {
    if (this.y >= 0 || (Math.abs(this.x) >= halfWidth && this.x * this.vx > 0)) return { x: clamp(this.x, -halfWidth, halfWidth), y: Math.min(0, this.y) };
    if (this.age < this.arm) return null;
    const contact = surface.contactAt(this.x, this.y, this.reach);
    if (contact) return contact.point;
    return this.target && this.passed() ? { ...this.target } : null;
  }

  passed() {
    return (this.target.x - this.x) * this.vx + (this.target.y - this.y) * this.vy <= 0;
  }
}
