export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

export const lerp = (from, to, t) => from + (to - from) * t;

export const easeIn = (t) => t ** 3;

export const easeOut = (t) => 1 - (1 - t) ** 3;

export const randomBetween = (min, max) => min + (max - min) * Math.random();

export const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));

export const randomSign = () => (Math.random() < 0.5 ? -1 : 1);

export const wrap = (value, size) => ((value % size) + size) % size;

export function gaussian() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}

export const polar = (angle, distance) => [Math.cos(angle) * distance, Math.sin(angle) * distance];

export function rotate(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

export function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

export function insidePolygon(x, y, points) {
  let inside = false;
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length];
    if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay)) inside = !inside;
  });
  return inside;
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function sum(values) {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
