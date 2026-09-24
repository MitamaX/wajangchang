import { GRAVITY, GUN } from '../config.js';
import { inkOutline, radiate, steel, strokeLayers, traceRoundRect } from '../core/canvas.js';
import { TAU, clamp, easeOut, lerp, normalize, polar, randomBetween, rotate } from '../core/math.js';
import { Crack } from './Glass.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const VIEW = Object.freeze({ x: 0.62, below: -0.1, scale: 1.5, sink: 0.9 });
const BODY = Object.freeze({ back: -0.16, front: 0.06, top: -0.045, bottom: 0.04, corner: 0.012 });
const GRIPS = Object.freeze({ plate: -0.17, reach: 0.05, span: 0.036, bar: 0.009 });
const AMMO = Object.freeze({ x: -0.22, y: 0.06, width: 0.1, height: 0.075, corner: 0.006 });
const CHUTE = Object.freeze({ width: 0.016, ribs: 6, sag: 0.05 });
const BARRELS = Object.freeze({ count: 6, from: 0.06, to: 0.4, spread: 0.018, width: 0.0085, clamps: [0.15, 0.33], clamp: 0.014 });
const MUZZLE = BARRELS.to + 0.012;
const PORT = Object.freeze({ x: -0.03, y: BODY.top });
const CASING = Object.freeze({ speed: [1.4, 2.2], back: 0.35, spin: 22, length: 0.02, width: 0.0075, life: 1.2 });
const SMOKE = Object.freeze({ life: 0.9, size: [0.02, 0.07], rise: 0.18, alpha: 0.22 });
const RECOIL = Object.freeze({ kick: 0.006, limit: 0.018, return: 18 });
const FLAME = Object.freeze({ seconds: 0.05, length: [0.09, 0.15], width: 0.03, glow: 0.13 });
const TRACER = Object.freeze({ share: 0.35, near: 10, far: 1.4, glow: 3 });
const HIT = Object.freeze({ seconds: 0.07, reach: 0.028, rays: 6, width: 1.6 });
const HOLE = Object.freeze({ spokes: [5, 8], reach: [0.012, 0.035], bends: 3, jitter: 0.25, rings: [0.5], skip: 0.5, core: 0.0035, hole: true });
const RETICLE = Object.freeze({ width: 1.5, tick: 7, gap: 3, alpha: 0.8 });
const RETICLE_INK = '255,255,255';
const GUNMETAL = ['#5d646b', '#2c3136', '#16191c'];
const OLIVE = ['#7c8752', '#56603a', '#343b22'];
const BRASS = '#d9a441';
const BRASS_SHINE = 'rgba(255,240,190,0.8)';
const HEAT = '255,110,30';
const FIRE_CORE = '255,252,230';
const FIRE = '255,178,50';
const FIRE_EDGE = '255,96,20';
const TRACER_GLOW = '255,170,70';
const TRACER_CORE = '255,246,215';
const SMOKE_TINT = '150,146,140';

function metal(context, top, bottom, [light, middle, dark]) {
  const gradient = context.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.45, middle);
  gradient.addColorStop(1, dark);
  return gradient;
}

function chutePoint(t) {
  const [ax, ay] = [AMMO.x + AMMO.width * 0.75, AMMO.y];
  const [cx, cy] = [BODY.back + 0.14, BODY.bottom + CHUTE.sag];
  const [bx, by] = [BODY.back + 0.15, BODY.bottom];
  const u = 1 - t;
  return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
}

function paintChute(context, pixel) {
  context.beginPath();
  for (let i = 0; i <= CHUTE.ribs * 2; i++) context.lineTo(...chutePoint(i / (CHUTE.ribs * 2)));
  context.lineCap = 'butt';
  context.lineJoin = 'round';
  strokeLayers(context, 1, [[CHUTE.width + pixel * 2.4, 'rgba(0,0,0,0.5)'], [CHUTE.width, GUNMETAL[1]]]);
  context.fillStyle = GUNMETAL[0];
  for (let i = 1; i < CHUTE.ribs; i++) {
    const [x, y] = chutePoint(i / CHUTE.ribs);
    context.beginPath();
    context.arc(x, y, CHUTE.width * 0.32, 0, TAU);
    context.fill();
  }
}

function paintBody(context, pixel) {
  inkOutline(context, pixel);
  context.fillStyle = metal(context, AMMO.y, AMMO.y + AMMO.height, OLIVE);
  traceRoundRect(context, AMMO.x, AMMO.y, AMMO.width, AMMO.height, AMMO.corner);
  context.fill();
  context.stroke();
  context.fillStyle = 'rgba(0,0,0,0.25)';
  context.fillRect(AMMO.x + AMMO.width * 0.12, AMMO.y + AMMO.height * 0.3, AMMO.width * 0.76, AMMO.height * 0.12);
  paintChute(context, pixel);
  inkOutline(context, pixel);
  context.fillStyle = metal(context, -GRIPS.span, GRIPS.span, GUNMETAL);
  [-1, 1].forEach((side) => {
    traceRoundRect(context, GRIPS.plate - GRIPS.reach, side * GRIPS.span - GRIPS.bar / 2, GRIPS.reach + 0.01, GRIPS.bar, GRIPS.bar / 2);
    context.fill();
    context.stroke();
  });
  traceRoundRect(context, GRIPS.plate - GRIPS.reach - GRIPS.bar, -GRIPS.span - GRIPS.bar, GRIPS.bar * 1.6, (GRIPS.span + GRIPS.bar) * 2, GRIPS.bar * 0.8);
  context.fill();
  context.stroke();
  context.fillStyle = metal(context, BODY.top, BODY.bottom, GUNMETAL);
  traceRoundRect(context, BODY.back, BODY.top, BODY.front - BODY.back, BODY.bottom - BODY.top, BODY.corner);
  context.fill();
  context.stroke();
  context.fillStyle = 'rgba(0,0,0,0.35)';
  for (let vent = 0; vent < 4; vent++) context.fillRect(BODY.back + 0.03 + vent * 0.022, BODY.top + 0.014, 0.012, 0.028);
  context.fillStyle = 'rgba(255,255,255,0.18)';
  context.fillRect(BODY.back + BODY.corner, BODY.top + 0.004, BODY.front - BODY.back - BODY.corner * 2, 0.006);
  context.fillStyle = '#0d0f11';
  context.fillRect(PORT.x - 0.012, PORT.y - 0.001, 0.024, 0.008);
}

function paintBarrels(context, pixel, spin, heat) {
  const barrels = Array.from({ length: BARRELS.count }, (_, i) => {
    const phase = spin + (i / BARRELS.count) * TAU;
    return { y: Math.sin(phase) * BARRELS.spread, depth: Math.cos(phase) };
  }).sort((a, b) => a.depth - b.depth);
  inkOutline(context, pixel);
  barrels.forEach(({ y, depth }) => {
    const light = lerp(0.35, 1, (depth + 1) / 2);
    context.fillStyle = `rgb(${Math.round(60 + 120 * light)},${Math.round(66 + 122 * light)},${Math.round(72 + 124 * light)})`;
    context.fillRect(BARRELS.from, y - BARRELS.width / 2, BARRELS.to - BARRELS.from, BARRELS.width);
    context.strokeRect(BARRELS.from, y - BARRELS.width / 2, BARRELS.to - BARRELS.from, BARRELS.width);
  });
  const reach = BARRELS.spread + BARRELS.width;
  context.fillStyle = steel(context, 0, -reach, 0, reach);
  BARRELS.clamps.forEach((x) => {
    context.fillRect(x - BARRELS.clamp / 2, -reach, BARRELS.clamp, reach * 2);
    context.strokeRect(x - BARRELS.clamp / 2, -reach, BARRELS.clamp, reach * 2);
  });
  context.fillStyle = metal(context, -reach, reach, GUNMETAL);
  context.fillRect(BARRELS.to - 0.006, -reach, 0.012, reach * 2);
  context.strokeRect(BARRELS.to - 0.006, -reach, 0.012, reach * 2);
  if (heat <= 0) return;
  const glow = context.createLinearGradient(BARRELS.clamps[1] - 0.12, 0, BARRELS.to, 0);
  glow.addColorStop(0, `rgba(${HEAT},0)`);
  glow.addColorStop(1, `rgba(${HEAT},${0.75 * heat})`);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = glow;
  context.fillRect(BARRELS.clamps[1] - 0.12, -reach, BARRELS.to - BARRELS.clamps[1] + 0.12, reach * 2);
  context.restore();
}

function traceFlame(context, reach, width, bend) {
  context.beginPath();
  context.moveTo(MUZZLE, -width * 0.3);
  context.quadraticCurveTo(MUZZLE + reach * 0.3, -width, MUZZLE + reach, bend * width * 0.3);
  context.quadraticCurveTo(MUZZLE + reach * 0.3, width, MUZZLE, width * 0.3);
  context.closePath();
  context.moveTo(MUZZLE + reach * 0.08, 0);
  context.lineTo(MUZZLE + reach * 0.2, -width * 1.7);
  context.lineTo(MUZZLE + reach * 0.3, 0);
  context.lineTo(MUZZLE + reach * 0.2, width * 1.7);
  context.closePath();
}

function paintFlame(context, { age, length, turn }) {
  const fading = 1 - age / FLAME.seconds;
  const reach = length * (0.6 + 0.4 * fading);
  radiate(context, MUZZLE + reach * 0.3, 0, FLAME.glow * fading, [[0, `rgba(${FIRE},${0.7 * fading})`], [1, `rgba(${FIRE_EDGE},0)`]]);
  context.save();
  context.globalCompositeOperation = 'lighter';
  traceFlame(context, reach, FLAME.width, turn);
  context.fillStyle = `rgba(${FIRE_EDGE},${0.85 * fading})`;
  context.fill();
  traceFlame(context, reach * 0.7, FLAME.width * 0.6, turn);
  context.fillStyle = `rgba(${FIRE},${fading})`;
  context.fill();
  traceFlame(context, reach * 0.4, FLAME.width * 0.3, turn);
  context.fillStyle = `rgba(${FIRE_CORE},${fading})`;
  context.fill();
  context.restore();
}

function paintTracer(context, pixel, { fromX, fromY, toX, toY, age, flight }) {
  const head = Math.min(1, age / flight);
  const tail = Math.max(0, head - TRACER.share);
  const [normalX, normalY] = normalize(fromY - toY, toX - fromX);
  const point = (share, side) => {
    const half = (lerp(TRACER.near, TRACER.far, share) * pixel) / 2;
    return [lerp(fromX, toX, share) + normalX * half * side, lerp(fromY, toY, share) + normalY * half * side];
  };
  [[TRACER.glow, `rgba(${TRACER_GLOW},0.35)`], [1, `rgba(${TRACER_CORE},1)`]].forEach(([swell, color]) => {
    context.fillStyle = color;
    context.beginPath();
    [point(tail, swell), point(head, swell), point(head, -swell), point(tail, -swell)].forEach(([x, y]) => context.lineTo(x, y));
    context.closePath();
    context.fill();
  });
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

function paintCasing(context, pixel, { x, y, angle }) {
  const length = CASING.length * VIEW.scale;
  const width = CASING.width * VIEW.scale;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  inkOutline(context, pixel);
  context.fillStyle = BRASS;
  traceRoundRect(context, -length / 2, -width / 2, length, width, width / 3);
  context.fill();
  context.stroke();
  context.fillStyle = BRASS_SHINE;
  context.fillRect(-length / 2 + width / 3, -width / 3, length - width, width / 4);
  context.restore();
}

function paintSmoke(context, { x, y, age, size }) {
  const t = age / SMOKE.life;
  const radius = lerp(...SMOKE.size, t) * size;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${SMOKE_TINT},${SMOKE.alpha * (1 - t)})`);
  gradient.addColorStop(1, `rgba(${SMOKE_TINT},0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fill();
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
    this.spin = 0;
    this.spinSpeed = 0;
    this.recoil = 0;
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

  get pivot() {
    const { halfWidth, height, frameHeight } = this.room;
    return [halfWidth * VIEW.x, frameHeight - height + VIEW.below + VIEW.sink * (1 - easeOut(this.rise))];
  }

  get angle() {
    const [x, y] = this.pivot;
    return Math.atan2(this.aimY - y, this.aimX - x);
  }

  get flip() {
    return Math.cos(this.angle) < 0 ? -1 : 1;
  }

  toWorld(localX, localY) {
    const [x, y] = this.pivot;
    const [dx, dy] = rotate(localX * VIEW.scale, localY * this.flip * VIEW.scale, this.angle);
    return [x + dx, y + dy];
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
    this.flames = this.flames.filter((flame) => (flame.age += dt) < FLAME.seconds);
    this.hits = this.hits.filter((hit) => (hit.age += dt) < HIT.seconds);
    this.holes = this.holes.filter((hole) => hole.update(dt));
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

  drift(dt) {
    this.casings = this.casings.filter((casing) => {
      casing.age += dt;
      casing.vy += GRAVITY * dt;
      casing.x += casing.vx * dt;
      casing.y += casing.vy * dt;
      casing.angle += casing.spin * dt;
      return casing.age < CASING.life;
    });
    this.puffs = this.puffs.filter((puff) => {
      puff.age += dt;
      puff.y -= SMOKE.rise * dt;
      return puff.age < SMOKE.life;
    });
  }

  puff() {
    const [x, y] = this.toWorld(MUZZLE - this.recoil, 0);
    this.puffs.push({ x, y, age: 0, size: randomBetween(0.7, 1.3) });
  }

  shoot() {
    const [fromX, fromY] = this.toWorld(MUZZLE - this.recoil, 0);
    const [offsetX, offsetY] = polar(randomBetween(0, TAU), this.spread * Math.sqrt(Math.random()));
    const toX = this.aimX + offsetX;
    const toY = Math.min(0, this.aimY + offsetY);
    const flight = Math.hypot(toX - fromX, toY - fromY) / GUN.tracerSpeed;
    this.tracers.push({ fromX, fromY, toX, toY, age: 0, flight });
    this.flames.push({ age: 0, length: randomBetween(...FLAME.length), turn: randomBetween(-1, 1) });
    this.recoil = Math.min(RECOIL.limit, this.recoil + RECOIL.kick);
    this.eject();
  }

  eject() {
    const [x, y] = this.toWorld(PORT.x, PORT.y);
    const [dirX, dirY] = rotate(-CASING.back, -this.flip, this.angle);
    const speed = randomBetween(...CASING.speed);
    this.casings.push({ x, y, vx: dirX * speed + randomBetween(-0.3, 0.3), vy: dirY * speed, angle: randomBetween(0, TAU), spin: randomBetween(-CASING.spin, CASING.spin), age: 0 });
  }

  fly(dt) {
    this.tracers = this.tracers.filter((tracer) => {
      tracer.age += dt;
      if (tracer.age < tracer.flight) return true;
      this.land(tracer);
      return false;
    });
  }

  land({ fromX, fromY, toX, toY }) {
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
    context.save();
    context.globalCompositeOperation = 'lighter';
    this.tracers.forEach((tracer) => paintTracer(context, pixel, tracer));
    context.restore();
    if (this.present) this.drawReticle(context, pixel);
    this.puffs.forEach((puff) => paintSmoke(context, puff));
    if (this.rise > 0) this.drawGun(context, pixel);
    this.casings.forEach((casing) => paintCasing(context, pixel, casing));
  }

  drawGun(context, pixel) {
    const [x, y] = this.pivot;
    const local = pixel / VIEW.scale;
    context.save();
    context.translate(x, y);
    context.rotate(this.angle);
    context.scale(VIEW.scale, this.flip * VIEW.scale);
    context.translate(-this.recoil, 0);
    paintBody(context, local);
    paintBarrels(context, local, this.spin, this.heat);
    this.flames.forEach((flame) => paintFlame(context, flame));
    context.restore();
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
