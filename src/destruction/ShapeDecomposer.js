import earcut from 'earcut';

const EDGE_X = [1, 0, -1, 0];
const EDGE_Y = [0, 1, 0, -1];
const CONVEX_EPSILON = 1e-6;
const MIN_PART_AREA = 1;
const MIN_PART_THICKNESS = 0.6;
const TOLERANCE_GROWTH = 1.7;
const ATTEMPTS = 4;
const KEY_BASE = 1 << 16;

function signedArea(points) {
  let area = 0;
  const count = points.length;
  for (let i = 0; i < count; i += 2) {
    const j = (i + 2) % count;
    area += points[i] * points[j + 1] - points[j] * points[i + 1];
  }
  return area / 2;
}

function isSturdy(points) {
  const area = signedArea(points);
  if (area < MIN_PART_AREA) return false;
  let longest = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    longest = Math.max(longest, Math.hypot(points[j] - points[i], points[j + 1] - points[i + 1]));
  }
  return (2 * area) / longest >= MIN_PART_THICKNESS;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function simplifyClosed(points, tolerance) {
  const count = points.length / 2;
  if (count <= 4) return points;
  let far = 0;
  let farthest = -1;
  for (let i = 1; i < count; i++) {
    const distance = Math.hypot(points[i * 2] - points[0], points[i * 2 + 1] - points[1]);
    if (distance > farthest) {
      farthest = distance;
      far = i;
    }
  }
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[far] = 1;
  const ranges = [0, far, far, count];
  while (ranges.length) {
    const end = ranges.pop();
    const start = ranges.pop();
    const ax = points[start * 2];
    const ay = points[start * 2 + 1];
    const bx = points[(end % count) * 2];
    const by = points[(end % count) * 2 + 1];
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(points[i * 2], points[i * 2 + 1], ax, ay, bx, by);
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = i;
      }
    }
    if (worst < 0) continue;
    keep[worst] = 1;
    ranges.push(start, worst, worst, end);
  }
  const simplified = [];
  for (let i = 0; i < count; i++) if (keep[i]) simplified.push(points[i * 2], points[i * 2 + 1]);
  return simplified;
}

function turn(coords, a, b, c) {
  return (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[b * 2 + 1])
    - (coords[b * 2 + 1] - coords[a * 2 + 1]) * (coords[c * 2] - coords[b * 2]);
}

function edgeKey(u, v) {
  return u < v ? u * KEY_BASE + v : v * KEY_BASE + u;
}

function forEachEdge(polygon, visit) {
  polygon.forEach((vertex, i) => visit(vertex, polygon[(i + 1) % polygon.length]));
}

function mergeAcross(coords, first, second, u, v) {
  const at = first.findIndex((vertex, i) => {
    const next = first[(i + 1) % first.length];
    return (vertex === u && next === v) || (vertex === v && next === u);
  });
  if (at < 0) return null;
  const tail = first[at];
  const head = first[(at + 1) % first.length];
  const join = second.findIndex((vertex, i) => vertex === head && second[(i + 1) % second.length] === tail);
  if (join < 0) return null;
  const firstCount = first.length;
  const secondCount = second.length;
  const beforeTail = first[(at - 1 + firstCount) % firstCount];
  const afterHead = first[(at + 2) % firstCount];
  const afterTail = second[(join + 2) % secondCount];
  const beforeHead = second[(join - 1 + secondCount) % secondCount];
  if (turn(coords, beforeTail, tail, afterTail) < -CONVEX_EPSILON) return null;
  if (turn(coords, beforeHead, head, afterHead) < -CONVEX_EPSILON) return null;
  const merged = [];
  for (let i = 1; i <= firstCount; i++) merged.push(first[(at + i) % firstCount]);
  for (let i = 2; i < secondCount; i++) merged.push(second[(join + i) % secondCount]);
  return merged;
}

function convexPieces(coords, triangles) {
  const polygons = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
    const area = turn(coords, a, b, c);
    if (Math.abs(area) < CONVEX_EPSILON) continue;
    polygons.push(area > 0 ? [a, b, c] : [a, c, b]);
  }
  const owners = new Map();
  polygons.forEach((polygon, index) => forEachEdge(polygon, (u, v) => {
    const key = edgeKey(u, v);
    owners.set(key, [...(owners.get(key) || []), index]);
  }));
  const lengthOf = (key) => {
    const u = Math.floor(key / KEY_BASE);
    const v = key % KEY_BASE;
    return Math.hypot(coords[u * 2] - coords[v * 2], coords[u * 2 + 1] - coords[v * 2 + 1]);
  };
  const diagonals = [...owners.keys()].filter((key) => owners.get(key).length === 2).sort((p, q) => lengthOf(q) - lengthOf(p));
  const alive = polygons.map(() => true);
  for (const key of diagonals) {
    const pair = owners.get(key);
    if (!pair || pair.length !== 2) continue;
    const [keeper, donor] = pair;
    if (keeper === donor || !alive[keeper] || !alive[donor]) continue;
    const merged = mergeAcross(coords, polygons[keeper], polygons[donor], Math.floor(key / KEY_BASE), key % KEY_BASE);
    if (!merged) continue;
    owners.delete(key);
    forEachEdge(polygons[donor], (u, v) => {
      const list = owners.get(edgeKey(u, v));
      if (!list) return;
      const slot = list.indexOf(donor);
      if (slot >= 0) list[slot] = keeper;
    });
    polygons[keeper] = merged;
    alive[donor] = false;
  }
  return polygons
    .filter((_, index) => alive[index])
    .map((polygon) => polygon.flatMap((vertex) => [coords[vertex * 2], coords[vertex * 2 + 1]]))
    .filter(isSturdy);
}

function containsPoint(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export class ShapeDecomposer {
  constructor({ tolerance = 0.85, maxParts = 40, minHoleArea = 8, simpleCells = 90 } = {}) {
    this.tolerance = tolerance;
    this.maxParts = maxParts;
    this.minHoleArea = minHoleArea;
    this.simpleCells = simpleCells;
  }

  decompose(grid, cells) {
    if (cells <= this.simpleCells) return [this.cornerCloud(grid)];
    const loops = this.traceLoops(grid);
    let tolerance = this.tolerance;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const parts = this.partition(loops, tolerance);
      if (parts.length && parts.length <= this.maxParts) return parts;
      tolerance *= TOLERANCE_GROWTH;
    }
    return [this.cornerCloud(grid)];
  }

  cornerCloud(grid) {
    const points = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.solid[y * grid.width + x]) points.push(x, y, x + 1, y, x + 1, y + 1, x, y + 1);
      }
    }
    return points;
  }

  traceLoops(grid) {
    const { width, height, solid } = grid;
    const stride = width + 1;
    const vertexCount = stride * (height + 1);
    const firstOut = new Int32Array(vertexCount).fill(-1);
    const secondOut = new Int32Array(vertexCount).fill(-1);
    const from = [];
    const heading = [];
    const addEdge = (x, y, direction) => {
      const vertex = y * stride + x;
      const edge = from.length;
      from.push(vertex);
      heading.push(direction);
      if (firstOut[vertex] < 0) firstOut[vertex] = edge;
      else secondOut[vertex] = edge;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!solid[index]) continue;
        if (y === 0 || !solid[index - width]) addEdge(x, y, 0);
        if (x === width - 1 || !solid[index + 1]) addEdge(x + 1, y, 1);
        if (y === height - 1 || !solid[index + width]) addEdge(x + 1, y + 1, 2);
        if (x === 0 || !solid[index - 1]) addEdge(x, y + 1, 3);
      }
    }
    const destination = (edge) => from[edge] + EDGE_X[heading[edge]] + EDGE_Y[heading[edge]] * stride;
    const successor = (edge) => {
      const vertex = destination(edge);
      const first = firstOut[vertex];
      const second = secondOut[vertex];
      if (second < 0) return first;
      const rightTurn = (heading[edge] + 1) % 4;
      return heading[first] === rightTurn ? first : second;
    };
    const used = new Uint8Array(from.length);
    const loops = [];
    for (let start = 0; start < from.length; start++) {
      if (used[start]) continue;
      const corners = [];
      let edge = start;
      while (edge >= 0 && !used[edge]) {
        used[edge] = 1;
        const next = successor(edge);
        if (next >= 0 && heading[next] !== heading[edge]) {
          const vertex = destination(edge);
          corners.push(vertex % stride, Math.floor(vertex / stride));
        }
        edge = next;
      }
      if (corners.length >= 6) loops.push(corners);
    }
    return loops;
  }

  partition(loops, tolerance) {
    const outers = [];
    const holes = [];
    for (const loop of loops) {
      const points = simplifyClosed(loop, tolerance);
      if (points.length < 6) continue;
      const area = signedArea(points);
      if (area > 0) outers.push(points);
      else if (-area >= this.minHoleArea) holes.push(points);
    }
    return outers.flatMap((outer) => {
      const ring = [...outer];
      const holeStarts = [];
      for (const hole of holes) {
        if (outers.length > 1 && !containsPoint(outer, hole[0], hole[1])) continue;
        holeStarts.push(ring.length / 2);
        ring.push(...hole);
      }
      return convexPieces(ring, earcut(ring, holeStarts.length ? holeStarts : null));
    });
  }
}
