import { TEXELS_PER_CELL } from '../config.js';
import { TAU, randomBetween } from '../core/math.js';

const T = TEXELS_PER_CELL;

function tint(context, width, height, color) {
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
}

function wavyLine(context, length, base, horizontal) {
  const amplitude = randomBetween(1, 5) * T;
  const frequency = (randomBetween(1, 3) * TAU) / length;
  const phase = randomBetween(0, TAU);
  context.beginPath();
  for (let t = 0; t <= length; t += T * 4) {
    const offset = base + Math.sin(t * frequency + phase) * amplitude;
    const [x, y] = horizontal ? [t, offset] : [offset, t];
    if (t === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
}

const FINISHES = {
  gloss(context, width, height) {
    const sweep = context.createLinearGradient(0, 0, width * 0.9, height);
    sweep.addColorStop(0, 'rgba(255,255,255,0.16)');
    sweep.addColorStop(0.32, 'rgba(255,255,255,0.04)');
    sweep.addColorStop(0.33, 'rgba(255,255,255,0)');
    sweep.addColorStop(1, 'rgba(255,255,255,0.06)');
    tint(context, width, height, sweep);
    tint(context, width, height, 'rgba(190,232,226,0.1)');
  },
  grain(context, width, height, grain) {
    const horizontal = grain[0] !== 0;
    const span = horizontal ? height : width;
    const length = horizontal ? width : height;
    tint(context, width, height, 'rgba(214,160,96,0.1)');
    const lines = Math.round(span / (T * 2.2));
    for (let i = 0; i < lines; i++) {
      context.strokeStyle = `rgba(92,54,22,${randomBetween(0.05, 0.16)})`;
      context.lineWidth = randomBetween(0.5, 1.6) * T;
      wavyLine(context, length, ((i + Math.random()) * span) / lines, horizontal);
    }
  },
  speckle(context, width, height) {
    tint(context, width, height, 'rgba(120,116,108,0.1)');
    const count = Math.round((width * height) / 60);
    for (let i = 0; i < count; i++) {
      context.fillStyle = Math.random() < 0.55 ? `rgba(0,0,0,${randomBetween(0.05, 0.2)})` : `rgba(255,255,255,${randomBetween(0.05, 0.18)})`;
      const size = randomBetween(0.3, 1) * T;
      context.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
  },
  brushed(context, width, height) {
    for (let y = 0; y < height; y += 2) {
      context.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${randomBetween(0.02, 0.07)})` : `rgba(0,0,0,${randomBetween(0.02, 0.06)})`;
      context.fillRect(0, y + Math.random(), width, randomBetween(0.6, 1.4));
    }
    const sheen = context.createLinearGradient(0, 0, width, height);
    sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.06)');
    tint(context, width, height, sheen);
  },
};

export function applyFinish(skin, finish, grain) {
  skin.paint('source-atop', (context) => FINISHES[finish](context, skin.canvas.width, skin.canvas.height, grain));
}
