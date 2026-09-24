import { GRAVITY, GUN } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, easeOut, lerp, normalize, polar, randomBetween } from '../core/math.js';
import { Crack } from './Glass.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const LENS = 1.3;
const HOLD = Object.freeze({ x: 0, y: 0.17, z: 0.3, depth: 3, follow: 12, sink: 0.3, sway: 0.003, swayRate: 2 });
const HOUSING = Object.freeze({ from: -0.06, to: 0.07, width: 0.036, height: 0.034, inset: 0.2 });
const BARRELS = Object.freeze({ count: 6, from: 0.07, to: 0.62, radius: 0.021, width: 0.0105, clamps: [0.25, 0.47], plate: 0.034, bore: 0.008 });
const CHUTE = Object.freeze({ width: 0.024, steps: 10, links: 0.18 });
const MUZZLE = BARRELS.to + 0.012;
const PORT = Object.freeze({ s: 0, x: 0.036, y: 0.02 });
const RECOIL = Object.freeze({ kick: 0.012, limit: 0.03, return: 16, jitter: 0.006 });
const FLAME = Object.freeze({ seconds: 0.05, length: [0.05, 0.085], width: 0.018, glow: 0.12 });
const TRACER = Object.freeze({ share: 0.3, width: 0.006, glow: 3 });
const CASING = Object.freeze({ speed: [1, 1.6], length: 0.018, width: 0.0065, spin: 22, life: 1 });
const SMOKE = Object.freeze({ life: 0.9, size: [0.012, 0.045], rise: 0.12, alpha: 0.22 });
const HIT = Object.freeze({ seconds: 0.07, reach: 0.028, rays: 6, width: 1.6 });
const HOLE = Object.freeze({ spokes: [5, 8], reach: [0.012, 0.035], bends: 3, jitter: 0.25, rings: [0.5], skip: 0.5, core: 0.0035, hole: true });
const RETICLE = Object.freeze({ width: 1.5, tick: 7, gap: 3, alpha: 0.8 });
const LIGHT = [-0.35, -0.85, -0.4].map((value, _, all) => value / Math.hypot(...all));
const SHADE = Object.freeze({ ambient: 0.4, direct: 0.6, flash: 0.15, panel: 0.82 });
const GUNMETAL = [74, 80, 88];
const STEEL = [158, 166, 174];
const BRASS = [217, 164, 65];
const FIRE_TINT = [255, 170, 80];
const HEAT_TINT = [255, 110, 30];
const OUTLINE = 'rgba(0,0,0,0.55)';
const RETICLE_INK = '255,255,255';
const FIRE_CORE = '255,252,230';
const FIRE = '255,178,50';
const FIRE_EDGE = '255,96,20';
const TRACER_GLOW = '255,170,70';
const TRACER_CORE = '255,246,215';
const SMOKE_TINT = '150,146,140';

const add = (a, b) => a.map((value, i) => value + b[i]);
const times = (a, k) => a.map((value) => value * k);
const dot = (a, b) => a.reduce((total, value, i) => total + value * b[i], 0);
const unit = (a) => times(a, 1 / Math.hypot(...a));
const cross = ([ax, ay, az], [bx, by, bz]) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const blend = (from, to, share) => from.map((value, i) => Math.round(lerp(value, to[i], share)));
const rgb = (color) => `rgb(${color.join(',')})`;

function lit(color, normal, flash) {
  const light = SHADE.ambient + SHADE.direct * Math.max(0, dot(normal, LIGHT));
  return blend(times(color, light), FIRE_TINT, SHADE.flash * flash);
}

function polygon(context, pixel, points, fill) {
  context.beginPath();
  points.forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = OUTLINE;
  context.lineWidth = pixel;
  context.stroke();
}

function taper(context, [ax, ay], [bx, by], near, far) {
  const [normalX, normalY] = normalize(ay - by, bx - ax);
  context.beginPath();
  context.lineTo(ax + normalX * near, ay + normalY * near);
  context.lineTo(bx + normalX * far, by + normalY * far);
  context.lineTo(bx - normalX * far, by - normalY * far);
  context.lineTo(ax - normalX * near, ay - normalY * near);
  context.closePath();
}

function paintHit(context, pixel, { x, y, age, turn }) {
  const fading = 1 - age / HIT.seconds;
  radiate(context, x, y, HIT.reach * fading, [[0, `rgba(${FIRE_CORE},${fading})`], [0.4, `rgba(${FIRE},${0.7 * fading})`], [1, `rgba(${FIRE},0)`]]);
  context.strokeStyle = `rgba(${FIRE_CORE},${fading})`;
  context.lineWidth = HIT.width * pixel;
  context.beginPath();
  for (let ray = 0; ray < HIT.rays; ray++) {
    const [dx, dy] = polar(turn + (ray * TAU) / HIT.rays, HIT.reach * (ray % 2 ? 0.5 : 1));
    context.moveTo(x, y);
    context.lineTo(x + dx, y + dy);
  }
  context.stroke();
}

export class Gun extends Tool {
  constructor(room, { onFire, onMotor, onSpinDown }) {
    super(room);
    this.onFire = onFire;
    this.onMotor = onMotor;
    this.onSpinDown = onSpinDown;
    this.holding = false;
    this.heat = 0;
    this.rise = 0;
    this.time = 0;
    this.spin = 0;
    this.spinSpeed = 0;
    this.recoil = 0;
    this.axis = [0, 0, 1];
    this.rounds = new Pulse(1 / GUN.rate);
    this.motor = new Pulse(GUN.motorSeconds);
    this.smokes = new Pulse(GUN.smokeSeconds);
    this.flames = [];
    this.tracers = [];
    this.hits = [];
    this.holes = [];
    this.casings = [];
    this.puffs = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.holding || this.tracers.length > 0 || this.hits.length > 0 || this.holes.length > 0 || this.rise > 0;
  }

  get shown() {
    return this.present || this.busy;
  }

  get spread() {
    return lerp(...GUN.spread, this.heat);
  }

  get firing() {
    return this.holding && this.present;
  }

  get flash() {
    return Math.max(0, ...this.flames.map(({ age }) => 1 - age / FLAME.seconds));
  }

  get lens() {
    const { ceiling, height, frameHeight } = this.room;
    const top = -ceiling;
    const bottom = frameHeight - height;
    return { x: 0, y: (top + bottom) / 2, focus: (LENS * (bottom - top)) / 2 };
  }

  get hold() {
    const sway = Math.sin(this.time * HOLD.swayRate) * HOLD.sway;
    return [HOLD.x + sway, HOLD.y + Math.abs(sway) + HOLD.sink * (1 - easeOut(this.rise)), HOLD.z];
  }

  project([x, y, z]) {
    const { lens } = this;
    return [lens.x + (lens.focus * x) / z, lens.y + (lens.focus * y) / z];
  }

  reach(z) {
    return this.lens.focus / z;
  }

  ray(worldX, worldY) {
    const { lens } = this;
    return times([(worldX - lens.x) / lens.focus, (worldY - lens.y) / lens.focus, 1], HOLD.depth);
  }

  frame() {
    const { axis } = this;
    const side = unit(cross(axis, [0, -1, 0]));
    const lift = cross(side, axis);
    const origin = add(this.hold, times(axis, -this.recoil));
    return { axis, side, lift, at: (s, x = 0, y = 0) => add(add(origin, times(axis, s)), add(times(side, x), times(lift, y))) };
  }

  windUp() {
    this.holding = true;
    this.rounds.reset();
  }

  release() {
    this.cease();
  }

  cancel() {
    this.cease();
  }

  cease() {
    if (this.holding && this.spinSpeed > GUN.spin / 2) this.onSpinDown();
    this.holding = false;
  }

  stow() {
    super.stow();
    this.rise = 0;
    this.flames = [];
    this.tracers = [];
    this.hits = [];
    this.holes = [];
    this.casings = [];
    this.puffs = [];
  }

  update(dt) {
    this.time += dt;
    this.flames = this.flames.filter((flame) => (flame.age += dt) < FLAME.seconds);
    this.hits = this.hits.filter((hit) => (hit.age += dt) < HIT.seconds);
    this.holes = this.holes.filter((hole) => hole.update(dt));
    this.aimAxis(dt);
    this.drift(dt);
    this.fly(dt);
    const { firing } = this;
    const hot = this.heat > GUN.smokeHeat;
    this.rise = clamp(this.rise + (this.present || this.holding || hot ? dt : -dt) / GUN.riseSeconds, 0, 1);
    this.heat = clamp(this.heat + (firing ? dt / GUN.bloomSeconds : -dt * GUN.recovery), 0, 1);
    this.spinSpeed += ((firing ? GUN.spin : 0) - this.spinSpeed) * Math.min(1, GUN.spool * dt);
    this.spin = (this.spin + this.spinSpeed * dt) % TAU;
    this.recoil = Math.max(0, this.recoil - RECOIL.return * this.recoil * dt);
    if (this.spinSpeed > GUN.spin / 4 && this.motor.tick(dt)) this.onMotor(GUN.motorSeconds);
    if (!firing && hot && this.rise > 0 && this.smokes.tick(dt)) this.puff();
    if (firing && this.rise > 0 && this.rounds.tick(dt)) this.shoot();
  }

  aimAxis(dt) {
    const wanted = unit(add(this.ray(this.aimX, this.aimY), times(this.hold, -1)));
    this.axis = unit(add(this.axis, times(add(wanted, times(this.axis, -1)), Math.min(1, HOLD.follow * dt))));
  }

  drift(dt) {
    this.casings = this.casings.filter((casing) => {
      casing.age += dt;
      casing.velocity[1] += GRAVITY * dt;
      casing.position = add(casing.position, times(casing.velocity, dt));
      casing.angle += casing.spin * dt;
      return casing.age < CASING.life && casing.position[2] > HOLD.z * 0.3;
    });
    this.puffs = this.puffs.filter((puff) => {
      puff.age += dt;
      puff.position[1] -= SMOKE.rise * dt;
      return puff.age < SMOKE.life;
    });
  }

  puff() {
    this.puffs.push({ position: this.frame().at(MUZZLE), age: 0, size: randomBetween(0.7, 1.3) });
  }

  shoot() {
    const muzzle = this.frame().at(MUZZLE);
    const [offsetX, offsetY] = polar(randomBetween(0, TAU), this.spread * Math.sqrt(Math.random()));
    const toX = this.aimX + offsetX;
    const toY = Math.min(0, this.aimY + offsetY);
    const target = this.ray(toX, toY);
    const flight = Math.hypot(...add(target, times(muzzle, -1))) / GUN.tracerSpeed;
    this.tracers.push({ muzzle, target, toX, toY, age: 0, flight });
    this.flames.push({ age: 0, length: randomBetween(...FLAME.length), turn: randomBetween(0, TAU) });
    this.recoil = Math.min(RECOIL.limit, this.recoil + RECOIL.kick);
    this.axis = unit(add(this.axis, [randomBetween(-1, 1) * RECOIL.jitter, -RECOIL.jitter, 0]));
    this.eject();
  }

  eject() {
    const { side, lift, axis, at } = this.frame();
    const speed = randomBetween(...CASING.speed);
    const velocity = add(add(times(side, speed), times(lift, speed * 0.6)), times(axis, -0.4));
    this.casings.push({ position: at(PORT.s, PORT.x, PORT.y), velocity, angle: randomBetween(0, TAU), spin: randomBetween(-CASING.spin, CASING.spin), age: 0 });
  }

  fly(dt) {
    this.tracers = this.tracers.filter((tracer) => {
      tracer.age += dt;
      if (tracer.age < tracer.flight) return true;
      this.land(tracer);
      return false;
    });
  }

  land({ muzzle, toX, toY }) {
    const [fromX, fromY] = this.project(muzzle);
    const [normalX, normalY] = normalize(toX - fromX, toY - fromY);
    this.hits.push({ x: toX, y: toY, age: 0, turn: randomBetween(0, TAU) });
    this.holes.push(new Crack(toX, toY, HOLE, GUN.holeSeconds));
    if (this.holes.length > GUN.holes) this.holes.shift();
    this.onFire({ ...GUN.round, x: toX, y: toY, normalX, normalY });
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.hits.forEach((hit) => paintHit(context, pixel, hit));
    this.holes.forEach((hole) => hole.draw(context, pixel));
    if (this.present) this.drawReticle(context, pixel);
    context.save();
    context.globalCompositeOperation = 'lighter';
    this.tracers.forEach((tracer) => this.drawTracer(context, tracer));
    context.restore();
    this.puffs.forEach((puff) => this.drawSmoke(context, puff));
    if (this.rise > 0) this.drawGun(context, pixel);
    this.casings.forEach((casing) => this.drawCasing(context, pixel, casing));
  }

  drawGun(context, pixel) {
    const frame = this.frame();
    const { flash } = this;
    context.save();
    context.lineJoin = 'round';
    this.drawPlate(context, pixel, frame, BARRELS.to, BARRELS.radius + BARRELS.width * 0.8, flash);
    const [near, far] = BARRELS.clamps;
    [[far, BARRELS.to], [near, far], [BARRELS.from, near]].forEach(([from, to], index) => {
      this.drawBarrels(context, pixel, frame, from, to, flash);
      if (index < BARRELS.clamps.length) this.drawPlate(context, pixel, frame, from, BARRELS.plate, flash);
    });
    this.drawChute(context, pixel, frame);
    this.drawHousing(context, pixel, frame, flash);
    this.drawFlame(context, frame);
    context.restore();
  }

  drawBarrels(context, pixel, { side, lift, at }, from, to, flash) {
    const barrels = Array.from({ length: BARRELS.count }, (_, i) => {
      const angle = this.spin + (i / BARRELS.count) * TAU;
      const [x, y] = polar(angle, BARRELS.radius);
      const radial = add(times(side, Math.cos(angle)), times(lift, Math.sin(angle)));
      return { x, y, radial, depth: at((from + to) / 2, x, y)[2] };
    }).sort((a, b) => b.depth - a.depth);
    barrels.forEach(({ x, y, radial }) => {
      const near = at(from, x, y);
      const far = at(to, x, y);
      const [ax, ay] = this.project(near);
      const [bx, by] = this.project(far);
      const color = lit(STEEL, radial, flash);
      const glow = context.createLinearGradient(ax, ay, bx, by);
      glow.addColorStop(0, rgb(blend(color, HEAT_TINT, this.heat * ((from - BARRELS.from) / (BARRELS.to - BARRELS.from)) ** 2)));
      glow.addColorStop(1, rgb(blend(color, HEAT_TINT, this.heat * ((to - BARRELS.from) / (BARRELS.to - BARRELS.from)) ** 2)));
      taper(context, [ax, ay], [bx, by], (BARRELS.width * this.reach(near[2])) / 2, (BARRELS.width * this.reach(far[2])) / 2);
      context.fillStyle = glow;
      context.fill();
      context.strokeStyle = OUTLINE;
      context.lineWidth = pixel;
      context.stroke();
    });
    if (to !== BARRELS.to) return;
    context.fillStyle = 'rgba(8,8,10,0.9)';
    barrels.forEach(({ x, y }) => {
      const bore = at(to, x, y);
      const [bx, by] = this.project(bore);
      context.beginPath();
      context.arc(bx, by, (BARRELS.bore * this.reach(bore[2])) / 2, 0, TAU);
      context.fill();
    });
  }

  drawPlate(context, pixel, { axis, at }, s, radius, flash) {
    const points = Array.from({ length: 20 }, (_, i) => this.project(at(s, ...polar((i / 20) * TAU, radius))));
    polygon(context, pixel, points, rgb(lit(GUNMETAL, times(axis, -1), flash)));
  }

  drawHousing(context, pixel, { axis, side, lift, at }, flash) {
    const { from, to, width, height } = HOUSING;
    const corner = (s, x, y) => this.project(at(s, x * width, y * height));
    const faces = [
      { normal: times(axis, -1), points: [[from, -1, -1], [from, 1, -1], [from, 1, 1], [from, -1, 1]] },
      { normal: axis, points: [[to, -1, -1], [to, 1, -1], [to, 1, 1], [to, -1, 1]] },
      { normal: side, points: [[from, 1, -1], [to, 1, -1], [to, 1, 1], [from, 1, 1]] },
      { normal: times(side, -1), points: [[from, -1, -1], [to, -1, -1], [to, -1, 1], [from, -1, 1]] },
      { normal: lift, points: [[from, -1, 1], [to, -1, 1], [to, 1, 1], [from, 1, 1]] },
      { normal: times(lift, -1), points: [[from, -1, -1], [to, -1, -1], [to, 1, -1], [from, 1, -1]] },
    ];
    faces
      .filter(({ normal, points }) => dot(normal, at(points[0][0], points[0][1] * width, points[0][2] * height)) < 0)
      .forEach(({ normal, points }) => {
        const color = lit(GUNMETAL, normal, flash);
        polygon(context, pixel, points.map(([s, x, y]) => corner(s, x, y)), rgb(color));
        const middle = points.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / points.length);
        const inset = points.map((point) => add(middle, times(add(point, times(middle, -1)), 1 - HOUSING.inset)));
        polygon(context, pixel, inset.map(([s, x, y]) => corner(s, x, y)), rgb(times(color, SHADE.panel)));
      });
  }

  drawChute(context, pixel, { at }) {
    const points = Array.from({ length: CHUTE.steps + 1 }, (_, i) => {
      const t = i / CHUTE.steps;
      return at(lerp(0.02, -0.14, t), HOUSING.width + t * 0.09, -HOUSING.height * 0.2 - t * t * 0.34);
    });
    for (let i = 1; i < points.length; i++) {
      const near = points[i];
      const [ax, ay] = this.project(points[i - 1]);
      const [bx, by] = this.project(near);
      const width = CHUTE.width * this.reach(near[2]);
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
      context.strokeStyle = OUTLINE;
      context.lineWidth = width + pixel * 2;
      context.stroke();
      context.strokeStyle = rgb(i % 2 ? BRASS : blend(BRASS, [90, 60, 20], 0.5));
      context.lineWidth = width;
      context.stroke();
    }
  }

  drawFlame(context, { at }) {
    this.flames.forEach(({ age, length, turn }) => {
      const muzzle = at(MUZZLE);
      const [x, y] = this.project(muzzle);
      const reach = this.reach(muzzle[2]);
      const fading = 1 - age / FLAME.seconds;
      const size = length * reach * (0.6 + 0.4 * fading);
      radiate(context, x, y, FLAME.glow * reach * fading, [[0, `rgba(${FIRE},${0.8 * fading})`], [1, `rgba(${FIRE_EDGE},0)`]]);
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.translate(x, y);
      context.rotate(turn);
      [[1, FIRE_EDGE, 0.85], [0.65, FIRE, 1], [0.35, FIRE_CORE, 1]].forEach(([share, color, alpha]) => {
        const long = size * share;
        const thin = FLAME.width * reach * share;
        context.fillStyle = `rgba(${color},${alpha * fading})`;
        context.beginPath();
        for (let point = 0; point < 8; point++) context.lineTo(...polar((point / 8) * TAU, point % 2 ? thin : long * (point % 4 ? 0.55 : 1)));
        context.closePath();
        context.fill();
      });
      context.restore();
    });
  }

  drawTracer(context, { muzzle, target, age, flight }) {
    const head = Math.min(1, age / flight);
    const tail = Math.max(0, head - TRACER.share);
    const point = (share) => add(muzzle, times(add(target, times(muzzle, -1)), share));
    const near = point(tail);
    const far = point(head);
    const ends = [this.project(near), this.project(far)];
    const widths = [near, far].map(([, , z]) => (TRACER.width * this.reach(z)) / 2);
    [[TRACER.glow, `rgba(${TRACER_GLOW},0.35)`], [1, `rgba(${TRACER_CORE},1)`]].forEach(([swell, color]) => {
      taper(context, ...ends, widths[0] * swell, widths[1] * swell);
      context.fillStyle = color;
      context.fill();
    });
  }

  drawCasing(context, pixel, { position, angle }) {
    const [x, y] = this.project(position);
    const reach = this.reach(position[2]);
    const length = CASING.length * reach;
    const width = CASING.width * reach;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = rgb(BRASS);
    context.strokeStyle = OUTLINE;
    context.lineWidth = pixel;
    context.beginPath();
    context.roundRect(-length / 2, -width / 2, length, width, width / 3);
    context.fill();
    context.stroke();
    context.fillStyle = 'rgba(255,240,190,0.8)';
    context.fillRect(-length / 2 + width / 3, -width / 3, length - width, width / 4);
    context.restore();
  }

  drawSmoke(context, { position, age, size }) {
    const [x, y] = this.project(position);
    const t = age / SMOKE.life;
    const radius = lerp(...SMOKE.size, t) * size * this.reach(position[2]) * HOLD.z;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${SMOKE_TINT},${SMOKE.alpha * (1 - t)})`);
    gradient.addColorStop(1, `rgba(${SMOKE_TINT},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  drawReticle(context, pixel) {
    const { aimX: x, aimY: y } = this;
    const radius = this.spread + RETICLE.gap * pixel;
    context.save();
    context.strokeStyle = `rgba(${RETICLE_INK},${RETICLE.alpha})`;
    context.lineWidth = RETICLE.width * pixel;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    for (let arm = 0; arm < 4; arm++) {
      const [dx, dy] = polar((arm * TAU) / 4, 1);
      context.moveTo(x + dx * radius, y + dy * radius);
      context.lineTo(x + dx * (radius + RETICLE.tick * pixel), y + dy * (radius + RETICLE.tick * pixel));
    }
    context.stroke();
    context.restore();
  }
}
