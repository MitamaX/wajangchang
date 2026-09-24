import { clamp } from '../core/math.js';

export class Tool {
  constructor(room) {
    this.room = room;
    this.aimX = 0;
    this.aimY = 0;
    this.present = false;
    this.active = false;
  }

  get focus() {
    return null;
  }

  get freezing() {
    return false;
  }

  get spills() {
    return true;
  }

  get pending() {
    return false;
  }

  get tempo() {
    return 1;
  }

  aim(x, y) {
    this.present = true;
    this.aimX = clamp(x, -this.room.halfWidth, this.room.halfWidth);
    this.aimY = clamp(y, -this.room.ceiling, 0);
  }

  withdraw() {
    this.present = false;
  }

  windUp() {}

  release() {}

  cancel() {}
}
