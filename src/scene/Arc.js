import { radiate, strokeLayers } from '../core/canvas.js';
import { normalize, randomBetween } from '../core/math.js';

const GLOW = Object.freeze({ width: 11, alpha: 0.35 });
const CORE_WIDTH = 2.6;
const SPARK_ALPHA = 0.5;
const ARC = '150,190,255';
const ARC_CORE = '240,246,255';

export function jagged(ax, ay, bx, by, depth, jag) {
  let path = [ax, ay, bx, by];
  for (let level = 0; level < depth; level++) {
    const next = [path[0], path[1]];
    for (let i = 2; i < path.length; i += 2) {
      const [fromX, fromY, toX, toY] = path.slice(i - 2, i + 2);
      const [normalX, normalY] = normalize(fromY - toY, toX - fromX);
      const offset = randomBetween(-jag, jag) * Math.hypot(toX - fromX, toY - fromY);
      next.push((fromX + toX) / 2 + normalX * offset, (fromY + toY) / 2 + normalY * offset, toX, toY);
    }
    path = next;
  }
  return path;
}

export function tracePath(context, path, share = 1) {
  const last = Math.max(2, Math.round((path.length / 2 - 1) * share) * 2);
  context.beginPath();
  context.moveTo(path[0], path[1]);
  for (let i = 2; i <= last; i += 2) context.lineTo(path[i], path[i + 1]);
}

export function paintArc(context, pixel, path, brightness, width = 1) {
  tracePath(context, path);
  strokeLayers(context, pixel * width, [[GLOW.width, `rgba(${ARC},${GLOW.alpha * brightness})`], [CORE_WIDTH, `rgba(${ARC_CORE},${brightness})`]]);
}

export function paintSpark(context, x, y, radius, brightness) {
  radiate(context, x, y, radius, [
    [0, `rgba(${ARC_CORE},${brightness})`],
    [0.3, `rgba(${ARC},${SPARK_ALPHA * brightness})`],
    [1, `rgba(${ARC},0)`],
  ]);
}

export function paintLeader(context, pixel, path, share, alpha, width) {
  context.strokeStyle = `rgba(${ARC},${alpha})`;
  context.lineWidth = width * pixel;
  tracePath(context, path, share);
  context.stroke();
}
