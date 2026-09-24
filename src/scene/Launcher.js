import { paintReticle } from '../core/canvas.js';
import { Blasts } from './Blasts.js';
import { Tool } from './Tool.js';

export class Launcher extends Tool {
  constructor(room, surface, { capacity, blastSeconds }, onLaunch) {
    super(room);
    this.surface = surface;
    this.capacity = capacity;
    this.onLaunch = onLaunch;
    this.shells = [];
    this.blasts = new Blasts(blastSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.shells.length > 0 || this.blasts.busy;
  }

  get pending() {
    return this.shells.length > 0;
  }

  windUp() {
    if (this.shells.length >= this.capacity) return;
    this.shells.push(this.launch());
    this.onLaunch();
  }

  stow() {
    super.stow();
    this.shells = [];
  }

  update(dt) {
    this.blasts.update(dt);
    const flying = this.shells;
    this.shells = [];
    flying.forEach((shell) => {
      this.steer(shell, dt);
      const hit = shell.advance(dt, this.surface, this.room.halfWidth);
      if (hit) {
        this.impact(shell, hit);
        return;
      }
      this.fly(shell);
      this.shells.push(shell);
    });
  }

  steer() {}

  fly() {}

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.draw(context, pixel);
    this.shells.forEach((shell) => this.paint(context, pixel, shell));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
