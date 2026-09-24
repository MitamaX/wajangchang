import { easeOut, lerp } from '../core/math.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

export class Field extends Tool {
  constructor(room, config, { onSweep, onHum, onRelease }) {
    super(room);
    this.config = config;
    this.onSweep = onSweep;
    this.onHum = onHum;
    this.onRelease = onRelease;
    this.holding = false;
    this.x = 0;
    this.y = 0;
    this.growth = 0;
    this.time = 0;
    this.flares = [];
    this.hums = new Pulse(config.humSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.flares.length > 0;
  }

  get size() {
    return easeOut(this.growth);
  }

  get reach() {
    return lerp(...this.config.reach, this.size);
  }

  windUp() {
    this.holding = true;
    this.growth = 0;
    this.x = this.aimX;
    this.y = this.aimY;
    this.begin();
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    this.flares.push({ x: this.x, y: this.y, radius: this.reach, age: 0 });
    this.end();
    this.onRelease(this.blow());
  }

  cancel() {
    this.holding = false;
    this.end();
  }

  stow() {
    super.stow();
    this.flares = [];
  }

  begin() {}

  end() {}

  tick() {}

  update(dt) {
    const { config } = this;
    this.time += dt;
    this.flares = this.flares.filter((flare) => (flare.age += dt) < config.flareSeconds);
    if (!this.holding) return;
    this.growth = Math.min(1, this.growth + dt / config.growSeconds);
    const follow = Math.min(1, config.follow * dt);
    this.x += (this.aimX - this.x) * follow;
    this.y += (this.aimY - this.y) * follow;
    this.onSweep((x, y) => this.thrust(x, y, dt));
    if (this.hums.tick(dt)) this.onHum(config.humSeconds);
    this.tick(dt);
  }
}
