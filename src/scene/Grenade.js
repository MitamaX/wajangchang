import { GRAVITY, GRENADE } from '../config.js';
import { inkOutline, paintReticle, steel } from '../core/canvas.js';
import { TAU, randomBetween } from '../core/math.js';
import { Artillery } from './Artillery.js';
import { Blasts } from './Blasts.js';

const BODY = Object.freeze({ width: GRENADE.radius * 1.7, height: GRENADE.radius * 2.2, ridges: 3 });
const LEVER = Object.freeze({ width: GRENADE.radius * 0.5, height: GRENADE.radius * 0.7 });
const OLIVE = ['#7b8a4f', '#3f4a25'];
const RIDGE = 'rgba(0,0,0,0.35)';

export class Grenade extends Artillery {
  constructor(room, physics, surface, { onBlast, onBounce, onThrow }) {
    super(room, physics, surface, GRENADE, { onHit: onBlast, onLand: onBounce });
    this.onThrow = onThrow;
    this.life = GRENADE;
    this.blasts = new Blasts(GRENADE.blastSeconds);
  }

  get busy() {
    return super.busy || this.blasts.busy;
  }

  get pending() {
    return this.shots.length > 0;
  }

  windUp() {
    if (!this.loaded) return;
    const side = this.aimX >= 0 ? -1 : 1;
    const x = side * (this.room.halfWidth - GRENADE.inset);
    const y = -GRENADE.height;
    const time = Math.max(0.2, Math.hypot(this.aimX - x, this.aimY - y) / GRENADE.speed);
    const vx = (this.aimX - x) / time;
    const vy = (this.aimY - y) / time - (GRAVITY * time) / 2;
    this.launch({ x, y, angle: 0, vx, vy, spin: randomBetween(-GRENADE.tumble, GRENADE.tumble) });
    this.onThrow();
  }

  shape(body) {
    this.physics.attachBall(body, GRENADE.radius, this.body);
  }

  probe() {
    return null;
  }

  update(dt) {
    super.update(dt);
    this.blasts.update(dt);
  }

  track(shot, dt) {
    super.track(shot, dt);
    if (shot.cooling || shot.age < GRENADE.fuseSeconds) return;
    const blow = { ...GRENADE.blow, x: shot.x, y: shot.y };
    shot.fade = GRENADE.fadeSeconds;
    this.blasts.add(blow);
    this.onHit(blow);
  }

  paint(context, pixel) {
    const shade = context.createLinearGradient(-BODY.width / 2, 0, BODY.width / 2, 0);
    shade.addColorStop(0, OLIVE[0]);
    shade.addColorStop(1, OLIVE[1]);
    inkOutline(context, pixel);
    context.fillStyle = steel(context, -LEVER.width, 0, LEVER.width, 0);
    context.fillRect(-LEVER.width / 2, -BODY.height / 2 - LEVER.height, LEVER.width, LEVER.height);
    context.strokeRect(-LEVER.width / 2, -BODY.height / 2 - LEVER.height, LEVER.width, LEVER.height);
    context.fillStyle = shade;
    context.beginPath();
    context.ellipse(0, 0, BODY.width / 2, BODY.height / 2, 0, 0, TAU);
    context.fill();
    context.stroke();
    context.strokeStyle = RIDGE;
    context.beginPath();
    for (let ridge = 1; ridge <= BODY.ridges; ridge++) {
      const y = -BODY.height / 2 + (ridge / (BODY.ridges + 1)) * BODY.height;
      context.moveTo(-BODY.width / 2, y);
      context.lineTo(BODY.width / 2, y);
    }
    context.stroke();
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.draw(context, pixel);
    super.draw(context, pixelsPerMeter);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
