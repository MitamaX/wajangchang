import { CHARGE } from '../config.js';
import { createCanvas, radiate } from '../core/canvas.js';
import { TAU, clamp, easeOut, polar, randomBetween, randomInt, rotate } from '../core/math.js';

const INK = '170,235,255';
const CORE = '240,252,255';
const HALO = 'rgba(80,180,255,0.95)';
const HALO_TINT = '80,180,255';
const HALO_BLUR = 14;
const HALO_ALPHA = 0.3;
const HALO_SPREAD = 8;
const SPRITE_STEP = Math.log(1.1);
const SPRITE_MARGIN = HALO_BLUR * 2;
const SPRITE_LIMIT = 320;
const LINE = 1.6;
const FADE_RATE = 5;
const POP_SECONDS = 0.24;
const POP_FLASH = 2;
const PULSE_RATE = 18;
const PULSE_DEPTH = 0.25;
const CORE_GLOW = [0.25, 0.75];
const CORE_REACH = 1.2;
const TICKS = 48;
const RUNES = Object.freeze({ inner: 12, outer: 20 });
const RUNE_STROKES = [2, 4];
const RUNE_GRID = [-0.5, 0, 0.5];
const SATELLITES = 6;
const RAYS = 24;
const MOTE_RATE = 70;
const MOTE_REACH = [1.5, 2.3];
const MOTE_SPEED = [1.6, 3.2];
const MOTE_SWIRL = 2.5;
const MOTE_TRAIL = 0.12;
const MOTE_LENGTH = 0.18;
const MOTE_ARRIVAL = 0.1;
const MOTE_WIDTH = 1.4;
const BURST_SECONDS = 0.5;
const BURST_GROWTH = 1.4;
const BURST_WIDTH = 7;
const BURST_ECHO = 0.7;

const overshoot = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

function ring(context, radius) {
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.stroke();
}

function polygon(context, radius, corners, turn = 0) {
  context.beginPath();
  for (let i = 0; i < corners; i++) context.lineTo(...polar(turn + (i / corners) * TAU - Math.PI / 2, radius));
  context.closePath();
  context.stroke();
}

function spokes(context, inner, outer, count) {
  context.beginPath();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    context.moveTo(...polar(angle, inner));
    context.lineTo(...polar(angle, outer));
  }
  context.stroke();
}

function runes(context, glyphs, radius, size) {
  context.beginPath();
  glyphs.forEach((strokes, i) => {
    const place = (gx, gy) => rotate(gx * size, gy * size - radius, (i / glyphs.length) * TAU);
    strokes.forEach(([ax, ay, bx, by]) => {
      context.moveTo(...place(ax, ay));
      context.lineTo(...place(bx, by));
    });
  });
  context.stroke();
}

function satellites(context, distance, radius) {
  for (let i = 0; i < SATELLITES; i++) {
    context.save();
    context.translate(...polar((i / SATELLITES) * TAU, distance));
    ring(context, radius);
    polygon(context, radius * 0.78, 3);
    polygon(context, radius * 0.78, 3, Math.PI);
    context.restore();
  }
}

function rune() {
  const node = () => [RUNE_GRID[randomInt(0, 2)], RUNE_GRID[randomInt(0, 2)]];
  return Array.from({ length: randomInt(...RUNE_STROKES) }, () => [...node(), ...node()]);
}

const SHAPES = [
  {
    spin: 0.6,
    reach: 1,
    draw(context, radius) {
      ring(context, radius);
      ring(context, radius * 0.88);
      spokes(context, radius * 0.88, radius, TICKS);
    },
  },
  {
    spin: -0.9,
    reach: 0.88,
    draw(context, radius) {
      polygon(context, radius * 0.88, 3);
      polygon(context, radius * 0.88, 3, Math.PI);
      ring(context, radius * 0.46);
      polygon(context, radius * 0.46, 4);
    },
  },
  {
    spin: 0.35,
    reach: 1.26,
    draw(context, radius, glyphs) {
      ring(context, radius * 1.12);
      ring(context, radius * 1.26);
      runes(context, glyphs.inner, radius * 1.19, radius * 0.09);
    },
  },
  {
    spin: -0.5,
    reach: 1.64,
    draw(context, radius) {
      satellites(context, radius * 1.48, radius * 0.16);
    },
  },
  {
    spin: 0.22,
    reach: 1.92,
    draw(context, radius, glyphs) {
      ring(context, radius * 1.72);
      ring(context, radius * 1.86);
      runes(context, glyphs.outer, radius * 1.79, radius * 0.1);
      spokes(context, radius * 1.86, radius * 1.92, TICKS);
    },
  },
  {
    spin: -1.6,
    reach: 2.3,
    draw(context, radius) {
      spokes(context, radius * 1.98, radius * 2.3, RAYS);
      polygon(context, radius * 0.3, 6);
      polygon(context, radius * 0.3, 6, Math.PI / 6);
    },
  },
];

const LAYERS = SHAPES.map((shape, i) => ({ ...shape, from: [0, ...CHARGE.tiers][i] }));

function glowStroke(context, pixel, width, color, alpha) {
  context.strokeStyle = `rgba(${HALO_TINT},${alpha * HALO_ALPHA})`;
  context.lineWidth = width + HALO_SPREAD * pixel;
  context.stroke();
  context.strokeStyle = `rgba(${color},${alpha})`;
  context.lineWidth = width;
  context.stroke();
}

class LayerSprite {
  constructor(layer, glyphs) {
    this.layer = layer;
    this.glyphs = glyphs;
    this.canvas = createCanvas(1, 1);
    this.step = NaN;
    this.radius = 0;
  }

  fit(radius, lineWidth) {
    const step = Math.round(Math.log(clamp(radius, 1, SPRITE_LIMIT)) / SPRITE_STEP);
    if (step === this.step) return;
    this.step = step;
    this.radius = Math.exp(step * SPRITE_STEP);
    const density = this.radius / radius;
    const half = Math.ceil(this.radius * this.layer.reach + SPRITE_MARGIN);
    this.canvas.width = half * 2;
    this.canvas.height = half * 2;
    const context = this.canvas.getContext('2d');
    context.translate(half, half);
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = HALO;
    context.shadowBlur = HALO_BLUR * density;
    context.strokeStyle = `rgba(${INK},1)`;
    context.lineWidth = lineWidth * density;
    this.layer.draw(context, this.radius, this.glyphs);
  }

  draw(context, radius) {
    const half = (this.canvas.width / 2) * (radius / this.radius);
    context.drawImage(this.canvas, -half, -half, half * 2, half * 2);
  }
}

export function glow(context, x, y, radius, strength) {
  radiate(context, x, y, radius, [
    [0, `rgba(${CORE},${0.9 * strength})`],
    [0.35, `rgba(${INK},${0.35 * strength})`],
    [1, `rgba(${INK},0)`],
  ]);
}

export class MagicCircle {
  constructor() {
    const glyphs = { inner: Array.from({ length: RUNES.inner }, rune), outer: Array.from({ length: RUNES.outer }, rune) };
    this.sprites = LAYERS.map((layer) => new LayerSprite(layer, glyphs));
    this.focus = null;
    this.fade = 0;
    this.time = 0;
    this.pending = 0;
    this.motes = [];
    this.bursts = [];
  }

  get busy() {
    return this.fade > 0 || this.motes.length > 0 || this.bursts.length > 0;
  }

  update(dt, focus) {
    this.time += dt;
    if (focus) this.focus = focus;
    this.fade = focus ? 1 : Math.max(0, this.fade - dt * FADE_RATE);
    if (focus) this.gather(dt);
    this.motes = this.motes.filter((mote) => this.drift(mote, dt));
    this.bursts = this.bursts.filter((burst) => (burst.age += dt) < BURST_SECONDS);
  }

  gather(dt) {
    const { radius, charge } = this.focus;
    this.pending += MOTE_RATE * charge * dt;
    for (; this.pending >= 1; this.pending--) {
      this.motes.push({ angle: randomBetween(0, TAU), distance: radius * randomBetween(...MOTE_REACH), speed: radius * randomBetween(...MOTE_SPEED) });
    }
  }

  drift(mote, dt) {
    mote.distance -= mote.speed * dt;
    mote.angle += MOTE_SWIRL * dt;
    return mote.distance > this.focus.radius * MOTE_ARRIVAL;
  }

  discharge() {
    if (!this.fade) return;
    this.bursts.push({ ...this.focus, age: 0 });
    this.fade = 0;
    this.motes = [];
  }

  draw(context, pixel) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    this.bursts.forEach((burst) => this.drawBurst(context, pixel, burst));
    if (this.fade) this.drawSigil(context, pixel);
    context.restore();
  }

  drawSigil(context, pixel) {
    const { x, y, radius, charge } = this.focus;
    const pulse = charge >= 1 ? 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin(this.time * PULSE_RATE) : 1;
    const intensity = this.fade * pulse;
    glow(context, x, y, radius * CORE_REACH, intensity * (CORE_GLOW[0] + (CORE_GLOW[1] - CORE_GLOW[0]) * charge));
    context.translate(x, y);
    const { a, b } = context.getTransform();
    const deviceScale = Math.hypot(a, b);
    this.sprites.forEach((sprite) => this.drawLayer(context, pixel, sprite, intensity, deviceScale));
    this.drawMotes(context, pixel, intensity);
  }

  drawLayer(context, pixel, sprite, intensity, deviceScale) {
    const { radius, charge } = this.focus;
    const since = (charge - sprite.layer.from) * CHARGE.seconds;
    if (since < 0) return;
    const t = Math.min(1, since / POP_SECONDS);
    const scale = overshoot(t);
    sprite.fit(radius * deviceScale, LINE * pixel * deviceScale);
    context.save();
    context.rotate(this.time * sprite.layer.spin);
    context.scale(scale, scale);
    context.globalAlpha = Math.min(1, intensity * Math.min(1, t * 3) * (1 + POP_FLASH * (1 - t)));
    sprite.draw(context, radius);
    context.restore();
  }

  drawMotes(context, pixel, intensity) {
    context.beginPath();
    this.motes.forEach(({ angle, distance }) => {
      context.moveTo(...polar(angle, distance));
      context.lineTo(...polar(angle - MOTE_TRAIL, distance * (1 + MOTE_LENGTH)));
    });
    glowStroke(context, pixel, MOTE_WIDTH * pixel, CORE, intensity);
  }

  drawBurst(context, pixel, { x, y, radius, charge, age }) {
    const t = age / BURST_SECONDS;
    const fading = 1 - t;
    const spread = radius * (1 + BURST_GROWTH * easeOut(t)) * (1 + charge);
    glow(context, x, y, spread, fading ** 3 * (0.4 + charge));
    const width = LINE * pixel * (1 + BURST_WIDTH * charge) * fading;
    [1, BURST_ECHO].forEach((share) => {
      context.beginPath();
      context.arc(x, y, spread * share, 0, TAU);
      glowStroke(context, pixel, width, CORE, fading * share);
    });
  }
}
