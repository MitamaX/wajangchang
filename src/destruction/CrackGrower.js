import { TAU, gaussian, lerp, normalize, randomBetween, randomSign, rotate } from '../core/math.js';

const STEP = 1.35;
const ARC_STEP = 1.6;
const ARC_WOBBLE = 0.03;
const MAX_ARC_SWEEP = Math.PI * 1.2;

export class CrackGrower {
  constructor(grid, pattern, grain) {
    this.grid = grid;
    this.pattern = pattern;
    this.grain = grain;
    this.segments = [];
    this.tips = [];
    this.length = 0;
  }

  grow(seed, budget) {
    const trunk = [];
    const queue = [{ ...seed, budget, path: trunk }];
    while (queue.length) this.advance(queue.shift(), queue);
    return trunk;
  }

  advance(crack, queue) {
    let { x, y, dirX, dirY, budget } = crack;
    const { path, pull } = crack;
    path.push(x, y);
    for (let step = 0; ; step++) {
      [dirX, dirY] = this.steer(dirX, dirY, pull);
      const nextX = x + dirX * STEP;
      const nextY = y + dirY * STEP;
      const cost = STEP / (1 + this.pattern.weakening * this.grid.damageAt(nextX, nextY));
      if (cost > budget) {
        this.tips.push({ x, y, dirX, dirY, pull });
        return;
      }
      const escapes = !this.grid.isSolidAt(nextX, nextY) || !this.grid.isSolidAt((x + nextX) / 2, (y + nextY) / 2);
      const joined = this.grid.cutSegment(x, y, nextX, nextY, step > 0);
      this.record(x, y, nextX, nextY);
      path.push(nextX, nextY);
      budget -= cost;
      x = nextX;
      y = nextY;
      if (escapes || joined) return;
      if (Math.random() < this.pattern.branchChance) {
        const share = budget * this.pattern.branchShare;
        budget -= share;
        const [branchX, branchY] = rotate(dirX, dirY, randomSign() * this.pattern.branchAngle * randomBetween(0.6, 1.3));
        queue.push({ x, y, dirX: branchX, dirY: branchY, budget: share, pull, path: [] });
      }
    }
  }

  arc(center, from, to) {
    const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
    let sweep = Math.atan2(to.y - center.y, to.x - center.x) - startAngle;
    while (sweep <= 0) sweep += TAU;
    if (sweep > MAX_ARC_SWEEP) return;
    const startRadius = Math.hypot(from.x - center.x, from.y - center.y);
    const endRadius = Math.hypot(to.x - center.x, to.y - center.y);
    const steps = Math.max(2, Math.ceil((sweep * Math.max(startRadius, endRadius)) / ARC_STEP));
    let x = from.x;
    let y = from.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + sweep * t;
      const radius = lerp(startRadius, endRadius, t) * (1 + gaussian() * ARC_WOBBLE);
      const nextX = i === steps ? to.x : center.x + Math.cos(angle) * radius;
      const nextY = i === steps ? to.y : center.y + Math.sin(angle) * radius;
      this.grid.cutSegment(x, y, nextX, nextY, false);
      this.record(x, y, nextX, nextY);
      x = nextX;
      y = nextY;
    }
  }

  record(x, y, nextX, nextY) {
    this.segments.push(x, y, nextX, nextY);
    this.length += Math.hypot(nextX - x, nextY - y);
  }

  steer(dirX, dirY, pull) {
    let [x, y] = rotate(dirX, dirY, gaussian() * this.pattern.jitter);
    if (pull > 0 && this.grain) {
      const [grainX, grainY] = this.grain;
      const sign = x * grainX + y * grainY >= 0 ? 1 : -1;
      x += (sign * grainX - x) * pull;
      y += (sign * grainY - y) * pull;
    }
    return normalize(x, y);
  }
}
