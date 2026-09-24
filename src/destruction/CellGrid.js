import { TAU, randomBetween } from '../core/math.js';
import { pinchScale, pinchedPosition } from './pinch.js';

export const Side = Object.freeze({ TOP: 1, RIGHT: 2, BOTTOM: 4, LEFT: 8 });

const WOBBLE_HARMONICS = [2, 3, 5];
const CELL_FIELDS = ['solid', 'cutRight', 'cutDown', 'damage', 'rimmed'];

function crossesRow(ax, ay, bx, by, fromX, toX, rowY) {
  const dy = by - ay;
  if (dy === 0) return false;
  const t = (rowY - ay) / dy;
  if (t < 0 || t > 1) return false;
  const x = ax + (bx - ax) * t;
  return x >= fromX && x <= toX;
}

function crossesColumn(ax, ay, bx, by, fromY, toY, columnX) {
  const dx = bx - ax;
  if (dx === 0) return false;
  const t = (columnX - ax) / dx;
  if (t < 0 || t > 1) return false;
  const y = ay + (by - ay) * t;
  return y >= fromY && y <= toY;
}

function openWalk(cells, width, x, y, toX, toY, alongX) {
  while (x !== toX || y !== toY) {
    const moveX = alongX ? x !== toX : y === toY;
    const nextX = moveX ? x + Math.sign(toX - x) : x;
    const nextY = moveX ? y : y + Math.sign(toY - y);
    const cut = moveX ? cells.cutRight[y * width + Math.min(x, nextX)] : cells.cutDown[Math.min(y, nextY) * width + x];
    if (cut || !cells.solid[nextY * width + nextX]) return false;
    x = nextX;
    y = nextY;
  }
  return true;
}

function linked(cells, width, from, to) {
  const fromX = from % width;
  const fromY = (from - fromX) / width;
  const toX = to % width;
  const toY = (to - toX) / width;
  return openWalk(cells, width, fromX, fromY, toX, toY, true) || openWalk(cells, width, fromX, fromY, toX, toY, false);
}

function wobbleFunction() {
  const phases = WOBBLE_HARMONICS.map(() => randomBetween(0, TAU));
  return (angle) => {
    let total = 0;
    WOBBLE_HARMONICS.forEach((harmonic, i) => {
      total += Math.sin(angle * harmonic + phases[i]);
    });
    return total / WOBBLE_HARMONICS.length;
  };
}

export class CellGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.solid = new Uint8Array(size);
    this.cutRight = new Uint8Array(size);
    this.cutDown = new Uint8Array(size);
    this.damage = new Float32Array(size);
    this.rimmed = new Uint8Array(size);
    this.tips = [];
  }

  isSolid(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.solid[y * this.width + x] === 1;
  }

  isSolidAt(px, py) {
    return this.isSolid(Math.floor(px), Math.floor(py));
  }

  damageAt(px, py) {
    const x = Math.floor(px);
    const y = Math.floor(py);
    return this.isSolid(x, y) ? this.damage[y * this.width + x] : 0;
  }

  countSolid() {
    let count = 0;
    for (let i = 0; i < this.solid.length; i++) count += this.solid[i];
    return count;
  }

  centroid() {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.solid[y * this.width + x]) continue;
        sumX += x + 0.5;
        sumY += y + 0.5;
        count++;
      }
    }
    return count ? { x: sumX / count, y: sumY / count } : { x: this.width / 2, y: this.height / 2 };
  }

  forEachCellWithin(cx, cy, radius, visit) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.floor(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.height - 1, Math.floor(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const distance = Math.hypot(dx, dy);
        if (distance <= radius) visit(y * this.width + x, distance, dx, dy);
      }
    }
  }

  nearestSolid(px, py, reach) {
    let nearest = null;
    let nearestDistance = Infinity;
    this.forEachCellWithin(px, py, reach, (index, distance, dx, dy) => {
      if (!this.solid[index] || distance >= nearestDistance) return;
      nearestDistance = distance;
      nearest = { x: px + dx, y: py + dy };
    });
    return nearest;
  }

  addDamage(cx, cy, radius, amount) {
    this.forEachCellWithin(cx, cy, radius, (index, distance) => {
      if (!this.solid[index]) return;
      const falloff = 1 - distance / radius;
      this.damage[index] += amount * falloff * falloff;
    });
  }

  carve(cx, cy, radius, roughness) {
    const wobble = wobbleFunction();
    const removed = [];
    this.forEachCellWithin(cx, cy, radius * (1 + roughness), (index, distance, dx, dy) => {
      if (!this.solid[index]) return;
      if (distance > radius * (1 + roughness * wobble(Math.atan2(dy, dx)))) return;
      this.solid[index] = 0;
      removed.push(index);
    });
    return removed;
  }

  forEachSolid(visit) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        if (this.solid[index]) visit(x + 0.5, y + 0.5, index);
      }
    }
  }

  carveWhere(inside) {
    const removed = [];
    this.forEachSolid((x, y, index) => {
      if (!inside(x, y)) return;
      this.solid[index] = 0;
      removed.push(index);
    });
    return removed;
  }

  resampled(backward, { left, top, width, height }) {
    const grid = new CellGrid(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [sourceX, sourceY] = backward(left + x + 0.5, top + y + 0.5);
        if (!this.isSolidAt(sourceX, sourceY)) continue;
        const index = y * width + x;
        grid.solid[index] = 1;
        grid.damage[index] = this.damageAt(sourceX, sourceY);
      }
    }
    return grid;
  }

  cutSegment(ax, ay, bx, by, detectJoin) {
    const { width, height, solid, cutRight, cutDown } = this;
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx) - 1.5));
    const x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx) - 0.5));
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by) - 1.5));
    const y1 = Math.min(height - 1, Math.floor(Math.max(ay, by) - 0.5));
    let joined = false;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const index = y * width + x;
        if (!solid[index]) continue;
        const centerX = x + 0.5;
        const centerY = y + 0.5;
        if (x + 1 < width && solid[index + 1] && crossesRow(ax, ay, bx, by, centerX, centerX + 1, centerY)) {
          if (cutRight[index]) joined = joined || detectJoin;
          else cutRight[index] = 1;
        }
        if (y + 1 < height && solid[index + width] && crossesColumn(ax, ay, bx, by, centerY, centerY + 1, centerX)) {
          if (cutDown[index]) joined = joined || detectJoin;
          else cutDown[index] = 1;
        }
      }
    }
    return joined;
  }

  components() {
    const { width, height, solid, cutRight, cutDown } = this;
    const size = width * height;
    const labels = new Int32Array(size).fill(-1);
    const stack = new Int32Array(size);
    const parts = [];
    let top = 0;
    const claim = (next, label) => {
      if (!solid[next] || labels[next] >= 0) return;
      labels[next] = label;
      stack[top++] = next;
    };
    for (let seed = 0; seed < size; seed++) {
      if (!solid[seed] || labels[seed] >= 0) continue;
      const part = { label: parts.length, count: 0, minX: width, minY: height, maxX: -1, maxY: -1 };
      claim(seed, part.label);
      while (top > 0) {
        const index = stack[--top];
        const x = index % width;
        const y = (index - x) / width;
        part.count++;
        part.minX = Math.min(part.minX, x);
        part.maxX = Math.max(part.maxX, x);
        part.minY = Math.min(part.minY, y);
        part.maxY = Math.max(part.maxY, y);
        if (x + 1 < width && !cutRight[index]) claim(index + 1, part.label);
        if (x > 0 && !cutRight[index - 1]) claim(index - 1, part.label);
        if (y + 1 < height && !cutDown[index]) claim(index + width, part.label);
        if (y > 0 && !cutDown[index - width]) claim(index - width, part.label);
      }
      parts.push(part);
    }
    return { labels, parts };
  }

  extract(labels, part) {
    const width = part.maxX - part.minX + 1;
    const height = part.maxY - part.minY + 1;
    const grid = new CellGrid(width, height);
    CELL_FIELDS.forEach((field) => {
      const into = grid[field];
      const from = this[field];
      for (let y = 0; y < height; y++) {
        const row = (y + part.minY) * this.width + part.minX;
        for (let x = 0; x < width; x++) {
          if (labels[row + x] === part.label) into[y * width + x] = from[row + x];
        }
      }
    });
    grid.tips = this.tips
      .filter((tip) => this.isSolidAt(tip.x, tip.y) && labels[Math.floor(tip.y) * this.width + Math.floor(tip.x)] === part.label)
      .map((tip) => ({ ...tip, x: tip.x - part.minX, y: tip.y - part.minY }));
    return grid;
  }

  pinch(cx, cy, radius, strength) {
    const source = Object.fromEntries(CELL_FIELDS.map((field) => [field, this[field].slice()]));
    const origins = new Map();
    this.forEachCellWithin(cx, cy, radius, (index, distance, dx, dy) => {
      const scale = pinchScale(distance, radius, strength);
      const sampleX = Math.floor(cx + dx * scale);
      const sampleY = Math.floor(cy + dy * scale);
      if (sampleX < 0 || sampleY < 0 || sampleX >= this.width || sampleY >= this.height) {
        this.solid[index] = 0;
        return;
      }
      const from = sampleY * this.width + sampleX;
      origins.set(index, from);
      CELL_FIELDS.forEach((field) => {
        this[field][index] = source[field][from];
      });
    });
    this.recut(source, (index) => origins.get(index) ?? index, cx, cy, radius);
    this.tips = this.tips.map((tip) => {
      const [x, y] = pinchedPosition(tip.x, tip.y, cx, cy, radius, strength);
      return { ...tip, x, y };
    });
  }

  recut(source, origin, cx, cy, radius) {
    const { width, solid } = this;
    const severed = (index, neighbor) => Boolean(solid[index] && solid[neighbor]) && !linked(source, width, origin(index), origin(neighbor));
    this.forEachCellWithin(cx, cy, radius + 1, (index) => {
      if ((index % width) + 1 < width) this.cutRight[index] = severed(index, index + 1) ? 1 : 0;
      if (index + width < solid.length) this.cutDown[index] = severed(index, index + width) ? 1 : 0;
    });
  }

  freshRims() {
    const { width, height, solid, rimmed } = this;
    const sides = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!solid[index]) continue;
        const exposed = (y === 0 || !solid[index - width] ? Side.TOP : 0)
          | (x === width - 1 || !solid[index + 1] ? Side.RIGHT : 0)
          | (y === height - 1 || !solid[index + width] ? Side.BOTTOM : 0)
          | (x === 0 || !solid[index - 1] ? Side.LEFT : 0);
        const fresh = exposed & ~rimmed[index];
        if (!fresh) continue;
        rimmed[index] |= fresh;
        sides.push(x, y, fresh);
      }
    }
    return sides;
  }
}
