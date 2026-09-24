import { CrackGrower } from './CrackGrower.js';
import { TAU, gaussian, lerp, randomBetween, randomSign, sum } from '../core/math.js';

const ENTRY_SEARCH_CELLS = 8;
const SEARCH_STEP = 0.5;
const START_JITTER = 0.01;
const EDGE_SPREAD = 0.55;
const GRAIN_WANDER = 0.08;
const CROSS_WANDER = 0.3;
const MARK_SHARE = 0.35;
const DENT_DEPTH_GAIN = 4;
const DENT_FATIGUE = 0.6;
const SHATTER_RAYS = 14;
const SHATTER_RINGS = 4;
const SHATTER_REACH = 1.15;
const RAY_WOBBLE = 0.3;
const KERF_ROUGHNESS = 0.08;

const polar = (angle, pull) => ({ x: Math.cos(angle), y: Math.sin(angle), pull });
const blankOutcome = (point) => ({ point, segments: [], removed: [], dents: [], marks: [], length: 0, changed: false });
const excised = (point, removed) => ({ ...blankOutcome(point), removed, changed: removed.length > 0 });

function pointAtRadius(path, center, radius) {
  let previous = Math.hypot(path[0] - center.x, path[1] - center.y);
  for (let i = 2; i < path.length; i += 2) {
    const distance = Math.hypot(path[i] - center.x, path[i + 1] - center.y);
    if (distance >= radius) {
      const t = distance === previous ? 1 : (radius - previous) / (distance - previous);
      return { x: lerp(path[i - 2], path[i], t), y: lerp(path[i - 1], path[i + 1], t) };
    }
    previous = distance;
  }
  return null;
}

export class FractureModel {
  constructor(material, grain) {
    this.material = material;
    this.grain = grain;
  }

  strike(grid, hit) {
    const point = this.entryPoint(grid, hit);
    const outcome = blankOutcome(point);
    if (!point) return outcome;
    const { fracture, deform, crush } = this.material;
    const root = Math.sqrt(hit.strength);
    const spread = 0.6 + 0.5 * root;
    grid.addDamage(point.x, point.y, fracture.damageRadius * spread, fracture.damagePerHit * hit.strength);
    const stress = grid.damageAt(point.x, point.y);
    if (deform && hit.strength >= deform.threshold) this.dent(grid, point, hit.strength, stress, outcome);
    const hole = hit.strength >= crush.strength || stress >= crush.stress ? this.crush(grid, point, root, outcome) : 0;
    if (hit.shatter) this.shatter(grid, point, hit.shatter, outcome);
    if (hit.strength >= fracture.threshold || stress >= fracture.initiation) this.crack(grid, point, hit, hole, stress, outcome);
    outcome.marks.push({ x: point.x, y: point.y, radius: fracture.damageRadius * MARK_SHARE * spread, strength: hit.strength, hole });
    return outcome;
  }

  carve(grid, { x, y, radius }) {
    return excised({ x, y }, grid.carve(x, y, radius, KERF_ROUGHNESS));
  }

  excise(grid, inside) {
    return excised(null, grid.carveWhere(inside));
  }

  entryPoint(grid, hit) {
    for (let travelled = 0; travelled <= ENTRY_SEARCH_CELLS; travelled += SEARCH_STEP) {
      const x = hit.x + hit.dirX * travelled;
      const y = hit.y + hit.dirY * travelled;
      if (grid.isSolidAt(x, y)) return { x, y };
    }
    return null;
  }

  dent(grid, point, strength, stress, outcome) {
    const { deform } = this.material;
    const radius = deform.radius * (0.75 + 0.45 * Math.sqrt(strength));
    const amount = Math.min(deform.maxPinch, deform.pinch * strength);
    grid.pinch(point.x, point.y, radius, amount);
    const depth = Math.min(1, amount * DENT_DEPTH_GAIN) / (1 + DENT_FATIGUE * stress);
    outcome.dents.push({ x: point.x, y: point.y, radius, amount, depth });
    outcome.changed = true;
  }

  crush(grid, point, root, outcome) {
    const { crush } = this.material;
    const radius = crush.radius * (0.65 + 0.55 * root);
    const removed = grid.carve(point.x, point.y, radius, crush.roughness);
    if (!removed.length) return 0;
    outcome.removed = removed;
    outcome.changed = true;
    return radius;
  }

  crack(grid, point, hit, hole, stress, outcome) {
    const { fracture, pattern } = this.material;
    const root = Math.sqrt(hit.strength);
    const grower = new CrackGrower(grid, pattern, this.grain);
    const budget = fracture.length * Math.pow(hit.strength, fracture.exponent);
    const spent = this.extendTips(grid, grower, point, budget, root);
    const directions = hit.kind === 'edge' ? this.edgeDirections(hit) : this.blowDirections(hit.strength);
    const rays = this.castRays(grid, grower, point, directions, budget - spent);
    if (hit.kind === 'blow' && stress >= fracture.ringStress) this.encircle(grower, point, rays, hole, hit.strength, root);
    grid.tips.push(...grower.tips);
    this.record(outcome, grower);
  }

  shatter(grid, point, radius, outcome) {
    const grower = new CrackGrower(grid, this.material.pattern, this.grain);
    const turn = Math.random() * TAU;
    const spacing = TAU / SHATTER_RAYS;
    const directions = Array.from({ length: SHATTER_RAYS }, (_, i) => polar(turn + spacing * (i + randomBetween(-RAY_WOBBLE, RAY_WOBBLE)), 0));
    const rays = this.castRays(grid, grower, point, directions, radius * SHATTER_REACH * SHATTER_RAYS);
    const radii = Array.from({ length: SHATTER_RINGS }, (_, i) => (radius * (i + 1)) / (SHATTER_RINGS + 1));
    this.weave(grower, point, rays, radii, 1);
    this.record(outcome, grower);
  }

  record(outcome, grower) {
    outcome.segments = outcome.segments.concat(grower.segments);
    outcome.length += grower.length;
  }

  extendTips(grid, grower, point, budget, root) {
    const { fracture } = this.material;
    const reach = fracture.tipReach * (0.7 + 0.3 * root);
    const distanceTo = (tip) => Math.hypot(tip.x - point.x, tip.y - point.y);
    const near = grid.tips.filter((tip) => distanceTo(tip) < reach);
    if (!near.length) return 0;
    grid.tips = grid.tips.filter((tip) => distanceTo(tip) >= reach);
    const share = budget * fracture.tipShare;
    const weights = near.map((tip) => 1 - distanceTo(tip) / reach);
    const total = sum(weights) || 1;
    near.forEach((tip, i) => grower.grow(tip, (share * weights[i]) / total));
    return share;
  }

  castRays(grid, grower, point, directions, budget) {
    const seeds = directions
      .map((direction) => ({ direction, start: this.seedAlong(grid, point, direction) }))
      .filter(({ start }) => start);
    const weights = seeds.map(() => randomBetween(0.65, 1.35));
    const total = sum(weights);
    return seeds.map(({ direction, start }, i) => {
      const seed = { x: start.x, y: start.y, dirX: direction.x, dirY: direction.y, pull: direction.pull };
      return { angle: Math.atan2(direction.y, direction.x), path: grower.grow(seed, (budget * weights[i]) / total) };
    });
  }

  seedAlong(grid, point, direction) {
    const limit = this.material.crush.radius * 3 + 2;
    for (let travelled = 0; travelled <= limit; travelled += SEARCH_STEP) {
      const x = point.x + direction.x * travelled + gaussian() * START_JITTER;
      const y = point.y + direction.y * travelled + gaussian() * START_JITTER;
      if (grid.isSolidAt(x, y)) return { x, y };
    }
    return null;
  }

  blowDirections(strength) {
    const { fracture, pattern } = this.material;
    const [least, most] = fracture.rays;
    const count = Math.max(1, Math.round(least + (most - least) * Math.min(1, strength) * randomBetween(0.7, 1.15)));
    if (fracture.orientation === 'grain' && this.grain) return this.grainDirections(count);
    const base = Math.random() * TAU;
    const spacing = TAU / count;
    return Array.from({ length: count }, (_, i) => polar(base + spacing * (i + randomBetween(-0.3, 0.3)), pattern.grainPull));
  }

  grainDirections(count) {
    const { fracture, pattern } = this.material;
    const along = Math.atan2(this.grain[1], this.grain[0]);
    return Array.from({ length: count }, (_, i) => {
      if (i >= 2 && Math.random() < fracture.crossChance) return polar(along + (randomSign() * Math.PI) / 2 + gaussian() * CROSS_WANDER, 0);
      const heading = i % 2 === 0 ? along : along + Math.PI;
      return polar(heading + gaussian() * GRAIN_WANDER, pattern.grainPull);
    });
  }

  edgeDirections(hit) {
    const count = hit.strength > 0.9 ? 3 : hit.strength > 0.45 ? 2 : 1;
    const base = Math.atan2(hit.dirY, hit.dirX);
    return Array.from({ length: count }, (_, i) => {
      const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * EDGE_SPREAD;
      return polar(base + offset + gaussian() * 0.15, this.material.pattern.grainPull);
    });
  }

  encircle(grower, center, rays, hole, strength, root) {
    const { fracture } = this.material;
    const rings = Math.min(fracture.ringCount, 1 + Math.floor(strength * 1.6));
    const radii = Array.from({ length: rings }, (_, i) => hole + fracture.ringSpacing * (i + 1) * (0.75 + 0.35 * root));
    this.weave(grower, center, rays, radii, fracture.ringChance);
  }

  weave(grower, center, rays, radii, chance) {
    const spokes = rays.filter((ray) => ray.path.length >= 4).sort((a, b) => a.angle - b.angle);
    if (spokes.length < 3) return;
    radii.forEach((radius) => {
      spokes.forEach((spoke, i) => {
        if (Math.random() > chance) return;
        const from = pointAtRadius(spoke.path, center, radius * randomBetween(0.88, 1.12));
        const to = pointAtRadius(spokes[(i + 1) % spokes.length].path, center, radius * randomBetween(0.88, 1.12));
        if (from && to) grower.arc(center, from, to);
      });
    });
  }
}
