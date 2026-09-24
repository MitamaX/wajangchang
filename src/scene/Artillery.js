import { clamp, lerp } from '../core/math.js';
import { Layer } from '../physics/PhysicsWorld.js';
import { Projectile, retire } from './Projectile.js';
import { Tool } from './Tool.js';

class Shot extends Projectile {
  constructor(body, life) {
    super(body, life);
    this.struck = false;
  }
}

export class Artillery extends Tool {
  constructor(room, physics, surface, config, { onHit, onLand }) {
    super(room);
    this.physics = physics;
    this.surface = surface;
    this.config = config;
    this.onHit = onHit;
    this.onLand = onLand;
    this.body = Object.freeze({ ...config.surface, groups: Layer.tool });
    this.shots = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.shots.length > 0;
  }

  get pending() {
    return this.shots.some((shot) => !shot.struck && !shot.grounded);
  }

  get loaded() {
    return this.shots.length < this.config.capacity;
  }

  launch(pose) {
    const body = this.physics.createBody(pose, true);
    this.shape(body);
    this.shots.push(new Shot(body, this.life));
  }

  update(dt) {
    this.shots.forEach((shot) => this.track(shot, dt));
    this.shots = retire(this.shots, this.physics);
  }

  track(shot, dt) {
    shot.update(dt);
    if (!shot.struck && !shot.cooling) {
      const contact = this.probe(shot);
      if (contact) {
        shot.struck = true;
        this.onHit(this.blow(shot, contact.point));
      }
    }
    if (shot.touchdown(this.config.impactSpeed[0])) this.onLand(shot.x);
  }

  blow(shot, { x, y }) {
    const { blow, strength, impactSpeed, reach } = this.config;
    const force = clamp((shot.surge - impactSpeed[0]) / (impactSpeed[1] - impactSpeed[0]), 0, 1);
    return { ...blow, x, y, radius: reach, contact: reach, strength: lerp(...strength, force), force };
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.shots.forEach((shot) => {
      context.save();
      context.globalAlpha = shot.alpha;
      context.translate(shot.x, shot.y);
      context.rotate(shot.angle);
      this.paint(context, pixel);
      context.restore();
    });
  }
}
