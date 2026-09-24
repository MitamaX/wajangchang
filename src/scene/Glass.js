import { radiate } from '../core/canvas.js';
import { TAU, clamp, polar, randomBetween, randomInt, rotate } from '../core/math.js';

const LINES = Object.freeze({ shadow: 2.8, light: 1.1, hold: 0.55 });
const SHADOW = 'rgba(12,16,22,0.5)';
const LIGHT = '235,245,255';
const HOLE = 'rgba(8,10,14,0.9)';
const DENT = '12,16,22';

function tracePolyline(context, points) {
  context.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) context.lineTo(points[i], points[i + 1]);
}

function shatter({ spokes, reach, bends, jitter, rings, skip, core }) {
  const count = randomInt(...spokes);
  const turn = randomBetween(0, TAU);
  const rays = Array.from({ length: count }, (_, i) => {
    const heading = turn + ((i + randomBetween(-0.3, 0.3)) / count) * TAU;
    const length = randomBetween(...reach);
    const points = [...polar(heading, core)];
    for (let bend = 1; bend <= bends; bend++) points.push(...polar(heading + randomBetween(-jitter, jitter), (length * bend) / bends));
    return { heading, length, points };
  });
  const webs = rings.flatMap((share) => rays.flatMap((ray, i) => {
    const next = rays[(i + 1) % count];
    if (Math.random() < skip) return [];
    const radius = share * Math.min(ray.length, next.length);
    const middle = (ray.heading + next.heading + (next.heading < ray.heading ? TAU : 0)) / 2;
    return [[...polar(ray.heading, radius), ...polar(middle, radius * randomBetween(0.86, 0.96)), ...polar(next.heading, radius)]];
  }));
  return [...rays.map(({ points }) => points), ...webs];
}

function knuckles({ gap, arch, size: [width, height], scale, tilt }) {
  const turn = randomBetween(-tilt, tilt);
  const middle = (scale.length - 1) / 2;
  return scale.map((share, i) => {
    const offset = (i - middle) / middle;
    const [x, y] = rotate((i - middle) * gap, arch * (offset * offset - 1), turn);
    return { x, y, width: width * share, height: height * share, turn };
  });
}

function paintKnuckles(context, pixel, prints) {
  prints.forEach(({ x, y, width, height, turn }) => {
    const gradient = context.createRadialGradient(x, y - height * 0.3, 0, x, y, width);
    gradient.addColorStop(0, `rgba(${DENT},0.5)`);
    gradient.addColorStop(0.7, `rgba(${DENT},0.25)`);
    gradient.addColorStop(1, `rgba(${DENT},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, width, height, turn, 0, TAU);
    context.fill();
    context.strokeStyle = `rgba(${LIGHT},0.6)`;
    context.lineWidth = LINES.light * pixel;
    context.beginPath();
    context.ellipse(x, y, width, height, turn, 0, Math.PI);
    context.stroke();
  });
}

export class Crack {
  constructor(x, y, pattern, seconds) {
    this.x = x;
    this.y = y;
    this.pattern = pattern;
    this.seconds = seconds;
    this.lines = shatter(pattern);
    this.prints = pattern.knuckles ? knuckles(pattern.knuckles) : [];
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    return this.age < this.seconds;
  }

  draw(context, pixel) {
    const { x, y, pattern } = this;
    const fading = clamp((1 - this.age / this.seconds) / (1 - LINES.hold), 0, 1);
    radiate(context, x, y, pattern.core * 3, [[0, `rgba(${LIGHT},${0.8 * fading})`], [1, `rgba(${LIGHT},0)`]]);
    context.save();
    context.translate(x, y);
    context.globalAlpha = fading;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    this.lines.forEach((points) => tracePolyline(context, points));
    context.strokeStyle = SHADOW;
    context.lineWidth = LINES.shadow * pixel;
    context.stroke();
    context.strokeStyle = `rgba(${LIGHT},0.9)`;
    context.lineWidth = LINES.light * pixel;
    context.stroke();
    paintKnuckles(context, pixel, this.prints);
    if (pattern.hole) {
      context.fillStyle = HOLE;
      context.strokeStyle = `rgba(${LIGHT},0.8)`;
      context.beginPath();
      context.arc(0, 0, pattern.core, 0, TAU);
      context.fill();
      context.stroke();
    }
    context.restore();
  }
}
