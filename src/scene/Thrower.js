import { normalize } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Perch } from './Perch.js';

export class Thrower extends Launcher {
  constructor(room, surface, blade, { onChop, onLaunch }) {
    super(room, surface, blade, onLaunch);
    this.blade = blade;
    this.onChop = onChop;
    this.stuck = [];
  }

  impact(shell, { x, y }) {
    const [dirX, dirY] = normalize(shell.vx, shell.vy);
    this.onChop({ x, y, dirX, dirY });
    const perch = new Perch(x, y, this.surface.grip(x, y, this.blade.size), this.blade.size);
    perch.follow(0, this.surface);
    this.stuck.push({ perch, twist: Math.atan2(dirY, dirX) - perch.angle, age: 0 });
  }

  stow() {
    super.stow();
    this.stuck = [];
  }

  update(dt) {
    super.update(dt);
    const { stickSeconds, fadeSeconds } = this.blade;
    this.stuck.forEach((blade) => {
      blade.age += dt;
      blade.perch.follow(dt, this.surface);
    });
    this.stuck = this.stuck.filter((blade) => blade.age < stickSeconds + fadeSeconds);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.stuck.forEach((blade) => this.paintStuck(context, pixel, blade));
    super.draw(context, pixelsPerMeter);
  }

  paintStuck(context, pixel, { perch, twist, age }) {
    const { stickSeconds, fadeSeconds, embed } = this.blade;
    context.save();
    context.globalAlpha = Math.min(1, (stickSeconds + fadeSeconds - age) / fadeSeconds);
    context.translate(perch.x, perch.y);
    context.rotate(perch.angle + twist);
    context.translate(embed, 0);
    this.paintBlade(context, pixel);
    context.restore();
  }
}
