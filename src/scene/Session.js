import { ACID, BOOMERANG, CELL_METERS, CLAW, COMPLETION, CUTTER, DRILL, DUST, FIST, FRAGMENTS, FREEZE, GRAB, GRAVITY, IMPACT, KATANA, LAVA, LIGHTNING, MICROWAVE, MOSAIC, ORBITAL, PRESS, PUMP, QUAKE, SAW, SHOCKWAVE, SHRINK, SONIC, SPECIMEN, TERMITE, TESLA, TSUNAMI, VINE } from '../config.js';
import { wholePercent } from '../core/format.js';
import { TAU, clamp, insidePolygon, lerp, normalize, polar, randomBetween, sum, wrap } from '../core/math.js';
import { Fragment, cellFromWorld, cellMapper, velocityAt } from '../destruction/Fragment.js';
import { FragmentBuilder } from '../destruction/FragmentBuilder.js';
import { FractureModel } from '../destruction/FractureModel.js';
import { squeeze, squeezedBounds } from '../destruction/squeeze.js';
import { Splitter } from '../destruction/Splitter.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { ARSENAL } from './arsenal.js';
import { Debris } from './Debris.js';
import { Fallout } from './Fallout.js';
import { ImpactLedger } from './ImpactLedger.js';

const FLOOR_TOLERANCE = 0.004;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const COLLISION_BURST = 0.35;
const RANDOM_TARGET_TRIES = 60;
const SHOCK_SPIN = 4;
const BLAST_DIP = 0.3;
const BLAST_LIFT = 0.7;
const RAY_STEP = 0.8;
const SWALLOW_REACH = 1.5;
const MUZZLE_SMOKE = 3;
const SONIC_GLINT = 'rgba(210,235,255,1)';
const SHRINK_GLINT = 'rgba(225,180,255,1)';
const ACID_STAIN = Object.freeze({ ink: ACID.stain, alpha: ACID.corrosion, spread: 1.4 });
const CRUMB_STRIDE = 4;
const CRUMB_REACH = 0.012;
const BLOCK_REACH = Math.SQRT1_2;

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const markOf = (fragment, line) => ({
  id: fragment.id,
  from: fragment.toMaterial(line.ax, line.ay),
  to: fragment.toMaterial(line.bx, line.by),
});

const shockOf = (force, contact) => Object.fromEntries(
  Object.entries(IMPACT).map(([key, [tap, full]]) => [key, lerp(contact ? tap : 0, full, force)]),
);

const heftOf = (body, minimum) => clamp(SHOCKWAVE.referenceMass / body.mass(), minimum, 1);

function nudge(body, dx, dy) {
  const velocity = body.linvel();
  body.setLinvel({ x: velocity.x + dx, y: velocity.y + dy }, true);
}

function seamsOf(blocks, size) {
  const taken = new Set(blocks.map(([left, top]) => `${left},${top}`));
  return blocks.flatMap(([left, top]) => {
    const right = left + size;
    const bottom = top + size;
    return [
      left, top, right, top,
      left, top, left, bottom,
      ...(taken.has(`${right},${top}`) ? [] : [right, top, right, bottom]),
      ...(taken.has(`${left},${bottom}`) ? [] : [left, bottom, right, bottom]),
    ];
  });
}

export class Session {
  constructor({ specimen, material, room, sound, tool, onEngage }) {
    this.specimen = specimen;
    this.material = material;
    this.room = room;
    this.sound = sound;
    this.onEngage = onEngage;
    this.physics = new PhysicsWorld(room.halfWidth);
    this.builder = new FragmentBuilder(this.physics, material);
    this.splitter = new Splitter(this.builder);
    this.fracture = new FractureModel(material, specimen.grain);
    this.debris = new Debris();
    this.fallout = new Fallout(this.debris, specimen, material.look);
    this.ledger = new ImpactLedger(this.physics);
    this.kit = Object.fromEntries(ARSENAL.map(({ key, arm }) => [key, arm(this)]));
    this.tools = Object.values(this.kit);
    this.tool = this.kit[tool];
    this.fragments = [];
    this.stats = { strikes: 0, crackCells: 0 };
    this.clock = 0;
    this.startedAt = null;
    this.endedAt = null;
    this.lastStrike = -Infinity;
    this.shock = null;
    this.stall = 0;
    this.frozen = false;
    this.prize = null;
    this.spawn();
    this.baseline = this.concentration();
    this.destruction = 0;
  }

  get started() {
    return this.startedAt !== null;
  }

  get pieceCount() {
    return this.fragments.length + this.fallout.chips;
  }

  get demolished() {
    return wholePercent(this.destruction) >= 100;
  }

  get pending() {
    return this.tools.some((tool) => tool.pending);
  }

  get focus() {
    return this.tool.focus;
  }

  get tempo() {
    const stillWorld = this.frozen || this.isQuiet();
    const othersIdle = this.tools.every((tool) => tool === this.tool || !tool.busy);
    return stillWorld && othersIdle ? this.tool.tempo : 1;
  }

  get elapsed() {
    return this.started ? (this.endedAt ?? this.clock) - this.startedAt : 0;
  }

  start() {
    if (!this.started) this.startedAt = this.clock;
  }

  end() {
    if (this.endedAt === null) this.endedAt = this.clock;
    this.stowTools();
  }

  wield() {
    this.tool.active = true;
  }

  refit(aspect) {
    if (aspect === this.room.aspect) return;
    this.room.fit(aspect);
    this.physics.buildRoom(this.room.halfWidth);
    this.stowTools();
  }

  stowTools() {
    this.tools.forEach((tool) => tool.stow());
  }

  equip(key) {
    const next = this.kit[key];
    const { tool } = this;
    if (next === tool) return;
    const { active, present, aimX, aimY } = tool;
    tool.cancel();
    tool.withdraw();
    tool.active = false;
    next.active = active;
    this.tool = next;
    if (present) next.aim(aimX, aimY);
  }

  spawn() {
    const { grid, skin } = this.specimen;
    const { labels, parts } = grid.components();
    const left = -(grid.width * CELL_METERS) / 2;
    const top = -SPECIMEN.dropHeight - grid.height * CELL_METERS;
    parts.forEach((part) => {
      const piece = grid.extract(labels, part);
      const center = piece.centroid();
      const fragment = new Fragment({
        grid: piece,
        skin: skin.extract(part, piece),
        anchorX: center.x,
        anchorY: center.y,
        originX: part.minX,
        originY: part.minY,
      });
      const x = left + (part.minX + center.x) * CELL_METERS;
      const y = top + (part.minY + center.y) * CELL_METERS;
      this.builder.place(fragment, { x, y, angle: 0, vx: 0, vy: 0, spin: 0 });
      this.dress(fragment);
      this.fragments.push(fragment);
    });
  }

  dress(fragment) {
    fragment.skin.paintRim(fragment.grid.freshRims(), this.material.look);
  }

  update(dt) {
    if (this.stall > 0) {
      this.stall -= dt;
      return;
    }
    this.clock += dt;
    this.frozen = this.tools.some((tool) => tool.freezing);
    this.tools.forEach((tool) => tool.update(dt));
    if (this.frozen) return;
    const launch = new Map(this.fragments.map((fragment) => [fragment, fragment.body.linvel()]));
    const simulated = this.physics.advance(dt, (handleA, handleB, impulse) => this.ledger.record(handleA, handleB, impulse));
    this.resolveImpacts((fragment) => this.jolt(fragment, launch.get(fragment), simulated));
    this.debris.update(dt, this.room.halfWidth);
  }

  jolt(fragment, launch, seconds) {
    const velocity = fragment.body.linvel();
    return Math.hypot(velocity.x - launch.x, velocity.y - launch.y - GRAVITY * seconds);
  }

  takeShock() {
    const { shock } = this;
    this.shock = null;
    return shock;
  }

  isBusy(grace) {
    return this.clock - this.lastStrike < grace || this.tools.some((tool) => tool.busy) || !this.isQuiet();
  }

  isQuiet() {
    return !this.debris.busy && !this.physics.hasMotion();
  }

  engage(first) {
    if (!this.started) this.onEngage();
    if (first) this.stats.strikes++;
  }

  touching(x, y, radius) {
    const reach = radius / CELL_METERS;
    return this.fragmentsWithin({ x, y, radius })
      .map((fragment) => ({ fragment, contact: fragment.solidNear(x, y, reach) }))
      .filter(({ contact }) => contact);
  }

  impactArea(blow) {
    const landed = this.hitArea(blow);
    if (landed) {
      this.stats.strikes++;
      this.sound.cue('strike', this.material.key, blow.strength);
    }
    return landed;
  }

  strike(blow) {
    const landed = this.impactArea(blow);
    const grounded = blow.y + blow.radius >= -FLOOR_TOLERANCE;
    if (grounded) this.pound(blow);
    if (!landed && !grounded) this.sound.cue('miss');
    const { hitStop, ...shock } = shockOf(blow.force, landed || grounded);
    this.lastStrike = this.clock;
    this.shock = shock;
    this.stall = hitStop;
    this.sound.cue(blow.cue, blow.force);
    this.blast(blow);
  }

  hitArea(blow) {
    const struck = new Map();
    const mark = (fragment, point, strength) => {
      if (!struck.has(fragment)) struck.set(fragment, []);
      struck.get(fragment).push({ ...blow, ...point, strength });
    };
    this.impactPoints(blow).forEach(({ x, y, strength }) => {
      const contact = this.contactAt(x, y, blow.contact);
      if (contact) mark(contact.fragment, contact.point, strength);
    });
    this.fragmentsWithin(blow)
      .filter((fragment) => !struck.has(fragment))
      .forEach((fragment) => {
        const point = fragment.solidNear(blow.x, blow.y, blow.radius / CELL_METERS);
        if (point) mark(fragment, point, blow.strength * (1 - blow.falloff * Math.hypot(point.x - blow.x, point.y - blow.y) / blow.radius));
      });
    struck.forEach((spots, fragment) => {
      if (fragment.body) this.smite(fragment, spots, blow);
    });
    return struck.size > 0;
  }

  fragmentsWithin({ x, y, radius }) {
    return this.fragments.filter((fragment) => {
      const center = fragment.body.worldCom();
      return Math.hypot(center.x - x, center.y - y) <= radius + fragment.extent;
    });
  }

  blast({ x, y, radius, blast: { reach, speed, heft } }) {
    const thrust = (px, py) => {
      const dx = px - x;
      const dy = py - y;
      const distance = Math.hypot(dx, dy);
      if (distance > reach) return null;
      const kick = speed * clamp((reach - distance) / (reach - radius), 0, 1);
      const [outX, outY] = normalize(dx, dy);
      const [nx, ny] = normalize(outX, Math.min(outY, BLAST_DIP) - BLAST_LIFT);
      return [nx * kick, ny * kick];
    };
    this.sweep(thrust, heft, SHOCK_SPIN);
  }

  sweep(thrust, minimumHeft, spin = 0) {
    if (this.frozen) return;
    this.fragments.forEach(({ body }) => {
      const center = body.worldCom();
      const velocity = body.linvel();
      const push = thrust(center.x, center.y, velocity.x, velocity.y);
      if (!push) return;
      const heft = heftOf(body, minimumHeft);
      nudge(body, push[0] * heft, push[1] * heft);
      if (spin) body.setAngvel(body.angvel() + randomBetween(-spin, spin) * Math.hypot(...push) * heft, true);
    });
    this.debris.stir(thrust);
  }

  impactPoints({ x, y, radius, strength, hits: count, falloff }) {
    const turn = randomBetween(0, TAU);
    return Array.from({ length: count }, (_, i) => {
      const share = count > 1 ? Math.sqrt(i / (count - 1)) : 0;
      const angle = turn + i * GOLDEN_ANGLE;
      return {
        x: x + Math.cos(angle) * radius * share,
        y: y + Math.sin(angle) * radius * share,
        strength: strength * (1 - falloff * share),
      };
    });
  }

  contactAt(x, y, reach) {
    const nearby = this.fragmentsWithin({ x, y, radius: reach });
    for (let i = nearby.length - 1; i >= 0; i--) {
      const fragment = nearby[i];
      const point = fragment.solidNear(x, y, reach / CELL_METERS);
      if (point) return { fragment, point };
    }
    return null;
  }

  grip(x, y, reach) {
    const contact = this.contactAt(x, y, reach);
    if (!contact) return null;
    const { fragment, point } = contact;
    const [cellX, cellY] = fragment.toCell(point.x, point.y);
    return { x: fragment.originX + Math.floor(cellX) + 0.5, y: fragment.originY + Math.floor(cellY) + 0.5 };
  }

  holder(anchor) {
    return this.fragments.find((candidate) => candidate.grid.isSolidAt(anchor.x - candidate.originX, anchor.y - candidate.originY)) ?? null;
  }

  hold(anchor) {
    const fragment = this.holder(anchor);
    if (!fragment) return null;
    const [x, y] = fragment.toWorld(anchor.x - fragment.originX, anchor.y - fragment.originY);
    return { x, y, angle: fragment.body.rotation() };
  }

  smite(fragment, spots, { x, y, strength, radius, shatter, spray, burst }) {
    const shatterCells = shatter ? radius / CELL_METERS : 0;
    const outcomes = spots.map((spot, i) => {
      const outcome = this.hitFragment(fragment, { ...spot, shatter: i === 0 ? shatterCells : 0 }, 'blow');
      this.fallout.impact(spot.x, spot.y, spot.strength, this.paletteOf(fragment, outcome.point), spray);
      return outcome;
    });
    this.apply(fragment, outcomes, { x, y, burst, strength });
  }

  paletteOf(fragment, point) {
    const cell = point || { x: fragment.anchorX, y: fragment.anchorY };
    return () => this.specimen.colorAt(fragment.originX + cell.x, fragment.originY + cell.y);
  }

  grind(cut) {
    const bitten = this.touching(cut.x, cut.y, cut.radius);
    if (!bitten.length) return null;
    this.engage(cut.first);
    const recoil = bitten
      .map(({ fragment, contact }) => (fragment.body ? this.bite(fragment, contact, cut) : [0, 0]))
      .reduce(([sumX, sumY], [kickX, kickY]) => [sumX + kickX, sumY + kickY], [0, 0]);
    this.sound.cue('bite', this.material.key);
    this.shock = SAW.shock;
    return { recoil };
  }

  bite(fragment, contact, { x, y, radius }) {
    const { saw } = this.material;
    const [centerX, centerY] = fragment.toCell(x, y);
    const sweep = this.fracture.carve(fragment.grid, { x: centerX, y: centerY, radius: (radius * saw.reach) / CELL_METERS });
    const [cellX, cellY] = fragment.toCell(contact.x, contact.y);
    const kerf = this.fracture.carve(fragment.grid, { x: cellX, y: cellY, radius: saw.kerf });
    const [awayX, awayY] = normalize(x - contact.x, y - contact.y);
    const fling = normalize(y - contact.y, contact.x - x);
    const crack = this.hitFragment(fragment, { ...contact, normalX: -awayX, normalY: -awayY, strength: saw.strength }, 'edge');
    this.fallout.impact(contact.x, contact.y, saw.strength, this.paletteOf(fragment, crack.point), SAW.spray * saw.spray, Math.atan2(fling[1], fling[0]));
    this.drive(fragment, fling, [-awayX, -awayY], saw.kickback);
    this.apply(fragment, [sweep, kerf, crack], { x: contact.x, y: contact.y, burst: SAW.burst, strength: saw.strength, aim: () => fling });
    const { speed, climb } = SAW.recoil;
    const kick = speed * saw.kickback;
    return [(awayX - fling[0] * climb) * kick, (awayY - fling[1] * climb) * kick];
  }

  drive({ body }, [alongX, alongY], [intoX, intoY], kickback) {
    if (this.frozen) return;
    const heft = heftOf(body, SAW.heft);
    const along = SAW.drive * heft;
    const shove = SAW.shove * kickback * heft;
    nudge(body, alongX * along + intoX * shove, alongY * along + intoY * shove);
  }

  slash(line) {
    this.shock = KATANA.slashShock;
    this.sound.cue('slash');
    return this.marksAlong(line);
  }

  marksAlong(line) {
    return this.fragmentsAlong(line).map((fragment) => markOf(fragment, line));
  }

  slice(line, first) {
    const hits = this.hitsAlong(line.ax, line.ay, line.bx, line.by);
    if (!hits.length) return false;
    this.cut(hits.map(({ fragment }) => markOf(fragment, line)));
    if (!first) return true;
    this.engage(true);
    this.shock = BOOMERANG.shock;
    this.sound.cue('slice');
    return true;
  }

  sever(marks) {
    if (this.cut(marks)) this.stats.strikes++;
    this.shock = KATANA.severShock;
    this.sound.cue('sever');
  }

  cut(marks) {
    return marks.filter((mark) => {
      const targets = this.fragments.filter((fragment) => fragment.descendsFrom(mark.id));
      targets.forEach((fragment) => {
        if (fragment.body) this.cleave(fragment, mark);
      });
      return targets.length > 0;
    }).length;
  }

  fragmentsAlong({ ax, ay, bx, by }) {
    return this.fragments.filter((fragment) => {
      const center = fragment.body.worldCom();
      return distanceToSegment(center.x, center.y, ax, ay, bx, by) <= fragment.extent;
    });
  }

  cleave(fragment, { from, to }) {
    const [fromX, fromY] = fragment.fromMaterial(from);
    const [toX, toY] = fragment.fromMaterial(to);
    const [ax, ay] = fragment.toWorld(fromX, fromY);
    const [bx, by] = fragment.toWorld(toX, toY);
    const line = { ax, ay, bx, by };
    this.score(fragment, [fromX, fromY, toX, toY]);
    this.sparkle(fragment, line);
    const pieces = this.split(fragment, { x: (ax + bx) / 2, y: (ay + by) / 2, burst: 0, strength: 0 });
    if (pieces.length > 1) this.part(pieces, line);
  }

  score(fragment, segments) {
    for (let i = 0; i < segments.length; i += 4) fragment.grid.cutSegment(segments[i], segments[i + 1], segments[i + 2], segments[i + 3], false);
    fragment.skin.drawCracks(segments, this.material.look);
  }

  sparkle(fragment, { ax, ay, bx, by }) {
    for (let i = 1; i <= KATANA.sparkles; i++) {
      const share = i / (KATANA.sparkles + 1);
      const point = fragment.solidNear(lerp(ax, bx, share), lerp(ay, by, share), KATANA.sparkleReach / CELL_METERS);
      if (point) this.fallout.impact(point.x, point.y, 1, this.paletteOf(fragment, null), 1);
    }
  }

  part(pieces, { ax, ay, bx, by }, { part, lift, spin } = KATANA) {
    const [normalX, normalY] = normalize(ay - by, bx - ax);
    pieces.forEach(({ body }) => {
      const center = body.worldCom();
      const side = Math.sign((center.x - ax) * normalX + (center.y - ay) * normalY) || 1;
      nudge(body, normalX * side * part, normalY * side * part - lift);
      body.setAngvel(body.angvel() + side * randomBetween(0, spin), true);
    });
  }

  crush(stroke) {
    const coverage = new Uint8Array(PRESS.bins);
    const bearings = this.fragments
      .filter((fragment) => this.beneath(fragment, stroke))
      .map((fragment) => fragment.body && this.bear(fragment, stroke, coverage))
      .filter(Boolean);
    if (!bearings.length) return null;
    const crushed = bearings.some((bearing) => bearing.crushed);
    if (crushed) this.grindDown(stroke);
    return { resistance: this.material.press.resistance, coverage: sum(coverage) / PRESS.bins, crushed };
  }

  grindDown({ first }) {
    this.engage(first);
    this.shock = PRESS.shock;
    this.sound.cue('crunch', this.material.key);
  }

  beneath(fragment, { x, halfWidth, bottom }) {
    const center = fragment.body.worldCom();
    return Math.abs(center.x - x) <= halfWidth + fragment.extent && center.y - fragment.extent < bottom;
  }

  bear(fragment, stroke, coverage) {
    const survey = this.survey(fragment, stroke, coverage);
    if (!survey.contacts) return null;
    if (survey.base <= stroke.bottom) {
      this.eject(fragment, stroke);
      return null;
    }
    this.shove(fragment, survey, stroke);
    if (survey.top >= stroke.bottom) return { crushed: false };
    const squashing = this.material.press.ductile && this.fits(survey, stroke);
    return { crushed: squashing ? this.squash(fragment, survey, stroke) : this.flatten(fragment, stroke) };
  }

  survey(fragment, { x, halfWidth, bottom }, coverage) {
    const toWorld = cellMapper(fragment.pose());
    const survey = { contacts: 0, sumX: 0, sumY: 0, top: Infinity, base: -Infinity, left: Infinity, right: -Infinity, pivot: null };
    fragment.grid.forEachSolid((cellX, cellY) => {
      const [worldX, worldY] = toWorld(cellX, cellY);
      survey.top = Math.min(survey.top, worldY);
      survey.left = Math.min(survey.left, worldX);
      survey.right = Math.max(survey.right, worldX);
      if (worldY > survey.base) {
        survey.base = worldY;
        survey.pivot = [cellX, cellY];
      }
      const offset = worldX - x;
      if (Math.abs(offset) > halfWidth || worldY >= bottom + PRESS.contactGap) return;
      survey.contacts++;
      survey.sumX += worldX;
      survey.sumY += worldY;
      coverage[Math.min(PRESS.bins - 1, Math.floor(((offset + halfWidth) / (halfWidth * 2)) * PRESS.bins))] = 1;
    });
    return survey;
  }

  fits({ left, right }, { x, halfWidth }) {
    const overlap = Math.min(right, x + halfWidth) - Math.max(left, x - halfWidth);
    return overlap >= (right - left) * PRESS.squashShare;
  }

  shove({ body }, { contacts, sumX, sumY }, { x, halfWidth }) {
    if (this.frozen) return;
    const mass = body.mass();
    const pointX = sumX / contacts;
    const off = clamp((pointX - x) / halfWidth, -1, 1);
    body.applyImpulseAtPoint({ x: off * PRESS.slide * mass, y: PRESS.push * mass }, { x: pointX, y: sumY / contacts }, true);
  }

  eject({ body }, { x }) {
    if (this.frozen) return;
    const side = Math.sign(body.worldCom().x - x) || 1;
    const velocity = body.linvel();
    if (velocity.x * side < PRESS.eject) body.setLinvel({ x: side * PRESS.eject, y: velocity.y }, true);
  }

  squash(fragment, { top, base, pivot }, stroke) {
    if (top > stroke.bottom - PRESS.squashStep) return false;
    const along = Math.max(0, base - stroke.bottom) / (base - top);
    if (along < PRESS.minSquash) return this.flatten(fragment, stroke);
    const across = clamp(1 / along, 1, PRESS.spread / fragment.spread);
    fragment.spread *= across;
    const before = fragment.cells;
    this.deform(fragment, squeeze(pivot, fragment.toLocalDirection(0, 1), along, across));
    const cracks = this.pressCracks(fragment, stroke);
    if (fragment.cells < before) this.squirt(fragment, stroke);
    this.apply(fragment, cracks, this.squeezeImpact(stroke));
    return true;
  }

  deform(fragment, shape) {
    const bounds = squeezedBounds(shape, fragment.grid.width, fragment.grid.height);
    const grid = fragment.grid.resampled(shape.backward, bounds);
    fragment.reshape(grid, fragment.skin.resampled(shape.matrix, bounds, grid), bounds.left, bounds.top);
    fragment.reshaped = true;
  }

  flatten(fragment, stroke) {
    const { x, halfWidth, bottom } = stroke;
    const toWorld = cellMapper(fragment.pose());
    const flattened = this.fracture.excise(fragment.grid, (cellX, cellY) => {
      const [worldX, worldY] = toWorld(cellX, cellY);
      return worldY < bottom && worldY >= bottom - PRESS.band && Math.abs(worldX - x) <= halfWidth;
    });
    if (!flattened.changed) return false;
    this.apply(fragment, [flattened, ...this.pressCracks(fragment, stroke)], this.squeezeImpact(stroke));
    return true;
  }

  pressCracks(fragment, { x, halfWidth, bottom }) {
    const { strength } = this.material.press;
    return Array.from({ length: PRESS.cracks }, (_, i) => lerp(x - halfWidth, x + halfWidth, (i + 0.5) / PRESS.cracks))
      .map((pointX) => fragment.solidNear(pointX, bottom, PRESS.crackReach / CELL_METERS))
      .filter(Boolean)
      .map((point) => {
        const crack = this.hitFragment(fragment, { ...point, normalX: 0, normalY: 1, strength }, 'edge');
        this.fallout.impact(point.x, point.y, strength, this.paletteOf(fragment, crack.point), 1, point.x < x ? Math.PI : 0);
        return crack;
      });
  }

  squirt(fragment, { x, halfWidth, bottom }) {
    [-1, 1].forEach((side) => {
      this.fallout.impact(x + side * halfWidth, bottom, 1, this.paletteOf(fragment, null), 1, side < 0 ? Math.PI : 0);
    });
  }

  squeezeImpact({ x, bottom }) {
    const { strength } = this.material.press;
    return { x, y: bottom, burst: PRESS.burst, strength, aim: (center) => normalize(Math.sign(center.x - x) || 1, -PRESS.squeeze) };
  }

  sear({ x, y, radius, first }, profile) {
    const reach = radius / CELL_METERS + this.material.heat.melt * profile.melt;
    const touched = this.touching(x, y, reach * CELL_METERS);
    if (!touched.length) return false;
    this.engage(first);
    touched.forEach(({ fragment, contact }) => {
      if (fragment.body) this.melt(fragment, contact, { x, y, reach }, profile);
    });
    return true;
  }

  melt(fragment, contact, { x, y, reach }, profile) {
    const { heat } = this.material;
    const [cellX, cellY] = fragment.toCell(x, y);
    fragment.skin.scorch(cellX, cellY, reach * profile.charReach, heat.char);
    const molten = this.fracture.carve(fragment.grid, { x: cellX, y: cellY, radius: reach });
    fragment.reshaped = fragment.reshaped || molten.changed;
    this.fallout.melt(contact.x, contact.y, molten.removed.length, heat.ember);
    this.fallout.smolder(contact.x, contact.y, profile.smoke);
    const [normalX, normalY] = normalize(contact.x - x, contact.y - y);
    const cooled = this.clock - fragment.lastImpact >= profile.crackSeconds;
    const cracks = cooled ? [this.hitFragment(fragment, { ...contact, normalX, normalY, strength: heat.strength }, 'edge')] : [];
    this.apply(fragment, cracks, { x: contact.x, y: contact.y, burst: 0, strength: heat.strength });
  }

  pepper(rounds) {
    rounds.forEach((round) => {
      if (!this.impactArea(round)) this.fallout.puff(round.x, round.y);
      this.blast(round);
    });
    const [{ shock, cue }] = rounds;
    this.lastStrike = this.clock;
    this.shock = shock;
    this.sound.cue(cue);
  }

  bore(bit) {
    const bitten = this.touching(bit.x, bit.y, bit.radius);
    if (!bitten.length) return false;
    this.engage(bit.first);
    bitten.forEach(({ fragment, contact }) => {
      if (fragment.body) this.drillInto(fragment, contact, bit);
    });
    this.sound.cue('bore', this.material.key);
    this.shock = DRILL.shock;
    return true;
  }

  drillInto(fragment, contact, { x, y, radius, crack, pressure }) {
    const [cellX, cellY] = fragment.toCell(x, y);
    const hole = this.fracture.carve(fragment.grid, { x: cellX, y: cellY, radius: radius / CELL_METERS });
    const [normalX, normalY] = polar(randomBetween(0, TAU), 1);
    const strength = lerp(...DRILL.crack, pressure);
    const cracks = crack ? [this.hitFragment(fragment, { ...contact, normalX, normalY, strength }, 'edge')] : [];
    this.fallout.impact(contact.x, contact.y, strength, this.paletteOf(fragment, null), DRILL.spray, -Math.PI / 2);
    this.apply(fragment, [hole, ...cracks], { x, y, burst: DRILL.burst * pressure, strength });
  }

  raycast(ax, ay, bx, by) {
    return this.hitsAlong(ax, ay, bx, by).reduce((first, hit) => (!first || hit.share < first.share ? hit : first), null);
  }

  hitsAlong(ax, ay, bx, by) {
    return this.fragmentsAlong({ ax, ay, bx, by })
      .map((fragment) => this.firstSolid(fragment, ax, ay, bx, by))
      .filter(Boolean);
  }

  firstSolid(fragment, ax, ay, bx, by) {
    const pose = fragment.pose();
    const [fromX, fromY] = cellFromWorld(pose, ax, ay);
    const [toX, toY] = cellFromWorld(pose, bx, by);
    const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / RAY_STEP));
    for (let step = 0; step <= steps; step++) {
      const share = step / steps;
      if (fragment.grid.isSolidAt(lerp(fromX, toX, share), lerp(fromY, toY, share))) return { fragment, share, x: lerp(ax, bx, share), y: lerp(ay, by, share) };
    }
    return null;
  }

  char(x, y, radius, strength) {
    this.fragmentsWithin({ x, y, radius }).forEach((fragment) => {
      const [cellX, cellY] = fragment.toCell(x, y);
      fragment.skin.scorch(cellX, cellY, radius / CELL_METERS, strength);
    });
  }

  electrocute(path, blow) {
    for (let i = 2; i < path.length; i += 2) {
      const line = { ax: path[i - 2], ay: path[i - 1], bx: path[i], by: path[i + 1] };
      this.char(line.bx, line.by, LIGHTNING.charReach, this.material.heat.char);
      this.cut(this.marksAlong(line));
    }
    this.strike(blow);
  }

  incinerate(blow, embers) {
    const { heat } = this.material;
    this.char(blow.x, blow.y, blow.radius, heat.char);
    this.fallout.blaze(blow.x, blow.y, embers, heat.ember);
    this.strike(blow);
  }

  chop({ x, y, dirX, dirY }, blade) {
    const contact = this.contactAt(x, y, blade.reach);
    this.shock = blade.shock;
    if (!contact) {
      this.sound.cue('thud');
      return;
    }
    this.engage(true);
    const { fragment, point } = contact;
    const { strength, size, depth, cue = 'chop' } = blade;
    const outcome = this.hitFragment(fragment, { ...point, normalX: dirX, normalY: dirY, strength }, 'edge');
    this.fallout.impact(point.x, point.y, strength, this.paletteOf(fragment, outcome.point), 1, Math.atan2(-dirY, -dirX));
    this.apply(fragment, [outcome], { x: point.x, y: point.y, burst: 0, strength });
    this.cut(this.marksAlong({ ax: x - dirX * size, ay: y - dirY * size, bx: x + dirX * depth, by: y + dirY * depth }));
    this.sound.cue(cue, this.material.key);
  }

  erode({ x, y, radius, first }, stain = null) {
    const touched = this.touching(x, y, radius);
    if (!touched.length) return touched;
    this.engage(first);
    const reach = radius / CELL_METERS;
    touched.forEach(({ fragment }) => {
      if (!fragment.body) return;
      const [cellX, cellY] = fragment.toCell(x, y);
      if (stain) fragment.skin.tint(cellX, cellY, reach * stain.spread, stain.ink, stain.alpha);
      this.apply(fragment, [this.fracture.carve(fragment.grid, { x: cellX, y: cellY, radius: reach })], { x, y, burst: 0, strength: 0 });
    });
    return touched;
  }

  devour(maw) {
    this.debris.swallow(maw.x, maw.y, maw.radius * SWALLOW_REACH);
    return this.erode(maw).length > 0;
  }

  dissolve(drop) {
    const eaten = this.erode(drop, ACID_STAIN).length > 0;
    if (eaten) this.fallout.fume(drop.x, drop.y, ACID.fumes);
    return eaten;
  }

  nibble(bite) {
    const eaten = this.erode(bite);
    eaten.forEach(({ fragment, contact }) => this.fallout.impact(contact.x, contact.y, 0.4, this.paletteOf(fragment, null), TERMITE.crumbs));
    return eaten.length > 0;
  }

  chill({ x, y, radius, first, cold }) {
    this.fallout.chill(x, y, FREEZE.mist);
    const touched = this.touching(x, y, radius);
    if (!touched.length) return false;
    this.engage(first);
    const reach = radius / CELL_METERS;
    touched.forEach(({ fragment, contact }) => {
      if (!fragment.body) return;
      const [cellX, cellY] = fragment.toCell(x, y);
      fragment.grid.addDamage(cellX, cellY, reach, FREEZE.brittle);
      fragment.skin.tint(cellX, cellY, reach, FREEZE.ice, FREEZE.frost);
      if (Math.random() >= FREEZE.crackChance * cold) return;
      const [normalX, normalY] = polar(randomBetween(0, TAU), 1);
      this.apply(fragment, [this.hitFragment(fragment, { ...contact, normalX, normalY, strength: FREEZE.crack }, 'edge')], { x, y, burst: 0, strength: 0 });
    });
    return true;
  }

  zap({ x, y, normalX, normalY, first }) {
    const contact = this.contactAt(x, y, TESLA.char);
    if (!contact) return;
    this.engage(first);
    const { fragment, point } = contact;
    const { body } = fragment;
    fragment.skin.scorch(...fragment.toCell(point.x, point.y), TESLA.char / CELL_METERS, this.material.heat.char);
    const outcome = this.hitFragment(fragment, { ...point, normalX, normalY, strength: TESLA.strength }, 'edge');
    this.fallout.smolder(point.x, point.y, TESLA.sparks);
    if (!this.frozen) nudge(body, normalX * TESLA.jolt * heftOf(body, 0), normalY * TESLA.jolt * heftOf(body, 0));
    this.apply(fragment, [outcome], { x: point.x, y: point.y, burst: 0, strength: TESLA.strength });
  }

  vaporize({ x, top, bottom, first }) {
    const { halfWidth } = ORBITAL;
    const band = this.fragments.filter((fragment) => {
      const center = fragment.body.worldCom();
      return Math.abs(center.x - x) <= halfWidth + fragment.extent && center.y + fragment.extent >= top && center.y - fragment.extent <= bottom;
    });
    const burnt = band.filter((fragment) => this.incise(fragment, x, top, bottom));
    if (burnt.length) this.engage(first);
    return burnt.length > 0;
  }

  incise(fragment, x, top, bottom) {
    const { halfWidth } = ORBITAL;
    const toWorld = cellMapper(fragment.pose());
    const molten = this.fracture.excise(fragment.grid, (cellX, cellY) => {
      const [worldX, worldY] = toWorld(cellX, cellY);
      return Math.abs(worldX - x) <= halfWidth && worldY >= top && worldY <= bottom;
    });
    if (!molten.changed) return false;
    const middle = (top + bottom) / 2;
    [-1, 1].forEach((side) => this.char(x + side * halfWidth, middle, halfWidth, ORBITAL.char));
    this.fallout.blaze(x, bottom, ORBITAL.embers, this.material.heat.ember);
    this.apply(fragment, [molten], { x, y: bottom, burst: 0, strength: 0 });
    return true;
  }

  beam(x) {
    this.shock = ORBITAL.shock;
    this.sound.cue('orbital');
    this.fallout.puff(x, 0);
    this.blast({ x, y: 0, radius: ORBITAL.halfWidth, blast: ORBITAL.blast });
  }

  pierce(line, beam) {
    const { ax, ay, bx, by } = line;
    const heading = normalize(bx - ax, by - ay);
    const hits = this.hitsAlong(ax, ay, bx, by);
    hits.forEach((hit) => this.tunnel(hit, line, heading, beam));
    if (hits.length) this.engage(true);
    this.shock = beam.shock;
    this.sound.cue(beam.cue, beam.force);
  }

  tunnel({ fragment, x, y }, line, [dirX, dirY], { strength, radius, spray, push, heft: minimumHeft, burst }) {
    if (!fragment.body) return;
    const crack = this.hitFragment(fragment, { x, y, normalX: dirX, normalY: dirY, strength }, 'edge');
    const toWorld = cellMapper(fragment.pose());
    const bore = this.fracture.excise(fragment.grid, (cellX, cellY) => {
      const [worldX, worldY] = toWorld(cellX, cellY);
      return distanceToSegment(worldX, worldY, line.ax, line.ay, line.bx, line.by) <= radius;
    });
    this.fallout.impact(x, y, strength, this.paletteOf(fragment, crack.point), spray, Math.atan2(-dirY, -dirX));
    if (!this.frozen) {
      const heft = heftOf(fragment.body, minimumHeft);
      nudge(fragment.body, dirX * push * heft, dirY * push * heft);
    }
    this.apply(fragment, [crack, bore], { x, y, burst, strength, aim: () => [dirX, dirY] });
  }

  quake(power) {
    this.shock = { trauma: lerp(...QUAKE.trauma, power), kick: 0, punch: 0, flash: 0 };
    for (let i = 0; i < QUAKE.puffs; i++) this.fallout.puff(randomBetween(-this.room.halfWidth, this.room.halfWidth), 0);
    this.sweep((x, y) => {
      if (y < -QUAKE.reach) return null;
      const kick = QUAKE.kick * power * randomBetween(0.4, 1);
      return [randomBetween(-1, 1) * kick * QUAKE.sideways, -kick];
    }, QUAKE.heft, QUAKE.spin);
    [...this.fragments]
      .filter((fragment) => fragment.cells >= FRAGMENTS.minImpactCells)
      .sort((a, b) => b.cells - a.cells)
      .slice(0, QUAKE.tremors)
      .forEach((fragment) => this.tremor(fragment, power));
  }

  tremor(fragment, power) {
    if (!fragment.body) return;
    const center = fragment.body.worldCom();
    const point = fragment.solidNear(center.x + randomBetween(-0.5, 0.5) * fragment.extent, 0, QUAKE.grip / CELL_METERS);
    if (!point) return;
    const strength = QUAKE.crack * power * randomBetween(0.5, 1);
    const outcome = this.hitFragment(fragment, { ...point, normalX: 0, normalY: -1, strength }, 'edge');
    this.fallout.impact(point.x, point.y, strength, this.paletteOf(fragment, outcome.point), QUAKE.spray, -Math.PI / 2);
    this.apply(fragment, [outcome], { x: point.x, y: point.y, burst: 0, strength });
  }

  seize(x, y, reach = GRAB.reach, cue = 'seize') {
    const anchor = this.grip(x, y, reach);
    if (!anchor) return null;
    this.engage(true);
    this.sound.cue(cue);
    return anchor;
  }

  muzzle(x, y, cue) {
    this.fallout.smolder(x, y, MUZZLE_SMOKE);
    this.sound.cue(cue);
  }

  slam(speed) {
    this.sweep(() => [0, speed], 1);
    this.sound.cue('slam');
  }

  tug(anchor, x, y, dt) {
    const fragment = this.holder(anchor);
    if (!fragment) return null;
    const pose = fragment.pose();
    const [gripX, gripY] = cellMapper(pose)(anchor.x - fragment.originX, anchor.y - fragment.originY);
    if (this.frozen) return { x: gripX, y: gripY };
    const [pointX, pointY] = velocityAt(pose, gripX, gripY);
    const offset = Math.hypot(x - gripX, y - gripY);
    const speed = Math.min(GRAB.maxSpeed, offset * GRAB.stiffness) / (offset || 1);
    const share = Math.min(1, GRAB.gain * dt);
    const { body } = fragment;
    const mass = body.mass();
    const impulseX = ((x - gripX) * speed - pointX) * share * mass;
    const impulseY = (((y - gripY) * speed - pointY) * share - GRAVITY * dt) * mass;
    body.applyImpulseAtPoint({ x: impulseX, y: impulseY }, { x: gripX, y: gripY }, true);
    body.setAngvel(body.angvel() * Math.max(0, 1 - GRAB.spinDamping * dt), true);
    return { x: gripX, y: gripY };
  }

  land(x, shock) {
    this.sound.cue('clank');
    this.thump(x, shock);
  }

  trample(blow, shock) {
    this.strike(blow);
    this.thump(blow.x, shock);
  }

  thump(x, shock) {
    this.shock = shock;
    this.fallout.puff(x, 0);
    this.shockwave(x, 1);
  }

  hitFragment(fragment, { x, y, normalX, normalY, strength, shatter = 0 }, kind) {
    fragment.lastImpact = this.clock;
    const [dirX, dirY] = fragment.toLocalDirection(normalX, normalY);
    const [cellX, cellY] = fragment.toCell(x, y);
    return this.fracture.strike(fragment.grid, { x: cellX, y: cellY, strength, kind, dirX, dirY, shatter });
  }

  randomTarget() {
    const fragment = this.fragments.reduce((largest, candidate) => (!largest || candidate.cells > largest.cells ? candidate : largest), null);
    return fragment ? this.spot(fragment) : null;
  }

  spot(fragment) {
    const { grid } = fragment;
    for (let attempt = 0; attempt < RANDOM_TARGET_TRIES; attempt++) {
      const cellX = randomBetween(0, grid.width);
      const cellY = randomBetween(0, grid.height);
      if (grid.isSolidAt(cellX, cellY)) return fragment.toWorld(cellX, cellY);
    }
    return null;
  }

  weighedPick() {
    let roll = Math.random() * sum(this.fragments.map((fragment) => fragment.cells));
    return this.fragments.find((fragment) => (roll -= fragment.cells) <= 0) ?? null;
  }

  shiver(fragment, strength, fatigue) {
    const point = fragment.body && this.spot(fragment);
    if (!point) return null;
    const { grid } = fragment;
    grid.addDamage(grid.width / 2, grid.height / 2, Math.hypot(grid.width, grid.height) / 2, fatigue);
    const [x, y] = point;
    const [normalX, normalY] = polar(randomBetween(0, TAU), 1);
    this.apply(fragment, [this.hitFragment(fragment, { x, y, normalX, normalY, strength }, 'edge')], { x, y, burst: 0, strength: 0 });
    return { x, y };
  }

  resonate({ x, y, power, first }) {
    const strength = SONIC.strength * power * this.material.resonance;
    const ringing = this.fragmentsWithin({ x, y, radius: SONIC.reach })
      .sort((a, b) => b.cells - a.cells)
      .slice(0, SONIC.hits)
      .map((fragment) => this.shiver(fragment, strength, SONIC.fatigue))
      .filter(Boolean);
    ringing.forEach((point) => this.fallout.impact(point.x, point.y, strength, () => SONIC_GLINT, SONIC.glint));
    this.sweep((px, py) => (Math.hypot(px - x, py - y) > SONIC.reach ? null : polar(randomBetween(0, TAU), SONIC.rattle * power)), SONIC.heft);
    if (ringing.length) this.engage(first);
    return ringing.length > 0;
  }

  irradiate({ power, first }) {
    const { radiation, heat } = this.material;
    const strength = MICROWAVE.strength * power * radiation.strength;
    const sparks = Array.from({ length: MICROWAVE.spots }, () => this.weighedPick())
      .filter(Boolean)
      .map((fragment) => {
        const point = this.shiver(fragment, strength, MICROWAVE.fatigue);
        if (point) this.char(point.x, point.y, MICROWAVE.char, heat.char);
        return point;
      })
      .filter(Boolean);
    if (sparks.length) this.engage(first);
    if (!radiation.arcing) return [];
    sparks.forEach((point) => this.fallout.smolder(point.x, point.y, MICROWAVE.arcs));
    return sparks;
  }

  batter({ from, to, direction, height }) {
    const [left, right] = [Math.min(from, to), Math.max(from, to)];
    this.fragments
      .filter((fragment) => {
        const center = fragment.body.worldCom();
        return center.x >= left && center.x < right && center.y > -height;
      })
      .forEach((fragment) => this.drench(fragment, direction));
  }

  drench(fragment, direction) {
    const center = fragment.body.worldCom();
    const hit = this.firstSolid(fragment, center.x - direction * fragment.extent, center.y, center.x, center.y);
    if (!hit) return;
    const { strength } = TSUNAMI;
    const outcome = this.hitFragment(fragment, { x: hit.x, y: hit.y, normalX: direction, normalY: 0, strength }, 'edge');
    this.fallout.splash(hit.x, hit.y, TSUNAMI.spray);
    this.apply(fragment, [outcome], { x: hit.x, y: hit.y, burst: 0, strength });
  }

  punch(blow, [dirX, dirY]) {
    this.strike(blow);
    this.sweep((px, py) => {
      const distance = Math.hypot(px - blow.x, py - blow.y);
      if (distance > FIST.reach) return null;
      const share = 1 - distance / FIST.reach;
      return [dirX * FIST.shove * share, dirY * FIST.shove * share - FIST.lift * share];
    }, FIST.heft);
  }

  inflate(anchor) {
    const fragment = this.holder(anchor);
    if (!fragment) return false;
    const [cellX, cellY] = fragment.fromMaterial([anchor.x, anchor.y]);
    const radius = PUMP.radius / CELL_METERS;
    fragment.grid.pinch(cellX, cellY, radius, -PUMP.swell);
    fragment.skin.pinch(cellX, cellY, radius, -PUMP.swell);
    fragment.grid.addDamage(cellX, cellY, radius, PUMP.strain);
    fragment.reshaped = true;
    this.shock = PUMP.shock;
    const [x, y] = fragment.toWorld(cellX, cellY);
    this.split(fragment, { x, y, burst: 0, strength: 0 });
    return true;
  }

  stamp(outline) {
    const x = sum(outline.map(([pointX]) => pointX)) / outline.length;
    const y = sum(outline.map(([, pointY]) => pointY)) / outline.length;
    const radius = Math.max(...outline.map(([pointX, pointY]) => Math.hypot(pointX - x, pointY - y)));
    const popped = this.fragmentsWithin({ x, y, radius }).filter((fragment) => fragment.body && this.cutOut(fragment, outline, { x, y }));
    this.shock = CUTTER.shock;
    this.sound.cue('cutter');
    if (!popped.length) return;
    this.engage(true);
    this.sound.cue('pop');
  }

  cutOut(fragment, outline, { x, y }) {
    outline.filter((_, i) => i % CRUMB_STRIDE === 0).forEach(([pointX, pointY]) => {
      const point = fragment.solidNear(pointX, pointY, CRUMB_REACH / CELL_METERS);
      if (point) this.fallout.impact(point.x, point.y, CUTTER.crumbs, this.paletteOf(fragment, null), CUTTER.crumbs);
    });
    const cells = outline.map(([pointX, pointY]) => fragment.toCell(pointX, pointY));
    this.score(fragment, cells.flatMap(([ax, ay], i) => [ax, ay, ...cells[(i + 1) % cells.length]]));
    const cookies = this.split(fragment, { x, y, burst: 0, strength: 0 }).filter(({ body }) => {
      const center = body.worldCom();
      return insidePolygon(center.x, center.y, outline);
    });
    cookies.forEach(({ body }) => this.toss(body));
    return cookies.length > 0;
  }

  toss(body) {
    if (this.frozen) return;
    nudge(body, randomBetween(-CUTTER.sway, CUTTER.sway), -CUTTER.pop);
    body.setAngvel(body.angvel() + randomBetween(-CUTTER.spin, CUTTER.spin), true);
  }

  grasp(jaws) {
    const anchor = this.grip(jaws.x, jaws.y, CLAW.reach);
    this.squeeze(jaws, CLAW.squeeze);
    this.shock = CLAW.shock;
    this.sound.cue('clamp');
    if (anchor) this.engage(true);
    return anchor;
  }

  squeeze({ x, y, span }, strength = CLAW.crush) {
    [-1, 1].forEach((side) => {
      const contact = this.contactAt(x + side * span, y, CLAW.reach);
      if (!contact) return;
      const { fragment, point } = contact;
      const outcome = this.hitFragment(fragment, { ...point, normalX: -side, normalY: 0, strength }, 'edge');
      this.fallout.impact(point.x, point.y, strength, this.paletteOf(fragment, outcome.point), 1, side < 0 ? Math.PI : 0);
      this.apply(fragment, [outcome], { x: point.x, y: point.y, burst: 0, strength });
    });
  }

  hurl(anchor) {
    this.sound.cue('jingle');
    const fragment = this.holder(anchor);
    if (!fragment || this.frozen) return;
    nudge(fragment.body, 0, CLAW.hurl);
    this.prize = { fragment, until: this.clock + CLAW.smashSeconds };
  }

  immerse(surface) {
    return [...this.fragments].filter((fragment) => fragment.body && this.scald(fragment, surface)).length > 0;
  }

  scald(fragment, surface) {
    const center = fragment.body.worldCom();
    if (center.y + fragment.extent < surface(center.x)) return false;
    const toWorld = cellMapper(fragment.pose());
    let bottom = -Infinity;
    fragment.grid.forEachSolid((cellX, cellY) => {
      bottom = Math.max(bottom, toWorld(cellX, cellY)[1]);
    });
    const { heat } = this.material;
    const floor = bottom - heat.melt * LAVA.melt * CELL_METERS;
    const { removed, changed } = this.fracture.excise(fragment.grid, (cellX, cellY) => {
      const [x, y] = toWorld(cellX, cellY);
      return y > floor && y > surface(x) + LAVA.gap;
    });
    if (!changed) return false;
    fragment.reshaped = true;
    const { width } = fragment.grid;
    for (let i = 0; i < LAVA.chars; i++) {
      const index = removed[Math.floor(((i + 0.5) * removed.length) / LAVA.chars)];
      const [x, y] = toWorld((index % width) + 0.5, Math.floor(index / width) + 0.5);
      this.char(x, y, LAVA.char, heat.char);
      this.fallout.melt(x, surface(x), removed.length / LAVA.chars, heat.ember);
    }
    this.split(fragment, { x: center.x, y: bottom, burst: 0, strength: 0 });
    return true;
  }

  censor({ x, y, half }) {
    const region = (pointX, pointY) => Math.abs(pointX - x) <= half && Math.abs(pointY - y) <= half;
    const tiled = this.fragmentsWithin({ x, y, radius: half * Math.SQRT2 }).filter((fragment) => fragment.body && this.tile(fragment, region, { x, y }));
    this.shock = MOSAIC.shock;
    this.sound.cue('mosaic');
    if (tiled.length) this.engage(true);
  }

  tile(fragment, region, impact) {
    const blocks = this.tessellate(fragment, region);
    if (!blocks.length) return false;
    fragment.skin.pixelate(blocks, MOSAIC.block);
    this.score(fragment, seamsOf(blocks, MOSAIC.block));
    this.split(fragment, { ...impact, burst: MOSAIC.burst, strength: MOSAIC.strength });
    return true;
  }

  tessellate(fragment, region) {
    const { block } = MOSAIC;
    const { grid } = fragment;
    const toWorld = cellMapper(fragment.pose());
    const blocks = [];
    for (let top = -wrap(fragment.originY, block); top < grid.height; top += block) {
      for (let left = -wrap(fragment.originX, block); left < grid.width; left += block) {
        const middleX = left + block / 2;
        const middleY = top + block / 2;
        if (region(...toWorld(middleX, middleY)) && grid.nearestSolid(middleX, middleY, block * BLOCK_REACH)) blocks.push([left, top]);
      }
    }
    return blocks;
  }

  shrink({ x, y, first }) {
    const contact = this.contactAt(x, y, SHRINK.radius);
    if (!contact) return false;
    this.engage(first);
    const { fragment, point } = contact;
    this.fallout.twinkle(point.x, point.y, SHRINK.glint, SHRINK_GLINT);
    this.deform(fragment, squeeze([fragment.anchorX, fragment.anchorY], [1, 0], SHRINK.factor, SHRINK.factor));
    this.split(fragment, { x, y, burst: 0, strength: 0 });
    return true;
  }

  creep({ from, to, leaf, rooted }) {
    const fragment = this.holder(from);
    if (!fragment) return null;
    const { grid, skin } = fragment;
    const [ax, ay] = fragment.fromMaterial([from.x, from.y]);
    const [bx, by] = fragment.fromMaterial([to.x, to.y]);
    const joined = grid.cutSegment(ax, ay, bx, by, rooted);
    const escaped = !grid.isSolidAt(bx, by);
    grid.addDamage(bx, by, VINE.strain.radius, VINE.strain.amount);
    skin.drawCracks([ax, ay, bx, by], VINE.look);
    if (leaf) skin.leaf(bx, by, Math.atan2(by - ay, bx - ax) + leaf * VINE.leafAngle, VINE.leafSize);
    const ended = joined || escaped;
    if (ended) this.pry(fragment, [ax, ay, bx, by]);
    return { ended };
  }

  pry(fragment, [ax, ay, bx, by]) {
    const [fromX, fromY] = fragment.toWorld(ax, ay);
    const [toX, toY] = fragment.toWorld(bx, by);
    const pieces = this.split(fragment, { x: toX, y: toY, burst: 0, strength: 0 });
    if (pieces.length < 2) return;
    this.part(pieces, { ax: fromX, ay: fromY, bx: toX, by: toY }, VINE.pry);
    this.sound.cue('creak');
  }

  disperse({ x, y, radius }) {
    const reach = radius / CELL_METERS;
    [...this.fragments].forEach((fragment) => {
      if (fragment.body) this.atomize(fragment, [x, y], reach);
    });
  }

  atomize(fragment, spot, reach) {
    const [cellX, cellY] = fragment.fromMaterial(spot);
    const { grid, skin } = fragment;
    if (cellX < -reach || cellY < -reach || cellX > grid.width + reach || cellY > grid.height + reach) return;
    const { removed } = this.fracture.carve(grid, { x: cellX, y: cellY, radius: reach });
    if (!removed.length) return;
    skin.scorch(cellX, cellY, reach * DUST.ashReach, DUST.ash);
    this.fallout.disperse(fragment, removed);
    fragment.reshaped = true;
    const [x, y] = fragment.toWorld(cellX, cellY);
    this.split(fragment, { x, y, burst: 0, strength: 0 });
  }

  pound({ x, strength }) {
    this.sound.cue('thud');
    this.fallout.puff(x, 0);
    this.shockwave(x, Math.min(1, strength));
  }

  shockwave(x, power) {
    if (this.frozen) return;
    for (const fragment of this.fragments) {
      const center = fragment.body.worldCom();
      const distance = Math.hypot(center.x - x, center.y);
      if (distance > SHOCKWAVE.radius) continue;
      const mass = fragment.body.mass();
      const kick = SHOCKWAVE.speed * power * (1 - distance / SHOCKWAVE.radius) * clamp(SHOCKWAVE.referenceMass / mass, 0.15, 1);
      fragment.body.applyImpulse({ x: (center.x - x) * kick * mass, y: -kick * mass }, true);
      fragment.body.setAngvel(fragment.body.angvel() + randomBetween(-SHOCK_SPIN, SHOCK_SPIN) * kick, true);
    }
  }

  apply(fragment, outcomes, impact) {
    const length = sum(outcomes.map((outcome) => this.scar(fragment, outcome)));
    if (length) this.sound.cue('crack', this.material.key, length);
    this.split(fragment, impact);
  }

  scar(fragment, outcome) {
    const { look } = this.material;
    const { skin } = fragment;
    outcome.dents.forEach((dent) => {
      skin.pinch(dent.x, dent.y, dent.radius, dent.amount);
      skin.shadeDent(dent.x, dent.y, dent.radius * 0.8, dent.depth, look.dentGloss);
    });
    outcome.marks.forEach((mark) => this.markImpact(skin, mark, look.mark));
    skin.drawCracks(outcome.segments, look);
    if (outcome.removed.length) this.fallout.spill(fragment, outcome.removed);
    this.stats.crackCells += outcome.length;
    fragment.reshaped = fragment.reshaped || outcome.changed;
    return outcome.length;
  }

  markImpact(skin, mark, style) {
    if (style === 'frost') skin.frost(mark.x, mark.y, Math.max(mark.hole * 1.8, mark.radius * 0.6), mark.strength);
    if (style === 'pit') skin.pit(mark.x, mark.y, mark.radius, mark.strength);
  }

  split(fragment, impact) {
    const index = this.fragments.indexOf(fragment);
    const { survivors, crumbs } = this.splitter.split(fragment);
    this.fragments.splice(index, 1, ...survivors);
    survivors.forEach((piece) => this.dress(piece));
    crumbs.forEach((crumb) => this.fallout.crumble(crumb));
    const fresh = survivors.filter((piece) => piece !== fragment);
    if (fresh.length) {
      this.burst(fresh, impact);
      this.sound.cue('shatter', this.material.key, fresh.length);
    }
    this.enforceBudget();
    this.destruction = clamp((1 - this.concentration() / this.baseline) / COMPLETION.destruction, 0, 1);
    return survivors.filter((piece) => piece.body);
  }

  burst(pieces, { x, y, burst, strength, aim = null }) {
    if (this.frozen) return;
    const root = Math.sqrt(strength);
    const reach = FRAGMENTS.burstRadius * root;
    for (const piece of pieces) {
      const center = piece.body.worldCom();
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance > reach) continue;
      const [dx, dy] = aim ? aim(center) : normalize(center.x - x, center.y - y);
      const falloff = 1 - distance / reach;
      const speed = FRAGMENTS.burstSpeed * burst * root * falloff * randomBetween(0.5, 1.2);
      const lift = aim ? 0 : FRAGMENTS.burstLift * burst * falloff;
      nudge(piece.body, dx * speed, dy * speed - lift);
      piece.body.setAngvel(piece.body.angvel() + randomBetween(-1, 1) * FRAGMENTS.burstSpin * burst * falloff, true);
    }
  }

  enforceBudget() {
    const excess = this.fragments.length - FRAGMENTS.maxBodies;
    if (excess <= 0) return;
    const doomed = new Set([...this.fragments].sort((a, b) => a.cells - b.cells).slice(0, excess));
    doomed.forEach((fragment) => {
      const pose = fragment.pose();
      this.fallout.crumble({
        x: pose.centerX,
        y: pose.centerY,
        vx: pose.vx,
        vy: pose.vy,
        cells: fragment.cells,
        colorX: fragment.originX + fragment.anchorX,
        colorY: fragment.originY + fragment.anchorY,
      });
      this.builder.release(fragment);
    });
    this.fragments = this.fragments.filter((fragment) => !doomed.has(fragment));
  }

  concentration() {
    let total = 0;
    for (const fragment of this.fragments) {
      const share = fragment.cells / this.specimen.totalCells;
      total += share * share;
    }
    return total;
  }

  resolveImpacts(joltOf) {
    const impacts = this.ledger
      .drain()
      .filter(({ fragment }) => fragment.body)
      .map((impact) => ({ ...impact, speed: Math.min(joltOf(impact.fragment), impact.impulse / impact.fragment.body.mass()) }));
    impacts.forEach(({ speed }) => {
      if (speed > FRAGMENTS.soundSpeed) this.sound.collide(this.material.key, speed);
    });
    const landing = impacts.find((impact) => this.lands(impact));
    if (landing) this.smash(landing);
    impacts
      .filter((impact) => impact !== landing && this.breaksOnImpact(impact.fragment, impact.speed))
      .sort((a, b) => b.speed - a.speed)
      .slice(0, FRAGMENTS.impactsPerFrame)
      .forEach((impact) => this.shatterOnImpact(impact));
  }

  lands({ fragment, speed }) {
    const { prize } = this;
    return prize !== null && prize.fragment === fragment && this.clock <= prize.until && speed >= CLAW.impactSpeed[0];
  }

  smash({ own, other, speed }) {
    this.prize = null;
    const contact = this.physics.contact(own, other);
    if (!contact) return;
    const { impactSpeed, strength } = CLAW;
    const force = clamp((speed - impactSpeed[0]) / (impactSpeed[1] - impactSpeed[0]), 0, 1);
    this.strike({ ...CLAW.smash, x: contact.x, y: contact.y, strength: lerp(...strength, force), force });
  }

  breaksOnImpact(fragment, speed) {
    return this.started
      && speed >= this.material.collision.speed
      && fragment.cells >= FRAGMENTS.minImpactCells
      && this.clock - fragment.lastImpact >= FRAGMENTS.impactCooldown;
  }

  shatterOnImpact({ fragment, own, other, speed }) {
    if (!fragment.body) return;
    const contact = this.physics.contact(own, other);
    if (!contact) return;
    const ratio = speed / this.material.collision.speed;
    const strength = Math.min(1.2, this.material.collision.scale * (ratio * ratio - 1));
    if (strength <= 0) return;
    const center = fragment.body.worldCom();
    const [normalX, normalY] = normalize(center.x - contact.x, center.y - contact.y);
    const outcome = this.hitFragment(fragment, { x: contact.x, y: contact.y, normalX, normalY, strength }, 'edge');
    this.apply(fragment, [outcome], { x: contact.x, y: contact.y, burst: COLLISION_BURST, strength });
  }

  dispose() {
    this.physics.dispose();
  }
}
