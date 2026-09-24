import { GRAVITY } from '../config.js';

export class Perch {
  constructor(x, y, anchor, size) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.fall = 0;
    this.anchor = anchor;
    this.size = size;
  }

  follow(dt, surface) {
    const pose = this.anchor && surface.hold(this.anchor);
    if (pose) {
      Object.assign(this, pose);
      this.fall = 0;
      return;
    }
    this.anchor = surface.grip(this.x, this.y, this.size);
    if (this.anchor) return;
    this.fall += GRAVITY * dt;
    this.y = Math.min(this.y + this.fall * dt, -this.size);
    if (this.y === -this.size) this.fall = 0;
  }
}
