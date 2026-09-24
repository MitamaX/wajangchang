import { GANTRY } from '../config.js';
import { clamp } from '../core/math.js';

export class Gantry {
  constructor(room, margin = 0) {
    this.room = room;
    this.margin = margin;
    this.x = 0;
    this.target = 0;
  }

  get top() {
    return -this.room.height + GANTRY.restGap;
  }

  get sky() {
    return -this.room.ceiling - GANTRY.overhang;
  }

  get arrived() {
    return this.x === this.target;
  }

  follow(x) {
    this.x = this.limit(x);
  }

  send(x) {
    this.target = this.limit(x);
  }

  travel(dt) {
    const step = GANTRY.travel * dt;
    this.x = clamp(this.target, this.x - step, this.x + step);
  }

  limit(x) {
    const reach = this.room.halfWidth - this.margin;
    return clamp(x, -reach, reach);
  }
}
