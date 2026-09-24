import { CHARGE } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, easeOut, polar, randomBetween, randomInt, rotate } from '../core/math.js';

const INK = '170,235,255';
const CORE = '240,252,255';
const HALO = 'rgba(80,180,255,0.95)';
const HALO_BLUR = 14;
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
    draw(context, radius) {
      ring(context, radius);
      ring(context, radius * 0.88);
      spokes(context, radius * 0.88, radius, TICKS);
    },
  },
  {
    spin: -0.9,
    draw(context, radius) {
      polygon(context, radius * 0.88, 3);
      polygon(context, radius * 0.88, 3, Math.PI);
      ring(context, radius * 0.46);
      polygon(context, radius * 0.46, 4);
    },
  },
  {
    spin: 0.35,
    draw(context, radius, glyphs) {
      ring(context, radius * 1.12);
      ring(context, radius * 1.26);
      runes(context, glyphs.inner, radius * 1.19, radius * 0.09);
    },
  },
  {
    spin: -0.5,
    draw(context, radius) {
      satellites(context, radius * 1.48, radius * 0.16);
    },
  },
  {
    spin: 0.22,
    draw(context, radius, glyphs) {
      ring(context, radius * 1.72);
      ring(context, radius * 1.86);
      runes(context, glyphs.outer, radius * 1.79, radius * 0.1);
      spokes(context, radius * 1.86, radius * 1.92, TICKS);
    },
  },
  {
    spin: -1.6,
    draw(context, radius) {
      spokes(context, radius * 1.98, radius * 2.3, RAYS);
      polygon(context, radius * 0.3, 6);
      polygon(context, radius * 0.3, 6, Math.PI / 6);
    },
  },
];

const LAYERS = SHAPES.map((shape, i) => ({ ...shape, from: [0, ...CHARGE.tiers][i] }));

export function glow(context, x, y, radius, strength) {
  radiate(context, x, y, radius, [
    [0, `rgba(${CORE},${0.9 * strength})`],
    [0.35, `rgba(${INK},${0.35 * strength})`],
    [1, `rgba(${INK},0)`],
  ]);
}

export class MagicCircle {
  constructor() {
    this.glyphs = { inner: Array.from({ length: RUNES.inner }, rune), outer: Array.from({ length: RUNES.outer }, rune) };
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
    context.lineJoin = 'round';
    context.shadowColor = HALO;
    context.shadowBlur = HALO_BLUR;
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
    LAYERS.forEach((layer) => this.drawLayer(context, pixel, layer, intensity));
    this.drawMotes(context, pixel, intensity);
  }

  drawLayer(context, pixel, layer, intensity) {
    const { radius, charge } = this.focus;
    const since = (charge - layer.from) * CHARGE.seconds;
    if (since < 0) return;
    const t = Math.min(1, since / POP_SECONDS);
    const scale = overshoot(t);
    context.save();
    context.rotate(this.time * layer.spin);
    context.scale(scale, scale);
    context.strokeStyle = `rgba(${INK},${intensity * Math.min(1, t * 3) * (1 + POP_FLASH * (1 - t))})`;
    context.lineWidth = (LINE * pixel) / scale;
    layer.draw(context, radius, this.glyphs);
    context.restore();
  }

  drawMotes(context, pixel, intensity) {
    context.strokeStyle = `rgba(${CORE},${intensity})`;
    context.lineWidth = MOTE_WIDTH * pixel;
    context.beginPath();
    this.motes.forEach(({ angle, distance }) => {
      context.moveTo(...polar(angle, distance));
      context.lineTo(...polar(angle - MOTE_TRAIL, distance * (1 + MOTE_LENGTH)));
    });
    context.stroke();
  }

  drawBurst(context, pixel, { x, y, radius, charge, age }) {
    const t = age / BURST_SECONDS;
    const fading = 1 - t;
    const spread = radius * (1 + BURST_GROWTH * easeOut(t)) * (1 + charge);
    glow(context, x, y, spread, fading ** 3 * (0.4 + charge));
    context.lineWidth = LINE * pixel * (1 + BURST_WIDTH * charge) * fading;
    [1, BURST_ECHO].forEach((share) => {
      context.strokeStyle = `rgba(${CORE},${fading * share})`;
      context.beginPath();
      context.arc(x, y, spread * share, 0, TAU);
      context.stroke();
    });
  }
}
